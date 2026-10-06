"""Run: python3 -m unittest discover -s tests/openshorts -p 'test_*.py'."""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / 'packages/openshorts-engine'
sys.path[:0] = [str(PACKAGE / 'src'), str(PACKAGE / 'core')]
import ai_provider
import contracts
import rendering
import recut
import edit_builder
import timelines
import checkpoints
import shutil
import os
from unittest.mock import patch
import pipeline
import analysis
import reframe_v2


class Feed:
    def __init__(self): self.lines = queue.Queue()
    def __iter__(self): return self
    def __next__(self):
        value = self.lines.get()
        if value is None: raise StopIteration
        return value


class ContractTests(unittest.TestCase):
    def test_scene_indices_survive_dropped_empty_crop_ranges(self):
        ranges=reframe_v2.scene_frame_ranges([(0,0),(0,10),(10,10),(10,25)],['TRACK']*4,20,include_index=True)
        self.assertEqual(ranges,[(1,0,10,'TRACK'),(3,10,20,'TRACK')])
        with self.assertRaisesRegex(ValueError,'crop scene index'):
            reframe_v2.apply_crop_overrides([0]*10,['TRACK'],[(0,10)],{'1':.5},100,320)
    def test_native_ai_failure_is_reported_instead_of_no_clip_selection(self):
        import moment_picker
        with patch.object(moment_picker.llm_backend, 'active', return_value=True), \
             patch.object(moment_picker.llm_backend, 'base_url', return_value='native-job-rpc://agy-mcp'), \
             patch.object(moment_picker.llm_backend, 'model_name', return_value='agy-mcp'), \
             patch.object(moment_picker, 'build_transcript_windows', side_effect=RuntimeError('native authentication unavailable')):
            with self.assertRaisesRegex(RuntimeError, 'AGY MCP clip analysis failed: native authentication unavailable'):
                moment_picker.get_viral_clips({'language':'vi','segments':[]}, 18)

    def test_rejects_nonfinite_and_out_of_bounds_segments(self):
        for value in [float('nan'), float('inf'), -1, 4]:
            with self.assertRaises(ValueError):
                contracts.segments([{'startSeconds': value, 'endSeconds': 3}], 3)

    def test_transcript_rebase_keeps_vietnamese_words(self):
        source = {'language': 'vi', 'segments': [{'words': [
            {'word': ' Xin', 'start': 3, 'end': 3.4},
            {'word': ' chào', 'start': 3.4, 'end': 4}]}]}
        result = recut.virtual_transcript(source, [{'start': 3, 'end': 4}])
        self.assertEqual(result['segments'][0]['text'], 'Xin chào')
        self.assertEqual(result['segments'][0]['words'][0]['start'], 0)

    def test_zoom_builder_cannot_crop_existing_captions(self):
        vf, effects = edit_builder.build_filter_string([
            {'type': 'punch_in', 'start': 0, 'end': 1, 'strength': 0.9}],
            duration=2, fps=30, width=320, height=180, has_captions=True)
        self.assertFalse(vf)
        self.assertEqual(effects, [])

    def test_all_ai_modules_use_local_bridge(self):
        for name in ['main','moment_picker','layout_picker','screencast_layout','hook_grounding','editor','gemini_worker']:
            text = (PACKAGE / 'core' / (name + '.py')).read_text()
            self.assertNotIn('from google', text)
            self.assertNotIn('os.getenv("GEMINI_API_KEY")', text)
        import agy_compat
        ai_provider.configure(None)
        with self.assertRaisesRegex(RuntimeError, 'not configured'):
            agy_compat.Client(api_key='ignored')

    def test_real_moment_picker_uses_native_bridge_and_complete_sentences(self):
        calls=[]
        class Provider:
            def request(self,prompt,schema,*args):
                calls.append(schema['title'])
                if schema['title']=='ScoreResponse':
                    return {'windows':[{'id':'window_001','start':0,'end':2,'score':90,'reason':'clear'}]}
                return {'shorts':[{'start':.2,'end':1.4,'source_window_id':'window_001','predicted_score':90,
                    'video_description_for_tiktok':'test','video_description_for_instagram':'test',
                    'video_title_for_youtube_short':'Title','viral_hook_text':'Hook'}]}
        transcript={'language':'en','segments':[{'start':0,'end':1.5,'text':' '.join(str(i) for i in range(15))+'.',
            'words':[{'word':str(i)+('.' if i==14 else ''),'start':i*.1,'end':(i+1)*.1} for i in range(15)]}]}
        ai_provider.configure(Provider())
        with patch.dict(os.environ,{},clear=False):
            result=pipeline._plans({'operation':'clips','selection':{'count':1,'minSeconds':.5,'maxSeconds':2}},None,{'duration':2},transcript)
        # One window <= shortlist target: the score pass cannot change the detail input.
        self.assertEqual(calls,['DetailResponse'])
        self.assertEqual(result[0]['segments'],[{'start':0,'end':1.6}])

    def test_score_pass_runs_when_windows_exceed_shortlist_and_overlaps_batches(self):
        import moment_picker
        seen, lock, active = [], threading.Lock(), [0, 0]
        class Provider:
            def request(self, prompt, schema, *args):
                with lock:
                    seen.append(schema['title']); active[0] += 1; active[1] = max(active[1], active[0])
                threading.Event().wait(.05)
                with lock:
                    active[0] -= 1
                if schema['title'] == 'ScoreResponse':
                    ids = re.findall(r'"id": "(window_\d+)"', prompt)
                    return {'windows': [{'id': i, 'start': 0, 'end': 1, 'score': 50, 'reason': 'r'} for i in ids]}
                return {'shorts': []}
        segments = [{'start': k * 5.0, 'end': k * 5.0 + 4.5, 'text': 'w%d.' % k,
                     'words': [{'word': 'w%d.' % k, 'start': k * 5.0, 'end': k * 5.0 + 4.5}]} for k in range(120)]
        transcript = {'language': 'en', 'segments': segments}
        ai_provider.configure(Provider())
        env = {'CLIP_TARGET_MIN': '1', 'CLIP_TARGET_MAX': '1', 'CLIP_MIN_SECONDS': '20', 'CLIP_MAX_SECONDS': '40',
               'LLM_SCORE_BATCH': '3', 'AGY_MCP_WORKER_CONCURRENCY': '2'}
        with patch.dict(os.environ, env):
            moment_picker.get_viral_clips(transcript, 600)
        self.assertGreaterEqual(seen.count('ScoreResponse'), 2)
        self.assertEqual(active[1], 2)  # two score batches in flight, never more than the owner runs

    def test_gather_is_sequential_by_default_and_ordered_when_parallel(self):
        order = []
        def call(name, delay):
            def run():
                threading.Event().wait(delay); order.append(name); return name
            return run
        with patch.dict(os.environ, {'AGY_MCP_WORKER_CONCURRENCY': ''}):
            self.assertEqual(ai_provider.gather([call('a', .05), call('b', 0)]), ['a', 'b'])
        self.assertEqual(order, ['a', 'b'])
        order.clear()
        with patch.dict(os.environ, {'AGY_MCP_WORKER_CONCURRENCY': '3'}):
            self.assertEqual(ai_provider.gather([call('a', .1), call('b', 0)]), ['a', 'b'])
        self.assertEqual(order, ['b', 'a'])
        def boom():
            raise ValueError('first failure')
        with patch.dict(os.environ, {'AGY_MCP_WORKER_CONCURRENCY': '2'}):
            with self.assertRaisesRegex(ValueError, 'first failure'):
                ai_provider.gather([call('a', 0), boom])

    def test_parent_analysis_is_reused_only_when_provably_identical(self):
        import asr_identity
        runtime = asr_identity.current()
        transcript = {'language': 'vi', 'segments': [{'start': 0, 'end': 1, 'text': 'x',
                      'words': [{'word': 'x', 'start': 0, 'end': 1}]}],
                      'asr': {'runtime': runtime, 'repair': {'edits': [], 'failedChunks': 0}}}
        parent = {'sourceFingerprint': 's', 'engineFingerprint': 'e', 'asrRuntime': runtime,
                  'media': {'duration': 10.0}, 'scenes': [{'startSeconds': 0, 'endSeconds': 10.0}],
                  'transcript': transcript}
        info = {'duration': 10.0}
        found = analysis.parent_analysis({'parentAnalysis': parent}, 's', 'e', info)
        self.assertEqual(found['transcript'], transcript)
        self.assertIsNot(found['transcript'], transcript)
        self.assertIsNone(analysis.parent_analysis({'parentAnalysis': parent}, 'other', 'e', info))
        self.assertIsNone(analysis.parent_analysis({'parentAnalysis': parent}, 's', 'new-engine', info))
        self.assertIsNone(analysis.parent_analysis({'parentAnalysis': {**parent, 'asrRuntime': {}}}, 's', 'e', info))
        self.assertIsNone(analysis.parent_analysis({'parentAnalysis': parent}, 's', 'e', {'duration': 11.0}))
        failed = {**transcript, 'asr': {'runtime': runtime, 'repair': {'failedChunks': 1}}}
        partial = analysis.parent_analysis({'parentAnalysis': {**parent, 'transcript': failed}}, 's', 'e', info)
        self.assertIsNone(partial['transcript'])  # scenes still reused; ASR + repair run again
        self.assertEqual(partial['scenes'], parent['scenes'])
        self.assertIsNone(analysis.parent_analysis({}, 's', 'e', info))
        # A scoped (edit-segment) repair vouches only for its span.
        scoped = {**transcript, 'asr': {'runtime': runtime, 'repair': {'edits': [], 'failedChunks': 0,
                  'scope': {'startSeconds': 0.9, 'endSeconds': 6.6, 'words': 1, 'totalWords': 9}}}}
        base = {'parentAnalysis': {**parent, 'transcript': scoped}, 'operation': 'edit'}
        inside = analysis.parent_analysis({**base, 'segments': [{'startSeconds': 2.5, 'endSeconds': 5}]}, 's', 'e', info)
        self.assertEqual(inside['transcript'], scoped)
        outside = analysis.parent_analysis({**base, 'segments': [{'startSeconds': 1, 'endSeconds': 5}]}, 's', 'e', info)
        self.assertIsNone(outside['transcript'])
        self.assertIsNone(analysis.parent_analysis(base, 's', 'e', info)['transcript'])  # whole source
        # A cut within CUT_SNAP_SECONDS of the scope edge could snap onto unrepaired words.
        near = analysis.parent_analysis({**base, 'segments': [{'startSeconds': 2.5, 'endSeconds': 5.5}]}, 's', 'e', info)
        self.assertIsNone(near['transcript'])

    def test_main_selection_delegates_to_canonical_module(self):
        import ast
        tree = ast.parse((PACKAGE / 'core/main.py').read_text())
        for name in ('get_viral_clips', 'get_visual_clips'):
            node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
            self.assertTrue(any(isinstance(n, ast.ImportFrom) and n.module == 'moment_picker' for n in node.body))

    def test_sentence_selection_never_returns_half_sentence(self):
        transcript={'segments':[{'words':[{'word':' Hello','start':0,'end':.5},
            {'word':' world.','start':.5,'end':1},{'word':' Another','start':1.2,'end':1.7},
            {'word':' thought!','start':1.7,'end':2.5}]}]}
        snapped=timelines.complete_selection({'start':.3,'end':.8},transcript,.5,2,3)
        self.assertEqual(snapped,{'start':0,'end':1.1})
        # Expand-only needed both sentences (too long); the fit keeps the first whole one.
        self.assertEqual(timelines.fit_selection({'start':.3,'end':2},transcript,.5,1,3),
                         ({'start':0,'end':1.1},True,None))

    def test_unpunctuated_short_source_keeps_every_spoken_word(self):
        transcript={'segments':[{'words':[{'word':' Xin','start':.2,'end':.5},
            {'word':' chào','start':.5,'end':1.1}]}]}
        self.assertEqual(timelines.complete_selection({'start':.4,'end':1},transcript,10,18,18),
                         {'start':0,'end':18})
        fitted,complete,warning=timelines.fit_selection({'start':.4,'end':1},transcript,10,18,25)
        self.assertFalse(complete)
        self.assertIn('word pauses',warning)
        self.assertTrue(9.9<=fitted['end']-fitted['start']<=18.1)

    def test_unpunctuated_pauses_bound_sentences(self):
        words=[]
        for index in range(8):
            base=index*5
            words += [{'word':' câu','start':base,'end':base+2},{'word':' dài','start':base+2,'end':base+4.2}]
        transcript={'segments':[{'words':words}]}
        self.assertEqual(timelines.complete_selection({'start':6,'end':24},transcript,15,25,40),
                         {'start':4.9,'end':24.3})

    def test_fit_drops_partial_edge_units_instead_of_failing(self):
        # Two 20 s decoder segments without punctuation: expand-only needed 40 s.
        words=[{'word':' a%d'%i,'start':i*1.0,'end':i+1.0} for i in range(40)]
        transcript={'segments':[{'words':words[:20]},{'words':words[20:]}]}
        fitted,complete,warning=timelines.fit_selection({'start':12,'end':30},transcript,15,30,40)
        self.assertTrue(complete)
        self.assertIsNone(warning)
        self.assertEqual(fitted,{'start':20.0,'end':40})

    def test_vad_silences_split_contiguous_words(self):
        words=[{'word':' w%d'%i,'start':i*1.0,'end':i+1.0} for i in range(30)]
        transcript={'segments':[{'words':words}],
                    'asr':{'segmentation':{'speechRegions':[[0,9.85],[10.15,19.85],[20.15,30]]}}}
        self.assertEqual([(u['start'],u['end']) for u in timelines.sentences(transcript)],
                         [(0,10),(10,20),(20,30)])
        fitted,complete,_=timelines.fit_selection({'start':11,'end':19},transcript,8,12,30)
        self.assertTrue(complete)
        self.assertEqual(fitted,{'start':10.0,'end':20.0})

    def test_fit_prefers_keeping_ai_ending(self):
        words=[{'word':' w%d.'%i,'start':i*3.0,'end':i*3.0+2.5} for i in range(10)]
        transcript={'segments':[{'words':words}]}
        fitted,complete,_=timelines.fit_selection({'start':4,'end':17.5},transcript,8,9,30)
        self.assertTrue(complete)
        self.assertEqual(fitted['end'],17.6)

    def test_exact_duration_band_contract(self):
        import clip_selection
        with patch.dict(os.environ,{'CLIP_MIN_SECONDS':'10','CLIP_MAX_SECONDS':'11','CLIP_BOUNDS_EXACT':'1'}):
            self.assertEqual(clip_selection.clip_duration_bounds(),(10,11))
        with patch.dict(os.environ,{'CLIP_MIN_SECONDS':'10','CLIP_MAX_SECONDS':'11','CLIP_BOUNDS_EXACT':''}):
            self.assertEqual(clip_selection.clip_duration_bounds(),(10,15))

    def test_plans_dedupe_overlaps_and_send_sentence_units(self):
        prompts=[]
        words=[{'word':' w%d%s'%(i,'.' if i%5==4 else ''),'start':i*1.0,'end':i+.9} for i in range(60)]
        transcript={'language':'vi','segments':[{'start':0,'end':60,'text':' '.join(w['word'] for w in words),'words':words}]}
        class Provider:
            def request(self,prompt,schema,*args):
                prompts.append(prompt)
                if schema['title']=='ScoreResponse':
                    return {'windows':[{'id':'window_001','start':0,'end':60,'score':90,'reason':'r'}]}
                clip=lambda a,b:{'start':a,'end':b,'source_window_id':'window_001','predicted_score':80,
                    'video_description_for_tiktok':'t','video_description_for_instagram':'i',
                    'video_title_for_youtube_short':'T','viral_hook_text':'H'}
                return {'shorts':[clip(1,12),clip(8,19),clip(30,41)]}
        ai_provider.configure(Provider())
        with patch.dict(os.environ,{},clear=False):
            result=pipeline._plans({'operation':'clips','selection':{'count':3,'minSeconds':10,'maxSeconds':11}},None,{'duration':60},transcript)
        self.assertEqual(len(result),2)
        self.assertIn('2 non-overlapping clip(s) of 3',result[0]['warnings'][0])
        for plan in result:
            length=plan['segments'][0]['end']-plan['segments'][0]['start']
            self.assertTrue(9.9<=length<=11.1,plan)
            self.assertTrue(plan['sentenceComplete'])
        self.assertIn('[0.00-4.90] w0 w1 w2 w3 w4.',prompts[-1])
        self.assertIn('between 10 and 11 seconds',prompts[-1])

    def test_multisegment_clean_timeline_rebases_words(self):
        canonical=[{'start':10,'end':15},{'start':20,'end':25}]
        mapped=timelines.reuse_segments([{'start':21,'end':24}],canonical)
        self.assertEqual(mapped,[{'start':6,'end':9}])
        self.assertIsNone(timelines.reuse_segments([{'start':14,'end':21}],canonical))

    def test_virtual_transcript_drops_zero_duration_asr_words(self):
        transcript={'language':'vi','segments':[{'words':[{'word':' Xin','start':0.2,'end':0.5},
            {'word':' lỗi','start':0.5,'end':0.5},{'word':' chào','start':0.5,'end':0.9}]}]}
        virtual=recut.virtual_transcript(transcript,[{'start':0,'end':1}])
        self.assertEqual([w['word'] for w in virtual['segments'][0]['words']],[' Xin',' chào'])

    def test_encoder_thread_limit_is_explicit_and_validated(self):
        import ffmpeg_utils
        with patch.dict(os.environ,{'OPENSHORTS_THREADS':'1'}):
            self.assertEqual(ffmpeg_utils.video_encode_args()[-2:],['-threads','1'])
        with patch.dict(os.environ,{'OPENSHORTS_THREADS':'0'}):
            with self.assertRaisesRegex(ValueError,'OPENSHORTS_THREADS'):
                ffmpeg_utils.video_encode_args()

    def test_crop_manifest_serializes_fraction_fps_from_docker(self):
        from fractions import Fraction
        from types import SimpleNamespace
        start=SimpleNamespace(get_frames=lambda:0)
        end=SimpleNamespace(get_frames=lambda:75)
        with patch('scene_detection.detect_scenes',return_value=([(start,end)],Fraction(25,1))), \
             patch('frame_timeline.boundaries',return_value=[i/25 for i in range(76)]):
            manifest=rendering.crop_scenes('fixture.mp4',{'duration':3.0})
        self.assertEqual(json.loads(json.dumps(manifest)),[{'sceneIndex':0,'startSeconds':0.0,'endSeconds':3.0}])

    def test_rpc_matches_out_of_order_responses(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); source = root / 'source.mp4'; source.touch()
            work = root / 'work'; work.mkdir()
            incoming = Feed(); emitted = queue.Queue()
            rpc = ai_provider.JobRpc(source, work, emitted.put, incoming, timeout=2)
            rpc.start_reader()
            with concurrent.futures.ThreadPoolExecutor(2) as executor:
                futures = [executor.submit(rpc.request, p, {'type': 'object'}) for p in ['first','second']]
                messages = [emitted.get(timeout=2), emitted.get(timeout=2)]
                for msg in reversed(messages):
                    incoming.lines.put(json.dumps({'type':'ai-result','requestId':msg['requestId'], 'data':{'prompt':msg['prompt']}}))
                self.assertEqual([f.result()['prompt'] for f in futures], ['first','second'])
            # The selection brief never reaches token repair, which may overlap selection.
            rpc.selection_brief = 'funny parts'
            with concurrent.futures.ThreadPoolExecutor(2) as executor:
                futures = [executor.submit(rpc.request, 'p', {'type': 'object'}, None, role)
                           for role in ('asr-repair', 'content-editor')]
                for _ in futures:
                    msg = emitted.get(timeout=2)
                    incoming.lines.put(json.dumps({'type':'ai-result','requestId':msg['requestId'],
                                                   'data':{'role':msg['role'],'prompt':msg['prompt']}}))
                prompts = {f.result()['role']: f.result()['prompt'] for f in futures}
            self.assertEqual(prompts['asr-repair'], 'p')
            self.assertIn('funny parts', prompts['content-editor'])
            incoming.lines.put(None)
            outside = root / 'other.jpg'; outside.touch()
            with self.assertRaises(ValueError): rpc.allowed(outside)

    def test_rpc_deadline_follows_agy_deadline_and_restarts_per_attempt(self):
        with patch.dict(os.environ,{'AGY_MCP_TIMEOUT_MS':''}):
            self.assertEqual(ai_provider.agy_deadline_seconds(), 300)
            self.assertEqual(ai_provider.agy_deadline_seconds(True), 600)
        with patch.dict(os.environ,{'AGY_MCP_TIMEOUT_MS':'900000'}):
            self.assertEqual(ai_provider.agy_deadline_seconds(), 600)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); source = root / 'source.mp4'; source.touch()
            work = root / 'work'; work.mkdir()
            incoming = Feed(); emitted = queue.Queue()
            rpc = ai_provider.JobRpc(source, work, emitted.put, incoming, timeout=0.6)
            rpc.start_reader()
            with concurrent.futures.ThreadPoolExecutor(1) as executor:
                future = executor.submit(rpc.request, 'p', {'type':'object'}, None, 'render-reviewer', True)
                message = emitted.get(timeout=2)
                self.assertIs(message['nativeReview'], True)
                for _ in range(3):  # queued/retried attempts restart the deadline
                    threading.Event().wait(0.4)
                    incoming.lines.put(json.dumps({'type':'ai-started','requestId':message['requestId']}))
                threading.Event().wait(0.2)
                incoming.lines.put(json.dumps({'type':'ai-result','requestId':message['requestId'],'data':{'ok':True}}))
                self.assertEqual(future.result(timeout=2), {'ok':True})
                future = executor.submit(rpc.request, 'q', {'type':'object'})
                self.assertNotIn('nativeReview', emitted.get(timeout=2))
                with self.assertRaisesRegex(TimeoutError, 'deadline'):
                    future.result(timeout=3)
            incoming.lines.put(None)

    def test_transcription_releases_asr_models_even_on_failure(self):
        calls = []
        fake = type(sys)('transcribe_backends')
        fake.release_models = lambda: calls.append('release')
        fake.transcribe_media = lambda path: calls.append(path) or {'segments': [], 'language': 'vi'}
        with patch.dict(sys.modules, {'transcribe_backends': fake}):
            self.assertEqual(pipeline._transcript('a.mp4', {'audio': True}, True)['language'], 'vi')
            def fail(path): raise RuntimeError('asr failed')
            fake.transcribe_media = fail
            with self.assertRaisesRegex(RuntimeError, 'asr failed'):
                pipeline.transcribe_released('b.wav')
        self.assertEqual(calls, ['a.mp4', 'release', 'release'])


class RevisionPieceTests(unittest.TestCase):
    def test_pieces_keep_parent_time_and_isolate_new_ranges(self):
        import revisions
        base=[{'start':26.96,'end':59.62}]
        # The 8saigon revision: both ranges sit inside the base clip, no new source time.
        self.assertEqual(revisions.pieces([{'start':26.96,'end':39.44},{'start':45.88,'end':59.62}],base),[
            {'kind':'clean','start':26.96,'end':39.44,'cleanStart':0,'cleanEnd':12.48},
            {'kind':'clean','start':45.88,'end':59.62,'cleanStart':18.92,'cleanEnd':32.66}])
        # A pause-snapped start before the base clip reframes only the new 1.2 s.
        self.assertEqual(revisions.pieces([{'start':25.76,'end':30}],base),[
            {'kind':'source','start':25.76,'end':26.96},
            {'kind':'clean','start':26.96,'end':30,'cleanStart':0,'cleanEnd':3.04}])
        # A sliver of new time borrows from the parent piece to reach the minimum length.
        self.assertEqual(revisions.pieces([{'start':26.8,'end':30}],base),[
            {'kind':'source','start':26.8,'end':27.3},
            {'kind':'clean','start':27.3,'end':30,'cleanStart':.34,'cleanEnd':3.04}])
        # Multi-segment base: offsets follow the parent EDL order.
        self.assertEqual(revisions.pieces([{'start':11,'end':13}],[{'start':0,'end':2},{'start':10,'end':12}]),[
            {'kind':'clean','start':11,'end':12,'cleanStart':3,'cleanEnd':4},
            {'kind':'source','start':12,'end':13}])
        self.assertIsNone(revisions.pieces([{'start':70,'end':80}],base))
        self.assertIsNone(revisions.pieces([{'start':59.3,'end':70}],base))

    def test_auto_revision_inherits_parent_layout_for_same_source(self):
        import revisions
        request={'operation':'edit','layout':'auto','parentAnalysis':{'sourceFingerprint':'s','layout':'speaker-cut'}}
        self.assertEqual(revisions.inherited_layout(request,'s'),'speaker-cut')
        self.assertIsNone(revisions.inherited_layout(request,'other'))
        self.assertIsNone(revisions.inherited_layout({**request,'layout':'general'},'s'))
        self.assertIsNone(revisions.inherited_layout({**request,'parentAnalysis':{'sourceFingerprint':'s','layout':'auto'}},'s'))


class WorkerSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.base = Path(cls.temp.name)
        cls.source = cls.base / 'source.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',
                        'testsrc2=size=320x180:rate=12','-t','2','-c:v','libx264',
                        '-threads','1', str(cls.source)], check=True)

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def request(self, **changes):
        request = {'jobId':'test', 'sourcePath':str(self.source),
                   'workDir':str(self.base / ('work-' + self.id().split('.')[-1])),
                   'operation':'edit','aspectRatio':'16:9','layout':'wide',
                   'captions':{'enabled':False,'style':'karaoke'},'hook':{'enabled':False},
                   'selection':{'count':1,'minSeconds':0.5,'maxSeconds':2}}
        request.update(changes)
        return request

    def worker(self, request, answer=None):
        process = subprocess.Popen([sys.executable, '-u', str(PACKAGE / 'src/worker.py')],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        process.stdin.write(json.dumps({'type':'start','request':request}) + '\n'); process.stdin.flush()
        messages = []
        while True:
            line = process.stdout.readline()
            if not line: break
            msg = json.loads(line); messages.append(msg)
            if msg['type'] == 'ai-request':
                if not answer: self.fail('unexpected AI call')
                data = answer(msg)
                process.stdin.write(json.dumps({'type':'ai-result','requestId':msg['requestId'],'data':data})+'\n')
                process.stdin.flush()
            if msg['type'] in ('result','error'): break
        process.stdin.close()
        stderr = process.stderr.read(); process.wait(timeout=90)
        process.stdout.close(); process.stderr.close()
        self.assertEqual(process.returncode, 0, stderr)
        self.assertEqual(messages[-1]['type'], 'result', messages)
        return messages

    def test_analysis_review_then_idempotent_render(self):
        request=self.request(phase='analyze')
        analysis=self.worker(request)[-1]
        self.assertEqual(analysis['phase'],'analyze')
        self.assertEqual(analysis['clips'],[])
        self.assertTrue(analysis['plan']['scenes'])
        plan=analysis['plan']
        plan['clips'][0]['segments']=[{'startSeconds':0.5,'endSeconds':1.5}]
        first=self.worker({**request,'phase':'render','plan':plan})[-1]['clips'][0]
        self.assertAlmostEqual(first['durationSeconds'],1,delta=.2)
        timestamp=Path(first['path']).stat().st_mtime_ns
        second=self.worker({**request,'phase':'render','plan':plan})[-1]['clips'][0]
        self.assertEqual(second['clipId'],first['clipId'])
        self.assertEqual(Path(second['path']).stat().st_mtime_ns,timestamp)
        self.assertEqual(second['sha256'],first['sha256'])

    def test_clean_revision_reuses_base_and_source_timestamps(self):
        initial=self.worker(self.request(segments=[{'startSeconds':0,'endSeconds':2}]))[-1]['clips'][0]
        directory=self.base/'revision-reuse';directory.mkdir(exist_ok=True)
        staged=directory/'canonical.mp4';shutil.copyfile(initial['cleanPath'],staged)
        request=self.request(workDir=str(directory), segments=[{'startSeconds':.5,'endSeconds':1.5}],
            hook={'enabled':True,'text':'New hook','style':'pill'},
            reuse={'cleanPath':str(staged),'cleanSha256':initial['cleanSha256'],
                   'sourceFingerprint':initial['sourceFingerprint'],'baseFingerprint':initial['baseFingerprint'],
                   'sourceSegments':initial['segments'],'transcript':initial['transcript'],'layout':initial['layout'],
                   'renderDecision':{'scenes':[{'startSeconds':0,'endSeconds':1,'strategy':'SPLIT'},
                                              {'startSeconds':1,'endSeconds':2,'strategy':'TRACK'}]}})
        result=self.worker(request)[-1]['clips'][0]
        self.assertEqual(result['renderMode'],'clean-recut')
        self.assertEqual(result['segments'],request['segments'])
        self.assertAlmostEqual(result['durationSeconds'],1,delta=.2)
        self.assertTrue(result['scenes'])
        self.assertEqual(result['renderDecision']['cropScenes'][0]['sceneIndex'],0)
        self.assertAlmostEqual(result['renderDecision']['cropScenes'][-1]['endSeconds'],1,delta=.2)
        self.assertEqual(result['renderDecision']['scenes'],[
            {'startSeconds':0,'endSeconds':.5,'strategy':'SPLIT'},
            {'startSeconds':.5,'endSeconds':1,'strategy':'TRACK'}])

    def _staged_reuse(self, initial, directory, **extra):
        directory.mkdir(exist_ok=True)
        staged=directory/'canonical.mp4';shutil.copyfile(initial['cleanPath'],staged)
        return {'cleanPath':str(staged),'cleanSha256':initial['cleanSha256'],
                'sourceFingerprint':initial['sourceFingerprint'],'baseFingerprint':initial['baseFingerprint'],
                'sourceSegments':initial['segments'],'transcript':initial['transcript'],'layout':initial['layout'],**extra}

    def test_revision_reuses_base_framing_and_reframes_only_new_ranges(self):
        initial=self.worker(self.request(segments=[{'startSeconds':0,'endSeconds':1.2}]))[-1]['clips'][0]
        directory=self.base/'revision-hybrid'
        reuse=self._staged_reuse(initial,directory,renderDecision={'scenes':[
            {'startSeconds':0,'endSeconds':1.2,'strategy':'ALTERNATE'}]})
        request=self.request(workDir=str(directory),segments=[{'startSeconds':.5,'endSeconds':2}],reuse=reuse)
        result=self.worker(request)[-1]
        clip=result['clips'][0]
        self.assertEqual(clip['renderMode'],'hybrid-recut')
        self.assertNotIn('Clean revision cannot be reused for these base settings/source ranges; rendered original source',
                         result['warnings'])
        self.assertEqual(clip['renderDecision']['pieces'],[{'kind':'clean','start':.5,'end':1.2},
                                                           {'kind':'source','start':1.2,'end':2}])
        # The parent's speaker crop still frames the overlapping time.
        self.assertEqual(clip['renderDecision']['scenes'][0]['strategy'],'ALTERNATE')
        self.assertAlmostEqual(clip['renderDecision']['scenes'][0]['endSeconds'],.7,delta=.1)
        self.assertAlmostEqual(clip['durationSeconds'],1.5,delta=.2)
        self.assertEqual(clip['renderDecision']['cropScenes'][0]['sceneIndex'],0)
        subprocess.run(['ffmpeg','-v','error','-i',clip['path'],'-f','null','-'],check=True)

    def test_deliberate_layout_change_renders_source_without_reuse_warning(self):
        initial=self.worker(self.request(segments=[{'startSeconds':0,'endSeconds':2}]))[-1]['clips'][0]
        directory=self.base/'revision-layout-change'
        request=self.request(workDir=str(directory),layout='general',segments=[{'startSeconds':.5,'endSeconds':1.5}],
                             reuse=self._staged_reuse(initial,directory))
        result=self.worker(request)[-1]
        self.assertEqual(result['clips'][0]['renderMode'],'source-render')
        self.assertFalse(any('Clean revision cannot be reused' in w for w in result['warnings']))

    def test_manual_recut_executes_real_ffmpeg(self):
        messages = self.worker(self.request(segments=[{'startSeconds':0.5,'endSeconds':1.5}]))
        clip = messages[-1]['clips'][0]
        self.assertAlmostEqual(rendering.probe(clip['path'])['duration'], 1, delta=0.2)
        self.assertTrue(Path(clip['cleanPath']).is_file())
        self.assertEqual(clip['segments'], [{'startSeconds':0.5,'endSeconds':1.5}])

    def test_silent_selection_actually_sends_timestamped_frames(self):
        calls = []
        def answer(message):
            calls.append(message)
            self.assertGreater(len(message['frames']), 0)
            self.assertTrue(all(Path(f['path']).is_file() for f in message['frames']))
            self.assertGreater(message['frames'][0]['timestampSeconds'], 0)
            return {'shorts':[{'start':0,'end':2,'predicted_score':80,
                'video_description_for_tiktok':'Test','video_description_for_instagram':'Test',
                'video_title_for_youtube_short':'Visual selection','viral_hook_text':'Watch this'}]}
        result = self.worker(self.request(operation='clips'), answer)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result[-1]['clips'][0]['title'], 'Visual selection')

    def test_wide_vertical_real_render_and_effect(self):
        messages = self.worker(self.request(aspectRatio='9:16', effects=[
            {'type':'color_pop','start':0,'end':1,'strength':0.4}]))
        clip = messages[-1]['clips'][0]
        probe = rendering.probe(clip['path'])
        self.assertAlmostEqual(probe['width']/probe['height'], 9/16, delta=0.01)
        subprocess.run(['ffmpeg','-v','error','-i',clip['path'],'-f','null','-'], check=True)

    def test_muting_removes_audio_stream(self):
        # Explicit mute still runs against a video lacking sound without adding it.
        messages = self.worker(self.request(audio={'mode':'mute'}))
        self.assertFalse(rendering.probe(messages[-1]['clips'][0]['path'])['audio'])

    def test_manual_hook_renders_without_provider_or_key(self):
        messages = self.worker(self.request(hook={'enabled':True,'text':'Xin chào Việt Nam','style':'pill'}))
        clip = messages[-1]['clips'][0]
        self.assertNotEqual(Path(clip['path']).read_bytes(), Path(clip['cleanPath']).read_bytes())

    def test_hook_duration_changes_only_the_requested_initial_time_range(self):
        request=self.request(hook={'enabled':True,'text':'Save water','style':'yellow','durationSeconds':.5})
        source=self.base/'duration-source.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=blue:s=320x180:r=12:d=2','-c:v','libx264','-threads','1',str(source)],check=True)
        request['sourcePath']=str(source)
        clip=self.worker(request)[-1]['clips'][0]
        self.assertEqual(clip['renderDecision']['cropScenes'][0]['sceneIndex'],0)
        self.assertAlmostEqual(clip['renderDecision']['cropScenes'][0]['endSeconds'],2)
        self.assertEqual(clip['designDecision']['hook']['durationSeconds'],.5)
        def rgb(filename,seconds):
            return subprocess.check_output(['ffmpeg','-v','error','-ss',str(seconds),'-i',filename,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'])
        def difference(seconds):
            before,after=rgb(clip['cleanPath'],seconds),rgb(clip['path'],seconds)
            self.assertEqual(len(before),len(after))
            return sum(abs(a-b) for a,b in zip(before,after))/len(before)
        self.assertGreater(difference(.25),3)
        self.assertLess(difference(1.5),1)
        self.assertEqual(pipeline.hook_duration({'durationSeconds':10},2),2)
        for value in [0,-1,True,float('nan'),14401]:
            with self.assertRaisesRegex(ValueError,'hook durationSeconds'):
                contracts.validate({**request,'hook':{**request['hook'],'durationSeconds':value}})


if __name__ == '__main__': unittest.main()
