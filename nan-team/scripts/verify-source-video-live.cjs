'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const root = path.resolve(__dirname, '..');
  const approvalRestart = process.argv[2] === 'approval-restart';
  const analysisRestart = process.argv[2] === 'analysis-restart';
  const silentHook = process.argv[2] === 'silent-hook' || analysisRestart;
  const silentEffects = process.argv[2] === 'silent-effects';
  const silentPunch = process.argv[2] === 'silent-punch';
  const silent = process.argv[2] === 'silent' || silentHook || silentEffects || silentPunch || approvalRestart;
  const squareVoiceBgm = process.argv[2] === 'voice-bgm-square';
  const revision = process.argv[2] === 'revision' || squareVoiceBgm || silentHook || silentEffects || silentPunch || approvalRestart;
  const fixtureName = approvalRestart ? 'live-approval-restart' : silentPunch ? 'live-silent-punch' : silentEffects ? 'live-silent-effects' : silentHook ? 'live-silent-hook' : silent ? 'live-silent-job' : squareVoiceBgm ? 'live-voice-bgm-square' : revision ? 'live-revision-job' : 'live-source-job';
  const live = JSON.parse(await fs.readFile(path.join(root, `reports/openshorts-integration/${analysisRestart ? 'live-analysis-restart' : fixtureName}.json`), 'utf8'));
  const original = revision ? JSON.parse(await fs.readFile(path.join(root, `reports/openshorts-integration/${silentHook || silentEffects || silentPunch || approvalRestart ? 'live-silent-job' : 'live-source-job'}.json`), 'utf8')) : live;
  assert.equal(live.final?.status, 'completed');
  const clip = live.final.clips?.[0];
  assert.ok(clip?.media?.id && clip.sha256, 'Completed job has no published Media');
  const prisma = new PrismaClient();
  try {
    const media = await prisma.media.findFirst({ where: { id: clip.media.id, organizationId: live.orgId } });
    assert.ok(media, 'Media row is missing or belongs to another organization');
    const pathname = new URL(media.path).pathname;
    assert.ok(pathname.startsWith('/uploads/source-video/'), 'Media path is outside source-video storage');
    const storage = path.resolve(process.env.UPLOAD_DIRECTORY);
    const file = path.resolve(storage, pathname.slice('/uploads/'.length));
    assert.ok(file.startsWith(storage + path.sep), 'Media path escaped upload storage');
    const bytes = await fs.readFile(file);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256, clip.sha256, 'Published SHA differs from file bytes');
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8', timeout: 30000 });
    assert.equal(probe.status, 0, probe.stderr);
    const metadata = JSON.parse(probe.stdout);
    const video = metadata.streams.find(stream => stream.codec_type === 'video');
    const audio = metadata.streams.find(stream => stream.codec_type === 'audio');
    assert.ok(video && (silent ? !audio : audio), silent ? 'Expected video without an audio stream' : 'Expected both video and preserved audio streams');
    assert.ok(silent ? Number(metadata.format.duration) >= 9.75 && Number(metadata.format.duration) <= 16.25 : Math.abs(Number(metadata.format.duration) - 18) < 0.25, 'Duration differs from source selection');
    assert.ok(Math.abs(video.width / video.height - (squareVoiceBgm ? 1 : silent || revision ? 9 / 16 : 16 / 9)) < 0.02, 'Video aspect ratio differs from request');
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', ...(silent ? [] : ['-map', '0:a:0']), '-f', 'null', '-'], { encoding: 'utf8', timeout: 120000 });
    assert.equal(decoded.status, 0, decoded.stderr);
    const receipt = { kind: approvalRestart ? 'source-video-live-approval-restart-artifact-verified' : silentPunch ? 'source-video-live-silent-punch-artifact-verified' : silentEffects ? 'source-video-live-silent-effects-artifact-verified' : silentHook ? 'source-video-live-silent-hook-artifact-verified' : silent ? 'source-video-live-silent-artifact-verified' : squareVoiceBgm ? 'source-video-live-voice-bgm-square-artifact-verified' : revision ? 'source-video-live-revision-artifact-verified' : 'source-video-live-artifact-verified', jobId: live.jobId, orgId: live.orgId, mediaId: media.id, parentJobId: revision ? original.jobId : undefined, parentMediaId: revision ? original.final.clips[0].media.id : undefined, sourceSha256: original.sourceSha256, outputSha256: sha256, bytes: bytes.length, durationSeconds: Number(metadata.format.duration), width: video.width, height: video.height, videoCodec: video.codec_name, audioCodec: audio?.codec_name, fullDecodePassed: true };
    if (revision) assert.notEqual(receipt.outputSha256, original.final.clips[0].sha256, 'Revision reused the original output bytes');
    if (silentHook) {
      const jobRoot = path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(process.env.HOME, '.local/share/nan-team/source-video-jobs'), live.jobId);
      const privateReceipt = JSON.parse(await fs.readFile(path.join(jobRoot, 'receipt.json'), 'utf8'));
      const plannedHook = privateReceipt.plan?.clips?.[0]?.hook;
      assert.ok(typeof plannedHook === 'string' && plannedHook.trim().length > 0, 'AGY did not create a hook in the persisted plan');
      const evidence = (privateReceipt.agyReceipts || []).filter(item => item.role === 'content-editor');
      assert.ok(evidence.some(item => item.mcpCalls?.some(call => call.tool === 'read_frame') && item.mcpCalls?.some(call => call.tool === 'submit_result') && item.policyDecisions?.some(decision => decision.tool === 'view_file' && decision.phase === 'post' && decision.success)), 'Grounded hook has no native AGY frame evidence');
      const clean = privateReceipt.rendered?.clips?.[0]?.cleanPath;
      assert.ok(clean, 'Clean clip for overlay comparison is missing');
      const frameHash = filename => {
        const frame = spawnSync('ffmpeg', ['-v', 'error', '-ss', '1', '-i', filename, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { timeout: 30000, maxBuffer: 10_000_000 });
        assert.equal(frame.status, 0, String(frame.stderr));
        return crypto.createHash('sha256').update(frame.stdout).digest('hex');
      };
      const cleanFrameHash = frameHash(clean), finalFrameHash = frameHash(file);
      assert.notEqual(finalFrameHash, cleanFrameHash, 'Hook overlay did not change the first second of video');
      receipt.hookEvidence = { plannedHook, agyTaskIds: evidence.map(item => item.jobId), cleanFrameHash, finalFrameHash };
    }
    if (silentEffects || silentPunch) {
      const jobRoot = path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(process.env.HOME, '.local/share/nan-team/source-video-jobs'), live.jobId);
      const privateReceipt = JSON.parse(await fs.readFile(path.join(jobRoot, 'receipt.json'), 'utf8'));
      const planned = privateReceipt.plan?.clips?.[0]?.effects;
      const expectedType = silentPunch ? 'punch_in' : 'color_pop';
      assert.ok(planned?.some(effect => effect.type === expectedType && effect.start <= 2 && effect.end >= 2), `AGY did not persist the requested ${expectedType} effect`);
      const review = (privateReceipt.agyReceipts || []).find(item => item.role === 'render-reviewer' && item.nativeReview?.succeeded);
      assert.ok(review && review.nativeReview.specialists.length === 3 && review.nativeReview.specialists.every(item => item.reportSucceeded && item.evidenceRead && item.nativeVisionRead), 'Three native AGY specialists did not review the visual effect');
      const rendered = privateReceipt.rendered?.clips?.[0];
      assert.deepEqual(rendered?.designDecision?.effects, planned, 'Renderer did not record the approved effect');
      const directory = path.dirname(rendered.path);
      assert.ok(path.resolve(directory).startsWith(path.resolve(jobRoot) + path.sep), 'Rendered effect path escaped job storage');
      const framed = path.join(directory, `${rendered.clipId}-framed.mp4`);
      const effected = path.join(directory, `${rendered.clipId}-effects.mp4`);
      const rgb = (filename, seconds) => {
        const frame = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(seconds), '-i', filename, '-frames:v', '1', '-vf', 'scale=270:480', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { timeout: 30000, maxBuffer: 1_000_000 });
        assert.equal(frame.status, 0, String(frame.stderr));
        return frame.stdout;
      };
      const meanDifference = seconds => {
        const before = rgb(framed, seconds), after = rgb(effected, seconds);
        assert.equal(before.length, after.length);
        let total = 0;
        for (let index = 0; index < before.length; index++) total += Math.abs(before[index] - after[index]);
        return total / before.length;
      };
      const during = meanDifference(2), after = meanDifference(6);
      assert.ok(during > 0.1 && during > after * 10, `${expectedType} did not visibly change only the approved time range`);
      receipt.effectsEvidence = { effectType: expectedType, planned, agyTaskId: review.jobId, nativeSpecialistCount: review.nativeReview.specialists.length, meanPixelDifferenceDuring: during, meanPixelDifferenceAfter: after };
    }
    if (approvalRestart) {
      assert.equal(live.beforeRestart.status, 'awaiting_approval');
      assert.equal(live.afterRestart.status, 'awaiting_approval');
      assert.equal(live.beforeRestart.planVersion, live.afterRestart.planVersion);
      assert.equal(live.staleApprovalStatus, 409);
      const jobRoot = path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(process.env.HOME, '.local/share/nan-team/source-video-jobs'), live.jobId);
      const privateReceipt = JSON.parse(await fs.readFile(path.join(jobRoot, 'receipt.json'), 'utf8'));
      assert.ok(privateReceipt.approvedPlan, 'Approved plan was not persisted after restart');
      assert.equal(privateReceipt.sourceSha256, original.sourceSha256);
      const publications = await prisma.sourceVideoPublication.count({ where: { jobId: live.jobId, orgId: live.orgId, status: 'committed' } });
      const mediaRows = await prisma.media.count({ where: { id: media.id, organizationId: live.orgId } });
      assert.equal(publications, 1, 'Restart produced duplicate or missing publication');
      assert.equal(mediaRows, 1, 'Restart produced duplicate or missing Media');
      receipt.restartEvidence = { planVersion: live.beforeRestart.planVersion, planSha256: live.beforeRestart.planSha256,
        staleApprovalStatus: live.staleApprovalStatus, committedPublications: publications, mediaRows };
    }
    if (squareVoiceBgm) {
      const bgm = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/bgm-fixture.json'), 'utf8'));
      const jobRoot = path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(process.env.HOME, '.local/share/nan-team/source-video-jobs'), live.jobId);
      const privateReceipt = JSON.parse(await fs.readFile(path.join(jobRoot, 'receipt.json'), 'utf8'));
      assert.equal(privateReceipt.input.audio.mode, 'mix-narration');
      assert.equal(privateReceipt.input.audio.voice, 'Thuyết Minh');
      assert.equal(privateReceipt.input.audio.bgmMediaId, bgm.mediaId);
      const attempts = (await fs.readdir(jobRoot)).filter(name => /^attempt-\d+$/.test(name));
      let stagedBgm, narration, mixedAudioVideo, framedVideo;
      for (const attempt of attempts) {
        const directory = path.join(jobRoot, attempt);
        const names = await fs.readdir(directory);
        if (names.includes('bgm.mp3')) stagedBgm = path.join(directory, 'bgm.mp3');
        mixedAudioVideo ||= names.find(name => name.endsWith('-audio.mp4')) && path.join(directory, names.find(name => name.endsWith('-audio.mp4')));
        framedVideo ||= names.find(name => name.endsWith('-framed.mp4')) && path.join(directory, names.find(name => name.endsWith('-framed.mp4')));
        for (const name of names.filter(name => name.startsWith('speech-'))) {
          const candidate = path.join(directory, name, 'preview.wav');
          if (await fs.stat(candidate).then(() => true, () => false)) narration = candidate;
        }
      }
      assert.ok(stagedBgm && narration && mixedAudioVideo && framedVideo, 'Voice Clone or BGM staging artifact is missing');
      assert.equal(crypto.createHash('sha256').update(await fs.readFile(stagedBgm)).digest('hex'), bgm.sha256);
      const voiceProbe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', narration], { encoding: 'utf8', timeout: 15000 });
      assert.equal(voiceProbe.status, 0);
      const pcmHash = filename => {
        const decodedAudio = spawnSync('ffmpeg', ['-v', 'error', '-i', filename, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { timeout: 30000, maxBuffer: 4_000_000 });
        assert.equal(decodedAudio.status, 0, String(decodedAudio.stderr));
        return crypto.createHash('sha256').update(decodedAudio.stdout).digest('hex');
      };
      const sourceAudioHash = pcmHash(framedVideo), mixedAudioHash = pcmHash(mixedAudioVideo), finalAudioHash = pcmHash(file);
      assert.notEqual(sourceAudioHash, mixedAudioHash, 'Audio mixer did not change the source audio');
      assert.equal(finalAudioHash, mixedAudioHash, 'Published audio differs from the mixed audio artifact');
      receipt.audioEvidence = { mode: 'mix-narration', clonedVoice: 'Thuyết Minh', narrationDurationSeconds: Number(voiceProbe.stdout.trim()), bgmMediaId: bgm.mediaId, stagedBgmSha256: bgm.sha256, sourceAudioHash, mixedAudioHash, finalAudioHash };
    }
    const location = path.join(root, `reports/openshorts-integration/${approvalRestart ? 'live-approval-restart-artifact-verification' : silentPunch ? 'live-silent-punch-artifact-verification' : silentEffects ? 'live-silent-effects-artifact-verification' : silentHook ? 'live-silent-hook-artifact-verification' : silent ? 'live-silent-artifact-verification' : squareVoiceBgm ? 'live-voice-bgm-square-artifact-verification' : revision ? 'live-revision-artifact-verification' : 'live-artifact-verification'}.json`);
    if (analysisRestart) {
      assert.equal(live.beforeRestart.stage, 'analyzing');
      assert.ok(live.verification.epochAfter > live.beforeRestart.epoch);
      assert.equal(live.verification.committedPublications, 1);
      assert.equal(live.verification.mediaRows, 1);
      receipt.kind = 'source-video-live-analysis-restart-artifact-verified';
      receipt.restartEvidence = live.verification;
    }
    await fs.writeFile(analysisRestart ? path.join(root, 'reports/openshorts-integration/live-analysis-restart-artifact-verification.json') : location, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify(receipt));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
