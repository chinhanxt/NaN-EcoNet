"""Screencast face-cam bubble + active-region screen panel geometry."""
from pathlib import Path
import sys
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'packages/openshorts-engine/src'),
               str(ROOT / 'packages/openshorts-engine/core')]
import camera_inset
import screencast_layout as sl


class BubbleTests(unittest.TestCase):
    def test_circle_found_on_ring_not_beyond(self):
        import cv2
        img = np.full((720, 1280), 235, np.uint8)
        cv2.rectangle(img, (100, 100), (900, 600), 120, 2)      # UI clutter
        cv2.circle(img, (1078, 560), 120, 90, -1)               # webcam
        cv2.circle(img, (1078, 560), 120, 200, 8)               # gold ring
        found = camera_inset.find_circle(img, (1033, 505, 90, 110))
        self.assertIsNotNone(found)
        cx, cy, r = found
        self.assertLess(abs(cx - 1078), 3)
        self.assertLess(abs(cy - 560), 3)
        self.assertTrue(120 <= r <= 128, r)   # outer ring edge, not the UI

    def test_no_circle_on_rect_inset(self):
        import cv2
        img = np.full((720, 1280), 235, np.uint8)
        cv2.rectangle(img, (900, 450), (1280, 720), 60, -1)
        self.assertIsNone(camera_inset.find_circle(img, (1030, 520, 90, 110)))

    def test_presenter_never_upscaled_past_2x_and_stays_pip(self):
        small = {'box': (954, 435, 248, 248), 'shape': 'circle'}
        w, h = camera_inset.presenter_size(small)
        self.assertLessEqual(w, 2 * 248)
        self.assertLessEqual(w, camera_inset.BUBBLE_MAX_D)
        rect = {'box': (900, 450, 380, 214), 'shape': 'rect'}
        w, h = camera_inset.presenter_size(rect)
        self.assertLessEqual(w / 380.0, 2.0 + 1e-6)
        geo = camera_inset.bubble_layout(1080, 1920, small)
        pw, ph, px, py = geo['presenter']
        sw, sh, sx, sy = geo['panel']
        self.assertGreaterEqual(sy, py + ph)
        self.assertLessEqual(sy + sh, 1920 - camera_inset.BOTTOM_SAFE)

    def test_landscape_canvas_keeps_meaningful_screen_crop(self):
        rect = {'box': (960, 460, 300, 240), 'shape': 'rect'}
        circle = {'box': (860, 300, 400, 400), 'shape': 'circle'}
        for out_w, out_h in ((1920, 1080), (1280, 720)):
            for bubble in (rect, circle):
                geo = camera_inset.bubble_layout(out_w, out_h, bubble)
                pw, ph, px, py = geo['presenter']
                sw, sh, sx, sy = geo['panel']
                self.assertLessEqual(ph, 0.35 * out_h)
                self.assertGreaterEqual(sy, py + ph)
                self.assertLessEqual(sy + sh, out_h)
                self.assertGreaterEqual(sh, 0.3 * out_h)
                cw, ch = sl.screen_crop_size(1280, 720, sw, sh)
                self.assertGreaterEqual(cw, 2)
                self.assertGreaterEqual(ch, 2)
                self.assertLessEqual(cw, 1280)
                self.assertLessEqual(ch, 720)
        # Portrait reference canvas is unchanged.
        self.assertEqual(camera_inset.presenter_size(rect),
                         camera_inset.presenter_size(rect, 1080, 1920))

    def test_filtergraph_masks_circle(self):
        b = {'box': (954, 435, 248, 248), 'shape': 'circle'}
        geo = camera_inset.bubble_layout(1080, 1920, b)
        g = camera_inset.bubble_filtergraph(1080, 1920, b, geo, 634, 714, (0, 0))
        self.assertIn("hypot(X-W/2,Y-H/2)", g)
        self.assertIn("crop@s=w=634:h=714", g)
        self.assertTrue(g.endswith('[v]'))


class FocusTests(unittest.TestCase):
    def test_crop_is_readable_zoom(self):
        cw, ch = sl.screen_crop_size(1280, 720, 1080, 1216)
        self.assertGreaterEqual(1080 / cw, 1.6)
        self.assertLessEqual(ch, 720)

    def test_crop_never_overlaps_bubble(self):
        avoid = (954, 435, 248, 248)
        x, y = sl.place_outside(700, 0, 634, 714, 1280, 720, avoid)
        self.assertLessEqual(x + 634, 954)

    def test_path_holds_then_eases_without_jitter(self):
        fps = 30.0
        samples = []
        for i in range(100):             # 20 s at 5 fps
            t = i / 5.0
            x = 200 if t < 10 else 700   # activity jumps once
            x += (i % 3) * 15            # pointer wobble must not move camera
            samples.append((t, 30.0, float(x), 300.0))
        xs, ys = sl.focus_path(samples, 600, fps, 1280, 720, 400, 450)
        steps = np.abs(np.diff(xs))
        moves = int((steps > 0).sum())
        self.assertLess(moves, 40)                       # one glide, not a track
        self.assertLessEqual(steps.max(), 400 * 0.1)     # eased, no jump cut
        self.assertLess(abs(xs[100] - (215 - 200)), 60)
        self.assertLess(abs(xs[-1] - (715 - 200)), 60)

    def test_sendcmd_lines_dedupe(self):
        lines = sl.focus_sendcmd_lines([0, 0, 2], [4, 4, 4], 30.0)
        self.assertEqual(len(lines), 2)
        self.assertIn('crop@s x 2, crop@s y 4;', lines[1])




class ScreenFocusTests(unittest.TestCase):
    CANVAS = (1920, 3414)
    REGION = {'start': 2.0, 'end': 4.0, 'x': 1500, 'y': 800, 'w': 300, 'h': 200}

    def boxes(self, regions, seconds=7):
        return sl.focus_boxes(regions, seconds * 30, 30, 1920, 1080, 1080, self.CANVAS)

    def test_canvas_is_the_wide_frame_at_source_resolution(self):
        self.assertEqual(sl.focus_canvas(1920, 1080, 1080, 1920), self.CANVAS)
        self.assertIsNone(sl.focus_canvas(1080, 1920, 1080, 1920))   # already portrait

    def test_no_region_stays_on_the_whole_wide_frame(self):
        boxes = self.boxes([])
        self.assertEqual(set(boxes), {(1920, 3414, 0, 0)})

    def test_region_zooms_in_smoothly_holds_and_zooms_back_out(self):
        boxes = self.boxes([self.REGION])
        rest = (1920, 3414, 0, 0)
        self.assertEqual(boxes[0], rest)
        self.assertEqual(boxes[-1], rest)
        held = boxes[3 * 30]
        top = (3414 - 1080) / 2
        # Whole region (+ margin) inside the crop, output aspect, at most 2.5x magnification.
        self.assertTrue(held[2] <= 1500 - 45 and held[2] + held[0] >= 1800 + 45)
        self.assertTrue(held[3] <= top + 800 and held[3] + held[1] >= top + 1000)
        self.assertAlmostEqual(held[1] / held[0], 1920 / 1080, delta=.01)
        self.assertLessEqual(1080 / held[0], 2.5 + 1e-9)
        # Ease-in starts ~0.7 s before the region and is continuous (no hard cut).
        self.assertEqual(boxes[int(1.2 * 30)], rest)
        self.assertNotEqual(boxes[int(1.6 * 30)], rest)
        self.assertEqual(boxes[2 * 30], held)
        widths = [b[0] for b in boxes]
        self.assertLess(max(abs(a - b) for a, b in zip(widths, widths[1:])), 200)
        self.assertEqual(boxes[int(4.8 * 30)], rest)

    def test_a_large_region_is_never_cropped_tighter_than_it_fits(self):
        held = self.boxes([{**self.REGION, 'x': 100, 'w': 1700}])[3 * 30]
        self.assertEqual(held[0], 1920)

    def test_close_regions_glide_directly_without_zooming_out(self):
        second = {'start': 4.5, 'end': 6.0, 'x': 100, 'y': 100, 'w': 300, 'h': 200}
        boxes = self.boxes([self.REGION, second])
        self.assertTrue(all(b[0] < 1920 for b in boxes[4 * 30:int(4.5 * 30)]))

    def test_focus_filtergraph_renders_the_output_canvas(self):
        import subprocess
        import tempfile
        graph = sl.focus_filtergraph(1080, 1920, 1920, 1080, self.CANVAS, (1920, 3414, 0, 0))
        self.assertNotIn('vstack', graph)
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / 'focus.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=10',
                            '-t', '0.5', '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264',
                            '-threads', '1', str(out)], check=True)
            size = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries',
                                            'stream=width,height', '-of', 'csv=p=0', str(out)]).decode().strip()
            self.assertEqual(size, '1080,1920')


class FocusRenderPhaseTests(unittest.TestCase):
    def test_zoom_effects_are_dropped_only_over_focus_inset_and_split_scenes(self):
        import render_phase
        decision = {'scenes': [{'startSeconds': 0, 'endSeconds': 5, 'strategy': 'FOCUS'},
                               {'startSeconds': 5, 'endSeconds': 10, 'strategy': 'WIDE'}]}
        edits = [{'type': 'punch_in', 'start': 1, 'end': 2}, {'type': 'punch_in', 'start': 6, 'end': 7},
                 {'type': 'vignette', 'start': 1, 'end': 2}]
        self.assertEqual(render_phase.compatible_effects(edits, decision), edits[1:])
        self.assertIsNone(render_phase.compatible_effects(None, decision))

    def test_focus_regions_use_ai_regions_and_screen_reading_only_without_them(self):
        import render_phase
        ai = [{'start': 1, 'end': 3, 'x': .1, 'y': .1, 'w': .3, 'h': .2, 'reason': 'menu'}]
        screen = [[2, 4, .5, .5, .2, .2, 'ribbon'], [5, 7, .6, .6, .2, .2, 'ribbon']]
        regions = render_phase.focus_regions({'content': {'focusRegions': ai}, 'contentFocus': screen})
        self.assertEqual([(r['start'], r['x']) for r in regions], [(1.0, .1)])
        regions = render_phase.focus_regions({'contentFocus': screen})
        self.assertEqual([r['start'] for r in regions], [2.0, 5.0])
        self.assertEqual(render_phase.focus_regions({}), [])

    def test_focus_times_snap_to_the_narration_that_names_the_region(self):
        import render_phase
        words = [{'word': ' Bước', 'start': 0.2, 'end': 0.5}, {'word': ' một.', 'start': 0.55, 'end': 0.9},
                 {'word': ' Bấm', 'start': 1.6, 'end': 1.9}, {'word': ' nút', 'start': 1.95, 'end': 2.2},
                 {'word': ' Align', 'start': 2.25, 'end': 2.6}, {'word': ' Center.', 'start': 2.65, 'end': 3.3}]
        item = {'content': {'focusRegions': [{'start': 2.25, 'end': 3.0, 'x': .4, 'y': .1, 'w': .1, 'h': .1}]}}
        region = render_phase.focus_regions(item, {'segments': [{'words': words}]})[0]
        self.assertEqual(region['start'], 2.25)              # AGY start already on a word: kept
        self.assertEqual(region['end'], 3.3)                 # end moved to the end of the word
        item['content']['focusRegions'][0].update(start=2.45, end=3.6)   # mid-phrase
        region = render_phase.focus_regions(item, {'segments': [{'words': words}]})[0]
        self.assertEqual(region['start'], 1.6)               # pulled to the phrase "Bấm nút Align Center"
        self.assertEqual(region['end'], 3.3)


if __name__ == '__main__':
    unittest.main()
