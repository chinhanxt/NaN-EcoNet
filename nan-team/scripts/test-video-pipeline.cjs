const assert = require('node:assert/strict');
const {readFile,writeFile,mkdir,copyFile} = require('node:fs/promises');
const {resolve,join} = require('node:path');
const {createHash,randomUUID} = require('node:crypto');
const {execFileSync} = require('node:child_process');
require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const {sign} = require('jsonwebtoken');
const directory = resolve('reports/video-pipeline');
const api = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const prisma = new PrismaClient();
async function main() {
  await mkdir(directory,{recursive:true});
  const user = await prisma.user.findFirst({where:{activated:true,organizations:{some:{disabled:false}}},select:{id:true,organizations:{where:{disabled:false},select:{organizationId:true},take:1}}});
  assert(user,'No activated local user with an organization');
  const orgId = user.organizations[0].organizationId;
  const headers = {'Content-Type':'application/json',auth:sign({id:user.id},process.env.JWT_SECRET,{expiresIn:'1h'}),showorg:orgId};
  const board = JSON.parse(await readFile(join(directory,'storyboard.json'),'utf8'));
  const {title,targetDuration,voice,scenes} = board;
  const unauth = await fetch(api+'/ai-video/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,targetDuration,voice,scenes})});
  assert([401,403].includes(unauth.status),'Video rendering must require authentication');
  const invalid = await fetch(api+'/ai-video/render',{method:'POST',headers,body:JSON.stringify({title,targetDuration:20,voice,scenes})});
  assert.equal(invalid.status,400,'Unsupported duration must be rejected');
  const missing = await fetch(api+'/ai-video/status/'+randomUUID(),{headers});
  assert.equal(missing.status,404,'Unknown job must not disclose data');
  let started;
  if(process.argv.includes('--resume-job')) {
    started=JSON.parse(await readFile(join(directory,'active-job.json'),'utf8'));
  } else {
    const response = await fetch(api+'/ai-video/render',{method:'POST',headers,body:JSON.stringify({title,targetDuration,voice,scenes})});
    started = await response.json();
    assert(response.ok,JSON.stringify(started));
  }
  assert(started.jobId,'Render must return a real jobId');
  await writeFile(join(directory,'active-job.json'),JSON.stringify(started,null,2));
  console.log('Rendering real AGY storyboard, job '+started.jobId);
  let state,lastStage;
  const deadline=Date.now()+21*60*1000;
  while(Date.now()<deadline){
    let poll;
    try {
      poll=await fetch(api+'/ai-video/status/'+started.jobId,{headers,signal:AbortSignal.timeout(15000)});
      if([429,502,503,504].includes(poll.status))throw new Error('Temporary status HTTP '+poll.status);
    } catch(error) {
      console.log('Reconnecting to the same live video job:',error.message);
      await new Promise(done=>setTimeout(done,5000));
      continue;
    }
    assert(poll.ok,'Status request failed HTTP '+poll.status);
    state=await poll.json();
    if(state.stage!==lastStage){console.log(new Date().toISOString(),state.stage,state.progress+'%');lastStage=state.stage;}
    await writeFile(join(directory,'job-status.json'),JSON.stringify(state,null,2));
    if(['completed','failed'].includes(state.status))break;
    await new Promise(done=>setTimeout(done,2000));
  }
  assert.equal(state.status,'completed',state.error||'Video generation did not complete');
  const media=await prisma.media.findFirst({where:{id:state.media.id,organizationId:orgId}});
  assert(media&&media.path===state.media.path,'Saved video must exist in the correct tenant media library');
  const download=await fetch(state.media.path);
  assert(download.ok,'Saved video is not playable from its actual media URL');
  const output=join(directory,'mot-buoi-sang-xanh-sai-gon.mp4');
  const bytes=Buffer.from(await download.arrayBuffer());
  assert(bytes.length>100000,'Video artifact is unexpectedly small');
  await writeFile(output,bytes);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',output],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video');
  const audio=probe.streams.find(s=>s.codec_type==='audio');
  assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.avg_frame_rate,'30/1');
  assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(Number(video.nb_read_frames),900);
  assert.equal(audio.codec_name,'aac');assert(Math.abs(Number(video.duration)-30)<0.001);
  // AAC encoding may add up to a few packets of priming/padding to the container.
  assert(Math.abs(Number(probe.format.duration)-30)<0.1);
  execFileSync('ffmpeg',['-nostdin','-v','error','-i',output,'-f','null','-'],{stdio:'pipe'});
  const jobs=process.env.AI_VIDEO_JOB_DIRECTORY||'/tmp/nan-ai-video-jobs';
  for(const kind of ['inputs','renderer','output'])await copyFile(join(jobs,`${started.jobId}.${kind}.json`),join(directory,`${kind}-evidence.json`));
  const inputs=JSON.parse(await readFile(join(directory,'inputs-evidence.json'),'utf8'));
  assert.equal(inputs.tts.durationInFrames,900);assert.equal(inputs.tts.sceneTimings.length,5);
  assert(inputs.tts.captions.length>=70,'Expected real word captions from the narration');
  assert(inputs.tts.captions.every(c=>c.startMs>=0&&c.endMs>c.startMs&&c.endMs<=30000));
  const evidence={at:new Date().toISOString(),jobId:started.jobId,mediaId:media.id,mediaUrl:media.path,artifact:output,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,topic:title,scenes:5,captionWords:inputs.tts.captions.length,authChecks:{unauthenticated:unauth.status,invalidDuration:invalid.status,missingJob:missing.status},probe};
  await writeFile(join(directory,'verification.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({artifact:output,seconds:probe.format.duration,frames:video.nb_read_frames,captionWords:inputs.tts.captions.length,mediaUrl:media.path}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
