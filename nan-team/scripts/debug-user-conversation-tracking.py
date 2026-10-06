"""Trace real tracking coordinates without encoding or making model downloads."""
import json
import os
import sys
from pathlib import Path

job = Path('/home/chinhan/.local/share/nan-team/source-video-jobs/97c1eb3a-0014-47d7-86fb-2dbc2ad45148')
cache = job / 'tracking-debug-cache'
cache.mkdir(exist_ok=True)
for name in ('MPLCONFIGDIR', 'YOLO_CONFIG_DIR', 'TORCHINDUCTOR_CACHE_DIR', 'XDG_CACHE_HOME', 'TMPDIR'):
    os.environ[name] = str(cache)
os.environ['SCENE_ENGINE'] = 'pyscenedetect'

root = Path('/home/chinhan/MMO/NaN-Team')
sys.path.insert(0, str(root / 'packages/openshorts-engine/src'))
sys.path.insert(0, str(root / 'packages/openshorts-engine/core'))
import tracking
import reframe_v2

passthrough = '--passthrough' in sys.argv
if passthrough:
    original_popen = reframe_v2.subprocess.Popen
    def decoder(command, *args, **kwargs):
        if command[0] == 'ffmpeg' and 'rawvideo' in command:
            command = [*command[:-1], '-fps_mode', 'passthrough', command[-1]]
        return original_popen(command, *args, **kwargs)
    reframe_v2.subprocess.Popen = decoder

source = job / 'attempt-3/7975310a87695d5387900a08328faaaa-cut.mp4'
scenes, fps = tracking.detect_scenes(str(source))
fps = float(fps)
bounds = [(s.get_frames(), e.get_frames()) for s, e in scenes]
width, height = tracking.get_video_resolution(str(source))
camera = tracking.SmoothedCameraman(1080, 1920, width, height)
tracker = tracking.SpeakerTracker(cooldown_frames=30)
rows = []
original_target = tracker.get_target
original_crop = camera.get_crop_box
current = {}

def target(candidates, frame, source_width):
    result = original_target(candidates, frame, source_width)
    current.clear()
    current.update(frame=frame, time=frame / fps,
                   faces=[c['box'] for c in candidates], selected=result)
    return result

def crop(force_snap=False):
    result = original_crop(force_snap=force_snap)
    rows.append({**current, 'cameraFrame':len(rows), 'forceSnap':force_snap,
                 'center':camera.current_center_x, 'target':camera.target_center_x,
                 'crop':result})
    return result

tracker.get_target = target
camera.get_crop_box = crop
xs = reframe_v2._analyze_trajectory(str(source), bounds, ['TRACK'] * len(bounds),
                                  fps, width, height, camera, tracker)
receipt = {'fps':fps, 'bounds':bounds, 'sourceSize':[width,height],
           'decodedFrameCount':len(xs), 'detectorFrameCount':bounds[-1][1],
           'rows':rows}
(job / ('tracking-debug-passthrough.json' if passthrough else 'tracking-debug.json')).write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='rows'}))
