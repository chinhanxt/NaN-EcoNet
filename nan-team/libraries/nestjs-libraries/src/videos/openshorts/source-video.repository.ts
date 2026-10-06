import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { SourceReceipt, SourceVideoDto, SourceAnalysisPlan } from './source-video.dto';
import { assertSourceWebhookTarget, encryptSourceWebhook, sourceWebhookBody } from './source-video.webhook';
export const SOURCE_TERMINAL_STATUSES=['completed','failed','cancelled'];
export interface SourceStageLease {orgId:string;jobId:string;owner:string;epoch:number}
export interface SourcePublication {id:string;orgId:string;jobId:string;clipId:string;mediaId:string;storageKey:string;storagePath:string;sha256:string;status:string;epoch:number}
const sourceLimit=(name:string,fallback:number,maximum:number)=>{const value=Number(process.env[name]||fallback);return Number.isInteger(value)&&value>0&&value<=maximum?value:fallback;};
const stableSourceValue=(value:unknown):unknown=>Array.isArray(value)?value.map(stableSourceValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,entry])=>[key,stableSourceValue(entry)])):value;
// The row columns are the source of truth for status/stage/progress over the stored receipt JSON.
const withRowState=(r:{receipt:unknown;status:string;stage:string;progress:number}):SourceReceipt=>{const receipt=r.receipt as SourceReceipt;return {...receipt,state:{...receipt.state,status:r.status as SourceReceipt['state']['status'],stage:r.stage,progress:r.progress}};};
export const sourceDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(stableSourceValue(value))).digest('hex');
export function sourceMediaId(jobId:string,clipId:string) {
 const hex=createHash('sha256').update(`${jobId}:${clipId}`).digest('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
@Injectable()
export class SourceVideoRepository {
 readonly directory=resolve(process.env.SOURCE_VIDEO_JOB_DIRECTORY||join(homedir(),'.local','share','nan-team','source-video-jobs'));
 private writes=new Map<string,Promise<void>>();
 constructor(private readonly prisma:PrismaService){}
 path(jobId:string) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId))throw new NotFoundException('Video job not found');
  return join(this.directory,jobId);
 }
 private async transaction<T>(action:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
  for(let attempt=0;attempt<5;attempt++)try{return await this.prisma.$transaction(tx=>action(tx),{isolationLevel:'Serializable'});}catch(error:any){
   if(!['P2034','P2002'].includes(error.code)||attempt===4)throw error;
  }
  throw new Error('Source video transaction contention');
 }
 async create(orgId:string,input:SourceVideoDto,parent?:SourceReceipt,expectedRevision?:number,parentClip?:Record<string,unknown>,retryOf?:SourceReceipt):Promise<SourceReceipt> {
  const {idempotencyKey:provided,...hashInput}=input;
  // A retry re-runs the original input as a new revision of the same project, linked to the failed job for traceability.
  const parentJobId=parent?.state.jobId||retryOf?.state.jobId;
  const key=provided||randomUUID(),inputHash=sourceDigest({input:hashInput,parentJobId,parentClipId:parentClip?.clipId});
  const persisted=await this.prisma.sourceVideoJob.findUnique({where:{orgId_idempotencyKey:{orgId,idempotencyKey:key}}});
  if(persisted){if(persisted.inputHash!==inputHash)throw new ConflictException('Idempotency key was already used for another request');return persisted.receipt as unknown as SourceReceipt;}
  const {webhook,...publicInput}=input;
  let callback:{targetCiphertext:string;secretCiphertext:string}|undefined;
  if(webhook){
   if(typeof webhook.secret!=='string'||webhook.secret.length<16||webhook.secret.length>512)throw new BadRequestException('Invalid webhook signing secret');
   try{await assertSourceWebhookTarget(webhook.url);}catch{throw new BadRequestException('Webhook must use a public HTTPS target');}
   callback={targetCiphertext:encryptSourceWebhook(webhook.url),secretCiphertext:encryptSourceWebhook(webhook.secret)};
  }
  return this.transaction(async tx=>{
   const prior=await tx.sourceVideoJob.findUnique({where:{orgId_idempotencyKey:{orgId,idempotencyKey:key}}});
   if(prior){if(prior.inputHash!==inputHash)throw new ConflictException('Idempotency key was already used for another request');return prior.receipt as unknown as SourceReceipt;}
   const active=await tx.sourceVideoJob.count({where:{status:{in:['queued','running','awaiting_approval']}}});
   const owned=await tx.sourceVideoJob.count({where:{orgId,status:{in:['queued','running','awaiting_approval']}}});
   if(active>=sourceLimit('SOURCE_VIDEO_MAX_QUEUED',10,1000)||owned>=sourceLimit('SOURCE_VIDEO_ORG_MAX_QUEUED',2,100))throw new HttpException('Source video queue is full',429);
   const jobId=randomUUID(),projectId=parent?.state.projectId||retryOf?.state.projectId||jobId;
   const latest=await tx.sourceVideoJob.findFirst({where:{orgId,projectId},orderBy:{revision:'desc'}});
   if(parent && (!expectedRevision||latest?.revision!==expectedRevision))throw new ConflictException('Clip revision changed; reload project');
   const revision=(latest?.revision||0)+1,workflowId=`source-video-v1-${jobId}`;
   const receipt:SourceReceipt={orgId,createdAt:Date.now(),updatedAt:Date.now(),input:{...publicInput,idempotencyKey:key},workflowId,
    sourcePath:parent?.sourcePath,sourceSha256:parent?.sourceSha256,parentClip,
    state:{jobId,projectId,revision,workflowId,...(parentJobId?{parentJobId}:{}),status:'queued',stage:'queued',progress:0,clips:[],warnings:[]}};
   await tx.sourceVideoJob.create({data:{id:jobId,orgId,projectId,revision,parentJobId,workflowId,idempotencyKey:key,inputHash,receipt:JSON.parse(JSON.stringify(receipt))}});
   await tx.sourceVideoRevision.create({data:{id:jobId,orgId,projectId,version:revision,jobId,input:JSON.parse(JSON.stringify(publicInput))}});
   if(callback)await tx.sourceVideoWebhookDelivery.create({data:{jobId,orgId,...callback}});
   return receipt;
  });
 }
 async get(orgId:string,jobId:string):Promise<SourceReceipt> {
  this.path(jobId);if(!orgId)throw new NotFoundException('Video job not found');
  const row=await this.prisma.sourceVideoJob.findFirst({where:{id:jobId,orgId},select:{receipt:true,workflowStarted:true,status:true,stage:true,progress:true}});
  if(!row)throw new NotFoundException('Video job not found');
  const receipt=row.receipt as unknown as SourceReceipt;receipt.workflowStarted=row.workflowStarted;
  receipt.state.status=row.status as SourceReceipt['state']['status'];receipt.state.stage=row.stage;receipt.state.progress=row.progress;
  return receipt;
 }
 /** Poll probe: row version + live columns + webhook, without the (large) receipt JSON. */
 async version(orgId:string,jobId:string) {
  this.path(jobId);if(!orgId)throw new NotFoundException('Video job not found');
  const row=await this.prisma.sourceVideoJob.findFirst({where:{id:jobId,orgId},select:{updatedAt:true,status:true,stage:true,progress:true,_count:{select:{clips:true}},webhookDelivery:{select:{status:true,attempts:true,nextAttemptAt:true,lastStatusCode:true,lastError:true,deliveredAt:true}}}});
  if(!row)throw new NotFoundException('Video job not found');
  const {_count,...rest}=row;
  return {...rest,clipCount:_count.clips};
 }
 /** Recent-window versions for list polling; receipts are fetched only for rows whose version changed. */
 async listVersions(orgId:string) {
  const rows=await this.prisma.sourceVideoJob.findMany({where:{orgId},orderBy:{createdAt:'desc'},take:100,select:{id:true,updatedAt:true,status:true,stage:true,progress:true,_count:{select:{clips:true}}}});
  return rows.map(({_count,...r})=>({...r,clipCount:_count.clips}));
 }
 async listReceipts(orgId:string,ids:string[]) {
  if(!ids.length)return [];
  const rows=await this.prisma.sourceVideoJob.findMany({where:{orgId,id:{in:ids}},select:{id:true,updatedAt:true,status:true,stage:true,progress:true,receipt:true}});
  return rows.map(r=>({id:r.id,updatedAt:r.updatedAt,status:r.status,stage:r.stage,progress:r.progress,receipt:withRowState(r)}));
 }
 async webhookStatus(orgId:string,jobId:string) {
  return (await this.prisma.sourceVideoWebhookDelivery.findFirst({where:{orgId,jobId},select:{status:true,attempts:true,nextAttemptAt:true,lastStatusCode:true,lastError:true,deliveredAt:true}}))||undefined;
 }
 async list(orgId:string) {
  const rows=await this.prisma.sourceVideoJob.findMany({where:{orgId},orderBy:{createdAt:'desc'},take:100});
  return rows.map(withRowState);
 }
 async pendingFinalizations(){return this.prisma.sourceVideoJob.findMany({where:{stage:'finalizing',status:{notIn:SOURCE_TERMINAL_STATUSES}},take:100});}
 async pendingCancels(){return this.prisma.sourceVideoJob.findMany({where:{cancellationRequested:true,stage:{not:'finalizing'},status:{notIn:SOURCE_TERMINAL_STATUSES}},take:100});}
 async pendingStarts() {return this.prisma.sourceVideoJob.findMany({where:{workflowStarted:false,status:{in:['queued','running','awaiting_approval']},stage:{not:'finalizing'},cancellationRequested:false},take:100});}
 async markStarted(orgId:string,jobId:string){await this.prisma.sourceVideoJob.updateMany({where:{id:jobId,orgId},data:{workflowStarted:true}});}
 async acquire(orgId:string,jobId:string,owner:string):Promise<SourceStageLease> {
  return this.transaction(async tx=>{
   const row=await tx.sourceVideoJob.findFirst({where:{id:jobId,orgId}});
   if(!row)throw new NotFoundException('Video job not found');
   if(row.cancellationRequested||row.stage==='finalizing'||['failed','cancelled'].includes(row.status))throw new ConflictException('Source video cancelled');
   if(row.leaseOwner && row.leaseOwner!==owner && row.leaseUntil && row.leaseUntil.getTime()>Date.now())throw new HttpException('Source stage is still owned by another worker',503);
   const otherLeases=await tx.sourceVideoJob.count({where:{id:{not:jobId},leaseOwner:{not:null},leaseUntil:{gt:new Date()},status:{notIn:SOURCE_TERMINAL_STATUSES}}});
   if(otherLeases>=sourceLimit('SOURCE_VIDEO_MAX_ACTIVE',1,16)){const error=new Error('Source video capacity is busy; wait for the active stage');error.name='SourceVideoCapacityError';throw error;}
   const epoch=row.epoch+1;
   await tx.sourceVideoJob.update({where:{id:jobId},data:{epoch,leaseOwner:owner,leaseUntil:new Date(Date.now()+60_000)}});
   return {orgId,jobId,owner,epoch};
  });
 }
 async renew(lease:SourceStageLease) {
  const result=await this.prisma.sourceVideoJob.updateMany({where:{id:lease.jobId,orgId:lease.orgId,epoch:lease.epoch,leaseOwner:lease.owner,leaseUntil:{gt:new Date()},cancellationRequested:false},data:{leaseUntil:new Date(Date.now()+60_000)}});
  if(result.count!==1)throw new ConflictException('Source worker lease was fenced or cancelled');
 }
 async release(lease:SourceStageLease){await this.prisma.sourceVideoJob.updateMany({where:{id:lease.jobId,orgId:lease.orgId,epoch:lease.epoch,leaseOwner:lease.owner},data:{leaseOwner:null,leaseUntil:null}});}
 async save(receipt:SourceReceipt,lease?:SourceStageLease) {
  receipt.updatedAt=Date.now();const id=receipt.state.jobId,snapshot=JSON.parse(JSON.stringify(receipt)) as SourceReceipt;
  const write=(this.writes.get(id)||Promise.resolve()).catch(()=>undefined).then(()=>this.persist(snapshot,lease));this.writes.set(id,write);
  try{await write;}finally{if(this.writes.get(id)===write)this.writes.delete(id);}
 }
 private async persist(receipt:SourceReceipt,lease?:SourceStageLease) {
  const data={receipt:JSON.parse(JSON.stringify(receipt)),status:receipt.state.status,stage:receipt.state.stage,progress:receipt.state.progress,sourceSha256:receipt.sourceSha256,engineSha256:receipt.engineSha256};
  const terminal=SOURCE_TERMINAL_STATUSES.includes(receipt.state.status);
  const saved=await this.transaction(async tx=>{
   if(terminal){
    const current=await tx.sourceVideoJob.findFirst({where:{id:receipt.state.jobId,orgId:receipt.orgId}});
    if(current&&SOURCE_TERMINAL_STATUSES.includes(current.status)){
     const prior=current.receipt as unknown as SourceReceipt;
     if(sourceDigest(prior.state)!==sourceDigest(receipt.state))throw new ConflictException('Terminal source job is immutable');
     return prior;
    }
   }
   const result=await tx.sourceVideoJob.updateMany({where:{id:receipt.state.jobId,orgId:receipt.orgId,...(lease?{epoch:lease.epoch,leaseOwner:lease.owner,leaseUntil:{gt:new Date()},cancellationRequested:false}:terminal?{status:{in:['queued','running','awaiting_approval',receipt.state.status]}}:{cancellationRequested:false,leaseOwner:null,status:{notIn:SOURCE_TERMINAL_STATUSES}})},data});
   if(result.count!==1)throw new ConflictException('Source worker write was fenced');
   if(terminal)await tx.sourceVideoWebhookDelivery.updateMany({where:{jobId:receipt.state.jobId,orgId:receipt.orgId,status:'waiting'},data:{status:'pending',payload:sourceWebhookBody(receipt),nextAttemptAt:new Date()}});
   return receipt;
  });
  // Local receipt is export evidence; the database remains the recovery authority.
  const dir=this.path(receipt.state.jobId);await mkdir(dir,{recursive:true,mode:0o700});
  const temporary=join(dir,`receipt-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(saved),{mode:0o600});await rename(temporary,join(dir,'receipt.json'));
 }
 async plan(receipt:SourceReceipt,plan:SourceAnalysisPlan,lease:SourceStageLease) {
  receipt.plan=plan;receipt.state.plan={version:plan.version,planVersion:plan.planVersion,clips:plan.clips,transcript:plan.transcript,media:plan.media,warnings:plan.warnings};
  await this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.updateMany({where:{id:lease.jobId,orgId:lease.orgId,epoch:lease.epoch,leaseOwner:lease.owner,leaseUntil:{gt:new Date()},cancellationRequested:false},data:{receipt:JSON.parse(JSON.stringify(receipt)),sourceSha256:receipt.sourceSha256,engineSha256:receipt.engineSha256}});
   if(job.count!==1)throw new ConflictException('Source plan worker was fenced');
   const revision=await tx.sourceVideoRevision.updateMany({where:{jobId:lease.jobId,orgId:lease.orgId},data:{plan:JSON.parse(JSON.stringify(plan)),planVersion:plan.planVersion}});
   if(revision.count!==1)throw new ConflictException('Source plan revision was missing');
  });
  await this.save(receipt,lease);
 }
 async approve(orgId:string,jobId:string,version:number,plan:SourceAnalysisPlan) {
  return this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.findFirst({where:{id:jobId,orgId,status:'awaiting_approval',cancellationRequested:false}});
   if(!job)throw new ConflictException('Source plan is not awaiting approval');
   const revision=await tx.sourceVideoRevision.findFirst({where:{jobId,orgId}});
   if(revision?.planVersion!==version)throw new ConflictException('Source plan changed; reload before approving');
   if(revision.approvedAt)throw new ConflictException('Source plan has already been approved');
   const receipt=job.receipt as unknown as SourceReceipt;receipt.approvedPlan=plan;receipt.state.stage='approved';
   await tx.sourceVideoRevision.update({where:{jobId},data:{approvedPlan:JSON.parse(JSON.stringify(plan)),approvedAt:new Date()}});
   await tx.sourceVideoJob.update({where:{id:jobId},data:{receipt:JSON.parse(JSON.stringify(receipt)),stage:'approved'}});
   return receipt;
  });
 }
 // Enters awaiting_approval from the fresh row only while no approval exists; returns true when already approved.
 async awaitApproval(orgId:string,jobId:string):Promise<boolean> {
  const receipt=await this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.findFirst({where:{id:jobId,orgId}});
   if(!job)throw new NotFoundException('Video job not found');
   const current=job.receipt as unknown as SourceReceipt;
   const revision=await tx.sourceVideoRevision.findFirst({where:{jobId,orgId},select:{approvedAt:true}});
   if(current.approvedPlan||revision?.approvedAt||job.stage==='approved'||current.state.stage==='approved')return 'approved' as const;
   if(current.state.status==='awaiting_approval'&&current.state.stage==='awaiting_approval')return undefined;
   current.state.status='awaiting_approval';current.state.stage='awaiting_approval';
   const result=await tx.sourceVideoJob.updateMany({where:{id:jobId,orgId,stage:{notIn:['approved','finalizing']},cancellationRequested:false,leaseOwner:null,status:{notIn:SOURCE_TERMINAL_STATUSES}},data:{receipt:JSON.parse(JSON.stringify(current)),status:'awaiting_approval',stage:'awaiting_approval'}});
   if(result.count!==1){
    const fresh=await tx.sourceVideoJob.findFirst({where:{id:jobId,orgId},select:{stage:true}});
    if(fresh?.stage==='approved')return 'approved' as const;
    throw new ConflictException('Source worker write was fenced');
   }
   return current;
  });
  if(receipt==='approved')return true;
  if(receipt){const dir=this.path(jobId);await mkdir(dir,{recursive:true,mode:0o700});const temporary=join(dir,`receipt-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(receipt),{mode:0o600});await rename(temporary,join(dir,'receipt.json'));}
  return false;
 }
 async cancelled(orgId:string,jobId:string){return !!(await this.prisma.sourceVideoJob.findFirst({where:{id:jobId,orgId},select:{cancellationRequested:true}}))?.cancellationRequested;}
 async requestCancel(orgId:string,jobId:string){await this.get(orgId,jobId);await this.prisma.sourceVideoJob.updateMany({where:{id:jobId,orgId,status:{notIn:SOURCE_TERMINAL_STATUSES}},data:{cancellationRequested:true,stage:'cancelling'}});}
 async clip(lease:SourceStageLease,metadata:Record<string,unknown>,artifactPath:string,sha256:string,cleanPath?:string) {
  const clipId=String(metadata.clipId),id=sourceMediaId(lease.jobId,clipId);
  await this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.findFirst({where:{id:lease.jobId,orgId:lease.orgId,epoch:lease.epoch,leaseOwner:lease.owner,leaseUntil:{gt:new Date()},cancellationRequested:false}});
   if(!job)throw new ConflictException('Verification worker was fenced');
   await tx.sourceVideoClip.upsert({where:{jobId_clipId:{jobId:lease.jobId,clipId}},create:{id,orgId:lease.orgId,jobId:lease.jobId,clipId,title:String(metadata.title),artifactPath,cleanPath,sha256,metadata:JSON.parse(JSON.stringify(metadata))},update:{artifactPath,cleanPath,sha256,metadata:JSON.parse(JSON.stringify(metadata))}});
  });
 }
 async clips(orgId:string,jobId:string){await this.get(orgId,jobId);return this.prisma.sourceVideoClip.findMany({where:{orgId,jobId},orderBy:{createdAt:'asc'}});}
 async reserve(lease:SourceStageLease,clipId:string,sha256:string,storageKey:string,storagePath:string):Promise<SourcePublication> {
  return this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.findFirst({where:{id:lease.jobId,orgId:lease.orgId,epoch:lease.epoch,leaseOwner:lease.owner,leaseUntil:{gt:new Date()},cancellationRequested:false}});
   if(!job)throw new ConflictException('Publication worker was fenced');
   const prior=await tx.sourceVideoPublication.findUnique({where:{jobId_clipId:{jobId:lease.jobId,clipId}}});
   if(prior){if(prior.sha256!==sha256||prior.storageKey!==storageKey)throw new ConflictException('Publication artifact changed');return prior as SourcePublication;}
   return tx.sourceVideoPublication.create({data:{id:sourceMediaId(lease.jobId,clipId),orgId:lease.orgId,jobId:lease.jobId,clipId,mediaId:sourceMediaId(lease.jobId,clipId),sha256,storageKey,storagePath,epoch:lease.epoch}}) as Promise<SourcePublication>;
  });
 }
 async commit(lease:SourceStageLease,publication:SourcePublication,title:string) {
  return this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.findFirst({where:{id:lease.jobId,orgId:lease.orgId,epoch:lease.epoch,leaseOwner:lease.owner,leaseUntil:{gt:new Date()},cancellationRequested:false}});
   if(!job)throw new ConflictException('Publication worker was fenced');
   // Trust only the journal row owned by this lease's tenant/job, never the caller-supplied object.
   const record=await tx.sourceVideoPublication.findFirst({where:{id:publication.id,orgId:lease.orgId,jobId:lease.jobId,status:{in:['prepared','committed']}}});
   if(!record)throw new ConflictException('Publication journal is not owned by this worker');
   const media=await tx.media.upsert({where:{id:record.mediaId},create:{id:record.mediaId,organizationId:lease.orgId,name:record.storageKey,path:record.storagePath,originalName:title,type:'video',status:'ready'},update:{},select:{id:true,path:true,thumbnail:true,organizationId:true,deletedAt:true}});
   if(media.organizationId!==lease.orgId||media.deletedAt)throw new ConflictException('Publication Media is not available to this organization');
   const clip=await tx.sourceVideoClip.updateMany({where:{orgId:lease.orgId,jobId:lease.jobId,clipId:record.clipId},data:{mediaId:media.id}});
   if(clip.count!==1)throw new ConflictException('Publication clip is missing');
   const committed=await tx.sourceVideoPublication.updateMany({where:{id:record.id,orgId:lease.orgId,jobId:lease.jobId,status:{in:['prepared','committed']}},data:{status:'committed',epoch:lease.epoch}});
   if(committed.count!==1)throw new ConflictException('Publication journal changed');
   return {id:media.id,path:media.path,thumbnail:media.thumbnail};
  });
 }
 async publications(orgId:string,jobId:string){await this.get(orgId,jobId);return this.prisma.sourceVideoPublication.findMany({where:{orgId,jobId}});}
 async fenceTerminal(orgId:string,jobId:string,status:'completed'|'failed'|'cancelled',message?:string):Promise<SourceReceipt> {
  return this.transaction(async tx=>{
   const job=await tx.sourceVideoJob.findFirst({where:{id:jobId,orgId}});if(!job)throw new NotFoundException('Video job not found');
   const receipt=job.receipt as unknown as SourceReceipt;
   if(SOURCE_TERMINAL_STATUSES.includes(job.status))return {...receipt,state:{...receipt.state,status:job.status as SourceReceipt['state']['status']}};
   receipt.finalization ||= {status:job.cancellationRequested?'cancelled':status,message};
   await tx.sourceVideoJob.update({where:{id:jobId},data:{receipt:JSON.parse(JSON.stringify(receipt)),epoch:{increment:1},leaseOwner:null,leaseUntil:null,stage:'finalizing'}});
   if(receipt.finalization.status!=='completed')await tx.sourceVideoPublication.updateMany({where:{jobId,orgId,status:{in:['prepared','committed']}},data:{status:'compensating'}});
   return receipt;
  });
 }
 async compensateOne(orgId:string,jobId:string,id:string) {
  await this.transaction(async tx=>{
   const record=await tx.sourceVideoPublication.findFirst({where:{id,orgId,jobId,status:'compensating'}});
   if(!record)return;
   await tx.media.updateMany({where:{id:record.mediaId,organizationId:orgId},data:{deletedAt:new Date()}});
   await tx.sourceVideoClip.updateMany({where:{orgId,jobId,clipId:record.clipId},data:{mediaId:null}});
   await tx.sourceVideoPublication.updateMany({where:{id,status:'compensating',epoch:record.epoch},data:{status:'compensated'}});
  });
 }
}
