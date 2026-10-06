'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

async function main() {
  const fixture = JSON.parse(await fs.readFile(path.resolve(__dirname, '../reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const prisma = new PrismaClient();
  const client = new Client({ name: 'source-video-public-mcp-smoke', version: '1.0.0' });
  let temporaryKey;
  try {
    const org = await prisma.organization.findUnique({ where: { id: fixture.orgId }, select: { id: true, apiKey: true } });
    assert.ok(org, 'Local fixture organization is missing');
    temporaryKey = org.apiKey ? undefined : crypto.randomBytes(32).toString('hex');
    if (temporaryKey) {
      await prisma.organization.update({ where: { id: org.id }, data: { apiKey: temporaryKey } });
    }
    const key = temporaryKey || org.apiKey;
    const url = new URL('/mcp', process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000');
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Smoke test only permits a local backend');
    await client.connect(new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: `Bearer ${key}` } },
    }));
    const { tools } = await client.listTools();
    const names = tools.map(tool => tool.name);
    const expected = ['processSourceVideoTool', 'sourceVideoStatusTool', 'editVideoClipTool', 'cancelSourceVideoTool', 'sourceVideoProjectsTool', 'approveSourceVideoTool', 'sourceVideoCapabilitiesTool', 'sourceVideoEvidenceTool', 'sourceVideoDownloadTool'];
    const missing = expected.filter(name => !names.includes(name));
    assert.deepEqual(missing, [], `Missing source-video MCP tools: ${missing.join(', ')}`);
    const result = await client.callTool({ name: 'sourceVideoStatusTool', arguments: { jobId: fixture.jobId } });
    assert.notEqual(result.isError, true, 'Source-video status MCP call failed');
    const statusText = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    assert.ok(statusText.includes(fixture.jobId), 'Status tool did not return the fixture job');
    assert.ok(statusText.includes(fixture.final.clips[0].media.id), 'Status tool omitted the saved Media');
    assert.ok(!statusText.includes('transcript') && statusText.length < 8000, 'Agent status response is too large');
    const call = async (name, args) => {
      const response = await client.callTool({name,arguments:args});
      assert.notEqual(response.isError,true);
      const value = JSON.parse(response.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));
      assert.ok(!value.error,value.error);return value;
    };
    const sourceWords=await call('sourceVideoEvidenceTool',{jobId:fixture.jobId,kind:'words',limit:2});
    assert.equal(sourceWords.timestampBasis,'source');assert.equal(sourceWords.items.length,2);assert.equal(sourceWords.nextOffset,2);
    const nextWords=await call('sourceVideoEvidenceTool',{jobId:fixture.jobId,kind:'words',limit:2,offset:sourceWords.nextOffset});
    assert.ok(nextWords.items[0].startSeconds>=sourceWords.items[1].startSeconds);
    const clipWords=await call('sourceVideoEvidenceTool',{jobId:fixture.jobId,clipId:fixture.final.clips[0].clipId,kind:'words',limit:2});
    assert.equal(clipWords.timestampBasis,'clip');assert.ok(clipWords.sourceSegments.length);
    const scenes=await call('sourceVideoEvidenceTool',{jobId:fixture.jobId,kind:'scenes',limit:2});
    assert.equal(scenes.timestampBasis,'source');assert.ok(scenes.items.length);
    const projects=await call('sourceVideoProjectsTool',{limit:2});
    assert.ok(projects.projects.length<=2 && projects.projects.length>0);
    assert.ok(!JSON.stringify(projects).includes('transcript') && !JSON.stringify(projects).includes('plan'));
    const receipt = { kind: 'authenticated-public-mcp-discovery-and-call', endpoint: url.toString(), organizationId: fixture.orgId, expected, totalTools: names.length, sourceVideoTools: names.filter(name => expected.includes(name)), statusJobId: fixture.jobId, statusCallSucceeded: true, boundedStatusBytes: Buffer.byteLength(statusText),
      evidenceCalls:{sourceWordPage:true,continuedWordPage:true,clipWordPage:true,sourceScenes:true},boundedProjectHistory:true,passed: true };
    const file = path.resolve(__dirname, '../reports/openshorts-integration/public-mcp-discovery.json');
    await fs.writeFile(file, JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  } finally {
    await client.close().catch(() => {});
    if (temporaryKey) {
      await prisma.organization.updateMany({ where: { id: fixture.orgId, apiKey: temporaryKey }, data: { apiKey: null } });
    }
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
