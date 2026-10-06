'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { sign } = require('jsonwebtoken');

async function main() {
  const root = path.resolve(__dirname, '..');
  const live = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const headers = { cookie: `auth=${sign({ id: live.userId }, process.env.JWT_SECRET)}`, showorg: live.orgId };
  const base = 'http://127.0.0.1:3000';
  const listed = await fetch(`${base}/copilot/list`, { headers });
  assert.equal(listed.status, 200);
  const { threads } = await listed.json();
  let matchingThread;
  for (const thread of threads || []) {
    const response = await fetch(`${base}/copilot/${thread.id}/list`, { headers });
    if (!response.ok) continue;
    const messages = await response.json();
    const body = JSON.stringify(messages);
    if (body.includes(live.jobId) && body.includes(live.final.clips[0].media.id)) {
      matchingThread = thread.id;
      break;
    }
  }
  assert.ok(matchingThread, 'Completed source-video Agent answer was not persisted in this organization');
  const nativeReceiptPath = '/home/chinhan/.local/share/nan-team/agy-mcp-receipts/e449805d-9052-425b-b4f7-d2b8fb91b0e1.json';
  const native = JSON.parse(await fs.readFile(nativeReceiptPath, 'utf8'));
  assert.equal(native.mcpCalls.filter(call => call.tool === 'sourceVideoStatusTool').length, 1);
  assert.equal(native.mcpCalls.filter(call => call.tool === 'submit_result').length, 1);
  const receipt = { kind: 'source-video-agent-chat-memory-verified', jobId: live.jobId, mediaId: live.final.clips[0].media.id, threadId: matchingThread, nativeReceiptPath, nativeJobId: native.jobId, mcpTools: native.mcpCalls.map(call => call.tool), persistedUserAndAssistant: true };
  await fs.writeFile(path.join(root, 'reports/openshorts-integration/browser/agent-chat-memory-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
