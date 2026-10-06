'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const root = path.resolve(__dirname, '..');
const { reviewClip } = require('./source-video-live-review.cjs');
// Usage: node scripts/test-source-video-mcp-live.cjs <report-name> [--dry-run]
// The report file may be pre-seeded (orgId, sourceMediaId, sourceSha256, input, ...).
// A report that already reached a terminal verdict is never re-run or overwritten.
const reportName = process.argv[2] || 'live-public-mcp-job';
const dryRun = process.argv.includes('--dry-run');
assert.match(reportName, /^[a-z0-9-]+$/, 'Report name must be a safe local filename');
const reportPath = path.join(root, `reports/openshorts-integration/${reportName}.json`);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const fixture = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-job.json'), 'utf8'));
  let report = await fs.readFile(reportPath, 'utf8').then(JSON.parse, error => {
    if (error.code !== 'ENOENT') throw error;
    return { kind: 'authenticated-public-mcp-source-video-lifecycle', orgId: fixture.orgId,
      sourceSha256: fixture.sourceSha256, stages: [],
      input: { mediaId: fixture.sourceMediaId, idempotencyKey: crypto.randomUUID(), operation: 'edit',
        aspectRatio: '16:9', layout: 'wide', segments: [{ startSeconds: 0, endSeconds: 12 }],
        captions: { enabled: false }, audio: { mode: 'keep' },
        hook: { enabled: true, style: 'yellow' }, reviewBeforeRender: true } };
  });
  if (report.passed === false || report.technicalPipelinePassed === true || report.passed === true) {
    console.error(JSON.stringify({ refused: reportPath, reason: 'terminal receipt is preserved; seed a new report name', passed: report.passed, jobId: report.jobId }));
    process.exitCode = 2; return;
  }
  if (dryRun) { await validateSeed(report); return; }
  const save = async () => { report.observedAt = new Date().toISOString(); await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); };
  // Persist the idempotency key before dispatch; subsequent invocations resume the same job.
  await save();
  const prisma = new PrismaClient();
  const client = new Client({ name: 'source-video-public-mcp-lifecycle', version: '1.0.0' });
  let temporaryKey;
  const call = async (name, args) => {
    let result;
    for (let attempt = 1; ; attempt++) {
      try { result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 }); break; }
      catch (error) {
        // Idle keep-alive sockets closed by the server surface as undici "fetch failed"; status calls are read-only and idempotent.
        if (attempt >= 4 || !/fetch failed|ECONNRESET|socket|timed out/i.test(`${error.message} ${error.cause?.message || ''}`)) throw error;
        console.log(`retry ${name} after ${error.message}${error.cause ? ` (${error.cause.code || error.cause.message})` : ''}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
    assert.notEqual(result.isError, true, `MCP transport tool error: ${name}`);
    const texts = result.content.filter(item => item.type === 'text').map(item => item.text);
    const parsed = texts.map(text => { try { return JSON.parse(text); } catch { return undefined; } }).find(value => value && typeof value === 'object');
    assert.ok(parsed, `MCP ${name} did not return structured JSON`);
    return parsed;
  };
  try {
    const org = await prisma.organization.findUnique({ where: { id: report.orgId }, select: { id: true, apiKey: true } });
    assert.ok(org, 'Fixture organization is missing');
    temporaryKey = org.apiKey ? undefined : crypto.randomBytes(32).toString('hex');
    if (temporaryKey) {
      const updated = await prisma.organization.updateMany({ where: { id: org.id, apiKey: null }, data: { apiKey: temporaryKey } });
      assert.equal(updated.count, 1, 'Fixture API key changed concurrently');
    }
    const url = new URL('/mcp', process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000');
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Live fixture only permits a local backend');
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${temporaryKey || org.apiKey}` } } }));
    report.capabilities = await call('sourceVideoCapabilitiesTool', {});
    assert.equal(report.capabilities.prerequisitesPresent, true, 'OpenShorts prerequisites are missing');
    if (!report.jobId) {
      const started = await call('processSourceVideoTool', report.input);
      assert.ok(started.jobId, `MCP start failed: ${started.error}`);
      report.jobId = started.jobId; report.projectId = started.projectId; await save();
      console.log(JSON.stringify({ jobId: report.jobId, idempotentResume: true }));
    }
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      const state = await call('sourceVideoStatusTool', { jobId: report.jobId });
      assert.ok(!state.error || state.status === 'failed', state.error);
      const stage = `${state.status}:${state.stage}:${state.progress}`;
      if (report.stages.at(-1) !== stage) { report.stages.push(stage); await save(); console.log(stage); }
      if (state.status === 'awaiting_approval') {
        assert.ok(state.plan?.planVersion > 0 && state.plan.clips.length === 1, 'Review plan missing');
        report.reviewPlan = state.plan; await save();
        const clip = state.plan.clips[0];
        assert.equal(clip.aspectRatio, report.input.aspectRatio);
        if (report.input.layout !== 'auto') assert.equal(clip.layout, report.input.layout);
        assert.ok(clip.hook, 'Grounded hook is missing');
        if (!report.staleApproval) {
          report.staleApproval = await call('approveSourceVideoTool', { jobId: report.jobId, expectedPlanVersion: state.plan.planVersion + 1 });
          assert.equal(report.staleApproval.statusCode, 409, 'Stale approval was not rejected');
          await save();
        }
        // Explicit fixture approval, limited to this locally created test job.
        const approval = { jobId: report.jobId, expectedPlanVersion: state.plan.planVersion,
          clips: [{ clipId: clip.clipId, title: report.expectedTitle || 'MCP reviewed water-saving clip', segments: clip.segments }] };
        const approved = await call('approveSourceVideoTool', approval);
        assert.ok(!approved.error, approved.error);
        report.approval = approval; await save();
      }
      if (['completed', 'failed', 'cancelled'].includes(state.status)) {
        report.final = state; await save();
        assert.equal(state.status, 'completed', state.error || 'Job did not complete');
        const clip = state.clips[0]; assert.ok(clip?.media?.id);
        if (report.approval) assert.equal(clip.title, report.expectedTitle || 'MCP reviewed water-saving clip');
        const media = await prisma.media.findFirst({ where: { id: clip.media.id, organizationId: report.orgId } });
        assert.ok(media, 'Published Media does not belong to the fixture organization');
        const pathname = new URL(media.path).pathname;
        assert.ok(pathname.startsWith('/uploads/source-video/'));
        const storage = path.resolve(process.env.UPLOAD_DIRECTORY);
        const file = path.resolve(storage, decodeURIComponent(pathname.slice('/uploads/'.length)));
        assert.ok(file.startsWith(storage + path.sep));
        const bytes = await fs.readFile(file); assert.equal(hash(bytes), clip.sha256);
        const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8', timeout: 30_000 });
        assert.equal(probe.status, 0, probe.stderr);
        const metadata = JSON.parse(probe.stdout), video = metadata.streams.find(stream => stream.codec_type === 'video');
        const [ratioWidth,ratioHeight]=report.input.aspectRatio.split(':').map(Number);
        assert.ok(video && Math.abs(video.width / video.height - ratioWidth / ratioHeight) < 0.02);
        // AI-selected clips: the approved plan segments, not a fixed fixture length, define the expected duration.
        const expectedDuration = report.input.operation === 'clips'
          ? clip.segments.reduce((total, item) => total + item.endSeconds - item.startSeconds, 0)
          : (report.expectedDurationSeconds || 12);
        if (report.input.operation === 'clips') report.derivedExpectedDurationSeconds = expectedDuration;
        assert.ok(Math.abs(Number(metadata.format.duration) - expectedDuration) < 0.25, `Duration ${metadata.format.duration} differs from expected ${expectedDuration}`);
        assert.equal(metadata.streams.some(stream => stream.codec_type === 'audio'), !!report.expectedAudio, 'Output audio presence differs from source request');
        const decoded = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-threads','1','-filter_threads','1','-i', file, '-threads','1','-f', 'null', '-'], { encoding: 'utf8', timeout: 120_000 });
        assert.equal(decoded.status, 0, decoded.stderr);
        const publications = await prisma.sourceVideoPublication.count({ where: { jobId: report.jobId, orgId: report.orgId, status: 'committed' } });
        assert.equal(publications, 1, 'Expected one committed publication');
        const jobDirectory = process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(process.env.HOME, '.local/share/nan-team/source-video-jobs');
        const receipt = JSON.parse(await fs.readFile(path.join(jobDirectory, report.jobId, 'receipt.json'), 'utf8'));
        assert.equal(receipt.sourceSha256, report.sourceSha256);
        const deliveredPlan=receipt.approvedPlan || receipt.plan;
        assert.equal(deliveredPlan.clips[0].title, clip.title);
        const evidence = (receipt.agyReceipts || []).filter(item => item.role === 'content-editor');
        const verifiedNative = evidence.filter(item => item.mcpCalls?.some(call => call.tool === 'read_frame') && item.mcpCalls?.some(call => call.tool === 'submit_result') && item.policyDecisions?.some(item => item.tool === 'view_file' && item.phase === 'post' && item.success));
        assert.ok(verifiedNative.length, 'Native hook has no frame-read and submitted-result evidence');
        if(process.env.EXPECTED_AGY_PROVIDER_URL){
          assert.ok(verifiedNative.some(item=>item.providerHash===hash(process.env.EXPECTED_AGY_PROVIDER_URL)), 'Native task did not use the expected provider route');
          report.verifiedProviderRoute=process.env.EXPECTED_AGY_PROVIDER_URL;
        }
        const frameHash = filename => {
          const frame = spawnSync('ffmpeg', ['-v', 'error', '-threads','1','-filter_threads','1','-ss', '1', '-i', filename, '-frames:v', '1', '-threads','1','-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { timeout: 30_000, maxBuffer: 10_000_000 });
          assert.equal(frame.status, 0, String(frame.stderr)); return hash(frame.stdout);
        };
        const cleanPath = receipt.rendered?.clips?.[0]?.cleanPath;
        assert.ok(cleanPath, 'Clean clip is missing');
        const cleanFrameHash = frameHash(cleanPath), finalFrameHash = frameHash(file);
        assert.notEqual(cleanFrameHash, finalFrameHash, 'Hook overlay did not change video bytes at one second');
        report.artifact = { mediaId: media.id, sha256: clip.sha256, bytes: bytes.length, width: video.width, height: video.height,
          durationSeconds: Number(metadata.format.duration), audio:!!report.expectedAudio, fullDecodePassed: true, committedPublications: publications,
          nativeAgyTaskIds: verifiedNative.map(item => item.jobId),
          failedNativeAttempts: evidence.filter(item => item.status === 'failed').map(item => ({jobId:item.jobId,failureCategory:item.failureCategory})),
          hookEvidence:{text:deliveredPlan.clips[0].hook,cleanFrameHash,finalFrameHash} };
        const observedSourceFiles = {};
        for (const relative of ['packages/agy-mcp-runner/index.cjs', 'libraries/nestjs-libraries/src/chat/tools/approve.source.video.tool.ts', 'libraries/nestjs-libraries/src/chat/tools/source.video.status.tool.ts', 'libraries/nestjs-libraries/src/videos/openshorts/source-video.service.ts', 'packages/openshorts-engine/src/worker.py']) {
          observedSourceFiles[relative] = hash(await fs.readFile(path.join(root, relative)));
        }
        if(!report.sourceFiles)report.sourceFiles=observedSourceFiles;
        else report.artifactVerificationSourceFiles=observedSourceFiles;
        report.technicalPipelinePassed = true;
        // Continuous hook clearance (every frame, <= 0.25 s) and burned captions vs transcript/reference.
        const renderedClip = (receipt.rendered?.clips || []).find(item => item.clipId === clip.clipId) || receipt.rendered?.clips?.[0];
        const reference = report.referenceTranscriptPath ? await fs.readFile(path.resolve(root, report.referenceTranscriptPath), 'utf8') : undefined;
        report.postRunReview = await reviewClip({ clip: renderedClip, input: receipt.input || report.input, reference, maxWer: report.maxReferenceWer });
        report.passed = report.postRunReview.passed === true &&
          (report.manualQualityReview ? report.manualQualityReview.passed === true : true);
        delete report.observationError; await save();
        console.log(JSON.stringify(report.artifact)); return;
      }
      await delay(2000);
    }
    report.observationPaused = true; await save();
    console.log(JSON.stringify({ jobId: report.jobId, observationPaused: true, resume: 'Run this script again to observe the same job' }));
  } catch (error) {
    report.observationError = error.message; await save(); throw error;
  } finally {
    await client.close().catch(() => {});
    if (temporaryKey) await prisma.organization.updateMany({ where: { id: report.orgId, apiKey: temporaryKey }, data: { apiKey: null } });
    await prisma.$disconnect();
  }
}
// Offline seed check: no network, database or job dispatch.
async function validateSeed(report) {
  const input = report.input || {};
  const errors = [];
  if (!/^[0-9a-f-]{36}$/.test(report.orgId || '')) errors.push('orgId');
  if (!/^[0-9a-f]{64}$/.test(report.sourceSha256 || '')) errors.push('sourceSha256');
  if (!input.mediaId || input.mediaId !== report.sourceMediaId) errors.push('input.mediaId must equal sourceMediaId');
  if (!input.idempotencyKey) errors.push('input.idempotencyKey');
  if (!['clips', 'edit'].includes(input.operation)) errors.push('operation');
  if (!['9:16', '16:9', '1:1'].includes(input.aspectRatio)) errors.push('aspectRatio');
  if (!['auto', 'general', 'screencast', 'wide', 'speaker-cut'].includes(input.layout)) errors.push('layout');
  if (input.operation === 'clips') {
    const selection = input.selection || {};
    if (selection.count !== 1) errors.push('harness verifies exactly one clip: selection.count must be 1');
    if (!(selection.minSeconds >= 10 && selection.maxSeconds <= 180 && selection.minSeconds <= selection.maxSeconds)) errors.push('selection bounds (10..180)');
  } else if (!Array.isArray(input.segments) || !input.segments.length) errors.push('edit needs segments');
  if (input.reviewBeforeRender !== true) errors.push('reviewBeforeRender must be true (stale-approval check)');
  if (!input.hook?.enabled) errors.push('harness requires hook.enabled (clean vs final frame check)');
  if (typeof report.expectedAudio !== 'boolean') errors.push('expectedAudio');
  if (report.jobId) errors.push('seed already has jobId; this would resume an existing job');
  let sourceCheck = 'not checked (no sourcePath)';
  if (report.sourcePath) {
    const bytes = await fs.readFile(report.sourcePath);
    sourceCheck = hash(bytes) === report.sourceSha256 ? 'sha256 matches' : 'SHA256 MISMATCH';
    if (sourceCheck !== 'sha256 matches') errors.push('source sha256');
  }
  if (report.referenceTranscriptPath) await fs.access(path.resolve(root, report.referenceTranscriptPath)).catch(() => errors.push('referenceTranscriptPath missing'));
  console.log(JSON.stringify({ dryRun: true, report: reportPath, valid: !errors.length, errors, sourceCheck,
    referenceTranscript: report.referenceTranscriptPath || 'none: caption accuracy will stay unverified and passed=false',
    wouldCall: ['sourceVideoCapabilitiesTool', 'processSourceVideoTool', 'sourceVideoStatusTool (poll)', 'approveSourceVideoTool (stale, then real)'] }, null, 1));
  if (errors.length) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
