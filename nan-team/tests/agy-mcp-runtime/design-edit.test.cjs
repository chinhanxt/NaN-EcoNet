'use strict';
require('./ts-register.cjs');
// "AI thiết kế" (POST /media/ai-design-edit): sanitizer of the model's Polotno operations and the
// AGY job that views the page screenshot as frame 0.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const originalLoad=Module._load;
const dir=path.resolve(__dirname,'../../libraries/nestjs-libraries/src/videos/agy-mcp');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDUkAAAAASUVORK5CYII=','base64');

async function load(file) {
  const source=path.join(dir,file);
  const code=ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  const compiled=new Module(source,module); compiled.filename=source; compiled.paths=Module._nodeModulePaths(dir);
  Module._load=(name,parent,isMain)=>{
    if(name==='../video.asset')return {readLocalVideoAsset:async()=>undefined,assertAiVideoAssetUrl:(value)=>{const url=new URL(value);if(url.origin!=='https://uploads.example.test')throw new Error('Unsafe upload URL');return url.href;}};
    if(name==='../runtime.path')return {resolveWorkspaceArtifact:()=>'',memAvailableBytes:()=>8e9};
    if(name==='@gitroom/nestjs-libraries/upload/upload.factory')return {UploadFactory:{createStorage:()=>{throw new Error('Unexpected upload');}}};
    if(name==='./design.edit')return requireTs('design.edit.ts');
    if(name==='./design-edit.cache')return requireTs('design-edit.cache.ts');
    return originalLoad(name,parent,isMain);
  };
  try {compiled._compile(code,source);return compiled.exports;}
  finally {Module._load=originalLoad;}
}
const cache={};
function requireTs(file){
  if(cache[file])return cache[file];
  const source=path.join(dir,file);
  const code=ts.transpileModule(require('node:fs').readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const compiled=new Module(source,module); compiled.filename=source; compiled._compile(code,source);
  return cache[file]=compiled.exports;
}

const page={width:1080,height:1080,background:'#ffffff'};
const elements=[
  {id:'title',type:'text',x:40,y:40,width:600,height:120,zIndex:1,text:'Khai giang',fontSize:60,fill:'#111111'},
  {id:'photo',type:'image',x:0,y:300,width:1080,height:600,zIndex:0,src:'https://uploads.example.test/uploads/p.png'},
];

test('sanitizer keeps valid operations, clamps into the page and drops the rest',()=>{
  const {sanitizeDesignEdit,DESIGN_EDIT_MAX_OPS}=requireTs('design.edit.ts');
  const plan=sanitizeDesignEdit({variants:[{summary:'Căn lề và tăng tương phản.',operations:[
    {op:'update',id:'title',props:{x:900,fontSize:900,fill:'red',text:'Khai giảng',align:'middle',opacity:3}},
    {op:'update',id:'ghost',props:{x:1}},
    {op:'add',type:'text',props:{x:-50,y:1000,width:400,height:200,text:'Đăng ký ngay',fill:'#FF0000'}},
    {op:'add',type:'text',props:{x:0,y:0,width:100,height:50}},
    {op:'add',type:'figure',props:{x:10,y:10,width:50,height:50,cornerRadius:999}},
    {op:'reorder',id:'photo',to:'bottom'},{op:'reorder',id:'photo',to:'sideways'},
    {op:'background',value:'#0a0a0a'},{op:'background',value:'navy'},
    {op:'generateImage',id:'photo',prompt:'Sinh viên trong khuôn viên'},
    {op:'generateImage',id:'title',prompt:'not an image'},
    {op:'generateImage',prompt:'Logo trường',props:{x:2000,y:0,width:200,height:200}},
    {op:'remove',id:'photo'},{op:'update',id:'photo',props:{x:5}},
    {op:'explode',id:'title'},
  ]}]},{instruction:'Căn lề',page,elements});
  assert.equal(plan.summary,'Căn lề và tăng tương phản.');
  assert.deepEqual(plan.operations,[
    {op:'update',id:'title',props:{x:65,width:950,fontSize:316,text:'Khai giảng',opacity:1}},  // headline snapped to the 6% margins and type scale
    {op:'add',type:'text',props:{x:65,y:880,width:400,height:200,text:'Đăng ký ngay',fill:'#F5C451'}},  // 6% margin; red snapped to the neutral accent
    {op:'add',type:'figure',props:{x:10,y:10,width:50,height:50,cornerRadius:25,subType:'rect'}},
    {op:'reorder',id:'photo',to:'bottom'},
    {op:'background',value:'#0a0a0a'},
    {op:'generateImage',id:'photo',prompt:'Sinh viên trong khuôn viên'},
    {op:'generateImage',prompt:'Logo trường',props:{x:880,y:0,width:200,height:200}},
    {op:'remove',id:'photo'},
  ]);
  const many=sanitizeDesignEdit({variants:[{summary:'x',operations:Array.from({length:90},()=>({op:'background',value:'#ffffff'}))}]},{instruction:'Căn lề',page,elements});
  assert.equal(many.operations.length,DESIGN_EDIT_MAX_OPS);
  const two=sanitizeDesignEdit({variants:[{summary:'A',operations:[]},{summary:'B',operations:[]},{summary:'C',operations:[]}]},{instruction:'Căn lề',page,elements,variants:2});
  assert.deepEqual(two.variants.map((v)=>v.summary),['A','B']);
  assert.equal(two.summary,'A');
  assert.equal(sanitizeDesignEdit(null,{page,elements}).summary,'Đã đề xuất chỉnh sửa thiết kế.');
});

test('design edit runs one content job that views the screenshot frame (URL or inline bytes)',async()=>{
  const exports=await load('agy.mcp.service.ts'), native=new exports.AgyMcpService(), originalFetch=global.fetch;
  const requests=[];
  native.run=async(request)=>{requests.push(request);assert.equal(request.frames.length,1);assert.deepEqual(await fs.readFile(request.frames[0].path),png);
    return {variants:[{summary:'Đã căn giữa tiêu đề.',operations:[{op:'update',id:'title',props:{x:240}}]}]};};
  global.fetch=async()=>new Response(png);
  try {
    const input={instruction:'Căn giữa tiêu đề',page,elements};
    const fromUrl=await native.designEdit('org-1',input,'https://uploads.example.test/uploads/shot.png');
    assert.deepEqual(fromUrl,{reply:'Đã căn giữa tiêu đề.',summary:'Đã căn giữa tiêu đề.',operations:[{op:'update',id:'title',props:{x:240}}]});
    // Another org with the identical canvas never gets org-1's cached result: a second job runs.
    await native.designEdit('org-2',input,{data:png,mimeType:'image/png'});
    assert.equal(requests.length,2);
    for(const request of requests){
      assert.equal(request.kind,'content');
      assert.equal(request.role,'design-editor');
      assert.match(request.prompt,/"Căn giữa tiêu đề"/);
      assert.match(request.prompt,/"id":"title"/);
      assert.ok(request.schema.properties.variants);
      await assert.rejects(fs.access(request.frames[0].path),{code:'ENOENT'});
    }
  } finally {global.fetch=originalFetch;}
});

test('chat history reaches the prompt, undone turns are flagged and an undo turn only asks',()=>{
  const {designEditPrompt,sanitizeDesignEdit}=requireTs('design.edit.ts');
  const history=[{role:'user',text:'Làm nền tối hơn'},{role:'assistant',text:'Đã đổi nền sang #111111.',undone:true}];
  const prompt=designEditPrompt({instruction:'__undo__',page,elements,history});
  assert.match(prompt,/"Làm nền tối hơn"/);
  assert.match(prompt,/user không ưng kết quả này — tránh lặp lại hướng đó/);
  assert.match(prompt,/Do NOT edit: return "operations": \[\]/);
  assert.doesNotMatch(prompt,/USER INSTRUCTION/);
  const answer={variants:[{reply:'Bạn muốn: (1) nền sáng, (2) tiêu đề to hơn, hay (3) thêm khung?',summary:'Hỏi hướng chỉnh.',operations:[{op:'background',value:'#000000'}]}]};
  const asked=sanitizeDesignEdit(answer,{instruction:'__undo__',page,elements,history});
  assert.deepEqual(asked.operations,[]);
  assert.match(asked.reply,/nền sáng/);
  assert.equal(sanitizeDesignEdit(answer,{instruction:'Đổi nền đen',page,elements,history}).operations.length,1);
  assert.equal(sanitizeDesignEdit(answer,{instruction:'  ',page,elements}).operations.length,0);
  const normal=designEditPrompt({instruction:'Đổi nền đen',page,elements});
  assert.match(normal,/USER INSTRUCTION/);
  assert.doesNotMatch(normal,/CONVERSATION SO FAR/);
});

test('poster prompt builds a full design; user images are frames after the screenshot and the only allowed image src',async()=>{
  const {designEditPrompt,sanitizeDesignEdit}=requireTs('design.edit.ts');
  const ref='https://uploads.example.test/uploads/ref.png';
  const blank={instruction:'tạo poster bảo vệ môi trường, đầu tiên hãy tạo ảnh',page:{width:1080,height:1350},elements:[],referenceImages:[ref]};
  const prompt=designEditPrompt(blank);
  assert.match(prompt,/PAGE STATE: blank/);
  assert.match(prompt,/still do everything else in the same turn/);
  assert.match(prompt,/frame 0 = "https:\/\/uploads\.example\.test\/uploads\/ref\.png"/);  // empty page: no screenshot frame
  assert.match(prompt,/headline 81-122 px \(at most 2 lines\)/);
  const plan=sanitizeDesignEdit({variants:[{reply:'Đã dựng poster.',summary:'Poster.',operations:[
    {op:'add',type:'text',props:{x:72,y:900,width:900,height:200,text:'XANH HƠN MỖI NGÀY'}},
    {op:'add',type:'image',props:{src:ref,x:0,y:0,width:500,height:500}},
    {op:'add',type:'image',props:{src:'https://evil.example/x.png',x:0,y:0,width:500,height:500}},
    {op:'generateImage',prompt:'forest',props:{x:0,y:0,width:1080,height:1350},referenceImageUrls:[ref,'https://evil.example/x.png']},
  ]}]},blank);
  assert.deepEqual(plan.operations.map((op)=>op.op+':'+(op.type||'')),['generateImage:','add:text','add:image']);
  assert.deepEqual(plan.operations[0].referenceImageUrls,[ref]);
  assert.equal(plan.operations[2].props.src,ref);
});

test('inline screenshot stays frame 0 ahead of the user images',async()=>{
  const exports=await load('agy.mcp.service.ts'), native=new exports.AgyMcpService(), originalFetch=global.fetch;
  let frames;
  native.run=async(request)=>{frames=request.frames;return {variants:[{reply:'ok',summary:'ok',operations:[]}]};};
  global.fetch=async()=>new Response(png);
  try {
    await native.designEdit('org-1',{instruction:'dùng ảnh này',page,elements,referenceImages:['https://uploads.example.test/uploads/r.png']},{data:png,mimeType:'image/png'});
    assert.equal(frames.length,2);
    assert.deepEqual(frames.map((f)=>f.timestampSeconds),[0,1]);
    assert.match(frames[0].path,/image-1\.png$/);  // the inline screenshot (staged after the URL image)
    assert.match(frames[1].path,/image-0\.png$/);
  } finally {global.fetch=originalFetch;}
});

test('removeBackground only targets image elements; selection reaches the prompt',()=>{
  const {designEditPrompt,sanitizeDesignEdit}=requireTs('design.edit.ts');
  const input={instruction:'xóa nền trắng của sticker này',page,elements,selectedIds:['photo','ghost']};
  const prompt=designEditPrompt(input);
  assert.match(prompt,/user đang chọn các phần tử: photo\)/);
  assert.match(prompt,/Never regenerate the picture for this/);
  const plan=sanitizeDesignEdit({variants:[{reply:'Đã tách nền.',summary:'Tách nền.',operations:[
    {op:'removeBackground',id:'photo'},{op:'removeBackground',id:'title'},{op:'removeBackground',id:'ghost'}]}]},input);
  assert.deepEqual(plan.operations,[{op:'removeBackground',id:'photo'}]);
});

test('wide tracking is clamped and text boxes widen (or shrink the font) so words never break; copyright rule is in the prompt',()=>{
  const {designEditPrompt,sanitizeDesignEdit}=requireTs('design.edit.ts');
  const poster={width:1080,height:1350};
  const plan=sanitizeDesignEdit({variants:[{reply:'r',summary:'s',operations:[
    {op:'add',type:'text',props:{x:400,y:100,width:300,height:150,text:'MARVEL',fontSize:120,letterSpacing:0.8}},
    {op:'add',type:'text',props:{x:72,y:800,width:200,height:100,text:'Supercalifragilisticexpialidocious',fontSize:60}},
    {op:'add',type:'text',props:{x:72,y:600,width:936,height:100,text:'Ngày hội siêu anh hùng',fontSize:40}},
  ]}]},{instruction:'tạo 1 poster Marvel',page:poster,elements:[]});
  const [title,long,body]=plan.operations.map((op)=>op.props);
  assert.equal(title.letterSpacing,0.25);
  assert.equal(title.width,540);                       // 6 chars x 120 x 0.6 x 1.25: one line
  assert.deepEqual([long.width,long.fontSize,long.x],[950,46,65]);   // page minus 6% margins
  assert.deepEqual([body.width,body.fontSize],[936,40]);
  assert.match(designEditPrompt({instruction:'tạo 1 poster Marvel',page:poster,elements:[]}),/never name the brand\/character/);
});

test('layout-over-image phase: always views the screenshot, low effort, text/shapes only over the picture',()=>{
  const x=requireTs('design.edit.ts');
  const poster={width:1080,height:1350}, bg=[{id:'bg',type:'image',x:0,y:0,width:1080,height:1350,zIndex:0}];
  const input={instruction:'tạo poster bảo vệ môi trường',page:poster,elements:bg,phase:'layout-over-image'};
  assert.equal(x.designEditNeedsScreenshot({...input,elements:[]}),true);
  assert.equal(x.designEditEffort(input),'low');
  assert.equal(x.designAsksOnly({...input,instruction:''}),false);
  const prompt=x.designEditPrompt(input);
  assert.match(prompt,/PHASE layout-over-image/);
  assert.match(prompt,/"observation"/);
  assert.doesNotMatch(prompt,/PAGE STATE/);
  const plan=x.sanitizeDesignEdit({variants:[{observation:'Chủ thể bên trái, góc phải trên trống.',reply:'r',summary:'s',operations:[
    {op:'generateImage',prompt:'forest',props:{x:0,y:0,width:1080,height:1350}},
    {op:'update',id:'bg',props:{x:5}},{op:'removeBackground',id:'bg'},
    {op:'add',type:'figure',props:{x:540,y:80,width:480,height:300,fill:'#000000',opacity:0.5}},
    {op:'add',type:'text',props:{x:560,y:100,width:440,height:150,text:'XANH',fontSize:100,letterSpacing:0.2}},
  ]}]},input);
  assert.deepEqual(plan.operations.map((op)=>op.op+':'+(op.type||op.id)),['add:figure','add:text']);
  assert.equal(plan.operations[1].props.letterSpacing,0.1);
});

test('layout-zones phase: text-only low-effort job, text clamped into the text/cta zones, no generateImage',()=>{
  const x=requireTs('design.edit.ts');
  const poster={width:1080,height:1350};
  const zones=[{name:'subject',x:0,y:0,width:1080,height:800},{name:'text',x:60,y:820,width:960,height:330},{name:'cta',x:60,y:1180,width:420,height:110}];
  const input={instruction:'tạo poster bảo vệ môi trường',page:poster,elements:[],phase:'layout-zones',zones};
  assert.equal(x.designEditNeedsScreenshot({...input,elements:[{id:'a',type:'text',x:0,y:0,width:1,height:1,zIndex:0}]}),false);
  assert.equal(x.designEditEffort(input),'low');
  assert.match(x.designEditPrompt(input),/PHASE layout-zones/);
  const plan=x.sanitizeDesignEdit({variants:[{reply:'r',summary:'s',operations:[
    {op:'generateImage',prompt:'forest',props:{x:0,y:0,width:1080,height:1350}},
    {op:'add',type:'figure',props:{x:60,y:820,width:960,height:330,fill:'#000000',opacity:0.45}},
    {op:'add',type:'text',props:{x:40,y:100,width:1000,height:160,text:'SỐNG XANH',fontSize:120,letterSpacing:0.2}},
    {op:'add',type:'text',props:{x:100,y:1200,width:600,height:60,text:'THAM GIA NGAY',fontSize:44}},
  ]}]},input);
  assert.deepEqual(plan.operations.map((op)=>op.op+':'+op.type),['add:figure','add:text','add:text']);
  const [,title,cta]=plan.operations.map((op)=>op.props);
  assert.deepEqual([title.x,title.y,title.width,title.letterSpacing],[65,820,950,0.1]);   // moved out of the subject zone, 6% margins
  assert.deepEqual([cta.x,cta.y,cta.width],[60,1200,420]);
});

test('design system: picture palette colors, gradient overlay instead of a solid band, allowed fonts, gradient op shape',()=>{
  const x=requireTs('design.edit.ts');
  const poster={width:1080,height:1350};
  const palette={colors:['#1F4D2B','#7FB069','#E8F1D9','#2E3A1F','#C9A227'],dark:'#13261A',light:'#F4F8EC',accent:'#C9A227'};
  const input={instruction:'poster HUTECH',page:poster,elements:[{id:'bg',type:'image',x:0,y:0,width:1080,height:1350,zIndex:0}],phase:'layout-over-image',palette};
  const plan=x.sanitizeDesignEdit({variants:[{reply:'r',summary:'s',operations:[
    {op:'add',type:'figure',props:{x:0,y:900,width:1080,height:450,fill:'#0B1F4D'}},
    {op:'add',type:'figure',props:{x:80,y:1220,width:360,height:80,fill:'#FF0000',cornerRadius:40}},
    {op:'add',type:'text',props:{x:10,y:950,width:1100,height:120,text:'HUTECH XANH',fontSize:110,fontFamily:'Arial',fill:'#FFFFFF'}},
    {op:'add',type:'gradient',props:{x:0,y:0,width:1080,height:400,from:'#112233',direction:-90}},
    {op:'add',type:'gradient',props:{x:0,y:0,width:1080,height:400,from:'#000',fromOpacity:3,direction:'diagonal'}},
  ]}]},input);
  const [band,cta,title,deg,bad]=plan.operations;
  assert.deepEqual(band,{op:'add',type:'gradient',props:{x:0,y:900,width:1080,height:450,from:'#13261A',to:'#13261A',fromOpacity:0.7,toOpacity:0,direction:'to-top'}});
  assert.equal(cta.props.fill,'#C9A227');                       // no default red: snapped to the picture accent
  assert.deepEqual([title.props.fontFamily,title.props.fill,title.props.x,title.props.width],['Be Vietnam Pro','#F4F8EC',65,950]);
  assert.equal(deg.props.direction,270);
  assert.deepEqual([bad.props.fromOpacity,bad.props.direction],[1,'to-top']);
  const neutral=x.designEditPrompt({instruction:'p',page:poster,elements:[],phase:'layout-zones',zones:[{name:'text',x:60,y:800,width:960,height:300}]});
  assert.match(neutral,/no picture colors yet: neutral palette/);
  assert.deepEqual(x.DESIGN_EDIT_SKILLS,['frontend-design','og-image-design','youtube-thumbnail-design']);
});

test('result schema compiles with the runner validator (a schema error kills every design job)',()=>{
  const {designEditSchema}=requireTs('design.edit.ts');
  const Ajv=require('ajv');
  const validate=new Ajv({strict:true,allErrors:true,validateFormats:false}).compile(designEditSchema);
  assert.equal(validate({variants:[{reply:'ok',summary:'ok',operations:[{op:'add',type:'gradient',props:{x:0,y:0,width:10,height:10,direction:'to-top'}}]}]}),true);
});
