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
  const live = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const id = crypto.randomUUID();
  const relative = `source-video-fixtures/bgm-${id}.mp3`;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIRECTORY);
  const filename = path.join(uploadRoot, relative);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const generated = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=18', '-af', 'volume=0.04', '-c:a', 'libmp3lame', '-q:a', '8', filename], { encoding: 'utf8', timeout: 30000 });
  assert.equal(generated.status, 0, generated.stderr);
  const bytes = await fs.readFile(filename);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const prisma = new PrismaClient();
  try {
    const media = await prisma.media.create({ data: { organizationId: live.orgId, name: relative, path: `${process.env.FRONTEND_URL}/uploads/${relative}`, originalName: 'source-bgm-fixture.mp3', type: 'audio', status: 'ready', fileSize: bytes.length } });
    const receipt = { kind: 'synthetic-bgm-fixture', orgId: live.orgId, mediaId: media.id, sha256, bytes: bytes.length, relative };
    await fs.writeFile(path.join(root, 'reports/openshorts-integration/bgm-fixture.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify(receipt));
  } finally { await prisma.$disconnect(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
