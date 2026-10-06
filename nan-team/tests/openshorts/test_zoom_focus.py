"""Zoom effects: optional centerX/centerY focus kept inside the frame, eased in/out."""
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import edit_builder
import effect_planning


def zoompan(vf):
    return dict(re.findall(r"(z|x|y)='([^']*)'", vf[vf.index('zoompan='):]))


def evaluate(expr, on, iw=1080, ih=1920, zoom=None):
    """Tiny evaluator for the ffmpeg expression subset edit_builder emits."""
    env = {'on': on, 'iw': iw, 'ih': ih, 'zoom': zoom, 'min': min, 'abs': abs,
           'clip': lambda v, lo, hi: max(lo, min(v, hi)),
           'between': lambda v, lo, hi: 1 if lo <= v <= hi else 0,
           'if_': lambda c, a, b: a if c else b}
    return eval(re.sub(r'\bif\(', 'if_(', expr), {'__builtins__': {}}, env)


def build(edits, fps=30):
    return edit_builder.build_filter_string(edits, duration=10, fps=fps, width=1080, height=1920)


class ZoomFocusTests(unittest.TestCase):
    def test_default_framing_is_unchanged_without_center(self):
        vf, applied = build([{'type': 'punch_in', 'start': 1, 'end': 3, 'strength': .1}])
        parts = zoompan(vf)
        self.assertEqual(parts['x'], 'iw*0.5-(iw/zoom)/2')
        self.assertEqual(parts['y'], 'ih*0.45-(ih/zoom)/2')
        self.assertNotIn('centerX', applied[0])

    def test_center_moves_window_toward_focus_and_stays_in_frame(self):
        vf, applied = build([{'type': 'punch_in', 'start': 1, 'end': 3, 'strength': .15, 'centerX': .9, 'centerY': .2}])
        self.assertEqual((applied[0]['centerX'], applied[0]['centerY']), (.9, .2))
        parts = zoompan(vf)
        zoom = evaluate(parts['z'], 60)
        self.assertAlmostEqual(zoom, 1.15, places=3)
        x, y = evaluate(parts['x'], 60, zoom=zoom), evaluate(parts['y'], 60, zoom=zoom)
        # Window is 1080/1.15 wide: centring at 0.9 would overflow, so it is clamped to the right edge.
        self.assertAlmostEqual(x, 1080 - 1080 / zoom, places=3)
        # Centring at 0.2 would start above the frame: clamped to the top edge.
        self.assertEqual(y, 0)
        # Outside the edit the default framing returns.
        self.assertEqual(evaluate(parts['x'], 150, zoom=1.0), 0)

    def test_zoom_eases_in_and_out_instead_of_jumping(self):
        for kind in ('punch_in', 'zoom_in'):
            vf, _ = build([{'type': kind, 'start': 1, 'end': 3, 'strength': .1, 'centerX': .3}])
            z = zoompan(vf)['z']
            values = [evaluate(z, frame) for frame in range(25, 96)]
            self.assertAlmostEqual(values[0], 1.0)
            self.assertAlmostEqual(evaluate(z, 90), 1.0, places=4)
            steps = [abs(b - a) for a, b in zip(values, values[1:])]
            self.assertLess(max(steps), .05, kind)
            self.assertAlmostEqual(max(values), 1.1, places=3)

    def test_invalid_center_falls_back_to_default(self):
        _, applied = build([{'type': 'zoom_in', 'start': 1, 'end': 3, 'strength': .1, 'centerX': 1.5, 'centerY': 'x'}])
        self.assertNotIn('centerX', applied[0])
        self.assertNotIn('centerY', applied[0])

    def test_center_ignored_for_non_zoom_effects(self):
        _, applied = build([{'type': 'vignette', 'start': 1, 'end': 3, 'centerX': .2}])
        self.assertNotIn('centerX', applied[0])

    def test_captions_still_block_zooms_even_with_center(self):
        vf, applied = edit_builder.build_filter_string(
            [{'type': 'punch_in', 'start': 0, 'end': 1, 'strength': .1, 'centerX': .5, 'centerY': .5}],
            duration=2, fps=30, width=320, height=180, has_captions=True)
        self.assertFalse(vf)
        self.assertEqual(applied, [])

    def test_validate_effects_bounds_centers(self):
        ok = effect_planning.validate_effects([{'type': 'punch_in', 'start': 0, 'end': 1, 'strength': .1,
                                                'centerX': .25, 'centerY': .75}], 5)
        self.assertEqual((ok[0]['centerX'], ok[0]['centerY']), (.25, .75))
        with self.assertRaisesRegex(ValueError, 'centerX'):
            effect_planning.validate_effects([{'type': 'punch_in', 'start': 0, 'end': 1, 'strength': .1,
                                               'centerX': 2}], 5)


if __name__ == '__main__':
    unittest.main()
