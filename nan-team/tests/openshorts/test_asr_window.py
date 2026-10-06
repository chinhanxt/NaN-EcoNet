"""operation=edit with segments transcribes only the segments' hull (+pad), in absolute source time."""
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

PACKAGE = Path(__file__).resolve().parents[2] / 'packages/openshorts-engine'
sys.path[:0] = [str(PACKAGE / 'src'), str(PACKAGE / 'core')]
import analysis
import pipeline

INFO = {'duration': 87.0, 'audio': True}


def edit(*spans):
    return {'operation': 'edit', 'segments': [{'startSeconds': a, 'endSeconds': b} for a, b in spans]}


def relative_transcript():
    """What the ASR returns for the cut: times relative to the start of the window."""
    words = [{'word': ' xin', 'start': 3.2, 'end': 3.5, 'probability': .9},
             {'word': ' chào', 'start': 3.6, 'end': 4.0, 'probability': .9}]
    return {'language': 'vi', 'text': 'xin chào',
            'segments': [{'start': 3.2, 'end': 4.0, 'text': ' xin chào', 'words': words}],
            'asr': {'runtime': {'model': 'turbo'}, 'durationSeconds': 24.0,
                    'segmentation': {'speechRegions': [[3.1, 4.1]], 'clips': [[2.9, 4.3]]},
                    'rawSegments': [{'start': 3.2, 'end': 4.0, 'text': ' xin chào', 'words': copy.deepcopy(words)}],
                    'quality': {'warnings': [], 'endWindow': [{'start': 3.6, 'end': 4.0, 'suspected': False}],
                                'discarded': {'clipRemainders': [{'start': 3.9, 'end': 4.0, 'text': 'x', 'words': 1}]}}}}


class AsrWindowTest(unittest.TestCase):
    def test_window_is_the_segment_hull_plus_pad_only_for_edits(self):
        self.assertEqual(pipeline.asr_window(edit((40, 50), (52, 58)), INFO), (37.0, 61.0))
        self.assertEqual(pipeline.asr_window(edit((1, 10)), INFO), (0.0, 13.0))
        self.assertIsNone(pipeline.asr_window({'operation': 'clips', 'segments': [{'startSeconds': 1, 'endSeconds': 9}]}, INFO))
        self.assertIsNone(pipeline.asr_window({'operation': 'edit'}, INFO))
        self.assertIsNone(pipeline.asr_window(edit((2, 80)), INFO))  # almost the whole source: no cut

    def test_shift_transcript_rebases_every_timed_record(self):
        shifted = pipeline.shift_transcript(relative_transcript(), 37.0, 61.0)
        segment = shifted['segments'][0]
        self.assertEqual((segment['start'], segment['end']), (40.2, 41.0))
        self.assertEqual([(w['start'], w['end']) for w in segment['words']], [(40.2, 40.5), (40.6, 41.0)])
        asr = shifted['asr']
        self.assertEqual(asr['rawSegments'][0]['words'][1]['start'], 40.6)
        self.assertEqual(asr['segmentation'], {'speechRegions': [[40.1, 41.1]], 'clips': [[39.9, 41.3]]})
        self.assertEqual(asr['quality']['endWindow'][0]['start'], 40.6)
        self.assertEqual(asr['quality']['discarded']['clipRemainders'][0]['end'], 41.0)
        self.assertEqual(asr['window'], {'startSeconds': 37.0, 'endSeconds': 61.0, 'fromStart': False})
        self.assertEqual(asr['durationSeconds'], 24.0)  # decoder receipt is left as decoded

    def test_transcript_cuts_audio_and_returns_absolute_times(self):
        calls = []
        with patch('subprocess.run', side_effect=lambda command, **_: calls.append(command)), \
                patch.object(pipeline, 'transcribe_released', side_effect=lambda path: relative_transcript()) as asr:
            result = pipeline._transcript('/src.mp4', INFO, True, (37.0, 61.0))
        command = calls[0]
        self.assertEqual(command[0], 'ffmpeg')
        self.assertEqual(command[command.index('-ss') + 1], '37.000')
        self.assertEqual(command[command.index('-t') + 1], '24.000')
        self.assertTrue(asr.call_args[0][0].endswith('window.wav'))
        self.assertEqual(result['segments'][0]['words'][0]['start'], 40.2)
        with patch.object(pipeline, 'transcribe_released', return_value={'segments': []}) as whole:
            pipeline._transcript('/src.mp4', INFO, True)
        whole.assert_called_once_with('/src.mp4')  # clips / no window: unchanged full-source ASR

    def test_pauses_never_claim_silence_outside_the_window(self):
        shifted = pipeline.shift_transcript(relative_transcript(), 37.0, 61.0)
        self.assertEqual(analysis._pauses(shifted, 87.0), [(37.0, 40.1), (41.1, 61.0)])
        unwindowed = relative_transcript()
        self.assertEqual(analysis._pauses(unwindowed, 87.0), [(0.0, 3.1), (4.1, 87.0)])

    def test_parent_windowed_transcript_reused_only_for_spans_inside_it(self):
        import asr_identity
        runtime = asr_identity.current()
        transcript = pipeline.shift_transcript(relative_transcript(), 37.0, 61.0)
        transcript['asr'].update(runtime=runtime, repair={'edits': [], 'failedChunks': 0})
        parent = {'sourceFingerprint': 's', 'engineFingerprint': 'e', 'asrRuntime': runtime,
                  'media': {'duration': 87.0}, 'scenes': [{'startSeconds': 0, 'endSeconds': 87.0}],
                  'transcript': transcript}
        inside = analysis.parent_analysis({'parentAnalysis': parent, **edit((40, 58))}, 's', 'e', INFO)
        self.assertEqual(inside['transcript']['asr']['window']['startSeconds'], 37.0)
        outside = analysis.parent_analysis({'parentAnalysis': parent, **edit((20, 58))}, 's', 'e', INFO)
        self.assertIsNone(outside['transcript'])
        clips = analysis.parent_analysis({'parentAnalysis': parent, 'operation': 'clips'}, 's', 'e', INFO)
        self.assertIsNone(clips['transcript'])


def trimmed_transcript():
    """Window decode whose end-window trim removed the last words ("đà nẵng") at the window cut."""
    kept = [{'word': ' xin', 'start': 3.2, 'end': 3.5, 'probability': .9},
            {'word': ' chào', 'start': 3.6, 'end': 4.0, 'probability': .9}]
    tail = [{'word': ' đà', 'start': 22.9, 'end': 23.3, 'probability': .4},
            {'word': ' nẵng', 'start': 23.4, 'end': 23.95, 'probability': .3}]
    raw = [{'start': 3.2, 'end': 4.0, 'text': ' xin chào', 'words': copy.deepcopy(kept),
            'metrics': {}, 'seek': 0, 'dropped': None},
           {'start': 22.9, 'end': 23.95, 'text': ' đà nẵng', 'words': copy.deepcopy(tail),
            'metrics': {}, 'seek': 2000, 'dropped': None}]
    return {'language': 'vi', 'text': 'xin chào',
            'segments': [{'start': 3.2, 'end': 4.0, 'text': ' xin chào', 'words': copy.deepcopy(kept)}],
            'asr': {'runtime': {'model': 'turbo'}, 'durationSeconds': 24.0,
                    'segmentation': {'speechRegions': [[3.1, 4.1], [22.8, 24.0]], 'clips': [[2.9, 24.0]]},
                    'rawSegments': raw,
                    'quality': {'warnings': ['ASR end-window text at 22.90-23.95s ("đà nẵng") has possible '
                                             'hallucination signals (low-probability); removed from captions',
                                             'ASR has 1 low-confidence words'],
                                'transcriptModified': True, 'wordsDiscarded': 2,
                                'endWindow': [{'start': 22.9, 'end': 23.95, 'suspected': True}],
                                'discarded': {'clipRemainders': [], 'endWindowWords': ['đà', 'nẵng']}}}}


class WindowEndTrimTest(unittest.TestCase):
    def run_window(self, window):
        with patch('subprocess.run'), \
                patch.object(pipeline, 'transcribe_released', side_effect=lambda path: trimmed_transcript()):
            return pipeline._transcript('/src.mp4', INFO, True, window)

    def test_window_cut_before_source_end_restores_trimmed_words(self):
        result = self.run_window((37.0, 61.0))
        words = [w['word'].strip() for s in result['segments'] for w in s['words']]
        self.assertEqual(words, ['xin', 'chào', 'đà', 'nẵng'])
        # Restored words are in absolute source time, without raw-decode bookkeeping.
        self.assertEqual(result['segments'][1]['words'][0]['start'], 59.9)
        self.assertEqual(result['segments'][1]['end'], 60.95)
        self.assertNotIn('metrics', result['segments'][1])
        self.assertNotIn('dropped', result['segments'][1])
        self.assertEqual(result['text'], 'xin chào đà nẵng')
        quality = result['asr']['quality']
        self.assertFalse(quality['transcriptModified'])
        self.assertEqual(quality['wordsDiscarded'], 0)
        self.assertEqual(quality['discarded']['endWindowWords'], [])
        self.assertEqual(quality['discarded']['restoredAtWindowCut'], ['đà', 'nẵng'])
        self.assertEqual(quality['warnings'], ['ASR has 1 low-confidence words'])

    def test_window_reaching_source_end_keeps_the_trim(self):
        result = self.run_window((63.0, 87.0))
        words = [w['word'].strip() for s in result['segments'] for w in s['words']]
        self.assertEqual(words, ['xin', 'chào'])
        quality = result['asr']['quality']
        self.assertTrue(quality['transcriptModified'])
        self.assertEqual(quality['wordsDiscarded'], 2)
        self.assertEqual(quality['discarded']['endWindowWords'], ['đà', 'nẵng'])
        self.assertTrue(any(w.startswith('ASR end-window text at ') for w in quality['warnings']))

    def test_untrimmed_window_transcript_is_unchanged(self):
        transcript = relative_transcript()
        self.assertEqual(pipeline._restore_window_end(copy.deepcopy(transcript)), transcript)


if __name__ == '__main__':
    unittest.main()
