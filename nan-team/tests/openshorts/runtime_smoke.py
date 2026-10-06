"""Optional real ASR/tracking smoke using a disposable, offline Docker image.

Provision a faster-whisper model directory separately. This harness never
changes a production container or downloads assets. Only temporary job data is
writable inside the test container.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / 'packages/openshorts-engine'


def checked(command, **kwargs):
    return subprocess.run(command, check=True, capture_output=True, text=True, **kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--model-dir', required=True)
    parser.add_argument('--yolo', required=True)
    args = parser.parse_args()
    model, yolo = Path(args.model_dir).resolve(strict=True), Path(args.yolo).resolve(strict=True)
    source_hashes = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                     for p in sorted(PACKAGE.rglob('*')) if p.is_file() and '__pycache__' not in str(p)}
    checks = []
    with tempfile.TemporaryDirectory(prefix='openshorts-runtime-smoke-') as temporary:
        work = Path(temporary)
        source = work / 'source.mp4'
        checked(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=12',
                 '-f', 'lavfi', '-i', "flite=text='This is a real local speech transcription test. The video editor should preserve every spoken word and display accurate subtitles.':voice=slt",
                 '-c:v', 'libx264', '-threads', '1', '-c:a', 'aac', '-shortest', str(source)])
        base = {'jobId':'fixture', 'sourcePath':'/job/source.mp4','operation':'edit',
                'aspectRatio':'16:9','layout':'wide','captions':{'enabled':True,'style':'neon'},
                'hook':{'enabled':False},'audio':{'mode':'keep'}}
        cases = [('speech-captions', dict(base, workDir='/job/asr')),
                 ('manual-crop', dict(base, workDir='/job/crop', captions={'enabled':False},
                     aspectRatio='9:16', layout='general', cropOverrides={'0':0.5},
                     segments=[{'startSeconds':0,'endSeconds':2}]))]
        narration_dir = work / 'narration'; narration_dir.mkdir()
        checked(['ffmpeg','-v','error','-y','-f','lavfi','-i',
                 "flite=text='Replacement narration is different from the original video. These words must appear in the subtitles.':voice=slt",
                 str(narration_dir / 'narration.wav')])
        checked(['ffmpeg','-v','error','-y','-f','lavfi','-i',
                 'sine=frequency=440:sample_rate=16000','-t','2',str(narration_dir / 'bgm.wav')])
        cases.append(('replacement-narration-ducked-bgm', dict(base, workDir='/job/narration',
            audio={'mode':'replace-narration','narrationPath':'/job/narration/narration.wav',
                   'bgmPath':'/job/narration/bgm.wav'})))
        for name, request in cases:
            command = ['docker','run','--rm','--network','none','--read-only',
                '--user',str(work.stat().st_uid)+':'+str(work.stat().st_gid),
                '--tmpfs','/tmp:rw,size=256m','-e','PYTHONDONTWRITEBYTECODE=1',
                '-e','HF_HUB_OFFLINE=1','-e','WHISPER_MODEL=/models/whisper',
                '-e','WHISPER_DEVICE=cpu','-e','WHISPER_COMPUTE=int8',
                '-e','YOLO_MODEL_PATH=/weights/yolo.pt',
                '-v',str(model)+':/models/whisper:ro','-v',str(yolo)+':/weights/yolo.pt:ro',
                '-v',str(PACKAGE)+':/engine:ro','-v',str(work)+':/job:rw',
                '-i',args.image,'python3','-u','/engine/src/worker.py']
            result = checked(command, input=json.dumps({'type':'start','request':request})+'\n', timeout=300)
            messages = [json.loads(line) for line in result.stdout.splitlines()]
            assert messages[-1]['type'] == 'result', messages
            assert not any(m['type']=='ai-request' for m in messages)
            clip = messages[-1]['clips'][0]
            output = work / Path(clip['path']).relative_to('/job')
            clean = work / Path(clip['cleanPath']).relative_to('/job')
            checked(['ffmpeg','-v','error','-i',str(output),'-f','null','-'],timeout=90)
            text = ' '.join(s['text'] for s in clip['transcript']['segments'])
            if 'captions' in name:
                assert 'transcription' in text.lower(), text
            if 'replacement' in name:
                assert 'replacement narration' in text.lower() and 'transcription test' not in text.lower(), text
            if name != 'manual-crop':
                assert output.read_bytes() != clean.read_bytes(), 'captions were not burned'
            checks.append({'name':name,'durationSeconds':clip['durationSeconds'],
                           'aspectRatio':clip['aspectRatio'],'transcript':text,
                           'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                           'verified':['NDJSON-only stdout','successful full FFmpeg decode','clean artifact preserved']})
    print(json.dumps({'imageId':checked(['docker','image','inspect',args.image,'--format','{{.Id}}']).stdout.strip(),
                      'modelSha256':hashlib.sha256((model/'model.bin').read_bytes()).hexdigest(),
                      'ffmpegVersion':checked(['ffmpeg','-version']).stdout.splitlines()[0],
                      'sourceHashes':source_hashes,'checks':checks},indent=2))


if __name__ == '__main__': main()
