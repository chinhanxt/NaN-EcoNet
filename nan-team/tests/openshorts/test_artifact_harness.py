"""Delivered pixels: caption bands, hook/caption collisions, scene-cut sampling, frame counts.

Fixtures are flat grey clips with saturated boxes, and the "face" detector here
finds the saturated box. That isolates OpenCV seeking, sample timing, overlay
timing and libass geometry from ML accuracy; it proves nothing about real faces.
"""
import math
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core'), str(HERE)]
import artifact_harness as harness
import hooks
import pipeline

# 32 fps keeps every frame time an exact binary fraction, so overlay/ASS/OpenCV
# timing comparisons below cannot hinge on float rounding.
FPS = 32
W, H = 1080, 1920
SW, SH = 270, 480
# Scene A (red, top) frames 0-48, scene B (blue, middle) 49-54, scene C = A again from 55.
# Uniform hook samples over 3 s fall near frames 47.5 and 55.4, never inside B.
SCENES = ("drawbox=x=100:y=20:w=70:h=40:color=red:t=fill:enable='lt(n,49)+gte(n,55)',"
          "drawbox=x=60:y=90:w=150:h=120:color=blue:t=fill:enable='between(n,49,54)'")
STARTS = [0, 49/FPS, 55/FPS]
TRANSCRIPT = {'language':'vi','segments':[
    {'start':0,'end':.9,'text':'Những người bạn','words':[
        {'word':' Những','start':0,'end':.3}, {'word':' người','start':.3,'end':.6},
        {'word':' bạn','start':.6,'end':.9}]},
    {'start':1.1,'end':1.9,'text':'đường dài nhất','words':[
        {'word':' đường','start':1.1,'end':1.4}, {'word':' dài','start':1.4,'end':1.7},
        {'word':' nhất','start':1.7,'end':1.9}]}]}
# Karaoke events starting before 1 s sit on the SPLIT seam, later ones in the style position.
SEAM = [(0, 1.0)]


def encode(target, size, seconds, draw=''):
    graph = f'color=0x808080:size={size}:rate={FPS}:duration={seconds}' + (',' + draw if draw else '')
    # Low CRF so an abrupt scene switch leaves no saturated ghost of the previous box.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', graph, '-c:v', 'libx264', '-crf', '12',
                    '-pix_fmt', 'yuv420p', '-threads', '1', str(target)], check=True, timeout=300)


def squares(frame):
    """Synthetic stand-in for the face detector: the saturated box in a grey frame."""
    saturation = frame.max(axis=2).astype(np.int16) - frame.min(axis=2)
    box = harness.bbox(saturation > 80)
    return [{'box':box}] if box else []


def fake_tracking():
    return patch.dict(sys.modules, {'tracking':SimpleNamespace(detect_face_candidates=squares)})


class HarnessPrimitiveTests(unittest.TestCase):
    def test_sparse_noise_is_ignored_and_dense_change_is_located(self):
        before = np.zeros((16, 16, 3), dtype=np.uint8)
        after = before.copy()
        after[0, 0] = after[15, 3] = 255
        self.assertIsNone(harness.bbox(harness.changed(before, after)))
        after[8:12, 8:12] = 200
        self.assertEqual(harness.bbox(harness.changed(before, after)), [8, 8, 4, 4])

    def test_geometry_helpers(self):
        mask = np.zeros((10, 10), dtype=bool)
        mask[2:4, 2:4] = True
        self.assertEqual(harness.pixels_in(mask, [3, 3, 5, 5]), 1)
        self.assertEqual(harness.outside(mask, [[0, 0, 3, 10]]), 2)
        self.assertTrue(harness.inside([2, 2, 2, 2], [0, 0, 4, 4]))
        self.assertFalse(harness.inside([2, 2, 3, 2], [0, 0, 4, 4]))
        self.assertFalse(harness.overlaps([0, 0, 2, 2], [2, 0, 2, 2]))
        self.assertEqual(harness.runs([0, 1, 2, 5, 6, 9]), [[0, 2], [5, 6], [9, 9]])


class SampleTimeTests(unittest.TestCase):
    def test_every_scene_start_inside_the_hook_is_sampled_on_its_own_frames(self):
        fps = 30000/1001
        seen = []
        class Capture:
            def __init__(self, path): pass
            def set(self, prop, value): seen.append(value / 1000)
            def read(self): return True, None
            def release(self): pass
        # A start on the final hook frame is left out: whether start+1/fps < D there is float noise.
        starts = [0, 1, 7, 8, 9, 37, 148]
        with patch.dict(sys.modules, {'cv2':SimpleNamespace(VideoCapture=Capture, CAP_PROP_POS_MSEC=0),
                                      'tracking':SimpleNamespace(detect_face_candidates=lambda frame: [])}), \
             patch('rendering.probe', return_value={'width':W,'height':H,'duration':10,'fps':fps}):
            pipeline._hook_protected_regions('clip.mp4', 150/fps, {'enabled':False}, (), [s/fps for s in starts])
        sampled = sorted({math.floor(t * fps + 1e-6) for t in seen})
        for start in starts:
            self.assertTrue({start, start + 1} & set(sampled), f'scene starting at frame {start} was never sampled')
        self.assertEqual((sampled[0], sampled[-1]), (0, 149))
        self.assertLessEqual(max(b - a for a, b in zip(sampled, sampled[1:])), math.ceil(.25 * fps))


class SceneTransitionSamplingTests(unittest.TestCase):
    """Real OpenCV seeks on a real H.264 file against per-frame FFmpeg ground truth."""

    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.source = Path(cls.folder.name)/'cuts.mp4'
        encode(cls.source, f'{SW}x{SH}', 3, SCENES)
        cls.truth = [squares(frame) for frame in harness.frames(cls.source)]

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def protected(self, duration, scene_starts):
        with fake_tracking():
            boxes, evidence = pipeline._hook_protected_regions(str(self.source), duration, {'enabled':False},
                                                               (), scene_starts)
        return boxes, evidence

    def hits(self, rect, frames=None):
        return [index for index in (frames if frames is not None else range(len(self.truth)))
                for face in self.truth[index] if harness.overlaps(rect, face['box'])]

    def test_fixture_decodes_to_the_planned_scenes(self):
        self.assertEqual(len(self.truth), 3 * FPS)
        self.assertEqual(harness.frame_count(self.source), 3 * FPS)
        self.assertTrue(all(len(boxes) == 1 for boxes in self.truth))
        tops = [boxes[0]['box'][1] for boxes in self.truth]
        self.assertTrue(all(top < 30 for top in tops[:49] + tops[55:]))
        self.assertTrue(all(top > 80 for top in tops[49:55]))

    def test_short_scene_between_uniform_samples_is_protected_only_via_its_start(self):
        scene_b = self.truth[51][0]['box']
        legacy, _ = self.protected(3, ())
        current, evidence = self.protected(3, STARTS)
        # Fixture validity: the uniform grid alone never sees scene B.
        self.assertFalse(any(harness.overlaps(box, scene_b) for box in legacy))
        self.assertTrue(any(harness.overlaps(box, scene_b) for box in current))
        self.assertTrue(any(49/FPS <= t < 55/FPS for t in evidence['sampleTimesSeconds']))

    def test_placement_clears_the_detected_box_on_every_decoded_hook_frame(self):
        box_w, box_h = 200, 60
        rect = lambda y: [(SW - box_w) // 2, y, box_w, box_h]
        legacy, _ = self.protected(3, ())
        current, _ = self.protected(3, STARTS)
        old = rect(hooks.safe_overlay_y(SW, SH, box_w, box_h, legacy))
        new = rect(hooks.safe_overlay_y(SW, SH, box_w, box_h, current))
        self.assertEqual(self.hits(old), list(range(49, 55)))
        self.assertEqual(self.hits(new), [])

    def test_hook_ending_on_a_cut_is_not_drawn_over_the_unsampled_next_scene(self):
        # The hook ends before the first frame of the next scene, which is
        # outside the protected sample interval.
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)/'hook.mp4'
            plan = {'title':'Clip'}
            request = {'hook':{'text':'Xin chào','durationSeconds':49/FPS},'captions':{'enabled':False}}
            with fake_tracking():
                pipeline._hook(request, plan, str(self.source), str(target), {}, scene_starts=STARTS)
            rect = [plan['hookPlacement'][key] for key in ('x', 'y', 'width', 'height')]
            visible = [index for index, (clean, hooked) in enumerate(harness.lockstep(self.source, target))
                       if harness.pixels_in(harness.changed(clean, hooked), rect) >= harness.MIN_HOOK_PIXELS]
        self.assertEqual(self.hits(rect, visible), [])
        self.assertEqual(visible, list(range(49)))


class CaptionBandPixelTests(unittest.TestCase):
    """libass output measured in pixels against the band the hook placement reserves."""
    CONFIGS = [
        {'enabled':True,'style':'karaoke'},
        {'enabled':True,'style':'karaoke','fontSize':44,'fontName':'Anton','uppercase':True,
         'effect':'pop','borderWidth':4,'highlightColor':'#FFE500'},
        {'enabled':True,'style':'karaoke','position':'top','fontSize':28,'bgOpacity':.6,'effect':'box'},
        {'enabled':True,'style':'classic','position':'middle','fontSize':24},
    ]

    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.base = Path(cls.folder.name)/'base.mp4'
        encode(cls.base, f'{W}x{H}', 2)

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def test_burned_caption_pixels_stay_inside_reserved_bands(self):
        for number, config in enumerate(self.CONFIGS):
            with self.subTest(config=config):
                band, seam, style = pipeline._caption_bands(config, W, H)
                target = Path(self.folder.name)/f'captioned-{number}.mp4'
                pipeline._captions(self.base, target, TRANSCRIPT, config, Path(self.folder.name), split_ranges=SEAM)
                seen = 0
                for index, (plain, captioned) in enumerate(harness.lockstep(self.base, target)):
                    box = harness.bbox(harness.changed(plain, captioned))
                    if box is None:
                        continue
                    seen += 1
                    expected = seam if style != 'classic' and index / FPS < SEAM[0][1] else band
                    self.assertTrue(harness.inside(box, expected),
                                    f'frame {index}: caption pixels {box} leave reserved band {expected}')
                self.assertGreater(seen, FPS // 2)
                self.assertEqual(harness.frame_count(target), 2 * FPS)


AUTO_STYLE = {'enabled':True,'style':'karaoke','fontSize':44,'fontName':'Anton','uppercase':True,
              'effect':'pop','borderWidth':4,'highlightColor':'#FFE500'}
# Stand-in face in the upper half, where the preferred 20% hook position would land.
FACE = "drawbox=x=380:y=300:w=320:h=260:color=red:t=fill"


class HookCaptionChainTests(unittest.TestCase):
    """clean -> one hook+captions encode (render_phase), audited as a real job directory would be.

    The hook-only stage the audit diffs against is the debug second output of the same
    decode (keep_hooked / OPENSHORTS_KEEP_HOOK_STAGE=1); the delivered file is one encode.
    """

    def chain(self, captions, split_ranges, draw='', hook_seconds=1.0, sample_seconds=None, detector=squares):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            clean, hooked, final = folder/'clean.mp4', folder/'hook.mp4', folder/'final.mp4'
            encode(clean, f'{W}x{H}', 2, draw)
            request = {'hook':{'text':'Một câu hook khá dài cho video','durationSeconds':hook_seconds},
                       'captions':captions}
            plan = {'title':'Clip'}
            also = (pipeline._caption_filter(clean, TRANSCRIPT, captions, folder, split_ranges=split_ranges), final)
            with fake_tracking():
                delivered = pipeline._hook(request, plan, str(clean), str(hooked), TRANSCRIPT,
                                           split_ranges=split_ranges, scene_starts=[0], also=also, keep_hooked=True)
            self.assertEqual(Path(delivered), final)
            report = harness.audit(clean, hooked, final, plan['hookPlacement'], face_detector=detector,
                                   sample_seconds=sample_seconds)
        return plan['hookPlacement'], report

    def test_single_encode_without_debug_stage_delivers_the_same_frames(self):
        captions = {'enabled':True,'style':'karaoke'}
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            clean = folder/'clean.mp4'
            encode(clean, f'{W}x{H}', 2)
            request = {'hook':{'text':'Một câu hook','durationSeconds':1.0},'captions':captions}
            outputs = {}
            for keep in (True, False):
                final = folder/f'final-{keep}.mp4'
                also = (pipeline._caption_filter(clean, TRANSCRIPT, captions, folder, split_ranges=SEAM), final)
                with fake_tracking():
                    pipeline._hook(request, {'title':'Clip'}, str(clean), str(folder/f'hook-{keep}.mp4'),
                                   TRANSCRIPT, split_ranges=SEAM, scene_starts=[0], also=also, keep_hooked=keep)
                outputs[keep] = final
            self.assertTrue((folder/'hook-True.mp4').exists())
            self.assertFalse((folder/'hook-False.mp4').exists())
            for kept, single in harness.lockstep(outputs[True], outputs[False]):
                self.assertTrue(np.array_equal(kept, single))

    def assert_clean(self, placement, report, seconds):
        self.assertEqual(placement['captionBandSource'], 'measured-libass')
        self.assertEqual(report['frames'], 2 * FPS)
        self.assertEqual(report['probedFrames'], {'clean':2 * FPS, 'hooked':2 * FPS, 'final':2 * FPS})
        self.assertEqual(report['hookVisibleFrames'], [[0, round(seconds * FPS) - 1]])
        self.assertTrue(report['captionDuringHookFrames'], 'fixture must burn captions while the hook shows')
        self.assertEqual(report['captionInsideHookFrames'], [])
        self.assertEqual(report['captionOutsideReservedBandFrames'], [])
        self.assertEqual(report['hookOverFaceFrames'], [])
        self.assertTrue(report['passed'])
        self.assertTrue(report['continuousClearanceVerified'])

    def test_split_seam_captions_never_touch_the_hook_and_frame_counts_hold(self):
        placement, report = self.chain({'enabled':True,'style':'karaoke'}, SEAM)
        self.assert_clean(placement, report, 1.0)
        # Only seam captions start inside the 1 s hook; the bottom block (1.1 s) is not reserved.
        [band] = placement['captionBands']
        self.assertLess(band[1], H // 2)
        self.assertGreater(band[1] + band[3], H // 2)

    def test_auto_style_fontsize_44_bottom_captions_leave_room_for_the_hook(self):
        # AUTO_STYLE is now the default look; the Anton-aware fallback estimate still leaves the 20% slot.
        info = {'width':W,'height':H,'fps':FPS,'duration':2}
        estimate = pipeline._estimated_caption_bands(AUTO_STYLE, (), info, 2.0)
        self.assertEqual(estimate, pipeline._estimated_caption_bands({'enabled':True,'style':'karaoke'}, (), info, 2.0))
        self.assertEqual(hooks.safe_overlay_y(W, H, 900, 200, estimate), int(H * .20))
        placement, report = self.chain(AUTO_STYLE, (), FACE, hook_seconds=1.5)
        self.assert_clean(placement, report, 1.5)
        self.assertEqual(placement['fontScale'], 1.0)
        self.assertGreater(placement['captionBands'][0][1], H // 2)
        # The estimate stays conservative against the real libass pixels.
        measured = placement['captionBands'][0]
        self.assertLessEqual(estimate[0][1], measured[1])
        self.assertGreaterEqual(estimate[0][1] + estimate[0][3], measured[1] + measured[3])

    def test_sampled_scan_keeps_hook_window_dense_and_receipt_fields(self):
        # 2 s at 32 fps, 1 s hook: frames 0-47 (window + 0.5 s) dense with faces, then every 8th (0.25 s).
        checked = []
        def counting(frame):
            checked.append(1)
            return squares(frame)
        placement, report = self.chain({'enabled':True,'style':'karaoke'}, SEAM, FACE, sample_seconds=.25, detector=counting)
        self.assert_clean(placement, report, 1.0)
        self.assertEqual(report['expectedHookFrames'], FPS)
        self.assertEqual(report['hookVisibleCount'], FPS)
        self.assertEqual(report['scan'], {'denseFrames':48, 'sampleStepFrames':8, 'scannedFrames':50,
                                          'faceDetectedUntilFrame':48})
        self.assertEqual(len(checked), FPS)

    def test_sampled_indices(self):
        self.assertEqual([n for n in range(70) if harness.sampled(n, 48, 8)], list(range(48)) + [48, 56, 64])
        self.assertEqual([n for n in range(5) if harness.sampled(n, 2, 1)], list(range(5)))

    def test_common_styles_place_the_hook_clear_of_face_and_captions(self):
        for captions in CaptionBandPixelTests.CONFIGS[2:]:
            with self.subTest(captions=captions):
                placement, report = self.chain(captions, SEAM, FACE)
                self.assert_clean(placement, report, 1.0)


class HookPlacementReceiptTests(unittest.TestCase):
    def test_receipt_carries_timing_and_sampled_frames_without_claiming_clearance(self):
        with tempfile.TemporaryDirectory() as folder:
            clean, hooked = Path(folder)/'clean.mp4', Path(folder)/'hook.mp4'
            encode(clean, f'{SW}x{SH}', 1)
            plan = {'title':'Clip'}
            with fake_tracking():
                pipeline._hook({'hook':{'text':'Xin chào','durationSeconds':.5},'captions':{'enabled':False}},
                               plan, str(clean), str(hooked), {}, scene_starts=[0])
        placement = plan['hookPlacement']
        self.assertEqual(placement['durationSeconds'], .5)
        self.assertEqual(placement['fps'], FPS)
        self.assertEqual(placement['sampledFrames'][0], 0)
        self.assertEqual(placement['sampledFrames'][-1], FPS // 2 - 1)
        self.assertLessEqual(len(placement['sampledFrames']), placement['samples'])
        self.assertFalse(placement['continuousClearanceVerified'])

    def test_measurement_failure_falls_back_to_the_estimate(self):
        captions = {'enabled':True,'style':'karaoke'}
        with patch('rendering.probe', return_value={'width':W,'height':H,'duration':2,'fps':FPS}), \
             patch('pipeline._measured_caption_bands', side_effect=RuntimeError('no libass')), \
             patch.dict(sys.modules, {'tracking':None}):
            _, evidence = pipeline._hook_protected_regions('clip.mp4', 1.0, captions, SEAM, (), TRANSCRIPT)
        self.assertEqual(evidence['captionBandSource'], 'estimated')
        self.assertEqual(evidence['captionBands'], [pipeline._caption_bands(captions, W, H)[1]])

    def test_no_caption_inside_the_hook_window_reserves_nothing(self):
        late = {'segments':[{'start':1.5,'end':1.9,'text':'muộn','words':[{'word':' muộn','start':1.5,'end':1.9}]}]}
        info = {'width':SW,'height':SH,'fps':FPS,'rFrameRate':f'{FPS}/1','duration':2}
        self.assertEqual(pipeline._measured_caption_bands(late, {'enabled':True,'style':'karaoke'}, (), info, 1.0), [])


if __name__ == '__main__':
    unittest.main()
