"""Analysis reports each long step as its own stage with monotonic progress."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / 'packages/openshorts-engine'
sys.path[:0] = [str(PACKAGE / 'src'), str(PACKAGE / 'core')]
import analysis
import pipeline
import transcribe_backends


class AnalysisProgressTest(unittest.TestCase):
    def run_analysis(self, request, transcript, plans=None, **patches):
        def fake_asr(source, info, needed, window=None):
            # The real backends drive _TranscribeProgress while materializing segments.
            progress = transcribe_backends._TranscribeProgress(10)
            for position in (2, 5, 10):
                progress.update(position)
            return transcript

        events = []
        info = {'duration': 10.0, 'audio': True, 'width': 1920, 'height': 1080}
        selection = [{'segments': [{'start': 0, 'end': 5}], 'title': 'A'},
                     {'segments': [{'start': 5, 'end': 10}], 'title': 'B'}]
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(analysis.checkpoints, 'load', return_value=None), \
                mock.patch.object(analysis.checkpoints, 'save'), \
                mock.patch.object(analysis.rendering, 'probe', return_value=info), \
                mock.patch.object(analysis.timelines, 'scenes', **patches.get('scenes', {'return_value': []})), \
                mock.patch.object(analysis.timelines, 'rebase_scenes', return_value=[]), \
                mock.patch.object(analysis, 'validate_plan'), \
                mock.patch.object(analysis, 'effects', **patches.get('effects', {'return_value': []})), \
                mock.patch.object(analysis, 'frames_for_segments', return_value=[]), \
                mock.patch.object(analysis.hook_decisions, 'clip_content',
                                  **patches.get('clip_content', {'side_effect': ValueError('offline')})), \
                mock.patch.object(analysis.hook_decisions, 'generate', return_value=('Hook', None)), \
                mock.patch.object(analysis.hook_decisions, 'content_from_selection', return_value=None), \
                mock.patch.object(pipeline, '_transcript', side_effect=fake_asr), \
                mock.patch.object(pipeline, '_plans', **patches.get('plan_fn', {'return_value': selection})), \
                mock.patch.object(pipeline, '_layout', return_value='general'):
            plan = analysis.analyze(request, Path(directory) / 'source.mp4', Path(directory), events.append, 'src', 'eng')
        if plans is not None:
            plans.append(plan)
        return events

    def test_clip_analysis_stages_are_granular_and_monotonic(self):
        request = {'operation': 'clips', 'aspectRatio': '9:16', 'layout': 'auto', 'hook': {'enabled': True},
                   'captions': {'enabled': True}, 'audio': {'mode': 'keep'},
                   'selection': {'count': 2, 'minSeconds': 5, 'maxSeconds': 5}}
        events = self.run_analysis(request, {'segments': [], 'language': 'vi'})
        stages = [event['stage'] for event in events]
        self.assertEqual(stages[:6], ['probing', 'detecting-scenes', 'transcribing', 'transcribing', 'transcribing', 'transcribing'])
        asr = [event['progress'] for event in events if event['stage'] == 'transcribing']
        self.assertEqual(asr, [6, 10, 16, 26])
        self.assertIsNone(transcribe_backends.progress_listener)
        self.assertEqual(stages[6:8], ['selecting-moments', 'planning-layout'])
        self.assertIn('writing-content', stages)
        self.assertIn('writing-hook', stages)
        self.assertEqual(stages[-1], 'saving-plan')
        progress = [event['progress'] for event in events]
        self.assertEqual(progress, sorted(progress))
        self.assertLess(progress[-1], 40)

    def test_edit_without_asr_skips_transcribing(self):
        request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': False},
                   'captions': {'enabled': False}, 'audio': {'mode': 'keep'}}
        stages = [event['stage'] for event in self.run_analysis(request, {'segments': [], 'language': 'und'})]
        self.assertEqual(stages, ['probing', 'detecting-scenes', 'planning-cuts', 'planning-layout', 'saving-plan'])

    def test_revision_reuses_parent_scenes_and_repaired_transcript(self):
        import asr_identity
        runtime = asr_identity.current()
        transcript = {'language': 'vi', 'segments': [{'start': 0, 'end': 4, 'text': 'xin chào.',
                      'words': [{'word': 'xin', 'start': 0, 'end': 1}, {'word': 'chào.', 'start': 1, 'end': 2}]}],
                      'asr': {'runtime': runtime, 'repair': {'edits': [], 'failedChunks': 0}}}
        parent = {'sourceFingerprint': 'src', 'engineFingerprint': 'eng', 'asrRuntime': runtime,
                  'media': {'duration': 10.0}, 'scenes': [{'startSeconds': 0, 'endSeconds': 10.0}],
                  'transcript': transcript}
        request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': False},
                   'captions': {'enabled': True}, 'audio': {'mode': 'keep'}, 'parentAnalysis': parent,
                   'segments': [{'startSeconds': 0, 'endSeconds': 4}]}
        plans = []
        with mock.patch('asr_repair.repair_source', side_effect=AssertionError('repair must not run')):
            events = self.run_analysis(request, None, plans)
        stages = [event['stage'] for event in events]
        self.assertEqual(stages[:3], ['probing', 'reusing-parent-analysis', 'planning-cuts'])
        self.assertNotIn('transcribing', stages)
        self.assertNotIn('repairing-transcript', stages)
        self.assertEqual(plans[0]['transcript'], transcript)
        self.assertEqual(plans[0]['scenes'], parent['scenes'])
        self.assertEqual(plans[0]['analysisReuse'], {'scenes': True, 'transcript': True})

    def test_combined_effects_are_saved_without_second_planner_call(self):
        def content(*args, **kwargs):
            self.assertEqual(kwargs['effects_brief'], 'x')
            return {'source': 'agy-grounded', 'title': 'T', 'hook': 'H',
                    'warnings': ['w', 'w'], 'effects': []}
        request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general',
                   'hook': {'enabled': True}, 'captions': {'enabled': False},
                   'audio': {'mode': 'keep'}, 'designBrief': 'x'}
        plans = []
        with mock.patch.object(analysis.hook_decisions, 'hook_receipt', return_value={}):
            self.run_analysis(request, {'segments': [], 'language': 'und'}, plans,
                              clip_content={'side_effect': content},
                              effects={'side_effect': AssertionError('duplicate planner')})
        for clip in plans[0]['clips']:
            self.assertEqual((clip['title'], clip['hook']), ('T', 'H'))
            self.assertEqual(clip['effects'], [])
            self.assertNotIn('effects', clip['content'])
        self.assertEqual(plans[0]['warnings'].count('w'), 1)

    def test_explicit_effects_and_disabled_hook_keep_standalone_path(self):
        for explicit, enabled in (([], True), (None, False)):
            def content(*args, **kwargs):
                self.assertIsNone(kwargs['effects_brief'])
                return {'source': 'agy-grounded', 'title': 'T', 'hook': 'H', 'warnings': []}
            request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general',
                       'hook': {'enabled': enabled}, 'captions': {'enabled': False},
                       'audio': {'mode': 'keep'}, 'designBrief': 'x', 'effects': explicit}
            planner = mock.Mock(return_value=[])
            with mock.patch.object(analysis.hook_decisions, 'hook_receipt', return_value={}):
                self.run_analysis(request, {'segments': []}, clip_content={'side_effect': content},
                                  effects={'side_effect': planner})
            self.assertEqual(planner.call_count, 2)

    def test_content_failure_retains_effect_planning(self):
        request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general',
                   'hook': {'enabled': True}, 'captions': {'enabled': False},
                   'audio': {'mode': 'keep'}, 'designBrief': 'x'}
        planner = mock.Mock(return_value=[])
        events = self.run_analysis(request, {'segments': []}, effects={'side_effect': planner})
        self.assertEqual(planner.call_count, 2)
        self.assertIn('planning-effects', [event['stage'] for event in events])


    def spoken(self):
        words = [(' Tôi', 0, .5), (' kể', .5, 1), (' chuyện', 1, 1.5), (' đống', 1.5, 2, .3), (' phim', 2, 2.5),
                 (' Rất', 2.85, 3.3), (' vui', 3.3, 3.8), (' khi', 3.8, 4.3), (' làm', 4.3, 4.8), (' việc.', 4.8, 5.3),
                 (' Hết', 6, 6.5), (' rồi.', 6.5, 7)]
        return {'language': 'vi', 'segments': [{'start': 0, 'end': 7, 'text': ''.join(w[0] for w in words), 'words': [
            {'word': w[0], 'start': w[1], 'end': w[2], 'probability': w[3] if len(w) > 3 else .9} for w in words]}]}

    def test_parallel_selection_overlaps_repair_and_fits_repaired_words(self):
        import ai_provider, asr_repair, moment_picker, threading
        selected, fitted = threading.Event(), []
        def repair(transcript, source, info, request, **kwargs):
            # Only finishes once moment selection has started: proves the overlap.
            self.assertTrue(selected.wait(5))
            words = transcript['segments'][0]['words']
            words[3]['word'], words[4]['word'] = ' đóng', ' phim.'
            transcript.setdefault('asr', {})['repair'] = {'edits': [{'i': 3, 'from': 'đống', 'to': 'đóng',
                                                                      'start': 1.5, 'end': 2}], 'failedChunks': 0}
            return ['repair note']
        def pick(transcript, duration):
            self.assertEqual(transcript['segments'][0]['words'][3]['word'], ' đống')  # unrepaired copy
            selected.set()
            return {'shorts': [{'start': 0, 'end': 5.3, 'video_title_for_youtube_short': 'Chuyện đống phim',
                                'viral_hook_text': 'Đống phim', 'why': 'kể đống phim', 'predicted_score': 80}]}
        real_fit = analysis.timelines.fit_selection
        def fit(segment, transcript, *args, **kwargs):
            fitted.append(''.join(w['word'] for w in transcript['segments'][0]['words']))
            # The final fit (after repair) offers the unrepaired copy as a fallback unit source;
            # the speculative fit before it runs on that copy alone.
            if kwargs.get('alternates'):
                self.assertEqual([t['segments'][0]['words'][3]['word'] for t in kwargs['alternates']], [' đống'])
            return real_fit(segment, transcript, *args, **kwargs)
        request = {'operation': 'clips', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': False},
                   'captions': {'enabled': True}, 'audio': {'mode': 'keep'},
                   'selection': {'count': 1, 'minSeconds': 3, 'maxSeconds': 6, 'prompt': ''}}
        plans = []
        ai_provider.configure(mock.Mock())
        with mock.patch.dict('os.environ', {'AGY_MCP_WORKER_CONCURRENCY': '2'}), \
                mock.patch.object(asr_repair, 'repair_source', side_effect=repair), \
                mock.patch.object(moment_picker, 'get_viral_clips', side_effect=pick), \
                mock.patch.object(analysis.timelines, 'fit_selection', side_effect=fit):
            self.run_analysis(request, self.spoken(), plans, plan_fn={'side_effect': pipeline._plans})
        plan = plans[0]
        self.assertIn('đống phim', fitted[0])  # speculative fit on the unrepaired copy
        self.assertIn('đóng phim.', fitted[-1])  # final sentence units fitted on the repaired words
        self.assertEqual(plan['transcript']['segments'][0]['words'][3]['word'], ' đóng')
        self.assertEqual(plan['clips'][0]['title'], 'Chuyện đóng phim')
        self.assertEqual(plan['warnings'][:2], ['repair note', 'ASR has 1 low-confidence words; review transcript before publishing'])

    def clips_with_content(self, fit_end):
        """Clips + generated hook at concurrency 2; `fit_end(repaired)` is the fitted clip end."""
        import ai_provider, asr_repair, moment_picker, threading
        written, calls = threading.Event(), []
        def repair(transcript, source, info, request, **kwargs):
            self.assertTrue(written.wait(5))  # finishes only after clip content started: the overlap
            transcript['segments'][0]['words'][3]['word'] = ' đóng'
            transcript.setdefault('asr', {})['repair'] = {'edits': [{'i': 3, 'from': 'đống', 'to': 'đóng',
                                                                      'start': 1.5, 'end': 2}], 'failedChunks': 0}
            return ['repair note']
        def pick(transcript, duration):
            return {'shorts': [{'start': 0, 'end': 5.3, 'video_title_for_youtube_short': 'Chuyện đống phim',
                                'viral_hook_text': 'Đống phim', 'why': 'kể đống phim', 'predicted_score': 80}]}
        def fit(segment, transcript, *args, **kwargs):
            repaired = any(w['word'] == ' đóng' for w in transcript['segments'][0]['words'])
            return {'start': 0, 'end': fit_end(repaired)}, True, None
        def content(virtual, *args, **kwargs):
            spoken = next(w['word'].strip() for s in virtual['segments'] for w in s['words']
                          if w['word'].strip() in ('đống', 'đóng'))
            calls.append(spoken)
            written.set()
            return {'source': 'agy-grounded', 'title': 'Chuyện %s phim' % spoken, 'hook': '%s phim' % spoken.capitalize(),
                    'description': 'Kể chuyện %s phim.' % spoken, 'postText': 'Kể chuyện %s phim.' % spoken,
                    'narration': None, 'selectionRationale': 'kể %s phim' % spoken, 'grounding': {}, 'warnings': []}
        request = {'operation': 'clips', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': True},
                   'captions': {'enabled': True}, 'audio': {'mode': 'keep'},
                   'selection': {'count': 1, 'minSeconds': 3, 'maxSeconds': 6, 'prompt': ''}}
        plans = []
        ai_provider.configure(mock.Mock())
        with mock.patch.dict('os.environ', {'AGY_MCP_WORKER_CONCURRENCY': '2'}), \
                mock.patch.object(asr_repair, 'repair_source', side_effect=repair), \
                mock.patch.object(moment_picker, 'get_viral_clips', side_effect=pick) as picker, \
                mock.patch.object(analysis.timelines, 'fit_selection', side_effect=fit):
            self.run_analysis(request, self.spoken(), plans, clip_content={'side_effect': content},
                              plan_fn={'side_effect': pipeline._plans})
        self.assertEqual(picker.call_count, 1)  # the re-fit reuses the one moment selection
        return plans[0], calls

    def test_clip_content_overlaps_repair_and_carries_its_edits(self):
        plan, calls = self.clips_with_content(lambda repaired: 5.3)
        self.assertEqual(calls, ['đống'])  # written once, from the unrepaired copy
        clip = plan['clips'][0]
        self.assertEqual(clip['segments'], [{'startSeconds': 0, 'endSeconds': 5.3}])
        self.assertEqual((clip['title'], clip['hook']), ('Chuyện đóng phim', 'Đóng phim'))
        self.assertEqual([clip['content'][key] for key in ('title', 'description', 'postText', 'selectionRationale')],
                         ['Chuyện đóng phim', 'Kể chuyện đóng phim.', 'Kể chuyện đóng phim.', 'kể đóng phim'])
        self.assertEqual(plan['transcript']['segments'][0]['words'][3]['word'], ' đóng')
        self.assertEqual(plan['warnings'][0], 'repair note')

    def test_clip_content_is_rewritten_when_the_repaired_fit_moves_a_cut(self):
        plan, calls = self.clips_with_content(lambda repaired: 5.3 if repaired else 4.8)
        self.assertEqual(calls, ['đống', 'đóng'])  # speculative clip work discarded, written again
        clip = plan['clips'][0]
        self.assertEqual(clip['segments'], [{'startSeconds': 0, 'endSeconds': 5.3}])
        self.assertEqual(clip['title'], 'Chuyện đóng phim')

    def test_sequential_owner_repairs_before_selection(self):
        import ai_provider, asr_repair, moment_picker
        order = []
        def repair(transcript, *args, **kwargs):
            order.append('repair'); self.assertIsNone(kwargs.get('ranges')); return []
        def pick(transcript, duration):
            order.append('select')
            return {'shorts': [{'start': 0, 'end': 5.3, 'video_title_for_youtube_short': 'T'}]}
        request = {'operation': 'clips', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': False},
                   'captions': {'enabled': True}, 'audio': {'mode': 'keep'},
                   'selection': {'count': 1, 'minSeconds': 3, 'maxSeconds': 6, 'prompt': ''}}
        ai_provider.configure(mock.Mock())
        with mock.patch.dict('os.environ', {'AGY_MCP_WORKER_CONCURRENCY': '1'}), \
                mock.patch.object(asr_repair, 'repair_source', side_effect=repair), \
                mock.patch.object(moment_picker, 'get_viral_clips', side_effect=pick):
            self.run_analysis(request, self.spoken(), plan_fn={'side_effect': pipeline._plans})
        self.assertEqual(order, ['repair', 'select'])

    def test_edit_segments_scope_the_repair(self):
        import asr_repair
        seen = []
        def repair(transcript, source, info, request, **kwargs):
            seen.append(kwargs.get('ranges')); return []
        for segments, expected in (([{'startSeconds': 1, 'endSeconds': 3}], [{'start': 1, 'end': 3}]), (None, None)):
            request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': False},
                       'captions': {'enabled': True}, 'audio': {'mode': 'keep'},
                       **({'segments': segments} if segments else {})}
            with mock.patch.object(asr_repair, 'repair_source', side_effect=repair):
                self.run_analysis(request, self.spoken())
            self.assertEqual(seen.pop(), expected)

    def edit_with_content(self, concurrency):
        """Edit + generated hook: returns (plan, order of repair/content starts)."""
        import ai_provider, asr_repair, threading
        written, order = threading.Event(), []
        def repair(transcript, source, info, request, **kwargs):
            order.append('repair')
            if concurrency > 1:
                self.assertTrue(written.wait(5))  # finishes only after content started: proves the overlap
            words = transcript['segments'][0]['words']
            words[3]['word'] = ' đóng'
            transcript.setdefault('asr', {})['repair'] = {'edits': [{'i': 3, 'from': 'đống', 'to': 'đóng',
                                                                      'start': 1.5, 'end': 2}], 'failedChunks': 0}
            return ['repair note']
        def content(virtual, *args, **kwargs):
            order.append('content')
            # The edit's start snaps past the edge-touching first word, so find the word by text.
            spoken = next(w['word'].strip() for s in virtual['segments'] for w in s['words']
                          if w['word'].strip() in ('đống', 'đóng'))
            if concurrency > 1:
                self.assertEqual(spoken, 'đống')  # unrepaired copy
            written.set()
            return {'source': 'agy-grounded', 'title': 'Chuyện %s phim' % spoken, 'hook': '%s phim' % spoken.capitalize(),
                    'description': 'Kể chuyện %s phim.' % spoken, 'postText': 'Kể chuyện %s phim.' % spoken,
                    'narration': {'text': 'Tôi kể chuyện %s phim.' % spoken}, 'selectionRationale': None,
                    'grounding': {}, 'warnings': []}
        request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': True},
                   'captions': {'enabled': True}, 'audio': {'mode': 'keep'}, 'segments': [{'startSeconds': 0, 'endSeconds': 7}]}
        plans = []
        ai_provider.configure(mock.Mock())
        with mock.patch.dict('os.environ', {'AGY_MCP_WORKER_CONCURRENCY': str(concurrency)}), \
                mock.patch.object(asr_repair, 'repair_source', side_effect=repair):
            self.run_analysis(request, self.spoken(), plans, clip_content={'side_effect': content},
                              plan_fn={'side_effect': pipeline._plans})
        return plans[0], order

    def test_edit_content_overlaps_repair_and_carries_its_edits(self):
        plan, order = self.edit_with_content(2)
        self.assertCountEqual(order, ['repair', 'content'])
        self.assertEqual(plan['transcript']['segments'][0]['words'][3]['word'], ' đóng')
        clip = plan['clips'][0]
        self.assertEqual(clip['title'], 'Chuyện đóng phim')
        self.assertEqual(clip['hook'], 'Đóng phim')
        self.assertEqual([clip['content'][key] for key in ('title', 'description', 'postText')],
                         ['Chuyện đóng phim', 'Kể chuyện đóng phim.', 'Kể chuyện đóng phim.'])
        self.assertEqual(clip['content']['narration']['text'], 'Tôi kể chuyện đóng phim.')
        self.assertEqual(plan['warnings'][0], 'repair note')

    def test_sequential_owner_repairs_before_edit_content(self):
        plan, order = self.edit_with_content(1)
        self.assertEqual(order, ['repair', 'content'])
        self.assertEqual(plan['clips'][0]['title'], 'Chuyện đóng phim')

    def test_scene_detection_overlaps_asr(self):
        import threading
        started = threading.Event()
        def scenes(source, info):
            started.set(); return [{'startSeconds': 0, 'endSeconds': 10.0}]
        request = {'operation': 'edit', 'aspectRatio': '9:16', 'layout': 'general', 'hook': {'enabled': False},
                   'captions': {'enabled': False}, 'audio': {'mode': 'keep'}}
        plans = []
        self.run_analysis(request, {'segments': [], 'language': 'und'}, plans, scenes={'side_effect': scenes})
        self.assertTrue(started.is_set())
        self.assertEqual(plans[0]['scenes'], [{'startSeconds': 0, 'endSeconds': 10.0}])


if __name__ == '__main__':
    unittest.main()
