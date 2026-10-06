'use strict';
require('./ts-register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const originalLoad=Module._load;
let localFixture;
const source=path.resolve(__dirname,'../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDUkAAAAASUVORK5CYII=','base64');
const {selectModel}=require('../../packages/agy-mcp-runner/index.cjs');
let serviceExports;
async function service() {
  const text=await fs.readFile(source,'utf8');
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  const compiled=new Module(source,module); compiled.filename=source; compiled.paths=Module._nodeModulePaths(path.dirname(source));
  Module._load=(name,parent,isMain)=>{
    if(name==='../video.asset')return {readLocalVideoAsset:async()=>localFixture,assertAiVideoAssetUrl:(value)=>{const url=new URL(value);if(url.origin!=='https://uploads.example.test' || !url.pathname.startsWith('/uploads/') || url.username || url.password || url.search || url.hash)throw new Error('Unsafe upload URL');return url.href;}};
    if(name==='../runtime.path')return {resolveWorkspaceArtifact:()=>'',memAvailableBytes:()=>Number(/^MemAvailable:\s+(\d+)\s+kB/m.exec(require('node:fs').readFileSync('/proc/meminfo','utf8'))?.[1]||0)*1024};
    if(name==='@gitroom/nestjs-libraries/upload/upload.factory')return {UploadFactory:{createStorage:()=>{throw new Error('Unexpected upload');}}};
    return originalLoad(name,parent,isMain);
  };
  try {compiled._compile(code,source);serviceExports=compiled.exports;return new compiled.exports.AgyMcpService();}
  finally {Module._load=originalLoad;}
}

test('captions use the caption role with copywriting skills only, with or without images',async()=>{
  const native=await service(), originalFetch=global.fetch, calls=[];
  global.fetch=async()=>new Response(png);
  native.run=async(request)=>{calls.push({role:request.role,kind:request.kind,skills:request.skills,frames:request.frames.length});
    assert.match(request.prompt,/FORMAT \(Vietnamese business social post\)/);assert.equal(request.schema.properties.content.maxLength,3000);
    return {content:'🌱 HUTECH CHUNG TAY! 🌍\n\nMở đầu.\n✅ Ý một\n#HocTapXanh'};};
  try {
    const styled='🌱 𝗛𝗨𝗧𝗘𝗖𝗛 𝗖𝗛𝗨𝗡𝗚 𝗧𝗔𝗬! 🌍\n\nMở đầu.\n✅ Ý một\n#HocTapXanh';
    assert.equal(await native.caption('Viết bài giới thiệu quán'),styled);
    assert.equal(await native.caption('Viết bài từ ảnh',['https://uploads.example.test/uploads/a.png']),styled);
  } finally {global.fetch=originalFetch;}
  const skills=['copywriting','viral-copywriting-master'];
  assert.deepEqual(calls,[{role:'caption-writer',kind:'content',skills,frames:0},{role:'caption-writer',kind:'content',skills,frames:1}]);
  assert.deepEqual(serviceExports.CAPTION_SKILLS,skills);
});

test('caption title is bolded in code: only unaccented letters/digits, Vietnamese accented letters and body untouched',async()=>{
  await service();
  const {boldText,boldTitle}=serviceExports;
  assert.equal(boldText('HUTECH CHUNG TAY'),'𝗛𝗨𝗧𝗘𝗖𝗛 𝗖𝗛𝗨𝗡𝗚 𝗧𝗔𝗬');
  assert.equal(boldText('MỘT 2026'),'𝗠Ộ𝗧 𝟮𝟬𝟮𝟲');
  assert.equal(boldText('HÀNH'),'𝗛À𝗡𝗛');
  assert.equal(boldText('ĐƯỜNG'),'ĐƯỜ𝗡𝗚');
  assert.equal(boldText('MO\u0323\u0302T'),'𝗠Ộ𝗧');  // decomposed input is composed first, accented letter kept
  const post='🌱 HÀNH ĐỘNG XANH 🌍\n\nCùng HUTECH hành động.\n✅ Ý một\n#HocTapXanh #HUTECH';
  const out=boldTitle(post).split('\n');
  assert.equal(out[0],'🌱 '+boldText('HÀNH ĐỘNG XANH')+' 🌍');
  assert.deepEqual(out.slice(1),post.split('\n').slice(1));
  assert.equal(boldTitle('Viết ngắn một câu thôi.'),'Viết ngắn một câu thôi.');
  assert.equal(boldTitle('#HUTECH #XANH'),'#HUTECH #XANH');
});

test('chat loads the caption skills only for a post-writing request',async()=>{
  const native=await service(), seen=[];
  native.run=async(request)=>{seen.push(request.skills);return {content:'ok'};};
  await native.chat({messages:[{role:'user',content:'Viết bài đăng Facebook về khuyến mãi tháng 10'}],tools:[]});
  await native.chat({messages:[{role:'user',content:'Lịch đăng tuần này có gì?'}],tools:[]});
  assert.deepEqual(seen,[['copywriting','viral-copywriting-master'],[]]);
});

test('all attached images are staged in order and removed after native content returns',async()=>{
  const native=await service(), originalFetch=global.fetch;
  const urls=['https://uploads.example.test/uploads/a.png','https://uploads.example.test/uploads/b.png'];
  const seen=[];let frames;
  global.fetch=async(url,options)=>{seen.push(url);assert.equal(options.redirect,'error');return new Response(png);};
  native.run=async(request)=>{frames=request.frames;assert.equal(frames.length,2);assert.equal(request.role,'content-writer');for(const frame of frames)assert.deepEqual(await fs.readFile(frame.path),png);return {content:'Both images inspected'};};
  try {
    assert.equal(await native.contentFromImages('Describe both images',urls),'Both images inspected');
    assert.deepEqual(seen,urls);
    for(const frame of frames)await assert.rejects(fs.access(frame.path),{code:'ENOENT'});
  } finally {global.fetch=originalFetch;}
});

test('native seed evidence accepts staged local bytes without a frontend fetch',async()=>{
  const native=await service(),originalFetch=global.fetch;localFixture=png;
  native.run=async(request)=>{assert.equal(request.seedImage.data,png.toString('base64'));return {content:'Local seed inspected'};};
  global.fetch=async()=>{throw new Error('Frontend HTTP must not be needed');};
  try{assert.equal(await native.content('Describe seed','https://uploads.example.test/uploads/seed.png'),'Local seed inspected');}
  finally{localFixture=undefined;global.fetch=originalFetch;}
});

test('image count, byte cap, unsupported bytes and cancellation reject without native execution',async()=>{
  const native=await service(), originalFetch=global.fetch;
  native.run=async()=>{throw new Error('Native execution must not occur');};
  try {
    global.fetch=async()=>{throw new Error('Fetch must not occur');};
    await assert.rejects(native.contentFromImages('Prompt',Array(13).fill('https://uploads.example.test/uploads/x.png')),/at most 12/);
    await assert.rejects(native.contentFromImages('Prompt',['https://unconfigured.example/image.png']),/Unsafe/);
    global.fetch=async()=>new Response(png,{headers:{'content-length':'30000001'}});
    await assert.rejects(native.contentFromImages('Prompt',['https://uploads.example.test/uploads/x.png']),/size limit/);
    global.fetch=async()=>new Response('<html>untrusted</html>');
    await assert.rejects(native.contentFromImages('Prompt',['https://uploads.example.test/uploads/x.png']),/Unsupported/);
    const abort=new AbortController();abort.abort();
    await assert.rejects(native.contentFromImages('Prompt',['https://uploads.example.test/uploads/x.png','https://uploads.example.test/uploads/y.png'],abort.signal),{name:'AbortError'});
  } finally {global.fetch=originalFetch;}
});

test('all generic ratios remain native prompt instructions and invalid ratios fail',async()=>{
  const native=await service();const prompts=[];
  native.run=async(request)=>{prompts.push(request.prompt);return {url:'https://uploads.example.test/uploads/result.png'};};
  for(const ratio of ['auto','9:16','16:9','1:1','3:4','4:3','2:3','3:2','21:9'])assert.ok(await native.image('A product',undefined,ratio));
  assert.ok(prompts[0].includes('Choose the aspect ratio'));
  assert.ok(prompts[8].includes('21:9'));
  await assert.rejects(native.image('A product',undefined,'unsupported'),/Unsupported/);
});

test('runner model tiers preserve account fallback and prefer nonblank role overrides',()=>{
  for(const role of ['asr-repair','visual-editor','render-reviewer','content-editor','image','chat']) {
    const request={kind:['image','chat'].includes(role)?role:'analysis',role:['image','chat'].includes(role)?'descriptive prompt role':role};
    const key=`AGY_MCP_MODEL_${role.toUpperCase().replace(/-/g,'_')}`;
    assert.equal(selectModel(request,{}),undefined);
    assert.equal(selectModel(request,{AGY_MCP_MODEL:'global'}),'global');
    assert.equal(selectModel(request,{AGY_MCP_MODEL:'global',[key]:' medium '}),'medium');
    assert.equal(selectModel(request,{AGY_MCP_MODEL:' global ',[key]:'  '}),'global');
  }
  assert.equal(selectModel({kind:'analysis',role:'unconfigured'},{AGY_MCP_MODEL:'global',AGY_MCP_MODEL_ASR_REPAIR:'medium'}),'global');
});

test('service passes per-role models to runner without changing global model state',async()=>{
  const saved={...process.env};
  try {
    for(const key of Object.keys(process.env))if(key.startsWith('AGY_MCP_MODEL'))delete process.env[key];
    const native=await service(),seen=[];
    native.runner=()=>({runTask:async(request,options)=>{seen.push({request,model:options.model});return {result:{ok:true,url:'u',content:'ok'}};}});
    const analysis=(role)=>native.analyzeJson({role,prompt:'model routing fixture',schema:{type:'object'},skills:[]});
    await analysis('asr-repair');assert.equal(seen.at(-1).model,undefined);
    process.env.AGY_MCP_MODEL='global';
    for(const role of ['asr-repair','visual-editor','render-reviewer','content-editor','image','chat']) {
      process.env[`AGY_MCP_MODEL_${role.toUpperCase().replace(/-/g,'_')}`]=` ${role}-medium `;
      if(role==='image')await native.image('scene');
      else if(role==='chat')await native.chat({messages:[{role:'user',content:'hello'}],tools:[]});
      else await analysis(role);
      assert.equal(seen.at(-1).model,`${role}-medium`);
      assert.equal(seen.at(-1).model,selectModel(seen.at(-1).request));
      assert.equal(process.env.AGY_MCP_MODEL,'global');
    }
    process.env.AGY_MCP_MODEL_ASR_REPAIR=' ';
    await analysis('asr-repair');assert.equal(seen.at(-1).model,'global');
    await analysis('unknown-role');assert.equal(seen.at(-1).model,'global');
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('scoring uses scoped content skill and final render review delegates three native specialists',async()=>{
  const native=await service(),seen=[];
  native.run=async(request)=>{seen.push(request);return {decision:'ok'};};
  const request={prompt:'Review this edit',schema:{type:'object',properties:{decision:{type:'string'}},required:['decision']},frames:[]};
  await native.analyzeJson({...request,role:'content-editor'});
  await native.analyzeJson({...request,role:'visual-editor'});
  await native.analyzeJson({...request,role:'render-reviewer'});
  await native.analyzeJson({...request,role:'render-reviewer',nativeReview:true});
  await native.analyzeJson({...request,role:'asr-repair'});
  assert.deepEqual(seen.map(item=>({role:item.role,nativeReview:item.nativeReview,skills:item.skills})),[
    {role:'content-editor',nativeReview:false,skills:['copywriting','viral-copywriting-master','video-retention-scriptwriting']},
    {role:'visual-editor',nativeReview:false,skills:['ai-product-photography']},
    {role:'render-reviewer',nativeReview:false,skills:['ai-social-media-content']},
    {role:'render-reviewer',nativeReview:true,skills:['ai-social-media-content']},
    {role:'asr-repair',nativeReview:false,skills:[]},
  ]);
});

test('AGY jobs share one process-wide slot and queued jobs start in order',async()=>{
  const native=await service(),started=[],finish=[];
  native.runner=()=>({runTask:(request)=>{started.push(request.prompt);return new Promise(resolve=>finish.push(()=>resolve({result:{ok:request.prompt}})));}});
  const request=(prompt)=>native.analyzeJson({prompt,schema:{type:'object'},onAttempt:()=>{}});
  const first=request('a'),second=request('b'),third=request('c');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(started,['a']);
  finish.shift()();assert.deepEqual(await first,{ok:'a'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(started,['a','b']);
  finish.shift()();await second;await new Promise(resolve=>setImmediate(resolve));
  finish.shift()();assert.deepEqual(await third,{ok:'c'});
  assert.deepEqual(started,['a','b','c']);
});

test('per-kind AGY limits run images in parallel and pin jobs to the least busy provider',async()=>{
  const saved={...process.env};
  Object.assign(process.env,{AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test',AGY_MCP_MAX_CONCURRENCY:'4',AGY_MCP_IMAGE_CONCURRENCY:'3',AGY_MCP_ANALYSIS_CONCURRENCY:'1',AGY_MCP_MIN_FREE_MB:'1'});
  try {
    const native=await service(),started=[],finish=[];
    native.runner=()=>({runTask:(request,options)=>{started.push([request.kind,options.providerUrl]);return new Promise(resolve=>finish.push(()=>resolve({result:{url:'u',ok:true}})));}});
    const images=[1,2,3,4].map(()=>native.image('scene'));
    const analyses=[1,2].map(()=>native.analyzeJson({prompt:'x',schema:{type:'object'}}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(started.map(([kind])=>kind),['image','image','image','analysis']);
    assert.deepEqual(started.map(([,url])=>url),['http://p1.test','http://p2.test','http://p1.test','http://p2.test']);
    while(finish.length){finish.shift()();await new Promise(resolve=>setImmediate(resolve));}
    await Promise.all([...images,...analyses]);
    assert.equal(started.length,6);
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('serialized jobs spread over equally idle accounts (least recently used), skipping cooled-down ones',async()=>{
  const saved={...process.env};
  // One job at a time (as when the RAM gate admits only the first job): every grant sees all accounts idle.
  Object.assign(process.env,{AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test,http://p3.test',AGY_MCP_MAX_CONCURRENCY:'1',AGY_MCP_IMAGE_CONCURRENCY:'1',AGY_MCP_MIN_FREE_MB:'1'});
  try {
    const native=await service(),used=[];
    native.runner=()=>({runTask:async(request,options)=>{used.push(options.providerUrl);
      if(used.length===4){await request.onEvent({type:'receipt',receipt:{status:'failed',nativeToolErrors:[{category:'quota-or-rate-limit',message:'reset after 30m'}]}});throw Object.assign(new Error('quota'),{category:'provider-quota'});}
      return {result:{url:'u'}};}});
    for(let i=0;i<3;i++)await native.image('scene');
    assert.deepEqual(used,['http://p1.test','http://p2.test','http://p3.test'],'round robin instead of always the first account');
    // p1 hits quota and cools down; the reroute and later jobs rotate over p2/p3 only.
    await native.image('scene');
    for(let i=0;i<3;i++)await native.image('scene');
    assert.equal(used[3],'http://p1.test');
    assert.deepEqual(used.slice(4),['http://p2.test','http://p3.test','http://p2.test','http://p3.test']);
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('imageBatch fans out one job per image in parallel with distinct variants; a failed image does not fail the batch',async()=>{
  const saved={...process.env};
  Object.assign(process.env,{AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test,http://p3.test',AGY_MCP_MAX_CONCURRENCY:'6',AGY_MCP_IMAGE_CONCURRENCY:'6',AGY_MCP_MIN_FREE_MB:'1',AGY_MCP_IMAGE_HEDGE_MS:'0'});
  try {
    const native=await service(),prompts=[],providers=[],ready=[];let inFlight=0,peak=0;
    native.runner=()=>({runTask:async(request,options)=>{prompts.push(request.prompt);providers.push(options.providerUrl);inFlight++;peak=Math.max(peak,inFlight);
      await new Promise(resolve=>setTimeout(resolve,30));inFlight--;
      if(request.prompt.includes('Variation 3'))throw new Error('upstream refused');
      return {result:{url:`https://uploads.example.test/uploads/${prompts.length}.png`}};}});
    const result=await native.imageBatch('a red bicycle',3,undefined,'1:1',(index,url)=>{ready.push([index,url]);});
    assert.equal(prompts.length,3);
    assert.equal(peak,3,'all images run at the same time');
    assert.equal(new Set(providers).size,3,'spread over accounts');
    assert.ok(prompts[0].startsWith('a red bicycle\nRequired aspect ratio: 1:1.'),'first image keeps the plain prompt');
    assert.ok(prompts.some(p=>p.includes('Variation 2'))&&prompts.some(p=>p.includes('Variation 3')));
    assert.equal(result.urls.filter(Boolean).length,2);
    assert.deepEqual(result.errors.map(e=>e.index),[2]);
    assert.equal(ready.length,2,'each finished image is reported as soon as it is ready');
    // Capped per request (default 6); all failed -> rejects.
    prompts.length=0;
    await native.imageBatch('x',10,undefined,'1:1');
    assert.equal(prompts.length,6);
    native.runner=()=>({runTask:async()=>{throw new Error('down');}});
    await assert.rejects(native.imageBatch('x',2,undefined,'1:1'),/down/);
    assert.equal(serviceExports.agyImageVariation(0,4),'');
    assert.equal(serviceExports.agyImageVariation(1,1),'');
    assert.equal(serviceExports.agyMaxImagesPerRequest({AGY_MCP_MAX_IMAGES_PER_REQUEST:'20'}),12);
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('a prompt that stalls on two accounts is refused at once (no third attempt, no hedge after a reroute, no cooldown)',async()=>{
  const saved={...process.env};
  Object.assign(process.env,{AGY_MCP_PROVIDER_URLS:'http://p1.test,http://p2.test,http://p3.test',AGY_MCP_MIN_FREE_MB:'1',AGY_MCP_RETRIES:'2'});
  try {
    const native=await service(),calls=[];
    native.runner=()=>({runTask:async(_request,options)=>{calls.push(options);
      throw Object.assign(new Error('AGY generate_image stalled 35s; rerouting'),{category:'image-stalled'});}});
    await assert.rejects(native.image('Marvel heroes poster'),(error)=>error.category==='image-refused'&&/AI không vẽ được nội dung này/.test(error.message)&&error.getStatus?.()===422);
    assert.equal(calls.length,2,'stops after the second account stalls');
    assert.notEqual(calls[0].providerUrl,calls[1].providerUrl);
    assert.equal(typeof calls[0].onImageStall,'function','first attempt may hedge');
    assert.equal(calls[1].onImageStall,undefined,'a rerouted attempt never hedges');
    assert.deepEqual(serviceExports.agyReadyProviders(),['http://p1.test','http://p2.test','http://p3.test'],'stalls do not cool accounts down');
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('agySettledLimit keeps at most N tasks in flight and preserves order', async()=>{
  await service();
  let active=0,peak=0;
  const task=(value,fail)=>async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,10));active--;if(fail)throw new Error(String(value));return value;};
  const results=await serviceExports.agySettledLimit(2,[task(1),task(2,true),task(3),task(4)]);
  assert.equal(peak,2);
  assert.deepEqual(results.map(r=>r.status==='fulfilled'?r.value:`x${r.reason.message}`),[1,'x2',3,4]);
  assert.equal(serviceExports.agyRequestImageConcurrency({}),3);
});

test('only transient AGY failures are retried with backoff',async()=>{
  const native=await service(),timers=global.setTimeout;
  global.setTimeout=(fn,ms,...args)=>timers(fn,0,...args);
  try {
    const fail=(category,receipt)=>{const error=new Error('AGY process failed');if(category)error.category=category;return {error,receipt:{status:'failed',failureCategory:category||'runtime-failed',nativeToolErrors:[],...receipt}};};
    const attempt=async(failures)=>{let calls=0,attempts=0;
      native.runner=()=>({runTask:async(request)=>{const next=failures[calls++];if(!next)return {result:{ok:true}};await request.onEvent({type:'receipt',receipt:next.receipt});throw next.error;}});
      const outcome=await native.analyzeJson({prompt:'x',schema:{type:'object'},onAttempt:()=>attempts++}).then(()=>'ok',()=>'failed');
      return {outcome,calls,attempts};};
    assert.deepEqual(await attempt([fail('provider-unreachable')]),{outcome:'ok',calls:2,attempts:2});
    assert.deepEqual(await attempt([fail(undefined,{failureCategory:'cancelled-or-deadline'}),fail(undefined,{nativeToolErrors:[{category:'quota-or-rate-limit'}]})]),{outcome:'ok',calls:3,attempts:3});
    assert.deepEqual(await attempt([fail(undefined,{nativeToolErrors:[{category:'native-tool-failed',message:'upstream 503 Service Unavailable'}]})]),{outcome:'ok',calls:2,attempts:2});
    assert.deepEqual(await attempt([fail('provider-unreachable'),fail('provider-unreachable'),fail('provider-unreachable')]),{outcome:'failed',calls:3,attempts:3});
    assert.deepEqual(await attempt([fail('not-logged-in')]),{outcome:'failed',calls:1,attempts:1});
    assert.deepEqual(await attempt([fail(undefined,{nativeToolErrors:[{category:'authentication'},{category:'quota-or-rate-limit'}]})]),{outcome:'failed',calls:1,attempts:1});
    assert.deepEqual(await attempt([fail(undefined,{nativeToolErrors:[{category:'invalid-tool-input'}]})]),{outcome:'failed',calls:1,attempts:1});
    assert.deepEqual(await attempt([fail(undefined)]),{outcome:'failed',calls:1,attempts:1});
  } finally {global.setTimeout=timers;}
});

test('schema-only classification can omit writing skills without enabling native delegation',async()=>{
  const native=await service();let observed;
  native.run=async(request)=>{observed=request;return {category:'Environment'};};
  await native.analyzeJson({prompt:'Classify the provided post only',role:'content-editor',skills:[],schema:{type:'object'}});
  assert.deepEqual(observed.skills,[]);
  assert.equal(observed.nativeReview,false);
});

test('Nest shutdown aborts native jobs and waits for owned profile cleanup before returning',async()=>{
  const native=await service();
  let taskSignal, finishCleanup;
  native.runner=()=>({runTask:(_request,{signal})=>{
    taskSignal=signal;
    return new Promise((_resolve,reject)=>{
      signal.addEventListener('abort',()=>{finishCleanup=()=>reject(signal.reason);},{once:true});
    });
  }});
  const pending=native.analyzeJson({prompt:'Shutdown fixture',schema:{type:'object',properties:{}}});
  const rejected=assert.rejects(pending,/shutting down/);
  let destroyed=false;
  const destroy=native.onModuleDestroy().then(()=>{destroyed=true;});
  assert.equal(taskSignal.aborted,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(destroyed,false,'Shutdown returned before native cleanup completed');
  await assert.rejects(native.analyzeJson({prompt:'New task',schema:{type:'object',properties:{}}}),/shutting down/);
  finishCleanup();
  await rejected;await destroy;
  assert.equal(destroyed,true);
});

test('chat and tool-exposing jobs are never replayed after a transient failure',async()=>{
  const native=await service(),timers=global.setTimeout;
  global.setTimeout=(fn,ms,...args)=>timers(fn,0,...args);
  try {
    let calls=0;
    native.runner=()=>({runTask:async()=>{calls++;const error=new Error('AGY process failed');error.category='provider-unreachable';throw error;}});
    const tool={name:'integrationSchedulePostTool',description:'schedule',inputSchema:{type:'object'},execute:async()=>({ok:true})};
    await assert.rejects(native.chat({messages:[{role:'user',content:'post it'}],tools:[tool]}));
    assert.equal(calls,1);
    calls=0;
    await assert.rejects(native.run({kind:'analysis',prompt:'x',schema:{type:'object'},tools:[tool]}));
    assert.equal(calls,1);
    calls=0;
    await assert.rejects(native.analyzeJson({prompt:'x',schema:{type:'object'}}));
    assert.equal(calls,3,'pure analysis keeps transient retries');
  } finally {global.setTimeout=timers;}
});

test('RAM admission reserves memory for granted jobs that have not allocated yet',async(t)=>{
  const available=Number(/^MemAvailable:\s+(\d+)\s+kB/m.exec(require('node:fs').readFileSync('/proc/meminfo','utf8'))?.[1]||0)/1024;
  if(available<6000){t.skip('needs >6 GiB MemAvailable');return;}
  const saved={...process.env};
  // Headroom of 5000 MiB with 2000 MiB per job: one extra job fits, a second must wait.
  Object.assign(process.env,{AGY_MCP_MAX_CONCURRENCY:'4',AGY_MCP_IMAGE_CONCURRENCY:'4',AGY_MCP_JOB_RSS_MB:'2000',AGY_MCP_MIN_FREE_MB:String(Math.floor(available-5000))});
  delete process.env.AGY_MCP_PROVIDER_URLS;delete process.env.AGY_MCP_PROVIDER_URL;delete process.env.CLOUD_CODE_URL;
  try {
    const native=await service(),started=[],finish=[];
    native.runner=()=>({runTask:(request)=>{started.push(request.kind);return new Promise(resolve=>finish.push(()=>resolve({result:{url:'u'}})));}});
    const jobs=[1,2,3].map(()=>native.image('scene'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(started.length,2,'third job admitted without reserving memory for granted jobs');
    while(finish.length){finish.shift()();await new Promise(resolve=>setImmediate(resolve));}
    await Promise.all(jobs);
    assert.equal(started.length,3);
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('content repair attempts reuse the recently loaded seed image',async()=>{
  const native=await service();let loads=0;
  native.loadImage=async()=>{loads++;return {data:png,mimeType:'image/png'};};
  native.run=async(request)=>{assert.deepEqual(request.seedImage,{data:png.toString('base64'),mimeType:'image/png'});return {content:'ok'};};
  const seed='https://uploads.example.test/uploads/seed.png';
  assert.equal(await native.content('first',seed),'ok');assert.equal(await native.content('repair',seed),'ok');
  assert.equal(loads,1);
});

test('provider pool snapshot is written atomically without credentials and reports cooldowns',async()=>{
  const dir=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'agy-pool-state-'));
  const saved={urls:process.env.AGY_MCP_PROVIDER_URLS,file:process.env.AGY_POOL_STATE_FILE};
  process.env.AGY_MCP_PROVIDER_URLS='http://user:secret@127.0.0.1:8911/?token=abc,http://127.0.0.1:8912';
  process.env.AGY_POOL_STATE_FILE=path.join(dir,'state.json');
  try {
    await service();
    const {agyMarkProviderLimited,agyPoolSnapshot,agyWritePoolState,agyPoolStateFile}=serviceExports;
    assert.match(agyPoolStateFile({},'/x/apps/orchestrator/dist/main.js'),/agy-pool-state-orchestrator\.json$/);
    assert.equal(agyPoolStateFile({},'/usr/bin/node-test'),undefined);
    agyMarkProviderLimited('http://user:secret@127.0.0.1:8911/?token=abc',60000,'quota-or-rate-limit');
    const snapshot=agyPoolSnapshot();
    assert.equal(snapshot.providers.length,2);
    assert.equal(snapshot.providers[0].active,false);
    assert.equal(snapshot.providers[0].reason,'quota-or-rate-limit');
    assert.ok(Date.parse(snapshot.providers[0].cooldownUntil)>Date.now());
    assert.deepEqual([snapshot.providers[1].active,snapshot.providers[1].inFlight],[true,0]);
    agyWritePoolState(0);
    let text;
    for(let i=0;i<50&&!text;i++){await new Promise(r=>setTimeout(r,20));text=await fs.readFile(process.env.AGY_POOL_STATE_FILE,'utf8').catch(()=>undefined);}
    assert.ok(text,'snapshot file was not written');
    assert.doesNotMatch(text,/secret|token=abc|user:/);
    assert.equal(JSON.parse(text).providers[0].url,'http://127.0.0.1:8911/');
    assert.deepEqual((await fs.readdir(dir)).filter(name=>name.endsWith('.tmp')),[]);
  } finally {
    for(const [key,value] of [['AGY_MCP_PROVIDER_URLS',saved.urls],['AGY_POOL_STATE_FILE',saved.file]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    await fs.rm(dir,{recursive:true,force:true});
  }
});
