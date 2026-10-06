#!/usr/bin/env python3
"""Explicit operator-only provisioning; the worker never calls this script."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import urllib.request

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'src'))
from asr_identity import PINNED  # single source of the pinned turbo revision and hashes

REPOSITORY='mobiuslabsgmbh/faster-whisper-large-v3-turbo'
REVISION=PINNED[REPOSITORY]['revision']
FILES=PINNED[REPOSITORY]['files']


def checksum(path):
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block)
    return digest.hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination',required=True,help='Explicit durable external model root')
    parser.add_argument('--yolo-source',required=True,help='Existing trusted local YOLO .pt (no YOLO download)')
    args=parser.parse_args()
    destination=Path(args.destination).expanduser()
    if not destination.is_absolute() or destination.is_symlink():raise ValueError('absolute nonsymlink destination required')
    yolo=Path(args.yolo_source).resolve(strict=True)
    if not yolo.is_file() or yolo.suffix!='.pt':raise ValueError('existing .pt weights required')
    whisper=destination/'faster-whisper-large-v3-turbo';whisper.mkdir(parents=True,exist_ok=True)
    for name,expected in FILES.items():
        target=whisper/name
        if target.exists() and checksum(target)==expected:continue
        temporary=whisper/(name+'.download')
        try:
            url=f'https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{name}'
            with urllib.request.urlopen(url,timeout=600) as response,temporary.open('wb') as stream:
                shutil.copyfileobj(response,stream)
            if checksum(temporary)!=expected:raise RuntimeError('model SHA256 mismatch: '+name)
            os.replace(temporary,target)
        finally:temporary.unlink(missing_ok=True)
    target=destination/'yolov8n.pt'
    if target.resolve()!=yolo:shutil.copyfile(yolo,target)
    print('Provisioned pinned multilingual ASR model (Vietnamese default):',whisper)
    print('Copied trusted YOLO weights:',target,'sha256='+checksum(target))


if __name__=='__main__':main()
