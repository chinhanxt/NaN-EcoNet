import { createServer, Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../libraries/nestjs-libraries/src/database/prisma/prisma.service';
import { SourceVideoRepository } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.repository';
import { SourceVideoWebhookService } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook.service';
import { sourceWebhookSignature } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook';
const databaseUrl=process.env.SOURCE_VIDEO_DB_TEST_URL;
const describeDatabase=databaseUrl?describe:describe.skip;
describeDatabase('PostgreSQL webhook outbox, fencing and restart contract',()=>{
 let prisma:PrismaService,repository:SourceVideoRepository,orgId:string,root:string,receiver:Server,receiverUrl:string;
 let responseCode=500;
 const messages:{body:string;headers:Record<string,any>}[]=[];
 const signingKey='test-signing-secret-32-bytes-long';
 const oldKey=process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY;
 class FixtureSender extends SourceVideoWebhookService {
  constructor(){super(prisma);}
  async claim(now?:Date){
   expect(await prisma.sourceVideoWebhookDelivery.count({where:{orgId:{not:orgId},status:{in:['pending','sending']}}})).toBe(0);
   return super.claim(now);
  }
  protected async post(_target:string,body:string,headers:Record<string,string>,signal:AbortSignal){
   // Test-only mapping to a loopback receiver; the production public HTTPS
   // transport is tested independently and has no runtime bypass setting.
   const response=await fetch(receiverUrl,{method:'POST',body,headers,signal,redirect:'manual'});
   await response.body?.cancel();return response.status;
  }
 }
 const job=()=>repository.create(orgId,{mediaId:'fixture-source',webhook:{url:'https://8.8.8.8/callback?token=private-target-token',secret:signingKey}});
 const failed=async()=>{const receipt=await job();await repository.fenceTerminal(orgId,receipt.state.jobId,'failed');receipt.state.status='failed';receipt.state.stage='failed';await repository.save(receipt);return receipt;};
 const due=(jobId:string)=>prisma.sourceVideoWebhookDelivery.update({where:{jobId},data:{nextAttemptAt:new Date(0)}});
 beforeAll(async()=>{
  process.env.DATABASE_URL=databaseUrl;process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY='fixture-webhook-encryption-key-32-bytes';
  root=await mkdtemp(join(tmpdir(),'source-webhook-db-'));process.env.SOURCE_VIDEO_JOB_DIRECTORY=root;
  prisma=new PrismaService();await prisma.$connect();repository=new SourceVideoRepository(prisma);
  const org=await prisma.organization.create({data:{name:`source-webhook-fixture-${randomUUID()}`}});orgId=org.id;
  receiver=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));messages.push({body:Buffer.concat(chunks).toString('utf8'),headers:req.headers});res.writeHead(responseCode);res.end();});
  await new Promise<void>(resolve=>receiver.listen(0,'127.0.0.1',resolve));receiverUrl=`http://127.0.0.1:${(receiver.address() as any).port}/callback`;
 });
 beforeEach(()=>{messages.length=0;responseCode=500;});
 afterEach(async()=>{await prisma.sourceVideoWebhookDelivery.updateMany({where:{orgId,status:{notIn:['delivered','exhausted']}},data:{status:'exhausted',leaseOwner:null,leaseUntil:null}});await prisma.sourceVideoJob.updateMany({where:{orgId,status:{notIn:['completed','failed','cancelled']}},data:{status:'failed'}});});
 afterAll(async()=>{
  console.info(JSON.stringify({fixture:'source-webhook-db-contract',orgId,transport:'test-only loopback receiver; production transport guards verified separately'}));
  if(receiver)await new Promise<void>(resolve=>receiver.close(()=>resolve()));
  if(prisma)await prisma.$disconnect();if(root)await rm(root,{recursive:true,force:true});
  if(oldKey===undefined)delete process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY;else process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY=oldKey;
 });
 it('atomically freezes a terminal outbox and keeps callback credentials out of receipts and revisions',async()=>{
  const receipt=await job(),id=receipt.state.jobId;
  let outbox=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}});
  expect(outbox.status).toBe('waiting');expect(outbox.payload).toBeNull();expect(await new FixtureSender().claim()).toBeUndefined();
  expect(JSON.stringify(receipt)).not.toMatch(/private-target-token|test-signing-secret/);
  expect(JSON.stringify((await prisma.sourceVideoRevision.findUniqueOrThrow({where:{jobId:id}})).input)).not.toMatch(/webhook|private-target-token|test-signing-secret/);
  expect(outbox.targetCiphertext).not.toContain('private-target-token');expect(outbox.secretCiphertext).not.toContain(signingKey);
  await repository.fenceTerminal(orgId,id,'completed');receipt.state.status='completed';receipt.state.stage='completed';
  receipt.state.clips=[{clipId:'invalid',media:null} as any];
  await expect(repository.save(receipt)).rejects.toThrow();
  expect((await prisma.sourceVideoJob.findUniqueOrThrow({where:{id}})).status).toBe('queued');
  expect((await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}})).status).toBe('waiting');
  const media=await prisma.media.create({data:{organizationId:orgId,name:'webhook-fixture.mp4',path:'https://storage.example/fixture.mp4',status:'ready',type:'video'}});
  receipt.state.clips=[{clipId:'fixture',title:'Tiếng Việt',durationSeconds:4.8,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:4.8}],media:{id:media.id,path:media.path},sha256:'fixture'}];
  await Promise.all([repository.save(receipt),new SourceVideoRepository(prisma).save(receipt)]);
  outbox=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}});
  expect(outbox.status).toBe('pending');expect(await prisma.sourceVideoWebhookDelivery.count({where:{jobId:id}})).toBe(1);
  expect(JSON.parse(outbox.payload!)).toMatchObject({event:'job.completed',clips:[{title:'Tiếng Việt',video_url:media.path,duration:4.8}]});
  expect(await readFile(join(repository.path(id),'receipt.json'),'utf8')).not.toMatch(/webhook|private-target-token|test-signing-secret/);
  expect(await repository.webhookStatus(randomUUID(),id)).toBeUndefined();
  const divergent=structuredClone(receipt);divergent.state.clips[0].title='Changed after completion';
  await expect(repository.save(divergent)).rejects.toThrow('immutable');
  expect((await repository.get(orgId,id)).state.clips[0].title).toBe('Tiếng Việt');
  expect((await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}})).payload).toBe(outbox.payload);
  const revision=await repository.create(orgId,{mediaId:'fixture-source'},receipt,1,{clipId:'fixture'});
  expect(await prisma.sourceVideoWebhookDelivery.findUnique({where:{jobId:revision.state.jobId}})).toBeNull();
 });
 it('persists retry timing and sends identical signed bytes after dispatcher restart',async()=>{
  const receipt=await failed(),id=receipt.state.jobId;
  expect(await new FixtureSender().deliverNext()).toBe(true);
  const first=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}});
  expect(first.status).toBe('pending');expect(first.attempts).toBe(1);expect(first.lastStatusCode).toBe(500);
  expect(first.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()+4000);
  const restarted=new FixtureSender();expect(await restarted.claim()).toBeUndefined();
  await due(id);responseCode=204;expect(await restarted.deliverNext()).toBe(true);
  const delivered=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}});
  expect(delivered.status).toBe('delivered');expect(delivered.attempts).toBe(2);expect(messages).toHaveLength(2);
  expect(messages[1].body).toBe(messages[0].body);
  for(const message of messages){expect(message.headers['x-openshorts-signature']).toBe(sourceWebhookSignature(message.body,signingKey));expect(message.headers['x-openshorts-event-id']).toBe(id);}
  expect(await restarted.deliverNext()).toBe(false);
 });
 it('grants one concurrent lease and fences an expired owner from acknowledging',async()=>{
  const receipt=await failed(),id=receipt.state.jobId;
  const one=new FixtureSender(),two=new FixtureSender();
  const claimed=await Promise.all([one.claim(),two.claim()]);expect(claimed.filter(Boolean)).toHaveLength(1);const old=claimed.find(Boolean)!;
  await prisma.sourceVideoWebhookDelivery.update({where:{jobId:id},data:{leaseUntil:new Date(0)}});
  const current=(await two.claim())!;expect(current.epoch).toBeGreaterThan(old.epoch);
  expect(await one.acknowledge(old,200)).toBe(false);expect(await two.acknowledge(current,200)).toBe(true);
  expect((await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}})).status).toBe('delivered');
 });
 it('redelivers after receiver success and lost acknowledgement with the same event ID',async()=>{
  const receipt=await failed(),id=receipt.state.jobId;responseCode=200;
  class LostAcknowledgement extends FixtureSender {async acknowledge():Promise<boolean>{throw new Error('simulated process death before acknowledgement');}}
  await expect(new LostAcknowledgement().deliverNext()).rejects.toThrow('simulated process death');
  expect((await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}})).status).toBe('sending');
  await prisma.sourceVideoWebhookDelivery.update({where:{jobId:id},data:{leaseUntil:new Date(0)}});
  expect(await new FixtureSender().deliverNext()).toBe(true);
  expect(messages).toHaveLength(2);expect(messages[1]).toMatchObject({body:messages[0].body,headers:{'x-openshorts-event-id':id}});
 });
 it('retains exhaustion after three HTTP failures and stops sending',async()=>{
  const receipt=await failed(),id=receipt.state.jobId,sender=new FixtureSender();
  for(let attempt=1;attempt<=3;attempt++){await due(id);expect(await sender.deliverNext()).toBe(true);const saved=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}});expect(saved.attempts).toBe(attempt);if(attempt===2)expect(saved.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()+29000);}
  const saved=await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}});expect(saved.status).toBe('exhausted');expect(messages).toHaveLength(3);expect(await new FixtureSender().deliverNext()).toBe(false);
 });
 it('deduplicates callback requests and maps cancellation without exposing compensated clips',async()=>{
  const input={mediaId:'fixture-source',idempotencyKey:randomUUID(),webhook:{url:'https://8.8.8.8/callback',secret:signingKey}};
  const receipt=await repository.create(orgId,input),id=receipt.state.jobId;
  expect((await new SourceVideoRepository(prisma).create(orgId,input)).state.jobId).toBe(id);
  const encryption=process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY,jwt=process.env.JWT_SECRET;
  delete process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY;delete process.env.JWT_SECRET;
  try{expect((await new SourceVideoRepository(prisma).create(orgId,input)).state.jobId).toBe(id);}finally{process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY=encryption;if(jwt!==undefined)process.env.JWT_SECRET=jwt;}
  await expect(repository.create(orgId,{...input,webhook:{...input.webhook,secret:'different-shared-signing-secret'}})).rejects.toThrow('another request');
  expect(await prisma.sourceVideoWebhookDelivery.count({where:{jobId:id}})).toBe(1);
  await repository.fenceTerminal(orgId,id,'cancelled');receipt.state.status='cancelled';receipt.state.stage='cancelled';receipt.state.clips=[];await repository.save(receipt);
  expect(JSON.parse((await prisma.sourceVideoWebhookDelivery.findUniqueOrThrow({where:{jobId:id}})).payload!)).toEqual({event:'job.failed',job_id:id,status:'cancelled',clips:[],error:'Source video cancelled'});
 });
 it('retains only a bounded error code when a network request throws credential-bearing detail',async()=>{
  const receipt=await failed(),id=receipt.state.jobId;
  class NetworkFailure extends FixtureSender {protected async post():Promise<number>{throw new Error('Bearer private-token https://private-target-token');}}
  expect(await new NetworkFailure().deliverNext()).toBe(true);
  const state=await repository.webhookStatus(orgId,id);expect(state).toMatchObject({status:'pending',attempts:1,lastError:'network_error'});
  expect(JSON.stringify(state)).not.toMatch(/private-token|private-target-token|Bearer/);
 });
});
