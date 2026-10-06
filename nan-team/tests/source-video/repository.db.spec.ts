import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../libraries/nestjs-libraries/src/database/prisma/prisma.service';
import { SourceVideoRepository } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.repository';
const databaseUrl=process.env.SOURCE_VIDEO_DB_TEST_URL;
const describeDatabase=databaseUrl?describe:describe.skip;
describeDatabase('PostgreSQL source job recovery and publication contract',()=>{
 let prisma:PrismaService,repository:SourceVideoRepository,orgId:string,root:string;
 const retainedMediaIds:string[]=[];
 beforeAll(async()=>{
  process.env.DATABASE_URL=databaseUrl;root=await mkdtemp(join(tmpdir(),'source-db-fixture-'));process.env.SOURCE_VIDEO_JOB_DIRECTORY=root;
  prisma=new PrismaService();await prisma.$connect();repository=new SourceVideoRepository(prisma);
  const organization=await prisma.organization.create({data:{name:`source-video-db-fixture-${randomUUID()}`}});orgId=organization.id;
 });
 afterAll(async()=>{
  if(!prisma)return;
  // Keep exact test-owned Media rows for integration-owner evidence review; no existing tenant is touched.
  console.info(JSON.stringify({fixture:'source-video-db-contract',orgId,mediaIds:retainedMediaIds}));
  try{
   if(orgId)await prisma.sourceVideoJob.updateMany({where:{orgId,status:{notIn:['completed','failed','cancelled']}},data:{status:'completed'}});
  }finally{await prisma.$disconnect();if(root)await rm(root,{recursive:true,force:true});}
 });
 it('enforces request idempotency in the database across repository/process re-instantiation',async()=>{
  const key=randomUUID(),input={mediaId:'fixture-source',idempotencyKey:key};
  const one=await repository.create(orgId,input),restarted=new SourceVideoRepository(prisma),two=await restarted.create(orgId,input);
  expect(two.state.jobId).toBe(one.state.jobId);expect(await prisma.sourceVideoJob.count({where:{orgId,idempotencyKey:key}})).toBe(1);
  await expect(restarted.create(orgId,{...input,aspectRatio:'1:1'})).rejects.toThrow('another request');
  await prisma.sourceVideoJob.update({where:{id:one.state.jobId},data:{status:'completed'}});
 });
 it('reconciles a lost Temporal start acknowledgement after the job entered running state',async()=>{
  const receipt=await repository.create(orgId,{mediaId:'fixture-source'}),id=receipt.state.jobId;
  await prisma.sourceVideoJob.update({where:{id},data:{status:'running',stage:'analyzing',workflowStarted:false}});
  expect((await new SourceVideoRepository(prisma).pendingStarts()).some(row=>row.id===id)).toBe(true);
  await repository.markStarted(orgId,id);
  expect((await repository.pendingStarts()).some(row=>row.id===id)).toBe(false);
  await prisma.sourceVideoJob.update({where:{id},data:{status:'completed'}});
 });
 it('atomically rejects two concurrent revisions against the same expected project version',async()=>{
  const parent=await repository.create(orgId,{mediaId:'fixture-source'});await prisma.sourceVideoJob.update({where:{id:parent.state.jobId},data:{status:'completed'}});
  const results=await Promise.allSettled([repository.create(orgId,{operation:'edit',mediaId:'fixture-source'},parent,1),repository.create(orgId,{operation:'edit',mediaId:'fixture-source'},parent,1)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  await prisma.sourceVideoJob.updateMany({where:{orgId,projectId:parent.state.projectId},data:{status:'completed'}});
 });
 it('journals storage before publication and commits one deterministic Media row after simulated lost activity acknowledgement',async()=>{
  const receipt=await repository.create(orgId,{mediaId:'fixture-source'}),id=receipt.state.jobId;
  const first=await repository.acquire(orgId,id,'worker-before-restart');
  await repository.clip(first,{clipId:'clip',title:'Database boundary fixture',durationSeconds:12,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:12}]},join(root,'verified-fixture.mp4'),'fixture-hash');
  const key=`source-video/${orgId}/${id}/fixture.mp4`,path=`https://fixture.invalid/${key}`;
  const prepared=await repository.reserve(first,'clip','fixture-hash',key,path);
  expect(await prisma.media.findUnique({where:{id:prepared.mediaId}})).toBeNull();
  const saved=await repository.commit(first,prepared,'Database boundary fixture');retainedMediaIds.push(saved.id);
  await repository.release(first);
  const afterRestart=new SourceVideoRepository(prisma),second=await afterRestart.acquire(orgId,id,'worker-after-restart');
  const journal=await afterRestart.reserve(second,'clip','fixture-hash',key,path);expect(journal.status).toBe('committed');
  const recovered=await afterRestart.commit(second,journal,'Database boundary fixture');expect(recovered.id).toBe(saved.id);
  expect(await prisma.media.count({where:{id:saved.id}})).toBe(1);expect(await prisma.sourceVideoPublication.count({where:{orgId,jobId:id}})).toBe(1);
  await afterRestart.release(second);await prisma.sourceVideoJob.update({where:{id},data:{status:'completed'}});
 });
 it('fences the previous worker epoch and keeps tenant reads isolated',async()=>{
  const receipt=await repository.create(orgId,{mediaId:'fixture-source'}),id=receipt.state.jobId,old=await repository.acquire(orgId,id,'old-worker');
  await prisma.sourceVideoJob.update({where:{id},data:{leaseUntil:new Date(0)}});const current=await repository.acquire(orgId,id,'current-worker');
  await expect(repository.save(receipt,old)).rejects.toThrow('fenced');await expect(repository.commit(old,{id:'x',orgId,jobId:id,clipId:'clip',mediaId:'x',storageKey:'x',storagePath:'x',sha256:'x',status:'prepared',epoch:old.epoch},'fixture')).rejects.toThrow('fenced');
  await expect(repository.get(randomUUID(),id)).rejects.toThrow('not found');await repository.release(current);await prisma.sourceVideoJob.update({where:{id},data:{status:'completed'}});
 });
 it('commits a plan and its revision checkpoint together across repository restart',async()=>{
  const receipt=await repository.create(orgId,{mediaId:'fixture-source'});
  const lease=await repository.acquire(orgId,receipt.state.jobId,'plan-worker');
  const plan={version:1,planVersion:1,clips:[] as any[],sourceFingerprint:'source-hash',engineFingerprint:'engine-hash',requestFingerprint:'request-hash'};
  await repository.plan(receipt,plan as any,lease);
  const restarted=new SourceVideoRepository(prisma);
  const recovered=await restarted.get(orgId,receipt.state.jobId);
  const revision=await prisma.sourceVideoRevision.findFirstOrThrow({where:{jobId:receipt.state.jobId,orgId}});
  expect(recovered.plan?.planVersion).toBe(1);expect(revision.planVersion).toBe(1);
  expect(revision.plan).toMatchObject({sourceFingerprint:'source-hash'});
  await repository.release(lease);await prisma.sourceVideoJob.update({where:{id:receipt.state.jobId},data:{status:'completed'}});
 });
 it('fences an expired lease and retains failed finalization intent for reconciliation',async()=>{
  const receipt=await repository.create(orgId,{mediaId:'fixture-source'});
  const lease=await repository.acquire(orgId,receipt.state.jobId,'expired-worker');
  await prisma.sourceVideoJob.update({where:{id:receipt.state.jobId},data:{leaseUntil:new Date(0)}});
  await expect(repository.renew(lease)).rejects.toThrow('fenced');
  await expect(repository.save(receipt,lease)).rejects.toThrow('fenced');
  await repository.fenceTerminal(orgId,receipt.state.jobId,'failed','render failed');
  const pending=await repository.pendingFinalizations();
  expect(pending.some(row=>row.id===receipt.state.jobId)).toBe(true);
  expect((await new SourceVideoRepository(prisma).get(orgId,receipt.state.jobId)).finalization).toEqual({status:'failed',message:'render failed'});
  await repository.fenceTerminal(orgId,receipt.state.jobId,'cancelled','retry');
  expect((await repository.get(orgId,receipt.state.jobId)).finalization?.status).toBe('failed');
  await prisma.sourceVideoJob.update({where:{id:receipt.state.jobId},data:{status:'failed'}});
 });
});
