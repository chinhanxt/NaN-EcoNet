"""Grounded clip content: title, post caption, hook, timed narration and selection rationale."""
from pathlib import Path
from types import SimpleNamespace
import os
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import ai_provider
import hook_decisions
import pipeline

TRANSCRIPT = {'language': 'vi', 'segments': [
    {'start': 0, 'end': 4, 'text': 'Hôm nay mình pha cà phê muối', 'words': []},
    {'start': 4, 'end': 10, 'text': 'chỉ cần 3 thìa muối và kem tươi', 'words': []}]}


def answer(narration='', **changes):
    data = {'scene_notes': ['Tay rót cà phê', 'Thêm kem muối'], 'on_screen': 'Pha cà phê muối',
            'title': 'Cách pha cà phê muối tại nhà', 'description': 'Cà phê muối được pha ngay trước mắt. Chỉ cần 3 thìa muối và kem tươi. Thử ngay nhé!',
            'hashtags': ['caphemuoi', '#cafe', 'caphemuoi'], 'viral_hook_text': 'Cà phê muối chỉ với 3 thìa muối',
            'narration': narration, 'selection_rationale': ''}
    data.update(changes)
    return data


def provider(*answers):
    calls = []
    def request(prompt, schema, frames=None, role=None):
        calls.append(prompt)
        return answers[min(len(calls), len(answers)) - 1]
    return SimpleNamespace(request=request), calls


class ContentGenerationTests(unittest.TestCase):
    def test_combined_plan_uses_existing_schema_and_normalizes_zoom(self):
        from editor import EditPlan
        self.assertEqual(hook_decisions.ClipContentWithEffects.model_json_schema()['$defs']['EditPlan'],
                         {k: v for k, v in EditPlan.model_json_schema().items() if k != '$defs'})
        edits = [{'type': 'punch_in', 'start': 2, 'end': 4, 'strength': .8, 'reason': 'emphasis'},
                 {'type': 'zoom_in', 'start': 3, 'end': 5, 'strength': .1}]
        fake, calls = provider(answer(effect_plan={'edits': edits}))
        with patch('ai_provider.current', return_value=fake):
            result = hook_decisions.clip_content(TRANSCRIPT, 'auto', [{'timestampSeconds': 12}], 10,
                                                segments=[{'start': 10, 'end': 20}], effects_brief='subtle')
        self.assertEqual(len(calls), 1)
        self.assertIn('CLIP-LOCAL', calls[0])
        self.assertIn('Frame times (clip seconds): 2.0', calls[0])
        self.assertEqual(result['effects'], [{'type': 'punch_in', 'start': 2., 'end': 4., 'strength': .15}])

    def test_bad_combined_effects_retry_and_fail_closed(self):
        for edits in ([{'type': 'unknown', 'start': 1, 'end': 2}],
                      [{'type': 'punch_in', 'start': 9, 'end': 11}],
                      [{'type': 'punch_in', 'start': float('nan'), 'end': 2}],
                      [{'type': 'punch_in', 'start': 1, 'end': 2}] * 13):
            fake, calls = provider(answer(effect_plan={'edits': edits}))
            with patch('ai_provider.current', return_value=fake), self.assertRaises(ValueError):
                hook_decisions.clip_content(TRANSCRIPT, 'auto', [], 10, effects_brief='subtle')
            self.assertEqual(len(calls), 2)
        fake, calls = provider(answer(), answer(effect_plan={'edits': []}))
        with patch('ai_provider.current', return_value=fake):
            result = hook_decisions.clip_content(TRANSCRIPT, 'auto', [], 10, effects_brief='subtle')
        self.assertEqual(len(calls), 2)
        self.assertEqual(result['effects'], [])

    def test_grounded_copy_without_narration(self):
        fake, calls = provider(answer())
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(TRANSCRIPT, 'auto', [{'timestampSeconds': 12}], 10,
                                                  segments=[{'start': 10, 'end': 20}])
        self.assertEqual(len(calls), 1)
        self.assertIn('[4.0-10.0s] chỉ cần 3 thìa muối', calls[0])
        self.assertIn('Frame times (clip seconds): 2.0', calls[0])
        self.assertIn('Vietnamese', calls[0])
        self.assertEqual(content['hashtags'], ['#caphemuoi', '#cafe'])
        self.assertTrue(content['postText'].endswith('#caphemuoi #cafe'))
        self.assertIsNone(content['narration'])
        self.assertEqual(content['grounding']['sceneNotes'][0], 'Tay rót cà phê')
        self.assertEqual(hook_decisions.hook_receipt(content)['language'], 'vi')

    def test_invented_number_is_rejected_then_fails_closed(self):
        fake, calls = provider(answer(description='Tiết kiệm 50% chi phí khi pha cà phê muối.'))
        with patch('ai_provider.current', return_value=fake):
            with self.assertRaisesRegex(ValueError, 'description: Numeric claim'):
                hook_decisions.clip_content(TRANSCRIPT, 'auto', [], 10)
        self.assertEqual(len(calls), 2)
        self.assertIn('Previous answer rejected: description', calls[1])

    def test_narration_is_timed_to_clip_and_retried(self):
        short = 'Cà phê muối được pha.'
        good = ('Đầu tiên mình rót cà phê nóng vào ly, rồi sau đó thêm lớp kem tươi đánh bông với '
                'ba thìa muối, nhờ vậy vị béo mặn hòa vào vị đắng thật dễ chịu và cuối cùng ly '
                'cà phê muối đã sẵn sàng để thưởng thức ngay tại nhà.')
        fake, calls = provider(answer(short), answer(good))
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(TRANSCRIPT, 'auto', [], 12, narration=True)
        budget = hook_decisions.narration_budget(12)
        self.assertEqual(budget['target'], 56)
        self.assertIn('about 56 syllables (allowed 48-62', calls[0])
        self.assertIn('narration has 5 syllables', calls[1])
        narration = content['narration']
        self.assertEqual(narration['text'], good)
        self.assertTrue(budget['low'] <= narration['syllables'] <= budget['high'])
        self.assertEqual(narration['durationSeconds'], 12)

    def test_prompt_keeps_names_and_titles_verbatim(self):
        prompt, _ = hook_decisions.content_prompt(TRANSCRIPT, 'auto', 12, [], True, None, 'vi')
        self.assertIn('NAMES AND TITLES', prompt)
        self.assertIn('never translate them or read a title literally', prompt)
        self.assertIn('bộ phim Găng tay đỏ', prompt)
        self.assertIn('keep names and titles verbatim', prompt)

    def test_source_names_skip_sentence_starts(self):
        transcript = {'segments': [{'text': 'Hôm nay xem phim “Găng tay đỏ” cùng Trấn Thành. Rồi về nhà.'}]}
        self.assertEqual(hook_decisions.source_names(transcript), {'Găng tay đỏ', 'Trấn Thành'})
        self.assertIsNone(hook_decisions.renamed('Bộ phim Găng tay đỏ rất hay.', {'Găng tay đỏ'}))
        self.assertIn('Găng tay đỏ', hook_decisions.renamed('Anh ấy mang găng tay đỏ.', {'Găng tay đỏ'}))

    def test_literal_title_in_narration_is_rejected_and_retried(self):
        transcript = {'language': 'vi', 'segments': [
            {'start': 0, 'end': 5, 'text': 'Đây là cảnh cuối phim “Găng tay đỏ” đó', 'words': []}]}
        literal = 'Võ sĩ mang găng tay đỏ bước lên sàn đấu rồi tung cú đấm cuối cùng thật mạnh mẽ.'
        good = 'Cảnh cuối bộ phim Găng tay đỏ, võ sĩ bước lên sàn đấu rồi tung cú đấm cuối thật mạnh mẽ.'
        copy = {'title': 'Cảnh cuối Găng tay đỏ', 'description': 'Cảnh cuối bộ phim Găng tay đỏ. Xem ngay nhé!',
                'viral_hook_text': 'Cú đấm cuối của Găng tay đỏ'}
        fake, calls = provider(answer(literal, **copy), answer(good, **copy))
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(transcript, 'auto', [], 5, narration=True)
        self.assertEqual(len(calls), 2)
        self.assertIn('narration: Proper noun or title "Găng tay đỏ"', calls[1])
        self.assertEqual(content['narration']['text'], good)

    def test_overlong_narration_is_trimmed_on_sentence_boundary(self):
        sentence = 'Mình rót cà phê rồi thêm kem muối thật đều tay.'
        fake, _ = provider(answer(' '.join([sentence] * 12)))
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(TRANSCRIPT, 'auto', [], 10, narration=True)
        self.assertLessEqual(content['narration']['syllables'], hook_decisions.narration_budget(10)['high'])
        self.assertTrue(content['narration']['text'].endswith('.'))
        self.assertIn('Narration trimmed at a sentence boundary to fit the clip duration', content['warnings'])

    def test_long_clip_narration_respects_tts_character_limit(self):
        budget = hook_decisions.narration_budget(600)
        self.assertTrue(budget['capped'])
        self.assertLessEqual(budget['high'] * 5, hook_decisions.MAX_NARRATION_CHARS)

    def test_selection_rationale_is_written_and_kept(self):
        fake, calls = provider(answer(selection_rationale='Clip mở bằng thao tác rót cà phê và chốt bằng công thức 3 thìa muối.'))
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(TRANSCRIPT, 'auto', [], 10, selection={'why': 'Công thức rõ ràng'})
        self.assertIn('Selector note (verify, do not copy blindly): Công thức rõ ràng', calls[0])
        self.assertIn('3 thìa muối', content['selectionRationale'])
        self.assertEqual(content['selection'], {'why': 'Công thức rõ ràng'})

    def test_picker_copy_becomes_content_without_ai_call(self):
        item = {'title': 'Cà phê muối', 'hook': 'Thử ngay', 'selection': {
            'why': 'Có công thức cụ thể', 'video_description_for_tiktok': 'Pha cà phê muối tại nhà. #caphe #muoi'}}
        content = hook_decisions.content_from_selection(item, 'vi')
        self.assertEqual(content['description'], 'Pha cà phê muối tại nhà.')
        self.assertEqual(content['hashtags'], ['#caphe', '#muoi'])
        self.assertEqual(content['selectionRationale'], 'Có công thức cụ thể')

    def test_plans_keep_selector_rationale(self):
        class Provider:
            def request(self, prompt, schema, *args):
                if schema['title'] == 'ScoreResponse':
                    return {'windows': [{'id': 'window_001', 'start': 0, 'end': 2, 'score': 90, 'reason': 'clear'}]}
                return {'shorts': [{'start': .2, 'end': 1.4, 'source_window_id': 'window_001', 'predicted_score': 90,
                    'video_description_for_tiktok': 'mô tả #a', 'video_description_for_instagram': 'mô tả',
                    'video_title_for_youtube_short': 'Tiêu đề', 'viral_hook_text': 'Hook', 'why': 'Vì có payoff'}]}
        transcript = {'language': 'vi', 'segments': [{'start': 0, 'end': 1.5, 'text': ' '.join(str(i) for i in range(15)) + '.',
            'words': [{'word': str(i) + ('.' if i == 14 else ''), 'start': i * .1, 'end': (i + 1) * .1} for i in range(15)]}]}
        ai_provider.configure(Provider())
        try:
            with patch.dict(os.environ, {}, clear=False):
                plans = pipeline._plans({'operation': 'clips', 'selection': {'count': 1, 'minSeconds': .5, 'maxSeconds': 2}},
                                        None, {'duration': 2}, transcript)
        finally:
            ai_provider.configure(None)
        self.assertEqual(plans[0]['selection']['why'], 'Vì có payoff')
        self.assertEqual(plans[0]['selection']['predicted_score'], 90)


if __name__ == '__main__':
    unittest.main()


class ClipHookPatternTests(unittest.TestCase):
    def test_clip_content_records_pattern_decision_and_offers_tutorial_patterns(self):
        cands = [{'text': 'Cà phê muối chỉ với 3 thìa muối', 'pattern_id': 26, 'curiosity': 4,
                  'specificity': 5, 'truthfulness': 5, 'fit': 4}]
        fake, calls = provider(answer(hook_pattern_id=26, hook_candidates=cands))
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(TRANSCRIPT, 'screencast', [], 10)
        self.assertIn('hook_candidates', calls[0])
        self.assertIn('[Cách Làm Ngay]', calls[0])
        decision = content['grounding']['hookDecision']
        self.assertEqual((decision['contentKind'], decision['patternId']), ('tutorial', 26))
        self.assertEqual(decision['pattern']['category'], 'Cách Làm Ngay')
        self.assertEqual(hook_decisions.hook_receipt(content)['hookDecision']['patternId'], 26)

    def test_unoffered_pattern_id_is_not_attributed(self):
        fake, _ = provider(answer(hook_pattern_id=99))
        with patch('ai_provider.current', return_value=fake):
            content = hook_decisions.clip_content(TRANSCRIPT, 'screencast', [], 10)
        self.assertIsNone(content['grounding']['hookDecision']['patternId'])
