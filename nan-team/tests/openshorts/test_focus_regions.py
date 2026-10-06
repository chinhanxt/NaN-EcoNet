"""Screencast focus regions from AGY (zoom-plan-e.patch): bbox/time validation and caps."""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'packages/openshorts-engine/src'), str(ROOT / 'packages/openshorts-engine/core')]
import effect_planning
import hook_decisions


def region(start, end, x=.1, y=.2, w=.4, h=.3, reason='nút Lưu'):
    return {'start': start, 'end': end, 'x': x, 'y': y, 'w': w, 'h': h, 'reason': reason}


class FocusRegionTest(unittest.TestCase):
    def test_valid_region_is_kept_and_normalized(self):
        kept, notes = effect_planning.validate_focus_regions([region(1, 4, reason='  ô   B2 ')], 30)
        self.assertEqual(kept, [{'start': 1, 'end': 4, 'x': .1, 'y': .2, 'w': .4, 'h': .3, 'reason': 'ô B2'}])
        self.assertEqual(notes, [])

    def test_bad_boxes_and_times_are_dropped_not_fatal(self):
        kept, notes = effect_planning.validate_focus_regions([
            region(1, 3, x=.95, w=.2),        # outside the frame
            region(5, 7, w=.05),              # too small to zoom readably
            region(9, 9.3),                   # too short
            region(11, 25),                   # too long
            region('a', 2),                   # not a number
            'junk',
            region(28, 30.3),                 # end clamped to the clip end
        ], 30)
        self.assertEqual([(r['start'], r['end']) for r in kept], [(28, 30)])
        self.assertEqual(len(notes), 6)
        self.assertEqual(effect_planning.validate_focus_regions(None, 30), ([], []))

    def test_no_time_overlap_and_per_minute_cap(self):
        kept, notes = effect_planning.validate_focus_regions(
            [region(6, 9), region(1, 4), region(3, 5), region(12, 14), region(20, 22)], 30)
        # 30 s clip -> at most 2 regions; (3,5) overlaps (1,4).
        self.assertEqual([(r['start'], r['end']) for r in kept], [(1, 4), (6, 9)])
        self.assertIn('Focus region dropped: overlaps an earlier one', notes)
        self.assertTrue(any(note.startswith('Focus regions capped at 2') for note in notes))
        short, _ = effect_planning.validate_focus_regions([region(0, 2), region(3, 5)], 10)
        self.assertEqual(len(short), 1)  # always room for one

    def test_schema_exposes_focus_regions_with_a_safe_default(self):
        schema = hook_decisions.ClipContent.model_json_schema()
        self.assertIn('focus_regions', schema['properties'])
        self.assertNotIn('focus_regions', schema.get('required', []))
        answer = hook_decisions.ClipContent.model_validate(
            {'on_screen': 'x', 'title': 't', 'description': 'd', 'viral_hook_text': 'h'})
        self.assertEqual(answer.focus_regions, [])


if __name__ == '__main__':
    unittest.main()
