"""Caption pages avoid splitting tight word joins; hooks avoid burned-in channel names."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import hooks
import pipeline
import subtitles


def transcript(words):
    return {'segments': [{'words': [{'word': ' ' + w, 'start': a, 'end': b} for w, a, b in words]}]}


def pages(words, max_chars=16, max_duration=1.4):
    return [' '.join(w['word'] for w in block)
            for block in subtitles._collect_word_blocks(transcript(words), 0, 60, max_chars, max_duration)]


# Narration2 live job 40452f7d: gapless script-aligned timings (Anton karaoke, 16 chars / 1.4 s).
XE_TAI = [('LẠI', 5.22, 5.38), ('LẦN', 5.38, 5.58), ('BỊ', 5.58, 5.74), ('XE', 5.74, 5.92),
          ('TẢI', 5.92, 6.10), ('TÔNG', 6.10, 6.32), ('TRÚNG', 6.32, 6.62), ('KHI', 6.62, 6.80),
          ('QUAY', 6.80, 7.00), ('PHIM', 7.00, 7.20)]


class CaptionPagingTests(unittest.TestCase):
    def test_xe_tai_compound_stays_on_one_page(self):
        result = pages(XE_TAI)
        self.assertEqual(result[:2], ['LẠI LẦN BỊ', 'XE TẢI TÔNG'])
        for left, right in zip(result, result[1:]):
            self.assertFalse(left.endswith('XE') and right.startswith('TẢI'), result)
        self.assertEqual(' '.join(result), ' '.join(w for w, _, _ in XE_TAI))

    def test_lowercase_transcript_uses_same_rule(self):
        lower = [(w.lower(), a, b) for w, a, b in XE_TAI]
        self.assertEqual(pages(lower)[:2], ['lại lần bị', 'xe tải tông'])

    def test_prefers_real_pause_over_tight_join(self):
        # 200 ms pause after 'beta'; the forced break would fall in the gapless 'gamma|delta' join.
        words = [('alpha', 0, .3), ('beta', .3, .6), ('gamma', .8, 1.0), ('delta', 1.0, 1.2), ('eps', 1.2, 1.4)]
        self.assertEqual(pages(words, max_chars=20, max_duration=5), ['alpha beta', 'gamma delta eps'])

    def test_real_pause_at_forced_break_is_kept(self):
        words = [('alpha', 0, .3), ('beta', .3, .6), ('gamma', .6, .9), ('delta', 1.1, 1.3), ('eps', 1.3, 1.5)]
        self.assertEqual(pages(words, max_chars=20, max_duration=5), ['alpha beta gamma', 'delta eps'])

    def test_prefers_punctuation(self):
        words = [('một', 0, .2), ('hai,', .2, .4), ('ba', .4, .6), ('bốn', .6, .8), ('năm', .8, 1.0)]
        self.assertEqual(pages(words, max_chars=14, max_duration=5), ['một hai,', 'ba bốn năm'])

    def test_equal_costs_keep_greedy_pages(self):
        words = [('mèo', 0, .2), ('chó', .2, .4), ('gà', .4, .6), ('vịt', .6, .8), ('heo', .8, 1.0)]
        self.assertEqual(pages(words, max_chars=12, max_duration=5), ['mèo chó gà', 'vịt heo'])

    def test_gap_thresholds_use_whole_milliseconds_like_ts(self):
        # TS pageBreakCost compares integer ms; 0.1499999 s and 0.0599999 s are 150 / 60 ms there.
        word = lambda text, start, end: {'word': text, 'start': start, 'end': end}
        self.assertEqual(subtitles._break_cost(word('xe', 0, 1.0), word('tải', 1.1499999, 1.4)), 1)
        self.assertEqual(subtitles._break_cost(word('xe', 0, 1.0), word('tải', 1.1494, 1.4)), 3)
        self.assertEqual(subtitles._break_cost(word('xe', 0, 1.0), word('tải', 1.0599999, 1.4)), 3)
        self.assertEqual(subtitles._break_cost(word('xe', 0, 1.0), word('tải', 1.0594, 1.4)), 4)

    def test_moved_word_must_fit_next_page(self):
        words = [('cc', 0, .2), ('bị', .2, .4), ('aaaa', .4, .6), ('bbbbbbbbbbbb', .6, .8)]
        self.assertEqual(pages(words, max_chars=16, max_duration=5), ['cc bị aaaa', 'bbbbbbbbbbbb'])


def frames_with_title(count=8, moving=True):
    rng = np.random.default_rng(1)
    out = []
    for i in range(count):
        f = np.full((1920, 1080, 3), (200, 110, 40), np.uint8)
        # Channel name: static striped lettering at the top right (y 280-360).
        f[280:360, 500:1040:2] = 255
        if moving:
            # A speaker's hair/face: textured block that changes every sample.
            f[500 + 7 * i:700 + 7 * i, 300 + 30 * i:700 + 30 * i] = rng.integers(0, 255, (200, 400, 3), dtype=np.uint8)
        out.append(f)
    return out


class WatermarkClearanceTests(unittest.TestCase):
    def test_static_title_is_boxed_and_moving_subject_is_not(self):
        boxes = hooks.static_overlay_boxes(frames_with_title())
        self.assertEqual(len(boxes), 1, boxes)
        x, y, w, h = boxes[0]
        self.assertTrue(x <= 500 and x + w >= 1040 and y <= 280 and y + h >= 360, boxes)
        self.assertTrue(y + h < 500, boxes)

    def test_too_few_or_undecodable_frames_give_nothing(self):
        self.assertEqual(hooks.static_overlay_boxes(frames_with_title(3)), [])
        self.assertEqual(hooks.static_overlay_boxes([object()] * 8), [])

    def test_hook_moves_below_channel_name_when_room_allows(self):
        # Live dialogue job 61566bcf: the pill sat at the 20% mark (y=384) on the channel name.
        soft = [[352, 256, 728, 160]]
        faces = [[286, 684, 344, 344], [436, 680, 338, 338], [30, 1363, 1018, 291]]
        x, y = hooks.safe_overlay_position(1080, 1920, 988, 236, faces, None, soft)
        self.assertTrue(hooks._clear(x, y, 988, 236, faces + soft), (x, y))
        self.assertEqual(hooks.safe_overlay_position(1080, 1920, 988, 236, faces), (46, 384))

    def test_soft_boxes_are_dropped_when_nothing_clears_them(self):
        soft = [[0, 0, 1080, 1920]]
        self.assertEqual(hooks.safe_overlay_position(1080, 1920, 988, 236, [], None, soft),
                         hooks.safe_overlay_position(1080, 1920, 988, 236, []))

    def test_pipeline_passes_detected_watermarks_as_soft_boxes(self):
        evidence = {'faceDetection': 'provisioned-MediaPipe', 'watermarkBoxes': [[352, 256, 728, 160]]}
        request = {'hook': {'text': 'Xin chào', 'durationSeconds': 2}, 'captions': {'enabled': False}}
        with patch('rendering.probe', return_value={'width': 1080, 'height': 1920, 'duration': 5}), \
             patch('pipeline._hook_protected_regions', return_value=([[0, 0, 10, 10]], evidence)), \
             patch('hooks.add_hook_to_video') as add:
            pipeline._hook(request, {'title': 'Clip'}, 'clip.mp4', 'hook.mp4', {}, warnings=[])
        self.assertEqual(add.call_args.kwargs['soft_boxes'], [[352, 256, 728, 160]])

    def test_static_overlay_on_a_sampled_face_is_not_a_watermark(self):
        # Tripod interview: a still subject's edges persist like lettering; avoiding that
        # "watermark" would push the hook down towards faces the sampler missed.
        frames = frames_with_title()
        title = hooks.static_overlay_boxes(frames)
        self.assertEqual(pipeline.watermark_boxes(frames, []), title)
        self.assertEqual(pipeline.watermark_boxes(frames, [[600, 250, 200, 200]]), [])
        self.assertEqual(pipeline.watermark_boxes(frames, [[300, 500, 400, 400]]), title)


if __name__ == '__main__':
    unittest.main()
