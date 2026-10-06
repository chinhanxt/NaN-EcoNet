"""Explicit pinned test-model provisioning, never called by a video worker."""
import argparse
import shutil
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

REPO = 'dropbox-dash/faster-whisper-large-v3-turbo'
REVISION = '0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf'
FILES = {
    'model.bin': (1617884929, 'sha256', 'e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da'),
    'config.json': (2263, 'git', '0351d1d6870005e865747b781b5d7c23ea0459cd'),
    'preprocessor_config.json': (340, 'git', '931c77a740890c46365c7ae0c9d350ba3cca908f'),
    'tokenizer.json': (2710337, 'git', '17456db595adc78a973f97d69d8cb50bc87c0b1c'),
    'vocabulary.json': (1068114, 'git', '0adcd01e7c237205d593b707e66dd5d7bc785d2d'),
}
DEST = Path('/home/chinhan/.local/share/nan-team/openshorts-models/faster-whisper-large-v3-turbo')
REPORT = Path(__file__).resolve().parents[1]/'reports/openshorts-integration/whisper-turbo-provision.json'


def checks(path, size):
    sha = hashlib.sha256()
    git = hashlib.sha1(f'blob {size}\0'.encode())
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            sha.update(chunk); git.update(chunk)
    return {'sha256':sha.hexdigest(), 'git':git.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=DEST)
    destination = parser.parse_args().destination
    if not destination.is_absolute(): raise ValueError('Absolute destination required')
    destination.mkdir(parents=True, exist_ok=True)
    required = sum(v[0] for name,v in FILES.items() if not (destination/name).exists())
    if shutil.disk_usage(destination).free < required + 200*1024*1024:
        raise ValueError('Not enough free space for verified model plus 200 MiB reserve')
    receipt = {'model':REPO,'revision':REVISION,'destination':str(destination),'ephemeral':str(destination).startswith('/dev/shm/'),'files':{},'completed':False,
        'policyDecision':{'authorization':'User requested completion of professional Vietnamese video editing',
                          'maxDownloadBytes':sum(v[0] for v in FILES.values()),'maxParallelDownloads':1,
                          'workerImplicitDownload':False,'activation':'Only after bounded acoustic validation'}}
    for name,(size,kind,expected) in FILES.items():
        target=destination/name
        if not target.exists():
            partial=destination/(name+'.partial')
            subprocess.run(['curl','--fail','--location','--silent','--show-error','--limit-rate','8M',
                '--connect-timeout','20','--max-time','900','--retry','1','--output',str(partial),
                f'https://huggingface.co/{REPO}/resolve/{REVISION}/{name}'],check=True)
            if partial.stat().st_size!=size: raise ValueError('Size mismatch: '+name)
            hashes=checks(partial,size)
            if hashes[kind]!=expected: raise ValueError('Hash mismatch: '+name)
            os.replace(partial,target)
        else:
            hashes=checks(target,size)
            if target.stat().st_size!=size or hashes[kind]!=expected: raise ValueError('Existing model differs: '+name)
        receipt['files'][name]={'bytes':size,'sha256':hashes['sha256']}
        REPORT.write_text(json.dumps(receipt,indent=2)+'\n')
        print('Verified '+name,flush=True)
    receipt['completed']=True; receipt['completedAtUnix']=time.time()
    REPORT.write_text(json.dumps(receipt,indent=2)+'\n')


if __name__=='__main__': main()
