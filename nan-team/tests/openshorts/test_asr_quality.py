"""ASR decodes silence-bounded clips, drops clip-remainder re-decodes and trims flagged end-window tails.

Fixtures are modeled on real receipts for the 30-second Vietcetera cut
(phowhisper-acoustic.log, phowhisper-decode-variants/receipt.json), where
"... là cái thời điểm." was followed by "thất bại." or an unrelated news sentence.
Word timings and confidences are synthetic: those logs record text only.
"""
import copy
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import analysis
import asr_identity
import asr_quality
import transcribe_backends

GOOD = {'avgLogprob': -0.3, 'noSpeechProb': 0.02, 'compressionRatio': 1.2, 'temperature': 0.0}


def word(text, start, end, probability):
    return {'word': text, 'start': start, 'end': end, 'probability': probability}


def segment(words):
    return {'start': words[0]['start'], 'end': words[-1]['end'],
            'text': ''.join(w['word'] for w in words), 'words': words}


SPOKEN = [word(' là', 27.0, 27.2, .9), word(' cái', 27.2, 27.5, .92),
          word(' thời', 27.5, 27.9, .95), word(' điểm.', 27.9, 28.4, .9)]
NEWS = ' một ngày qua từ thành phố đã khai thác cán bộ công an xã hội đà nẵng.'.split(' ')[1:]


class EndWindowTests(unittest.TestCase):
    def test_trailing_words_after_last_sentence_are_flagged_but_kept(self):
        tail = [word(' thất', 29.6, 29.6, .2), word(' bại.', 29.6, 29.62, .15)]
        segments = [segment(SPOKEN + tail)]
        before = copy.deepcopy(segments)
        report = asr_quality.assess(segments, [GOOD], 30.0)
        self.assertEqual(segments, before)
        whole, trailing = report['endWindow']
        self.assertFalse(whole['suspected'])
        self.assertEqual(trailing['scope'], 'after-last-sentence-end')
        self.assertEqual(trailing['text'], 'thất bại.')
        self.assertTrue(trailing['suspected'])
        self.assertEqual(trailing['categories'], ['confidence', 'timing'])
        self.assertTrue(trailing['speechReachesMediaEnd'])
        self.assertEqual([w['word'] for w in report['invalidWordTimings']], ['thất'])
        self.assertEqual(len(report['warnings']), 2)
        self.assertIn('"thất bại."', report['warnings'][1])
        self.assertIn('kept unchanged', report['warnings'][1])
        self.assertIn('media end', report['warnings'][1])
        self.assertEqual((report['transcriptModified'], report['wordsDiscarded']), (False, 0))

    def test_unrelated_final_segment_is_flagged_by_confidence_and_rate(self):
        news = [word(' ' + text, 28.9 + i*0.06, 28.9 + (i + 1)*0.06, .3) for i, text in enumerate(NEWS)]
        report = asr_quality.assess([segment(SPOKEN), segment(news)],
                                    [GOOD, {**GOOD, 'avgLogprob': -1.2}], 30.0)
        [span] = report['endWindow']
        self.assertEqual((span['scope'], span['segmentIndex']), ('final-segment', 1))
        self.assertTrue(span['suspected'])
        self.assertIn('implausible-speech-rate', span['signals'])
        self.assertIn('low-avg-logprob', span['signals'])
        self.assertEqual(report['invalidWordTimings'], [])
        self.assertIn('đà nẵng.', report['warnings'][0])

    def test_plausible_speech_cut_at_media_end_is_not_flagged(self):
        spoken = [word(' ' + text, 26.0 + i*0.3, 26.25 + i*0.3, .85)
                  for i, text in enumerate('và đúng là bây giờ nó là cái thời điểm mà mình'.split())]
        report = asr_quality.assess([segment(spoken)], [GOOD], 29.9)
        [span] = report['endWindow']
        self.assertFalse(span['suspected'])
        self.assertEqual(span['signals'], [])
        self.assertTrue(span['speechReachesMediaEnd'])
        self.assertEqual(report['warnings'], [])

    def test_single_kind_of_evidence_is_recorded_without_warning(self):
        quiet = [word(' ' + text, 27.0 + i*0.3, 27.25 + i*0.3, .3) for i, text in enumerate('chữa lành bản thân'.split())]
        report = asr_quality.assess([segment(quiet)], [{**GOOD, 'avgLogprob': -0.4}], 28.5)
        self.assertEqual(report['endWindow'][0]['signals'], ['low-word-confidence'])
        self.assertFalse(report['endWindow'][0]['suspected'])
        self.assertEqual(report['warnings'], [])

    def test_correlated_timing_signals_do_not_flag_confident_words(self):
        # Zero-length words also compress the span; that is one cause, not two.
        crowded = [word(' mình', 29.0, 29.0, .95), word(' đúng', 29.0, 29.0, .93), word(' là', 29.0, 29.01, .9)]
        report = asr_quality.assess([segment(crowded)], [GOOD], 29.2)
        span = report['endWindow'][0]
        self.assertEqual(span['categories'], ['timing'])
        self.assertFalse(span['suspected'])
        self.assertEqual([w['reason'] for w in report['invalidWordTimings']], ['zero-duration', 'zero-duration'])
        self.assertEqual(len(report['warnings']), 1)
        self.assertIn('2 word(s) with invalid timing', report['warnings'][0])

    def test_final_segment_far_from_media_end_is_not_an_end_window(self):
        report = asr_quality.assess([segment(SPOKEN)], [GOOD], 45.0)
        self.assertEqual(report['endWindow'], [])

    def test_negative_and_non_finite_timings_are_reported(self):
        words = [word(' a', 1.0, 0.9, .9), word(' b', float('nan'), 2.0, .9), word(' c', 2.0, 2.3, .9)]
        found = asr_quality.invalid_word_timings([segment(words)])
        self.assertEqual([(w['word'], w['reason']) for w in found], [('a', 'negative-duration'), ('b', 'non-finite')])


class TrimTests(unittest.TestCase):
    def test_only_the_suspected_tail_words_are_trimmed(self):
        tail = [word(' thất', 29.6, 29.6, .2), word(' bại.', 29.6, 29.62, .15)]
        segments = [segment(SPOKEN + tail)]
        before = copy.deepcopy(segments)
        report = asr_quality.assess(segments, [GOOD], 30.0, trim=True)
        kept, removed = asr_quality.trim_end_window(segments, report)
        self.assertEqual(segments, before)
        self.assertEqual([w['word'] for w in removed], [' thất', ' bại.'])
        self.assertEqual(kept[0]['words'], SPOKEN)
        self.assertEqual((kept[0]['text'], kept[0]['end']), (' là cái thời điểm.', 28.4))
        self.assertEqual((report['transcriptModified'], report['wordsDiscarded']), (True, 2))
        self.assertIn('removed from captions', report['warnings'][1])

    def test_suspected_final_segment_is_removed_whole(self):
        news = [word(' ' + text, 28.9 + i*0.06, 28.9 + (i + 1)*0.06, .3) for i, text in enumerate(NEWS)]
        segments = [segment(SPOKEN), segment(news)]
        report = asr_quality.assess(segments, [GOOD, {**GOOD, 'avgLogprob': -1.2}], 30.0, trim=True)
        kept, removed = asr_quality.trim_end_window(segments, report)
        self.assertEqual((len(kept), len(removed)), (1, len(NEWS)))

    def test_confident_speech_is_never_trimmed(self):
        report = asr_quality.assess([segment(SPOKEN)], [GOOD], 28.5, trim=True)
        kept, removed = asr_quality.trim_end_window([segment(SPOKEN)], report)
        self.assertEqual((kept, removed), ([segment(SPOKEN)], []))
        self.assertFalse(report['transcriptModified'])


class ClipPlanTests(unittest.TestCase):
    # VAD regions measured on the Vietcetera fixture (reports/openshorts-integration/phowhisper-silence-clips).
    SPEECH = [[0.0, 6.72], [7.712, 10.4], [11.104, 16.384], [16.8, 20.736], [21.568, 27.2], [28.064, 30.4],
              [31.232, 33.056], [33.728, 37.184], [37.792, 40.32], [40.704, 43.712], [44.096, 45.056],
              [45.632, 47.136], [47.744, 48.576], [48.992, 50.56], [51.296, 53.92], [54.368, 54.56],
              [55.328, 56.512], [56.864, 58.528], [59.552, 60.0]]

    def test_clips_end_in_pauses_not_at_fixed_30_second_windows(self):
        clips = transcribe_backends.plan_clips(self.SPEECH, 60.0, 25.0, 0.2)
        self.assertEqual(clips, [[0.0, 20.936], [21.368, 45.256], [45.432, 60.0]])
        for start, end in clips:
            self.assertLessEqual(end - start, 25.4)
            self.assertFalse(any(s < start < e or s < end < e for s, e in self.SPEECH))

    def test_pad_never_crosses_the_middle_of_a_short_pause(self):
        self.assertEqual(transcribe_backends.plan_clips([[0.5, 10.0], [10.1, 30.0]], 31.0, 25.0, 0.2),
                         [[0.3, 10.05], [10.05, 30.2]])
        self.assertEqual(transcribe_backends.plan_clips([], 10.0, 25.0, 0.2), [])

    def test_only_sub_second_leftovers_after_a_first_window_are_remainders(self):
        clips = [[0.0, 20.936], [21.368, 45.256]]
        remainder = SimpleNamespace(seek=2050)
        self.assertTrue(transcribe_backends.clip_remainder(remainder, clips, 1.0))
        self.assertFalse(transcribe_backends.clip_remainder(SimpleNamespace(seek=0), clips, 1.0))
        self.assertFalse(transcribe_backends.clip_remainder(SimpleNamespace(seek=2137), clips, 1.0))
        self.assertFalse(transcribe_backends.clip_remainder(SimpleNamespace(seek=3000), clips, 1.0))


SEGMENTATION = dict(asr_identity.SEGMENTATION)
RUNTIME = {'files': {'model.bin': 'weights'}, 'device': 'cpu', 'computeType': 'int8',
           'modelProvenance': {'model': 'mobiuslabsgmbh/faster-whisper-large-v3-turbo'},
           'decode': {'beam_size': 5, 'vad_filter': False, 'condition_on_previous_text': False,
                      'word_timestamps': True, 'language': 'vi'},
           'segmentation': SEGMENTATION}
DECODER = {'device': 'cpu', 'computeType': 'int8', 'files': {'model.bin': 'weights'}, 'cpuThreads': 1,
           'loadedDevice': 'cpu', 'loadedComputeType': 'int8', 'multilingual': True}


def info(**changes):
    options = SimpleNamespace(beam_size=5, condition_on_previous_text=False, word_timestamps=True)
    values = {'language': 'vi', 'language_probability': 1.0, 'duration': 30.0, 'duration_after_vad': 29.0,
              'transcription_options': options, 'vad_options': object()}
    return SimpleNamespace(**{**values, **changes})


class DecoderBindingTests(unittest.TestCase):
    def test_binding_records_what_actually_decoded(self):
        bound = asr_identity.bind_decoder(RUNTIME, DECODER, info())
        self.assertEqual(bound['decoder'], DECODER)
        self.assertEqual(bound['decodeOptionsVerified'],
                         {'beam_size': 5, 'condition_on_previous_text': False, 'word_timestamps': True})
        self.assertEqual((bound['language'], bound['durationSeconds'], bound['vadApplied']), ('vi', 30.0, True))
        self.assertEqual(bound['provenanceModel'], 'mobiuslabsgmbh/faster-whisper-large-v3-turbo')
        self.assertEqual(bound['warnings'], [])

    def test_mismatched_bytes_options_or_language_are_refused(self):
        with self.assertRaisesRegex(RuntimeError, 'bytes differ'):
            asr_identity.bind_decoder(RUNTIME, {**DECODER, 'files': {'model.bin': 'other'}}, info())
        options = SimpleNamespace(beam_size=1, condition_on_previous_text=False, word_timestamps=True)
        with self.assertRaisesRegex(RuntimeError, 'beam_size=1'):
            asr_identity.bind_decoder(RUNTIME, DECODER, info(transcription_options=options))
        with self.assertRaisesRegex(RuntimeError, "language 'en'"):
            asr_identity.bind_decoder(RUNTIME, DECODER, info(language='en'))

    def test_cpu_fallback_is_reported(self):
        runtime = {**RUNTIME, 'device': 'cuda', 'computeType': 'float16'}
        bound = asr_identity.bind_decoder(runtime, DECODER, info())
        self.assertIn('instead of configured cuda/float16', bound['warnings'][0])

    def test_loaded_decoder_reads_ctranslate2_state(self):
        model = SimpleNamespace(model=SimpleNamespace(device='cpu', compute_type='int8_float32', is_multilingual=True))
        decoder = asr_identity.loaded_decoder(model, device='cpu', compute_type='int8',
                                              files=(('model.bin', 'weights'),), threads=1)
        self.assertEqual(decoder['files'], {'model.bin': 'weights'})
        self.assertEqual((decoder['loadedDevice'], decoder['loadedComputeType']), ('cpu', 'int8_float32'))
        self.assertIsNone(asr_identity.loaded_decoder(object(), 'cpu', 'int8', (), 1)['loadedDevice'])


class FakeWhisperModel:
    def __init__(self, path, **kwargs):
        self.path, self.kwargs = path, kwargs
        self.model = SimpleNamespace(device=kwargs['device'], compute_type='int8_float32', is_multilingual=True)


class WhisperBackendTests(unittest.TestCase):
    def setUp(self):
        for name, value in (('_whisper_model', None), ('_whisper_key', None),
                            ('_whisper_decoder', None), ('_whisper_force_cpu', False)):
            patcher = patch.object(transcribe_backends, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        environment = patch.dict(os.environ, {'WHISPER_MODEL': '/models/whisper', 'WHISPER_DEVICE': 'cpu',
                                              'WHISPER_COMPUTE': 'int8', 'OPENSHORTS_THREADS': '1'})
        environment.start()
        self.addCleanup(environment.stop)
        modules = patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=FakeWhisperModel)})
        modules.start()
        self.addCleanup(modules.stop)

    def test_resident_model_carries_its_load_time_identity(self):
        with patch('asr_identity.current', return_value={'files': {'model.bin': 'weights'}}):
            model, device, decoder = transcribe_backends._get_whisper_model()
        self.assertEqual((model.path, device), ('/models/whisper', 'cpu'))
        self.assertEqual(decoder['files'], {'model.bin': 'weights'})
        self.assertEqual(decoder['loadedComputeType'], 'int8_float32')

    def test_model_swapped_during_load_is_refused(self):
        receipts = [{'files': {'model.bin': 'weights'}}, {'files': {'model.bin': 'swapped'}}]
        with patch('asr_identity.current', side_effect=receipts):
            with self.assertRaisesRegex(RuntimeError, 'changed while loading'):
                transcribe_backends._get_whisper_model()
        self.assertIsNone(transcribe_backends._whisper_model)
        self.assertIsNone(transcribe_backends._whisper_decoder)

    def decoded(self, start, end, words, seek, **metrics):
        values = {'avg_logprob': -0.05, 'no_speech_prob': 0.0, 'compression_ratio': 1.4, 'temperature': 0.0,
                  **metrics}
        return SimpleNamespace(start=start, end=end, seek=seek, text=''.join(w['word'] for w in words),
                               words=[SimpleNamespace(**w) for w in words], **values)

    def transcribe(self, decoded, clips):
        speech = [[clip[0] + .2, clip[1] - .2] for clip in clips]
        options = SimpleNamespace(beam_size=5, condition_on_previous_text=False, word_timestamps=True,
                                  clip_timestamps=[edge for clip in clips for edge in clip] or [0.0, 0.0])
        run = patch.object(transcribe_backends, '_run_whisper_bound',
                           return_value=(decoded, info(transcription_options=options), DECODER))
        with patch('asr_identity.current', return_value=RUNTIME), run as bound, \
                patch.object(transcribe_backends, '_load_audio', return_value=[0.0]*480000), \
                patch.object(transcribe_backends, 'speech_regions', return_value=speech):
            transcript = transcribe_backends._transcribe_with_whisper('clip.wav')
        return transcript, bound

    def test_silence_clips_are_decoded_and_remainders_and_tails_leave_captions(self):
        tail = [word(' thất', 29.6, 29.6, .2), word(' bại.', 29.6, 29.62, .15)]
        garbage = [word(' một', 20.56, 20.92, .4), word(' ngày', 20.92, 20.92, .6), word(' qua.', 20.92, 20.92, .1)]
        first = [word(' chữa', 19.9, 20.2, .99), word(' lành.', 20.2, 20.5, .99)]
        decoded = [self.decoded(0.0, 20.5, first, 0),
                   self.decoded(20.56, 20.92, garbage, 2056, avg_logprob=-0.62),
                   self.decoded(27.0, 29.62, SPOKEN + tail, 2137, avg_logprob=-0.3)]
        transcript, bound = self.transcribe(decoded, [[0.0, 20.936], [21.368, 30.0]])
        params = bound.call_args.kwargs
        self.assertEqual(params['clip_timestamps'], [0.0, 20.936, 21.368, 30.0])
        self.assertFalse(params['vad_filter'])
        self.assertEqual(transcript['text'], 'chữa lành. là cái thời điểm.')
        self.assertEqual([w['word'] for s in transcript['segments'] for w in s['words']],
                         [' chữa', ' lành.', ' là', ' cái', ' thời', ' điểm.'])
        asr = transcript['asr']
        self.assertEqual([s['dropped'] for s in asr['rawSegments']], [None, 'clip-remainder', None])
        self.assertEqual(len(asr['rawSegments'][2]['words']), 6)
        quality = asr['quality']
        self.assertEqual(quality['discarded']['endWindowWords'], ['thất', 'bại.'])
        self.assertEqual(quality['discarded']['clipRemainders'][0]['text'], 'một ngày qua.')
        self.assertEqual((quality['transcriptModified'], quality['wordsDiscarded']), (True, 5))
        self.assertIn('clip-remainder', quality['warnings'][0])
        self.assertEqual(asr['segmentation']['clips'], [[0.0, 20.936], [21.368, 30.0]])
        self.assertEqual((asr['runtime'], asr['decoder'], asr['actualDevice']), (RUNTIME, DECODER, 'cpu'))

    def test_no_speech_decodes_an_empty_clip_list(self):
        transcript, bound = self.transcribe([], [])
        self.assertEqual(bound.call_args.kwargs['clip_timestamps'], [0.0, 0.0])
        self.assertEqual((transcript['segments'], transcript['text']), ([], ''))

    def test_decoder_that_ignored_planned_clips_is_refused(self):
        options = SimpleNamespace(beam_size=5, condition_on_previous_text=False, word_timestamps=True,
                                  clip_timestamps='0')
        with patch('asr_identity.current', return_value=RUNTIME), \
                patch.object(transcribe_backends, '_run_whisper_bound',
                             return_value=([], info(transcription_options=options), DECODER)), \
                patch.object(transcribe_backends, '_load_audio', return_value=[0.0]*16000), \
                patch.object(transcribe_backends, 'speech_regions', return_value=[[0.2, 0.8]]):
            with self.assertRaisesRegex(RuntimeError, 'clip boundaries'):
                transcribe_backends._transcribe_with_whisper('clip.wav')


class CutSnapTests(unittest.TestCase):
    def transcript(self):
        words = [word(' phúc', 0.0, 0.3, .6), word(' khi', 0.3, 0.5, .99), word(' mà', 0.5, 0.7, .99),
                 word(' điểm.', 29.6, 29.9, .99), word(' thích', 30.0, 30.3, .99), word(' hợp', 30.3, 30.5, .99),
                 word(' này', 58.2, 58.9, .99), word(' chuyện', 59.6, 60.0, .9)]
        return {'segments': [segment(words)],
                'asr': {'segmentation': {'speechRegions': [[0.0, 6.7], [7.7, 27.2], [28.1, 30.4], [31.2, 58.5],
                                                           [59.5, 60.0]]}}}

    def test_cuts_inside_speech_move_to_pauses_and_clipped_edge_words_are_dropped(self):
        segments, notes = analysis.snap_cuts([{'start': 0.0, 'end': 30.0}], self.transcript(), 60.0)
        self.assertEqual(segments, [{'start': 0.3, 'end': 30.6}])
        self.assertIn('0.00-30.00s moved to 0.30-30.60s', notes[0])
        segments, _ = analysis.snap_cuts([{'start': 7.0, 'end': 60.0}], self.transcript(), 60.0)
        self.assertEqual(segments, [{'start': 7.0, 'end': 59.3}])

    def test_cuts_already_in_pauses_or_without_words_are_kept(self):
        self.assertEqual(analysis.snap_cuts([{'start': 7.0, 'end': 27.5}], self.transcript(), 60.0),
                         ([{'start': 7.0, 'end': 27.5}], []))
        self.assertEqual(analysis.snap_cuts([{'start': 0.0, 'end': 30.0}], {'segments': []}, 60.0),
                         ([{'start': 0.0, 'end': 30.0}], []))


if __name__ == '__main__':
    unittest.main()
