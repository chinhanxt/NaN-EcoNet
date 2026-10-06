'use strict';
require('./ts-register.cjs');
// X1: an AGY proxy account that is rate-limited / out of quota must fail over to another proxy
// within seconds, be cooled down for its reset window, and an all-exhausted pool must fail
// with a clear error (no stall, no retry storm). Uses local HTTP fake proxies + a fake CLI.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const {runProcess}=require('../../packages/agy-mcp-runner/process.cjs');
const source=path.resolve(__dirname,'../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts');
const runnerPath=path.resolve(__dirname,'../../packages/agy-mcp-runner/index.cjs');
const sdkClient=require.resolve('@modelcontextprotocol/sdk/client/index.js');
const sdkTransport=require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js');
const QUOTA_BODY=JSON.stringify({error:{code:429,message:'You have exhausted your capacity on this model. Your quota will reset after 39m47s.',status:'RESOURCE_EXHAUSTED',details:[{reason:'QUOTA_EXHAUSTED',metadata:{quotaResetDelay:'39m47.427209928s'}}]}});

async function loadService() {
  const code=ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  const compiled=new Module(source,module);compiled.filename=source;compiled.paths=Module._nodeModulePaths(path.dirname(source));
  const originalLoad=Module._load;
  Module._load=(name,parent,isMain)=>{
    if(name==='../video.asset')return {readLocalVideoAsset:async()=>undefined,assertAiVideoAssetUrl:(value)=>value};
    if(name==='../runtime.path')return {resolveWorkspaceArtifact:()=>'',memAvailableBytes:()=>Number(/^MemAvailable:\s+(\d+)\s+kB/m.exec(require('node:fs').readFileSync('/proc/meminfo','utf8'))?.[1]||0)*1024};
    if(name==='@gitroom/nestjs-libraries/upload/upload.factory')return {UploadFactory:{createStorage:()=>{throw new Error('Unexpected upload');}}};
    return originalLoad(name,parent,isMain);
  };
  try {compiled._compile(code,source);return {exports:compiled.exports,native:new compiled.exports.AgyMcpService()};}
  finally {Module._load=originalLoad;}
}
async function withEnv(values,fn){
  const saved={...process.env};
  for(const key of ['AGY_MCP_PROVIDER_URLS','AGY_MCP_PROVIDER_URL','CLOUD_CODE_URL'])delete process.env[key];
  Object.assign(process.env,values);
  try{return await fn();}finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
}
/** Fake AGYXT proxy: 'quota' answers 429 RESOURCE_EXHAUSTED, 'ok' answers 200. */
async function fakeProxy(mode){
  const hits=[];
  const server=http.createServer((req,res)=>{hits.push(req.url);
    if(mode==='quota'){res.writeHead(429,{'content-type':'application/json'});res.end(QUOTA_BODY);}
    else {res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');}});
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,hits,close:()=>new Promise((resolve)=>server.close(resolve))};
}
/** Fake `agy` CLI: records the MCP server on `mcp add`; on `-p` calls its provider (CLOUD_CODE_URL);
 *  a 429 is printed to stderr with exit 1 (as the real CLI does), a 200 submits the result over MCP. */
async function fakeCli(fn){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'agy-x1-quota-'));
  const binary=path.join(root,'fake-agy');
  await fs.writeFile(binary,`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const state=path.join(process.env.HOME,'mcp.json');
const args=process.argv.slice(2);
if(args[0]==='mcp'&&args[1]==='add'){fs.writeFileSync(state,JSON.stringify({header:args[args.indexOf('--header')+1],url:args[args.length-1]}));process.exit(0);}
if(!args.includes('-p'))process.exit(0);
(async()=>{
  const response=await fetch(process.env.CLOUD_CODE_URL+'/v1internal:streamGenerateContent',{method:'POST',body:'{}'});
  const body=await response.text();
  if(!response.ok){process.stderr.write('Error: failed to generate content: '+response.status+' Too Many Requests, body: '+body+'\\n');process.exit(1);}
  const {Client}=require(${JSON.stringify(sdkClient)});const {StreamableHTTPClientTransport}=require(${JSON.stringify(sdkTransport)});
  const mcp=JSON.parse(fs.readFileSync(state,'utf8'));
  const client=new Client({name:'fake-agy',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(mcp.url),{requestInit:{headers:{Authorization:mcp.header.replace(/^Authorization:\\s*/,'')}}}));
  await client.callTool({name:'get_job_evidence',arguments:{}});
  await client.callTool({name:'submit_result',arguments:{result:{content:'ok from '+process.env.CLOUD_CODE_URL}}});
  await client.close();
  setTimeout(()=>process.exit(0),30000);
})().catch((error)=>{process.stderr.write(String(error&&error.stack||error));process.exit(3);});
`,{mode:0o700});
  try{return await withEnv({AGY_MCP_BINARY:binary,AGY_MCP_AUTH_HOME:root,AGY_MCP_RECEIPT_DIRECTORY:path.join(root,'receipts'),AGY_MCP_MIN_FREE_MB:'1'},()=>fn(root));}
  finally{await fs.rm(root,{recursive:true,force:true});}
}
const schema={type:'object',properties:{content:{type:'string',minLength:1}},required:['content'],additionalProperties:false};

test('agyQuotaCooldownMs follows the provider reset hint, clamped, default 5 min',async()=>{
  const {exports}=await loadService();
  assert.equal(exports.agyQuotaCooldownMs('Your quota will reset after 39m47s.'),(39*60+47)*1000);
  assert.equal(exports.agyQuotaCooldownMs('"quotaResetDelay": "1h2m3.5s"'),3723500);
  assert.equal(exports.agyQuotaCooldownMs('39m47.427209928s'),Math.round((39*60+47.427209928)*1000));
  assert.equal(exports.agyQuotaCooldownMs('reset after 5s'),60000,'minimum 1 min');
  assert.equal(exports.agyQuotaCooldownMs('reset after 30h'),6*3600000,'maximum 6 h');
  assert.equal(exports.agyQuotaCooldownMs('429 Too Many Requests'),300000);
  assert.equal(exports.agyQuotaCooldownMs(undefined),300000);
});

test('runner tags a CLI exit caused by a 429/RESOURCE_EXHAUSTED proxy as provider-quota with its reset hint',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'agy-x1-proc-'));
  try{
    const bin=path.join(root,'cli');
    await fs.writeFile(bin,`#!/usr/bin/env node\nprocess.stderr.write('failed: 429 Too Many Requests, body: '+${JSON.stringify(JSON.stringify(QUOTA_BODY))});process.exit(1);`,{mode:0o700});
    await assert.rejects(runProcess(bin,[],{cwd:root,env:process.env,timeoutMs:10000}),(error)=>error.category==='provider-quota'&&error.quotaResetAfter==='39m47s'&&/rate-limited or out of quota/.test(error.message));
    await fs.writeFile(bin,`#!/usr/bin/env node\nprocess.stderr.write('dial tcp: connection refused');process.exit(1);`,{mode:0o700});
    await assert.rejects(runProcess(bin,[],{cwd:root,env:process.env,timeoutMs:10000}),(error)=>error.category==='provider-unreachable');
    await fs.writeFile(bin,`#!/usr/bin/env node\nprocess.stderr.write('boom');process.exit(1);`,{mode:0o700});
    await assert.rejects(runProcess(bin,[],{cwd:root,env:process.env,timeoutMs:10000}),(error)=>error.category==='process-failed');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('quota-exhausted proxy fails over to the next proxy within seconds and stays cooled down (real runner + fake proxies)',async()=>{
  const bad=await fakeProxy('quota'),good=await fakeProxy('ok');
  try{
    await fakeCli(async()=>withEnv({AGY_MCP_PROVIDER_URLS:`${bad.url},${good.url}`},async()=>{
      const {native}=await loadService();
      native.runner=()=>require(runnerPath);
      const started=Date.now();
      const first=await native.analyzeJson({prompt:'x',schema,skills:[]});
      const elapsed=Date.now()-started;
      assert.equal(first.content,`ok from ${good.url}`);
      assert.equal(bad.hits.length,1,'exhausted proxy tried once');
      assert.ok(elapsed<5000,`failover took ${elapsed} ms (no 5 s backoff expected)`);
      // Later jobs skip the cooled account entirely, even though it is the least busy.
      for(let index=0;index<2;index++)assert.equal((await native.analyzeJson({prompt:'y',schema,skills:[]})).content,`ok from ${good.url}`);
      assert.equal(bad.hits.length,1,'cooled-down proxy was reused');
      assert.equal(good.hits.length,3);
    }));
  }finally{await bad.close();await good.close();}
});

test('all proxies exhausted: clear quota error quickly, no retry storm or hang (real runner + fake proxies)',async()=>{
  const p1=await fakeProxy('quota'),p2=await fakeProxy('quota');
  try{
    await fakeCli(async()=>withEnv({AGY_MCP_PROVIDER_URLS:`${p1.url},${p2.url}`},async()=>{
      const {native}=await loadService();
      native.runner=()=>require(runnerPath);
      const started=Date.now();
      await assert.rejects(native.analyzeJson({prompt:'x',schema,skills:[]}),(error)=>{
        assert.match(error.message,/AGY quota exhausted: all 2 configured AGY accounts are rate-limited or out of quota \(earliest reset in ~40 min\)/);
        return true;});
      assert.ok(Date.now()-started<5000,'all-exhausted pool must fail fast');
      assert.equal(p1.hits.length+p2.hits.length,2,'each exhausted account tried exactly once');
      // A new job while every account is cooling fails with the same clear error after one probe.
      await assert.rejects(native.analyzeJson({prompt:'y',schema,skills:[]}),/AGY quota exhausted/);
      assert.equal(p1.hits.length+p2.hits.length,3);
    }));
  }finally{await p1.close();await p2.close();}
});

test('image quota (native generate_image 429) reroutes at once and cools the account for its reset window',async()=>{
  await withEnv({AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test,http://p3.test',AGY_MCP_MIN_FREE_MB:'1'},async()=>{
    const {exports,native}=await loadService();const providers=[];
    native.runner=()=>({runTask:async(request,opts)=>{providers.push(opts.providerUrl);
      if(opts.providerUrl==='http://p1.test'){
        await request.onEvent({type:'receipt',receipt:{status:'failed',failureCategory:'image-upstream-transient',nativeToolErrors:[{tool:'generate_image',category:'quota-or-rate-limit',message:'failed to generate content: 429 Too Many Requests ... Your quota will reset after 12m.'}]}});
        throw Object.assign(new Error('AGY generate_image failed transiently (quota-or-rate-limit); rerouting'),{category:'image-upstream-transient'});
      }
      return {result:{url:'https://uploads.example.test/uploads/ok.png'}};}});
    const started=Date.now();
    assert.equal(await native.image('scene'),'https://uploads.example.test/uploads/ok.png');
    assert.ok(Date.now()-started<3000);
    assert.equal(providers[0],'http://p1.test');assert.notEqual(providers[1],'http://p1.test');
    assert.deepEqual(exports.agyReadyProviders(),['http://p2.test','http://p3.test']);
    assert.deepEqual(exports.agyReadyProviders(Date.now()+11*60000),['http://p2.test','http://p3.test'],'still cooling after 11 min');
    assert.equal(exports.agyReadyProviders(Date.now()+13*60000).length,3,'account returns after its reset');
  });
});

test('single native account (no proxy pool) keeps bounded backoff retries for rate limits',async()=>{
  await withEnv({},async()=>{
    const {native}=await loadService(),timers=global.setTimeout;let calls=0;
    global.setTimeout=(fn,ms,...args)=>timers(fn,0,...args);
    try{
      native.runner=()=>({runTask:async(request)=>{calls++;await request.onEvent({type:'receipt',receipt:{status:'failed',failureCategory:'process-failed',nativeToolErrors:[]}});throw Object.assign(new Error('AGY process failed (exit 1); provider account rate-limited or out of quota'),{category:'provider-quota'});}});
      await assert.rejects(native.analyzeJson({prompt:'x',schema,skills:[]}),/rate-limited or out of quota/);
      assert.equal(calls,3,'initial attempt + 2 retries, then a clear error');
    }finally{global.setTimeout=timers;}
  });
});
