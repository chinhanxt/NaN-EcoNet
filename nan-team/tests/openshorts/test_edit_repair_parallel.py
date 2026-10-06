"""Edit path (r3-speed-merged.patch): content written from unrepaired words gets the repair's edits afterwards."""
from pathlib import Path
import sys
import unittest

PACKAGE = Path(__file__).resolve().parents[2] / 'packages/openshorts-engine'
sys.path[:0] = [str(PACKAGE / 'src'), str(PACKAGE / 'core')]
import analysis


def repaired_transcript(edits):
    words = [{'word': ' thầy', 'start': 40.0, 'end': 40.3}, {'word': ' Niệm', 'start': 40.4, 'end': 40.8},
             {'word': ' đóng', 'start': 90.0, 'end': 90.3}]
    return {'segments': [{'start': 40.0, 'end': 90.3, 'text': '', 'words': words}],
            'asr': {'repair': {'edits': edits}}}


def written(text):
    return {'title': text, 'hook': text, 'notes': [], 'effects': [],
            'content': {'title': text, 'description': text, 'postText': text, 'hook': text,
                        'narration': {'text': 'Hôm nay ' + text + ' kể chuyện.', 'syllables': 6}}}


class EditRepairParallelTest(unittest.TestCase):
    def test_relabel_written_applies_edits_inside_the_clip_span(self):
        edits = [{'from': 'Điệm', 'to': 'Niệm', 'start': 40.4}, {'from': 'đống', 'to': 'đóng', 'start': 90.0}]
        item = written('thầy Điệm đống phim')
        analysis.relabel_written([item], [[{'start': 35.0, 'end': 50.0}]], repaired_transcript(edits))
        # Only the edit timed inside 35-50 s applies; the 90 s one belongs to footage outside the cut.
        self.assertEqual(item['title'], 'thầy Niệm đống phim')
        self.assertEqual(item['hook'], 'thầy Niệm đống phim')
        for key in ('title', 'description', 'postText', 'hook'):
            self.assertEqual(item['content'][key], 'thầy Niệm đống phim')
        self.assertEqual(item['content']['narration']['text'], 'Hôm nay thầy Niệm đống phim kể chuyện.')
        self.assertEqual(item['content']['narration']['syllables'], 6)

    def test_multi_segment_edit_uses_the_whole_hull_and_tolerates_missing_content(self):
        edits = [{'from': 'Điệm', 'to': 'Niệm', 'start': 40.4}, {'from': 'đống', 'to': 'đóng', 'start': 90.0}]
        item = {'title': 'Điệm và đống', 'hook': None, 'content': None, 'notes': [], 'effects': []}
        analysis.relabel_written([item], [[{'start': 39.0, 'end': 45.0}, {'start': 88.0, 'end': 92.0}]],
                                 repaired_transcript(edits))
        self.assertEqual(item['title'], 'Niệm và đóng')
        self.assertIsNone(item['hook'])

    def test_user_hook_text_is_never_rewritten(self):
        # r3-review-e2.patch: request.hook.text is the user's literal, not ASR output.
        edits = [{'from': 'Điệm', 'to': 'Niệm', 'start': 40.4}]
        item = written('thầy Điệm')
        analysis.relabel_written([item], [[{'start': 35.0, 'end': 50.0}]], repaired_transcript(edits), 'thầy Điệm')
        self.assertEqual(item['hook'], 'thầy Điệm')
        self.assertEqual(item['title'], 'thầy Niệm')

    def test_no_edits_is_a_no_op(self):
        item = written('thầy Điệm')
        analysis.relabel_written([item], [[{'start': 0.0, 'end': 99.0}]], repaired_transcript([]))
        self.assertEqual(item, written('thầy Điệm'))


if __name__ == '__main__':
    unittest.main()
