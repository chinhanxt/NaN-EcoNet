'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createJobServer } = require('../../packages/agy-mcp-runner/job-server.cjs');
const { ownedPath, bootstrap, nativeEnvironment } = require('../../packages/agy-mcp-runner/index.cjs');
const { runProcess } = require('../../packages/agy-mcp-runner/process.cjs');

async function fixture(overrides = {}) {
  const job = { id: 'fixture', kind: 'analysis', role: 'test', prompt: 'test', schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['pass'] } }, required: ['verdict'], additionalProperties: false }, frames: [], skills: [], readFrames: new Set(), publishedUrls: new Set(), ...overrides };
  const server = await createJobServer(job);
  const client = new Client({ name: 'runtime-test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { Authorization: `Bearer ${server.token}` } } }));
  return { server, client, close: async () => { await client.close(); await server.close(); } };
}

test('explicit native provider overrides inherited route without inheriting unrelated credentials', () => {
  const env = nativeEnvironment('/owned/profile', {
    PATH: '/bin', HOME: '/real/home', AGY_MCP_PROVIDER_URL: 'http://explicit.test', CLOUD_CODE_URL: 'http://inherited.test',
    HTTPS_PROXY: 'http://proxy.test', OPENAI_API_KEY: 'private-fixture',
  });
  assert.equal(env.CLOUD_CODE_URL, 'http://explicit.test');
  assert.equal(env.HOME, '/owned/profile');
  assert.equal(env.HTTPS_PROXY, 'http://proxy.test');
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(nativeEnvironment('/owned/profile', { CLOUD_CODE_URL: 'http://inherited.test' }).CLOUD_CODE_URL, 'http://inherited.test');
  assert.equal(nativeEnvironment('/owned/profile', {}).CLOUD_CODE_URL, undefined);
});

test('real MCP discovery and submission enforce evidence and schemas', async () => {
  const f = await fixture();
  try {
    assert.deepEqual((await f.client.listTools()).tools.map((t) => t.name), ['get_job_evidence', 'submit_result']);
    assert.equal((await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'pass' } } })).isError, true);
    await f.client.callTool({ name: 'get_job_evidence', arguments: {} });
    assert.equal((await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'invented' } } })).isError, true);
    await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'pass' } } });
    assert.deepEqual(f.server.result(), { verdict: 'pass' });
    assert.equal((await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'pass' } } })).isError, true);
    assert.equal((await fetch(f.server.url, { method: 'POST' })).status, 403);
  } finally { await f.close(); }
});

test('chat without visual evidence does not expose a frame-reading tool', async () => {
  const f = await fixture({ kind: 'chat', frames: [] });
  try {
    const names = (await f.client.listTools()).tools.map(tool => tool.name);
    assert.ok(names.includes('get_job_evidence'));
    assert.ok(names.includes('submit_result'));
    assert.ok(!names.includes('read_frame'));
  } finally { await f.close(); }
});

test('AGY process classifies eligibility failures without storing provider stderr', async () => {
  await assert.rejects(
    runProcess(process.execPath, ['-e', 'process.stderr.write("account eligibility denied; secret=private-value"); process.exit(1)'],
      { cwd: os.tmpdir(), env: process.env, timeoutMs: 5000 }),
    error => error.category === 'account-eligibility'
      && error.message.includes('native authentication unavailable')
      && !error.message.includes('private-value'),
  );
});

test('root-local Pydantic $defs validate at the job boundary after MCP transport', async () => {
  const schema = {$defs:{ScoredWindowModel:{type:'object',properties:{id:{type:'string'},start:{type:'number'},end:{type:'number'},score:{type:'integer'},reason:{type:'string'}},required:['id','start','end','score','reason'],additionalProperties:false}},type:'object',properties:{windows:{type:'array',items:{$ref:'#/$defs/ScoredWindowModel'}}},required:['windows'],additionalProperties:false};
  const f=await fixture({schema});
  try {
    await f.client.callTool({name:'get_job_evidence',arguments:{}});
    assert.equal((await f.client.callTool({name:'submit_result',arguments:{result:{windows:[{id:'window_001',start:0,end:18,score:'high',reason:'topic'}]}}})).isError,true);
    assert.equal(f.server.result(),undefined);
    const valid={windows:[{id:'window_001',start:0,end:18,score:42,reason:'clear topic'}]};
    assert.notEqual((await f.client.callTool({name:'submit_result',arguments:{result:valid}})).isError,true);
    assert.deepEqual(f.server.result(),valid);
  } finally { await f.close(); }
});

test('custom authenticated tools are invoked through MCP with event receipts', async () => {
  const events = [];
  const f = await fixture({ tools: [{ name: 'org_lookup', description: 'Authorized test tool', inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false }, execute: async ({ id }) => ({ organizationId: id }) }], onEvent: (event) => events.push(event) });
  try {
    assert.equal((await f.client.callTool({ name: 'org_lookup', arguments: { id: 'wrong' } })).isError, true);
    const result = await f.client.callTool({ name: 'org_lookup', arguments: { id: 12 } });
    assert.deepEqual(JSON.parse(result.content[0].text), { organizationId: 12 });
    assert.deepEqual(events.filter((e) => e.type.startsWith('tool-')).map((e) => e.type), ['tool-call', 'tool-result']);
  } finally { await f.close(); }
});

test('artifact capability rejects symlink escape and auth bootstrap excludes global tools/hooks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-runtime-test-'));
  try {
    const owned = path.join(root, 'owned'), auth = path.join(root, 'auth'), home = path.join(root, 'home');
    await fs.mkdir(owned); await fs.writeFile(path.join(root, 'secret'), 'test');
    await fs.symlink(path.join(root, 'secret'), path.join(owned, 'escape'));
    await assert.rejects(ownedPath(owned, path.join(owned, 'escape')), /outside/);
    const cli = path.join(auth, '.gemini', 'antigravity-cli');
    await fs.mkdir(cli, { recursive: true });
    await fs.writeFile(path.join(cli, 'settings.json'), JSON.stringify({ model: 'user-model', hooks: ['never copy'], toolPermission: 'always-proceed' }));
    await fs.writeFile(path.join(cli, 'antigravity-oauth-token'), 'fixture');
    const copied = await bootstrap(home, auth);
    const config = JSON.parse(await fs.readFile(path.join(copied, 'settings.json')));
    assert.equal(config.model, 'user-model'); assert.equal(config.hooks, undefined);
    assert.equal(config.toolPermission, 'request-review');
    assert.equal((await fs.stat(path.join(copied, 'antigravity-oauth-token'))).mode & 0o777, 0o600);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('deadline and abort terminate subprocess rather than abandoning work', async () => {
  const config = { cwd: os.tmpdir(), env: { PATH: process.env.PATH }, timeoutMs: 60 };
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], config), /deadline/);
  const controller = new AbortController();
  const pending = runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...config, timeoutMs: 10000, signal: controller.signal });
  controller.abort(); await assert.rejects(pending, /cancelled/);
  const deadline = new AbortController();
  const timed = runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...config, timeoutMs: 10000, signal: deadline.signal });
  deadline.abort(new Error('AGY job deadline exceeded'));
  await assert.rejects(timed, /deadline exceeded/);
});

test('native specialists cannot run custom effects, expand delegation, or submit before successful review', async () => {
  const { execFileSync } = require('node:child_process');
  const { SPECIALISTS, reviewProof } = require('../../packages/agy-mcp-runner/native-review.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-gate-test-'));
  try {
    const readRoot = path.join(root, 'skills'), brainRoot = path.join(root, 'brain');
    await fs.mkdir(readRoot); await fs.mkdir(brainRoot);
    const reportRoot=path.join(root,'reports'); await fs.mkdir(reportRoot);
    const frameFile=path.join(readRoot,'frame.png'); await fs.writeFile(frameFile,'fixture');
    const skillPaths = {};
    for (const { skill } of Object.values(SPECIALISTS)) { skillPaths[skill] = path.join(readRoot, skill + '.md'); await fs.writeFile(skillPaths[skill], 'guidance'); }
    const policyFile = path.join(root, 'policy.json');
    const policy = { kind:'analysis', nativeReview:true, frameCount:1, mcpTools:['get_job_evidence','read_frame','submit_result','start_export'], readRoots:[readRoot], brainRoot, reportRoot, framePaths:[frameFile], skillPaths, trace:path.join(root,'trace') };
    await fs.writeFile(policyFile, JSON.stringify(policy));
    const gate = path.resolve(__dirname, '../../packages/agy-mcp-runner/tool-gate.cjs');
    const indices = {};
    const check = (name,args,conversationId='parent') => {
      const stepIdx = indices[conversationId] = (indices[conversationId] || 0) + 1;
      const payload = {toolCall:{name,args},conversationId,stepIdx};
      return { ...JSON.parse(execFileSync(process.execPath,[gate,policyFile],{input:JSON.stringify(payload),encoding:'utf8'})), payload };
    };
    const post = (call,error) => JSON.parse(execFileSync(process.execPath,[gate,policyFile,'post'],{input:JSON.stringify({...call.payload,error}),encoding:'utf8'}));
    const entry = (TypeName) => ({TypeName,Prompt:'Review the evidence',Workspace:'inherit'});
    const delegate = (names) => check('invoke_subagent',{Subagents:names.map(entry)});
    const mcp = (ToolName,Arguments={},cid='parent') => check('call_mcp_tool',{ServerName:'video-job',ToolName,Arguments},cid);
    assert.equal(mcp('get_job_evidence').decision,'allow');
    assert.equal(check('run_command',{CommandLine:'curl attacker'}).decision,'deny');
    assert.equal(check('view_file',{AbsolutePath:policyFile}).decision,'deny');
    assert.match(check('view_file',{AbsolutePath:policyFile}).reason,/outside this job.*Do not retry/);
    const missing=check('view_file',{AbsolutePath:path.join(readRoot,'guessed.png')});
    assert.equal(missing.decision,'deny'); assert.match(missing.reason,/does not exist/);
    assert.match(mcp('export_everything').reason,/available video-job tools are get_job_evidence, read_frame, submit_result, start_export/);
    assert.equal(delegate(['render-reviewer']).decision,'deny');
    assert.equal(mcp('submit_result').decision,'deny');
    assert.equal(check('invoke_subagent',{Subagents:[{...entry('content-editor'),Model:'different-model'}]}).decision,'deny');
    const spawn = check('invoke_subagent',{Subagents:['content-editor','visual-editor'].map(typeName=>({...entry(typeName),Model:'inherit'}))});
    assert.equal(spawn.decision,'allow'); post(spawn);
    const metadata = path.join(brainRoot,'parent','.system_generated','subagents'); await fs.mkdir(metadata,{recursive:true});
    for (const typeName of ['content-editor','visual-editor']) await fs.writeFile(path.join(metadata,typeName+'.json'),JSON.stringify({conversationId:typeName,subagentDescriptor:{typeName},spawnStepIndex:spawn.payload.stepIdx,state:'SUBAGENT_STATE_ALIVE'}));
    assert.equal(mcp('start_export',{},'content-editor').decision,'deny');
    assert.equal(mcp('submit_result',{},'content-editor').decision,'deny');
    assert.equal(check('invoke_subagent',{Subagents:[entry('render-reviewer')]},'content-editor').decision,'deny');
    assert.equal(check('generate_image',{},'content-editor').decision,'deny');
    assert.equal(check('send_message',{Recipient:'unrelated',Message:'hello'},'content-editor').decision,'deny');
    for (const typeName of ['content-editor','visual-editor']) {
      post(mcp('get_job_evidence',{},typeName));
      post(mcp('read_frame',{index:0},typeName));
      post(check('view_file',{AbsolutePath:frameFile},typeName));
      post(check('view_file',{AbsolutePath:skillPaths[SPECIALISTS[typeName].skill]},typeName));
      const report = check('send_message',{Recipient:'parent',Message:'Grounded critique'},typeName); post(report,typeName==='content-editor'?'delivery failed':undefined);
    }
    assert.equal(delegate(['render-reviewer']).decision,'deny');
    assert.equal(reviewProof(policy).succeeded,false);
    post(check('send_message',{Recipient:'parent',Message:'Grounded critique'},'content-editor'));
    const renderSpawn = delegate(['render-reviewer']); assert.equal(renderSpawn.decision,'allow');
    assert.ok(renderSpawn.overwrite.Subagents[0].Prompt.includes('Verified content-editor findings:'));
    assert.ok(renderSpawn.overwrite.Subagents[0].Prompt.includes('Verified visual-editor findings:'));
    post(renderSpawn);
    await fs.writeFile(path.join(metadata,'render-reviewer.json'),JSON.stringify({conversationId:'render-reviewer',subagentDescriptor:{typeName:'render-reviewer'},spawnStepIndex:renderSpawn.payload.stepIdx}));
    assert.equal(mcp('submit_result').decision,'deny');
    post(mcp('get_job_evidence',{},'render-reviewer')); post(mcp('read_frame',{index:0},'render-reviewer'));
    post(check('view_file',{AbsolutePath:frameFile},'render-reviewer'));
    post(check('view_file',{AbsolutePath:skillPaths[SPECIALISTS['render-reviewer'].skill]},'render-reviewer'));
    post(check('send_message',{Recipient:'parent',Message:'Reviewed both editor findings'},'render-reviewer'));
    assert.equal(reviewProof(policy).succeeded,true);
    assert.equal(mcp('submit_result').decision,'allow');
    assert.equal(delegate(['render-reviewer']).decision,'deny');
    assert.equal(delegate(['unknown']).decision,'deny');
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('MCP submission also rejects missing native review and invalid frame reads', async () => {
  const f = await fixture({nativeReview:true,reviewProof:()=>({succeeded:false}),frames:[{data:'iVBORw0KGgo=',mimeType:'image/png',timestampSeconds:1}],readFrames:new Set()});
  try {
    await f.client.callTool({name:'get_job_evidence',arguments:{}});
    assert.equal((await f.client.callTool({name:'read_frame',arguments:{index:0,extra:true}})).isError,true);
    await f.client.callTool({name:'read_frame',arguments:{index:0}});
    assert.equal((await f.client.callTool({name:'submit_result',arguments:{result:{verdict:'pass'}}})).isError,true);
    assert.equal(f.server.result(),undefined);
  } finally { await f.close(); }
});

test('printed model JSON cannot replace MCP submission and owned profiles are cleaned', async () => {
  const { runTask, readReceipt } = require('../../packages/agy-mcp-runner/index.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-fake-cli-test-'));
  const vars = ['AGY_MCP_BINARY','AGY_MCP_AUTH_HOME','AGY_MCP_RECEIPT_DIRECTORY'];
  const before = Object.fromEntries(vars.map((key) => [key, process.env[key]]));
  let receipt;
  try {
    const binary = path.join(root, 'fake-agy');
    const observed = path.join(root, 'observed-root');
    await fs.writeFile(binary, '#!/usr/bin/env node\n' + `if(process.argv.includes('-p')) { require('node:fs').writeFileSync(${JSON.stringify(observed)},require('node:path').dirname(process.cwd())); console.log(JSON.stringify({event:'result',result:{ok:true}})); }\n`, { mode: 0o700 });
    process.env.AGY_MCP_BINARY = binary; process.env.AGY_MCP_AUTH_HOME = root;
    process.env.AGY_MCP_RECEIPT_DIRECTORY = path.join(root, 'receipts');
    await assert.rejects(runTask({ kind: 'analysis', prompt: 'fake CLI fixture', schema: { type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false }, skills: [], onEvent: async (event) => { if (event.type === 'receipt') { await new Promise((resolve)=>setTimeout(resolve,20)); receipt = event.receipt; } } }), /did not submit/);
    assert.equal(receipt.status, 'failed');
    assert.equal((await readReceipt(receipt.jobId)).runtimeHash, receipt.runtimeHash);
    const allocated = await fs.readFile(observed, 'utf8');
    await assert.rejects(fs.access(allocated), { code: 'ENOENT' });
    await assert.rejects(readReceipt('../credentials'), /Invalid/);
  } finally {
    for (const key of vars) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('native NDJSON events arrive before process completion and survive UTF-8 chunk splits',async()=>{
  const {runProcess}=require('../../packages/agy-mcp-runner/process.cjs');const seen=[];
  const script=`const bytes=Buffer.from(JSON.stringify({step_update:{state:'ERROR',tool_name:'generate_image',tool_info:{error:{message:'quota tiếng Việt'}}}})+'\\n');const split=bytes.indexOf(Buffer.from('ế'))+1;process.stdout.write(bytes.subarray(0,split));setTimeout(()=>process.stdout.write(bytes.subarray(split)),20);setTimeout(()=>process.exit(0),120);`;
  let observed;const first=new Promise(resolve=>{observed=resolve;});
  const pending=runProcess(process.execPath,['-e',script],{cwd:process.cwd(),env:process.env,timeoutMs:2000,onNativeEvent:event=>{seen.push(event);observed();}});
  await Promise.race([first,pending.then(()=>{throw new Error('Native event was not streamed');})]);
  assert.equal(seen.length,1);assert.equal(seen[0].step_update.tool_info.error.message,'quota tiếng Việt');await pending;
});

test('native tool diagnostics handle scoped errors without exposing credentials',()=>{
 const {nativeToolDiagnostic}=require('../../packages/agy-mcp-runner/process.cjs');
 const diagnostic=nativeToolDiagnostic({tool_name:'generate_image',tool_info:{generate_image:{error_message:'permission denied 403 Bearer fixture-token api_key=fixture-key refresh_token=fixture-refresh'}}});
 assert.equal(diagnostic.category,'permission');assert.deepEqual(diagnostic.infoKeys,['generate_image']);
 for(const secret of ['fixture-token','fixture-key','fixture-refresh'])assert.ok(!diagnostic.message.includes(secret));
});

test('job MCP errors name the exact fix so the agent does not guess or loop', async () => {
  const f = await fixture({ frames: [0, 1, 2].map((timestampSeconds) => ({ data: 'iVBORw0KGgo=', mimeType: 'image/png', timestampSeconds, imagePath: `/owned/${timestampSeconds}.png` })), readFrames: new Set(), visionProof: () => true,
    tools: [{ name: 'org_lookup', description: 'Authorized test tool', inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false }, execute: async ({ id }) => ({ id }) }] });
  try {
    const text = (r) => r.content[0].text;
    const early = await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'pass' } } });
    assert.match(text(early), /call get_job_evidence first/);
    const bad = await f.client.callTool({ name: 'org_lookup', arguments: { id: 'x', extra: 1 } });
    assert.equal(bad.isError, true);
    assert.match(text(bad), /org_lookup/); assert.match(text(bad), /\/id must be integer/); assert.match(text(bad), /extra/);
    assert.equal(JSON.parse(text(await f.client.callTool({ name: 'org_lookup', arguments: { id: 7 } }))).id, 7);
    await f.client.callTool({ name: 'get_job_evidence', arguments: {} });
    await f.client.callTool({ name: 'read_frame', arguments: { index: 1 } });
    assert.match(text(await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'pass' } } })), /indexes 0, 2$/);
    await f.client.callTool({ name: 'read_frame', arguments: { index: 0 } });
    await f.client.callTool({ name: 'read_frame', arguments: { index: 2 } });
    assert.deepEqual(JSON.parse(text(await f.client.callTool({ name: 'submit_result', arguments: { result: { verdict: 'pass' } } }))), { accepted: true });
  } finally { await f.close(); }
});

test('first-time-right submission: shape hints, lossless result repair and publish_image alias', async () => {
  const content = { type: 'object', properties: { content: { type: 'string', minLength: 1 } }, required: ['content'], additionalProperties: false };
  const published = [];
  const f = await fixture({ kind: 'image', schema: content, publishImage: async (candidate) => { published.push(candidate); return 'https://storage.invalid/a.png'; } });
  try {
    const text = (r) => r.content[0].text;
    const tools = (await f.client.listTools()).tools;
    assert.equal(tools.some((t) => t.name === 'read_frame'), false);
    assert.match(tools.find((t) => t.name === 'submit_result').description, /\{"result": \{"content": "<non-empty string>"\}\}/);
    assert.match(tools.find((t) => t.name === 'publish_image').description, /"path"/);
    assert.equal(text(await f.client.callTool({ name: 'publish_image', arguments: { image_path: '/brain/a.png' } })), JSON.stringify({ url: 'https://storage.invalid/a.png' }));
    assert.deepEqual(published, ['/brain/a.png']);
    assert.equal((await f.client.callTool({ name: 'publish_image', arguments: { image_path: '/a', path: '/b' } })).isError, true);
    await f.client.callTool({ name: 'get_job_evidence', arguments: {} });
    const wrong = await f.client.callTool({ name: 'submit_result', arguments: { result: { content: '' } } });
    assert.match(text(wrong), /Expected submit_result arguments \{"result": \{"content": "<non-empty string>"\}\}/);
  } finally { await f.close(); }
  for (const [args, expected] of [
    [{ content: 'plain answer' }, { content: 'plain answer' }],
    [{ result: '{"content":"from string"}' }, { content: 'from string' }],
    [{ result: { content: { scenes: [1], theme: 'x' } } }, { content: '{"scenes":[1],"theme":"x"}' }],
    [{ result: { scenes: [1], theme: 'x' } }, { content: '{"scenes":[1],"theme":"x"}' }],
  ]) {
    const g = await fixture({ kind: 'content', schema: content });
    try {
      await g.client.callTool({ name: 'get_job_evidence', arguments: {} });
      const r = await g.client.callTool({ name: 'submit_result', arguments: args });
      assert.equal(r.isError, undefined, r.content[0].text);
      assert.deepEqual(g.server.result(), expected);
    } finally { await g.close(); }
  }
  const strict = await fixture();
  try {
    await strict.client.callTool({ name: 'get_job_evidence', arguments: {} });
    assert.equal((await strict.client.callTool({ name: 'submit_result', arguments: { result: { verdict: { nested: true } } } })).isError, true);
    assert.equal(strict.server.result(), undefined);
  } finally { await strict.close(); }
});
