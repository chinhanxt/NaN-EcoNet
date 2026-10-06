"""Transcription backends: NVIDIA Parakeet (onnx-asr) with faster-whisper fallback.

Every caller goes through transcribe_media(), which returns the transcript
contract the whole pipeline depends on:

    {
      "text": str,          # full punctuated transcript
      "language": str,      # whisper-style short code ("es", "en", ...)
      "segments": [
        {"start": float, "end": float, "text": str,
         "words": [{"word": str, "start": float, "end": float}, ...]},
      ],
    }

Invariants the consumers rely on (clip cutting, karaoke subtitles, Remotion):
  - word["word"] carries a LEADING SPACE on true word starts; continuation
    fragments are merged into their base word (merge_continuation_words).
  - all numerics are native Python floats (json.dump of the transcript).
  - words sorted by start, segments chronological, absolute file timestamps.

TRANSCRIBE_BACKEND env: "whisper" (default) | "parakeet".
The parakeet path falls back to whisper automatically when the model errors,
produces no usable words, or the detected language is outside its 25
supported European languages (e.g. Japanese/Chinese/Arabic uploads).
GPU whisper in turn falls back to CPU whisper on CUDA errors (VRAM is shared
with other models on the host, so loads can OOM under load).
"""
import os
import subprocess
import sys
import tempfile
import threading
import time

try:
    from subtitles import (
        get_whisper_config,
        WHISPER_TRANSCRIBE_PARAMS,
        merge_continuation_words,
    )
except ImportError:
    DEFAULT_WHISPER_MODEL = "small"

    def get_whisper_config():
        """Return the faster-whisper model config, overridable via env vars."""
        return {
            "model_size": os.environ.get("WHISPER_MODEL", DEFAULT_WHISPER_MODEL),
            "device": os.environ.get("WHISPER_DEVICE", "cpu"),
            "compute_type": os.environ.get("WHISPER_COMPUTE", "int8"),
        }

    WHISPER_TRANSCRIBE_PARAMS = {
        "beam_size": 5,
        "vad_filter": True,
        "condition_on_previous_text": False,
        "word_timestamps": True,
    }

    def merge_continuation_words(words):
        merged = []
        for word in words:
            text = word.get("word", "")
            if merged and isinstance(text, str) and text and not text.startswith(" "):
                prev = merged[-1]
                prev["word"] = f"{prev.get('word', '')}{text}"
                if word.get("end") is not None:
                    prev["end"] = word["end"]
            else:
                merged.append(dict(word))
        return merged

PARAKEET_MODEL_ID = "nemo-parakeet-tdt-0.6b-v3"

# The 25 European languages parakeet-tdt-0.6b-v3 supports (ISO 639-1).
PARAKEET_LANGS = {
    "bg", "hr", "cs", "da", "nl", "en", "et", "fi", "fr", "de", "el", "hu",
    "it", "lv", "lt", "mt", "pl", "pt", "ro", "sk", "sl", "es", "sv", "ru",
    "uk",
}

# Serializes GPU transcription across concurrent jobs so N jobs can't stack
# N model contexts / decode batches in VRAM. CPU whisper stays ungated
# (CTranslate2 models are thread-safe and that matches the old behavior).
_ASR_SLOTS = int(os.environ.get("ASR_GPU_CONCURRENCY", "1"))
_ASR_GATE = threading.Semaphore(_ASR_SLOTS)


# Host-wide cap on GPU transcriptions, across job processes AND across the two
# containers of a deploy handover (the lock files live on the shared output/
# volume). _ASR_GATE above only serialises threads inside one process; every
# main.py job is its own process, so eight jobs could all load Parakeet at
# once. Peak per transcription is ~4-6 GB on a 20 GB card (prod, 22-sep-2026).
ASR_HOST_SLOTS = int(os.environ.get("ASR_HOST_SLOTS", "2"))
ASR_LOCK_DIR = os.environ.get("ASR_LOCK_DIR", "output")


class host_asr_slot:
    """``with host_asr_slot():`` holds one of ASR_HOST_SLOTS flock slots.

    Blocks (polling once a second) until a slot is free. A crashed holder
    releases its lock with its file descriptor, so a slot can never leak.
    Degrades to a no-op where flock or the directory is unavailable.
    """

    def __init__(self, slots=None, lock_dir=None, poll=1.0):
        self.slots = ASR_HOST_SLOTS if slots is None else slots
        self.lock_dir = lock_dir or ASR_LOCK_DIR
        self.poll = poll
        self._fh = None

    def __enter__(self):
        if self.slots <= 0:
            return self
        try:
            import fcntl
            os.makedirs(self.lock_dir, exist_ok=True)
        except Exception:
            return self
        announced = False
        while True:
            for i in range(self.slots):
                path = os.path.join(self.lock_dir, f".asr-gpu-{i}.lock")
                try:
                    fh = open(path, "a+")
                except OSError:
                    return self
                try:
                    fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    self._fh = fh
                    return self
                except OSError:
                    fh.close()
            if not announced:
                print("🎙️ Waiting for a free transcription slot…", flush=True)
                announced = True
            time.sleep(self.poll)

    def __exit__(self, *exc):
        if self._fh is not None:
            try:
                import fcntl
                fcntl.flock(self._fh, fcntl.LOCK_UN)
            except Exception:
                pass
            self._fh.close()
            self._fh = None
        return False


class _NullGate:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


_NULL_GATE = _NullGate()


# Optional callable(fraction 0..1) set by the NaN worker to stream ASR progress
# over its protocol channel; stdout lines here are redirected to stderr there.
progress_listener = None


class _TranscribeProgress:
    """Emits '🎙️ Transcribing… NN% (Xs)' lines at 25% steps.

    These are the only transcription lines cloud users see (log_view keeps
    them), so they must stay free of technical detail.
    """

    def __init__(self, total_seconds):
        self.total = max(float(total_seconds or 0), 0.0)
        self.started = time.time()
        self.next_pct = 25
        self.reported = -1

    def update(self, position_seconds):
        if self.total <= 0:
            return
        pct = min(int(position_seconds / self.total * 100), 100)
        listener = progress_listener
        if listener is not None and pct >= self.reported + 5:
            self.reported = pct
            listener(pct / 100)
        while pct >= self.next_pct and self.next_pct <= 100:
            elapsed = int(time.time() - self.started)
            print(f"🎙️ Transcribing… {self.next_pct}% ({elapsed}s)", flush=True)
            self.next_pct += 25

# --- whisper singleton ------------------------------------------------------

_whisper_model = None
_whisper_key = None
# asr_identity.loaded_decoder() receipt for _whisper_model, captured at load.
_whisper_decoder = None
_whisper_lock = threading.Lock()
# Set after a CUDA failure (e.g. VRAM exhausted by other models on the GPU)
# so every later transcription goes straight to CPU instead of re-failing.
_whisper_force_cpu = False


def _get_whisper_model():
    """Process-wide WhisperModel singleton, rebuilt if the env config changes.

    Keeping the model resident avoids a full reload per transcription (which
    on GPU would also mean re-allocating a couple of GB of VRAM per job).
    Returns (model, device, decoder identity of that model).
    """
    global _whisper_model, _whisper_key, _whisper_decoder
    cfg = get_whisper_config()
    if _whisper_force_cpu:
        cfg["device"] = "cpu"
        cfg["compute_type"] = "int8"
    import asr_identity
    model_files = tuple(sorted(asr_identity.current()["files"].items()))
    # large-v3-turbo on CPU: more threads buy little and starve the host; cap at 4.
    threads = max(1, min(4, int(os.environ.get("OPENSHORTS_THREADS", "1"))))
    key = (cfg["model_size"], cfg["device"], cfg["compute_type"], model_files, threads)
    with _whisper_lock:
        if _whisper_model is None or _whisper_key != key:
            from faster_whisper import WhisperModel
            _whisper_model = _whisper_key = _whisper_decoder = None
            model = WhisperModel(key[0], device=key[1], compute_type=key[2], local_files_only=True,
                                 cpu_threads=threads, num_workers=1)
            # The files were hashed before CTranslate2 read them; a swap in
            # between would make the receipt name weights that never decoded.
            if tuple(sorted(asr_identity.current()["files"].items())) != model_files:
                raise RuntimeError("ASR model files changed while loading; transcribe again")
            _whisper_model, _whisper_key = model, key
            _whisper_decoder = asr_identity.loaded_decoder(
                model, device=key[1], compute_type=key[2], files=model_files, threads=threads)
        return _whisper_model, cfg["device"], _whisper_decoder


def _whisper_device():
    return "cpu" if _whisper_force_cpu else get_whisper_config()["device"]


def _run_whisper_once(media_path, **params):
    gate = _ASR_GATE if _whisper_device() != "cpu" else _NULL_GATE
    # The model is fetched inside the gate: release_models() drains the gate
    # before unloading, so a transcription can never start on a model that is
    # being dropped underneath it.
    with gate:
        model, _device, decoder = _get_whisper_model()
        segments, info = model.transcribe(media_path, **params)
        progress = _TranscribeProgress(getattr(info, "duration", 0))
        materialized = []
        for segment in segments:
            materialized.append(segment)
            progress.update(segment.end)
        # VAD trims trailing silence, so the last segment can end short of the
        # media duration — force the 100% line.
        progress.update(progress.total)
        return materialized, info, decoder


def run_whisper_transcription(media_path, **params):
    """Transcribe and FULLY materialize the segments inside the GPU gate.

    Returns (segments_list, info); see _run_whisper_bound.
    """
    segments, info, _decoder = _run_whisper_bound(media_path, **params)
    return segments, info


def _run_whisper_bound(media_path, **params):
    """Transcribe and FULLY materialize the segments inside the GPU gate.

    faster-whisper returns a lazy generator — decoding happens while
    iterating, so the gate must wrap list(segments), not just transcribe().
    Returns (segments_list, info, decoder identity of the model that ran).

    A CUDA failure (model load OOM or mid-decode) retries once on CPU and
    pins CPU for the rest of the process — the GPU is shared with other
    models, so a job must degrade instead of dying when VRAM runs out.
    """
    global _whisper_model, _whisper_force_cpu
    try:
        return _run_whisper_once(media_path, **params)
    except RuntimeError as e:
        if _whisper_force_cpu or "cuda" not in str(e).lower():
            raise
        print(f"⚠️ [ASR] whisper GPU failed ({e}) — retrying on CPU", flush=True)
        _whisper_force_cpu = True
        with _whisper_lock:
            _whisper_model = None  # drop the GPU model to release its VRAM
        return _run_whisper_once(media_path, **params)


SAMPLE_RATE = 16000


def _load_audio(media_path):
    from faster_whisper.audio import decode_audio
    return decode_audio(media_path, sampling_rate=SAMPLE_RATE)


def speech_regions(audio, segmentation):
    """Silero VAD speech regions in seconds, short pauses kept as boundaries."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    options = VadOptions(threshold=segmentation['vadThreshold'], speech_pad_ms=0,
                         min_silence_duration_ms=segmentation['minSilenceMs'],
                         max_speech_duration_s=segmentation['maxClipSeconds'])
    return [[round(r['start']/SAMPLE_RATE, 3), round(r['end']/SAMPLE_RATE, 3)]
            for r in get_speech_timestamps(audio, options)]


def plan_clips(speech, duration, max_seconds, pad):
    """Group speech regions into decode clips of at most max_seconds that start and end in silence.

    Each clip boundary sits in a VAD pause (padded by up to `pad`, never past the
    middle of the pause), so no decoder window cuts a word. Only the media edges
    can still fall inside speech.
    """
    grouped = []
    for start, end in speech:
        if grouped and end - grouped[-1][0] <= max_seconds:
            grouped[-1][1] = end
        else:
            grouped.append([start, end])
    clips = []
    for index, (start, end) in enumerate(grouped):
        low = 0.0 if index == 0 else (grouped[index-1][1] + start)/2
        high = duration if index == len(grouped) - 1 else (end + grouped[index+1][0])/2
        clips.append([round(max(low, start - pad), 3), round(min(high, end + pad), 3)])
    return clips


def clip_remainder(segment, clips, limit):
    """True when faster-whisper re-decoded a sub-second leftover of a clip.

    With word timestamps faster-whisper restarts the next window at the last
    aligned word end, so the final ~0.1-0.5 s of a clip (padding plus the tail
    the aligner missed) is decoded alone. Whisper models then invent whole
    sentences ("thất bại.", "một ngày qua tôi khẳng định mình là không.").
    """
    window = float(getattr(segment, "seek", 0) or 0) * 0.01
    for start, end in clips:
        if start - 0.02 <= window < end:
            return window > start + 0.02 and end - window < limit
    return False


def _segment_record(segment):
    words = [
        {"word": w.word, "start": float(w.start), "end": float(w.end),
         "probability": float(w.probability)}
        for w in (segment.words or [])
    ]
    return {"start": float(segment.start), "end": float(segment.end),
            "text": segment.text, "words": merge_continuation_words(words)}


def _transcribe_with_whisper(media_path):
    import asr_identity
    import asr_quality
    runtime = asr_identity.current()
    plan = runtime["segmentation"]
    audio = _load_audio(media_path)
    speech = speech_regions(audio, plan)
    clips = plan_clips(speech, len(audio)/SAMPLE_RATE, plan["maxClipSeconds"], plan["padSeconds"])
    # [0, 0] decodes nothing: no speech, no invented text, but still a bound receipt.
    flat = [edge for clip in clips for edge in clip] or [0.0, 0.0]
    segments, info, decoder = _run_whisper_bound(audio, **runtime["decode"], clip_timestamps=flat)
    # The receipt must name the weights and options that actually decoded.
    binding = asr_identity.bind_decoder(runtime, decoder, info)
    used = getattr(getattr(info, "transcription_options", None), "clip_timestamps", None)
    if used is not None and [round(float(v), 3) for v in used] != flat:
        raise RuntimeError("ASR decoder ran with different clip boundaries than planned")

    raw_segments, kept, metrics, remainders = [], [], [], []
    for segment in segments:
        record = _segment_record(segment)
        measured = asr_quality.segment_metrics(segment)
        dropped = clip_remainder(segment, clips, plan["dropRemainderWindowsBelowSeconds"])
        raw_segments.append({**record, "metrics": measured, "seek": getattr(segment, "seek", None),
                             "dropped": "clip-remainder" if dropped else None})
        if dropped:
            remainders.append({"start": record["start"], "end": record["end"],
                               "text": record["text"].strip(), "words": len(record["words"])})
        else:
            kept.append(record)
            metrics.append(measured)

    quality = asr_quality.assess(kept, metrics, binding["durationSeconds"], trim=plan["trimSuspectedEndWindow"])
    out_segments, trimmed = (asr_quality.trim_end_window(kept, quality) if plan["trimSuspectedEndWindow"]
                             else (kept, []))
    quality["discarded"] = {"clipRemainders": remainders,
                            "endWindowWords": [str(w.get("word", "")).strip() for w in trimmed]}
    quality["wordsDiscarded"] += sum(item["words"] for item in remainders)
    quality["transcriptModified"] = bool(quality["transcriptModified"] or remainders)
    if remainders:
        excerpt = "; ".join(item["text"] for item in remainders)
        excerpt = excerpt if len(excerpt) <= 100 else excerpt[:97] + "..."
        quality["warnings"].insert(0, f"ASR dropped {len(remainders)} sub-second clip-remainder re-decode(s) "
                                      f'("{excerpt}"); raw decode kept in the ASR receipt')
    quality["warnings"] = binding.pop("warnings") + quality["warnings"]
    for warning in quality["warnings"]:
        print(f"⚠️ [ASR] {warning}", flush=True)
    return {
        "text": " ".join(seg["text"].strip() for seg in out_segments if seg["text"].strip()),
        "language": info.language,
        "asr": {"runtime": runtime, "actualDevice": decoder["device"], **binding,
                "segmentation": {"speechRegions": speech, "clips": clips},
                "rawSegments": raw_segments, "quality": quality},
        "segments": out_segments,
    }


# --- parakeet ---------------------------------------------------------------

_parakeet_model = None
_parakeet_lock = threading.Lock()


# How many VAD segments (up to 20 s each) the encoder takes per batch. The
# library default is 8; 4 cuts the peak VRAM of a transcription from ~6.1 to
# ~4.6 GB for the same words. Benchmarked in prod on 22-sep-2026 over 10 real
# user videos (40 min of audio, EN/ES/PT/FR-AR, 4,850 words): batch 4 changed
# 1 word outside the mixed-language clip (which goes to whisper in prod anyway),
# 0.1 ms mean timestamp drift, +3 s per 20-min video. Batch 2 saved another
# 0.5 GB but dropped a whole sentence; int8 was 11x slower on this GPU with
# 11.7% of words different. Don't go below 4 without re-running that check.
PARAKEET_VAD_BATCH = int(os.environ.get("PARAKEET_VAD_BATCH", "4"))


def parakeet_providers():
    """onnxruntime providers for Parakeet. The arena grows only by what is
    asked and cuDNN gets no oversized workspace: same numerics (identical
    transcripts in the benchmark), less memory held."""
    cuda_opts = {
        "arena_extend_strategy": "kSameAsRequested",
        "cudnn_conv_use_max_workspace": "0",
        "cudnn_conv_algo_search": "HEURISTIC",
    }
    return [("CUDAExecutionProvider", cuda_opts), "CPUExecutionProvider"]


def parakeet_session_options():
    """onnxruntime SessionOptions for Parakeet: pool threads sleep, never spin.

    By default every ORT pool thread busy-waits for its next op. On the CUDA
    path the CPU has almost nothing to do, so that spinning was the work:
    ~160 CPU-s for a 9-minute video, the biggest CPU cost of a whole job
    (prod bench 25-sep-2026). Without it: ~35 CPU-s, and the transcript is
    byte-identical (text and every word timestamp, 3 real videos).

    The VAD gets its own options (vad_load_kwargs).
    """
    import onnxruntime as rt
    opts = rt.SessionOptions()
    opts.add_session_config_entry("session.intra_op.allow_spinning", "0")
    opts.add_session_config_entry("session.inter_op.allow_spinning", "0")
    return opts


def vad_load_kwargs():
    """Silero VAD on the CPU, one sleeping thread.

    load_vad's default puts Silero on CUDA, where it runs one 32 ms chunk at a
    time with a host/device copy around each: most of a transcription's wall
    time. On one CPU thread the whole transcription is 2-3x faster (9 min of
    audio: 28 s -> 9 s) and cheaper in CPU too. The VAD's numbers are not
    bit-identical across devices: over 3 real videos (3,939 words) one word
    changed ("claudio" -> "cloud", for "Claude") and a few word times moved by
    up to 48 ms (bench, 25-sep-2026).
    """
    import onnxruntime as rt
    opts = rt.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1
    opts.add_session_config_entry("session.intra_op.allow_spinning", "0")
    opts.add_session_config_entry("session.inter_op.allow_spinning", "0")
    return {"sess_options": opts, "providers": ["CPUExecutionProvider"]}


def _get_parakeet_model():
    global _parakeet_model
    with _parakeet_lock:
        if _parakeet_model is None:
            import onnx_asr
            model = onnx_asr.load_model(PARAKEET_MODEL_ID, providers=parakeet_providers(),
                                        sess_options=parakeet_session_options())
            vad = onnx_asr.load_vad("silero", **vad_load_kwargs())
            _parakeet_model = model.with_vad(
                vad, batch_size=PARAKEET_VAD_BATCH).with_timestamps()
    return _parakeet_model


def release_models():
    """Drop the resident ASR models and hand their VRAM back to the GPU.

    main.py runs one job per process, so its singletons die with the job.
    The API process is different: ``/api/subtitle`` on a dubbed clip and the
    thumbnail studio transcribe in-process, and after the first such request
    the models sit in the long-lived uvicorn process for good. Measured in
    prod on 17-sep-2026: the API held 7.7 GB of a 20 GB GPU while idle
    (ctranslate2 whisper + onnxruntime CUDA parakeet + torch), and with eight
    jobs running alongside it NVENC could not open a session ("Generic error
    in an external library", exit 187, 0 bytes) and TransNetV2 hit CUDA OOM:
    5 of 12 jobs failed. The API calls this after each in-process
    transcription; a job process never needs to.

    Drains every gate slot first, so no transcription is mid-decode on the
    model being dropped, and both loaders fetch their model inside the gate.
    """
    global _whisper_model, _whisper_key, _whisper_decoder, _parakeet_model
    for _ in range(_ASR_SLOTS):
        _ASR_GATE.acquire()
    try:
        with _whisper_lock:
            whisper, _whisper_model, _whisper_key = _whisper_model, None, None
            _whisper_decoder = None
        with _parakeet_lock:
            parakeet, _parakeet_model = _parakeet_model, None
    finally:
        for _ in range(_ASR_SLOTS):
            _ASR_GATE.release()
    if whisper is not None:
        try:
            # ctranslate2 frees the weights on unload, not on garbage
            # collection: the Python wrapper can outlive the last reference.
            whisper.model.unload_model()
        except Exception as e:
            print(f"⚠️ [ASR] whisper unload failed ({type(e).__name__}: {e})")
    del whisper, parakeet
    # TransNetV2 is the other torch tenant an in-process pipeline leaves
    # behind (scene_detection keeps it as a module singleton too).
    tn2 = sys.modules.get("scene_detection")
    if tn2 is not None:
        tn2._tn2_model = None
    import gc
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    if "onnxruntime" in sys.modules or "faster_whisper" in sys.modules:
        print("🧹 [ASR] resident models released")


def _extract_wav(media_path):
    """Parakeet wants 16kHz mono PCM wav; ffmpeg-extract to a temp file."""
    fd, wav_path = tempfile.mkstemp(suffix=".wav", prefix="asr_")
    os.close(fd)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", media_path,
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav_path,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.PIPE, timeout=1800)
    return wav_path


def _words_from_tokens(tokens, timestamps, seg_start, seg_end):
    """Group parakeet BPE tokens into words with absolute timestamps.

    Verified on the prod model: tokens already carry the leading-space
    word-start convention (" T", "odo", " el", ...) and timestamps are token
    START times in seconds relative to the VAD segment. A token without a
    leading space (subword continuations, punctuation like ",") belongs to
    the previous word — same semantics merge_continuation_words expects.
    Word end is inferred: next word's start, capped near the word's last
    token so a long inter-word silence doesn't stretch the highlight.
    """
    words = []
    last_token_ts = []
    for token, ts in zip(tokens, timestamps):
        if not token:
            continue
        abs_ts = float(ts) + seg_start
        if token.startswith(" ") or not words:
            words.append({
                "word": token if token.startswith(" ") else " " + token,
                "start": abs_ts,
            })
            last_token_ts.append(abs_ts)
        else:
            words[-1]["word"] += token
            last_token_ts[-1] = abs_ts

    for i, word in enumerate(words):
        next_start = words[i + 1]["start"] if i + 1 < len(words) else seg_end
        cap = last_token_ts[i] + 0.6
        word["end"] = float(max(word["start"] + 0.05, min(next_start, cap)))

    return words


def _transcribe_with_parakeet(media_path):
    wav_path = _extract_wav(media_path)
    try:
        # 16kHz mono s16le wav -> 32000 bytes per second of audio.
        try:
            duration = os.path.getsize(wav_path) / 32000.0
        except OSError:
            duration = 0.0
        with _ASR_GATE:
            model = _get_parakeet_model()  # inside the gate: see release_models
            progress = _TranscribeProgress(duration)
            results = []
            for seg in model.recognize(wav_path):
                results.append(seg)
                progress.update(float(seg.end))
            progress.update(progress.total)
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass

    out_segments = []
    text_parts = []
    for seg in results:
        seg_start = float(seg.start)
        seg_end = float(seg.end)
        seg_text = str(seg.text or "").strip()
        if not seg_text:
            continue
        out_segments.append({
            "start": seg_start,
            "end": seg_end,
            "text": seg_text,
            "words": _words_from_tokens(
                list(seg.tokens or []), list(seg.timestamps or []),
                seg_start, seg_end,
            ),
        })
        text_parts.append(seg_text)

    text = " ".join(text_parts)
    return {
        "text": text,
        "language": _detect_language(text),
        "segments": out_segments,
    }


def _detect_language(text):
    """Parakeet doesn't report a language; classify the transcribed text.

    py3langid is pure-Python and returns ISO 639-1 codes compatible with the
    whisper codes the pipeline expects (thumbnail titles, Gemini prompts).
    """
    sample = (text or "").strip()
    if len(sample) < 20:
        return "en"
    try:
        import py3langid
        lang, _score = py3langid.classify(sample[:4000])
        return lang
    except Exception:
        return "en"


def _parakeet_fallback_reason(transcript, duration_hint=None):
    """Return why the parakeet result is untrustworthy, or None if it's fine."""
    segments = transcript.get("segments") or []
    total_words = sum(len(s.get("words") or []) for s in segments)
    if total_words == 0:
        return "no words recognized"
    language = transcript.get("language")
    if language not in PARAKEET_LANGS:
        return f"language '{language}' outside parakeet's supported set"
    duration = duration_hint or (segments[-1]["end"] if segments else 0)
    # Real speech averages >100 wpm; under ~12 wpm on a long video means the
    # audio was mostly not recognized (e.g. unsupported language or music).
    if duration > 60 and total_words < duration * 0.2:
        return f"only {total_words} words in {duration:.0f}s of audio"
    return None


# --- public entry point -----------------------------------------------------

class NoAudioError(Exception):
    """The media has no audio track — nothing to transcribe."""


def _has_audio_stream(media_path) -> bool:
    """True if the file has at least one audio stream (ffprobe)."""
    import subprocess
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=index", "-of", "csv=p=0", media_path],
            capture_output=True, text=True, timeout=60,
        )
        return bool(out.stdout.strip())
    except Exception:
        return True  # probe failed — don't block, let the backend try


def transcribe_media(media_path):
    """Transcribe with the configured backend, falling back to whisper."""
    # Silent videos (AI-generated clips, muted screen recordings) have no audio
    # stream; every ASR backend then crashes deep inside libav with an opaque
    # "tuple index out of range". Detect it up front and fail with a clear,
    # actionable reason instead.
    if not _has_audio_stream(media_path):
        raise NoAudioError(
            "This video has no audio track. OpenShorts finds viral moments from "
            "speech, so it needs a video with audio.")

    backend = os.environ.get("TRANSCRIBE_BACKEND", "whisper").strip().lower()

    if backend == "parakeet":
        try:
            transcript = _transcribe_with_parakeet(media_path)
            reason = _parakeet_fallback_reason(transcript)
            if reason is None:
                print(f"🎙️ [ASR] parakeet ok: lang={transcript['language']} "
                      f"segments={len(transcript['segments'])}")
                return transcript
            print(f"⚠️ [ASR] parakeet result rejected ({reason}) — "
                  f"falling back to whisper")
        except Exception as e:
            print(f"⚠️ [ASR] parakeet failed ({type(e).__name__}: {e}) — "
                  f"falling back to whisper")

    return _transcribe_with_whisper(media_path)
