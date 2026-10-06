'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sign } = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const root = path.resolve(__dirname, '..');
  const fixture = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const file = path.join(root, 'reports/openshorts-integration/fixtures/silent-four-slides-16s.mp4');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const labels = ['SAVE WATER', 'TURN OFF TAPS', 'REUSE RAINWATER', 'THANK YOU'];
  const colors = ['blue', 'green', 'orange', 'purple'];
  const args = ['-v', 'error', '-y'];
  for (const color of colors) args.push('-f', 'lavfi', '-i', `color=c=${color}:s=640x360:r=25:d=4`);
  const filters = labels.map((label, index) => `[${index}:v]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${label}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2[v${index}]`).join(';') + ';' + labels.map((_, index) => `[v${index}]`).join('') + 'concat=n=4:v=1:a=0[out]';
  args.push('-filter_complex', filters, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', file);
  const generated = spawnSync('ffmpeg', args, { encoding: 'utf8', timeout: 60000 });
  assert.equal(generated.status, 0, generated.stderr);
  const bytes = await fs.readFile(file);
  const sourceSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const relative = `source-video-fixtures/silent-${crypto.randomUUID()}.mp4`;
  const target = path.join(path.resolve(process.env.UPLOAD_DIRECTORY), relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(file, target);
  const prisma = new PrismaClient();
  try {
    const media = await prisma.media.create({ data: { organizationId: fixture.orgId, name: relative, path: `${process.env.FRONTEND_URL}/uploads/${relative}`, originalName: 'silent-four-slides-16s.mp4', type: 'video', status: 'ready', fileSize: bytes.length } });
    const headers = { 'content-type': 'application/json', cookie: `auth=${sign({ id: fixture.userId }, process.env.JWT_SECRET)}`, showorg: fixture.orgId };
    const input = { mediaId: media.id, idempotencyKey: crypto.randomUUID(), operation: 'clips', aspectRatio: '9:16', selection: { count: 1, minSeconds: 10, maxSeconds: 16 }, captions: { enabled: false, style: 'classic' }, hook: { enabled: false }, audio: { mode: 'keep' }, reviewBeforeRender: false };
    const start = await fetch('http://127.0.0.1:3000/ai-video/source-jobs', { method: 'POST', headers, body: JSON.stringify(input) });
    const body = await start.json();
    if (!start.ok || !body.jobId) throw new Error(`Silent job create failed (${start.status}): ${JSON.stringify(body).slice(0, 300)}`);
    const receipt = { kind: 'source-video-silent-four-slides-live', orgId: fixture.orgId, sourceMediaId: media.id, sourceSha256, jobId: body.jobId, workflowId: body.workflowId, stages: [] };
    const location = path.join(root, 'reports/openshorts-integration/live-silent-job.json');
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
        if (state.status !== 'completed' || !state.clips?.[0]?.media?.id) throw new Error(`Silent job ${state.status}: ${state.error || 'no Media'}`);
        console.log(JSON.stringify({ status: state.status, mediaId: state.clips[0].media.id, sha256: state.clips[0].sha256 }));
        return;
      }
    }
    throw new Error('Silent job did not finish within 10 minutes');
  } finally { await prisma.$disconnect(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
