'use strict';
// Post-run review of one delivered source-video clip, read-only on job files.
//  1. Hook clearance: tests/openshorts/artifact_harness.py on clean/final stages (clean/hook/final with KEEP_HOOK_STAGE),
//     every frame (<= 1/fps s, always finer than 0.25 s) with the engine face detector,
//     run in the provisioned OpenShorts image (no network, read-only mounts).
//  2. Captions vs transcript: burned ASS words against the clip transcript words
//     (order + karaoke start times), plus WER against a human reference when given.
// Standalone (offline, existing job):
//   node scripts/source-video-live-review.cjs --job <jobId> [--clip <clipId>] [--reference ref.txt]
//        [--no-faces] [--captions-only] [--output /abs/review.json]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const DEFAULT_IMAGE = 'sha256:bb3a5c5b38150730c8a3bde616d8a5f735de378d7c0f58d557655e08092e9d52';
const TIMING_TOLERANCE_SECONDS = 0.08;
const DEFAULT_MAX_WER = 0.1;

const jobDirectory = () => process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(os.homedir(), '.local/share/nan-team/source-video-jobs');
const normalize = text => String(text).normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').split(/\s+/).filter(Boolean);

function align(reference, hypothesis) {
  const n = reference.length, m = hypothesis.length;
  const d = Array.from({ length: n + 1 }, (_, i) => { const row = new Array(m + 1).fill(0); row[0] = i; return row; });
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1));
  const ops = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)) {
      ops.push({ op: reference[i - 1] === hypothesis[j - 1] ? 'match' : 'sub', i: i - 1, j: j - 1 }); i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ op: 'del', i: i - 1 }); i--; }
    else { ops.push({ op: 'ins', j: j - 1 }); j--; }
  }
  ops.reverse();
  const count = op => ops.filter(item => item.op === op).length;
  return { distance: d[n][m], substitutions: count('sub'), deletions: count('del'), insertions: count('ins'), ops,
    errorRate: n ? d[n][m] / n : (m ? 1 : 0) };
}

const assTime = value => { const [h, mm, s] = value.split(':'); return Number(h) * 3600 + Number(mm) * 60 + Number(s); };
function parseAss(text) {
  const words = [], blocks = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('Dialogue:')) continue;
    const fields = line.slice('Dialogue:'.length).split(',');
    const start = assTime(fields[1].trim()), end = assTime(fields[2].trim()), body = fields.slice(9).join(',');
    const highlighted = [...body.matchAll(/\{\\c&H[0-9A-Fa-f]+&\}([^{]*)\{\\r\}/g)].map(match => match[1]);
    const plain = normalize(body.replace(/\{[^}]*\}/g, ' ').replace(/\\N/g, ' '));
    if (highlighted.length) for (const word of normalize(highlighted.join(' '))) words.push({ word, start, end });
    else if (plain.length && blocks.at(-1)?.text !== plain.join(' ')) blocks.push({ text: plain.join(' '), start, end });
  }
  return words.length ? { mode: 'karaoke', words } : { mode: 'blocks', words: blocks.flatMap(block => block.text.split(' ').map(word => ({ word, start: block.start, end: block.end }))) };
}

function transcriptWords(transcript) {
  const out = [];
  for (const segment of transcript?.segments || []) for (const item of segment.words || [])
    for (const word of normalize(item.word)) out.push({ word, start: Number(item.start), end: Number(item.end) });
  return out;
}

async function newestAss(directory) {
  const names = (await fs.readdir(directory)).filter(name => name.endsWith('.ass'));
  const stats = await Promise.all(names.map(async name => ({ name, mtime: (await fs.stat(path.join(directory, name))).mtimeMs })));
  return stats.sort((a, b) => b.mtime - a.mtime)[0]?.name;
}

async function captionReview(clip, input, reference, maxWer) {
  if (!input?.captions?.enabled) return { applicable: false };
  const spoken = transcriptWords(clip.transcript);
  const assName = await newestAss(path.dirname(clip.path));
  const result = { applicable: true, transcriptWords: spoken.length, assFile: assName ? path.join(path.dirname(clip.path), assName) : null };
  if (!assName) return { ...result, passed: false, reason: 'No burned caption ASS next to the delivered clip' };
  const captions = parseAss(await fs.readFile(result.assFile, 'utf8'));
  const aligned = align(spoken.map(item => item.word), captions.words.map(item => item.word));
  const timing = captions.mode === 'karaoke' ? aligned.ops.filter(op => op.op === 'match')
    .map(op => ({ word: spoken[op.i].word, transcriptStart: spoken[op.i].start, captionStart: captions.words[op.j].start }))
    .filter(item => Math.abs(item.transcriptStart - item.captionStart) > TIMING_TOLERANCE_SECONDS) : [];
  const duration = Number(clip.durationSeconds);
  const outside = captions.words.filter(item => item.start < -1e-3 || item.end > duration + 0.05);
  Object.assign(result, { captionMode: captions.mode, captionWords: captions.words.length,
    captionVsTranscript: { distance: aligned.distance, substitutions: aligned.substitutions, deletions: aligned.deletions, insertions: aligned.insertions,
      examples: aligned.ops.filter(op => op.op !== 'match').slice(0, 20).map(op => ({ op: op.op, transcript: spoken[op.i]?.word, caption: captions.words[op.j]?.word })) },
    timingMismatches: timing.slice(0, 20), timingMismatchCount: timing.length, wordsOutsideClip: outside.length });
  result.renderFaithful = aligned.distance === 0 && timing.length === 0 && outside.length === 0;
  if (reference) {
    const ref = normalize(reference);
    const asr = align(ref, spoken.map(item => item.word)), burned = align(ref, captions.words.map(item => item.word));
    result.reference = { words: ref.length, maxWer, asrWer: asr.errorRate, captionWer: burned.errorRate,
      asrErrors: asr.ops.filter(op => op.op !== 'match').slice(0, 30).map(op => ({ op: op.op, reference: ref[op.i], asr: spoken[op.j]?.word })) };
    result.passed = result.renderFaithful && burned.errorRate <= maxWer;
  } else {
    result.reference = null;
    result.passed = false;
    result.reason = 'No human reference transcript: caption accuracy is unverified (render faithfulness only)';
  }
  return result;
}

// Hook + captions burn in ONE encode, so <clip>-hook.mp4 only exists with OPENSHORTS_KEEP_HOOK_STAGE=1.
// Without it the harness runs clean -> final -> final: "hook" pixels are clean-vs-final changes inside the
// hook rect, faces are detected on the clean (pre-hook) stage every frame, and the harness caption checks
// are vacuous, so the pass is decided here: no face box over the hook rect inside the hook window, and
// hook visible frames == ceil(D*fps) (+-1 frame) starting at frame 0.
// Every frame of the hook window + 0.5 s is checked (faces included); later frames are sampled. A hook still
// visible after its window fails the verdict on the first sampled frame, so faces there need no detection.
const SAMPLE_OUTSIDE_HOOK_SECONDS = 0.25;
const expandRuns = list => (list || []).flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));
function hookVerdict(audit, placement, stage) {
  if (stage === 'hook') return { passed: audit.passed === true && audit.continuousClearanceVerified === true,
    continuousClearanceVerified: audit.continuousClearanceVerified };
  const fps = Number(placement?.fps) || audit.fps, duration = Number(placement?.durationSeconds);
  const expected = Math.ceil(duration * fps - 1e-6);
  const visible = expandRuns(audit.hookVisibleFrames), window = visible.filter(index => index <= expected);
  const overFace = expandRuns(audit.hookOverFaceFrames).filter(index => index <= expected);
  const counts = Object.values(audit.probedFrames || {});
  const contiguous = window.length > 0 && window[0] === 0 && window.every((index, i) => index === i);
  const checks = { faceAudit: audit.faceAudit === true, noFaceUnderHook: overFace.length === 0,
    hookVisibleCountOk: Math.abs(window.length - expected) <= 1 && contiguous,
    frameCountsMatch: counts.length > 0 && counts.every(count => count === audit.frames) };
  const passed = Object.values(checks).every(Boolean);
  return { passed, continuousClearanceVerified: passed, expectedHookFrames: expected, hookVisibleCount: window.length,
    hookVisibleOutsideWindow: visible.length - window.length, hookOverFaceInWindow: overFace.length, checks };
}

function hookReview(clip, input, { faces = true, image } = {}) {
  if (!input?.hook?.enabled) return Promise.resolve({ applicable: false });
  return (async () => {
    const placement = clip.renderDecision?.hookPlacement;
    if (!placement) return { applicable: true, passed: false, reason: 'clip receipt has no renderDecision.hookPlacement' };
    const hookStage = clip.path.replace(/\.mp4$/, '-hook.mp4');
    const stage = await fs.access(hookStage).then(() => 'hook', () => 'clean-final');
    const hooked = stage === 'hook' ? hookStage : clip.path;
    for (const file of [clip.cleanPath, clip.path]) await fs.access(file);
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'nan-hook-review-'));
    try {
      const clipJson = path.join(scratch, 'clip.json');
      await fs.writeFile(clipJson, JSON.stringify({ renderDecision: clip.renderDecision, designDecision: clip.designDecision }));
      await fs.chmod(scratch, 0o755);
      const engine = path.join(root, 'packages/openshorts-engine'), tests = path.join(root, 'tests/openshorts');
      const yolo = process.env.OPENSHORTS_YOLO_MODEL_PATH || path.join(os.homedir(), '.local/share/nan-team/openshorts-models/yolov8n.pt');
      const imageId = image || process.env.OPENSHORTS_DOCKER_IMAGE || DEFAULT_IMAGE;
      const attempt = path.dirname(clip.path);
      const args = ['run', '--rm', '--init', '--network', 'none', '--read-only', '--user', `${process.getuid()}:${process.getgid()}`,
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--cpus', '1', '--memory', '2g', '--pids-limit', '256', '--tmpfs', '/tmp:rw,size=256m',
        '-e', 'OMP_NUM_THREADS=1', '-e', 'OPENBLAS_NUM_THREADS=1', '-e', 'MKL_NUM_THREADS=1', '-e', 'PYTHONDONTWRITEBYTECODE=1',
        '-e', 'YOLO_MODEL_PATH=/weights/yolo.pt', '-e', 'HOME=/tmp', '-e', 'USER=nan', '-e', 'LOGNAME=nan',
        ...['MPLCONFIGDIR', 'YOLO_CONFIG_DIR', 'TORCHINDUCTOR_CACHE_DIR', 'XDG_CACHE_HOME', 'TMPDIR'].flatMap(name => ['-e', `${name}=/tmp`]),
        '-v', `${engine}:${engine}:ro`, '-v', `${tests}:${tests}:ro`, '-v', `${attempt}:${attempt}:ro`, '-v', `${scratch}:${scratch}:ro`,
        '-v', `${yolo}:/weights/yolo.pt:ro`, imageId, 'python3', path.join(tests, 'artifact_harness.py'),
        clip.cleanPath, hooked, clip.path, clipJson, ...(faces ? ['--detect-faces'] : []), '--sample-outside-hook', String(SAMPLE_OUTSIDE_HOOK_SECONDS)];
      const run = spawnSync('nice', ['-n', '15', 'docker', ...args], { encoding: 'utf8', timeout: 900_000, maxBuffer: 20_000_000 });
      const start = run.stdout.indexOf('{');
      if (start < 0) return { applicable: true, passed: false, reason: 'artifact_harness produced no report', exitCode: run.status, stderr: String(run.stderr).slice(-2000) };
      const audit = JSON.parse(run.stdout.slice(start));
      return { applicable: true, stage, stages: { clean: clip.cleanPath, hooked, final: clip.path },
        method: (stage === 'hook' ? 'clean/hook/final diff' : 'hook = clean vs final inside hookPlacement rect during hook window')
          + `; every frame of hook window + 0.5 s (engine face detector on clean stage), then one frame per ${SAMPLE_OUTSIDE_HOOK_SECONDS} s`,
        scanIntervalSeconds: audit.fps ? 1 / audit.fps : null, sampleIntervalOutsideHookSeconds: SAMPLE_OUTSIDE_HOOK_SECONDS, scan: audit.scan, exitCode: run.status, ...hookVerdict(audit, placement, stage), audit };
    } finally { await fs.rm(scratch, { recursive: true, force: true }); }
  })();
}

async function reviewClip({ clip, input, reference, maxWer = DEFAULT_MAX_WER, faces = true, skipHook = false }) {
  const [hook, captions] = await Promise.all([
    (skipHook ? Promise.resolve({ applicable: true, passed: false, reason: 'hook scan skipped (--captions-only)' }) : hookReview(clip, input, { faces })).catch(error => ({ applicable: true, passed: false, reason: error.message })),
    captionReview(clip, input, reference, maxWer).catch(error => ({ applicable: true, passed: false, reason: error.message }))]);
  const parts = [hook, captions].filter(item => item.applicable);
  return { reviewedAt: new Date().toISOString(), clipId: clip.clipId, hookClearance: hook, captions,
    passed: parts.every(item => item.passed === true),
    note: 'Automated review can only fail or confirm a manual PASS; it never replaces manual review of pixels/audio.' };
}

async function loadRenderedClip(jobId, clipId) {
  const receipt = JSON.parse(await fs.readFile(path.join(jobDirectory(), jobId, 'receipt.json'), 'utf8'));
  const clips = receipt.rendered?.clips || [];
  const clip = clipId ? clips.find(item => item.clipId === clipId) : clips[0];
  assert.ok(clip, `No rendered clip in job ${jobId}`);
  return { receipt, clip };
}

async function main(argv) {
  const option = name => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; };
  const jobId = option('--job');
  assert.match(jobId || '', /^[0-9a-f-]{36}$/, 'Usage: --job <jobId> [--clip id] [--reference file] [--no-faces] [--output /abs/file.json]');
  const { receipt, clip } = await loadRenderedClip(jobId, option('--clip'));
  const referencePath = option('--reference');
  const review = await reviewClip({ clip, input: receipt.input, reference: referencePath ? await fs.readFile(referencePath, 'utf8') : undefined,
    maxWer: Number(option('--max-wer') || DEFAULT_MAX_WER), faces: !argv.includes('--no-faces'), skipHook: argv.includes('--captions-only') });
  const output = option('--output');
  if (output) {
    assert.ok(path.isAbsolute(output), '--output must be absolute');
    await fs.writeFile(output, JSON.stringify({ jobId, ...review }, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ jobId, passed: review.passed, hook: { passed: review.hookClearance.passed, continuous: review.hookClearance.continuousClearanceVerified, overFace: review.hookClearance.audit?.hookOverFaceFrames, reason: review.hookClearance.reason },
    captions: { passed: review.captions.passed, renderFaithful: review.captions.renderFaithful, distance: review.captions.captionVsTranscript?.distance, timingMismatchCount: review.captions.timingMismatchCount, reference: review.captions.reference && { asrWer: review.captions.reference.asrWer, captionWer: review.captions.reference.captionWer }, reason: review.captions.reason } }, null, 1));
}

module.exports = { reviewClip, loadRenderedClip, align, parseAss, normalize };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
