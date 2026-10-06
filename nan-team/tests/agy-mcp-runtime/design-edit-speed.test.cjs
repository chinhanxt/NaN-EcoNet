'use strict';
// Polotno "AI thiết kế" speed: 60 s cache for an identical resend, and the runner's design-editor path
// (medium effort, frame read in turn 1 without get_job_evidence).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const source = path.resolve(__dirname, '../../libraries/nestjs-libraries/src/videos/agy-mcp/design-edit.cache.ts');
const compiled = new Module(source, module);
compiled.filename = source; compiled.paths = Module._nodeModulePaths(path.dirname(source));
compiled._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, source);
const { designEditCacheKey, DesignEditCache } = compiled.exports;

test('cache returns the same result within 60 s (also in flight), not after, and never caches failures', async () => {
  let now = 0, runs = 0;
  const cache = new DesignEditCache(60_000, 50, () => now);
  const key = designEditCacheKey('', '', 'make the title bigger', '[]');
  assert.notEqual(key, designEditCacheKey('', '', 'make the title smaller', '[]'));
  const produce = async () => { runs++; return { operations: [], summary: `run ${runs}` }; };
  const [a, b] = await Promise.all([cache.get(key, produce), cache.get(key, produce)]);
  assert.equal(runs, 1); assert.equal(a, b);
  now = 59_000; await cache.get(key, produce); assert.equal(runs, 1);
  now = 61_000; await cache.get(key, produce); assert.equal(runs, 2);
  await assert.rejects(cache.get('fail', async () => { throw new Error('agy down'); }), /agy down/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await cache.get('fail', async () => 'ok'), 'ok', 'a failure is not cached');
});

test('runner: design-editor defaults to medium effort; other roles unchanged', () => {
  const { selectEffort } = require('../../packages/agy-mcp-runner/index.cjs');
  assert.equal(selectEffort({ kind: 'content', role: 'design-editor' }, {}), 'medium');
  assert.equal(selectEffort({ kind: 'content', role: 'design-editor' }, { AGY_MCP_EFFORT_DESIGN_EDITOR: 'low' }), 'low');
  assert.equal(selectEffort({ kind: 'analysis', role: 'content-editor' }, {}), undefined);
});

test('runner: a design-editor frame job reads the frame in turn 1 without get_job_evidence; other vision roles keep it', async () => {
  const fsp = require('node:fs/promises'), os = require('node:os');
  const { runTask } = require('../../packages/agy-mcp-runner/index.cjs');
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'agy-design-edit-'));
  const binary = path.join(root, 'fake-agy'), frame = path.join(root, 'shot.png');
  await fsp.writeFile(frame, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDUkAAAAASUVORK5CYII=', 'base64'));
  await fsp.writeFile(binary, `#!/usr/bin/env node\nconst fs=require('node:fs'),i=process.argv.indexOf('-p');if(i>0)fs.writeFileSync(${JSON.stringify(path.join(root, 'prompt.txt'))},process.argv[i+1]);\n`, { mode: 0o700 });
  const saved = { ...process.env };
  Object.assign(process.env, { AGY_MCP_BINARY: binary, AGY_MCP_AUTH_HOME: root, AGY_MCP_RECEIPT_DIRECTORY: path.join(root, 'receipts'), AGY_MCP_SKILLS_DIRECTORY: path.join(root, 'none') });
  const schema = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false };
  try {
    await assert.rejects(runTask({ kind: 'content', role: 'design-editor', prompt: 'Make the title bigger. Elements: []', schema, frames: [{ path: frame, timestampSeconds: 0 }], skills: [] }), /did not submit/);
    const design = await fsp.readFile(path.join(root, 'prompt.txt'), 'utf8');
    assert.match(design, /do not call get_job_evidence\./);
    assert.match(design, /turn 1 = ONE parallel batch of read_frame for every index 0 and native view_file/);
    await assert.rejects(runTask({ kind: 'analysis', role: 'content-editor', prompt: 'pick moments', schema, frames: [{ path: frame, timestampSeconds: 0 }], skills: [] }), /did not submit/);
    assert.match(await fsp.readFile(path.join(root, 'prompt.txt'), 'utf8'), /turn 1 = ONE parallel batch of get_job_evidence, read_frame/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('empty page needs no screenshot; light edits run at low effort, new designs at medium; request effort reaches the runner', () => {
  const file = path.resolve(__dirname, '../../libraries/nestjs-libraries/src/videos/agy-mcp/design.edit.ts');
  const unit = new Module(file, module); unit.filename = file; unit.paths = Module._nodeModulePaths(path.dirname(file));
  unit._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
  const { designEditNeedsScreenshot, designEditEffort, designEditPrompt } = unit.exports;
  const page = { width: 1080, height: 1080 }, one = [{ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, zIndex: 0 }];
  assert.equal(designEditNeedsScreenshot({ instruction: 'tạo poster', page, elements: [] }), false);
  assert.match(designEditPrompt({ instruction: 'tạo poster', page, elements: [] }), /The page is empty, so no screenshot is attached/);
  assert.match(designEditPrompt({ instruction: 'đổi màu', page, elements: one }), /Frame 0 is a screenshot/);
  assert.equal(designEditEffort({ instruction: 'đổi màu tiêu đề sang đỏ', page, elements: one }), 'low');
  assert.equal(designEditEffort({ instruction: 'Make the title bigger', page, elements: one }), 'low');
  assert.equal(designEditEffort({ instruction: 'Tạo poster khuyến mãi', page, elements: one }), 'medium');
  assert.equal(designEditEffort({ instruction: 'làm cho đẹp hơn', page, elements: one }), 'medium');
  assert.equal(designEditEffort({ instruction: 'đổi màu', page, elements: [] }), 'medium', 'empty page = new design');
  const { selectEffort } = require('../../packages/agy-mcp-runner/index.cjs');
  assert.equal(selectEffort({ kind: 'content', role: 'design-editor', effort: 'low' }, {}), 'low');
  assert.equal(selectEffort({ kind: 'content', role: 'design-editor', effort: 'low' }, { AGY_MCP_EFFORT_DESIGN_EDITOR: 'high' }), 'high', 'operator env wins');
});
