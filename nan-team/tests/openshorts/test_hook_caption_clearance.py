"""Hook placement keeps every caption band clear, including the SPLIT seam."""
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import hooks
import pipeline
import render_phase

W, H = 1080, 1920
PROBE = {'width':W,'height':H,'duration':5}
# Face A fills the top of the frame; face B sits inside the bottom caption band.
FACES = [{'box':[340,100,400,560]},{'box':[340,1400,300,300]}]


class Capture:
    def __init__(self, path): pass
    def set(self, *args): pass
    def read(self): return True, object()
    def release(self): pass


def detector(faces=FACES):
    return {'cv2':SimpleNamespace(VideoCapture=Capture, CAP_PROP_POS_MSEC=0),
            'tracking':SimpleNamespace(detect_face_candidates=lambda frame: faces)}


def overlaps(y, height, box):
    return y < box[1] + box[3] and y + height > box[1]


def regions(captions, split_ranges=(), modules=None):
    with patch.dict(sys.modules, modules if modules is not None else detector()), \
         patch('rendering.probe', return_value=PROBE):
        return pipeline._hook_protected_regions('clip.mp4', 5, captions, split_ranges)


class SplitSeamTests(unittest.TestCase):
    def test_hook_avoids_split_seam_captions_burned_over_it(self):
        # Legacy compact look (explicit user style): the default Anton 44 estimate is too tall for this face.
        protected, evidence = regions({'enabled':True,'style':'karaoke','fontName':'Verdana','fontSize':16,
                                       'uppercase':False}, [(0,3)])
        bottom, seam = evidence['captionBands']
        self.assertLess(seam[1], H//2)
        self.assertGreater(seam[1] + seam[3], H//2)
        y = hooks.safe_overlay_y(W, H, 972, 150, protected)
        self.assertFalse(overlaps(y, 150, seam))
        self.assertFalse(overlaps(y, 150, bottom))
        # Without the seam band the same frame puts the hook exactly where SPLIT captions land.
        legacy = hooks.safe_overlay_y(W, H, 972, 150, [box for box in protected if box != seam])
        self.assertTrue(overlaps(legacy, 150, seam))

    def test_seam_reserved_only_when_split_overlaps_hook_interval(self):
        _, evidence = regions({'enabled':True,'style':'karaoke'}, [(6,9)])
        self.assertEqual(len(evidence['captionBands']), 1)
        _, evidence = regions({'enabled':True,'style':'karaoke'}, [])
        self.assertEqual(len(evidence['captionBands']), 1)

    def test_split_covering_whole_hook_uses_only_the_seam(self):
        _, covered = regions({'enabled':True,'style':'karaoke'}, [(0,2.5),(2.5,8)])
        self.assertEqual(len(covered['captionBands']), 1)
        self.assertLess(covered['captionBands'][0][1], H//2)
        _, gap = regions({'enabled':True,'style':'karaoke'}, [(0,2.5),(2.6,8)])
        self.assertEqual(len(gap['captionBands']), 2)

    def test_classic_srt_never_moves_to_seam(self):
        _, evidence = regions({'enabled':True,'style':'classic'}, [(0,5)])
        self.assertEqual(len(evidence['captionBands']), 1)
        self.assertEqual(evidence['captionBands'][0][1] + evidence['captionBands'][0][3], H)


class FontAwareBandTests(unittest.TestCase):
    def test_band_grows_with_font_size_and_keeps_legacy_floor(self):
        small, _, _ = pipeline._caption_bands({'enabled':True,'fontSize':16}, W, H)
        large, large_seam, _ = pipeline._caption_bands({'enabled':True,'fontSize':44}, W, H)
        self.assertLessEqual(small[1], int(H*.75))
        self.assertEqual(small[1] + small[3], H)
        self.assertLess(large[1], small[1])
        # Two lines of the scaled ASS font above MarginV must sit inside the band.
        margin = int(43 * H / 288)
        line = int(44 * .85) * H / 288
        self.assertLessEqual(large[1], H - margin - 2 * line)
        self.assertGreaterEqual(large_seam[3], 2 * line)

    def test_top_and_middle_positions_cover_their_text(self):
        top, _, _ = pipeline._caption_bands({'enabled':True,'fontSize':40,'position':'top'}, W, H)
        self.assertEqual(top[1], 0)
        self.assertGreaterEqual(top[3], int(43 * H / 288) + 2 * int(40 * .85) * H / 288)
        middle, seam, _ = pipeline._caption_bands({'enabled':True,'fontSize':40,'position':'middle'}, W, H)
        self.assertLessEqual(middle[1], min(int(H*.4), seam[1]))
        self.assertGreaterEqual(middle[1] + middle[3], max(int(H*.65), seam[1] + seam[3]))

    def test_band_never_exceeds_frame(self):
        band, seam, _ = pipeline._caption_bands({'enabled':True,'fontSize':200}, W, H)
        self.assertEqual(band, [0, 0, W, H])
        self.assertEqual(seam, [0, 0, W, H])


class UnavailableDetectorTests(unittest.TestCase):
    def test_caption_bands_survive_missing_face_detector(self):
        protected, evidence = regions({'enabled':True,'style':'karaoke'}, [(0,5)], {'tracking':None})
        self.assertEqual(evidence['faceDetection'], 'unavailable')
        self.assertTrue(protected)
        self.assertEqual(protected, evidence['captionBands'])
        self.assertFalse(evidence['continuousClearanceVerified'])

    def test_missing_detector_without_captions_keeps_legacy_position(self):
        protected, evidence = regions({'enabled':False}, [], {'tracking':None})
        self.assertIsNone(protected)
        self.assertEqual(evidence['captionBands'], [])

    def test_missing_detector_is_surfaced_as_warning(self):
        warnings, plan = [], {'title':'Clip'}
        request = {'hook':{'text':'Xin chào','durationSeconds':2},'captions':{'enabled':True,'style':'karaoke'}}
        with patch.dict(sys.modules, {'tracking':None}), patch('rendering.probe', return_value=PROBE), \
             patch('hooks.add_hook_to_video') as add:
            pipeline._hook(request, plan, 'clip.mp4', 'hook.mp4', {}, split_ranges=[(0,1)], warnings=warnings)
        self.assertEqual(add.call_args.kwargs['protected_boxes'], plan['hookPlacement']['captionBands'])
        self.assertEqual(len(plan['hookPlacement']['captionBands']), 2)
        self.assertIn(pipeline.FACE_CLEARANCE_WARNING, warnings)


class FontShrinkRetryTests(unittest.TestCase):
    request = {'hook':{'text':'Một câu hook khá dài','durationSeconds':2},'captions':{'enabled':False}}

    def hook(self, side_effect, warnings):
        plan = {'title':'Clip'}
        with patch('rendering.probe', return_value=PROBE), \
             patch('pipeline._hook_protected_regions', return_value=([[0,0,10,10]],{'faceDetection':'provisioned-MediaPipe'})), \
             patch('hooks.add_hook_to_video', side_effect=side_effect) as add:
            try:
                pipeline._hook(self.request, plan, 'clip.mp4', 'hook.mp4', {}, warnings=warnings)
            finally:
                self.scales = [call.kwargs['font_scale'] for call in add.call_args_list]
        return plan

    def test_shrinks_font_until_region_found_and_records_receipt(self):
        def place(*args, font_scale, placement_receipt, **kwargs):
            if font_scale > .8:
                raise ValueError('No hook region avoids detected faces and reserved captions')
            placement_receipt.update({'y':100,'height':120})
            return True
        warnings = []
        plan = self.hook(place, warnings)
        self.assertEqual(self.scales, [1.0, .85, .7])
        self.assertEqual(plan['hookPlacement']['fontScale'], .7)
        self.assertEqual(plan['hookPlacement']['rejectedFontScales'], [1.0, .85])
        self.assertEqual(plan['hookPlacement']['y'], 100)
        self.assertIn('Hook font reduced to 70% to clear faces and captions', warnings)

    def test_first_fit_keeps_full_size_without_warning(self):
        warnings = []
        plan = self.hook(lambda *a, placement_receipt, **k: placement_receipt.update({'y':50}), warnings)
        self.assertEqual(self.scales, [1.0])
        self.assertEqual(plan['hookPlacement']['fontScale'], 1.0)
        self.assertEqual(plan['hookPlacement']['rejectedFontScales'], [])
        self.assertEqual(warnings, [])

    def test_retry_is_bounded_then_skips_hook_with_warning(self):
        warnings = []
        plan = self.hook(ValueError('No hook region avoids detected faces'), warnings)
        attempts = list(pipeline._hook_attempts())
        self.assertEqual(self.scales, [scale for _, scale in attempts])
        self.assertEqual(self.scales[:3], list(pipeline.HOOK_FONT_SCALES))
        self.assertEqual(plan['hookPlacement']['hookSkipped']['reason'], 'no-clear-region')
        self.assertEqual(plan['hookPlacement']['strategy'], 'skipped')
        self.assertIn(pipeline.HOOK_SKIPPED_WARNING, warnings)

    def test_other_errors_are_not_retried(self):
        with self.assertRaisesRegex(ValueError, 'bad style'):
            self.hook(ValueError('bad style'), [])
        self.assertEqual(self.scales, [1.0])


LW, LH = 1280, 720
# Two seated speakers of a 16:9 interview (job 9101ef9c): faces fill the middle band.
TWO_FACES = [{'box':[374,253,119,119]},{'box':[793,219,141,141]}]


class LandscapeTwoFaceTests(unittest.TestCase):
    """16:9 + two faces + default Anton karaoke: the hook is placed or skipped, never raised."""

    def run_hook(self, text, faces, captions=None):
        import subprocess
        import tempfile
        from pathlib import Path
        folder = Path(tempfile.mkdtemp())
        source = folder / 'clip.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=0x3070c0:size=%dx%d:rate=30:duration=2' % (LW, LH),
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(source)], check=True)
        words = [{'word':' '+w,'start':i*.3,'end':i*.3+.28} for i, w in enumerate(
            'có nghĩa là có những cái pha hành động rất là nguy hiểm'.split())]
        transcript = {'segments':[{'start':0,'end':words[-1]['end'],'text':'','words':words}]}
        captions = captions or {'enabled':True,'style':'karaoke'}
        request = {'hook':{'text':text,'durationSeconds':2},'captions':captions}
        plan, warnings = {'title':'Clip'}, []
        also = (pipeline._caption_filter(source, transcript, captions, folder), folder/'captioned.mp4')
        with patch.dict(sys.modules, {'cv2':SimpleNamespace(VideoCapture=Capture, CAP_PROP_POS_MSEC=0),
                                      'tracking':SimpleNamespace(detect_face_candidates=lambda frame: faces)}):
            result = pipeline._hook(request, plan, source, folder/'hook.mp4', transcript, warnings=warnings,
                                    scene_starts=[0], also=also)
        self.assertEqual(Path(result), folder/'captioned.mp4')
        self.assertTrue(Path(result).exists())
        return plan['hookPlacement'], warnings

    def assert_clear(self, placement, faces):
        box = [placement['x'], placement['y'], placement['width'], placement['height']]
        for face in placement['protectedBoxes']:
            self.assertFalse(box[0] < face[0]+face[2] and box[0]+box[2] > face[0] and
                             box[1] < face[1]+face[3] and box[1]+box[3] > face[1], (box, face))

    def test_live_revision_hook_is_placed_clear_of_faces_and_captions(self):
        placement, warnings = self.run_hook('Lan Ngọc từng bị xe tải tông khi đóng phim', TWO_FACES)
        self.assertNotIn('hookSkipped', placement)
        self.assertEqual(placement['captionBandSource'], 'measured-libass')
        self.assert_clear(placement, TWO_FACES)
        # Landscape captions are scaled down: one Anton line well under 13% of the frame height.
        self.assertTrue(all(band[3] < LH * .12 for band in placement['captionBands']), placement['captionBands'])

    def test_crowded_frame_skips_hook_with_warning_instead_of_raising(self):
        # Faces cover the whole frame above the captions: no position can clear them.
        wall = [{'box':[x, 0, 200, 560]} for x in range(0, LW, 180)]
        placement, warnings = self.run_hook('Lan Ngọc từng bị xe tải tông khi đóng phim', wall)
        self.assertEqual(placement['hookSkipped']['reason'], 'no-clear-region')
        self.assertIn(pipeline.HOOK_SKIPPED_WARNING, warnings)

    def test_narrow_hook_fits_beside_faces(self):
        # Faces occupy the centre from top to captions: only side columns are free.
        centre = [{'box':[400, 0, 480, 600]}]
        placement, warnings = self.run_hook('Hook ngắn gọn', centre)
        self.assertNotIn('hookSkipped', placement)
        self.assert_clear(placement, centre)
        self.assertTrue(placement['x'] + placement['width'] <= 400 - 8 or placement['x'] >= 880 + 8)


class CaptionAspectScaleTests(unittest.TestCase):
    def test_play_res_scales_with_aspect(self):
        import subtitles
        self.assertEqual(subtitles.play_res_y((1080, 1920)), 288)
        self.assertEqual(subtitles.play_res_y(None), 288)
        self.assertEqual(subtitles.play_res_y((1920, 1080)), 512)
        self.assertEqual(subtitles.play_res_y((1080, 1080)), 384)

    def test_landscape_estimated_band_is_smaller_than_vertical(self):
        vertical, _, _ = pipeline._caption_bands({'enabled':True,'style':'karaoke'}, 1080, 1920)
        wide, _, _ = pipeline._caption_bands({'enabled':True,'style':'karaoke'}, 1920, 1080)
        self.assertEqual(wide[1] + wide[3], 1080)
        self.assertLess(1080 - wide[1], (1920 - vertical[1]) * 1080 / 1920 + 1)

    def test_srt_force_style_carries_play_res_only_for_wide_frames(self):
        import subtitles
        self.assertNotIn('PlayResY', subtitles.subtitles_filter('a.srt', frame_size=(1080, 1920)))
        self.assertIn('PlayResY=512', subtitles.subtitles_filter('a.srt', frame_size=(1920, 1080)))


class LegacyRevisionSceneTests(unittest.TestCase):
    def test_parent_scenes_without_strategy_are_skipped(self):
        scenes = render_phase._remap_parent_scenes([
            {'startSeconds':0,'endSeconds':1},
            {'startSeconds':1,'endSeconds':2,'strategy':'SPLIT'},
            {'startSeconds':2,'endSeconds':3,'strategy':''}], [{'start':.5,'end':3}])
        self.assertEqual(scenes, [{'startSeconds':.5,'endSeconds':1.5,'strategy':'SPLIT'}])

    def test_parent_without_scenes_remaps_to_nothing(self):
        self.assertEqual(render_phase._remap_parent_scenes(None, [{'start':0,'end':1}]), [])
        self.assertEqual(render_phase._remap_parent_scenes([{'strategy':'TRACK'}], [{'start':0,'end':1}]), [])


if __name__ == '__main__':
    unittest.main()
