'use strict';
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { sign } = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { Client, Connection } = require('@temporalio/client');
const pause = () => new Promise(resolve => setTimeout(resolve, 1000));
async function main() {
  const root = path.resolve(__dirname, '..');
  const location = path.join(root, 'reports/openshorts-integration/live-analysis-restart.json');
  const parent = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-job.json'), 'utf8'));
  const original = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const headers = { 'content-type': 'application/json', cookie: `auth=${sign({ id: original.userId }, process.env.JWT_SECRET)}`, showorg: parent.orgId };
  const api = async (route, options = {}) => {
    const response = await fetch(`http://127.0.0.1:3000/ai-video/source-jobs${route}`, { headers, ...options });
    assert.ok(response.ok, `Source API ${response.status}`); return response.json();
  };
  let receipt;
  const save = () => fs.writeFile(location, JSON.stringify(receipt, null, 2) + '\n');
  const prisma = new PrismaClient();
  let connection;
  try {
    if (process.argv[2] === 'start') {
      await assert.rejects(fs.access(location), { code: 'ENOENT' });
      const active = await prisma.sourceVideoJob.count({ where: { status: { in: ['queued', 'running', 'awaiting_approval'] } } });
      assert.equal(active, 0, 'Other active source jobs prevent this restart fixture');
      const projects = await api('/projects');
      const expectedRevision = Math.max(...projects.filter(job => job.projectId === parent.jobId).map(job => job.revision));
      const marker = `restart-analysis-fixture-${crypto.randomUUID()}`;
      const created = await api(`/${parent.jobId}/revisions`, { method: 'POST', body: JSON.stringify({
        clipId: parent.final.clips[0].clipId, expectedRevision, idempotencyKey: marker,
        operation: 'edit', aspectRatio: '9:16', layout: 'wide', captions: { enabled: false },
        hook: { enabled: true, style: 'pill' }, audio: { mode: 'keep' }, motionDesign: { enabled: false },
        selection: { prompt: marker }, reviewBeforeRender: false,
      }) });
      receipt = { kind: 'source-video-native-analysis-app-restart', ...created, orgId: parent.orgId,
        parentJobId: parent.jobId, sourceSha256: parent.sourceSha256, sourceFiles: {}, stages: [] };
      for (const relative of ['scripts/test-source-video-analysis-restart-live.cjs', 'config/dev-native.sh',
        'libraries/nestjs-libraries/src/videos/openshorts/source-video.service.ts',
        'libraries/nestjs-libraries/src/videos/openshorts/source-video.repository.ts',
        'libraries/nestjs-libraries/src/videos/openshorts/source-video.worker.ts',
        'libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts',
        'apps/orchestrator/src/workflows/source-video.workflow.v1.ts', 'packages/agy-mcp-runner/index.cjs',
        'packages/agy-mcp-runner/process.cjs']) receipt.sourceFiles[relative] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, relative))).digest('hex');
      await save(); console.log(JSON.stringify({ jobId: created.jobId }));
      for (let poll = 0; poll < 180; poll++) {
        const job = await prisma.sourceVideoJob.findUniqueOrThrow({ where: { id: created.jobId } });
        const state = await api(`/${created.jobId}`);
        assert.ok(!['completed', 'failed', 'cancelled'].includes(state.status), `Job ended before restart: ${state.status}`);
        if (state.stage === 'analyzing' && job.leaseOwner) {
          const directory = await fs.realpath(path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(require('node:os').homedir(), '.local/share/nan-team/source-video-jobs'), created.jobId));
          // Observe the exact worker stage and an active AGY child of its
          // orchestrator; the job lease binds ownership, the PID is diagnostic.
          const workers = [];
          for (const pid of await fs.readdir('/proc')) {
            if (!/^\d+$/.test(pid)) continue;
            const argv = await fs.readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
            if (argv.includes('--agent\0video-job\0')) {
              const status = await fs.readFile(`/proc/${pid}/status`, 'utf8').catch(() => '');
              const parentPid = status.match(/^PPid:\s+(\d+)/m)?.[1];
              const parentArgs = parentPid ? await fs.readFile(`/proc/${parentPid}/cmdline`, 'utf8').catch(() => '') : '';
              if (!parentArgs.includes('dist/apps/orchestrator/src/main.js')) continue;
              const cwd = await fs.readlink(`/proc/${pid}/cwd`).catch(() => '');
              if (/^\/tmp\/postiz-agy-[^/]+\/workspace$/.test(cwd)) workers.push({ pid: Number(pid), workspace: cwd });
            }
          }
          if (workers.length === 1) {
            receipt.beforeRestart = { status: state.status, stage: state.stage, epoch: job.epoch,
              leaseOwner: job.leaseOwner, observedAt: new Date().toISOString(), ...workers[0], privateJobDirectory: directory };
            await save(); console.log('Native AGY analysis observed; ready for managed app restart'); return;
          }
        }
        await pause();
      }
      throw new Error('AGY analysis not observed before deadline');
    }
    assert.equal(process.argv[2], 'resume');
    receipt = JSON.parse(await fs.readFile(location, 'utf8')); assert.ok(receipt.beforeRestart);
    for (const [relative, hash] of Object.entries(receipt.sourceFiles)) assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(root, relative))).digest('hex'), hash, `Source changed: ${relative}`);
    let state;
    for (let poll = 0; poll < 900; poll++) {
      state = await api(`/${receipt.jobId}`);
      const stage = `${state.status}:${state.stage}:${state.progress}`;
      if (receipt.stages.at(-1) !== stage) { receipt.stages.push(stage); await save(); console.log(stage); }
      if (['completed', 'failed', 'cancelled'].includes(state.status)) break;
      await pause();
    }
    receipt.final = { status: state.status, error: state.error, clips: state.clips }; await save();
    assert.equal(state.status, 'completed'); assert.equal(state.clips.length, 1);
    const job = await prisma.sourceVideoJob.findUniqueOrThrow({ where: { id: receipt.jobId } });
    assert.ok(job.epoch > receipt.beforeRestart.epoch); assert.equal(job.leaseOwner, null);
    const publications = await prisma.sourceVideoPublication.count({ where: { jobId: receipt.jobId, orgId: receipt.orgId, status: 'committed' } });
    const mediaRows = await prisma.media.count({ where: { organizationId: receipt.orgId, id: state.clips[0].media.id, deletedAt: null } });
    assert.equal(publications, 1); assert.equal(mediaRows, 1);
    await assert.rejects(fs.access(receipt.beforeRestart.workspace), { code: 'ENOENT' });
    connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233' });
    const temporal = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || 'default' });
    const handle = temporal.workflow.getHandle(receipt.workflowId); await handle.result();
    const history = await handle.fetchHistory();
    const events = history.events || [];
    const scheduled = events.filter(event => event.activityTaskScheduledEventAttributes?.activityType?.name === 'sourceVideoStageV1');
    const analysis = scheduled.find(event => event.activityTaskScheduledEventAttributes?.input?.payloads?.some(p => Buffer.from(p.data || []).toString() === '"analyze"'));
    assert.ok(analysis, 'Analysis activity missing from Temporal history');
    const retried = events.filter(event => event.activityTaskStartedEventAttributes && String(event.activityTaskStartedEventAttributes.scheduledEventId) === String(analysis.eventId));
    receipt.verification = { committedPublications: publications, mediaRows, leaseReleased: true,
      epochAfter: job.epoch, oldWorkspaceRemoved: true, temporalStatus: (await handle.describe()).status.name,
      analysisStartedAttempts: retried.map(event => event.activityTaskStartedEventAttributes.attempt) };
    receipt.limitations = ['Managed SIGTERM app restart; does not prove abrupt SIGKILL recovery or restart during render/upload.',
      'The source is a synthetic slide fixture; real footage quality remains unverified.'];
    await save(); console.log(JSON.stringify(receipt.verification));
  } finally { await prisma.$disconnect(); await connection?.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
