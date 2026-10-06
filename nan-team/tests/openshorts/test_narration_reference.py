import copy
from pathlib import Path
import sys
import unittest
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'packages/openshorts-engine/src'),
               str(ROOT / 'packages/openshorts-engine/core')]
from narration_reference import map_reference, align_reference, reference_transcript
import json
import subprocess
import rendering
import subtitles
import checkpoints


def transcript(text):
    return {'language': 'vi', 'segments': [{'words': [
        {'word': ' ' + word, 'start': index * .2, 'end': (index + 1) * .2}
        for index, word in enumerate(text.split())]}]}


class NarrationReferenceTests(unittest.TestCase):
    def test_same_text_voice_cannot_reuse_changed_narration_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            a = Path(directory) / 'attempt-a.wav'; b = Path(directory) / 'attempt-b.wav'
            a.write_bytes(b'first synthesized waveform'); b.write_bytes(b'different synthesized waveform')
            request = {'aspectRatio': '1:1', 'audio': {'mode': 'replace-narration',
                       'voice': 'Thuyết Minh', 'narrationText': 'Xin chào Việt Nam', 'narrationPath': str(a)}}
            changed = {**request, 'audio': {**request['audio'], 'narrationPath': str(b)}}
            self.assertEqual(checkpoints.settings(request), checkpoints.settings(changed))
            self.assertNotEqual(checkpoints.base_fingerprint(request, 'wide'),
                                checkpoints.base_fingerprint(changed, 'wide'))
            b.write_bytes(a.read_bytes())
            self.assertEqual(checkpoints.base_fingerprint(request, 'wide'),
                             checkpoints.base_fingerprint(changed, 'wide'))

    def test_corrects_two_observed_errors_with_unchanged_asr_intervals(self):
        source = transcript('Hôm nay chúng ta cùng tập lưỡi để quẻ hơn mỗi ngày.')
        original = copy.deepcopy(source)
        reference = 'Hôm nay chúng ta cùng tập luyện để khỏe hơn mỗi ngày.'
        result = map_reference(source, reference)
        self.assertEqual(result['segments'][0]['text'], reference)
        self.assertEqual(result['narrationAlignment']['correctedIndices'], [6, 8])
        self.assertFalse(result['narrationAlignment']['phonemeAlignmentVerified'])
        self.assertEqual(source, original)
        for actual, expected in zip(result['segments'][0]['words'], source['segments'][0]['words']):
            self.assertEqual((actual['start'], actual['end']), (expected['start'], expected['end']))
        self.assertEqual(len(subtitles.merge_continuation_words(result['segments'][0]['words'])), 12)

    def test_rejects_missing_words_weak_matches_and_unanchored_runs(self):
        cases = [('Xin chào Việt Nam', 'Xin Việt Nam'),
                 ('Hôm nay chúng ta cùng tập luyện', 'Hôm nọ họ đi bơi vui vẻ'),
                 ('Sai nay chúng ta cùng tập luyện', 'Hôm nay chúng ta cùng tập luyện'),
                 ('Hôm nay chúng ta cùng tập sai', 'Hôm nay chúng ta cùng tập luyện'),
                 ('Một hai ba khác sai lệch bảy tám chín mười mười một',
                  'Một hai ba bốn năm sáu bảy tám chín mười mười một')]
        for recognized, reference in cases:
            with self.subTest(recognized=recognized), self.assertRaises(ValueError):
                map_reference(transcript(recognized), reference)

    def test_rejects_overlapping_nonfinite_and_boolean_timings(self):
        for bad in [-1, .1, float('nan'), True]:
            source = transcript('Xin chào Việt Nam'); source['segments'][0]['words'][1]['start'] = bad
            with self.subTest(start=bad), self.assertRaises(ValueError):
                map_reference(source, 'Xin chào Việt Nam')

    def test_unicode_normalization_preserves_vietnamese_diacritics(self):
        result = map_reference(transcript('Xin cha\u0300o Viê\u0323t Nam.'), 'Xin chào Việt Nam.')
        self.assertEqual(result['narrationAlignment']['correctedIndices'], [])

    def test_sequence_alignment_handles_merged_and_missing_asr_words(self):
        reference = 'Trong buổi trò chuyện cùng Quang Tuấn, Lan Ngọc nhớ lại một pha hành động vô cùng nguy hiểm.'
        source = transcript('Trong buổi trò chuyện cùng Quangtuấn, Lan Ngọc nhớ lại pha hành động vô cùng nguy hiểm.')
        with self.assertRaises(ValueError):
            map_reference(source, reference)
        result = reference_transcript(source, reference)
        words = result['segments'][0]['words']
        self.assertEqual(result['timingSource'], 'generated-narration-ASR-aligned')
        self.assertEqual([w['word'].strip() for w in words], reference.split())
        self.assertEqual((words[5]['start'], words[6]['end']), (1.0, 1.2))  # merged ASR word split in two
        for left, right in zip(words, words[1:]):
            self.assertLessEqual(left['start'], left['end'])
            self.assertLessEqual(left['end'], right['start'] + 1e-6)

    def test_sequence_alignment_keeps_one_to_one_misrecognitions_and_rejects_weak(self):
        result = align_reference(transcript('cô bị xe tải công chúng rồi lật ngược lại'),
                                 'cô bị xe tải tông trúng rồi lật ngược lại')
        words = result['segments'][0]['words']
        self.assertEqual((words[4]['word'], words[4]['start'], words[4]['end']), (' tông', .8, 1.0))
        self.assertEqual(result['narrationAlignment']['correctedIndices'], [4, 5])
        with self.assertRaises(ValueError):
            align_reference(transcript('Hôm nọ họ đi bơi vui vẻ'), 'Hôm nay chúng ta cùng tập luyện')

    def test_narration_mix_is_loudness_normalized_and_padded_to_clip(self):
        with tempfile.TemporaryDirectory() as directory:
            video, voice = Path(directory) / 'clip.mp4', Path(directory) / 'voice.wav'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=10:d=3',
                            '-f', 'lavfi', '-i', 'sine=f=220:d=3', '-shortest', '-c:v', 'libx264', '-c:a', 'aac',
                            str(video)], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=660:d=2,volume=0.1',
                            str(voice)], check=True)
            for mode in ('replace-narration', 'mix-narration'):
                with self.subTest(mode=mode):
                    out = rendering.audio_mix(video, Path(directory) / f'{mode}.mp4',
                                              {'mode': mode, 'narrationPath': str(voice)})
                    streams = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
                                                                  '-of', 'json', str(out)]))['streams']
                    audio = next(s for s in streams if s['codec_type'] == 'audio')
                    self.assertAlmostEqual(float(audio['duration']), 3, delta=.05)
                    report = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(out), '-af',
                                             'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
                    loudness = float(report.rsplit('I:', 1)[1].split('LUFS')[0])
                    self.assertAlmostEqual(loudness, -14, delta=1.5)


if __name__ == '__main__':
    unittest.main()
