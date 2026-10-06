'use strict';
// Prompt/evidence contract that keeps AGY first-time-right: concrete nested result shape,
// explicit frame range, exact readable paths and every loaded skill named.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createJobServer, resultShape } = require('../../packages/agy-mcp-runner/job-server.cjs');

// Exact Pydantic v2 model_json_schema() of openshorts-engine core/gemini_worker.py DetailResponse.
const DETAIL = {"$defs":{"DetailClipModel":{"properties":{"start":{"title":"Start","type":"number"},"end":{"title":"End","type":"number"},"source_window_id":{"title":"Source Window Id","type":"string"},"predicted_score":{"title":"Predicted Score","type":"integer"},"video_description_for_tiktok":{"title":"Video Description For Tiktok","type":"string"},"video_description_for_instagram":{"title":"Video Description For Instagram","type":"string"},"video_title_for_youtube_short":{"title":"Video Title For Youtube Short","type":"string"},"viral_hook_text":{"title":"Viral Hook Text","type":"string"},"why":{"default":"","title":"Why","type":"string"}},"required":["start","end","source_window_id","predicted_score","video_description_for_tiktok","video_description_for_instagram","video_title_for_youtube_short","viral_hook_text"],"title":"DetailClipModel","type":"object"}},"properties":{"shorts":{"items":{"$ref":"#/$defs/DetailClipModel"},"title":"Shorts","type":"array"}},"required":["shorts"],"title":"DetailResponse","type":"object"};
const CLIP = { start: 1, end: 20, source_window_id: 'w1', predicted_score: 80, video_description_for_tiktok: 't', video_description_for_instagram: 'i', video_title_for_youtube_short: 'y', viral_hook_text: 'h' };
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

async function connect(overrides) {
  const job = { id: 'shape', kind: 'analysis', role: 'content-editor', prompt: 'p', schema: DETAIL, frames: [], skills: [], readFrames: new Set(), publishedUrls: new Set(), visionProof: () => true, ...overrides };
  const server = await createJobServer(job);
  const client = new Client({ name: 'shape-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { Authorization: `Bearer ${server.token}` } } }));
  return { server, client, text: (r) => r.content[0].text, close: async () => { await client.close(); await server.close(); } };
}

test('result shape renders $ref array items as concrete objects with types, enums and optional markers', () => {
  const shape = resultShape(DETAIL);
  assert.ok(!shape.includes('<item>'));
  assert.match(shape, /^\{"shorts": \[\{"start": <number>, "end": <number>, "source_window_id": "<string>", "predicted_score": <integer>, /);
  assert.match(shape, /"why"\?: "<string>"\}, \.\.\.\]\}$/);
  assert.equal(resultShape({ type: 'object', properties: { mode: { enum: ['TRACK', 'GENERAL'] }, score: { type: 'integer', minimum: 0, maximum: 100 }, note: { anyOf: [{ type: 'string' }, { type: 'null' }] }, tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 } }, required: ['mode', 'score'] }),
    '{"mode": "TRACK"|"GENERAL", "score": <integer 0..100>, "note"?: "<string>"|null, "tags"?: ["<string>", ... /* 1-3 items */]}');
});

test('submit_result description, error and evidence carry the concrete shape; string items are repaired', async () => {
  const f = await connect();
  try {
    const description = (await f.client.listTools()).tools.find((t) => t.name === 'submit_result').description;
    assert.match(description, /"shorts": \[\{"start": <number>/);
    assert.match(description, /never strings/);
    const evidence = JSON.parse(f.text(await f.client.callTool({ name: 'get_job_evidence', arguments: {} })));
    assert.equal(evidence.resultShape, `{"result": ${resultShape(DETAIL)}}`);
    const wrong = await f.client.callTool({ name: 'submit_result', arguments: { result: { shorts: ['a clip about tea'] } } });
    assert.equal(wrong.isError, true);
    assert.match(f.text(wrong), /\/shorts\/0 must be object/);
    assert.match(f.text(wrong), /Expected submit_result arguments \{"result": \{"shorts": \[\{"start": <number>, "end": <number>, "source_window_id"/);
    const ok = await f.client.callTool({ name: 'submit_result', arguments: { result: { shorts: [JSON.stringify(CLIP)] } } });
    assert.equal(ok.isError, undefined, f.text(ok));
    assert.deepEqual(f.server.result(), { shorts: [CLIP] });
  } finally { await f.close(); }
});

test('frame count and valid indexes are explicit; out-of-range reads name the nearest valid index', async () => {
  const frames = Array.from({ length: 8 }, (_, i) => ({ data: PNG.toString('base64'), mimeType: 'image/png', timestampSeconds: i, imagePath: `/owned/frame-${i}.png` }));
  const f = await connect({ frames, readableFiles: frames.map((x) => x.imagePath) });
  try {
    const read = (await f.client.listTools()).tools.find((t) => t.name === 'read_frame');
    assert.match(read.description, /exactly 8 frames: valid indexes 0-7 only/);
    assert.equal(read.inputSchema.properties.index.maximum, 7);
    const evidence = JSON.parse(f.text(await f.client.callTool({ name: 'get_job_evidence', arguments: {} })));
    assert.equal(evidence.frameCount, 8);
    assert.equal(evidence.validFrameIndexes, '0-7 only');
    assert.deepEqual(evidence.readableFiles, frames.map((x) => x.imagePath));
    assert.match(evidence.fileAccess, /call read_frame for every index and view_file every frame imagePath in one parallel batch/);
    await f.client.callTool({ name: 'read_frame', arguments: { index: 0 } });
    const over = await f.client.callTool({ name: 'read_frame', arguments: { index: 8 } });
    assert.equal(over.isError, true);
    assert.match(f.text(over), /Frame index 8 does not exist: this job has exactly 8 frames, valid indexes 0-7 only \(nearest valid index: 7\)\. Still unread: 1, 2, 3, 4, 5, 6, 7\./);
  } finally { await f.close(); }
});

test('denied view_file lists the exact readable paths and records the denied path', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-gate-test-'));
  try {
    const evidence = path.join(root, 'evidence'); await fs.mkdir(evidence);
    const frame = path.join(evidence, 'frame-0.png'); await fs.writeFile(frame, PNG);
    const outside = path.join(root, 'source.mp4'); await fs.writeFile(outside, 'x');
    const policy = { kind: 'analysis', framePaths: [frame], readableFiles: [frame], readRoots: [evidence], mcpTools: ['get_job_evidence', 'read_frame', 'submit_result'], trace: path.join(root, 'trace.jsonl') };
    await fs.writeFile(path.join(root, 'policy.json'), JSON.stringify(policy));
    const gate = path.resolve(__dirname, '../../packages/agy-mcp-runner/tool-gate.cjs');
    const run = (target) => JSON.parse(spawnSync(process.execPath, [gate, path.join(root, 'policy.json')], { input: JSON.stringify({ conversationId: 'c1', stepIdx: 1, toolCall: { name: 'view_file', args: { AbsolutePath: target } } }) }).stdout.toString());
    const denied = run(outside);
    assert.equal(denied.decision, 'deny');
    assert.ok(denied.reason.includes(`only exact paths supplied by the job are readable: ${frame}.`), denied.reason);
    assert.match(denied.reason, /Read frames with read_frame, then view_file its imagePath/);
    assert.equal(run(frame).decision, 'allow');
    const trace = (await fs.readFile(policy.trace, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(trace[0].deniedPath, outside);
    assert.equal(trace[1].deniedPath, undefined);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('job prompt names frame range, readable paths, concrete shape and every loaded skill', async () => {
  const { runTask } = require('../../packages/agy-mcp-runner/index.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-prompt-test-'));
  const vars = ['AGY_MCP_BINARY', 'AGY_MCP_AUTH_HOME', 'AGY_MCP_RECEIPT_DIRECTORY', 'AGY_MCP_SKILLS_DIRECTORY'];
  const before = Object.fromEntries(vars.map((key) => [key, process.env[key]]));
  try {
    const observed = path.join(root, 'prompt.txt'), binary = path.join(root, 'fake-agy'), skills = path.join(root, 'skills');
    for (const name of ['copywriting', 'viral-copywriting-master', 'video-retention-scriptwriting']) { await fs.mkdir(path.join(skills, name), { recursive: true }); await fs.writeFile(path.join(skills, name, 'SKILL.md'), `---\nname: ${name}\n---\n# ${name} rules`); }
    await fs.writeFile(binary, '#!/usr/bin/env node\n' + `const fs=require('node:fs'),i=process.argv.indexOf('-p'); if(i>0) { fs.writeFileSync(${JSON.stringify(observed)},process.argv[i+1]); fs.copyFileSync('.agents/agents/video-job/agent.md',${JSON.stringify(observed)}+'.agent.md'); }\n`, { mode: 0o700 });
    const frames = [];
    for (let i = 0; i < 3; i++) { const file = path.join(root, `in-${i}.png`); await fs.writeFile(file, PNG); frames.push({ path: file, timestampSeconds: i }); }
    Object.assign(process.env, { AGY_MCP_BINARY: binary, AGY_MCP_AUTH_HOME: root, AGY_MCP_RECEIPT_DIRECTORY: path.join(root, 'receipts'), AGY_MCP_SKILLS_DIRECTORY: skills });
    await assert.rejects(runTask({ kind: 'analysis', prompt: 'pick moments', schema: DETAIL, frames }), /did not submit/);
    const prompt = await fs.readFile(observed, 'utf8');
    assert.ok(prompt.includes(`{"result": ${resultShape(DETAIL)}}`));
    assert.match(prompt, /never strings/);
    assert.match(prompt, /exactly 3 frames, read_frame indexes 0-2 only; never request index 3 or higher/);
    // Skills are inlined into the agent system prompt: no SKILL.md view_file turns.
    assert.match(prompt, /view_file may open ONLY these exact absolute paths: \S+evidence\/frame-0\.png, \S+evidence\/frame-1\.png, \S+evidence\/frame-2\.png\. Every other path/);
    assert.ok(!prompt.includes('SKILL.md with view_file'));
    assert.match(prompt, /turn 1 = ONE parallel batch of get_job_evidence, read_frame for every index 0-2 and native view_file on every frame path/);
    const agent = await fs.readFile(observed + '.agent.md', 'utf8');
    for (const name of ['copywriting', 'viral-copywriting-master', 'video-retention-scriptwriting']) { assert.match(prompt, new RegExp(`${name} — [^;)]+`)); assert.match(agent, new RegExp(`## Skill: ${name} \\([^)]+\\)\\n# ${name} rules`)); }
    assert.equal((agent.match(/^---$/gm) || []).length, 2);
    assert.ok(!prompt.includes('<item>'));
  } finally {
    for (const key of vars) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('marketing and pipeline skills are allowlisted but not defaults', () => {
  const { SKILL_PURPOSES } = require('../../packages/agy-mcp-runner/index.cjs');
  assert.ok(SKILL_PURPOSES['ai-marketing-videos'] && SKILL_PURPOSES['ai-content-pipeline']);
});
