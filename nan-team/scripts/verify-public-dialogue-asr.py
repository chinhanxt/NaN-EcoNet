"""Real acoustic comparison receipt; never substitute generated hook as reference.

usage: verify-public-dialogue-asr.py PACKAGE SOURCE DIRECTORY [SECONDS ...]
Each SECONDS (default 30) transcribes source[0, SECONDS] through the production
transcribe_media() path, sequentially, and keeps word-level output.
"""
import json
from pathlib import Path
import resource
import subprocess
import sys
import time

package, source, directory = map(Path, sys.argv[1:4])
lengths = [float(value) for value in sys.argv[4:]] or [30.0]
sys.path[:0] = [str(package/'src'), str(package/'core')]
import checkpoints
import transcribe_backends

directory.mkdir(parents=True,exist_ok=True)
runs = []
for seconds in lengths:
    audio = directory/f'source-{seconds:g}s.wav'
    subprocess.run(['ffmpeg','-v','error','-threads','1','-filter_threads','1','-i',str(source),
                    '-t',f'{seconds:g}','-vn','-ac','1','-ar','16000','-y',str(audio)],check=True,timeout=40)
    start=time.monotonic()
    transcript=transcribe_backends.transcribe_media(str(audio))
    elapsed=time.monotonic()-start
    runs.append({'audioSha256':checkpoints.file_hash(audio),'sourceRangeSeconds':[0,seconds],
                 'elapsedSeconds':elapsed,'realtimeFactor':elapsed/seconds,'transcript':transcript})
    print(json.dumps({'seconds':seconds,'elapsedSeconds':elapsed,'text':transcript.get('text'),
                      'warnings':transcript.get('asr',{}).get('quality',{}).get('warnings')},ensure_ascii=False),flush=True)
receipt={'sourceSha256':checkpoints.file_hash(source),'engineSha256':checkpoints.engine_hash(),
         'runs':runs,'peakProcessRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
         'manualQualityPassed':None,
         'limitations':['No human reference transcript or word-error-rate measurement yet',
                        'A coherent transcript alone does not prove acoustic accuracy'],
         'policyDecision':{'authorization':'User requested professional Vietnamese speech E2E',
                           'modelDownloadInWorker':False,'parallelInference':False}}
(directory/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
