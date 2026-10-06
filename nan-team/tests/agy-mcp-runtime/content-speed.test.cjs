'use strict';
require('./ts-register.cjs');
// H (speed): storyboard content calls. (1) get_job_evidence no longer echoes the prompt the CLI
// already received, so AGY does not spill it to a file and spend a view_file turn on it.
// (2) A content session that makes no job MCP call within AGY_MCP_CONTENT_HEDGE_MS is hedged on
// another account; the first result wins and the other session is aborted.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createJobServer, PROMPT_IN_TASK } = require('../../packages/agy-mcp-runner/job-server.cjs');
const source=path.resolve(__dirname,'../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts');
const contentSchema={type:'object',properties:{content:{type:'string',minLength:1}},required:['content'],additionalProperties:false};

async function service() {
  const code=ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  const compiled=new Module(source,module);compiled.filename=source;compiled.paths=Module._nodeModulePaths(path.dirname(source));
  const originalLoad=Module._load;
  Module._load=(name,parent,isMain)=>{
    if(name==='../video.asset')return {readLocalVideoAsset:async()=>undefined,assertAiVideoAssetUrl:(value)=>value};
    if(name==='../runtime.path')return {resolveWorkspaceArtifact:()=>'',memAvailableBytes:()=>64*1024**3};
    if(name==='@gitroom/nestjs-libraries/upload/upload.factory')return {UploadFactory:{createStorage:()=>{throw new Error('Unexpected upload');}}};
    return originalLoad(name,parent,isMain);
  };
  try {compiled._compile(code,source);return new compiled.exports.AgyMcpService();}
  finally {Module._load=originalLoad;}
}
async function withEnv(values,fn){
  const saved={...process.env};Object.assign(process.env,values);
  try{return await fn();}finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
}
const POOL={AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test',AGY_MCP_MIN_FREE_MB:'1',AGY_MCP_CONTENT_CONCURRENCY:'1',AGY_MCP_MAX_CONCURRENCY:'1'};
// First session stays silent (no MCP call) until aborted.
const silent=(opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true}));

test('evidence omits the prompt already given to the CLI; direct job servers keep it',async()=>{
  for(const [promptInTask,expected] of [[true,PROMPT_IN_TASK],[undefined,'long storyboard instruction']]){
    const server=await createJobServer({id:'e',kind:'content',role:'content-writer',prompt:'long storyboard instruction',promptInTask,schema:contentSchema,frames:[],skills:[],readFrames:new Set(),publishedUrls:new Set()});
    const client=new Client({name:'e',version:'1'});
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url),{requestInit:{headers:{Authorization:`Bearer ${server.token}`}}}));
    try{
      const evidence=JSON.parse((await client.callTool({name:'get_job_evidence',arguments:{}})).content[0].text);
      assert.equal(evidence.prompt,expected);
      assert.equal(evidence.resultShape,'{"result": {"content": "<non-empty string>"}}');
      assert.equal((await client.callTool({name:'submit_result',arguments:{result:{content:'ok'}}})).isError,undefined);
    }finally{await client.close();await server.close();}
  }
});

test('runner: content evidence carries a short pointer while -p carries the full prompt',async()=>{
  const {runTask}=require('../../packages/agy-mcp-runner/index.cjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'agy-content-speed-'));
  const binary=path.join(root,'fake-agy'),sdk=path.dirname(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
  // `mcp add` records the job server; the `-p` run reads evidence and submits through real MCP.
  await fs.writeFile(binary,`#!/usr/bin/env node
const fs=require('node:fs'),argv=process.argv,out=${JSON.stringify(root)};
if(argv.includes('add')){fs.writeFileSync('.fake-mcp.json',JSON.stringify({url:argv.at(-1),auth:argv[argv.indexOf('--header')+1]}));process.exit(0);}
if(!argv.includes('-p'))process.exit(0);
const {Client}=require(${JSON.stringify(path.join(sdk,'index.js'))}),{StreamableHTTPClientTransport}=require(${JSON.stringify(path.join(sdk,'streamableHttp.js'))});
(async()=>{const {url,auth}=JSON.parse(fs.readFileSync('.fake-mcp.json','utf8'));
const client=new Client({name:'fake',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:auth.replace(/^Authorization: /,'')}}}));
const evidence=(await client.callTool({name:'get_job_evidence',arguments:{}})).content[0].text;
fs.writeFileSync(out+'/evidence.json',evidence);fs.writeFileSync(out+'/prompt.txt',argv[argv.indexOf('-p')+1]);
await client.callTool({name:'submit_result',arguments:{result:{content:'drafted'}}});await client.close();})().catch((e)=>{console.error(e);process.exit(1);});
`,{mode:0o700});
  const skills=path.join(root,'skills');
  for(const name of ['copywriting','viral-copywriting-master','video-retention-scriptwriting']){await fs.mkdir(path.join(skills,name),{recursive:true});await fs.writeFile(path.join(skills,name,'SKILL.md'),`# ${name}`);}
  try{
    await withEnv({AGY_MCP_BINARY:binary,AGY_MCP_AUTH_HOME:root,AGY_MCP_RECEIPT_DIRECTORY:path.join(root,'receipts'),AGY_MCP_SKILLS_DIRECTORY:skills},async()=>{
      const prompt='STORYBOARD '+'x'.repeat(9000);
      const {result}=await runTask({kind:'content',role:'content-writer',prompt,schema:contentSchema});
      assert.deepEqual(result,{content:'drafted'});
      const evidence=JSON.parse(await fs.readFile(path.join(root,'evidence.json'),'utf8'));
      assert.equal(evidence.prompt,PROMPT_IN_TASK);
      assert.ok((await fs.readFile(path.join(root,'evidence.json'),'utf8')).length<2000,'evidence reply stays small');
      assert.ok((await fs.readFile(path.join(root,'prompt.txt'),'utf8')).endsWith('\n'+prompt),'CLI prompt still carries the full job prompt');
      // Above 100 KiB (UTF-8 bytes, Vietnamese is 2-3 bytes/char) the prompt would hit E2BIG as one argv string:
      // -p carries a pointer and get_job_evidence returns the full prompt instead.
      const large='KỊCH BẢN '+'ở'.repeat(40000);
      assert.ok(large.length<100*1024&&Buffer.byteLength(large)>100*1024);
      assert.deepEqual((await runTask({kind:'content',role:'content-writer',prompt:large,schema:contentSchema})).result,{content:'drafted'});
      assert.equal(JSON.parse(await fs.readFile(path.join(root,'evidence.json'),'utf8')).prompt,large);
      const cli=await fs.readFile(path.join(root,'prompt.txt'),'utf8');
      assert.ok(Buffer.byteLength(cli)<16*1024,'CLI argument stays far below MAX_ARG_STRLEN');
      assert.ok(!cli.includes(large)&&cli.includes('get_job_evidence returns it in full'));
    });
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('content session with no MCP call is hedged on another account; first result wins, loser aborted',async()=>{
  await withEnv({...POOL,AGY_MCP_CONTENT_HEDGE_MS:'40'},async()=>{
    const native=await service(),calls=[];
    native.runner=()=>({runTask:(request,opts)=>{calls.push(opts);
      if(calls.length===1)return silent(opts);
      return (async()=>{await request.onEvent({type:'mcp-call',name:'get_job_evidence'});return {result:{content:'hedged draft'}};})();}});
    const started=Date.now();
    assert.equal(await native.content('storyboard'),'hedged draft');
    assert.ok(Date.now()-started<2000);
    assert.equal(calls.length,2);
    assert.notEqual(calls[0].providerUrl,calls[1].providerUrl);
    assert.equal(calls[0].signal.aborted,true);
    assert.equal(calls[0].onImageStall,undefined,'content never gets image stall hooks');
  });
});

test('a content session that already called MCP is never hedged, even when drafting is slow',async()=>{
  await withEnv({...POOL,AGY_MCP_CONTENT_HEDGE_MS:'30'},async()=>{
    const native=await service(),calls=[],events=[];
    native.runner=()=>({runTask:async(request,opts)=>{calls.push(opts);
      await request.onEvent({type:'mcp-call',name:'get_job_evidence'});
      await new Promise((resolve)=>setTimeout(resolve,150));
      return {result:{content:'slow but alive'}};}});
    const result=await native.run({kind:'content',role:'content-writer',prompt:'p',schema:contentSchema,onEvent:(event)=>{events.push(event.type);}});
    assert.equal(result.content,'slow but alive');
    assert.equal(calls.length,1);
    assert.deepEqual(events,['mcp-call'],'caller onEvent still receives events');
  });
});

test('content hedging is off with one provider or AGY_MCP_CONTENT_HEDGE_MS=0',async()=>{
  for(const env of [{AGY_MCP_PROVIDER_URLS:'http://p1.test'},{AGY_MCP_CONTENT_HEDGE_MS:'0'}])
    await withEnv({...POOL,AGY_MCP_CONTENT_HEDGE_MS:'20',...env},async()=>{
      const native=await service();let count=0;
      native.runner=()=>({runTask:async()=>{count++;await new Promise((resolve)=>setTimeout(resolve,120));return {result:{content:'single'}};}});
      assert.equal(await native.content('p'),'single');
      assert.equal(count,1);
    });
});

test('text-only jobs with the evidence in -p may submit without get_job_evidence; other jobs still must read it',async()=>{
  for(const [evidenceInPrompt,accepted] of [[true,true],[undefined,false]]){
    const server=await createJobServer({id:'s',kind:'content',role:'content-writer',prompt:'p',promptInTask:true,evidenceInPrompt,schema:contentSchema,frames:[],skills:[],readFrames:new Set(),publishedUrls:new Set()});
    const client=new Client({name:'s',version:'1'});
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url),{requestInit:{headers:{Authorization:`Bearer ${server.token}`}}}));
    try{
      const reply=await client.callTool({name:'submit_result',arguments:{result:{content:'direct'}}});
      assert.equal(reply.isError===true,!accepted,reply.content[0].text);
      if(!accepted)assert.match(reply.content[0].text,/call get_job_evidence first/);
      else assert.deepEqual(server.result(),{content:'direct'});
    }finally{await client.close();await server.close();}
  }
});

test('runner: a text-only content job is told to skip get_job_evidence, submits in turn 1, and records the startup split',async()=>{
  const {runTask}=require('../../packages/agy-mcp-runner/index.cjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'agy-evidence-in-prompt-'));
  const binary=path.join(root,'fake-agy'),sdk=path.dirname(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
  // The fake CLI emits one stream event, then submits directly (no get_job_evidence call).
  await fs.writeFile(binary,`#!/usr/bin/env node
const fs=require('node:fs'),argv=process.argv,out=${JSON.stringify(root)};
if(argv.includes('add')){fs.writeFileSync('.fake-mcp.json',JSON.stringify({url:argv.at(-1),auth:argv[argv.indexOf('--header')+1]}));process.exit(0);}
if(!argv.includes('-p'))process.exit(0);
console.log(JSON.stringify({event:'init'}));
const {Client}=require(${JSON.stringify(path.join(sdk,'index.js'))}),{StreamableHTTPClientTransport}=require(${JSON.stringify(path.join(sdk,'streamableHttp.js'))});
(async()=>{const {url,auth}=JSON.parse(fs.readFileSync('.fake-mcp.json','utf8'));
fs.writeFileSync(out+'/prompt.txt',argv[argv.indexOf('-p')+1]);fs.copyFileSync('.agents/agents/video-job/agent.md',out+'/agent.md');
const client=new Client({name:'fake',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:auth.replace(/^Authorization: /,'')}}}));
const reply=await client.callTool({name:'submit_result',arguments:{result:{content:'turn one'}}});
fs.writeFileSync(out+'/submit.json',JSON.stringify(reply));await client.close();})().catch((e)=>{console.error(e);process.exit(1);});
`,{mode:0o700});
  const skills=path.join(root,'skills');
  for(const name of ['copywriting','viral-copywriting-master','video-retention-scriptwriting']){await fs.mkdir(path.join(skills,name),{recursive:true});await fs.writeFile(path.join(skills,name,'SKILL.md'),`# ${name}`);}
  try{
    await withEnv({AGY_MCP_BINARY:binary,AGY_MCP_AUTH_HOME:root,AGY_MCP_RECEIPT_DIRECTORY:path.join(root,'receipts'),AGY_MCP_SKILLS_DIRECTORY:skills},async()=>{
      const {result,receipt}=await runTask({kind:'content',role:'content-writer',prompt:'STORYBOARD job',schema:contentSchema});
      assert.deepEqual(result,{content:'turn one'});
      assert.equal(JSON.parse(await fs.readFile(path.join(root,'submit.json'),'utf8')).isError,undefined);
      const prompt=await fs.readFile(path.join(root,'prompt.txt'),'utf8'),agent=await fs.readFile(path.join(root,'agent.md'),'utf8');
      assert.match(prompt,/do not call get_job_evidence or any other tool before you are done; write the result and make video-job\/submit_result your first and only tool call/);
      assert.ok(!prompt.includes('Call get_job_evidence on video-job first'));
      assert.match(agent,/All job evidence is in the task prompt; do not call get_job_evidence\./);
      assert.equal(receipt.startup.evidenceInPrompt,true);
      assert.ok(receipt.startup.setupMs>=0&&receipt.startup.cliFirstEventMs>=0,JSON.stringify(receipt.startup));
      // A chat job keeps the evidence step.
      await assert.rejects(runTask({kind:'chat',role:'chat',prompt:'hi',schema:contentSchema}),/did not submit/);
      assert.match(await fs.readFile(path.join(root,'prompt.txt'),'utf8'),/Call get_job_evidence on video-job first/);
    });
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
