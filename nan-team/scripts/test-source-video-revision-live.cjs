'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { sign } = require('jsonwebtoken');

async function main() {
  const root = path.resolve(__dirname, '..');
  const silentHook = process.argv[2] === 'silent-hook';
  const silentEffects = process.argv[2] === 'silent-effects';
  const silentPunch = process.argv[2] === 'silent-punch';
  const silentSource = silentHook || silentEffects || silentPunch;
  const parent = JSON.parse(await fs.readFile(path.join(root, `reports/openshorts-integration/${silentSource ? 'live-silent-job' : 'live-source-job'}.json`), 'utf8'));
  const original = silentSource ? JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8')) : parent;
  const squareVoiceBgm = process.argv[2] === 'voice-bgm-square';
  const bgm = squareVoiceBgm ? JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/bgm-fixture.json'), 'utf8')) : undefined;
  if (parent.final?.status !== 'completed') throw new Error('Parent source job is not complete');
  const headers = { 'content-type': 'application/json', cookie: `auth=${sign({ id: original.userId }, process.env.JWT_SECRET)}`, showorg: parent.orgId };
  const clip = parent.final.clips[0];
  const projectResponse = await fetch('http://127.0.0.1:3000/ai-video/source-jobs/projects', { headers });
  if (!projectResponse.ok) throw new Error(`Could not read revision index (${projectResponse.status})`);
  const projects = await projectResponse.json();
  const expectedRevision = Math.max(...projects.filter(job => job.projectId === parent.jobId).map(job => job.revision));
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('Project revision is unavailable');
  const input = { clipId: clip.clipId, expectedRevision, idempotencyKey: crypto.randomUUID(), operation: 'edit', aspectRatio: squareVoiceBgm ? '1:1' : '9:16', layout: 'wide',
    captions: { enabled: !silentSource, style: 'classic' }, audio: squareVoiceBgm ? { mode: 'mix-narration', voice: 'Thuyết Minh', narrationText: 'Xin chào các bạn. Hãy cùng tiết kiệm nước mỗi ngày để bảo vệ môi trường.', bgmMediaId: bgm.mediaId } : { mode: 'keep' }, hook: { enabled: silentHook, style: 'pill' }, reviewBeforeRender: false,
    designBrief: silentPunch ? 'Apply exactly one safe punch_in effect from 0.5 to 2.5 seconds at strength 0.09 to emphasize the SAVE WATER slide. Do not use other effects. This silent clip has no captions or hook.' : silentEffects ? 'Apply one safe, visibly richer color_pop effect from 0.5 to 4 seconds at strength 0.6 to emphasize the SAVE WATER slide. Do not use other effects.' : undefined,
    motionDesign: { enabled: !silentSource && !squareVoiceBgm, theme: 'clean', transitions: silentSource || squareVoiceBgm ? 'none' : 'fade', lowerThird: silentSource || squareVoiceBgm ? undefined : 'Tiết kiệm nước' } };
  const created = await fetch(`http://127.0.0.1:3000/ai-video/source-jobs/${parent.jobId}/revisions`, { method: 'POST', headers, body: JSON.stringify(input) });
  const body = await created.json();
  if (!created.ok || !body.jobId) throw new Error(`Revision create failed (${created.status}): ${JSON.stringify(body).slice(0, 300)}`);
  const receipt = { kind: silentPunch ? 'source-video-live-silent-punch' : silentEffects ? 'source-video-live-silent-effects' : silentHook ? 'source-video-live-silent-hook' : squareVoiceBgm ? 'source-video-live-voice-bgm-square' : 'source-video-live-revision', parentJobId: parent.jobId, parentClipId: clip.clipId, orgId: parent.orgId, jobId: body.jobId, workflowId: body.workflowId, requestedAspectRatio: input.aspectRatio, motionDesign: !silentSource && !squareVoiceBgm, hookFromVision: silentHook, effectsFromAgy: silentEffects || silentPunch, voice: squareVoiceBgm ? 'Thuyết Minh' : undefined, bgmMediaId: bgm?.mediaId, stages: [] };
  const location = path.join(root, `reports/openshorts-integration/${silentPunch ? 'live-silent-punch' : silentEffects ? 'live-silent-effects' : silentHook ? 'live-silent-hook' : squareVoiceBgm ? 'live-voice-bgm-square' : 'live-revision-job'}.json`);
  const save = () => fs.writeFile(location, `${JSON.stringify(receipt, null, 2)}\n`);
  await save();
  console.log(JSON.stringify({ jobId: body.jobId, workflowId: body.workflowId }));
  for (let index = 0; index < 300; index++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const response = await fetch(`http://127.0.0.1:3000/ai-video/source-jobs/${body.jobId}`, { headers });
    const state = await response.json();
    const stage = `${state.status}:${state.stage}:${state.progress}`;
    if (receipt.stages.at(-1) !== stage) { receipt.stages.push(stage); await save(); console.log(stage); }
    if (['completed', 'failed', 'cancelled'].includes(state.status)) {
      receipt.final = { status: state.status, error: state.error, clips: state.clips };
      await save();
      if (state.status !== 'completed' || !state.clips?.[0]?.media?.id) throw new Error(`Revision ${state.status}: ${state.error || 'no Media'}`);
      console.log(JSON.stringify({ status: state.status, clipId: state.clips[0].clipId, mediaId: state.clips[0].media.id, sha256: state.clips[0].sha256 }));
      return;
    }
  }
  throw new Error('Revision did not finish within 10 minutes');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
