'use strict';
// Revisions, cancellation, history and ZIP on a completed MCP source job.
// Usage: node scripts/test-source-video-revisions-live.cjs <revisions-report-name> [--dry-run]
// The seed names baseReport (a completed report written by test-source-video-mcp-live.cjs)
// and an ordered list of revisions. Each revision's idempotency key and job id are persisted
// before dispatch, so rerunning resumes the same jobs. A terminal report is never overwritten.
//
// Revision seed fields:
//   label, input (ReviseSourceVideoDto minus jobId/clipId/expectedRevision/idempotencyKey),
//   segmentsFrom: 'base' | 'base-split'   (base-split = first and last 40% of the base clip, middle removed)
//   cropFirstTrackScene: 0..1              (cropOverrides on the first TRACK scene of the base render)
//   expect: { aspectRatio, engine, anyStrategy, speakerCuts: true }
//   cancelAtStage: 'rendering'             (cancel once this stage is observed; expects no Media)
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { reviewClip } = require('./source-video-live-review.cjs');
// Granular render stages reported by the engine since the progress rework.
const RENDER_STAGES=new Set(['render','rendering','cutting','reframing','applying-effects','mixing-audio','hook','captions','hook-captions','encoding','aligning-narration','synthesizing-narration']);
const callWithRetry=async(client,params)=>{for(let attempt=1;;attempt++){try{return await client.callTool(params,undefined,{timeout:120000});}catch(error){if(attempt>=4||!/fetch failed|ECONNRESET|socket|timed out/i.test(`${error.message} ${error.cause?.message||''}`))throw error;console.log(`retry ${params.name} after ${error.message}`);await new Promise(r=>setTimeout(r,2000*attempt));}}};
const root = path.resolve(__dirname, '..');
const reportName = process.argv[2];
assert.match(reportName || '', /^[a-z0-9-]+$/, 'Usage: test-source-video-revisions-live.cjs <report-name> [--dry-run]');
const reportsDir = path.join(root, 'reports/openshorts-integration');
const file = path.join(reportsDir, `${reportName}.json`);
const dryRun = process.argv.includes('--dry-run');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jobDirectory = () => process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(os.homedir(), '.local/share/nan-team/source-video-jobs');
const ASPECTS = { '9:16': 9 / 16, '16:9': 16 / 9, '1:1': 1 };

function validateSeed(report) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(report.baseReport || '')) errors.push('baseReport');
  if (!Array.isArray(report.revisions) || !report.revisions.length) errors.push('revisions');
  const labels = new Set();
  for (const item of report.revisions || []) {
    if (!item.label || labels.has(item.label)) errors.push(`label ${item.label}`); labels.add(item.label);
    const input = item.input || {};
    for (const forbidden of ['jobId', 'clipId', 'expectedRevision', 'mediaId', 'sourceUrl']) if (forbidden in input) errors.push(`${item.label}: input.${forbidden} is set by the harness`);
    if (input.aspectRatio && !ASPECTS[input.aspectRatio]) errors.push(`${item.label}: aspectRatio`);
    if (input.layout && !['auto', 'general', 'screencast', 'wide', 'speaker-cut'].includes(input.layout)) errors.push(`${item.label}: layout`);
    if (item.segmentsFrom && !['base', 'base-split'].includes(item.segmentsFrom)) errors.push(`${item.label}: segmentsFrom`);
    if (item.segmentsFrom && input.segments) errors.push(`${item.label}: segments and segmentsFrom are exclusive`);
    if (item.cancelAtStage && item.cancelAtStage !== 'rendering') errors.push(`${item.label}: cancelAtStage`);
    if (item.cancelAtStage && item !== report.revisions.at(-1)) errors.push(`${item.label}: cancellation must be the last revision`);
  }
  return errors;
}

async function main() {
  const report = JSON.parse(await fs.readFile(file, 'utf8'));
  if (report.passed === true || report.passed === false) {
    console.error(JSON.stringify({ refused: file, reason: 'terminal receipt is preserved; seed a new report name', passed: report.passed }));
    process.exitCode = 2; return;
  }
  const errors = validateSeed(report);
  const base = await fs.readFile(path.join(reportsDir, `${report.baseReport}.json`), 'utf8').then(JSON.parse).catch(() => undefined);
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, report: file, valid: !errors.length, errors,
      baseReport: report.baseReport, baseState: base ? { jobId: base.jobId || null, technicalPipelinePassed: base.technicalPipelinePassed ?? null } : 'missing (created by the base run)',
      revisions: report.revisions.map(item => ({ label: item.label, segmentsFrom: item.segmentsFrom, segments: item.input.segments, layout: item.input.layout, aspectRatio: item.input.aspectRatio, cropFirstTrackScene: item.cropFirstTrackScene, cancelAtStage: item.cancelAtStage, expect: item.expect })),
      wouldCall: ['editVideoClipTool per revision', 'sourceVideoStatusTool (poll)', 'cancelSourceVideoTool (cancel revision)', 'sourceVideoEvidenceTool crop-scenes', 'sourceVideoProjectsTool', 'sourceVideoDownloadTool + ZIP cross-org/401/400'] }, null, 1));
    if (errors.length) process.exitCode = 1; return;
  }
  assert.ok(!errors.length, errors.join('; '));
  assert.ok(base?.technicalPipelinePassed === true && base.final?.status === 'completed', 'Base report has no completed technical run');
  assert.equal(base.orgId, report.orgId || base.orgId);
  report.orgId = base.orgId; report.baseJobId = base.jobId; report.results ||= {};
  const save = async () => { report.observedAt = new Date().toISOString(); await fs.writeFile(file, JSON.stringify(report, null, 2) + '\n'); };
  await save();
  const { PrismaClient } = require('@prisma/client');
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const db = new PrismaClient(), client = new Client({ name: 'source-video-revisions-live', version: '1.0.0' }), temporaryKeys = [];
  const credential = async orgId => {
    const org = await db.organization.findUnique({ where: { id: orgId }, select: { apiKey: true } }); assert.ok(org);
    if (org.apiKey) return org.apiKey;
    const key = crypto.randomBytes(32).toString('hex');
    assert.equal((await db.organization.updateMany({ where: { id: orgId, apiKey: null }, data: { apiKey: key } })).count, 1);
    temporaryKeys.push({ orgId, key }); return key;
  };
  const call = async (name, args) => {
    const result = await callWithRetry(client, { name, arguments: args }); assert.notEqual(result.isError, true, `MCP transport error: ${name}`);
    const value = JSON.parse(result.content.filter(item => item.type === 'text').map(item => item.text).join('\n'));
    assert.ok(!value.error || ['failed', 'cancelled'].includes(value.status), `${name}: ${value.error}`); return value;
  };
  try {
    const endpoint = new URL('/mcp', process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000');
    assert.ok(['127.0.0.1', 'localhost'].includes(endpoint.hostname), 'Live fixture only permits a local backend');
    const key = await credential(report.orgId), headers = { Authorization: `Bearer ${key}` };
    await client.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers } }));
    const baseState = await call('sourceVideoStatusTool', { jobId: report.baseJobId });
    assert.equal(baseState.status, 'completed');
    const baseClip = baseState.clips[0];
    const baseReceipt = JSON.parse(await fs.readFile(path.join(jobDirectory(), report.baseJobId, 'receipt.json'), 'utf8'));
    const baseRender = baseReceipt.rendered.clips.find(item => item.clipId === baseClip.clipId) || baseReceipt.rendered.clips[0];
    let latestRevision = Math.max(baseState.revision, ...Object.values(report.results).map(item => item.revision || 0));

    for (const item of report.revisions) {
      const result = report.results[item.label] ||= { stages: [] };
      if (result.verified || result.cancelVerified) { continue; }
      if (!result.request) {
        const input = { ...item.input };
        if (item.segmentsFrom === 'base') input.segments = baseClip.segments;
        if (item.segmentsFrom === 'base-split') {
          assert.equal(baseClip.segments.length, 1, 'base-split needs a single-range base clip');
          const { startSeconds: s, endSeconds: e } = baseClip.segments[0], part = (e - s) * 0.4;
          input.segments = [{ startSeconds: s, endSeconds: +(s + part).toFixed(3) }, { startSeconds: +(e - part).toFixed(3), endSeconds: e }];
        }
        if (item.cropFirstTrackScene !== undefined) {
          // A manual crop overrides any automatic verdict (TRACK, ALTERNATE, GENERAL); prefer TRACK when present.
          const scenes = baseRender.renderDecision.scenes || [];
          const scene = scenes.find(entry => entry.strategy === 'TRACK') || scenes[0];
          assert.ok(scene, 'Base render has no scene for a manual crop');
          const manifest = await call('sourceVideoEvidenceTool', { jobId: report.baseJobId, clipId: baseClip.clipId, kind: 'crop-scenes', limit: 100 });
          assert.ok(manifest.items.some(entry => entry.sceneIndex === scene.sceneIndex), 'Crop manifest does not list the chosen scene');
          input.cropOverrides = { [String(scene.sceneIndex)]: item.cropFirstTrackScene };
          result.cropScene = scene;
        }
        result.request = { jobId: report.baseJobId, clipId: baseClip.clipId, expectedRevision: latestRevision, idempotencyKey: crypto.randomUUID(), ...input };
        await save();
      }
      if (!result.jobId) {
        const revised = await call('editVideoClipTool', result.request);
        assert.ok(revised.jobId, 'Revision was not created'); result.jobId = revised.jobId; await save();
      }
      const deadline = Date.now() + 20 * 60_000;
      let state;
      while (Date.now() < deadline) {
        state = await call('sourceVideoStatusTool', { jobId: result.jobId });
        const stage = `${state.status}:${state.stage}:${state.progress}`;
        if (result.stages.at(-1) !== stage) { result.stages.push(stage); await save(); console.log(`${item.label}:${stage}`); }
        if (item.cancelAtStage && !result.cancelRequestedAt && (state.stage === item.cancelAtStage || (item.cancelAtStage === 'rendering' && RENDER_STAGES.has(state.stage))) && state.status === 'running') {
          result.cancelResponse = await call('cancelSourceVideoTool', { jobId: result.jobId });
          result.cancelRequestedAt = new Date().toISOString(); await save();
        }
        if (['completed', 'failed', 'cancelled'].includes(state.status)) break;
        await sleep(item.cancelAtStage ? 250 : 2000);
      }
      assert.ok(state && ['completed', 'failed', 'cancelled'].includes(state.status), `${item.label}: observation timed out; rerun to resume`);
      result.final = state; result.revision = state.revision; latestRevision = Math.max(latestRevision, state.revision || 0); await save();
      const publications = await db.sourceVideoPublication.count({ where: { orgId: report.orgId, jobId: result.jobId, status: 'committed' } });
      if (item.cancelAtStage) {
        assert.ok(result.cancelRequestedAt, `${item.label}: job finished before the ${item.cancelAtStage} stage was observed; nothing was cancelled`);
        assert.equal(state.status, 'cancelled', `${item.label}: expected cancelled, got ${state.status}`);
        assert.equal(publications, 0, 'Cancelled revision published Media');
        assert.equal(state.clips.length, 0, 'Cancelled revision lists clips');
        result.cancelVerified = { stageAtCancel: item.cancelAtStage, publications, clips: 0 }; await save(); continue;
      }
      assert.equal(state.status, 'completed', state.error);
      const clip = state.clips[0]; assert.ok(clip?.media?.id);
      const media = await db.media.findFirst({ where: { id: clip.media.id, organizationId: report.orgId } }); assert.ok(media, 'Media outside organization');
      const receipt = JSON.parse(await fs.readFile(path.join(jobDirectory(), result.jobId, 'receipt.json'), 'utf8'));
      const rendered = receipt.rendered.clips.find(entry => entry.clipId === clip.clipId) || receipt.rendered.clips[0];
      assert.equal(hash(await fs.readFile(rendered.path)), clip.sha256, 'Delivered bytes differ from status sha256');
      const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', rendered.path], { encoding: 'utf8', timeout: 30_000 });
      assert.equal(probe.status, 0, probe.stderr);
      const metadata = JSON.parse(probe.stdout), video = metadata.streams.find(stream => stream.codec_type === 'video');
      const decoded = spawnSync('nice', ['-n', '15', 'ffmpeg', '-v', 'error', '-xerror', '-threads', '1', '-i', rendered.path, '-f', 'null', '-'], { encoding: 'utf8', timeout: 180_000 });
      assert.equal(decoded.status, 0, decoded.stderr);
      assert.equal(publications, 1, 'Expected one committed publication');
      const expectedDuration = (result.request.segments || clip.segments).reduce((total, segment) => total + segment.endSeconds - segment.startSeconds, 0);
      // The engine snaps user cut points to a speech pause within 1.5 s per edge (plan warnings record each move).
      assert.ok(Math.abs(Number(metadata.format.duration) - expectedDuration) < 3.1, `${item.label}: duration ${metadata.format.duration} vs ${expectedDuration}`);
      const decision = rendered.renderDecision || {};
      const strategies = [...new Set((decision.scenes || []).map(scene => scene.strategy))];
      const checks = {};
      if (item.expect?.aspectRatio) checks.aspectRatio = Math.abs(video.width / video.height - ASPECTS[item.expect.aspectRatio]) < 0.02;
      if (item.expect?.engine) checks.engine = decision.engine === item.expect.engine;
      if (item.expect?.anyStrategy) checks.anyStrategy = item.expect.anyStrategy.some(name => strategies.includes(name));
      if (item.expect?.speakerCuts) checks.speakerCuts = (decision.speakerCuts || []).length > 0;
      if (result.request.cropOverrides) checks.cropApplied = (decision.cropScenes || []).some(scene => String(scene.sceneIndex) in result.request.cropOverrides);
      result.artifact = { mediaId: media.id, sha256: clip.sha256, width: video.width, height: video.height, durationSeconds: Number(metadata.format.duration),
        audio: metadata.streams.some(stream => stream.codec_type === 'audio'), fullDecodePassed: true, committedPublications: publications,
        engine: decision.engine, strategies, speakerCuts: (decision.speakerCuts || []).length, cropScenes: decision.cropScenes, warnings: state.warnings };
      result.checks = checks;
      // Revisions recut the timeline, so only render faithfulness (captions vs clip transcript) and hook clearance apply.
      result.postRunReview = await reviewClip({ clip: rendered, input: receipt.input || result.request });
      result.functionalPassed = Object.values(checks).every(Boolean);
      result.verified = true; await save();
      console.log(JSON.stringify({ label: item.label, checks, artifact: result.artifact }));
    }

    // History + ZIP on the project (fn18), tenant boundaries on the base job.
    const projects = await call('sourceVideoProjectsTool', { limit: 25 });
    const listed = JSON.stringify(projects);
    report.history = { baseListed: listed.includes(report.baseJobId), revisionsListed: Object.values(report.results).filter(item => item.jobId).map(item => ({ jobId: item.jobId, listed: listed.includes(item.jobId) })) };
    assert.ok(report.history.baseListed, 'Base project missing from history');
    const links = await call('sourceVideoDownloadTool', { jobId: report.baseJobId });
    const zipUrl = new URL(links.downloadUrl); assert.equal(zipUrl.origin, endpoint.origin);
    const response = await fetch(zipUrl, { headers }); assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer()), scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'nan-revisions-zip-'));
    try {
      const zip = path.join(scratch, 'clips.zip'); await fs.writeFile(zip, bytes);
      const listedZip = spawnSync('python3', ['-c', 'import json,sys,zipfile,hashlib; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([{"name":i.filename,"sha256":hashlib.sha256(z.read(i)).hexdigest()} for i in z.infolist()]))', zip], { encoding: 'utf8', timeout: 60_000 });
      assert.equal(listedZip.status, 0, listedZip.stderr);
      const entries = JSON.parse(listedZip.stdout);
      assert.ok(entries.some(entry => entry.sha256 === baseClip.sha256), 'ZIP lacks the base clip bytes');
      const other = await db.userOrganization.findFirst({ where: { organizationId: { not: report.orgId }, disabled: false, user: { email: { endsWith: '@fixture.invalid' }, activated: true } }, select: { organizationId: true } });
      assert.ok(other, 'No second fixture organization for the tenant check');
      const denied = await fetch(zipUrl, { headers: { Authorization: `Bearer ${await credential(other.organizationId)}` } }); await denied.arrayBuffer();
      const anonymous = await fetch(zipUrl); await anonymous.arrayBuffer();
      assert.equal(denied.status, 404); assert.equal(anonymous.status, 401);
      report.zip = { sha256: hash(bytes), bytes: bytes.length, entries, crossOrgStatus: denied.status, missingAuthStatus: anonymous.status };
    } finally { await fs.rm(scratch, { recursive: true, force: true }); }
    const results = Object.values(report.results);
    report.technicalPipelinePassed = results.every(item => item.verified || item.cancelVerified);
    report.passed = report.technicalPipelinePassed && results.filter(item => item.verified).every(item => item.functionalPassed) &&
      (report.manualQualityReview ? report.manualQualityReview.passed === true : false);
    delete report.observationError; await save();
    console.log(JSON.stringify({ passed: report.passed, technicalPipelinePassed: report.technicalPipelinePassed, results: Object.fromEntries(Object.entries(report.results).map(([label, item]) => [label, item.checks || item.cancelVerified])), zip: report.zip }));
  } catch (error) { report.observationError = error.message; await save(); throw error; }
  finally {
    await client.close().catch(() => {});
    for (const { orgId, key } of temporaryKeys) await db.organization.updateMany({ where: { id: orgId, apiKey: key }, data: { apiKey: null } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
