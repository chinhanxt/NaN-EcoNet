import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../libraries/nestjs-libraries/src/database/prisma/prisma.service';
import { SourceVideoRepository, sourceMediaId } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.repository';
const databaseUrl=process.env.SOURCE_VIDEO_DB_TEST_URL;
const describeDatabase=databaseUrl?describe:describe.skip;
describeDatabase('PostgreSQL publication journal under upload, cancellation, finalization and restart',()=>{
 let prisma:PrismaService,repository:SourceVideoRepository,orgId:string,otherOrgId:string,root:string;
 const retainedMediaIds:string[]=[];
 const metadata=(clipId:string)=>({clipId,title:'Lifecycle fixture',durationSeconds:12,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:12}]});
 const verifiedClip=async(tenant:string,clipId='clip')=>{
  const receipt=await repository.create(tenant,{mediaId:'fixture-source'}),jobId=receipt.state.jobId;
  const lease=await repository.acquire(tenant,jobId,`worker-${randomUUID()}`);
  await repository.clip(lease,metadata(clipId),join(root,`${jobId}.mp4`),'fixture-hash');
  const key=`source-video/${tenant}/${jobId}/${clipId}.mp4`;
  return {receipt,jobId,lease,key,path:`https://fixture.invalid/${key}`};
 };
 // Terminal status and a cleared lease keep the org queue and global active-stage limits free for later tests.
 const close=(jobId:string,status='completed')=>prisma.sourceVideoJob.updateMany({where:{id:jobId,orgId:{in:[orgId,otherOrgId]}},data:{status,leaseOwner:null,leaseUntil:null}});
 beforeAll(async()=>{
  process.env.DATABASE_URL=databaseUrl;root=await mkdtemp(join(tmpdir(),'source-lifecycle-db-'));process.env.SOURCE_VIDEO_JOB_DIRECTORY=root;
  prisma=new PrismaService();await prisma.$connect();repository=new SourceVideoRepository(prisma);
  orgId=(await prisma.organization.create({data:{name:`source-lifecycle-db-fixture-${randomUUID()}`}})).id;
  otherOrgId=(await prisma.organization.create({data:{name:`source-lifecycle-db-foreign-${randomUUID()}`}})).id;
 });
 afterAll(async()=>{
  if(!prisma)return;
  // Keep exact test-owned Media rows for integration-owner evidence review; no existing tenant is touched.
  console.info(JSON.stringify({fixture:'source-video-publication-lifecycle-db',orgIds:[orgId,otherOrgId],mediaIds:retainedMediaIds}));
  try{
   await prisma.sourceVideoJob.updateMany({where:{orgId:{in:[orgId,otherOrgId].filter(Boolean)},status:{notIn:['completed','failed','cancelled']}},data:{status:'completed',leaseOwner:null,leaseUntil:null}});
  }finally{await prisma.$disconnect();if(root)await rm(root,{recursive:true,force:true});}
 });
 it('rejects a changed artifact or storage key for an existing journal after worker restart',async()=>{
  const {jobId,lease,key,path}=await verifiedClip(orgId);
  try{
   const prepared=await repository.reserve(lease,'clip','fixture-hash',key,path);await repository.release(lease);
   const restarted=new SourceVideoRepository(prisma),next=await restarted.acquire(orgId,jobId,'restarted-worker');
   try{
    await expect(restarted.reserve(next,'clip','changed-hash',key,path)).rejects.toThrow('Publication artifact changed');
    await expect(restarted.reserve(next,'clip','fixture-hash',`${key}.other`,path)).rejects.toThrow('Publication artifact changed');
    expect(await restarted.reserve(next,'clip','fixture-hash',key,path)).toMatchObject({id:prepared.id,status:'prepared',storageKey:key});
    expect(await prisma.sourceVideoPublication.count({where:{jobId}})).toBe(1);
    expect(await prisma.media.findUnique({where:{id:prepared.mediaId}})).toBeNull();
   }finally{await restarted.release(next);}
  }finally{await close(jobId);}
 });
 it('fences verification and journal writes from a crashed worker epoch after restart takeover',async()=>{
  const receipt=await repository.create(orgId,{mediaId:'fixture-source'}),jobId=receipt.state.jobId;
  try{
   const crashed=await repository.acquire(orgId,jobId,'crashed-worker');
   await prisma.sourceVideoJob.update({where:{id:jobId},data:{leaseUntil:new Date(0)}});
   const restarted=new SourceVideoRepository(prisma),current=await restarted.acquire(orgId,jobId,'restarted-worker');
   expect(current.epoch).toBe(crashed.epoch+1);
   const key=`source-video/${orgId}/${jobId}/restart.mp4`,path=`https://fixture.invalid/${key}`;
   await expect(repository.clip(crashed,metadata('clip'),join(root,'stale.mp4'),'stale-hash')).rejects.toThrow('fenced');
   await expect(repository.reserve(crashed,'clip','stale-hash',key,path)).rejects.toThrow('fenced');
   await restarted.clip(current,metadata('clip'),join(root,'current.mp4'),'current-hash');
   expect(await restarted.reserve(current,'clip','current-hash',key,path)).toMatchObject({status:'prepared',epoch:current.epoch,orgId,sha256:'current-hash'});
   await repository.release(crashed);
   expect((await prisma.sourceVideoJob.findUniqueOrThrow({where:{id:jobId}})).leaseOwner).toBe('restarted-worker');
   await restarted.release(current);
  }finally{await close(jobId);}
 });
 it('prevents Media creation when cancellation lands between journal reservation and commit',async()=>{
  const {receipt,jobId,lease,key,path}=await verifiedClip(orgId);
  try{
   const prepared=await repository.reserve(lease,'clip','fixture-hash',key,path);
   await repository.requestCancel(orgId,jobId);
   await expect(repository.renew(lease)).rejects.toThrow('fenced or cancelled');
   await expect(repository.commit(lease,prepared,'Lifecycle fixture')).rejects.toThrow('fenced');
   await expect(repository.save(receipt,lease)).rejects.toThrow('fenced');
   expect(await prisma.media.findUnique({where:{id:prepared.mediaId}})).toBeNull();
   expect((await prisma.sourceVideoClip.findUniqueOrThrow({where:{jobId_clipId:{jobId,clipId:'clip'}}})).mediaId).toBeNull();
   await expect(repository.acquire(orgId,jobId,'late-worker')).rejects.toThrow('cancelled');
   expect((await repository.fenceTerminal(orgId,jobId,'failed','upload interrupted')).finalization).toEqual({status:'cancelled',message:'upload interrupted'});
   expect((await repository.publications(orgId,jobId)).map(item=>item.status)).toEqual(['compensating']);
   await repository.compensateOne(orgId,jobId,prepared.id);
   expect((await repository.publications(orgId,jobId)).map(item=>item.status)).toEqual(['compensated']);
  }finally{await close(jobId,'cancelled');}
 });
 it('fences an in-flight publisher at finalization and compensates only inside the owning tenant',async()=>{
  const {jobId,lease,key,path}=await verifiedClip(orgId);
  try{
   const prepared=await repository.reserve(lease,'clip','fixture-hash',key,path);
   const media=await repository.commit(lease,prepared,'Lifecycle fixture');retainedMediaIds.push(media.id);
   expect(media.id).toBe(sourceMediaId(jobId,'clip'));
   await repository.fenceTerminal(orgId,jobId,'failed','publish failed after commit');
   await expect(repository.renew(lease)).rejects.toThrow('fenced');
   await expect(repository.reserve(lease,'clip','fixture-hash',key,path)).rejects.toThrow('fenced');
   await expect(repository.commit(lease,prepared,'Lifecycle fixture')).rejects.toThrow('fenced');
   await expect(repository.acquire(orgId,jobId,'retry-worker')).rejects.toThrow('cancelled');
   expect(await prisma.sourceVideoJob.findUniqueOrThrow({where:{id:jobId}})).toMatchObject({stage:'finalizing',leaseOwner:null,epoch:lease.epoch+1});
   expect((await repository.pendingFinalizations()).some(row=>row.id===jobId)).toBe(true);
   await repository.compensateOne(otherOrgId,jobId,prepared.id);
   await expect(repository.publications(otherOrgId,jobId)).rejects.toThrow('not found');
   expect((await prisma.sourceVideoPublication.findUniqueOrThrow({where:{id:prepared.id}})).status).toBe('compensating');
   expect((await prisma.media.findUniqueOrThrow({where:{id:media.id}})).deletedAt).toBeNull();
   const restarted=new SourceVideoRepository(prisma);
   await restarted.compensateOne(orgId,jobId,prepared.id);await restarted.compensateOne(orgId,jobId,prepared.id);
   expect((await prisma.sourceVideoPublication.findUniqueOrThrow({where:{id:prepared.id}})).status).toBe('compensated');
   const compensated=await prisma.media.findUniqueOrThrow({where:{id:media.id}});
   expect(compensated.organizationId).toBe(orgId);expect(compensated.deletedAt).not.toBeNull();
   expect((await prisma.sourceVideoClip.findUniqueOrThrow({where:{jobId_clipId:{jobId,clipId:'clip'}}})).mediaId).toBeNull();
  }finally{await close(jobId,'failed');}
 });
 it('keeps committed Media when a late failure or cancellation arrives after completion',async()=>{
  const {jobId,lease,key,path}=await verifiedClip(orgId);
  try{
   const prepared=await repository.reserve(lease,'clip','fixture-hash',key,path);
   const media=await repository.commit(lease,prepared,'Lifecycle fixture');retainedMediaIds.push(media.id);await repository.release(lease);
   const fenced=await repository.fenceTerminal(orgId,jobId,'completed');
   expect(fenced.finalization?.status).toBe('completed');
   fenced.state={...fenced.state,status:'completed',stage:'completed',progress:100,clips:[{clipId:'clip',title:'Lifecycle fixture',durationSeconds:12,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:12}],media:{id:media.id,path:media.path},sha256:'fixture-hash'}]};
   await repository.save(fenced);
   const late=await new SourceVideoRepository(prisma).fenceTerminal(orgId,jobId,'failed','late activity failure');
   expect(late.state.status).toBe('completed');
   await repository.requestCancel(orgId,jobId);
   expect(await prisma.sourceVideoJob.findUniqueOrThrow({where:{id:jobId}})).toMatchObject({status:'completed',cancellationRequested:false});
   expect((await prisma.sourceVideoPublication.findUniqueOrThrow({where:{id:prepared.id}})).status).toBe('committed');
   expect((await prisma.media.findUniqueOrThrow({where:{id:media.id}})).deletedAt).toBeNull();
   expect((await repository.get(orgId,jobId)).finalization?.status).toBe('completed');
  }finally{await close(jobId);}
 });
 // commit() loads the journal scoped to lease.orgId/jobId and checks the upserted Media organization.
 it('refuses to commit another tenant job publication journal under the caller lease',async()=>{
  const foreign=await verifiedClip(otherOrgId);
  const journal=await repository.reserve(foreign.lease,'clip','fixture-hash',foreign.key,foreign.path).finally(()=>repository.release(foreign.lease));
  const own=await verifiedClip(orgId);
  try{
   await expect(repository.commit(own.lease,journal,'cross-tenant fixture')).rejects.toThrow();
   expect(await prisma.media.findUnique({where:{id:journal.mediaId}})).toBeNull();
   expect((await prisma.sourceVideoPublication.findUniqueOrThrow({where:{id:journal.id}})).status).toBe('prepared');
  }finally{retainedMediaIds.push(journal.mediaId);await repository.release(own.lease);await close(own.jobId);await close(foreign.jobId);}
 });
});
