'use strict';
require('./ts-register.cjs');
// W1: image fail-fast + reroute, stall hedge, and publish-completes-job (fewer turns).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createJobServer } = require('../../packages/agy-mcp-runner/job-server.cjs');
const { runTask } = require('../../packages/agy-mcp-runner/index.cjs');
const urlSchema={type:'object',properties:{url:{type:'string',minLength:1}},required:['url'],additionalProperties:false};
const source=path.resolve(__dirname,'../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts');

async function service(storage) {
  const code=ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  const compiled=new Module(source,module);compiled.filename=source;compiled.paths=Module._nodeModulePaths(path.dirname(source));
  const originalLoad=Module._load;
  Module._load=(name,parent,isMain)=>{
    if(name==='../video.asset')return {readLocalVideoAsset:async()=>undefined,assertAiVideoAssetUrl:(value)=>value};
    if(name==='../runtime.path')return {resolveWorkspaceArtifact:()=>'',memAvailableBytes:()=>Number(/^MemAvailable:\s+(\d+)\s+kB/m.exec(require('node:fs').readFileSync('/proc/meminfo','utf8'))?.[1]||0)*1024};
    if(name==='@gitroom/nestjs-libraries/upload/upload.factory')return {UploadFactory:{createStorage:()=>{if(storage)return storage;throw new Error('Unexpected upload');}}};
    return originalLoad(name,parent,isMain);
  };
  try {compiled._compile(code,source);return new compiled.exports.AgyMcpService();}
  finally {Module._load=originalLoad;}
}
async function withEnv(values,fn){
  const saved={...process.env};Object.assign(process.env,values);
  try{return await fn();}finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
}
async function fakeCli(body,fn){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'agy-w1-image-'));
  const binary=path.join(root,'fake-agy');
  await fs.writeFile(binary,'#!/usr/bin/env node\nif(!process.argv.includes(\'-p\'))process.exit(0);\n'+(typeof body==='function'?body(root):body),{mode:0o700});
  try{return await withEnv({AGY_MCP_BINARY:binary,AGY_MCP_AUTH_HOME:root,AGY_MCP_RECEIPT_DIRECTORY:path.join(root,'receipts')},()=>fn(root));}
  finally{await fs.rm(root,{recursive:true,force:true});}
}

test('url-only image job completes on publish_image without a submit_result turn',async()=>{
  const job={id:'w1',kind:'image',role:'art',prompt:'p',schema:urlSchema,frames:[],skills:[],readFrames:new Set(),publishedUrls:new Set(),
    publishImage:async()=>{job.publishedUrls.add('https://storage.invalid/i.png');return 'https://storage.invalid/i.png';}};
  const server=await createJobServer(job);
  const client=new Client({name:'w1',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url),{requestInit:{headers:{Authorization:`Bearer ${server.token}`}}}));
  try{
    const reply=JSON.parse((await client.callTool({name:'publish_image',arguments:{path:'/brain/i.png'}})).content[0].text);
    assert.equal(reply.submitted,true);
    assert.deepEqual(server.result(),{url:'https://storage.invalid/i.png'});
    assert.equal(server.calls.at(-1).autoSubmitted,true);
    assert.equal((await client.callTool({name:'submit_result',arguments:{result:{url:'https://storage.invalid/i.png'}}})).isError,true,'second submission rejected');
  }finally{await client.close();await server.close();}
});

test('transient generate_image failure aborts the job at once (no slow in-session retry)',async()=>{
  const event=JSON.stringify({step_update:{state:'ERROR',tool_name:'generate_image',tool_info:{error:{message:'failed to generate content: 502 Bad Gateway, body: {"error": "Upstream connection failed: The read operation timed out"}'}}}});
  await fakeCli((dir)=>`require('node:fs').writeFileSync(${JSON.stringify(path.join(dir,'prompt.txt'))},process.argv[process.argv.indexOf('-p')+1]);console.log(${JSON.stringify(event)});setTimeout(()=>{},30000);`,async(root)=>{
    let receipt;const started=Date.now();
    await assert.rejects(runTask({kind:'image',role:'art',prompt:'scene',schema:urlSchema,onEvent:(e)=>{if(e.type==='receipt')receipt=e.receipt;}},{imageFailFast:true}),(error)=>error.category==='image-upstream-transient');
    assert.ok(Date.now()-started<10000,'job was not aborted early');
    assert.equal(receipt.failureCategory,'image-upstream-transient');
    assert.equal(receipt.nativeToolErrors[0].tool,'generate_image');
    const prompt=await fs.readFile(path.join(root,'prompt.txt'),'utf8');
    assert.match(prompt,/ONE parallel batch of get_job_evidence and native generate_image/);assert.match(prompt,/never retry it yourself/);assert.match(prompt,/do not call submit_result/);
  });
});

test('stalled generate_image notifies the hedge hook and aborts before the provider timeout',async()=>{
  // The fake CLI records a native generate_image start 50s ago in the job's hook trace, then hangs.
  const body=`const fs=require('node:fs'),path=require('node:path');fs.appendFileSync(path.join(path.dirname(process.cwd()),'policy-trace.jsonl'),JSON.stringify({phase:'pre',tool:'generate_image',allowed:true,conversationId:'c',stepIdx:4,at:new Date(Date.now()-50000).toISOString()})+'\\n');setTimeout(()=>{},30000);`;
  await fakeCli(body,async()=>{
    let stalls=0;const started=Date.now();
    await assert.rejects(runTask({kind:'image',role:'art',prompt:'scene',schema:urlSchema},{imageFailFast:true,imageStallMs:20000,imageStallAbortMs:45000,onImageStall:()=>stalls++}),(error)=>error.category==='image-stalled');
    assert.equal(stalls,1);
    assert.ok(Date.now()-started<10000);
  });
});

test('service reroutes a fail-fast image to a different account without backoff',async()=>{
  await withEnv({AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test',AGY_MCP_MIN_FREE_MB:'1',AGY_MCP_IMAGE_CONCURRENCY:'4',AGY_MCP_MAX_CONCURRENCY:'4'},async()=>{
    const native=await service(),providers=[],options=[];
    native.runner=()=>({runTask:async(request,opts)=>{providers.push(opts.providerUrl);options.push(opts);
      if(providers.length===1){await request.onEvent({type:'receipt',receipt:{status:'failed',failureCategory:'image-upstream-transient',nativeToolErrors:[]}});throw Object.assign(new Error('AGY generate_image failed transiently'),{category:'image-upstream-transient'});}
      return {result:{url:'https://uploads.example.test/uploads/ok.png'}};}});
    const started=Date.now();
    assert.equal(await native.image('scene'),'https://uploads.example.test/uploads/ok.png');
    assert.ok(Date.now()-started<3000,'reroute waited for backoff');
    assert.equal(providers.length,2);assert.notEqual(providers[0],providers[1]);
    assert.equal(options[0].imageFailFast,true);assert.equal(options[0].imageStallAbortMs,35000);
    assert.equal(typeof options[0].onImageStall,'function');
  });
});

test('stalled image is hedged on another account even with all slots busy; first result wins, loser aborted',async()=>{
  await withEnv({AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test',AGY_MCP_MIN_FREE_MB:'1',AGY_MCP_IMAGE_CONCURRENCY:'1',AGY_MCP_MAX_CONCURRENCY:'1'},async()=>{
    const native=await service(),calls=[];
    native.runner=()=>({runTask:(request,opts)=>{calls.push(opts);
      if(calls.length===1)return new Promise((_resolve,reject)=>{opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true});setImmediate(()=>opts.onImageStall());});
      assert.equal(opts.onImageStall,undefined,'a hedge never hedges again');
      return Promise.resolve({result:{url:'https://uploads.example.test/uploads/hedged.png'}});}});
    assert.equal(await native.image('scene'),'https://uploads.example.test/uploads/hedged.png');
    assert.equal(calls.length,2);
    assert.notEqual(calls[0].providerUrl,calls[1].providerUrl);
    assert.equal(calls[0].signal.aborted,true);
  });
});

test('a hedge loser that still publishes after the winner settled has its upload removed',async()=>{
  await withEnv({AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test',AGY_MCP_MIN_FREE_MB:'1',AGY_MCP_IMAGE_CONCURRENCY:'1',AGY_MCP_MAX_CONCURRENCY:'1'},async()=>{
    const removed=[],native=await service({removeFile:async(url)=>{removed.push(url);}}),calls=[];
    native.runner=()=>({runTask:(request,opts)=>{calls.push(opts);
      // The loser's publish lands inside the winner's settle window: it resolves instead of rejecting on abort.
      if(calls.length===1)return new Promise((resolve)=>{opts.signal.addEventListener('abort',()=>resolve({result:{url:'https://uploads.example.test/uploads/loser.png'}}),{once:true});setImmediate(()=>opts.onImageStall());});
      return Promise.resolve({result:{url:'https://uploads.example.test/uploads/winner.png'}});}});
    assert.equal(await native.image('scene'),'https://uploads.example.test/uploads/winner.png');
    await new Promise((resolve)=>setImmediate(resolve));
    assert.deepEqual(removed,['https://uploads.example.test/uploads/loser.png']);
    assert.equal(typeof calls[0].removeImage,'function','runner gets the same storage cleanup for aborted/failed publishes');
  });
});

test('hedging is off with one provider or AGY_MCP_IMAGE_HEDGE_MS=0',async()=>{
  for(const env of [{AGY_MCP_PROVIDER_URLS:'http://p1.test'},{AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test',AGY_MCP_IMAGE_HEDGE_MS:'0'}])
    await withEnv({...env,AGY_MCP_MIN_FREE_MB:'1'},async()=>{
      const native=await service();let seen;
      native.runner=()=>({runTask:async(_request,opts)=>{seen=opts;return {result:{url:'u'}};}});
      await native.image('scene');
      assert.equal(seen.onImageStall,undefined);assert.equal(seen.imageFailFast,true);
    });
});

test('startup: job CLI never spawns the auto-updater; effort is opt-in per role',()=>{
  const {nativeEnvironment,selectEffort}=require('../../packages/agy-mcp-runner/index.cjs');
  assert.equal(nativeEnvironment('/owned',{PATH:'/bin'}).AGY_CLI_DISABLE_AUTO_UPDATE,'1');
  assert.equal(nativeEnvironment('/owned',{PATH:'/bin',AGY_MCP_ALLOW_AUTO_UPDATE:'1'}).AGY_CLI_DISABLE_AUTO_UPDATE,undefined);
  assert.equal(selectEffort({kind:'image',role:'visual art director'},{}),undefined);
  assert.equal(selectEffort({kind:'image',role:'visual art director'},{AGY_MCP_EFFORT_IMAGE:' Low '}),'low');
  assert.equal(selectEffort({kind:'analysis',role:'asr-repair'},{AGY_MCP_EFFORT_IMAGE:'low'}),undefined);
  assert.equal(selectEffort({kind:'analysis',role:'asr-repair'},{AGY_MCP_EFFORT:'bogus'}),undefined);
  // Text-only post roles have built-in defaults; a role env var still wins, video roles are untouched.
  assert.equal(selectEffort({kind:'content',role:'caption-writer'},{}),'medium');
  assert.equal(selectEffort({kind:'analysis',role:'text-editor'},{}),'low');
  assert.equal(selectEffort({kind:'content',role:'caption-writer'},{AGY_MCP_EFFORT_CAPTION_WRITER:'high'}),'high');
  assert.equal(selectEffort({kind:'content',role:'content-writer'},{}),undefined);
  assert.equal(selectEffort({kind:'analysis',role:'content-editor'},{}),undefined);
});

test('startup: effort flag reaches the CLI and the prompt forbids shell probes up front',async()=>{
  await fakeCli((dir)=>`require('node:fs').writeFileSync(${JSON.stringify(path.join(dir,'argv.json'))},JSON.stringify(process.argv));process.exit(1);`,async(root)=>{
    await withEnv({AGY_MCP_EFFORT_IMAGE:'low'},()=>assert.rejects(runTask({kind:'image',role:'art',prompt:'scene',schema:urlSchema})));
    const argv=JSON.parse(await fs.readFile(path.join(root,'argv.json'),'utf8'));
    assert.equal(argv[argv.indexOf('--effort')+1],'low');
    assert.match(argv[argv.indexOf('-p')+1],/^There is no shell, terminal or file-writing tool in this job: never call run_command/);
  });
});
