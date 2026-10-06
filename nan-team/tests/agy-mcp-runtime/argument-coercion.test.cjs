'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createJobServer } = require('../../packages/agy-mcp-runner/job-server.cjs');

const EDITS = { type: 'object', properties: { edits: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['type', 'start', 'end'], additionalProperties: false } } }, required: ['edits'], additionalProperties: false };
const FRAME = { imagePath: '/evidence/f.png', timestampSeconds: 1, data: Buffer.from('x').toString('base64'), mimeType: 'image/png' };
const text = (r) => r.content[0].text;

async function fixture(overrides = {}) {
  const events = [];
  const job = { id: 'coerce', kind: 'analysis', role: 'test', prompt: 'test', schema: EDITS, frames: [], skills: [], readFrames: new Set(), publishedUrls: new Set(), visionProof: () => true, onEvent: (e) => events.push(e), ...overrides };
  const server = await createJobServer(job);
  const client = new Client({ name: 'coerce-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { Authorization: `Bearer ${server.token}` } } }));
  return { job, server, client, events, close: async () => { await client.close(); await server.close(); } };
}
const good = { edits: [{ type: 'zoom', start: 1, end: 2 }] };

for (const key of ['frame_index', 'frameIndex', 'i', 'idx']) {
  test(`read_frame accepts ${key} alias and records a coerced note`, async () => {
    const f = await fixture({ frames: [FRAME, FRAME] });
    try {
      const r = await f.client.callTool({ name: 'read_frame', arguments: { [key]: 1 } });
      assert.equal(r.isError, undefined, text(r));
      assert.match(text(r), /^Frame 1,/);
      assert.ok(f.job.readFrames.has(1));
      assert.equal(f.server.calls.at(-1).coerced, `alias ${key}->index`);
      assert.ok(f.events.some((e) => e.type === 'mcp-coerced' && e.name === 'read_frame'));
    } finally { await f.close(); }
  });
}

test('read_frame alias stays strict: range check, extra keys and non-numeric values are rejected', async () => {
  const f = await fixture({ frames: [FRAME, FRAME] });
  try {
    assert.match(text(await f.client.callTool({ name: 'read_frame', arguments: { frame_index: 5 } })), /Frame index 5 does not exist/);
    assert.equal((await f.client.callTool({ name: 'read_frame', arguments: { frame_index: 1, note: 'x' } })).isError, true);
    assert.equal((await f.client.callTool({ name: 'read_frame', arguments: { idx: 'one' } })).isError, true);
    assert.equal((await f.client.callTool({ name: 'read_frame', arguments: { i: 1.5 } })).isError, true);
    assert.equal((await f.client.callTool({ name: 'read_frame', arguments: { index: '1' } })).isError, undefined);
    assert.equal(f.job.readFrames.size, 1);
  } finally { await f.close(); }
});

const accepted = async (args, note) => {
  const f = await fixture();
  try {
    await f.client.callTool({ name: 'get_job_evidence', arguments: {} });
    const r = await f.client.callTool({ name: 'submit_result', arguments: args });
    assert.deepEqual(JSON.parse(text(r)), { accepted: true }, text(r));
    assert.deepEqual(f.server.result(), good);
    assert.equal(f.server.calls.at(-1).coerced, note);
  } finally { await f.close(); }
};

test('submit_result accepts a bare result that validates', () => accepted(good, 'bare-result'));
test('submit_result accepts {"output": ...}', () => accepted({ output: good }, 'alias output->result'));
test('submit_result accepts {"data": "<json>"}', () => accepted({ data: JSON.stringify(good) }, 'alias data->result'));
test('submit_result accepts {"result": "<json>"}', () => accepted({ result: JSON.stringify(good) }, 'result-json-string'));
test('submit_result unwraps a double wrapper', () => accepted({ result: { result: good } }, 'unwrap result.result'));
test('submit_result unwraps {"result": {"output": ...}}', () => accepted({ result: { output: good } }, 'unwrap result.output'));
test('canonical submit_result records no coerced note', () => accepted({ result: good }, undefined));

test('submit_result stays strict after coercion and explains empty arguments', async () => {
  const f = await fixture();
  try {
    await f.client.callTool({ name: 'get_job_evidence', arguments: {} });
    assert.match(text(await f.client.callTool({ name: 'submit_result', arguments: {} })), /empty arguments.*\{"result": \{"edits"/);
    assert.match(text(await f.client.callTool({ name: 'submit_result', arguments: { edits: [{ type: 'zoom', start: '1', end: 2 }] } })), /Result schema violation: \/edits\/0\/start must be number/);
    assert.match(text(await f.client.callTool({ name: 'submit_result', arguments: { output: { edits: 'nope' } } })), /Result schema violation/);
    assert.match(text(await f.client.callTool({ name: 'submit_result', arguments: { result: good, extra: 1 } })), /received keys: result, extra/);
    assert.equal(f.server.result(), undefined);
  } finally { await f.close(); }
});

test('wrapper keys that are real schema properties are never unwrapped', async () => {
  const schema = { type: 'object', properties: { data: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'] } }, required: ['data'], additionalProperties: false };
  const f = await fixture({ schema });
  try {
    await f.client.callTool({ name: 'get_job_evidence', arguments: {} });
    assert.deepEqual(JSON.parse(text(await f.client.callTool({ name: 'submit_result', arguments: { data: { x: 1 } } }))), { accepted: true });
    assert.deepEqual(f.server.result(), { data: { x: 1 } });
  } finally { await f.close(); }
});

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('tool-gate allows only the caller\'s own spilled step output, keeps other paths denied, and traces argument shape', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-gate-spill-'));
  try {
    const brain = path.join(root, 'brain'), evidence = path.join(root, 'evidence'), mcpDir = path.join(root, 'mcp', 'video-job');
    const own = path.join(brain, 'conv-a', '.system_generated', 'steps', '4', 'output.txt');
    const other = path.join(brain, 'conv-b', '.system_generated', 'steps', '4', 'output.txt');
    const sibling = path.join(brain, 'conv-a', '.system_generated', 'steps', '4', 'other.txt');
    const pkg = path.join(root, 'workspace', 'package.json'), instructions = path.join(mcpDir, 'instructions.md');
    for (const file of [own, other, sibling, pkg, instructions]) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, 'x'); }
    await fs.mkdir(evidence);
    const policy = { kind: 'analysis', framePaths: [], readableFiles: [], brainRoot: brain, readRoots: [path.join(root, 'mcp'), evidence], mcpTools: ['get_job_evidence', 'read_frame', 'submit_result'], trace: path.join(root, 'trace.jsonl') };
    await fs.writeFile(path.join(root, 'policy.json'), JSON.stringify(policy));
    const gate = path.resolve(__dirname, '../../packages/agy-mcp-runner/tool-gate.cjs');
    let step = 0;
    const run = (toolCall, conversationId = 'conv-a') => JSON.parse(spawnSync(process.execPath, [gate, path.join(root, 'policy.json')], { input: JSON.stringify({ conversationId, stepIdx: ++step, toolCall }) }).stdout.toString());
    const view = (target) => run({ name: 'view_file', args: { AbsolutePath: target } }).decision;
    assert.equal(view(own), 'allow');
    assert.deepEqual(run({ name: 'view_file', args: { AbsolutePath: own } }).permissionOverrides, [`read_file(${await fs.realpath(own)})`]);
    assert.equal(view(other), 'deny');
    assert.equal(view(sibling), 'deny');
    assert.equal(view(pkg), 'deny');
    assert.equal(view(path.join(brain, 'conv-a', '.system_generated', 'steps', '4', '..', '..', '..', '..', 'conv-b', '.system_generated', 'steps', '4', 'output.txt')), 'deny');
    assert.equal(view(instructions), 'allow');
    assert.equal(run({ name: 'call_mcp_tool', args: { ServerName: 'video-job', ToolName: 'read_frame', Arguments: { frame_index: 2 } } }).decision, 'allow');
    run({ name: 'call_mcp_tool', args: { ServerName: 'video-job', ToolName: 'submit_result', Arguments: '{"result":{"secret":"v"}}' } });
    run({ name: 'call_mcp_tool', args: { ServerName: 'video-job', ToolName: 'submit_result', Arguments: '{"result":' } });
    const trace = (await fs.readFile(policy.trace, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(trace[0].spillFile, true);
    const mcp = trace.filter((entry) => entry.tool === 'call_mcp_tool');
    assert.equal(mcp[0].frameIndex, 2);
    assert.deepEqual(mcp[0].argumentShape, { type: 'object', keys: ['frame_index'] });
    assert.deepEqual(mcp[1].argumentShape, { type: 'string', keys: ['result'], length: 25, parsed: true });
    assert.deepEqual(mcp[2].argumentShape, { type: 'string', keys: [], length: 10, parsed: false });
    assert.ok(!JSON.stringify(trace).includes('secret'));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('runTask provides mcp/video-job/instructions.md from the job prompt', async () => {
  const { runTask } = require('../../packages/agy-mcp-runner/index.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-instructions-test-'));
  const vars = ['AGY_MCP_BINARY', 'AGY_MCP_AUTH_HOME', 'AGY_MCP_RECEIPT_DIRECTORY'];
  const before = Object.fromEntries(vars.map((key) => [key, process.env[key]]));
  try {
    const observed = path.join(root, 'instructions.txt'), binary = path.join(root, 'fake-agy');
    await fs.writeFile(binary, '#!/usr/bin/env node\n' + `const fs=require('node:fs'),p=require('node:path');if(process.argv.includes('-p')){try{fs.writeFileSync(${JSON.stringify(observed)},fs.readFileSync(p.join(process.env.HOME,'.gemini','antigravity-cli','mcp','video-job','instructions.md')))}catch(e){fs.writeFileSync(${JSON.stringify(observed)},'MISSING '+e.message)}}\n`, { mode: 0o700 });
    Object.assign(process.env, { AGY_MCP_BINARY: binary, AGY_MCP_AUTH_HOME: root, AGY_MCP_RECEIPT_DIRECTORY: path.join(root, 'receipts') });
    await assert.rejects(runTask({ kind: 'analysis', prompt: 'pick the tea moments', schema: EDITS }), /did not submit/);
    const text = await fs.readFile(observed, 'utf8');
    assert.match(text, /^# video-job MCP server/);
    assert.match(text, /pick the tea moments/);
    assert.match(text, /submit_result with arguments \{"result": \{"edits"/);
  } finally {
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await fs.rm(root, { recursive: true, force: true });
  }
});
