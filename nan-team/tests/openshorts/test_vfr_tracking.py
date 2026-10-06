"""Real FFmpeg VFR frames must preserve scene detector frame indices."""
from pathlib import Path
from types import SimpleNamespace
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/openshorts-engine/core'))
sys.path.insert(0, str(ROOT / 'packages/openshorts-engine/src'))
import reframe_v2
import rendering
import frame_timeline
import recut


class Camera:
    def __init__(self, *args, **kwargs):
        self.x = 0
        self.cuts = 0
        self.crop_width, self.crop_height = 32, 64

    def begin_scene(self):
        self.cuts += 1

    def update_target(self, box):
        self.x = box[0]

    def get_crop_box(self, force_snap=False):
        return self.x, 0, self.x + 32, 64


class Tracker:
    def __init__(self, *args, **kwargs):
        pass

    def reset(self):
        pass

    def get_target(self, candidates, frame_number, width):
        return candidates[0]['box']


class VfrTrackingTests(unittest.TestCase):
    def analyze(self, source):
        # Controlled colored subjects isolate frame timing from ML accuracy.
        def faces(frame):
            blue = frame[0, 0, 0] > frame[0, 0, 2]
            return [{'box': [64 if blue else 0, 0, 32, 32]}]
        camera = Camera()
        tracking = SimpleNamespace(SCENE_CUT_RESET=True, DETECT_STRIDE=1,
            YOLO_FALLBACK_STRIDE=1, detect_face_candidates=faces,
            detect_person_yolo=lambda frame: None)
        with patch.dict(sys.modules, {'tracking': tracking}):
            xs = reframe_v2._analyze_trajectory(str(source), [(0, 5), (5, 10)],
                ['TRACK', 'TRACK'], 10, 96, 64, camera, Tracker())
        return xs, camera.cuts

    def test_vfr_and_cfr_cut_indices_match_decoded_subjects(self):
        with tempfile.TemporaryDirectory() as directory:
            for variable in [True, False]:
                with self.subTest(variable=variable):
                    source = Path(directory) / ('vfr.mp4' if variable else 'cfr.mp4')
                    clock = 'setpts=if(lt(N\\,5)\\,N/(10*TB)\\,(N+4)/(10*TB))' if variable else 'null'
                    subprocess.run(['ffmpeg', '-v', 'error', '-y',
                        '-f', 'lavfi', '-i', 'color=red:size=96x64:rate=10:duration=0.5',
                        '-f', 'lavfi', '-i', 'color=blue:size=96x64:rate=10:duration=0.5',
                        '-filter_complex', f'[0:v][1:v]concat=n=2:v=1:a=0,{clock}[v]',
                        '-map', '[v]', '-fps_mode', 'vfr', '-c:v', 'libx264',
                        '-threads', '1', str(source)], check=True, timeout=30)
                    xs, cuts = self.analyze(source)
                    self.assertEqual(xs, [0] * 5 + [64] * 5)
                    self.assertEqual(cuts, 2)
                    clock = frame_timeline.boundaries(source)
                    self.assertEqual(len(clock), 11)
                    self.assertAlmostEqual(clock[5], .9 if variable else .5)
                    if variable:
                        # A real counterexample: default rawvideo duplicates frames.
                        raw = subprocess.check_output(['ffmpeg', '-v', 'error',
                            '-i', str(source), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], timeout=30)
                        self.assertGreater(len(raw) // (96 * 64 * 3), 10)
                        normalized = Path(directory) / 'normalized.mp4'
                        info = rendering.probe(source)
                        recut.run_cut_concat(str(source), [{'start':0, 'end':info['duration']}],
                            str(normalized), directory, runner=rendering.run, fps=rendering.cfr_rate(info))
                        cfr = frame_timeline.boundaries(normalized)
                        gaps = [b-a for a,b in zip(cfr, cfr[1:-1])]
                        self.assertLess(max(gaps)-min(gaps), .00001)

    def test_segment_seek_does_not_round_past_first_frame(self):
        for fps in [25, 28.6045, 30000/1001, 30, 60]:
            for start in range(1, 901):
                seek, count = reframe_v2.segment_window(start, start+10, fps)
                seek = float(f'{seek:.6f}')
                self.assertLess((start-1)/fps, seek)
                self.assertLess(seek, start/fps)
                self.assertEqual(count, 10)

    def test_render_cut_frame_colors_and_frame_count_are_exact(self):
        import numpy as np
        point = lambda frame: SimpleNamespace(get_frames=lambda:frame)
        tracking = SimpleNamespace(
            detect_scenes=lambda source: ([(point(0),point(248)),(point(248),point(253))],30),
            get_video_resolution=lambda source:(96,64),
            SmoothedCameraman=Camera, SpeakerTracker=Tracker,
            SCENE_CUT_RESET=True, DETECT_STRIDE=1, YOLO_FALLBACK_STRIDE=1,
            detect_face_candidates=lambda frame: [{'box':[64 if frame[0,0,0]>frame[0,0,2] else 0,0,32,32]}],
            detect_person_yolo=lambda frame:None)
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory)/'source.mp4', Path(directory)/'rendered.mp4'
            subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',
                'color=red:size=96x64:rate=30:duration=8.2666666667',
                '-f','lavfi','-i','color=blue:size=96x64:rate=30:duration=0.1666666667',
                '-filter_complex',"[0:v]trim=end_frame=248[a];[1:v]trim=end_frame=5,drawbox=x=64:y=16:w=32:h=16:color=white:t=fill:enable='eq(n,0)'[b];[a][b]concat=n=2:v=1:a=0[v]",
                '-map','[v]','-c:v','libx264','-threads','1',str(source)],check=True,timeout=30)
            decision = {}
            with patch.dict(sys.modules, {'tracking':tracking}), \
                 patch.object(reframe_v2,'DELIVERY_MIN_WIDTH',32), \
                 patch('split_layout.detect_split_scenes',return_value={}), \
                 patch('punch_in.ENABLED',False):
                reframe_v2.render(str(source), str(target), .5, force_strategy='TRACK',decision_receipt=decision)
            raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(target),
                '-fps_mode','passthrough','-f','rawvideo','-pix_fmt','bgr24','-'],timeout=30)
            frames = np.frombuffer(raw,dtype=np.uint8).reshape(-1,64,32,3)
            self.assertEqual(len(frames),253)
            self.assertTrue(np.all(frames[:248,:,:,2]>frames[:248,:,:,0]))
            self.assertTrue(np.all(frames[248:,0,0,0]>frames[248:,0,0,2]))
            self.assertGreater(int(frames[248,20,16].min()),200)
            self.assertLess(int(frames[249,20,16,2]),50)
            self.assertEqual(decision['frameClock']['decoded'],253)


if __name__ == '__main__':
    unittest.main()
