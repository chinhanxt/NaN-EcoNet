"""Render a staged source with real cached tracking; preserve the failed E2E job."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time

package, directory = map(Path, sys.argv[1:3])
directory.mkdir(exist_ok=True)
cache = directory / 'runtime-cache'
cache.mkdir(exist_ok=True)
for name in ('MPLCONFIGDIR','YOLO_CONFIG_DIR','TORCHINDUCTOR_CACHE_DIR','XDG_CACHE_HOME','TMPDIR'):
    os.environ[name] = str(cache)
os.environ['SCENE_ENGINE'] = 'pyscenedetect'
os.environ['FFMPEG_ENCODER'] = 'x264'
sys.path[:0] = [str(package/'src'), str(package/'core')]
import checkpoints
import rendering
import recut
import tracking
import reframe_v2

source = directory / 'source.mp4'
expected = 'bfc779104ba7d791ee5fa6b01586ec8dc93a05bc14a4a6d3d916eff500157d0b'
if checkpoints.file_hash(source) != expected:
    raise ValueError('Unexpected source video identity')
cut, framed = directory/'cut.mp4', directory/'framed.mp4'
started = time.monotonic()
info = rendering.probe(source)
recut.run_cut_concat(str(source), [{'start':0,'end':11.9}], str(cut),str(directory),
    runner=rendering.run, fps=rendering.cfr_rate(info))
rows, current = [], {}
original_target = tracking.SpeakerTracker.get_target
original_crop = tracking.SmoothedCameraman.get_crop_box

def target(self, candidates, frame, width):
    result = original_target(self, candidates, frame, width)
    current.clear()
    current.update(frame=frame, faces=[c['box'][:] for c in candidates], selected=result)
    return result

def crop(self, force_snap=False):
    result = original_crop(self, force_snap=force_snap)
    rows.append({**current,'cameraFrame':len(rows),'crop':list(result),'forceSnap':force_snap})
    return result

tracking.SpeakerTracker.get_target = target
tracking.SmoothedCameraman.get_crop_box = crop
decision = rendering.reframe(cut, framed, '9:16', 'auto', [])
checks = [row for row in rows if row['cameraFrame']/decision['frameClock']['fps'] >= 8.9 and row.get('selected')]
contained = [row for row in checks if row['selected'][0]>=row['crop'][0]
             and row['selected'][0]+row['selected'][2]<=row['crop'][2]]
receipt = {'sourceSha256':expected,'engineSha256':checkpoints.engine_hash(),
    'source':info,'cut':rendering.probe(cut),'framed':rendering.probe(framed),
    'decision':decision,'elapsedSeconds':time.monotonic()-started,
    'faceContainmentAfter8_9Seconds':{'samples':len(checks),'contained':len(contained)},
    'framedSha256':checkpoints.file_hash(framed),'rows':rows,
    'scope':'Real engine quality check; not MCP/Media/browser E2E',
    'policyDecision':{'authorizedBy':'User video E2E request','sourceUnchanged':True,
                      'network':False,'modelDownloads':False,'cpus':1,'memoryGiB':2}}
(directory/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='rows'},ensure_ascii=False))
