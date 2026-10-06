'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');const jwt=require('jsonwebtoken');
(async()=>{
 const root=path.resolve(__dirname,'..');const source=path.join(root,'reports/openshorts-integration/fixtures/vietnamese-source-18s.mp4');
 const uploadRoot=process.env.UPLOAD_DIRECTORY;const base=process.env.FRONTEND_URL;
 if(!path.isAbsolute(uploadRoot)||!base||!process.env.JWT_SECRET)throw Error('Local fixture environment missing');
 const prisma=new PrismaClient(),id=crypto.randomUUID(),name=`source-live-${id}`;
 const relative=`source-video-fixtures/${id}.mp4`,target=path.join(uploadRoot,relative);
 const receiptPath=path.join(root,'reports/openshorts-integration/live-source-job.json');
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);
 const organization=await prisma.organization.create({data:{name}});
 const user=await prisma.user.create({data:{email:`${id}@fixture.invalid`,providerName:'LOCAL',timezone:7,activated:true}});
 await prisma.userOrganization.create({data:{userId:user.id,organizationId:organization.id,role:'ADMIN'}});
 const token=jwt.sign({id:user.id},process.env.JWT_SECRET);
 const headers={'content-type':'application/json','cookie':`auth=${token}`,'showorg':organization.id};
 const media=await prisma.media.create({data:{organizationId:organization.id,name:relative,path:`${base}/uploads/${relative}`,originalName:'vietnamese-source-18s.mp4',type:'video',status:'ready',fileSize:(await fs.stat(target)).size}});
 const input={mediaId:media.id,idempotencyKey:id,operation:'clips',aspectRatio:'16:9',selection:{count:1,minSeconds:10,maxSeconds:18},captions:{enabled:true,style:'classic'},hook:{enabled:false},audio:{mode:'keep'},reviewBeforeRender:false};
 const start=await fetch('http://127.0.0.1:3000/ai-video/source-jobs',{method:'POST',headers,body:JSON.stringify(input)});const body=await start.json();
 if(!start.ok||!body.jobId)throw Error(`Create failed: ${start.status} ${JSON.stringify(body).slice(0,500)}`);
 const rec={sourceFixture:source,sourceSha256:crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex'),orgId:organization.id,userId:user.id,sourceMediaId:media.id,jobId:body.jobId,workflowId:body.workflowId,stages:[]};
 await fs.writeFile(receiptPath,JSON.stringify(rec,null,2),{mode:0o600});console.log(JSON.stringify({jobId:body.jobId,workflowId:body.workflowId,receiptPath}));
 for(let i=0;i<300;i++){
  await new Promise(r=>setTimeout(r,2000));const response=await fetch(`http://127.0.0.1:3000/ai-video/source-jobs/${body.jobId}`,{headers});const state=await response.json();
  const current=`${state.status}:${state.stage}:${state.progress}`;
  if(rec.stages.at(-1)!==current){rec.stages.push(current);console.log(current);await fs.writeFile(receiptPath,JSON.stringify(rec,null,2),{mode:0o600});}
  if(['completed','failed','cancelled'].includes(state.status)){
   rec.final={status:state.status,stage:state.stage,error:state.error,warnings:state.warnings,clips:state.clips};await fs.writeFile(receiptPath,JSON.stringify(rec,null,2),{mode:0o600});
   if(state.status!=='completed')throw Error(`Job ${state.status}: ${state.error||'no error'}`);
   if(!state.clips?.length||!state.clips[0].media?.id)throw Error('No saved Media');
   console.log(JSON.stringify({status:state.status,clips:state.clips.map(c=>({clipId:c.clipId,mediaId:c.media.id,path:c.media.path,sha256:c.sha256}))}));break;
  }
  if(i===299)throw Error('Job did not reach terminal state within 10 minutes');
 }
 await prisma.$disconnect();
})().catch(error=>{console.error(error.message);process.exitCode=1;});
