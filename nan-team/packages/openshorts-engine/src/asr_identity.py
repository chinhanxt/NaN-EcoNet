"""Bind local ASR checkpoints to model bytes and decoding settings."""
from functools import lru_cache
import hashlib
import importlib.metadata
import math
import os
from pathlib import Path
import re

FILES = ('model.bin', 'config.json', 'tokenizer.json', 'preprocessor_config.json',
         'vocabulary.json', 'vocabulary.txt')
# faster-whisper TranscriptionOptions fields that must equal the bound decode settings.
BOUND_OPTIONS = ('beam_size', 'condition_on_previous_text', 'word_timestamps', 'without_timestamps')


# Converted checkpoints downloaded as-is (no provisioning receipt): identity comes
# from pinned hashes of the published files at a fixed revision.
PINNED = {
    'mobiuslabsgmbh/faster-whisper-large-v3-turbo': {
        'revision': '0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf',
        'files': {'model.bin': 'e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da',
                  'config.json': 'b0253ea6c0d3bea6b1e19e91a02acfd3b53f4467362efcb5a3e6b16c9b3a9b7e',
                  'tokenizer.json': '297b13372ac43916285644fb9687add3cc62ee2a1adb60da3dc25cc94c1871fd',
                  'preprocessor_config.json': '7ccc62c6f2765af1f3b46c00c9b5894426835a05021c8b9c01eecb6dfb542711',
                  'vocabulary.json': 'c69260f2ab26d659b7c398f9a2b2b48ed0df16c3b47d7326782fd9cba71690c1'}},
}


def _pinned(files):
    for model, pin in PINNED.items():
        if files.get('model.bin') != pin['files']['model.bin']:
            continue
        if files != pin['files']:
            raise ValueError(f'Local ASR model files do not match pinned {model} hashes')
        return {'model': model, 'revision': pin['revision'], 'verification': 'pinned-sha256'}
    return {}


# Decoding runs on silence-bounded clips (see transcribe_backends.plan_clips).
# faster-whisper's own VAD concatenates speech and cuts fixed 30 s windows,
# which split words mid-speech on the Vietcetera fixture and produced
# hallucinated window tails; its VAD is therefore disabled for the decode call.
SEGMENTATION = {'method': 'silero-vad-silence-clips', 'maxClipSeconds': 25.0, 'minSilenceMs': 300,
                'padSeconds': 0.2, 'vadThreshold': 0.5, 'dropRemainderWindowsBelowSeconds': 1.0,
                'trimSuspectedEndWindow': True}


def decode_settings():
    settings = {'beam_size': 5, 'vad_filter': False,
                'condition_on_previous_text': False, 'word_timestamps': True}
    language = os.environ.get('WHISPER_LANGUAGE', '').strip().lower()
    if language and language != 'auto':
        if not re.fullmatch(r'[a-z]{2,3}', language):
            raise ValueError('WHISPER_LANGUAGE must be a language code or auto')
        settings['language'] = language
    timestamps = os.environ.get('WHISPER_WITHOUT_TIMESTAMPS', '').strip().lower()
    if timestamps:
        if timestamps not in ('true', 'false'):
            raise ValueError('WHISPER_WITHOUT_TIMESTAMPS must be true or false')
        settings['without_timestamps'] = timestamps == 'true'
    return settings


@lru_cache(maxsize=24)
def _hash_file(path, size, modified_ns, changed_ns, inode):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def current():
    model = Path(os.environ.get('WHISPER_MODEL', 'small'))
    files = {}
    if model.is_dir():
        for name in FILES:
            path = model/name
            if path.is_file():
                stat = path.stat()
                files[name] = _hash_file(str(path.resolve()), stat.st_size,
                    stat.st_mtime_ns, stat.st_ctime_ns, stat.st_ino)
    # Unknown local checkpoints still bind by file hashes; known ones must match their pin exactly.
    provenance = _pinned(files) if files else {}
    decode = decode_settings()
    versions = {}
    for name in ('faster-whisper', 'ctranslate2'):
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = None
    return {'backend': os.environ.get('TRANSCRIBE_BACKEND', 'whisper'),
            'modelProvenance': provenance,
            'runtimeVersions': versions,
            'localAssetsVerified': 'model.bin' in files, 'files': files,
            'device': os.environ.get('WHISPER_DEVICE', 'cpu'),
            'computeType': os.environ.get('WHISPER_COMPUTE', 'int8'),
            'decode': decode, 'segmentation': dict(SEGMENTATION)}


def loaded_decoder(model, device, compute_type, files, threads):
    """Identity of a resident faster-whisper model: requested load settings and what CTranslate2 reports."""
    engine = getattr(model, 'model', None)

    def reported(name):
        try:
            value = getattr(engine, name)
        except Exception:
            return None
        return value if value is None or isinstance(value, (bool, int, str)) else str(value)
    return {'device': device, 'computeType': compute_type, 'files': dict(files), 'cpuThreads': threads,
            'loadedDevice': reported('device'), 'loadedComputeType': reported('compute_type'),
            'multilingual': reported('is_multilingual')}


def bind_decoder(runtime, decoder, info):
    """Prove the decoder that ran is the bound runtime; return the receipt of what actually ran.

    Model bytes, bound decode options and a forced language must match exactly or
    the transcript is refused. A CPU fallback after a CUDA failure is allowed but
    reported, because it changes numerics relative to the configured device.
    """
    if decoder.get('files') != runtime['files']:
        raise RuntimeError('Loaded ASR decoder bytes differ from the bound model identity; transcribe again')
    decode = runtime['decode']
    options = getattr(info, 'transcription_options', None)
    verified = {}
    for name in BOUND_OPTIONS:
        if name in decode and hasattr(options, name):
            verified[name] = getattr(options, name)
            if verified[name] != decode[name]:
                raise RuntimeError(f'ASR decoder ran with {name}={verified[name]!r}, bound {decode[name]!r}')
    language = getattr(info, 'language', None)
    if decode.get('language') and language != decode['language']:
        raise RuntimeError(f'ASR decoder reported language {language!r}, bound {decode["language"]!r}')
    warnings = []
    if (decoder.get('device'), decoder.get('computeType')) != (runtime['device'], runtime['computeType']):
        warnings.append(f'ASR decoded on {decoder.get("device")}/{decoder.get("computeType")} instead of configured '
                        f'{runtime["device"]}/{runtime["computeType"]}; transcript numerics may differ')

    def number(name):
        try:
            value = float(getattr(info, name))
        except (AttributeError, TypeError, ValueError):
            return None
        return value if math.isfinite(value) else None
    return {'decoder': decoder, 'decodeOptionsVerified': verified, 'language': language,
            'languageProbability': number('language_probability'),
            'durationSeconds': number('duration'), 'speechSecondsAfterVad': number('duration_after_vad'),
            'vadApplied': (info.vad_options is not None) if hasattr(info, 'vad_options') else None,
            'provenanceModel': (runtime.get('modelProvenance') or {}).get('model'),
            'warnings': warnings}
