'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {endpoint,resultValue,uploadUrl,uploadSourceFile}=require('../../packages/openshorts-engine/bin/nan-video.cjs');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {captionFlag,withCaptionFlags}=require('../../packages/openshorts-engine/bin/nan-video.cjs');
test('legacy subtitle flags map to canonical MCP caption JSON with bounded values',()=>{
 assert.deepEqual(captionFlag('--font-size','24'),['fontSize',24]);
 assert.deepEqual(captionFlag('--font-name','Noto Serif Bold'),['fontName','Noto Serif Bold']);
 assert.deepEqual(captionFlag('--highlight-color','#00FFFF'),['highlightColor','#00FFFF']);
 const input={mediaId:'owned',captions:{style:'classic',fontSize:16}};
 assert.deepEqual(withCaptionFlags(input,{fontSize:24,uppercase:true}),
  {mediaId:'owned',captions:{enabled:true,style:'classic',fontSize:24,uppercase:true}});
 assert.equal(input.captions.fontSize,16);
 for(const [flag,value] of [['--font-size','NaN'],['--border-width','11'],['--bg-opacity','2'],
  ['--font-color','red'],['--font-name',"Anton',Outline=0"],['--position','left'],['--style','--watch']])
  assert.throws(()=>captionFlag(flag,value));
 assert.throws(()=>captionFlag('--font-size',undefined));
});
test('video CLI keeps credentials out of endpoint URLs and rejects remote plaintext',()=>{
 for(const url of ['http://remote.example/mcp','https://user:secret@remote.example/mcp','https://remote.example/mcp?token=secret'])assert.throws(()=>endpoint(url),/HTTPS|credential/);
 assert.equal(endpoint('http://127.0.0.1:3000/mcp').pathname,'/mcp');assert.equal(endpoint('https://remote.example/api/mcp').pathname,'/api/mcp');
});
test('video CLI reports terminal job errors without treating them as an uncertain dispatch',()=>{
 const terminal={jobId:'fixture',status:'failed',error:'Lỗi tạo ảnh'};
 assert.deepEqual(resultValue({content:[{type:'text',text:JSON.stringify(terminal)}]}),terminal);
 assert.throws(()=>resultValue({isError:true,content:[]}),/execution failed/);
 assert.throws(()=>resultValue({content:[{type:'text',text:JSON.stringify({error:'Invalid source'})}]}),/Invalid source/);
});
test('video CLI streams local MP4 through the protected same-prefix upload route',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nan-video-cli-'));
 const source=path.join(dir,'short.mp4');await fs.writeFile(source,Buffer.from('small-mp4-fixture'));
 try{
  const seen=[];
  const uploaded=await uploadSourceFile(source,endpoint('https://example.test/api/mcp'),'private-token',undefined,async(url,options)=>{
   assert.equal(url.href,'https://example.test/api/public/v1/source-video-jobs/upload');
   assert.equal(options.headers.Authorization,'Bearer private-token');
   assert.equal(options.duplex,'half');assert.equal(options.redirect,'error');
   for await(const chunk of options.body)seen.push(Buffer.from(chunk));
   assert.equal(Number(options.headers['Content-Length']),Buffer.concat(seen).length);
   return {ok:true,json:async()=>({id:'owned-media'})};
  });
  assert.deepEqual(uploaded,{mediaId:'owned-media',bytes:17});
  assert.match(Buffer.concat(seen).toString(),/small-mp4-fixture/);
  assert.throws(()=>uploadUrl(endpoint('https://example.test/not-mcp')),/end in \/mcp/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('video CLI rejects a directory before issuing an upload',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nan-video-cli-'));
 try{let called=false;await assert.rejects(()=>uploadSourceFile(dir,endpoint('http://127.0.0.1:3000/mcp'),'token',undefined,async()=>{called=true;}),/regular file/);assert.equal(called,false);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
