'use strict';
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createServer}=require('node:http');
const {spawn}=require('node:child_process');
const {PrismaService}=require('../apps/backend/dist/libraries/nestjs-libraries/src/database/prisma/prisma.service.js');
const {SourceVideoRepository}=require('../apps/backend/dist/libraries/nestjs-libraries/src/videos/openshorts/source-video.repository.js');
const {SourceVideoWebhookService}=require('../apps/backend/dist/libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook.service.js');
const {sourceWebhookSignature}=require('../apps/backend/dist/libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook.js');
const root=path.resolve(__dirname,'..');

async function worker(){
 const prisma=new PrismaService();
 class LoopbackFixtureSender extends SourceVideoWebhookService {
  async claim(now){
   assert.equal(await prisma.sourceVideoWebhookDelivery.count({where:{orgId:{not:process.env.WEBHOOK_FIXTURE_ORG},status:{in:['pending','sending']}}}),0,'Fixture refuses to claim another organization callback');
   return super.claim(now);
  }
  async post(_target,body,headers,signal){
   const destination=new URL(process.env.WEBHOOK_FIXTURE_RECEIVER);
   assert.equal(destination.hostname,'127.0.0.1');assert.equal(destination.protocol,'http:');
   const response=await fetch(destination,{method:'POST',body,headers,signal,redirect:'manual'});await response.body?.cancel();return response.status;
  }
  async acknowledge(row,status,error,now){
   if(process.env.WEBHOOK_FIXTURE_CRASH==='true'&&status>=200&&status<300){process.kill(process.pid,'SIGKILL');return false;}
   return super.acknowledge(row,status,error,now);
  }
 }
 try{assert.equal(await new LoopbackFixtureSender(prisma).deliverNext(),true);}
 finally{await prisma.$disconnect();}
}
async function main(){
 const prisma=new PrismaService();let receiver,directory,orgId;
 const key=crypto.randomBytes(32).toString('hex'),messages=[];let responseStatus=503;
 process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
 try{
  assert.equal(await prisma.sourceVideoWebhookDelivery.count({where:{status:{in:['pending','sending']}}}),0,'Fixture refuses to compete with an existing callback');
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'source-webhook-restart-'));process.env.SOURCE_VIDEO_JOB_DIRECTORY=directory;
  orgId=(await prisma.organization.create({data:{name:'source-webhook-process-fixture-'+crypto.randomUUID()}})).id;
  const repository=new SourceVideoRepository(prisma),receipt=await repository.create(orgId,{mediaId:'fixture-source',webhook:{url:'https://8.8.8.8/callback?fixture=private',secret:key}}),jobId=receipt.state.jobId;
  await repository.fenceTerminal(orgId,jobId,'failed');receipt.state.status='failed';receipt.state.stage='failed';await repository.save(receipt);
  receiver=createServer(async(req,res)=>{const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts).toString('utf8');assert.equal(req.headers['x-openshorts-signature'],sourceWebhookSignature(body,key));assert.equal(req.headers['x-openshorts-event-id'],jobId);messages.push({body,signature:req.headers['x-openshorts-signature'],eventId:req.headers['x-openshorts-event-id']});res.writeHead(responseStatus);res.end();});
  await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  const receiverUrl=`http://127.0.0.1:${receiver.address().port}/callback`;
  const run=crash=>new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--max-old-space-size=512',__filename,'--worker'],{cwd:root,env:{...process.env,WEBHOOK_FIXTURE_ORG:orgId,WEBHOOK_FIXTURE_RECEIVER:receiverUrl,WEBHOOK_FIXTURE_CRASH:String(crash)},stdio:['ignore','ignore','pipe'],timeout:20000,killSignal:'SIGKILL'});
   let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal,stderr}));
  });
  assert.equal((await run(false)).code,0);
  const retry=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId}});
  assert.equal(retry.status,'pending');assert.equal(retry.attempts,1);assert.ok(retry.nextAttemptAt.getTime()>Date.now()+3500);
  await prisma.sourceVideoWebhookDelivery.update({where:{jobId},data:{nextAttemptAt:new Date(0)}});responseStatus=200;
  const crashed=await run(true);assert.equal(crashed.signal,'SIGKILL');assert.equal(messages.length,2);
  const afterCrash=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId}});assert.equal(afterCrash.status,'sending');assert.equal(afterCrash.attempts,2);
  await prisma.sourceVideoWebhookDelivery.update({where:{jobId},data:{leaseUntil:new Date(0)}});responseStatus=204;
  assert.equal((await run(false)).code,0);
  const recovered=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId}});assert.equal(recovered.status,'delivered');assert.equal(recovered.attempts,3);assert.equal(messages.length,3);
  assert.ok(messages.every(message=>message.body===messages[0].body&&message.signature===messages[0].signature&&message.eventId===jobId));
  const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');const sourceFiles={},buildFiles={};
  for(const relative of ['libraries/nestjs-libraries/src/videos/openshorts/source-video.repository.ts','libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook.ts','libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook.service.ts'])sourceFiles[relative]=sha(await fs.readFile(path.join(root,relative)));
  for(const name of ['source-video.repository.js','source-video.webhook.js','source-video.webhook.service.js']){const relative='apps/backend/dist/libraries/nestjs-libraries/src/videos/openshorts/'+name;buildFiles[relative]=sha(await fs.readFile(path.join(root,relative)));}
  const report={kind:'source-bound-signed-webhook-process-restart',observedAt:new Date().toISOString(),orgId,jobId,retryStatus:503,crashSignal:crashed.signal,stateAfterCrash:afterCrash.status,finalStatus:recovered.status,attempts:recovered.attempts,receiverRequests:messages.length,identicalBodySignatureAndEventId:true,bodySha256:sha(messages[0].body),retryDelayPersisted:true,clockAdvancement:'fixture advances persisted nextAttemptAt and expired lease to avoid waiting',transport:'test-only loopback mapping; production public HTTPS/DNS guards tested independently',sourceFiles,buildFiles,policyDecision:{decision:'allow',authority:'user authorized local integration and low-load verification',scope:'test-owned job and loopback receiver only; no external callback, rendering or release'}};
  await fs.writeFile(path.join(root,'reports/openshorts-integration/live-webhook-process-restart.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{
  if(orgId)await prisma.sourceVideoWebhookDelivery.updateMany({where:{orgId,status:{notIn:['delivered','exhausted']}},data:{status:'exhausted',leaseOwner:null,leaseUntil:null}});
  if(receiver)await new Promise(resolve=>receiver.close(resolve));await prisma.$disconnect();if(directory)await fs.rm(directory,{recursive:true,force:true});
 }
}
(process.argv.includes('--worker')?worker():main()).catch(error=>{console.error(error.message);process.exitCode=1});
