'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { sign } = require('jsonwebtoken');

async function main() {
  const phase = process.argv[2];
  assert.ok(['start', 'resume'].includes(phase), 'Use start or resume');
  const root = path.resolve(__dirname, '..');
  const source = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const parent = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-job.json'), 'utf8'));
  assert.equal(parent.final?.status, 'completed');
  const headers = { 'content-type': 'application/json', cookie: `auth=${sign({ id: source.userId }, process.env.JWT_SECRET)}`, showorg: parent.orgId };
  const base = 'http://127.0.0.1:3000/ai-video/source-jobs';
  const location = path.join(root, 'reports/openshorts-integration/live-approval-restart.json');
  let receipt;
  if (phase === 'start') {
    const projectsResponse = await fetch(`${base}/projects`, { headers });
    assert.equal(projectsResponse.status, 200);
    const projects = await projectsResponse.json();
    const expectedRevision = Math.max(...projects.filter(job => job.projectId === parent.jobId).map(job => job.revision));
    assert.ok(Number.isInteger(expectedRevision));
    const input = { clipId: parent.final.clips[0].clipId, expectedRevision, idempotencyKey: crypto.randomUUID(), operation: 'edit',
      aspectRatio: '9:16', layout: 'wide', captions: { enabled: false, style: 'classic' },
      audio: { mode: 'keep' }, hook: { enabled: false }, reviewBeforeRender: true,
      motionDesign: { enabled: false, theme: 'clean', transitions: 'none' } };
    const created = await fetch(`${base}/${parent.jobId}/revisions`, { method: 'POST', headers, body: JSON.stringify(input) });
    const body = await created.json();
    assert.equal(created.status, 201, JSON.stringify(body));
    receipt = { kind: 'source-video-approval-restart-live', orgId: parent.orgId, parentJobId: parent.jobId, sourceSha256: parent.sourceSha256,
      jobId: body.jobId, workflowId: body.workflowId, createdAt: new Date().toISOString(), stages: [] };
    await fs.writeFile(location, `${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    receipt = JSON.parse(await fs.readFile(location, 'utf8'));
    assert.ok(receipt.beforeRestart?.planVersion, 'Start phase must reach awaiting approval first');
  }
  const save = () => fs.writeFile(location, `${JSON.stringify(receipt, null, 2)}\n`);
  const status = async () => {
    const response = await fetch(`${base}/${receipt.jobId}`, { headers });
    assert.equal(response.status, 200);
    const state = await response.json();
    const stage = `${state.status}:${state.stage}:${state.progress}`;
    if (receipt.stages.at(-1) !== stage) { receipt.stages.push(stage); await save(); console.log(stage); }
    return state;
  };
  if (phase === 'start') {
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await status();
      if (state.status === 'awaiting_approval') {
        assert.equal(state.clips.length, 0);
        receipt.beforeRestart = { status: state.status, planVersion: state.plan?.planVersion,
          planSha256: crypto.createHash('sha256').update(JSON.stringify(state.plan)).digest('hex') };
        await save();
        console.log(JSON.stringify({ jobId: receipt.jobId, beforeRestart: receipt.beforeRestart }));
        return;
      }
      if (['failed', 'cancelled', 'completed'].includes(state.status)) throw new Error(`Job entered unexpected state ${state.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Job did not reach awaiting approval');
  }
  const state = await status();
  assert.equal(state.status, 'awaiting_approval');
  assert.equal(state.plan?.planVersion, receipt.beforeRestart.planVersion);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(state.plan)).digest('hex'), receipt.beforeRestart.planSha256);
  receipt.afterRestart = { status: state.status, planVersion: state.plan.planVersion, checkedAt: new Date().toISOString() };
  await save();
  const stale = await fetch(`${base}/${receipt.jobId}/approve`, { method: 'POST', headers, body: JSON.stringify({ expectedPlanVersion: state.plan.planVersion + 1 }) });
  assert.equal(stale.status, 409);
  const approved = await fetch(`${base}/${receipt.jobId}/approve`, { method: 'POST', headers, body: JSON.stringify({ expectedPlanVersion: state.plan.planVersion }) });
  assert.ok(approved.ok, `Approve failed (${approved.status}): ${(await approved.text()).slice(0, 300)}`);
  receipt.staleApprovalStatus = stale.status;
  await save();
  for (let attempt = 0; attempt < 180; attempt++) {
    const current = await status();
    if (['completed', 'failed', 'cancelled'].includes(current.status)) {
      receipt.final = { status: current.status, error: current.error, clips: current.clips };
      await save();
      assert.equal(current.status, 'completed', current.error);
      assert.equal(current.clips.length, 1);
      assert.ok(current.clips[0].media?.id);
      console.log(JSON.stringify({ jobId: receipt.jobId, status: current.status, mediaId: current.clips[0].media.id }));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Approved job did not finish within three minutes');
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
