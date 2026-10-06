'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sign } = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const hook = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-hook.json'), 'utf8'));
  const effects = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-effects.json'), 'utf8'));
  const base = 'http://127.0.0.1:3000/ai-video/source-jobs';
  const auth = { cookie: `auth=${sign({ id: source.userId }, process.env.JWT_SECRET)}`, showorg: source.orgId };
  const projectsResponse = await fetch(`${base}/projects`, { headers: auth });
  assert.equal(projectsResponse.status, 200);
  const projects = await projectsResponse.json();
  for (const expected of [source, hook, effects]) {
    const listed = projects.find(item => item.jobId === expected.jobId);
    assert.equal(listed?.status, 'completed');
    assert.equal(listed?.clips?.[0]?.media?.id, expected.final.clips[0].media.id);
  }
  const transcriptResponse = await fetch(`${base}/${source.jobId}/transcript`, { headers: auth });
  assert.equal(transcriptResponse.status, 200);
  const transcript = await transcriptResponse.json();
  assert.equal(transcript.jobId, source.jobId);
  assert.ok(Array.isArray(transcript.clips));

  const jobRoot = path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY || path.join(os.homedir(), '.local/share/nan-team/source-video-jobs'), source.jobId);
  const zipNames = async () => new Set((await fs.readdir(jobRoot)).filter(name => /^clips-[0-9a-f-]{36}\.zip$/.test(name)));
  const before = await zipNames();
  const zipResponse = await fetch(`${base}/${source.jobId}/download-all`, { headers: auth });
  assert.equal(zipResponse.status, 200);
  assert.match(zipResponse.headers.get('content-type') || '', /application\/zip/);
  const bytes = Buffer.from(await zipResponse.arrayBuffer());
  let temporaryZipCleaned = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const after = await zipNames();
    if ([...after].every(name => before.has(name))) { temporaryZipCleaned = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(temporaryZipCleaned, 'Download left a new private ZIP file after response completion');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nan-source-history-'));
  try {
    const filename = path.join(directory, 'clips.zip');
    await fs.writeFile(filename, bytes);
    const check = spawnSync('python3', ['-c', 'import hashlib,json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([{ "name":i.filename,"size":i.file_size,"sha256":hashlib.sha256(z.read(i)).hexdigest()} for i in z.infolist()]))', filename], { encoding: 'utf8', timeout: 30000 });
    assert.equal(check.status, 0, check.stderr);
    const entries = JSON.parse(check.stdout);
    assert.deepEqual(entries.map(entry => entry.name), ['clip-1.mp4']);
    assert.equal(entries[0].sha256, source.final.clips[0].sha256);
    assert.ok(entries[0].size > 0);
    const prisma = new PrismaClient();
    let other;
    try {
      other = await prisma.userOrganization.findFirst({ where: { organizationId: { not: source.orgId }, disabled: false, user: { email: { endsWith: '@fixture.invalid' }, activated: true } }, select: { userId: true, organizationId: true } });
    } finally { await prisma.$disconnect(); }
    assert.ok(other, 'A second local fixture tenant is required for cross-org verification');
    const otherHeaders = { cookie: `auth=${sign({ id: other.userId }, process.env.JWT_SECRET)}`, showorg: other.organizationId };
    const denied = await fetch(`${base}/${source.jobId}/download-all`, { headers: otherHeaders });
    assert.ok([403, 404].includes(denied.status), `Other org received ${denied.status}`);
    const otherProjectsResponse = await fetch(`${base}/projects`, { headers: otherHeaders });
    assert.equal(otherProjectsResponse.status, 200);
    const otherProjects = await otherProjectsResponse.json();
    assert.ok(!otherProjects.some(item => item.jobId === source.jobId), 'Source job appeared in another tenant history');
    const badPath = await fetch(`${base}/..%2F..%2Fetc%2Fpasswd/download-all`, { headers: auth });
    assert.notEqual(badPath.status, 200);
    const receipt = { kind: 'source-video-history-zip-live', orgId: source.orgId, jobId: source.jobId,
      projectJobIds: [source.jobId, hook.jobId, effects.jobId], transcriptClipCount: transcript.clips.length,
      zipSha256: crypto.createHash('sha256').update(bytes).digest('hex'), zipBytes: bytes.length, entries,
      otherOrgId: other.organizationId, otherOrgStatus: denied.status, otherOrgProjectCount: otherProjects.length, traversalStatus: badPath.status, temporaryZipCleaned };
    const output = path.join(root, 'reports/openshorts-integration/live-history-zip.json');
    await fs.writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify(receipt));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
