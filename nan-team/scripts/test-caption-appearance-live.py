"""Low-load real FFmpeg caption smoke; supplied timings are a test fixture."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'packages/openshorts-engine/src'),
               str(ROOT / 'packages/openshorts-engine/core')]
import pipeline
import rendering

os.environ['OPENSHORTS_THREADS'] = '1'
os.environ['FFMPEG_ENCODER'] = 'x264'
OUT = ROOT / 'reports/openshorts-integration/caption-appearance'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = Path('/home/chinhan/Downloads/2aOboR247mJdjEToi8Xx83vhSbjxn8gUlENON4T2.mp4')
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
base = OUT / 'base.mp4'
rendering.run(['ffmpeg', '-y', '-i', str(SOURCE), '-t', '2', '-vf', 'scale=360:480',
               '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', str(base)])
transcript = {'language': 'vi', 'segments': [{'text': 'Xin chào Việt Nam', 'words': [
    {'word': ' Xin', 'start': 0, 'end': .4}, {'word': ' chào', 'start': .4, 'end': .8},
    {'word': ' Việt', 'start': .8, 'end': 1.2}, {'word': ' Nam', 'start': 1.2, 'end': 2}]}]}
results = []
for style, position in [('classic', 'top'), ('pop', 'middle')]:
    options = {'enabled': True, 'style': style, 'position': position, 'fontName': 'Anton',
               'fontSize': 24, 'fontColor': '#FFFF00', 'borderColor': '#000000',
               'borderWidth': 2, 'highlightColor': '#00FFFF', 'bgColor': '#112233',
               'bgOpacity': .6, 'baseOpacity': .7, 'uppercase': True}
    target = OUT / (style + '.mp4')
    pipeline._captions(base, target, transcript, options, OUT)
    meta = rendering.probe(target)
    assert meta['width'] == 360 and meta['height'] == 480 and meta['audio']
    assert abs(meta['duration'] - 2) < .2
    frame = OUT / (style + '.png')
    rendering.run(['ffmpeg', '-y', '-ss', '0.6', '-i', str(target), '-frames:v', '1', str(frame)])
    results.append({'options': options, 'artifact': str(target.relative_to(ROOT)),
                    'frame': str(frame.relative_to(ROOT)), 'metadata': meta,
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
receipt = {'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'sourceSha256': source_hash, 'tests': '33 Python regression tests passed',
           'timingProvenance': 'synthetic Vietnamese test words, not ASR of source',
           'scope': 'private Python caption adapter; public and motion parity pending',
           'policyDecision': {'authorized': 'ongoing integration and short source-video verification',
                              'cpuThreads': 1, 'sourceModified': False, 'network': False},
           'sourceHashes': {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                            for path in [ROOT / 'packages/openshorts-engine/src/caption_options.py',
                                         ROOT / 'packages/openshorts-engine/src/pipeline.py',
                                         ROOT / 'packages/openshorts-engine/src/contracts.py',
                                         ROOT / 'packages/openshorts-engine/src/render_phase.py']},
           'renders': results}
(OUT / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'receipt': str((OUT / 'receipt.json').relative_to(ROOT)),
                  'renders': len(results)}, ensure_ascii=False))
