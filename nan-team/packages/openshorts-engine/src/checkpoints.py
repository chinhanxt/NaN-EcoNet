"""Exact-input checkpoints. Atomic replace and integrity checks permit safe retry."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def file_hash(path):
    hasher = hashlib.sha256()
    with open(path, 'rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            hasher.update(block)
    return hasher.hexdigest()


def engine_hash():
    files = sorted(list((ROOT/'core').rglob('*.py')) + list((ROOT/'core/fonts').glob('*')) +
                   list((ROOT/'src').glob('*.py')))
    return digest({str(p.relative_to(ROOT)): file_hash(p) for p in files if p.is_file()})


def settings(request):
    ignored = {'jobId', 'sourcePath', 'workDir', 'phase', 'plan', 'reuse', 'approved', 'parentAnalysis'}
    config = {key:value for key,value in request.items() if key not in ignored}
    audio = dict(config.get('audio', {}))
    for name in ('narrationPath', 'bgmPath'):
        audio.pop(name, None)
    config['audio'] = audio
    import asr_identity
    config['_asrRuntime'] = asr_identity.current()
    return config


def base_fingerprint(request, layout):
    original = settings(request)
    config = {key:original[key] for key in ('aspectRatio','layout','cropOverrides','effects','designBrief','audio') if key in original}
    config['resolvedLayout'] = layout
    config['audioArtifacts'] = audio_fingerprints(request)
    return digest(config)


def audio_fingerprints(request):
    # A generator can produce different waveforms for the same text/voice.
    # Paths are attempt-local; reusable audio identity must bind the bytes.
    return {field: file_hash(Path(path)) for field, path in request.get('audio', {}).items()
            if field in ('narrationPath', 'bgmPath') and path}


def atomic_write(path, value):
    path = Path(path)
    temp = path.with_suffix(path.suffix + '.tmp')
    with open(temp, 'w', encoding='utf-8') as file:
        os.chmod(temp, 0o600)
        json.dump(value, file, ensure_ascii=False, allow_nan=False)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temp, path)
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def load(path, fingerprint):
    path = Path(path)
    if not path.exists():
        return None
    value = json.loads(path.read_text())
    if value.get('fingerprint') != fingerprint:
        return None
    return value['data']


def save(path, fingerprint, data):
    atomic_write(path, {'version':1, 'fingerprint':fingerprint, 'data':data})


def artifact(directory, path, expected_hash):
    actual = Path(path).resolve(strict=True)
    if not actual.is_relative_to(Path(directory).resolve()) or not actual.is_file():
        raise ValueError('Checkpoint artifact escaped job directory')
    return file_hash(actual) == expected_hash
