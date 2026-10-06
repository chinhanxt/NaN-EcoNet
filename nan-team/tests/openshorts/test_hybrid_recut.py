"""Hybrid revision recut: loudness per source range like a full render, scene offsets from planned frames."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import render_phase
from ffmpeg_utils import LOUDNORM_FILTER


def cut_argv(output):
    return ['ffmpeg', '-y', '-i', 'in.mp4', '-c:v', 'libx264', '-af', LOUDNORM_FILTER, '-c:a', 'aac', output]


class HybridRecutTests(unittest.TestCase):
    def build(self, audio=True):
        directory = Path(tempfile.mkdtemp())
        commands, cuts, framed_runners = [], [], []

        def run_cut_concat(source, ranges, out, workdir, runner, fps):
            cuts.append((source, ranges))
            runner(cut_argv(out))

        partial = {'path': 'parent-clean.mp4', 'pieces': [
            {'kind': 'clean', 'cleanStart': 0, 'cleanEnd': 5, 'start': 10, 'end': 15},
            {'kind': 'new', 'start': 15, 'end': 18.5}]}
        request = {'reuse': {'renderDecision': {'scenes': []}}, 'audio': {}}
        # Containers run ~40 ms long (AAC padding); the planned cut lengths must win.
        probe = {'duration': 5.04, 'width': 1080, 'height': 1920, 'audio': audio, 'fps': 30}
        with patch('rendering.cfr_rate', return_value='30'), \
             patch('rendering.probe', return_value=probe), \
             patch('rendering.run', side_effect=commands.append), \
             patch('rendering.audio_mix', side_effect=lambda framed, target, audio: framed), \
             patch('recut.run_cut_concat', side_effect=run_cut_concat), \
             patch('render_phase._remap_parent_scenes',
                   return_value=[{'startSeconds': 0, 'endSeconds': 5, 'strategy': 'TRACK'}]), \
             patch('render_phase._frame_source', side_effect=lambda *a, runner=None, **k: (
                 framed_runners.append(runner),
                 (runner or render_phase.rendering.run)(cut_argv('new-cut.mp4')),
                 {'scenes': [{'startSeconds': 0, 'endSeconds': 3.5, 'strategy': 'GENERAL'}]})[2]):
            clean, decision = render_phase._hybrid(request, 'source.mp4', directory, 'clip', {'layout': 'auto'},
                                                   {'media': {}}, partial, [])
        self.framed_runners = framed_runners
        return clean, decision, commands, cuts

    def test_only_new_source_ranges_are_normalized_like_a_full_render(self):
        clean, _, commands, _ = self.build()
        # Cut order: parent clean piece (plain), new source range (per-range loudnorm), re-cut of it (plain).
        cut_commands = [c for c in commands if 'libx264' in c]
        self.assertEqual([LOUDNORM_FILTER in c for c in cut_commands], [False, True, False])
        self.assertEqual(self.framed_runners, [None])
        # No extra loudness pass after the join: the parts are stream-copied straight into the clean clip.
        self.assertEqual(sum(LOUDNORM_FILTER in c for c in commands), 1)
        self.assertIn('concat', commands[-1])
        self.assertEqual(commands[-1][-1], str(clean))

    def test_scene_offsets_use_planned_frames_not_container_duration(self):
        _, decision, _, cuts = self.build()
        self.assertEqual(decision['scenes'][1]['startSeconds'], 5.0)
        self.assertEqual(decision['scenes'][1]['endSeconds'], 8.5)
        # The framed new piece is re-cut to its planned length, not the probed container length.
        self.assertEqual(cuts[-1][1], [{'start': 0, 'end': 3.5}])

    def test_silent_clip_is_joined_by_stream_copy(self):
        clean, _, commands, _ = self.build(audio=False)
        self.assertIn('concat', commands[-1])
        self.assertEqual(commands[-1][-1], str(clean))

    def test_without_loudnorm_strips_only_the_loudnorm_filter(self):
        self.assertEqual(render_phase._without_loudnorm(cut_argv('o.mp4')),
                         ['ffmpeg', '-y', '-i', 'in.mp4', '-c:v', 'libx264', '-c:a', 'aac', 'o.mp4'])
        self.assertEqual(render_phase._without_loudnorm(['ffmpeg', '-af', 'volume=2']), ['ffmpeg', '-af', 'volume=2'])

    def test_cut_seconds_rounds_to_whole_frames(self):
        self.assertAlmostEqual(render_phase._cut_seconds([{'start': 0, 'end': 1.01}], '30'), 1.0)
        self.assertAlmostEqual(render_phase._cut_seconds([{'start': 0, 'end': 1}, {'start': 2, 'end': 2.5}],
                                                         '30000/1001'), 45 * 1001 / 30000)


if __name__ == '__main__':
    unittest.main()
