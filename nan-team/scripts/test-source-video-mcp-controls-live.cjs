'use strict';
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
// Usage: node scripts/test-source-video-mcp-controls-live.cjs [report-name]  (default live-mcp-controls)
// An existing terminal report (passed true/false) is preserved: pass a new report name.
const reportName=process.argv[2]||'live-mcp-controls';assert.match(reportName,/^[a-z0-9-]+$/,'Report name must be a safe local filename');
const root=path.resolve(__dirname,'..'),file=path.join(root,`reports/openshorts-integration/${reportName}.json`);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function main(){
 const fixture=JSON.parse(await fs.readFile(path.join(root,'reports/openshorts-integration/live-silent-job.json'),'utf8'));
 const report=await fs.readFile(file,'utf8').then(JSON.parse,error=>{
  if(error.code!=='ENOENT')throw error;
  return {kind:'authenticated-mcp-hook-crop-zip-controls',orgId:fixture.orgId,sourceSha256:fixture.sourceSha256,
   input:{mediaId:fixture.sourceMediaId,idempotencyKey:crypto.randomUUID(),operation:'edit',aspectRatio:'16:9',layout:'wide',segments:[{startSeconds:0,endSeconds:12}],captions:{enabled:false},hook:{enabled:true,text:'Save water with simple habits',style:'yellow',durationSeconds:.75},audio:{mode:'keep'},reviewBeforeRender:false},stages:{}};
 });
 if(report.passed===true||report.passed===false){console.error(JSON.stringify({refused:file,reason:'terminal receipt is preserved; pass a new report name',passed:report.passed}));process.exitCode=2;return;}
 const save=async()=>{report.observedAt=new Date().toISOString();await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');};
 await save();
 const db=new PrismaClient(),client=new Client({name:'source-video-mcp-controls',version:'1.0.0'}),temporaryKeys=[];
 const credential=async orgId=>{
  const org=await db.organization.findUnique({where:{id:orgId},select:{apiKey:true}});assert.ok(org);
  if(org.apiKey)return org.apiKey;
  const key=crypto.randomBytes(32).toString('hex');
  const updated=await db.organization.updateMany({where:{id:orgId,apiKey:null},data:{apiKey:key}});assert.equal(updated.count,1);
  temporaryKeys.push({orgId,key});return key;
 };
 const call=async(name,args)=>{
  const result=await client.callTool({name,arguments:args});assert.notEqual(result.isError,true);
  const value=JSON.parse(result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));
  assert.ok(!value.error||['failed','cancelled'].includes(value.status),value.error);return value;
 };
 const wait=async(jobId,label)=>{
  const deadline=Date.now()+15*60_000;
  while(Date.now()<deadline){
   const state=await call('sourceVideoStatusTool',{jobId});
   const stage=`${state.status}:${state.stage}:${state.progress}`;report.stages[label]||=[];
   if(report.stages[label].at(-1)!==stage){report.stages[label].push(stage);await save();console.log(`${label}:${stage}`);}
   if(['completed','failed','cancelled'].includes(state.status)){
    report[label]=state;await save();assert.equal(state.status,'completed',state.error);return state;
   }
   await sleep(1000);
  }
  report.observationPaused={jobId,label};await save();throw new Error('Observation paused; rerun to observe the same persisted job');
 };
 try{
  const endpoint=new URL('/mcp',process.env.NEXT_PUBLIC_BACKEND_URL||'http://127.0.0.1:3000');
  assert.ok(['127.0.0.1','localhost'].includes(endpoint.hostname));
  const key=await credential(report.orgId),headers={Authorization:`Bearer ${key}`};
  await client.connect(new StreamableHTTPClientTransport(endpoint,{requestInit:{headers}}));
  const names=(await client.listTools()).tools.map(item=>item.name);assert.ok(names.includes('sourceVideoDownloadTool'));
  if(!report.jobId){const job=await call('processSourceVideoTool',report.input);assert.ok(job.jobId);report.jobId=job.jobId;await save();}
  const initial=await wait(report.jobId,'base');
  const jobRoot=path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY||path.join(os.homedir(),'.local/share/nan-team/source-video-jobs'),report.jobId);
  const receipt=JSON.parse(await fs.readFile(path.join(jobRoot,'receipt.json'),'utf8'));
  const rendered=receipt.rendered.clips[0];assert.equal(rendered.designDecision.hook.durationSeconds,.75);
  const rgb=(filename,seconds)=>{
   const frame=spawnSync('ffmpeg',['-v','error','-ss',String(seconds),'-i',filename,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'],{timeout:30000,maxBuffer:10_000_000});
   assert.equal(frame.status,0,String(frame.stderr));return frame.stdout;
  };
  const difference=seconds=>{
   const clean=rgb(rendered.cleanPath,seconds),output=rgb(rendered.path,seconds);assert.equal(clean.length,output.length);
   let total=0;for(let i=0;i<clean.length;i++)total+=Math.abs(clean[i]-output[i]);return total/clean.length;
  };
  report.hookTiming={durationSeconds:.75,duringDifference:difference(.25),afterDifference:difference(2)};
  assert.ok(report.hookTiming.duringDifference>3&&report.hookTiming.afterDifference<1,'Hook duration does not match rendered frames');await save();
  const manifest=await call('sourceVideoEvidenceTool',{jobId:report.jobId,clipId:initial.clips[0].clipId,kind:'crop-scenes',limit:100});
  assert.equal(manifest.timestampBasis,'clip');assert.ok(manifest.items.length);
  assert.equal(manifest.items[0].sceneIndex,0);assert.ok(manifest.items[0].endSeconds>0);report.cropManifest=manifest;await save();
  const links=await call('sourceVideoDownloadTool',{jobId:report.jobId});
  const zipUrl=new URL(links.downloadUrl);assert.equal(zipUrl.origin,endpoint.origin);assert.equal(zipUrl.search,'');
  const before=new Set((await fs.readdir(jobRoot)).filter(name=>name.endsWith('.zip')));
  const response=await fetch(zipUrl,{headers});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/zip/);
  assert.match(response.headers.get('cache-control'),/no-store/);
  const bytes=Buffer.from(await response.arrayBuffer()),directory=await fs.mkdtemp(path.join(os.tmpdir(),'nan-mcp-controls-'));
  try{
   const zip=path.join(directory,'clips.zip');await fs.writeFile(zip,bytes);
   const checked=spawnSync('python3',['-c','import json,sys,zipfile,hashlib; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([{ "name":i.filename,"sha256":hashlib.sha256(z.read(i)).hexdigest()} for i in z.infolist()]))',zip],{encoding:'utf8',timeout:30000});
   assert.equal(checked.status,0,checked.stderr);const entries=JSON.parse(checked.stdout);
   assert.deepEqual(entries.map(item=>item.name),['clip-1.mp4']);assert.equal(entries[0].sha256,initial.clips[0].sha256);
   const other=await db.userOrganization.findFirst({where:{organizationId:{not:report.orgId},disabled:false,user:{email:{endsWith:'@fixture.invalid'},activated:true}},select:{organizationId:true}});assert.ok(other);
   const otherKey=await credential(other.organizationId);
   const denied=await fetch(zipUrl,{headers:{Authorization:`Bearer ${otherKey}`}});assert.equal(denied.status,404);await denied.arrayBuffer();
   const absent=await fetch(zipUrl);assert.equal(absent.status,401);await absent.arrayBuffer();
   const invalid=await fetch(new URL('/public/v1/source-video-jobs/not-a-uuid/download-all',endpoint),{headers});assert.equal(invalid.status,400);await invalid.arrayBuffer();
   const override=await fetch(zipUrl,{headers:{...headers,'x-postiz-org':other.organizationId}});assert.equal(override.status,200);await override.arrayBuffer();
   let cleaned=false;
   for(let attempt=0;attempt<30;attempt++){
    const remaining=(await fs.readdir(jobRoot)).filter(name=>name.endsWith('.zip')&&!before.has(name));
    if(!remaining.length){cleaned=true;break;}await sleep(100);
   }
   assert.ok(cleaned,'ZIP transfer left a temporary archive');
   report.zip={sha256:hash(bytes),bytes:bytes.length,entries,temporaryArchiveCleaned:cleaned,crossOrgStatus:denied.status,missingAuthStatus:absent.status,invalidIdStatus:invalid.status,callerOrgOverrideIgnored:true};await save();
  }finally{await fs.rm(directory,{recursive:true,force:true});}
  if(!report.cropInput){report.cropInput={jobId:report.jobId,clipId:initial.clips[0].clipId,expectedRevision:initial.revision,idempotencyKey:crypto.randomUUID(),aspectRatio:'9:16',layout:'general',cropOverrides:{[String(manifest.items[0].sceneIndex)]:.35},reviewBeforeRender:false};await save();}
  if(!report.cropJobId){const revised=await call('editVideoClipTool',report.cropInput);assert.ok(revised.jobId);report.cropJobId=revised.jobId;await save();}
  const cropped=await wait(report.cropJobId,'cropped');
  const cropRoot=path.join(path.dirname(jobRoot),report.cropJobId),cropReceipt=JSON.parse(await fs.readFile(path.join(cropRoot,'receipt.json'),'utf8'));
  const cropRender=cropReceipt.rendered.clips[0];assert.equal(cropRender.designDecision.hook.durationSeconds,.75);
  assert.equal(cropReceipt.input.cropOverrides['0'],.35);assert.equal(cropRender.renderDecision.cropScenes[0].sceneIndex,0);assert.equal(cropRender.renderDecision.cropScenes[0].strategy,'TRACK');
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',cropRender.path],{encoding:'utf8',timeout:30000});assert.equal(probe.status,0,probe.stderr);
  const metadata=JSON.parse(probe.stdout),video=metadata.streams.find(item=>item.codec_type==='video');assert.ok(Math.abs(video.width/video.height-9/16)<.02);
  const decoded=spawnSync('ffmpeg',['-v','error','-xerror','-i',cropRender.path,'-f','null','-'],{encoding:'utf8',timeout:120000});assert.equal(decoded.status,0,decoded.stderr);
  assert.equal(hash(await fs.readFile(cropRender.path)),cropped.clips[0].sha256);
  const publications=await db.sourceVideoPublication.count({where:{orgId:report.orgId,jobId:report.cropJobId,status:'committed'}});assert.equal(publications,1);
  report.cropArtifact={mediaId:cropped.clips[0].media.id,sha256:cropped.clips[0].sha256,width:video.width,height:video.height,fullDecodePassed:true,committedPublications:publications,sceneIndex:0,requestedCenter:.35,actualStrategy:cropRender.renderDecision.cropScenes[0].strategy};
  report.sourceFiles={};for(const name of ['config/dev-native.sh','packages/openshorts-engine/src/pipeline.py','packages/openshorts-engine/src/render_phase.py','packages/openshorts-engine/src/rendering.py','packages/openshorts-engine/core/reframe_v2.py','libraries/nestjs-libraries/src/videos/openshorts/source-video.service.ts','libraries/nestjs-libraries/src/chat/tools/source.video.evidence.tool.ts','libraries/nestjs-libraries/src/chat/tools/source.video.download.tool.ts','apps/backend/src/services/auth/source.video.public.auth.middleware.ts','apps/backend/src/api/routes/source-video-zip.stream.ts'])report.sourceFiles[name]=hash(await fs.readFile(path.join(root,name)));
  report.passed=true;delete report.observationPaused;delete report.observationError;await save();console.log(JSON.stringify({passed:true,jobId:report.jobId,cropJobId:report.cropJobId,hookTiming:report.hookTiming,zip:report.zip,cropArtifact:report.cropArtifact}));
 }catch(error){report.observationError=error.message;await save();throw error;}
 finally{await client.close().catch(()=>{});for(const {orgId,key} of temporaryKeys)await db.organization.updateMany({where:{id:orgId,apiKey:key},data:{apiKey:null}});await db.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
