"""Container metadata must not add frames or shift the speaker-analysis clock."""
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import frame_timeline
import rendering
import active_speaker


class FrameTimelineEdgeTests(unittest.TestCase):
    def test_modern_frame_duration_wins_over_longer_audio(self):
        data = {'frames': [{'best_effort_timestamp_time': str(x)} for x in [0, .04, .08]],
                'streams': [{}], 'format': {'duration': '5.0'}}
        data['frames'][-1]['duration_time'] = '.04'
        with patch('subprocess.check_output', return_value=json.dumps(data).encode()):
            clock = frame_timeline.boundaries('screen.webm')
        self.assertEqual(len(clock), 4)
        self.assertAlmostEqual(clock[-1], .12)

    def test_missing_duration_uses_observed_spacing(self):
        data = {'frames': [{'best_effort_timestamp_time': str(x)} for x in [1, 1.04, 1.08]],
                'streams': [{'duration': 'N/A'}], 'format': {}}
        with patch('subprocess.check_output', return_value=json.dumps(data).encode()):
            clock = frame_timeline.boundaries('screen.mkv')
        self.assertAlmostEqual(clock[-1], .12)

    def test_probe_falls_back_to_nominal_rate_without_dropping_frames(self):
        data = {'streams': [{'codec_type':'video', 'width':640, 'height':360,
                            'avg_frame_rate':'0/0', 'r_frame_rate':'30/1'}],
                'format': {'duration':'1'}}
        with patch('subprocess.check_output', return_value=json.dumps(data).encode()):
            info = rendering.probe('screen.webm')
        self.assertEqual(info['fps'], 30)
        self.assertEqual(rendering.cfr_rate(info), '30/1')
        data['streams'][0]['r_frame_rate'] = '0/0'
        with patch('subprocess.check_output', return_value=json.dumps(data).encode()):
            with self.assertRaisesRegex(ValueError, 'frame rate is unknown'):
                rendering.probe('broken.webm')

    def test_speaker_activity_keeps_first_frame_and_exact_count(self):
        cv = SimpleNamespace(CAP_PROP_FRAME_WIDTH=1, CAP_PROP_FRAME_HEIGHT=2,
                             VideoCapture=lambda p: SimpleNamespace(get=lambda prop:96 if prop==1 else 64,
                                                                      release=lambda:None))
        proc = SimpleNamespace(stdout=io.BytesIO(), wait=lambda:0)
        with patch.dict(sys.modules, {'cv2':cv}), patch('subprocess.Popen', return_value=proc) as popen:
            active_speaker.decode_activity('clip.mp4', 248/30, 5/30, [], 30)
        command = popen.call_args.args[0]
        self.assertEqual(command[command.index('-frames:v')+1], '5')
        self.assertNotIn('-t', command)
        seek = float(command[command.index('-ss')+1])
        self.assertLess(247/30, seek)
        self.assertLess(seek, 248/30)

    def test_transnet_uses_decoded_count_instead_of_container_estimate(self):
        import numpy as np
        import contextlib
        import scene_detection
        frames = np.zeros((10, 27, 48, 3), dtype=np.uint8)
        tensor = SimpleNamespace(to=lambda _:None)
        prediction = SimpleNamespace(cpu=lambda:SimpleNamespace(numpy=lambda:np.zeros(10)))
        model = SimpleNamespace(device='cpu', predict_frames=lambda *a, **k:(prediction, None),
                                predictions_to_scenes=lambda *a, **k:[(0,9)])
        torch = SimpleNamespace(no_grad=contextlib.nullcontext, from_numpy=lambda _:tensor,
                                cuda=SimpleNamespace(is_available=lambda:False))
        cap = SimpleNamespace(get=lambda prop:30.0 if prop==scene_detection.cv2.CAP_PROP_FPS else 14,
                              release=lambda:None)
        with patch.dict(sys.modules, {'torch':torch}), \
             patch.object(scene_detection.cv2, 'VideoCapture', return_value=cap), \
             patch.object(scene_detection, '_extract_frames_small', return_value=frames), \
             patch.object(scene_detection, '_get_tn2_model', return_value=model):
            scenes, _ = scene_detection._detect_transnetv2('vfr.webm')
        self.assertEqual(scenes[-1][1].get_frames(), len(frames))


if __name__ == '__main__':
    unittest.main()
