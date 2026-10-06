'use strict';
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { sign } = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { Connection, Client } = require('@temporalio/client');
const pause = () => new Promise(resolve => setTimeout(resolve, 500));

async function ownedAgy(marker) {
  for (const pid of await fs.readdir('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    const argv = await fs.readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
    if (argv.includes(marker) && argv.includes('--agent\0video-job\0')) {
      const cwd = await fs.readlink(`/proc/${pid}/cwd`).catch(() => '');
      if (/^\/tmp\/postiz-agy-[^/]+\/workspace$/.test(cwd)) return { pid: Number(pid), workspace: cwd };
    }
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const parent = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-job.json'), 'utf8'));
  const original = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  assert.equal(parent.final.status, 'completed');
  const headers = { 'content-type': 'application/json', cookie: `auth=${sign({ id: original.userId }, process.env.JWT_SECRET)}`, showorg: parent.orgId };
  const api = async (route, options = {}) => {
    const response = await fetch(`http://127.0.0.1:3000/ai-video/source-jobs${route}`, { headers, ...options });
    const body = await response.json();
    assert.ok(response.ok, `Source API ${response.status}`);
    return body;
  };
  const projects = await api('/projects');
  const expectedRevision = Math.max(...projects.filter(job => job.projectId === parent.jobId).map(job => job.revision));
  const marker = `cancel-analysis-fixture-${crypto.randomUUID()}`;
  const created = await api(`/${parent.jobId}/revisions`, { method: 'POST', body: JSON.stringify({
    clipId: parent.final.clips[0].clipId, expectedRevision, idempotencyKey: marker,
    operation: 'edit', aspectRatio: '9:16', layout: 'wide', captions: { enabled: false },
    hook: { enabled: false }, audio: { mode: 'keep' }, motionDesign: { enabled: false },
    designBrief: `Apply one color_pop effect 0.5 to 4 seconds at strength 0.6. Test correlation marker: ${marker}`,
  }) });
  const location = path.join(root, 'reports/openshorts-integration/live-cancel-analysis.json');
  const receipt = { kind: 'source-video-cancel-during-native-agy-analysis', jobId: created.jobId,
    workflowId: created.workflowId, orgId: parent.orgId, parentJobId: parent.jobId, stages: [],
    sourceFiles: {}, sourceSha256: parent.sourceSha256,
    limitations: ['Cancellation is triggered after the native AGY process is observed, before requiring an MCP evidence call. This does not verify cancellation mid-review, render, upload, or compensation.'] };
  for (const relative of ['scripts/test-source-video-cancel-analysis-live.cjs',
    'libraries/nestjs-libraries/src/videos/openshorts/source-video.service.ts',
    'libraries/nestjs-libraries/src/videos/openshorts/source-video.repository.ts',
    'libraries/nestjs-libraries/src/videos/openshorts/source-video.worker.ts',
    'apps/orchestrator/src/workflows/source-video.workflow.v1.ts', 'packages/agy-mcp-runner/index.cjs',
    'packages/agy-mcp-runner/process.cjs']) {
    receipt.sourceFiles[relative] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, relative))).digest('hex');
  }
  const save = () => fs.writeFile(location, JSON.stringify(receipt, null, 2) + '\n');
  await save();
  console.log(JSON.stringify({ jobId: created.jobId }));
  let observed;
  for (let poll = 0; poll < 240; poll++) {
    const state = await api(`/${created.jobId}`);
    const stage = `${state.status}:${state.stage}`;
    if (receipt.stages.at(-1) !== stage) { receipt.stages.push(stage); await save(); }
    if (['completed', 'failed', 'cancelled'].includes(state.status)) throw new Error(`Job ended before cancellation: ${stage}`);
    observed = await ownedAgy(marker);
    if (state.status === 'running' && observed) break;
    await pause();
  }
  assert.ok(observed, 'No native AGY process observed for this exact design brief');
  receipt.beforeCancel = { observedAt: new Date().toISOString(), agyPid: observed.pid };
  await api(`/${created.jobId}`, { method: 'DELETE' });
  await save();
  let final;
  for (let poll = 0; poll < 240; poll++) {
    const state = await api(`/${created.jobId}`);
    const stage = `${state.status}:${state.stage}`;
    if (receipt.stages.at(-1) !== stage) { receipt.stages.push(stage); await save(); }
    if (['completed', 'failed', 'cancelled'].includes(state.status)) { final = state; break; }
    await pause();
  }
  assert.equal(final?.status, 'cancelled');
  assert.equal(final.clips.length, 0);
  const prisma = new PrismaClient();
  let connection;
  try {
    const job = await prisma.sourceVideoJob.findFirstOrThrow({ where: { id: created.jobId, orgId: parent.orgId } });
    assert.equal(job.status, 'cancelled');
    assert.equal(job.leaseOwner, null); assert.equal(job.leaseUntil, null);
    const publications = await prisma.sourceVideoPublication.findMany({ where: { jobId: created.jobId, orgId: parent.orgId } });
    const mediaRows = await prisma.media.count({ where: { organizationId: parent.orgId, name: { startsWith: `source-video/${parent.orgId}/${created.jobId}/` }, deletedAt: null } });
    assert.equal(publications.length, 0); assert.equal(mediaRows, 0);
    connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233' });
    const temporal = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || 'default' });
    const handle = temporal.workflow.getHandle(created.workflowId);
    await handle.result();
    const description = await handle.describe();
    assert.notEqual(description.status.name, 'RUNNING');
    for (let poll = 0; poll < 20 && await ownedAgy(marker); poll++) await pause();
    assert.equal(await ownedAgy(marker), undefined, 'Owned AGY process remains alive');
    await assert.rejects(fs.access(observed.workspace), { code: 'ENOENT' });
    receipt.final = { status: final.status, error: final.error, clips: final.clips };
    receipt.verification = { noPublishedMedia: true, publicationCount: publications.length, mediaRows,
      leaseReleased: true, temporalStatus: description.status.name, nativeProcessStopped: true,
      privateAgyWorkspaceRemoved: true };
    await save(); console.log(JSON.stringify(receipt.verification));
  } finally { await prisma.$disconnect(); await connection?.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
