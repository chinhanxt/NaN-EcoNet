# OpenShorts engine

Private, one-job Python subprocess owned by NaN-Team's authenticated backend.
Run `python3 -u packages/openshorts-engine/src/worker.py`. The first stdin line
is `{ "type": "start", "request": ... }`. All stdout lines are protocol JSON;
legacy library diagnostics and tracebacks go to stderr. Cancellation belongs
to the parent, which terminates the worker's process group, including FFmpeg.

The request uses `operation: clips|edit`, backend absolute `sourcePath` and
`workDir`, `jobId`, `aspectRatio: 9:16|16:9|1:1`,
`layout: auto|general|wide|screencast|speaker-cut`,
`selection: {count,minSeconds,maxSeconds}`, optional
`segments: [{startSeconds,endSeconds}]`, `captions: {enabled,style}` and
`hook: {enabled,text?,style?}`. Edits default to the entire source; clips select
nonoverlapping windows by transcript or timestamped visual samples. Selection
and crop coordinates are validated against real media. Manual layouts fail
explicitly if their required runtime is unavailable.

Optional `effects` is a list of at most twelve `{type,start,end,strength}`
clip-local decisions. Allowed types: `zoom_in`, `punch_in`, `zoom_pulse`,
`color_pop`, `bw_moment`, `flash`, `vignette`. Core's deterministic renderer
caps strengths and overlapping zoom. `designBrief` requests those decisions
from AGY using frames. `cropOverrides` maps scene indices to normalized crop
centers or `{top,bottom}` centers; each stacked center is a number or `{x,y}`.

Caption styles: `karaoke`, `classic`, `neon`, `pop`, `box`.
Hook styles: `pill`, `classic`, `dark`, `yellow`, `red`, `outline`,
`outline_yellow`. `cleanPath` is saved before either overlay so a revision can
replace them. Backend revisions must use this clean asset for overlay changes.

Audio modes are `keep`, `mute`, `mix-narration`, `replace-narration`.
Backend-produced `narrationPath` and tenant-owned `bgmPath` must already be
staged inside workDir. Background music is attenuated and ducked against speech with FFmpeg sidechain compression;
no worker TTS or paid provider is invoked. Mixed narration keeps original speech captions. Replacement narration captions use
local ASR on the staged narration file and fail explicitly if word timings cannot be obtained.
Future aligned providers may supply `audio.narrationCaptions:
[{text,startMs,endMs}]` and `audio.narrationDurationSeconds`. Phrases preserve
the supplied timing boundaries and are checked against actual narration audio.
Proportional or estimated TTS timings must not be described as aligned timings.

AI messages: worker emits `{type:"ai-request",requestId,prompt,schema,
frames?:[{path,timestampSeconds}],role}`. Parent returns
`{type:"ai-result",requestId,data}` or `{type:"ai-error",requestId,message}`.
The parent uses **native AgyMcpService.analyzeJson**, including vision; no
Gemini/OpenAI-compatible HTTP key or gateway is used. The compatibility module
keeps upstream prompts and schemas while replacing local SDK calls. Whole-video
upstream requests become eight timestamped frames, so fast action between samples
may require additional sampling. Legacy JPEG-only helper calls lack timing data
and use timestamp zero; the worker's selection/layout/hook/effects paths sample
with measured timestamps.

Install requirements in a dedicated Python environment; FFmpeg and ffprobe
must be present. Tracking needs MediaPipe and local `YOLO_MODEL_PATH`.
ASR needs faster-whisper with pre-provisioned `WHISPER_MODEL` (local directory),
`WHISPER_DEVICE` and `WHISPER_COMPUTE`. ASR is offline and never downloads
models on startup. Manual wide/general and matching-aspect edits work with the
baseline runtime. `src/capabilities.py` reports observations, not model/service
health. TransNet, optional upstream CLI downloader, old unauthenticated web/MCP
servers and account infrastructure are deliberately excluded from the worker.

`source-manifest.json` records original and patched SHA-256 hashes. Source is
from the local OpenShorts checkout, with no upstream commit/license assertion.
The fonts snapshot includes the license text that exists in the source. No
`.env`, output/uploads, cache, model weights or API server were copied. Core
snapshot files retain upstream size; new adapter files stay below 500 lines.

Run `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/openshorts
-p 'test_*.py' -v` from the repository root. Tests exercise actual FFmpeg recut,
vertical output, effects, Vietnamese hook, silent vision RPC, transcript rebasing,
boundary validation and concurrent out-of-order AI responses. Speech ASR and
speaker tracking require provisioned models and are reported separately.

`phase: analyze` returns `{type:"result",phase:"analyze",plan,clips:[],warnings,
sourceFingerprint,engineFingerprint}`. The version-1 plan contains source
SHA-256, engine SHA-256, media metadata, source scene boundaries, transcript and
deterministic clip IDs with approved source-absolute segments, resolved layout,
hook, effects and optional clip-local screencast content ranges. The backend
persists the plan and may review title/segments/hook/layout. `phase: render`
requires that approved `plan` and checks its identity against actual source/code;
it runs no AI selection, layout, hook or effects calls. Source ASR remains local
if changed reviewed ranges require new timings. A retry gets a private attempt
directory. Within the same directory, validated SHA-256 checkpoints preserve
finished artifacts; a new attempt may regenerate deterministically from the plan.
Scene boundaries are persisted before rendering and rebased into output clips.
Speech selection expands to actual punctuation-delimited sentences or fails
explicitly when a complete sentence cannot fit; sparse visual clips do not claim
sentence completeness.

Private clean revision input is `reuse:{cleanPath,cleanSha256,sourceFingerprint,
baseFingerprint,sourceSegments,transcript,layout,designDecision?}`. The backend
stages the clean file inside the current attempt directory. Source ranges wholly
inside the parent edit list map into its concatenated timeline and use the core
fast recut; changed base settings or ranges outside that edit list render original
source with a warning. Transcript timestamps and scene boundaries are rebased.
Clean files already contain framing, effects and mixed audio. Result clips add
`renderMode`, `renderDecision`, `designDecision`, hashes and base fingerprint.
`designDecision.baseEffectsApplied` is true: a compositor may add overlays using
cleanPath but must not apply base effects twice. Without an inherited decision
receipt, reused effect details are reported as unknown (`effects:null`).

Backend limits default to 1 GiB input, 5 GiB work data and six hours source
duration. Configure `OPENSHORTS_MAX_INPUT_BYTES`, `OPENSHORTS_MAX_WORK_BYTES`,
`OPENSHORTS_MAX_DURATION_SECONDS`; private request `budgets` may only narrow
these values. Aggregate disk monitoring checks every 0.5 seconds and can overshoot
between checks; it is a soft limit, not a filesystem quota. Resource failures emit
`RESOURCE_LIMIT` and stop the worker process group. Docker caps memory/CPU/PIDs.
The backend should reserve disk space and enforce its durable concurrency limit.
`retention.cleanup_terminal_jobs` accepts explicit backend DB terminal candidates
and active IDs; it never guesses completion from age. Call while holding the
backend scheduling lease, include review-waiting jobs in active IDs, and use the
configured job root. The shared worker/root lock conservatively refuses cleanup
while any worker is active. No startup cleanup or automatic retention runs here.

For a host without ML dependencies, set the backend Python executable to the
absolute `packages/openshorts-engine/bin/docker-python` path. The adapter starts
one disposable, read-only, network-disabled container per process and preserves
absolute package/job paths for native MCP JPEG ingestion. It mounts only the
package, private job root and models. Ordinary process-group SIGTERM removes the
unique named container; SIGKILL cannot run a shell trap and requires host recovery.
Provision a local ML image containing FFmpeg, MediaPipe, Ultralytics and
faster-whisper, then pin its immutable image ID:

```bash
export OPENSHORTS_DOCKER_IMAGE="$(docker image inspect openshorts-backend --format '{{.Id}}')"
export SOURCE_VIDEO_PYTHON_BINARY=/absolute/repository/packages/openshorts-engine/bin/docker-python
export SOURCE_VIDEO_JOB_DIRECTORY=/absolute/backend/private/source-video-jobs
export OPENSHORTS_WHISPER_MODEL_DIRECTORY="$HOME/.local/share/nan-team/models/faster-whisper-tiny.en"
export OPENSHORTS_YOLO_MODEL_PATH="$HOME/.local/share/nan-team/models/yolov8n.pt"
export OPENSHORTS_DOCKER_CPUS=2
export OPENSHORTS_DOCKER_MEMORY=4g
```

Explicit one-time English test-model provisioning is available with
`python3 packages/openshorts-engine/bin/provision-models.py --destination
"$HOME/.local/share/nan-team/models" --yolo-source /absolute/trusted/yolov8n.pt`.
It fetches four pinned Hugging Face files with SHA-256 verification and copies
existing trusted YOLO weights. It is never invoked on worker startup. Provision
a multilingual ASR model separately for Vietnamese production speech. The local
image used in receipts is an existing installation, not a reproducible image
build supplied by this package; deployment must provision that runtime explicitly.

Optional runtime smoke with a separately provisioned local model:
`python3 tests/openshorts/runtime_smoke.py --image <local-image-with-ML-runtime>
--model-dir <local-faster-whisper-directory> --yolo <local-weights-file>`.
It launches disposable network-disabled containers with read-only source/model
mounts and temporary writable job data. It verifies actual speech subtitles,
manual crop and different replacement-narration captions with ducked BGM.
`runtime_layouts.py` additionally tests actual MediaPipe/camera inset and speaker
cuts using synthesized slides and duplicated NASA portrait mouth motion. Those
fixtures prove geometry and synthetic attribution, not general conversation or
live AI content accuracy. `runtime_cancel.py` verifies named-container removal.
