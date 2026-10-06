"""Representative deterministic slides/two-speaker ML fixtures using local NASA photo.

Requires host scikit-image/Pillow and the provisioned Docker runtime. Vision
content-range response is mocked; real face detection, mouth activity, layout
routing, FFmpeg crop and output decode run in the actual ML image.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import numpy as np
from PIL import Image,ImageDraw
from skimage import data

ROOT=Path(__file__).resolve().parents[2]
PACKAGE=ROOT/'packages/openshorts-engine'


def video(path,frames,width,height,fps=20):
    process=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24',
        '-s',f'{width}x{height}','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','1',str(path)],stdin=subprocess.PIPE)
    for frame in frames:
        process.stdin.write(np.asarray(frame,dtype=np.uint8).tobytes())
    process.stdin.close()
    if process.wait():raise RuntimeError('Fixture encoding failed')


def fixtures(root):
    astronaut=Image.fromarray(data.astronaut())
    canvas=Image.new('RGB',(1280,720),'#182235')
    draw=ImageDraw.Draw(canvas)
    draw.rectangle((20,40,880,680),fill='white')
    draw.text((65,80),'SLIDE: ORIGINAL CONTENT MUST STAY VISIBLE',fill='black')
    draw.rectangle((60,190,780,200),fill='blue')
    draw.rectangle((60,280,720,290),fill='red')
    draw.rectangle((60,370,660,380),fill='green')
    canvas.paste(astronaut.resize((360,360)),(920,170))
    slide=root/'slides.mp4'
    video(slide,(canvas for _ in range(120)),1280,720)
    portrait=astronaut.resize((400,400))
    def speakers():
        for frame in range(160):
            scene=Image.new('RGB',(960,540),'#202020')
            scene.paste(portrait,(20,70));scene.paste(portrait,(540,70))
            active=0 if frame<48 or frame>=104 else 1
            # Alter only the active mouth patch. The listener photo is unchanged.
            box=(20,70) if active==0 else (540,70)
            d=ImageDraw.Draw(scene)
            mouth=(box[0]+175,box[1]+113,box[0]+205,box[1]+129)
            shade=30 if frame%2==0 else 220
            d.rectangle(mouth,fill=(shade,shade,shade))
            yield scene
    two=root/'two-speakers.mp4'
    video(two,speakers(),960,540)
    return slide,two


def run_worker(source,directory,layout,env):
    request={'jobId':layout,'sourcePath':str(source),'workDir':str(directory),
        'operation':'edit','aspectRatio':'9:16','layout':layout,
        'captions':{'enabled':False},'hook':{'enabled':False},'audio':{'mode':'keep'}}
    calls=[]
    with tempfile.TemporaryFile(mode='w+t') as diagnostics:
        process=subprocess.Popen([str(PACKAGE/'bin/docker-python'),str(PACKAGE/'src/worker.py')],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=diagnostics,text=True,env=env)
        process.stdin.write(json.dumps({'type':'start','request':request})+'\n');process.stdin.flush()
        final=None
        for line in process.stdout:
            msg=json.loads(line)
            if msg['type']=='ai-request':
                assert layout=='screencast' and msg['schema']['title']=='WideContentResponse',msg
                assert len(msg['frames'])==6 and all(Path(f['path']).is_file() for f in msg['frames'])
                calls.append({'role':msg['role'],'frames':len(msg['frames'])})
                response={'ranges':[{'start':0,'end':6,'what':'training slide','width_fraction':.7}]}
                process.stdin.write(json.dumps({'type':'ai-result','requestId':msg['requestId'],'data':response})+'\n');process.stdin.flush()
            elif msg['type'] in ('result','error'):
                final=msg
        process.stdin.close();process.stdout.close()
        process.wait(timeout=120)
        diagnostics.seek(0);logs=diagnostics.read()
        if process.returncode or final['type']!='result':raise AssertionError((final,logs[-4000:]))
    clip=final['clips'][0]
    subprocess.run(['ffmpeg','-v','error','-xerror','-i',clip['path'],'-f','null','-'],check=True)
    return clip,final['warnings'],calls


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--image',required=True);parser.add_argument('--model-dir',required=True);parser.add_argument('--yolo',required=True)
    args=parser.parse_args()
    image=subprocess.check_output(['docker','image','inspect',args.image,'--format','{{.Id}}'],text=True).strip()
    with tempfile.TemporaryDirectory(prefix='openshorts-layout-fixtures-') as temporary:
        root=Path(temporary);slides,two=fixtures(root)
        env={**os.environ,'SOURCE_VIDEO_JOB_DIRECTORY':str(root),'OPENSHORTS_DOCKER_IMAGE':image,
             'OPENSHORTS_WHISPER_MODEL_DIRECTORY':str(Path(args.model_dir).resolve()),'OPENSHORTS_YOLO_MODEL_PATH':str(Path(args.yolo).resolve())}
        results=[]
        for source,layout in [(slides,'screencast'),(two,'speaker-cut')]:
            clip,warnings,calls=run_worker(source,root/layout,layout,env)
            decision=clip['renderDecision']
            strategies=[s['strategy'] for s in decision['scenes']]
            if layout=='screencast':
                assert 'SCREENCAST' in strategies or 'INSET' in strategies,decision
                center=decision.get('screencastPresenterCenters',[])
                if center:assert center[0][0]>900,center
            else:
                assert 'ALTERNATE' in strategies,decision
                verdicts=decision['speakerCuts']
                correct=0;count=0
                for verdict in verdicts:
                    seconds=verdict['startSeconds']
                    # Exclude the 0.8s intentional hold period around true switches.
                    if 2.4<=seconds<3.2 or 5.2<=seconds<6:continue
                    expected=0 if seconds<2.4 or seconds>=5.2 else 1
                    correct+=verdict['speaker']==expected;count+=1
                accuracy=correct/max(count,1)
                assert accuracy>=.9,(accuracy,verdicts)
                assert decision['trajectory']['maxX']-decision['trajectory']['minX']>400,decision
                decision['fixtureAttributionAccuracyOutsideHold']=accuracy
            results.append({'layout':layout,'durationSeconds':clip['durationSeconds'],'decision':decision,
                'warnings':warnings,'aiCalls':calls,'outputSha256':clip['sha256'],'scenes':clip['scenes']})
    source_hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(PACKAGE.rglob('*')) if p.is_file() and '__pycache__' not in str(p)}
    print(json.dumps({'imageId':image,'sourceHashes':source_hashes,
        'fixtureSource':'skimage.data.astronaut (bundled NASA public-domain photo); synthesized slide/mouth motion',
        'scope':'Geometry and synthetic mouth attribution; live AI scene-content accuracy and real conversations remain separate tests',
        'checks':results},indent=2))


if __name__=='__main__':main()
