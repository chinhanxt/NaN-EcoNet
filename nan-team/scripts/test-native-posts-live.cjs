'use strict';
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { sign } = require('jsonwebtoken');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const receiptDirectory = process.env.AGY_MCP_RECEIPT_DIRECTORY || path.join(os.homedir(), '.local/share/nan-team/agy-mcp-receipts');
  const before = new Set(await fs.readdir(receiptDirectory));
  const headers = { cookie: `auth=${sign({ id: source.userId }, process.env.JWT_SECRET)}`, showorg: source.orgId, 'content-type': 'application/json' };
  const report = { kind: 'native-posts-live', startedAt: new Date().toISOString(), status: 'running', tests: {}, sourceFiles: {} };
  for (const relative of [
    'libraries/nestjs-libraries/src/agent/agent.graph.service.ts',
    'libraries/nestjs-libraries/src/agent/separate.posts.ts',
    'libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts',
    'apps/backend/src/api/routes/posts.controller.ts',
    'libraries/helpers/src/utils/read.ndjson.ts',
    'apps/frontend/src/components/launches/generator/generator.tsx',
  ]) report.sourceFiles[relative] = createHash('sha256').update(await fs.readFile(path.join(root, relative))).digest('hex');
  const destination = path.join(root, 'reports/openshorts-integration/native-posts-live.json');
  try {
    const previous = JSON.parse(await fs.readFile(destination, 'utf8'));
    if (previous.status === 'running') throw new Error('Previous live observation is nonterminal; inspect its process before retrying');
    const suffix = previous.startedAt.replace(/[^0-9]/g, '');
    await fs.copyFile(destination, path.join(root, `reports/openshorts-integration/native-posts-live-attempt-${suffix}.json`));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const save = () => fs.writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  await save();
  try {
    const content = 'Save water at home. Turn off taps when brushing. Reuse rainwater in the garden.';
    const split = await fetch('http://127.0.0.1:3000/posts/separate-posts', {
      method: 'POST', headers, body: JSON.stringify({ content, len: 50 }), signal: AbortSignal.timeout(360000),
    });
    assert.equal(split.status, 201);
    const separated = await split.json();
    assert.ok(separated.posts.length >= 2);
    assert.ok(separated.posts.every(post => typeof post === 'string' && post.length <= 50));
    assert.equal(separated.posts.join(' ').replace(/\s+/g, ' ').trim(), content);
    report.tests.split = { status: split.status, result: separated }; await save();
    const generated = await fetch('http://127.0.0.1:3000/posts/generator', {
      method: 'POST', headers, body: JSON.stringify({
        research: 'Write a short factual post about saving water at home: turn off taps when brushing and reuse rainwater for plants. Avoid statistics and recent news.',
        format: 'one_short', tone: 'personal', isPicture: false,
      }), signal: AbortSignal.timeout(1500000),
    });
    assert.equal(generated.status, 201);
    const events = [];
    const decoder = new TextDecoder(); let buffered = '';
    report.tests.generator = { status: generated.status, streamStatus: 'running', stages: [] };
    await save();
    for await (const chunk of generated.body) {
      buffered += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line); events.push(event);
        if (event.event === 'on_chain_start' && !report.tests.generator.stages.includes(event.name)) {
          report.tests.generator.stages.push(event.name); await save();
        }
      }
    }
    buffered += decoder.decode();
    if (buffered.trim()) events.push(JSON.parse(buffered));
    assert.ok(!events.some(event => event.error), 'Generator emitted an error event');
    const final = events.filter(event => event.event === 'on_chain_end' && event.name === 'LangGraph').pop()?.data.output;
    assert.equal(typeof final?.hook, 'string');
    assert.ok(final.content.length === 1 && final.content[0].content.length <= 200);
    assert.ok(Number.isFinite(Date.parse(final.date)));
    report.tests.generator = { status: generated.status, stages: [...new Set(events.map(event => event.name))], output: final };
    const additions = (await fs.readdir(receiptDirectory)).filter(name => !before.has(name) && name.endsWith('.json'));
    report.nativeReceipts = [];
    for (const name of additions) {
      const bytes = await fs.readFile(path.join(receiptDirectory, name));
      const receipt = JSON.parse(bytes);
      report.nativeReceipts.push({ filename: name, sha256: createHash('sha256').update(bytes).digest('hex'), receipt });
    }
    assert.ok(report.nativeReceipts.length >= 4, 'Missing native task receipts for split and generator stages');
    assert.ok(report.nativeReceipts.every(entry => entry.receipt.status !== 'failed' &&
      entry.receipt.mcpCalls.some(call => call.tool === 'submit_result')), 'Native inference did not submit schema-validated MCP results');
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.message;
    throw error;
  } finally { report.finishedAt = new Date().toISOString(); await save(); }
  console.log(JSON.stringify({ status: report.status, nativeReceipts: report.nativeReceipts.length, report: destination }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
