"""Hook evidence excludes timing metadata and fabricated numeric claims."""
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import hook_decisions


class HookDecisionsTests(unittest.TestCase):
    def test_silent_footage_rejects_episode_clock_and_uses_vietnamese(self):
        calls = []
        def request(prompt, *args):
            calls.append(prompt)
            text = 'Episode 46:22' if len(calls)==1 else 'Cuộc trò chuyện bên bờ biển'
            return {'on_screen':'Hai người bên biển', 'viral_hook_text':text,
                    'video_title_for_youtube_short':text}
        with patch('ai_provider.current',return_value=SimpleNamespace(request=request)):
            hook, receipt = hook_decisions.generate({'language':'und','segments':[]}, 'auto', '', [])
        self.assertEqual(hook, 'Cuộc trò chuyện bên bờ biển')
        self.assertEqual(receipt['language'], 'vi')
        self.assertEqual(len(receipt['rejected']), 1)
        self.assertNotIn('keep the strongest concrete fact', calls[0])

    def test_wrong_hook_cannot_publish_after_retry(self):
        provider = SimpleNamespace(request=lambda *args: {
            'on_screen':'Interview','viral_hook_text':'Episode 46:22',
            'video_title_for_youtube_short':'Interview'})
        with patch('ai_provider.current',return_value=provider):
            with self.assertRaisesRegex(ValueError,'Hook grounding failed'):
                hook_decisions.generate({'segments':[]}, 'auto', '', [])

    def test_spoken_numeric_claim_and_real_screen_fact_are_allowed(self):
        self.assertIsNone(hook_decisions.rejection('Tiết kiệm 30%', 'Tiết kiệm 30%', False))
        self.assertIsNotNone(hook_decisions.rejection('Tiết kiệm 30%', '', False))
        self.assertIsNone(hook_decisions.rejection('Chọn 3 cột', '', True))
        self.assertIsNotNone(hook_decisions.rejection('Episode 46:22', '', True))


class HookPatternTests(unittest.TestCase):
    def test_library_has_100_structured_patterns(self):
        guidance, patterns = hook_decisions.hook_library()
        self.assertEqual([p['id'] for p in patterns], list(range(1, 101)))
        for p in patterns:
            self.assertTrue(p['group'] and p['category'] and p['template'] and p['useWhen'])
            self.assertIsInstance(p['requiresRealClaim'], bool)
        self.assertTrue(next(p for p in patterns if p['id'] == 21)['requiresRealClaim'])
        self.assertTrue(next(p for p in patterns if p['id'] == 14)['requiresRealClaim'])
        categories = {p['category'] for p in patterns}
        for kind in guidance['kinds'].values():
            self.assertTrue(set(kind['categories']) <= categories)

    def test_subset_matches_content_kind(self):
        tutorial = {p['category'] for p in hook_decisions.select_patterns('tutorial')}
        self.assertEqual(tutorial, {'Cách Làm Ngay', 'Kết Quả Rõ'})
        product = hook_decisions.select_patterns('product')
        self.assertTrue(all(p['group'] == 'Hook Review Affiliate' for p in product))
        self.assertLessEqual(len(product), 10)
        self.assertEqual(hook_decisions.content_kind({'segments': []}, 'screencast'), 'tutorial')
        dialogue = {'segments': [{'text': 'a', 'speaker': 0}, {'text': 'b', 'speaker': 1}]}
        self.assertEqual(hook_decisions.content_kind(dialogue, 'auto'), 'story')

    def test_generate_offers_patterns_rejects_verbatim_template_and_keeps_candidates(self):
        calls = []
        candidates = [{'text': 'Hai người cãi nhau vì một tách trà', 'pattern_id': 1, 'curiosity': 4,
                       'specificity': 4, 'truthfulness': 5, 'fit': 5}]
        def request(prompt, *args):
            calls.append(prompt)
            text = 'Bạn sẽ không tin chuyện gì vừa xảy ra với mình...' if len(calls) == 1 else candidates[0]['text']
            return {'on_screen': 'Hai người', 'viral_hook_text': text, 'video_title_for_youtube_short': text,
                    'hook_pattern_id': 1, 'hook_candidates': candidates}
        transcript = {'language': 'vi', 'segments': [{'text': 'trà', 'speaker': 0}, {'text': 'không', 'speaker': 1}]}
        with patch('ai_provider.current', return_value=SimpleNamespace(request=request)):
            hook, receipt = hook_decisions.generate(transcript, 'auto', '', [])
        self.assertIn('HOOK PATTERNS', calls[0])
        self.assertIn('P1 [Mở Vòng Lặp]', calls[0])
        self.assertIn('never copy a template line verbatim', calls[0].replace('Never', 'never'))
        self.assertIn('template verbatim', receipt['rejected'][0]['reason'])
        self.assertEqual(hook, candidates[0]['text'])
        decision = receipt['hookDecision']
        self.assertEqual(decision['contentKind'], 'story')
        self.assertEqual(decision['patternId'], 1)
        self.assertEqual(decision['candidates'][0]['scores']['truthfulness'], 5)
