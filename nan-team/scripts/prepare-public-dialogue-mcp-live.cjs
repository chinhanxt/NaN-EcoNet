'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { uploadSourceFile } = require('../packages/openshorts-engine/bin/nan-video.cjs');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

async function main() {
  const filename = path.join(root, 'reports/openshorts-integration/live-public-dialogue-mcp.json');
  const existing = await fs.readFile(filename, 'utf8').then(JSON.parse).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing) { console.log(JSON.stringify({ resumeReport: filename, jobId: existing.jobId })); return; }
  const provenance = require('../reports/openshorts-integration/public-dialogue-source.json');
  const fixture = require('../reports/openshorts-integration/live-source-job.json');
  const bytes = await fs.readFile(provenance.localPath);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), provenance.sha256);
  const db = new PrismaClient();
  let temporaryKey;
  try {
    const org = await db.organization.findUniqueOrThrow({ where: { id: fixture.orgId }, select: { apiKey: true } });
    if (!org.apiKey) {
      temporaryKey = crypto.randomBytes(32).toString('hex');
      assert.equal((await db.organization.updateMany({ where: { id: fixture.orgId, apiKey: null }, data: { apiKey: temporaryKey } })).count, 1);
    }
    const uploaded = await uploadSourceFile(provenance.localPath, 'http://127.0.0.1:3000/mcp', temporaryKey || org.apiKey);
    const media = await db.media.findFirstOrThrow({ where: { id: uploaded.mediaId, organizationId: fixture.orgId } });
    assert.equal(media.status, 'ready');
    const report = {
      kind: 'authenticated-real-public-vietnamese-dialogue-MCP', orgId: fixture.orgId,
      sourcePath: provenance.localPath, sourceSha256: provenance.sha256, sourceMediaId: uploaded.mediaId,
      sourcePage: provenance.sourcePage, sourceVideo: provenance.sourceVideo, stages: [],
      expectedTitle: 'Đối thoại tiếng Việt — kiểm chứng lời nói và chuyển cảnh',
      expectedDurationSeconds: 30, expectedAudio: true,
      input: { mediaId: uploaded.mediaId, idempotencyKey: crypto.randomUUID(), operation: 'edit',
        aspectRatio: '9:16', layout: 'speaker-cut', segments: [{ startSeconds: 0, endSeconds: 30 }],
        captions: { enabled: true, style: 'karaoke' }, audio: { mode: 'keep' },
        hook: { enabled: true, style: 'pill', durationSeconds: 3 }, reviewBeforeRender: true,
        effects: [], motionDesign: { enabled: false, theme: 'clean', transitions: 'none' } },
      manualQualityReview: { passed: null, status: 'pending original speech/caption/crop/audio review' },
      policyDecision: { authorization: 'User requested a suitable web video for E2E testing',
        sourceUnchanged: true, socialPublish: false, release: false, modelDownload: false, maxConcurrentSourceJobs: 1 },
      limitations: ['A completed job is insufficient to prove caption accuracy or simultaneous-speaker attribution.'],
    };
    await fs.writeFile(filename, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ report: filename, sourceMediaId: uploaded.mediaId, sourceSha256: provenance.sha256 }));
  } finally {
    if (temporaryKey) await db.organization.updateMany({ where: { id: fixture.orgId, apiKey: temporaryKey }, data: { apiKey: null } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
