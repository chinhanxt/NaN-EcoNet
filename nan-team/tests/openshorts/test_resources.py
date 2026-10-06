import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT/'packages/openshorts-engine'
sys.path.insert(0,str(PACKAGE/'src'))
import budgets
import retention
import render_phase


class ResourceTests(unittest.TestCase):
    def test_generated_narration_timings_preserve_real_phrase_boundaries(self):
        request={'audio':{'mode':'replace-narration','narrationPath':'/private/voice.wav',
            'narrationCaptions':[{'text':'New voice words','startMs':120,'endMs':900}]},'captions':{'enabled':True}}
        with patch('rendering.audio_duration',return_value=1):
            transcript=render_phase._narration(request)
        self.assertEqual(transcript['segments'][0]['words'],[{'word':'New voice words','start':.12,'end':.9}])
        with patch('rendering.audio_duration',return_value=.5):
            with self.assertRaises(ValueError):render_phase._narration(request)
    def test_generated_narration_timings_probe_real_audio_only_file(self):
        with tempfile.TemporaryDirectory() as folder:
            voice=Path(folder)/'voice.wav'
            subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=1',
                '-ac','1','-ar','16000',str(voice)],check=True)
            request={'audio':{'mode':'replace-narration','narrationPath':str(voice),
                'narrationCaptions':[{'text':'Voice','startMs':0,'endMs':900}]},'captions':{'enabled':True}}
            self.assertEqual(render_phase._narration(request)['segments'][0]['end'],.9)
            request['audio']['narrationCaptions']=[{'text':'Voice','startMs':0,'endMs':2000}]
            with self.assertRaises(ValueError):render_phase._narration(request)
    def test_agy_written_narration_text_corrects_caption_asr(self):
        words=lambda text:{'language':'vi','segments':[{'words':[{'word':' '+w,'start':i*.2,'end':(i+1)*.2} for i,w in enumerate(text.split())]}]}
        request={'audio':{'mode':'replace-narration','narrationPath':'/private/voice.wav'},'captions':{'enabled':True}}
        plan={'clips':[{'content':{'narration':{'text':'cô bị xe tải tông trúng rồi lật ngược lại'}}}]}
        with patch('pipeline.transcribe_released',return_value=words('cô bị xe tải công chúng rồi lật ngược lại'),create=True):
            text=' '.join(w['word'].strip() for w in render_phase._narration(request,plan)['segments'][0]['words'])
            self.assertEqual(text,'cô bị xe tải tông trúng rồi lật ngược lại')
            plan['clips'][0]['content']['narration']['text']='hoàn toàn khác'
            self.assertEqual(render_phase._narration(request,plan)['segments'][0]['words'][4]['word'],' công')
    def test_child_cannot_expand_budget(self):
        with patch.dict(os.environ,{'OPENSHORTS_MAX_INPUT_BYTES':'100'}):
            self.assertEqual(budgets.limits({'budgets':{'inputBytes':50}})['inputBytes'],50)
            with self.assertRaises(ValueError):budgets.limits({'budgets':{'inputBytes':101}})

    def test_input_and_artifact_limits(self):
        with tempfile.TemporaryDirectory() as folder:
            directory=Path(folder);source=directory/'input.mp4';source.write_bytes(b'x'*50)
            with self.assertRaises(budgets.BudgetExceeded):
                budgets.Monitor({'budgets':{'inputBytes':20}},source,directory,lambda _:None)
            monitor=budgets.Monitor({'budgets':{'workBytes':100}},source,directory,lambda _:None)
            (directory/'artifact.mp4').write_bytes(b'x'*60)
            with self.assertRaises(budgets.BudgetExceeded):monitor.check()
            with self.assertRaises(budgets.BudgetExceeded):monitor.check_duration(30000)

    def test_retention_never_removes_active_or_review_waiting(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for name in ['active','review','done']:(root/name).mkdir()
            candidates=[{'jobId':name,'status':'completed','finishedAtEpochSeconds':1} for name in ['active','review','done']]
            with patch.dict(os.environ,{'SOURCE_VIDEO_JOB_DIRECTORY':folder}):
                with retention.worker_lease(root/'active'):
                    self.assertEqual(retention.cleanup_terminal_jobs(root,candidates,{'review'},60,now=1000),[])
                removed=retention.cleanup_terminal_jobs(root,candidates,{'active','review'},60,now=1000)
            self.assertEqual(removed,['done'])
            self.assertTrue((root/'review').exists());self.assertTrue((root/'active').exists())
            with self.assertRaises(ValueError):retention.cleanup_terminal_jobs(root,[{'jobId':'../escape'}],set())

    def test_scene_boundaries_persist_and_rebase(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'hardcut.mp4'
            subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=red:s=320x180:d=2:r=24',
                '-f','lavfi','-i','color=blue:s=320x180:d=2:r=24','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0',
                '-c:v','libx264','-threads','1',str(source)],check=True)
            request={'jobId':'scenes','sourcePath':str(source),'workDir':str(root/'work'),
                'operation':'edit','phase':'analyze','aspectRatio':'16:9','layout':'wide',
                'captions':{'enabled':False},'hook':{'enabled':False},
                'segments':[{'startSeconds':1,'endSeconds':3}]}
            result=subprocess.run([sys.executable,str(PACKAGE/'src/worker.py')],
                input=json.dumps({'type':'start','request':request})+'\n',capture_output=True,text=True,timeout=60)
            self.assertEqual(result.returncode,0,result.stderr)
            plan=json.loads(result.stdout.splitlines()[-1])['plan']
            self.assertEqual(len(plan['scenes']),2)
            self.assertAlmostEqual(plan['scenes'][0]['endSeconds'],2,delta=.05)
            self.assertEqual(len(plan['clips'][0]['scenes']),2)
            self.assertAlmostEqual(plan['clips'][0]['scenes'][0]['endSeconds'],1,delta=.05)


if __name__=='__main__':unittest.main()
