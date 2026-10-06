"""Speaker cut (function 7): voice attribution, multi-camera validation, fallbacks."""
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import active_speaker as a

SR = a.VOICE_SR


def voice(f0, seconds, sr=SR):
    """Harmonic-rich synthetic voice (sawtooth at f0)."""
    t = np.arange(int(seconds * sr)) / sr
    return (0.3 * (2 * ((t * f0) % 1.0) - 1)).astype(np.float32)


def labels_for(audio):
    return a.voice_labels(a.window_pitches(a.pitch_track(audio)))


class VoiceAttributionTests(unittest.TestCase):
    def test_pitch_track_finds_male_and_female_f0(self):
        for f0 in (110.0, 200.0):
            track = a.pitch_track(voice(f0, 1.0))
            voiced = track[track > 0]
            self.assertGreater(len(voiced), 0.8 * len(track))
            self.assertAlmostEqual(float(np.median(voiced)), f0, delta=f0 * 0.05)

    def test_silence_is_unvoiced(self):
        self.assertTrue(np.all(a.pitch_track(np.zeros(SR, np.float32)) == 0))

    def test_two_voices_alternating_are_labelled(self):
        audio = np.concatenate([voice(110, 2), voice(200, 2), voice(110, 2)])
        labels = labels_for(audio)
        self.assertIsNotNone(labels)
        self.assertEqual(a.dominant_voice(labels, 0, 2), 0)
        self.assertEqual(a.dominant_voice(labels, 2, 4), 1)
        self.assertEqual(a.dominant_voice(labels, 4, 6), 0)

    def test_single_speaker_intonation_is_not_two_voices(self):
        audio = np.concatenate([voice(f, 0.8) for f in (175, 205, 190, 230, 180, 215, 170, 200)])
        self.assertIsNone(labels_for(audio))

    def test_no_audio_is_not_two_voices(self):
        self.assertIsNone(labels_for(np.zeros(0, np.float32)))

    def test_minor_second_voice_below_share_is_rejected(self):
        audio = np.concatenate([voice(110, 0.4), voice(200, 8)])
        self.assertIsNone(labels_for(audio))

    def test_mouth_maps_each_voice_to_a_face(self):
        labels = [0, 0, 0, 1, 1, 1, None]
        activity = [[1.0, 0.1]] * 3 + [[0.1, 0.9]] * 3 + [[0.5, 0.5]]
        mapping = a.map_voices_by_mouth(activity, labels)
        self.assertEqual(mapping, {0: 0, 1: 1})
        self.assertEqual(a.voice_verdicts(labels, mapping), [0, 0, 0, 1, 1, 1, None])

    def test_mouth_mapping_refuses_when_same_face_moves_for_both_voices(self):
        labels = [0, 0, 0, 1, 1, 1]
        self.assertIsNone(a.map_voices_by_mouth([[1.0, 0.1]] * 6, labels))


class MulticamLogicTests(unittest.TestCase):
    def test_fixture_like_edit_with_reaction_shot_validates(self):
        # Vietcetera 0-30s: monk speaks on his shot, woman on hers, one monk
        # reaction shot while the woman talks (measured agreement 0.809).
        shots = [(0, 0, 4.36), (1, 1, 6.4), (1, 1, 6.56), (0, 1, 4.68), (1, 1, 2.52)]
        mapping, agreement = a.assign_people_to_voices(shots)
        self.assertEqual(mapping, {0: 0, 1: 1})
        self.assertAlmostEqual(agreement, 19.84 / 24.52, places=3)

    def test_listener_never_seen_speaking_is_not_validated(self):
        shots = [(0, 1, 5.0), (1, 1, 5.0), (0, 1, 5.0)]
        mapping, _ = a.assign_people_to_voices(shots)
        self.assertIsNone(mapping)

    def test_clothing_chroma_clusters_people_and_rejects_ambiguous(self):
        monk, woman = np.array([19.0, 10.0]), np.array([0.0, 0.0])
        ids, centres = a.cluster_people([monk, woman, woman + 1, monk - 2, np.array([9.5, 5.0]), None])
        self.assertEqual(ids, [0, 1, 1, 0, None, None])
        self.assertEqual(len(centres), 2)

    def test_wide_bodies_match_close_up_guests(self):
        centres = [np.array([19.0, 10.0]), np.array([0.0, 0.0])]
        # Measured on the fixture wide shot: left woman (-2,0), right monk (10,4).
        self.assertEqual(a.match_sides([np.array([-2.0, 0.0]), np.array([10.0, 4.0])], centres), [1, 0])
        self.assertIsNone(a.match_sides([np.array([9.0, 5.0]), np.array([10.0, 5.0])], centres))


def make_video(path, colours, seconds=3, size=(320, 180), fps=10):
    """One solid-colour scene per entry; 'split:<left>:<right>' makes a wide shot."""
    parts = []
    for c in colours:
        if c.startswith('split:'):
            _, left, right = c.split(':')
            parts.append(f"color=c={left}:s={size[0]//2}x{size[1]}:r={fps}:d={seconds}[l{len(parts)}];"
                         f"color=c={right}:s={size[0]//2}x{size[1]}:r={fps}:d={seconds}[r{len(parts)}];"
                         f"[l{len(parts)}][r{len(parts)}]hstack[v{len(parts)}]")
        else:
            parts.append(f"color=c={c}:s={size[0]}x{size[1]}:r={fps}:d={seconds}[v{len(parts)}]")
    graph = ';'.join(parts) + ';' + ''.join(f'[v{i}]' for i in range(len(parts))) + \
        f'concat=n={len(parts)}:v=1[out]'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-filter_complex', graph, '-map', '[out]',
                    '-pix_fmt', 'yuv420p', str(path)], check=True)


class MulticamDialogueTests(unittest.TestCase):
    FPS = 10.0
    ORANGE, WHITE = '0xD2622A', '0xE8E6E0'

    def fake_detector(self):
        return SimpleNamespace(
            detect_face_candidates=lambda frame: [{'box': [150, 10, 30, 30], 'score': 900}],
            _detection_frame=lambda frame: (frame, 1.0), DETECT_LOCK=__import__('threading').Lock())

    def run_case(self, colours, audio, strategies, persons=None):
        with tempfile.TemporaryDirectory() as tmp:
            video = Path(tmp) / 'dialogue.mp4'
            make_video(video, colours)
            bounds = [(int(i * 3 * self.FPS), int((i + 1) * 3 * self.FPS)) for i in range(len(colours))]
            with patch.object(a, 'load_audio', return_value=audio), \
                 patch.object(a, '_persons', side_effect=lambda m, f: persons or []):
                return a.multicam_dialogue(str(video), bounds, strategies, self.FPS, self.fake_detector())

    def test_alternating_close_ups_and_wide_shot_cut_to_speaker(self):
        audio = np.concatenate([voice(110, 3), voice(200, 3), voice(110, 3), voice(200, 3)])
        wide = f'split:{self.WHITE}:{self.ORANGE}'
        result = self.run_case([self.ORANGE, self.WHITE, self.ORANGE, wide], audio,
                               ['TRACK', 'TRACK', 'TRACK', 'GENERAL'],
                               persons=[[20, 10, 140, 175], [180, 10, 300, 175]])
        self.assertTrue(result['validated'], result)
        self.assertEqual(result['agreement'], 1.0)
        self.assertTrue(all(s['activeSpeakerOnScreen'] for s in result['shots']))
        held, centres, people = result['wide'][3]
        # High voice is the white-clad guest, who sits on the left of the wide shot.
        self.assertEqual(people[0], result['shots'][1]['person'])
        self.assertTrue(all(v == 0 for v in held))
        self.assertLess(centres[0][0], centres[1][0])

    def test_single_voice_falls_back(self):
        audio = voice(200, 9)
        result = self.run_case([self.ORANGE, self.WHITE, self.ORANGE], audio, ['TRACK'] * 3)
        self.assertFalse(result['validated'])
        self.assertIn('two clearly separable voices', result['reason'])
        self.assertEqual(result['wide'], {})

    def test_same_person_every_shot_falls_back(self):
        audio = np.concatenate([voice(110, 3), voice(200, 3), voice(110, 3)])
        result = self.run_case([self.ORANGE] * 3, audio, ['TRACK'] * 3)
        self.assertFalse(result['validated'])
        self.assertIn('distinct on-screen people', result['reason'])

    def test_speaker_xs_keeps_crop_inside_frame_and_on_speaker(self):
        centres = ((80.0, 90.0, 120.0, 165.0), (240.0, 90.0, 120.0, 165.0))
        xs = a.speaker_xs([0, 0, 1, 1], centres, crop_w=100, orig_w=320, n_frames=16, fps=10)
        self.assertEqual(xs[0], 30)
        self.assertEqual(xs[-1], 190)
        self.assertTrue(all(0 <= x <= 220 for x in xs))


class RenderWarningTests(unittest.TestCase):
    def test_validated_multicam_attribution_clears_speaker_cut_warning(self):
        import rendering
        import reframe_v2

        def fake_render(*args, decision_receipt=None, **kwargs):
            decision_receipt.update({'scenes': [{'strategy': 'TRACK'}],
                                     'speakerAttribution': {'validated': validated}})
            return True

        for validated, expected in ((True, 0), (False, 1)):
            warnings = []
            with patch.object(rendering, 'probe', return_value={'width': 1280, 'height': 720,
                                                                'duration': 30, 'fps': 25}), \
                 patch.dict(sys.modules, {'tracking': SimpleNamespace()}), \
                 patch.object(reframe_v2, 'render', side_effect=fake_render):
                rendering.reframe('in.mp4', 'out.mp4', '9:16', 'speaker-cut', warnings)
            self.assertEqual(sum('Speaker-cut requested' in w for w in warnings), expected)


class TwoShotAttributionTests(unittest.TestCase):
    """Regression: job cebf47bd put the silent listener on screen for 18s."""

    def attribute(self, audio, art):
        with patch.object(a, 'load_audio', return_value=audio), \
             patch.object(a, 'articulation', return_value=art), \
             patch.object(a, 'decode_activity', side_effect=AssertionError('mouth path used')):
            return a.scene_attribution('clip.mp4', 0, 810, 25.0,
                                       [(445, 313, 98, 98), (857, 294, 108, 108)], detector=object())

    def test_single_talker_is_framed_not_the_listener(self):
        # Measured quarters on the 8Saigon two-shot: speaker left 0.9-1.1,
        # listener right 0.65-0.88 (mouth/eye motion ratio).
        rng = np.random.default_rng(1)
        art = [[0.97 + rng.normal(0, .05), 0.77 + rng.normal(0, .05)] for _ in range(81)]
        verdicts, mode = self.attribute(voice(220, 32.4), art)
        self.assertEqual(mode, 'single-voice')
        self.assertEqual(set(verdicts), {0})
        self.assertEqual(set(a.hold(verdicts)), {0})

    def test_unclear_articulation_with_audio_refuses_instead_of_guessing(self):
        rng = np.random.default_rng(2)
        art = [[0.9 + rng.normal(0, .1), 0.9 + rng.normal(0, .1)] for _ in range(81)]
        verdicts, mode = self.attribute(voice(220, 32.4), art)
        self.assertEqual(mode, 'unresolved')
        self.assertTrue(all(v is None for v in verdicts))
        self.assertFalse(a.is_conversation(verdicts))

    def test_speaker_leading_only_part_of_the_scene_is_unresolved(self):
        art = [[1.2, 0.7]] * 60 + [[0.6, 1.0]] * 21
        self.assertIsNone(a.single_talker(art))

    def test_two_voices_map_by_whole_scene_correlation(self):
        audio = np.concatenate([voice(110, 4), voice(210, 4)] * 4)
        labels = labels_for(audio)
        art = [[0.6, 1.1] if lab == 0 else [1.1, 0.6] if lab == 1 else [0.8, 0.8]
               for lab in labels]
        verdicts, mode = self.attribute(audio, art)
        self.assertEqual(mode, 'two-voice')
        held = a.hold(verdicts)
        self.assertEqual(held[5], 1)    # low voice -> right face
        self.assertEqual(held[15], 0)   # high voice -> left face
        self.assertTrue(a.is_conversation(verdicts))

    def test_two_voices_without_face_evidence_are_unresolved(self):
        audio = np.concatenate([voice(110, 4), voice(210, 4)] * 4)
        verdicts, mode = self.attribute(audio, [[0.8, 0.8]] * 80)
        self.assertEqual(mode, 'unresolved')

    def test_no_audio_keeps_original_mouth_path(self):
        with patch.object(a, 'load_audio', return_value=np.zeros(0, np.float32)), \
             patch.object(a, 'decode_activity', return_value=[[1.0, 0.1]] * 5), \
             patch.object(a, 'audio_envelope', return_value=[]):
            _verdicts, mode = a.scene_attribution('clip.mp4', 0, 50, 25.0,
                                                  [(100, 100, 50, 50), (300, 100, 50, 50)])
        self.assertEqual(mode, 'mouth')


if __name__ == '__main__':
    unittest.main()
