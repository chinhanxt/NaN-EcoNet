'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{PrismaClient}=require('@prisma/client');
const {uploadSourceFile}=require('../packages/openshorts-engine/bin/nan-video.cjs');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const source='/home/chinhan/Downloads/Screencast from 2026-09-30 14-27-11 (online-video-cutter.com).mp4';
const location=path.join(root,'reports/openshorts-integration/live-user-conversation-mcp.json');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
 const existing=await fs.readFile(location,'utf8').then(JSON.parse).catch(e=>{if(e.code!=='ENOENT')throw e;});
 if(existing){assert.equal(existing.sourcePath,source);console.log('Existing receipt preserved; resume the recorded MCP job');return;}
 const fixture=require('../reports/openshorts-integration/live-source-job.json');
 const sourceSha256=hash(await fs.readFile(source));
 assert.equal(sourceSha256,'bfc779104ba7d791ee5fa6b01586ec8dc93a05bc14a4a6d3d916eff500157d0b');
 const db=new PrismaClient();let temporaryKey;
 try{
  const org=await db.organization.findUniqueOrThrow({where:{id:fixture.orgId},select:{apiKey:true}});
  if(!org.apiKey){temporaryKey=crypto.randomBytes(32).toString('hex');assert.equal((await db.organization.updateMany({where:{id:fixture.orgId,apiKey:null},data:{apiKey:temporaryKey}})).count,1);}
  const uploaded=await uploadSourceFile(source,'http://127.0.0.1:3000/mcp',temporaryKey||org.apiKey);
  const media=await db.media.findFirstOrThrow({where:{id:uploaded.mediaId,organizationId:fixture.orgId}});
  assert.equal(media.status,'ready');
  const report={kind:'authenticated-real-user-silent-conversation-MCP',orgId:fixture.orgId,
   sourcePath:source,sourceSha256,sourceMediaId:uploaded.mediaId,stages:[],expectedTitle:'Cuộc trò chuyện bên bờ biển',
   expectedDurationSeconds:11.9,expectedAudio:false,
   input:{mediaId:uploaded.mediaId,idempotencyKey:crypto.randomUUID(),operation:'edit',aspectRatio:'9:16',
    layout:'auto',segments:[{startSeconds:0,endSeconds:11.9}],captions:{enabled:false},audio:{mode:'keep'},
    hook:{enabled:true,style:'pill',durationSeconds:3},reviewBeforeRender:true,effects:[],
    motionDesign:{enabled:false,theme:'clean',transitions:'none'}},
   policyDecision:{authorization:'user supplied this local video for integration acceptance',sourceUnchanged:true,
    upload:'existing authenticated streaming CLI upload implementation',maxConcurrentSourceJobs:1,
    release:false,socialPublish:false,modelDownload:false},
   limitations:['No source audio stream: original dialogue ASR, word synchronization and audio speaker attribution remain unverified.',
    'This is real conversation footage captured from a video, not a software screencast or presentation.']};
  await fs.writeFile(location,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({report:location,sourceMediaId:uploaded.mediaId,sourceSha256}));
 }finally{
  if(temporaryKey)await db.organization.updateMany({where:{id:fixture.orgId,apiKey:temporaryKey},data:{apiKey:null}});
  await db.$disconnect();
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
