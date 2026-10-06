'use strict';
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env'),quiet:true});
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const callWithRetry=async(client,params)=>{for(let attempt=1;;attempt++){try{return await client.callTool(params,undefined,{timeout:120000});}catch(error){if(attempt>=4||!/fetch failed|ECONNRESET|socket|timed out/i.test(`${error.message} ${error.cause?.message||''}`))throw error;console.log(`retry ${params.name} after ${error.message}`);await new Promise(r=>setTimeout(r,2000*attempt));}}};
const root=path.resolve(__dirname,'..'),reportName=process.argv[2]||'live-ai-video-mcp';assert.match(reportName,/^[a-z0-9-]+$/);
const reportPath=path.join(root,'reports/openshorts-integration',reportName+'.json');
const jobRoot=process.env.AI_VIDEO_JOB_DIRECTORY||path.join(os.tmpdir(),'nan-ai-video-jobs');
const aspect=process.env.AI_VIDEO_ASPECT||'1:1',dims={'9:16':[1080,1920],'16:9':[1920,1080],'1:1':[1080,1080]}[aspect];assert.ok(dims,'AI_VIDEO_ASPECT must be 9:16, 16:9 or 1:1');
const durationEnv=Number(process.env.AI_VIDEO_DURATION||15);assert.ok([15,30,60].includes(durationEnv),'AI_VIDEO_DURATION must be 15, 30 or 60');
const defaultTopic='Một ngày xanh: mang bình nước cá nhân, đi bộ dưới hàng cây và tắt đèn khi rời phòng. Các cảnh minh họa điện ảnh nhất quán, lời kể tiếng Việt tự nhiên, ngắn gọn; không chữ trong ảnh.';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function journals(orgId){
 const names=await fs.readdir(jobRoot).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
 const rows=[];
 for(const name of names){if(!/^[0-9a-f-]{36}\.json$/.test(name))continue;
  const row=JSON.parse(await fs.readFile(path.join(jobRoot,name),'utf8'));if(row.orgId===orgId)rows.push(row);
 }return rows;
}
async function main(){
 const fixture=JSON.parse(await fs.readFile(path.join(root,'reports/openshorts-integration/live-silent-job.json'),'utf8'));
 const report=await fs.readFile(reportPath,'utf8').then(JSON.parse,error=>{
  if(error.code!=='ENOENT')throw error;
  return {kind:'authenticated-mcp-create-video-from-idea',orgId:fixture.orgId,stages:[],input:{topic:process.env.AI_VIDEO_TOPIC||defaultTopic,targetDuration:durationEnv,aspectRatio:aspect,voice:'Thuyết Minh'}};
 });
 // Receipts are write-once: a resumed report keeps its recorded input; env overrides may not silently change it.
 if(process.env.AI_VIDEO_DURATION&&report.input.targetDuration!==durationEnv)throw new Error(`Report ${reportName} was recorded for ${report.input.targetDuration}s; use a new report name`);
 const targetSeconds=report.input.targetDuration,expectedFrames=targetSeconds*30;
 const save=async()=>{report.observedAt=new Date().toISOString();await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');};
 await save();const db=new PrismaClient(),client=new Client({name:'nan-ai-video-mcp-live',version:'1.0.0'});let temporaryKey;
 const call=async(name,args)=>{
  const result=await callWithRetry(client,{name,arguments:args});assert.notEqual(result.isError,true);
  const value=JSON.parse(result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));
  assert.ok(!value.error||['failed','cancelled'].includes(value.status),value.error);return value;
 };
 try{
  const endpoint=new URL('/mcp',process.env.NEXT_PUBLIC_BACKEND_URL||'http://localhost:3000');assert.ok(['localhost','127.0.0.1'].includes(endpoint.hostname));
  const org=await db.organization.findUnique({where:{id:report.orgId},select:{apiKey:true}});assert.ok(org);
  if(!org.apiKey){temporaryKey=crypto.randomBytes(32).toString('hex');assert.equal((await db.organization.updateMany({where:{id:report.orgId,apiKey:null},data:{apiKey:temporaryKey}})).count,1);}
  await client.connect(new StreamableHTTPClientTransport(endpoint,{requestInit:{headers:{Authorization:`Bearer ${temporaryKey||org.apiKey}`}}}));
  const names=(await client.listTools()).tools.map(tool=>tool.name);assert.ok(names.includes('generateAiVideoTool')&&names.includes('aiVideoStatusTool'));report.toolsDiscovered=true;
  if(!report.jobId){
   if(report.dispatchStartedAt){
    // An observation failure never authorizes a second generator job.
    const candidates=(await journals(report.orgId)).filter(row=>!report.baselineJobIds.includes(row.jobId)&&row.createdAt>=report.dispatchStartedAt);
    assert.equal(candidates.length,1,'Dispatch outcome is ambiguous; inspect the existing job instead of starting another');report.jobId=candidates[0].jobId;await save();
   }else{
    report.baselineJobIds=(await journals(report.orgId)).map(row=>row.jobId);
    const log=path.join(os.homedir(),'.local/share/postiz-dev/logs/backend.log');report.backendLogOffset=(await fs.stat(log)).size;
    report.dispatchStartedAt=Date.now();await save();
    const started=await call('generateAiVideoTool',report.input);assert.ok(started.jobId);report.jobId=started.jobId;await save();
   }
  }
  const deadline=Date.now()+Number(process.env.AI_VIDEO_OBSERVE_MINUTES||{15:21,30:30,60:45}[targetSeconds])*60_000;let final;
  while(Date.now()<deadline){
   const state=await call('aiVideoStatusTool',{jobId:report.jobId});
   const stage=`${state.status}:${state.stage}:${state.progress}`;
   if(report.stages.at(-1)!==stage){report.stages.push(stage);(report.stageTimes||=[]).push({stage,elapsedSeconds:Math.round((Date.now()-report.dispatchStartedAt)/1000)});await save();console.log(new Date().toISOString(),stage);}
   if(['completed','failed','cancelled'].includes(state.status)){report.final=state;await save();assert.equal(state.status,'completed',state.error);final=state;break;}
   await sleep(2000);
  }
  assert.ok(final,'Observation paused: resume the same saved job');
  const media=await db.media.findFirst({where:{id:final.media.id,organizationId:report.orgId}});assert.ok(media&&media.path===final.media.path);
  let bytes;
  if((process.env.STORAGE_PROVIDER||'local')==='local'){
   const prefix=process.env.FRONTEND_URL+'/uploads/';assert.ok(media.path.startsWith(prefix));
   const uploads=await fs.realpath(process.env.UPLOAD_DIRECTORY||'/uploads');
   const saved=await fs.realpath(path.join(uploads,decodeURIComponent(media.path.slice(prefix.length))));
   assert.ok(saved.startsWith(uploads+path.sep));bytes=await fs.readFile(saved);report.storageArtifactVerified=true;report.frontendPreviewVerified=false;
  }else{
   const downloaded=await fetch(media.path,{signal:AbortSignal.timeout(30000)});assert.ok(downloaded.ok);bytes=Buffer.from(await downloaded.arrayBuffer());
  }
  assert.ok(bytes.length>10000&&bytes.length<100*1024*1024);
  const artifact=path.join(root,'reports/openshorts-integration',reportName+'.mp4');await fs.writeFile(artifact,bytes);
  const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',artifact],{encoding:'utf8',timeout:60000});assert.equal(probe.status,0,probe.stderr);
  const metadata=JSON.parse(probe.stdout),video=metadata.streams.find(stream=>stream.codec_type==='video'),audio=metadata.streams.find(stream=>stream.codec_type==='audio');
  const [expectedWidth,expectedHeight]={'9:16':[1080,1920],'16:9':[1920,1080],'1:1':[1080,1080]}[report.input.aspectRatio||'9:16'];assert.equal(video.width,expectedWidth);assert.equal(video.height,expectedHeight);assert.equal(Number(video.nb_read_frames),expectedFrames);assert.ok(audio&&Math.abs(Number(metadata.format.duration)-targetSeconds)<.1);
  const decode=spawnSync('ffmpeg',['-v','error','-xerror','-threads','1','-i',artifact,'-threads','1','-f','null','-'],{encoding:'utf8',timeout:targetSeconds*8000+60000});assert.equal(decode.status,0,decode.stderr);
  const board=JSON.parse(await fs.readFile(path.join(jobRoot,`${report.jobId}.storyboard.json`),'utf8'));
  const inputs=JSON.parse(await fs.readFile(path.join(jobRoot,`${report.jobId}.inputs.json`),'utf8'));
  assert.equal(board.scenes.length,{15:4,30:6,60:11}[report.input.targetDuration]);assert.ok(inputs.tts.captions.length&&inputs.tts.durationInFrames===expectedFrames);
  const log=(await fs.readFile(path.join(os.homedir(),'.local/share/postiz-dev/logs/backend.log'))).subarray(report.nativeEvidenceLogOffset??report.backendLogOffset).toString();
  const tasks=[];
  // Url-only image jobs complete on publish_image without a submit_result turn (runtime image-reroute contract).
  const done=row=>row.mcpCalls.some(call=>call.tool==='submit_result'||(row.kind==='image'&&call.tool==='publish_image'));
  // Nest colours its logger when attached to a TTY; strip ANSI escapes before parsing receipts.
  for(const rawLine of log.split('\n')){const line=rawLine.replace(/\x1b\[[0-9;]*m/g,'');if(!line.includes('[AgyMcpService]'))continue;const start=line.indexOf('{');if(start<0)continue;
   try{const row=JSON.parse(line.slice(start));if(row.jobId&&row.status!=='failed'&&['content','image'].includes(row.kind)&&Array.isArray(row.mcpCalls)&&done(row))tasks.push(row);}catch{}
  }
  assert.ok(tasks.some(task=>task.kind==='content')&&tasks.filter(task=>task.kind==='image').length>=board.scenes.length,'Missing native AGY content/image receipts');
  const imageSchema={type:'object',properties:{url:{type:'string',minLength:1}},required:['url'],additionalProperties:false};
  report.imageTaskBindings=board.scenes.map(scene=>{
   const inputHash=hash(JSON.stringify({kind:'image',role:'visual art director',nativeReview:false,
    prompt:scene.imagePrompt+`\nRequired aspect ratio: ${report.input.aspectRatio||'9:16'}.`,schema:imageSchema,tools:[],frames:[]}));
   const task=tasks.find(row=>row.kind==='image'&&row.inputHash===inputHash&&row.mcpCalls.some(call=>call.tool==='publish_image'));
   assert.ok(task,`No native image receipt matches scene ${scene.sceneIndex}`);return {sceneIndex:scene.sceneIndex,taskId:task.jobId,inputHash};
  });
  assert.ok(tasks.every(done));
  report.nativeTasks=tasks.map(task=>({jobId:task.jobId,kind:task.kind,runtimeHash:task.runtimeHash,inputHash:task.inputHash,mcpCalls:task.mcpCalls,policyDecisions:task.policyDecisions}));
  report.artifact={path:artifact,mediaId:media.id,sha256:hash(bytes),bytes:bytes.length,width:video.width,height:video.height,frames:Number(video.nb_read_frames),durationSeconds:Number(metadata.format.duration),audio:true,fullDecodePassed:true,captionWords:inputs.tts.captions.length};
  report.sourceFiles={};for(const name of ['scripts/test-ai-video-mcp-live.cjs','libraries/nestjs-libraries/src/chat/tools/generate.ai.video.tool.ts','libraries/nestjs-libraries/src/videos/remotion/storyboard.service.ts','libraries/nestjs-libraries/src/videos/remotion/remotion.service.ts','libraries/nestjs-libraries/src/videos/remotion/remotion.renderer.ts','libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service.ts'])report.sourceFiles[name]=hash(await fs.readFile(path.join(root,name)));
  // Delivered-audio quality: pacing (speech coverage/dead air), caption-vs-silence sync and loudness.
  const analysis=spawnSync('ffmpeg',['-hide_banner','-nostdin','-i',artifact,'-vn','-af','silencedetect=noise=-32dB:duration=0.12,ebur128=peak=true','-f','null','-'],{encoding:'utf8',timeout:targetSeconds*4000+60000});assert.equal(analysis.status,0,analysis.stderr);
  const duration=Number(metadata.format.duration),silences=[];let open;
  for(const match of analysis.stderr.matchAll(/silence_(start|end): (-?[\d.]+)/g)){const t=Math.max(0,Number(match[2]));if(match[1]==='start')open=t;else if(open!==undefined){silences.push([open,t]);open=undefined;}}
  if(open!==undefined)silences.push([open,duration]);
  const silent=silences.reduce((sum,[a,b])=>sum+b-a,0),longPauses=silences.filter(([a,b])=>b-a>=.3);
  const captionsInSilenceMs=Math.round(inputs.tts.captions.reduce((sum,c)=>sum+longPauses.reduce((inner,[a,b])=>inner+Math.max(0,Math.min(b*1000,c.endMs)-Math.max(a*1000,c.startMs)),0),0));
  const lufs=Number((analysis.stderr.match(/Integrated loudness:[\s\S]*?I:\s+(-?[\d.]+) LUFS/)||[])[1]),truePeak=Number((analysis.stderr.match(/True peak:[\s\S]*?Peak:\s+(-?[\d.]+) dBFS/)||[])[1]);
  const quality={speechCoverage:+(1-silent/duration).toFixed(3),maxDeadAirSeconds:+Math.max(0,...silences.map(([a,b])=>b-a)).toFixed(3),captionsInSilenceMs,integratedLufs:lufs,truePeakDbfs:truePeak,
   thresholds:{speechCoverage:.7,maxDeadAirSeconds:1.2,captionsInSilenceMs:400,lufsRange:[-20,-12],truePeakMax:-1}};
  quality.gatePassed=quality.speechCoverage>=.7&&quality.maxDeadAirSeconds<=1.2&&captionsInSilenceMs<=400&&lufs>=-20&&lufs<=-12&&truePeak<=-1;
  report.quality=quality;report.technicalPipelinePassed=true;
  // A technical pass never overrides a failed delivered-quality gate; manual frame review remains separate.
  report.passed=quality.gatePassed;report.manualFrameReview='pending';delete report.observationError;await save();console.log(JSON.stringify({passed:report.passed,quality:report.quality,jobId:report.jobId,artifact:report.artifact,nativeTaskIds:report.nativeTasks.map(task=>task.jobId)}));
 }catch(error){report.observationError=error.message;await save();throw error;}
 finally{await client.close().catch(()=>{});if(temporaryKey)await db.organization.updateMany({where:{id:report.orgId,apiKey:temporaryKey},data:{apiKey:null}});await db.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
