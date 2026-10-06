# Vietnamese source transcription

The engine transcribes source speech with
[`mobiuslabsgmbh/faster-whisper-large-v3-turbo`](https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo)
(CTranslate2 conversion of OpenAI Whisper large-v3-turbo, MIT) at pinned
revision `0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf`, loaded as INT8 on CPU.
It replaced PhoWhisper-small, which misrecognised "Covid" and "chữa lành" on
the Vietcetera fixture. Voice Clone remains the separate narration service.

## Provision once

Operator-only; workers run offline and never download weights.

```bash
python3 packages/openshorts-engine/bin/provision-models.py \
  --destination /absolute/external/openshorts-models --yolo-source /path/yolov8n.pt
```

It downloads the five pinned files (model.bin 1.6 GB) into
`faster-whisper-large-v3-turbo/` and checks every SHA-256 against
`asr_identity.PINNED`.

## Runtime

```text
OPENSHORTS_WHISPER_MODEL_DIRECTORY=/absolute/external/openshorts-models/faster-whisper-large-v3-turbo
WHISPER_LANGUAGE=vi
OPENSHORTS_THREADS=2          # engine caps at 4
OPENSHORTS_DOCKER_CPUS=2
OPENSHORTS_DOCKER_MEMORY=3g
```

These are the defaults in `config/dev-native.sh`. `bin/docker-python` mounts
the directory read-only at `/models/whisper`. The engine image has
faster-whisper 1.2.1 / CTranslate2 4.8.2.

The ASR identity (`asr_identity.current()`) holds the hashes of the model files,
the pinned model name and revision (a file that differs from the pin is
refused), decode options, segmentation policy and runtime versions. Any
change invalidates old analysis and approved plans.

## Decoding on silence-bounded clips

faster-whisper's built-in VAD needs a 2 s pause to split speech, so continuous
dialogue became one region decoded in fixed 30 s windows that cut words. With
word timestamps the next window restarts at the last aligned word end, and the
sub-second leftover decoded alone yields invented sentences ("thất bại.",
"một ngày qua ..."). The engine therefore:

1. runs Silero VAD itself (300 ms pauses, no padding) and groups speech into
   clips of at most 25 s whose edges sit in pauses (`plan_clips`);
2. decodes them with `clip_timestamps` (faster-whisper VAD off, beam 5,
   `condition_on_previous_text=False`, default temperature fallback);
3. drops segments decoded from a sub-second leftover after a clip's first
   window (`clip-remainder`);
4. trims the narrowest end-window span that `asr_quality` suspects with at
   least two evidence kinds.

Captions and hook prompts use the cleaned `segments`. `asr.rawSegments` keeps
every decoded segment with metrics and drop reason; `asr.quality.discarded`
lists what was removed.

For `edit` jobs, analysis snaps each requested source cut that falls inside
speech to the nearest VAD pause within 1.5 s, else to the nearest word
boundary; a word clipped by the media start or end is excluded. Each move is
reported in the plan warnings.

## Evidence and limits

- `reports/openshorts-integration/turbo-silence-clips/receipt.json`: production
  path, 30 s cut, 2 threads. "sau Covid" and "chữa lành" are correct, and no
  remainder or tail was dropped or needed.
- `reference-turbo-vietcetera.json`: the user-chosen temporary 60 s reference
  (turbo, not human-verified); `scripts/reference-range.py` extracts a range.
- `phowhisper-decode-variants/receipt.json`: the earlier 16-run PhoWhisper-small
  comparison that established the silence-clip design.

Names are still misspelled ("Minh Điệm" for Minh Niệm, "Vietcetra"). There is no
human reference transcript, and `asr_quality` thresholds come from one fixture.
Process RSS peaked at about 2.4 GB for a 30 s decode.
