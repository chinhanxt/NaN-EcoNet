'use strict';
const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const {resultValue}=require('../packages/openshorts-engine/bin/nan-video.cjs');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const reportPath=path.join(root,'reports/openshorts-integration/live-caption-appearance-mcp.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function audioIdentity(clip,artifact){
 const directory=path.dirname(clip.cleanPath),voices=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true}))if(entry.isDirectory()&&entry.name.startsWith('speech-')){
  const file=path.join(directory,entry.name,'preview.wav');if(await fs.access(file).then(()=>true,()=>false))voices.push(file);
 }
 assert.equal(voices.length,1,'Expected exact narration WAV for rendered attempt');
 const python=String.raw`import sys,json,subprocess,hashlib
import numpy as np
from scipy.signal import correlate
def decode(path):
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-threads','1','-i',path,'-vn','-ac','1','-ar','8000','-f','f32le','-']),dtype=np.float32)
a=decode(sys.argv[1]);b=decode(sys.argv[2]);lag=int(np.argmax(correlate(b,a,mode='full',method='fft'))-(len(a)-1))
start=max(0,lag);offset=max(0,-lag);length=min(len(a)-offset,len(b)-start)
score=float(np.corrcoef(a[offset:offset+length],b[start:start+length])[0,1])
print(json.dumps({'method':'normalized waveform correlation, 8kHz mono, FFT lag search','correlation':score,'lagSeconds':lag/8000,'comparedSeconds':length/8000,'voiceCloneWavSha256':hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest()}))`;
 const result=JSON.parse(execFileSync('python3',['-c',python,voices[0],artifact],{maxBuffer:256*1024}));
 assert.ok(result.correlation>.95,`Delivered audio differs from ASR narration: ${result.correlation}`);return result;
}
async function runCli(args,token){
 const child=spawn(process.execPath,['packages/openshorts-engine/bin/nan-video.cjs',...args],
  {cwd:root,env:{...process.env,NAN_MCP_URL:'http://127.0.0.1:3000/mcp',NAN_MCP_TOKEN:token},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
 assert.ok(!stdout.includes(token)&&!stderr.includes(token),'CLI credential leak');
 return {code,stdout,stderr};
}
async function main(){
 const prior=require('../reports/openshorts-integration/live-user-source-video.json');
 const report=await fs.readFile(reportPath,'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;return {
  kind:'authenticated-CLI-MCP-source-video-caption-appearance-with-Voice-Clone',orgId:prior.orgId,
  sourceMediaId:prior.sourceMediaId,sourceSha256:prior.sourceSha256,
  input:{mediaId:prior.sourceMediaId,idempotencyKey:crypto.randomUUID(),operation:'edit',aspectRatio:'1:1',
   layout:'wide',segments:[{startSeconds:0,endSeconds:4.7}],reviewBeforeRender:false,
   captions:{enabled:true,borderColor:'#000000',borderWidth:2,bgColor:'#112233',bgOpacity:.6,baseOpacity:.7},
   audio:{mode:'replace-narration',voice:'Thuyết Minh',narrationText:'Hôm nay chúng ta cùng tập luyện để khỏe hơn mỗi ngày.'},
   effects:[],hook:{enabled:false},motionDesign:{enabled:true,theme:'clean',transitions:'none'}},stages:[]};});
 const save=async()=>{report.observedAt=new Date().toISOString();await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');};
 await save();const db=new PrismaClient(),client=new Client({name:'caption-appearance-live',version:'1.0.0'});let temporaryKey;
 const call=async(name,args)=>resultValue(await client.callTool({name,arguments:args}));
 try{
  const org=await db.organization.findUniqueOrThrow({where:{id:report.orgId},select:{apiKey:true}});
  if(!org.apiKey){temporaryKey=crypto.randomBytes(32).toString('hex');assert.equal((await db.organization.updateMany({where:{id:report.orgId,apiKey:null},data:{apiKey:temporaryKey}})).count,1);}
  const token=temporaryKey||org.apiKey;
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`},redirect:'error'}}));
  const tools=await client.listTools();
  const fields=['position','fontName','fontSize','fontColor','borderColor','borderWidth','highlightColor','bgColor','bgOpacity','effect','baseOpacity','uppercase'];
  for(const name of ['processSourceVideoTool','editVideoClipTool']){
   const schema=tools.tools.find(tool=>tool.name===name)?.inputSchema.properties?.captions?.properties;
   for(const field of fields)assert.ok(schema?.[field],`${name} missing ${field}`);
  }
  report.authenticatedSchemaFields=fields;await save();
  if(process.argv.includes('--recover-terminal')){
   assert.ok(report.jobId,'Recovery requires a recorded job');
   const previous=await call('sourceVideoStatusTool',{jobId:report.jobId});
   assert.equal(previous.status,'failed','Only a verified failed job may be replaced');
   await fs.writeFile(reportPath.replace(/\.json$/,`.failed-${report.jobId}.json`),JSON.stringify(report,null,2)+'\n');
   report.previousFailedJobs=[...(report.previousFailedJobs||[]),{jobId:report.jobId,
    status:previous.status,error:previous.error,recoveryReason:'Corrected portrait-to-square canvas bypass; new immutable engine candidate'}];
   delete report.jobId;delete report.terminalError;delete report.observationError;
   report.input.idempotencyKey=crypto.randomUUID();report.stages=[];await save();
  }
  if(process.argv.includes('--revise-completed')){
   assert.ok(report.jobId,'Revision requires a recorded parent');
   const previous=await call('sourceVideoStatusTool',{jobId:report.jobId});
   assert.equal(previous.status,'completed','Revision requires a verified completed parent');
   const archived=structuredClone(report);
   if(archived.artifact?.path){const destination=archived.artifact.path.replace(/\.mp4$/,`.completed-${report.jobId}.mp4`);
    await fs.copyFile(archived.artifact.path,destination);archived.artifact.path=destination;}
   if(archived.artifact?.frame){const destination=archived.artifact.frame.replace(/\.png$/,`.completed-${report.jobId}.png`);
    await fs.copyFile(archived.artifact.frame,destination);archived.artifact.frame=destination;}
   await fs.writeFile(reportPath.replace(/\.json$/,`.completed-${report.jobId}.json`),JSON.stringify(archived,null,2)+'\n');
   const parent=report.jobId;report.completedParents=[...(report.completedParents||[]),{jobId:parent,revision:previous.revision}];
   report.parentJobId=parent;report.dispatchCommand='revise';
   report.input={...report.input,clipId:previous.clips[0].clipId,expectedRevision:previous.revision,idempotencyKey:crypto.randomUUID()};
   delete report.input.mediaId;delete report.jobId;delete report.artifact;delete report.passed;delete report.observationError;
   report.stages=[];await save();
  }
  const before=await db.sourceVideoJob.count({where:{orgId:report.orgId}});
  const rejected=await runCli(['process','--font-name',"Anton',Outline=0"],token);
  assert.equal(rejected.code,1);assert.match(rejected.stderr,/Invalid caption font name/);
  assert.equal(await db.sourceVideoJob.count({where:{orgId:report.orgId}}),before);
  report.unsafeFontRejectedBeforeJob=true;
  const requestPath=path.join(root,'reports/openshorts-integration/cli-caption-appearance-request.json');
  await fs.writeFile(requestPath,JSON.stringify(report.input)+'\n');
  if(!report.jobId){
   const result=await runCli([...(report.dispatchCommand==='revise'?['revise',report.parentJobId]:['process']),'--input',requestPath,'--style','pop','--position','middle',
    '--font-name','Anton','--font-size','24','--font-color','#FFFF00','--highlight-color','#00FFFF','--uppercase'],token);
   assert.equal(result.code,0,result.stderr);
   const state=JSON.parse(result.stdout.trim().split('\n').at(-1));assert.ok(state.jobId);
   report.jobId=state.jobId;await save();console.log(JSON.stringify({jobId:report.jobId,resumeSameJob:true}));
  }
  const deadline=Date.now()+8*60_000;
  while(Date.now()<deadline){
   const state=await call('sourceVideoStatusTool',{jobId:report.jobId});
   const marker=`${state.status}:${state.stage}:${state.progress}`;
   if(report.stages.at(-1)!==marker){report.stages.push(marker);await save();console.log(marker);}
   if(['failed','cancelled'].includes(state.status)){report.terminalError=state.error;await save();throw new Error(`Caption smoke job ${state.status}: ${state.error}`);}
   if(state.status==='completed'){
    const jobRoot=process.env.SOURCE_VIDEO_JOB_DIRECTORY||path.join(process.env.HOME,'.local/share/nan-team/source-video-jobs');
    const receipt=JSON.parse(await fs.readFile(path.join(jobRoot,report.jobId,'receipt.json'),'utf8'));
    assert.equal(receipt.sourceSha256,report.sourceSha256);
    const expected={...report.input.captions,style:'pop',position:'middle',fontName:'Anton',fontSize:24,
     fontColor:'#FFFF00',highlightColor:'#00FFFF',uppercase:true};assert.deepEqual(receipt.input.captions,expected);
    const clip=receipt.rendered.clips[0];
    if((report.completedParents||[]).length>=2)assert.equal(clip.renderMode,'source-render','Changed synthesized audio must invalidate clean reuse');
    const motion=JSON.parse(await fs.readFile(path.join(path.dirname(clip.path),'motion-receipt.json'),'utf8'));
    const {enabled,style,...appearance}=expected;assert.deepEqual(motion.props.captionAppearance,appearance);
    assert.equal(motion.props.captionStyle,style);assert.ok(motion.props.captions.length>0,'No narration captions reached motion renderer');
    if(report.dispatchCommand==='revise'){
     assert.equal(motion.props.captions.map(word=>word.text).join(' '),report.input.audio.narrationText);
     assert.equal(clip.transcript.timingSource,'generated-narration-ASR-reference');
     assert.equal(clip.transcript.narrationAlignment.phonemeAlignmentVerified,false);
     report.narrationAlignment=clip.transcript.narrationAlignment;
    }
    assert.equal(state.clips.length,1);
    assert.ok(state.clips[0].media?.id,'Published clip lacked its exact Media ID');
    const media=await db.media.findFirst({where:{id:state.clips[0].media.id,organizationId:report.orgId}});assert.ok(media);
    assert.equal(media.status,'ready');
    const relative=decodeURIComponent(new URL(media.path).pathname).replace(/^\/uploads\//,'');
    const storage=path.resolve(process.env.UPLOAD_DIRECTORY),artifact=path.resolve(storage,relative);
    assert.ok(artifact.startsWith(storage+path.sep));
    const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',artifact]));
    const video=metadata.streams.find(stream=>stream.codec_type==='video'),audio=metadata.streams.find(stream=>stream.codec_type==='audio');
    assert.equal(video.width,1080);assert.equal(video.height,1080);assert.ok(audio);
    assert.ok(Math.abs(Number(metadata.format.duration)-4.7)<.2);
    execFileSync('ffmpeg',['-v','error','-xerror','-threads','1','-i',artifact,'-f','null','-']);
    const copy=path.join(root,'reports/openshorts-integration/live-caption-appearance-mcp.mp4');await fs.copyFile(artifact,copy);
    assert.equal(sha(await fs.readFile(copy)),state.clips[0].sha256,'Published Media hash differs from verified clip');
    const frame=path.join(root,'reports/openshorts-integration/live-caption-appearance-mcp.png');
    execFileSync('ffmpeg',['-v','error','-y','-threads','1','-ss','1','-i',artifact,'-frames:v','1','-vf','scale=540:540',frame]);
    report.artifact={mediaId:media.id,path:copy,frame,sha256:sha(await fs.readFile(copy)),
     durationSeconds:Number(metadata.format.duration),audio:true,fullDecode:true,captionCount:motion.props.captions.length,
     deliveredCaptionText:motion.props.captions.map(word=>word.text).join(' '),appearance};
    report.audioIdentity=await audioIdentity(clip,copy);
    report.timingLimitation='Known narration text on worker ASR intervals; not a representative original Vietnamese dialogue, synthesizer pronunciation verification, or phoneme forced-alignment benchmark';
    report.policyDecision={authorization:'user authorized source video verification with existing project Voice Clone',
     videoCpuThreads:1,renderConcurrency:1,frontendStarted:false,scope:'single 4.7-second source edit via authenticated CLI/MCP'};
    report.sourceHashes={};for(const name of ['packages/openshorts-engine/bin/nan-video.cjs',
     'libraries/nestjs-libraries/src/chat/tools/process.source.video.tool.ts','libraries/nestjs-libraries/src/videos/openshorts/source-video.service.ts',
     'packages/remotion-engine/src/components/SourceCaptions.tsx','packages/remotion-engine/src/components/source-caption-model.ts',
     'packages/openshorts-engine/src/rendering.py','packages/openshorts-engine/src/render_phase.py',
     'packages/openshorts-engine/src/narration_reference.py','packages/openshorts-engine/src/checkpoints.py'])
     report.sourceHashes[name]=sha(await fs.readFile(path.join(root,name)));
    report.buildHashes={};for(const name of ['backend','orchestrator'])report.buildHashes[name]=sha(await fs.readFile(path.join(root,`apps/${name}/dist/apps/${name}/src/main.js`)));
    report.passed=true;delete report.observationError;await save();console.log(JSON.stringify(report.artifact));return;
   }
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
  report.observationPaused=true;await save();console.log(JSON.stringify({jobId:report.jobId,observationPaused:true}));
 }catch(error){report.observationError=error.message;await save();throw error;}
 finally{await client.close().catch(()=>{});if(temporaryKey)await db.organization.updateMany({where:{id:report.orgId,apiKey:temporaryKey},data:{apiKey:null}});await db.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
