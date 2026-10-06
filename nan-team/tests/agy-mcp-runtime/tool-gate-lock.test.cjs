'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const gate = path.resolve(__dirname, '../../packages/agy-mcp-runner/tool-gate.cjs');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-gate-lock-'));
  const policyFile = path.join(root, 'policy.json'), trace = path.join(root, 'trace');
  await fs.writeFile(policyFile, JSON.stringify({ kind: 'analysis', mcpTools: ['get_job_evidence'], readRoots: [], trace }));
  const call = () => JSON.parse(execFileSync(process.execPath, [gate, policyFile], { input: JSON.stringify({ conversationId: 'p', stepIdx: 1, toolCall: { name: 'call_mcp_tool', args: { ServerName: 'video-job', ToolName: 'get_job_evidence', Arguments: {} } } }), encoding: 'utf8', timeout: 5000 }));
  return { root, lock: trace + '.lock', call, done: () => fs.rm(root, { recursive: true, force: true }) };
}
const deadPid = () => { const child = spawnSync(process.execPath, ['-e', '0']); return child.pid; };

test('tool gate breaks a lock left by a killed hook (dead owner pid)', async () => {
  const f = await fixture();
  try {
    await fs.mkdir(f.lock); await fs.writeFile(path.join(f.lock, 'owner'), JSON.stringify({ pid: deadPid(), at: Date.now() }));
    const started = Date.now();
    assert.equal(f.call().decision, 'allow');
    assert.ok(Date.now() - started < 1000, 'dead owner is broken without waiting for the busy loop');
    await assert.rejects(fs.stat(f.lock), { code: 'ENOENT' });
  } finally { await f.done(); }
});

test('tool gate breaks an ownerless lock older than 5 s but waits on a live fresh one', async () => {
  const f = await fixture();
  try {
    await fs.mkdir(f.lock); const old = new Date(Date.now() - 10000); await fs.utimes(f.lock, old, old);
    assert.equal(f.call().decision, 'allow');
    await fs.mkdir(f.lock); await fs.writeFile(path.join(f.lock, 'owner'), JSON.stringify({ pid: process.pid, at: Date.now() }));
    assert.equal(f.call().decision, 'deny', 'a live, fresh owner still holds the lock');
    assert.equal((await fs.stat(f.lock)).isDirectory(), true, 'another owner lock is never removed');
    await fs.writeFile(path.join(f.lock, 'owner'), JSON.stringify({ pid: process.pid, at: Date.now() - 6000 }));
    assert.equal(f.call().decision, 'allow');
  } finally { await f.done(); }
});
