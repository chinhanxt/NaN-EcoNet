"""Verify Docker adapter process-group cancellation removes its named container."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--image',required=True)
    parser.add_argument('--model-dir',required=True);parser.add_argument('--yolo',required=True)
    args=parser.parse_args()
    package=Path(__file__).resolve().parents[2]/'packages/openshorts-engine'
    image=subprocess.check_output(['docker','image','inspect',args.image,'--format','{{.Id}}'],text=True).strip()
    with tempfile.TemporaryDirectory(prefix='openshorts-cancel-') as directory:
        env={**os.environ,'SOURCE_VIDEO_JOB_DIRECTORY':directory,
            'OPENSHORTS_WHISPER_MODEL_DIRECTORY':args.model_dir,'OPENSHORTS_YOLO_MODEL_PATH':args.yolo,
            'OPENSHORTS_DOCKER_IMAGE':image}
        process=subprocess.Popen([str(package/'bin/docker-python'),'-c','import time; time.sleep(90)'],
            env=env,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        name='nan-openshorts-'+str(process.pid)
        try:
            for _ in range(100):
                if subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
                if process.poll() is not None:raise RuntimeError(process.stderr.read())
                time.sleep(.1)
            else:raise RuntimeError('container failed to start')
            os.killpg(process.pid,signal.SIGTERM)
            process.communicate(timeout=20)
            assert subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
            print(json.dumps({'imageId':image,'containerRemoved':True,'wrapperExit':process.returncode}))
        finally:
            if process.poll() is None:os.killpg(process.pid,signal.SIGTERM);process.communicate(timeout=20)
            subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__=='__main__':main()
