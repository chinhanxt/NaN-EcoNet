'use strict';
require('./ts-register.cjs');
// Chat "make an image like this sample": the latest message's images reach the image job as frames the
// model must view before native generate_image, with explicit follow-the-reference instructions.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');
const originalLoad=Module._load;
const source=path.resolve(__dirname,'../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts');
const gate=path.resolve(__dirname,'../../packages/agy-mcp-runner/tool-gate.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDUkAAAAASUVORK5CYII=','base64');

async function load() {
  const text=await fs.readFile(source,'utf8');
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  const compiled=new Module(source,module); compiled.filename=source; compiled.paths=Module._nodeModulePaths(path.dirname(source));
  Module._load=(name,parent,isMain)=>{
    if(name==='../video.asset')return {readLocalVideoAsset:async()=>undefined,assertAiVideoAssetUrl:(value)=>{const url=new URL(value);if(url.origin!=='https://uploads.example.test'||!url.pathname.startsWith('/uploads/'))throw new Error('Unsafe upload URL');return url.href;}};
    if(name==='../runtime.path')return {resolveWorkspaceArtifact:()=>'',memAvailableBytes:()=>8e9};
    if(name==='@gitroom/nestjs-libraries/upload/upload.factory')return {UploadFactory:{createStorage:()=>{throw new Error('Unexpected upload');}}};
    return originalLoad(name,parent,isMain);
  };
  try {compiled._compile(code,source);return compiled.exports;}
  finally {Module._load=originalLoad;}
}

test('image job views at most 4 reference images and is told to follow them',async()=>{
  const exports=await load(), native=new exports.AgyMcpService(), originalFetch=global.fetch;
  const urls=[1,2,3,4,5].map((n)=>`https://uploads.example.test/uploads/ref-${n}.png`);
  const fetched=[];let request;
  global.fetch=async(url)=>{fetched.push(url);return new Response(png);};
  native.run=async(job)=>{request=job;for(const frame of job.frames)assert.deepEqual(await fs.readFile(frame.path),png);return {url:'https://uploads.example.test/uploads/out.png'};};
  try {
    assert.equal(await native.image('Poster khai giảng HUTECH',undefined,'auto',[...urls,urls[0]]),'https://uploads.example.test/uploads/out.png');
    assert.equal(exports.MAX_REFERENCE_IMAGES,4);
    assert.deepEqual(fetched,urls.slice(0,4));
    assert.equal(request.kind,'image');
    assert.equal(request.frames.length,4);
    assert.match(request.prompt,/REFERENCE IMAGES \(4/);
    assert.match(request.prompt,/keep their layout and composition, visual style/);
    assert.match(request.prompt,/replace only the subject/);
    assert.match(request.prompt,/aspect ratio of reference image 0/);
    for(const frame of request.frames)await assert.rejects(fs.access(frame.path),{code:'ENOENT'});
    await native.image('Không có ảnh mẫu');
    assert.deepEqual(request.frames,[]);
    assert.doesNotMatch(request.prompt,/REFERENCE IMAGES/);
    assert.match(request.prompt,/Required aspect ratio: 9:16/);
  } finally {global.fetch=originalFetch;}
});

test('latest user message images: media blocks, image parts and URL file parts, deduplicated',async()=>{
  const {AgyMcpService}=await load();
  const a='https://uploads.example.test/uploads/a.png', b='https://uploads.example.test/uploads/b.png';
  const messages=[
    {role:'user',content:`old [--Media--]\nImage: https://uploads.example.test/uploads/old.png\n[--Media--]`},
    {role:'assistant',content:'ok'},
    {role:'user',content:[
      {type:'text',text:`làm ảnh giống vậy [--Media--]\nImage: ${a}\nImage: ${b}\n[--Media--]`},
      {type:'image',image:a},
      {type:'file',mediaType:'image/png',data:new URL(b)},
      {type:'file',mediaType:'application/pdf',data:'https://uploads.example.test/uploads/doc.pdf'},
    ]},
  ];
  assert.deepEqual(AgyMcpService.latestUserImages(messages),[a,b]);
  assert.deepEqual(AgyMcpService.latestUserImages([{role:'user',content:'chỉ chữ'}]),[]);
});

test('tool gate denies generate_image until every reference image was viewed',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'agy-ref-gate-')), trace=path.join(root,'trace'), policyFile=path.join(root,'policy.json');
  const framePaths=[path.join(root,'frame-0.png'),path.join(root,'frame-1.png')];
  await fs.writeFile(policyFile,JSON.stringify({kind:'image',frameCount:2,framePaths,mcpTools:['get_job_evidence','read_frame','publish_image'],readRoots:[root],trace}));
  const call=()=>JSON.parse(execFileSync(process.execPath,[gate,policyFile],{input:JSON.stringify({conversationId:'p',stepIdx:9,toolCall:{name:'generate_image',args:{Prompt:'x'}}}),encoding:'utf8',timeout:5000}));
  try {
    const denied=call();
    assert.equal(denied.decision,'deny');
    assert.match(denied.reason,/Reference images first/);
    const lines=[0,1].flatMap((index)=>[{phase:'pre',tool:'view_file',frameFileIndex:index,conversationId:'p',stepIdx:index+1,allowed:true},
      {phase:'post',tool:'view_file',frameFileIndex:index,conversationId:'p',stepIdx:index+1,allowed:true,success:true}]);
    await fs.writeFile(trace,lines.map((line)=>JSON.stringify(line)).join('\n')+'\n');
    assert.equal(call().decision,'allow');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
