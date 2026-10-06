import { mkdtemp, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
jest.mock('../../libraries/nestjs-libraries/src/videos/openshorts/source-video.worker',()=>({SourceVideoWorker:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/remotion/tts.service',()=>({TtsService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service',()=>({SourceVideoMotionService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/database/prisma/media/media.repository',()=>({MediaRepository:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/upload/upload.factory',()=>({UploadFactory:{createStorage:jest.fn()}}));
import { SourceVideoService, SourceVideoStage } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.service';
import { sourceDigest, sourceMediaId } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.repository';
import type { SourceStageLease } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.repository';
import { UploadFactory } from '../../libraries/nestjs-libraries/src/upload/upload.factory';
import { SourceReceipt, SourceAnalysisPlan } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.dto';
const org={id:randomUUID()},otherOrg={id:randomUUID()};
const digest=(bytes:string)=>createHash('sha256').update(bytes).digest('hex');
const finished=(status:string)=>['completed','failed','cancelled'].includes(status);
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
interface Row {receipt:SourceReceipt;status:string;stage:string;progress:number;epoch:number;leaseOwner:string|null;leaseUntil:number;cancellationRequested:boolean;workflowStarted:boolean}
// In-memory mirror of SourceVideoRepository fencing: row columns vs receipt JSON,
// epoch/owner/expiry/cancel lease checks, finalization intent and tenant scoping.
class FencedRepository {
 readonly rows=new Map<string,Row>();readonly clipRows=new Map<string,any>();readonly journal=new Map<string,any>();readonly media=new Map<string,any>();
 constructor(readonly directory:string){}
 path(jobId:string){return join(this.directory,jobId);}
 private row(orgId:string,jobId:string){const row=this.rows.get(jobId);if(!row||!orgId||row.receipt.orgId!==orgId)throw new Error('Video job not found');return row;}
 private live(lease:SourceStageLease){const row=this.rows.get(lease.jobId);return !!row&&row.receipt.orgId===lease.orgId&&row.epoch===lease.epoch&&row.leaseOwner===lease.owner&&row.leaseUntil>Date.now()&&!row.cancellationRequested;}
 private fence(lease:SourceStageLease,message:string){if(!this.live(lease))throw new Error(message);}
 private pending(match:(row:Row)=>boolean){return [...this.rows.entries()].filter(([,row])=>match(row)).map(([id,row])=>({id,orgId:row.receipt.orgId,workflowId:row.receipt.workflowId!,receipt:structuredClone(row.receipt)}));}
 expire(jobId:string){this.rows.get(jobId)!.leaseUntil=0;}
 liveMedia(orgId?:string){return [...this.media.values()].filter(item=>!item.deletedAt&&(!orgId||item.organizationId===orgId));}
 async create(orgId:string,input:any):Promise<SourceReceipt>{
  const jobId=randomUUID(),workflowId=`source-video-v1-${jobId}`;
  const receipt:SourceReceipt={orgId,createdAt:Date.now(),updatedAt:Date.now(),input:structuredClone({...input}),workflowId,state:{jobId,projectId:jobId,revision:1,workflowId,status:'queued',stage:'queued',progress:0,clips:[],warnings:[]}};
  this.rows.set(jobId,{receipt:structuredClone(receipt),status:'queued',stage:'queued',progress:0,epoch:0,leaseOwner:null,leaseUntil:0,cancellationRequested:false,workflowStarted:false});
  return receipt;
 }
 async get(orgId:string,jobId:string):Promise<SourceReceipt>{const row=this.row(orgId,jobId),receipt=structuredClone(row.receipt);receipt.workflowStarted=row.workflowStarted;Object.assign(receipt.state,{status:row.status,stage:row.stage,progress:row.progress});return receipt;}
 async webhookStatus():Promise<undefined>{return undefined;}
 async list(orgId:string){return [...this.rows.values()].filter(row=>row.receipt.orgId===orgId).map(row=>structuredClone(row.receipt));}
 async save(receipt:SourceReceipt,lease?:SourceStageLease){
  const row=this.row(receipt.orgId,receipt.state.jobId),terminal=finished(receipt.state.status);
  if(terminal&&finished(row.status)){if(sourceDigest(row.receipt.state)!==sourceDigest(receipt.state))throw new Error('Terminal source job is immutable');return;}
  const allowed=lease?this.live(lease):terminal||(!row.cancellationRequested&&!row.leaseOwner&&!finished(row.status));
  if(!allowed)throw new Error('Source worker write was fenced');
  Object.assign(row,{receipt:structuredClone(receipt),status:receipt.state.status,stage:receipt.state.stage,progress:receipt.state.progress});
 }
 async markStarted(orgId:string,jobId:string){const row=this.rows.get(jobId);if(row&&row.receipt.orgId===orgId)row.workflowStarted=true;}
 async acquire(orgId:string,jobId:string,owner:string):Promise<SourceStageLease>{
  const row=this.row(orgId,jobId);
  if(row.cancellationRequested||row.stage==='finalizing'||['failed','cancelled'].includes(row.status))throw new Error('Source video cancelled');
  if(row.leaseOwner&&row.leaseOwner!==owner&&row.leaseUntil>Date.now())throw new Error('Source stage is still owned by another worker');
  row.epoch++;row.leaseOwner=owner;row.leaseUntil=Date.now()+60_000;
  return {orgId,jobId,owner,epoch:row.epoch};
 }
 async renew(lease:SourceStageLease){this.fence(lease,'Source worker lease was fenced or cancelled');this.rows.get(lease.jobId)!.leaseUntil=Date.now()+60_000;}
 async release(lease:SourceStageLease){const row=this.rows.get(lease.jobId);if(row&&row.receipt.orgId===lease.orgId&&row.epoch===lease.epoch&&row.leaseOwner===lease.owner){row.leaseOwner=null;row.leaseUntil=0;}}
 async plan(receipt:SourceReceipt,plan:SourceAnalysisPlan,lease:SourceStageLease){
  this.fence(lease,'Source plan worker was fenced');
  receipt.plan=plan;receipt.state.plan={version:plan.version,planVersion:plan.planVersion,clips:plan.clips,transcript:plan.transcript,media:plan.media,warnings:plan.warnings};
  await this.save(receipt,lease);
 }
 async cancelled(orgId:string,jobId:string){const row=this.rows.get(jobId);return !!row&&row.receipt.orgId===orgId&&row.cancellationRequested;}
 async requestCancel(orgId:string,jobId:string){const row=this.row(orgId,jobId);if(!finished(row.status)){row.cancellationRequested=true;row.stage='cancelling';}}
 async clip(lease:SourceStageLease,metadata:Record<string,unknown>,artifactPath:string,sha256:string,cleanPath?:string){
  this.fence(lease,'Verification worker was fenced');
  const clipId=String(metadata.clipId),key=`${lease.jobId}:${clipId}`;
  this.clipRows.set(key,{mediaId:null,...this.clipRows.get(key),id:sourceMediaId(lease.jobId,clipId),orgId:lease.orgId,jobId:lease.jobId,clipId,title:String(metadata.title),artifactPath,cleanPath,sha256,metadata:structuredClone(metadata)});
 }
 async clips(orgId:string,jobId:string){this.row(orgId,jobId);return [...this.clipRows.values()].filter(item=>item.orgId===orgId&&item.jobId===jobId).map(item=>structuredClone(item));}
 async reserve(lease:SourceStageLease,clipId:string,sha256:string,storageKey:string,storagePath:string){
  this.fence(lease,'Publication worker was fenced');
  const id=sourceMediaId(lease.jobId,clipId),prior=this.journal.get(id);
  if(prior){if(prior.sha256!==sha256||prior.storageKey!==storageKey)throw new Error('Publication artifact changed');return structuredClone(prior);}
  const row={id,orgId:lease.orgId,jobId:lease.jobId,clipId,mediaId:id,sha256,storageKey,storagePath,status:'prepared',epoch:lease.epoch};
  this.journal.set(id,row);return structuredClone(row);
 }
 async commit(lease:SourceStageLease,publication:any,title:string){
  this.fence(lease,'Publication worker was fenced');
  const clip=this.clipRows.get(`${lease.jobId}:${publication.clipId}`);if(!clip)throw new Error('Clip row missing');
  if(!this.media.has(publication.mediaId))this.media.set(publication.mediaId,{id:publication.mediaId,organizationId:lease.orgId,name:publication.storageKey,path:publication.storagePath,originalName:title,type:'video',status:'ready',deletedAt:null});
  const media=this.media.get(publication.mediaId);clip.mediaId=media.id;
  Object.assign(this.journal.get(publication.id),{status:'committed',epoch:lease.epoch});
  return {id:media.id as string,path:media.path as string,thumbnail:null as string|null};
 }
 async publications(orgId:string,jobId:string){this.row(orgId,jobId);return [...this.journal.values()].filter(item=>item.orgId===orgId&&item.jobId===jobId).map(item=>structuredClone(item));}
 async fenceTerminal(orgId:string,jobId:string,status:'completed'|'failed'|'cancelled',message?:string):Promise<SourceReceipt>{
  const row=this.row(orgId,jobId),receipt=structuredClone(row.receipt);
  if(finished(row.status))return {...receipt,state:{...receipt.state,status:row.status as SourceReceipt['state']['status']}};
  receipt.finalization ||= {status:row.cancellationRequested?'cancelled':status,message};
  Object.assign(row,{receipt:structuredClone(receipt),epoch:row.epoch+1,leaseOwner:null,leaseUntil:0,stage:'finalizing'});
  if(receipt.finalization.status!=='completed')for(const item of this.journal.values())if(item.orgId===orgId&&item.jobId===jobId&&['prepared','committed'].includes(item.status))item.status='compensating';
  return receipt;
 }
 async compensateOne(orgId:string,jobId:string,id:string){
  const item=this.journal.get(id);if(!item||item.orgId!==orgId||item.jobId!==jobId||item.status!=='compensating')return;
  const media=this.media.get(item.mediaId);if(media&&media.organizationId===orgId)media.deletedAt=new Date();
  for(const clip of this.clipRows.values())if(clip.orgId===orgId&&clip.jobId===jobId&&clip.clipId===item.clipId)clip.mediaId=null;
  item.status='compensated';
 }
 async pendingStarts(){return this.pending(row=>!row.workflowStarted&&['queued','running','awaiting_approval'].includes(row.status)&&row.stage!=='finalizing'&&!row.cancellationRequested);}
 async pendingFinalizations(){return this.pending(row=>row.stage==='finalizing'&&!finished(row.status));}
 async pendingCancels(){return this.pending(row=>row.cancellationRequested&&row.stage!=='finalizing'&&!finished(row.status));}
}
class StorageFixture {
 readonly objects=new Map<string,Buffer>();
 publicUrl(key:string){return `https://storage.example/${key}`;}
 async store(stream:Readable,key:string,signal?:AbortSignal){const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));signal?.throwIfAborted();this.objects.set(key,Buffer.concat(chunks));return {path:this.publicUrl(key)};}
 readonly uploadStreamAtKey=jest.fn((stream:Readable,_type:string,key:string,signal?:AbortSignal)=>this.store(stream,key,signal));
 readonly removeFile=jest.fn(async(path:string)=>{if(!this.objects.delete(path.replace('https://storage.example/','')))throw Object.assign(new Error('object missing'),{code:'ENOENT'});});
}
interface StageOptions {tenant?:string;owner?:string;signal?:AbortSignal;heartbeat?:()=>void}
describe('source video publication lifecycle under render, upload, database and restart failures',()=>{
 let root:string,repo:FencedRepository,service:SourceVideoService,worker:any,media:any,temporal:any,storage:StorageFixture,clipCount:number;
 const makeService=()=>new SourceVideoService(repo as any,worker,media,{} as any,temporal,{} as any);
 const stage=(jobId:string,name:SourceVideoStage,{tenant=org.id,owner=randomUUID(),signal=new AbortController().signal,heartbeat=()=>undefined}:StageOptions={})=>service.executeStage(tenant,jobId,name,owner,signal,heartbeat);
 const analyzed=(input:any)=>({phase:'analyze',clips:[] as unknown[],plan:{version:1,planVersion:1,sourceFingerprint:digest('fixture-source'),engineFingerprint:'engine',requestFingerprint:'request',media:{durationSeconds:60},clips:[{clipId:'clip-1',title:'Clip 1',segments:[{startSeconds:0,endSeconds:12}],aspectRatio:input.aspectRatio||'9:16',layout:'wide'}]}});
 const rendered=async(dir:string,input:any)=>{
  const clips:any[]=[];
  for(let index=1;index<=clipCount;index++){const path=join(dir,`clip-${index}.mp4`);await writeFile(path,`fixture-output-${index}`);clips.push({clipId:`clip-${index}`,path,title:`Clip ${index}`,segments:[{startSeconds:0,endSeconds:12}],durationSeconds:12,aspectRatio:input.aspectRatio||'9:16'});}
  return {phase:'render',clips};
 };
 const renderReady=async(tenant=org.id)=>{const started=await service.start({id:tenant} as any,{mediaId:'source'});await stage(started.jobId,'prepare',{tenant});await stage(started.jobId,'analyze',{tenant});return started;};
 const verified=async(tenant=org.id)=>{const job=await renderReady(tenant);await stage(job.jobId,'render',{tenant});await stage(job.jobId,'verify',{tenant});return job;};
 const published=async(tenant=org.id)=>{const job=await verified(tenant);await stage(job.jobId,'publish',{tenant});return job;};
 const statuses=async(tenant:string,jobId:string)=>(await repo.publications(tenant,jobId)).map(item=>item.status);
 beforeEach(async()=>{
  root=await mkdtemp(join(tmpdir(),'source-lifecycle-'));process.env.FRONTEND_URL='http://fixture.local';process.env.STORAGE_PROVIDER='local';process.env.UPLOAD_DIRECTORY=join(root,'uploads');await mkdir(process.env.UPLOAD_DIRECTORY);await writeFile(join(process.env.UPLOAD_DIRECTORY,'source.mp4'),'fixture-source');
  repo=new FencedRepository(join(root,'jobs'));clipCount=1;
  media={getMediaStatus:jest.fn(async(tenant,id)=>[org.id,otherOrg.id].includes(tenant)&&id==='source'?{path:'http://fixture.local/uploads/source.mp4',status:'ready'}:null)};
  temporal={client:{getRawClient:()=>({workflow:{start:jest.fn().mockResolvedValue({}),getHandle:()=>({cancel:jest.fn().mockResolvedValue(undefined),signal:jest.fn()})}})}};
  worker={run:jest.fn(async(_id,_source,dir,input)=>input.phase==='analyze'?analyzed(input):rendered(dir,input)),verify:jest.fn().mockResolvedValue({}),command:jest.fn()};
  storage=new StorageFixture();jest.mocked(UploadFactory.createStorage).mockReturnValue(storage as any);
  service=makeService();
 });
 afterEach(async()=>{service.onModuleDestroy();await rm(root,{recursive:true,force:true});});

 it('fails a render without a checkpoint, clip rows, journal, upload or exposed clips',async()=>{
  const job=await renderReady();
  worker.run.mockRejectedValueOnce(new Error('Source video worker failed (1); inspect private worker diagnostics'));
  await expect(stage(job.jobId,'render')).rejects.toThrow('worker failed');
  expect((await repo.get(org.id,job.jobId)).rendered).toBeUndefined();expect(repo.rows.get(job.jobId)!.leaseOwner).toBeNull();
  await expect(stage(job.jobId,'verify')).rejects.toThrow('Rendered clips unavailable');
  expect(repo.clipRows.size).toBe(0);expect(repo.journal.size).toBe(0);
  await service.finish(org.id,job.jobId,'failed','Source video worker failed (1); inspect private worker diagnostics');
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'failed',stage:'failed',clips:[],error:expect.stringContaining('worker failed')});
  expect(storage.uploadStreamAtKey).not.toHaveBeenCalled();expect(storage.removeFile).not.toHaveBeenCalled();expect(repo.media.size).toBe(0);
 });
 it('retries a killed render in a fresh attempt directory and verifies only the successful output',async()=>{
  const job=await renderReady();
  worker.run.mockImplementationOnce(async(_id:string,_source:string,dir:string)=>{await writeFile(join(dir,'clip-1.mp4'),'partial-output');throw new Error('Source video worker failed (137); inspect private worker diagnostics');});
  await expect(stage(job.jobId,'render')).rejects.toThrow('worker failed (137)');
  await stage(job.jobId,'render');await stage(job.jobId,'verify');
  const failedDir=worker.run.mock.calls[1][2],retryDir=worker.run.mock.calls[2][2];
  expect(retryDir).not.toBe(failedDir);
  const rows=await repo.clips(org.id,job.jobId);
  expect(rows).toHaveLength(1);expect(rows[0].artifactPath.startsWith(await realpath(retryDir)+sep)).toBe(true);expect(rows[0].sha256).toBe(digest('fixture-output-1'));
 });
 it('re-renders after a backend crash between worker output and the render checkpoint without duplicate clip rows',async()=>{
  const job=await renderReady(),save=repo.save.bind(repo);let crashed=false;
  jest.spyOn(repo,'save').mockImplementation(async(receipt:SourceReceipt,lease?:SourceStageLease)=>{if(receipt.rendered&&!crashed){crashed=true;throw new Error('backend crash before render checkpoint');}return save(receipt,lease);});
  await expect(stage(job.jobId,'render')).rejects.toThrow('backend crash');
  expect((await repo.get(org.id,job.jobId)).rendered).toBeUndefined();
  service=makeService();await stage(job.jobId,'render');await stage(job.jobId,'verify');
  const rows=await repo.clips(org.id,job.jobId);
  expect(worker.run).toHaveBeenCalledTimes(3);expect(rows).toHaveLength(1);
  expect(rows[0].artifactPath.startsWith(await realpath(worker.run.mock.calls[2][2])+sep)).toBe(true);
 });
 it('aborts a render when the Temporal heartbeat is lost and leaves no render checkpoint',async()=>{
  const job=await renderReady();
  worker.run.mockImplementationOnce(async(_id:string,_source:string,_dir:string,_input:unknown,signal:AbortSignal,progress:(value:number,label:string)=>void)=>{progress(10,'rendering');signal.throwIfAborted();return new Promise(()=>undefined);});
  await expect(stage(job.jobId,'render',{heartbeat:()=>{throw new Error('activity heartbeat lost');}})).rejects.toThrow('heartbeat lost');
  expect((await repo.get(org.id,job.jobId)).rendered).toBeUndefined();expect(repo.rows.get(job.jobId)!.leaseOwner).toBeNull();expect(repo.clipRows.size).toBe(0);
 });
 it('fences a frozen render worker after lease expiry so only the takeover output is checkpointed',async()=>{
  const job=await renderReady(),enteredA=deferred(),gateA=deferred(),enteredB=deferred(),gateB=deferred();
  worker.run.mockImplementationOnce(async(_id:string,_source:string,dir:string,input:any)=>{enteredA.resolve();await gateA.promise;return rendered(dir,input);})
   .mockImplementationOnce(async(_id:string,_source:string,dir:string,input:any)=>{enteredB.resolve();await gateB.promise;return rendered(dir,input);});
  const first=stage(job.jobId,'render',{owner:'worker-a'});await enteredA.promise;
  repo.expire(job.jobId);
  const second=stage(job.jobId,'render',{owner:'worker-b'});await enteredB.promise;
  gateA.resolve();await expect(first).rejects.toThrow('fenced');
  expect(repo.rows.get(job.jobId)!.leaseOwner).toBe('worker-b');expect((await repo.get(org.id,job.jobId)).rendered).toBeUndefined();
  gateB.resolve();await second;
  const dirA=worker.run.mock.calls[1][2],dirB=worker.run.mock.calls[2][2],clips=((await repo.get(org.id,job.jobId)).rendered as any).clips as {path:string}[];
  expect(dirA).not.toBe(dirB);expect(clips.length).toBe(1);expect(clips.every(clip=>clip.path.startsWith(dirB+sep))).toBe(true);
 });
 it('rejects an artifact replaced between verification and publication before journaling or upload',async()=>{
  const job=await verified(),[row]=await repo.clips(org.id,job.jobId),reserve=jest.spyOn(repo,'reserve');
  await writeFile(row.artifactPath,'tampered-output');
  await expect(stage(job.jobId,'publish')).rejects.toThrow('Verified clip artifact changed');
  expect(reserve).not.toHaveBeenCalled();expect(storage.uploadStreamAtKey).not.toHaveBeenCalled();expect(repo.media.size).toBe(0);
 });
 it('retries a failed upload at the same tenant-scoped key and commits exactly one Media',async()=>{
  const job=await verified();
  storage.uploadStreamAtKey.mockImplementationOnce(async(stream:Readable)=>{stream.destroy();throw new Error('storage unavailable (503)');});
  await expect(stage(job.jobId,'publish')).rejects.toThrow('storage unavailable');
  const [journal]=await repo.publications(org.id,job.jobId);
  expect(journal).toMatchObject({status:'prepared',orgId:org.id,mediaId:sourceMediaId(job.jobId,'clip-1')});
  expect(journal.storageKey.startsWith(`source-video/${org.id}/${job.jobId}/`)).toBe(true);
  expect(repo.liveMedia()).toEqual([]);expect((await service.status(org.id,job.jobId)).clips).toEqual([]);
  service=makeService();await stage(job.jobId,'publish',{owner:'restarted-worker'});
  expect(storage.uploadStreamAtKey.mock.calls.map(call=>call[2])).toEqual([journal.storageKey,journal.storageKey]);
  expect([...storage.objects.keys()]).toEqual([journal.storageKey]);
  expect(repo.liveMedia()).toEqual([expect.objectContaining({id:journal.mediaId,organizationId:org.id,path:journal.storagePath})]);
  await service.finish(org.id,job.jobId,'completed');
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'completed',progress:100,clips:[{clipId:'clip-1',media:{id:journal.mediaId}}]});
  expect(storage.removeFile).not.toHaveBeenCalled();
 });
 it('removes the uploaded object when the Media commit fails and the workflow finalizes failure',async()=>{
  const job=await verified();
  jest.spyOn(repo,'commit').mockRejectedValueOnce(new Error('database unavailable'));
  await expect(stage(job.jobId,'publish')).rejects.toThrow('database unavailable');
  const [journal]=await repo.publications(org.id,job.jobId);
  expect(journal.status).toBe('prepared');expect(storage.objects.has(journal.storageKey)).toBe(true);expect(repo.liveMedia()).toEqual([]);
  await service.finish(org.id,job.jobId,'failed','database unavailable');
  expect(storage.removeFile).toHaveBeenCalledWith(journal.storagePath);expect(storage.objects.size).toBe(0);
  expect(await statuses(org.id,job.jobId)).toEqual(['compensated']);expect(repo.media.size).toBe(0);
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'failed',error:'database unavailable',clips:[]});
  await expect(stage(job.jobId,'publish')).rejects.toThrow('Source video cancelled');
 });
 it('compensates committed and prepared clips when a later clip upload fails',async()=>{
  clipCount=2;const job=await verified();
  storage.uploadStreamAtKey.mockImplementationOnce((stream:Readable,_type:string,key:string,signal?:AbortSignal)=>storage.store(stream,key,signal))
   .mockImplementationOnce(async(stream:Readable)=>{stream.destroy();throw new Error('storage unavailable (503)');});
  await expect(stage(job.jobId,'publish')).rejects.toThrow('storage unavailable');
  expect(repo.liveMedia(org.id)).toHaveLength(1);expect((await service.status(org.id,job.jobId)).clips).toHaveLength(1);
  expect(await statuses(org.id,job.jobId)).toEqual(['committed','prepared']);
  await service.finish(org.id,job.jobId,'failed','storage unavailable (503)');
  expect(await statuses(org.id,job.jobId)).toEqual(['compensated','compensated']);
  expect(storage.removeFile).toHaveBeenCalledTimes(2);expect(storage.objects.size).toBe(0);expect(repo.liveMedia()).toEqual([]);
  expect((await repo.clips(org.id,job.jobId)).map(row=>row.mediaId)).toEqual([null,null]);
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'failed',clips:[]});
 });
 it('aborts an in-flight upload on Temporal cancellation and compensates the prepared journal',async()=>{
  const job=await verified(),controller=new AbortController(),entered=deferred();
  storage.uploadStreamAtKey.mockImplementationOnce((stream:Readable,_type:string,_key:string,signal?:AbortSignal)=>new Promise<never>((_resolve,reject)=>{entered.resolve();signal!.addEventListener('abort',()=>{stream.destroy();reject(signal!.reason);},{once:true});}));
  const publishing=stage(job.jobId,'publish',{signal:controller.signal});await entered.promise;
  await service.cancel(org.id,job.jobId);controller.abort(new Error('Activity cancelled'));
  await expect(publishing).rejects.toThrow('Activity cancelled');
  expect(repo.liveMedia()).toEqual([]);expect(storage.objects.size).toBe(0);expect(await statuses(org.id,job.jobId)).toEqual(['prepared']);
  await service.finish(org.id,job.jobId,'cancelled','Source video cancelled');
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'cancelled',clips:[]});expect(await statuses(org.id,job.jobId)).toEqual(['compensated']);
  await expect(stage(job.jobId,'publish')).rejects.toThrow('cancelled');expect(storage.uploadStreamAtKey).toHaveBeenCalledTimes(1);
 });
 it('refuses to commit Media when cancellation lands in the database during upload before any abort signal',async()=>{
  const job=await verified(),commit=jest.spyOn(repo,'commit');
  storage.uploadStreamAtKey.mockImplementationOnce(async(stream:Readable,_type:string,key:string)=>{await service.cancel(org.id,job.jobId);return storage.store(stream,key);});
  await expect(stage(job.jobId,'publish')).rejects.toThrow('fenced or cancelled');
  expect(commit).not.toHaveBeenCalled();expect(repo.liveMedia()).toEqual([]);expect(storage.objects.size).toBe(1);
  await service.finish(org.id,job.jobId,'failed','Source worker lease was fenced or cancelled');
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'cancelled',clips:[]});expect(storage.objects.size).toBe(0);
 });
 const staleUploadAfterFinalization=async()=>{
  const job=await verified(),entered=deferred(),gate=deferred(),commit=jest.spyOn(repo,'commit');
  // Simulates a network PUT already in flight when the activity is abandoned; it ignores the abort signal.
  storage.uploadStreamAtKey.mockImplementationOnce(async(stream:Readable,_type:string,key:string)=>{entered.resolve();await gate.promise;return storage.store(stream,key);});
  const publishing=stage(job.jobId,'publish');await entered.promise;
  await service.finish(org.id,job.jobId,'failed','Source video workflow failed');
  gate.resolve();await expect(publishing).rejects.toThrow('fenced');
  return {job,commit};
 };
 it('fences a stale uploader that finishes after failure finalization so no Media is committed',async()=>{
  const {job,commit}=await staleUploadAfterFinalization();
  expect(commit).not.toHaveBeenCalled();expect(repo.liveMedia()).toEqual([]);expect(await statuses(org.id,job.jobId)).toEqual(['compensated']);
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'failed',error:'Source video workflow failed',clips:[]});
 });
 // Compensation ran before the stale PUT landed; the fenced publisher removes what it wrote.
 it('leaves no storage object from a fenced stale uploader that lands after compensation',async()=>{
  const {job}=await staleUploadAfterFinalization();expect(storage.objects.size).toBe(0);
  expect(await statuses(org.id,job.jobId)).toEqual(['compensated']);expect(repo.liveMedia()).toEqual([]);
 });
 it('surfaces the stage error when lease release also fails',async()=>{
  const job=await renderReady();
  worker.run.mockRejectedValueOnce(new Error('Source video worker failed (1); inspect private worker diagnostics'));
  const release=jest.spyOn(repo,'release').mockRejectedValueOnce(new Error('database unavailable'));
  const log=jest.spyOn(console,'error').mockImplementation(()=>undefined);
  try{await expect(stage(job.jobId,'render')).rejects.toThrow('worker failed');expect(release).toHaveBeenCalledTimes(1);}
  finally{log.mockRestore();}
  repo.expire(job.jobId);release.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(stage(job.jobId,'render')).rejects.toThrow('database unavailable');
 });
 it('retains finalization intent when compensation storage fails and completes it on restart reconciliation',async()=>{
  const job=await published(),[journal]=await repo.publications(org.id,job.jobId);
  await service.cancel(org.id,job.jobId);
  storage.removeFile.mockRejectedValueOnce(Object.assign(new Error('storage unavailable'),{$metadata:{httpStatusCode:503}}));
  await expect(service.finish(org.id,job.jobId,'cancelled','Source video cancelled')).rejects.toThrow('storage unavailable');
  expect(repo.rows.get(job.jobId)).toMatchObject({stage:'finalizing',status:'running',leaseOwner:null});
  expect(await statuses(org.id,job.jobId)).toEqual(['compensating']);expect(repo.liveMedia()).toHaveLength(1);
  expect((await service.status(org.id,job.jobId)).clips).toEqual([]);
  await expect(stage(job.jobId,'publish')).rejects.toThrow('cancelled');
  service=makeService();service.onModuleInit();
  for(let poll=0;poll<200&&(await service.status(org.id,job.jobId)).status!=='cancelled';poll++)await new Promise(resolve=>setTimeout(resolve,10));
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'cancelled',error:'Source video cancelled',clips:[]});
  expect(await statuses(org.id,job.jobId)).toEqual(['compensated']);expect(repo.liveMedia()).toEqual([]);expect(storage.objects.size).toBe(0);
  expect(storage.removeFile.mock.calls).toEqual([[journal.storagePath],[journal.storagePath]]);
 });
 it('ignores late failure, cancellation and duplicate publish after completion',async()=>{
  const job=await published();await service.finish(org.id,job.jobId,'completed');
  await service.finish(org.id,job.jobId,'failed','late duplicate failure');
  await stage(job.jobId,'publish',{owner:'late-retry'});
  expect((await service.cancel(org.id,job.jobId)).status).toBe('completed');
  expect(repo.rows.get(job.jobId)!.cancellationRequested).toBe(false);
  expect(storage.uploadStreamAtKey).toHaveBeenCalledTimes(1);expect(storage.removeFile).not.toHaveBeenCalled();
  expect(repo.liveMedia(org.id)).toHaveLength(1);expect(await statuses(org.id,job.jobId)).toEqual(['committed']);
  expect(await service.status(org.id,job.jobId)).toMatchObject({status:'completed',clips:[{clipId:'clip-1'}]});
 });
 it('keeps publication, compensation and control calls inside the owning tenant',async()=>{
  const own=await published(org.id),foreign=await published(otherOrg.id);
  const [ownJournal]=await repo.publications(org.id,own.jobId),[foreignJournal]=await repo.publications(otherOrg.id,foreign.jobId);
  expect(ownJournal.storageKey.startsWith(`source-video/${org.id}/${own.jobId}/`)).toBe(true);
  expect(foreignJournal.storageKey.startsWith(`source-video/${otherOrg.id}/${foreign.jobId}/`)).toBe(true);
  expect(ownJournal.mediaId).not.toBe(foreignJournal.mediaId);
  for(const call of [()=>service.finish(otherOrg.id,own.jobId,'failed','foreign'),()=>service.cancel(otherOrg.id,own.jobId),()=>service.status(otherOrg.id,own.jobId),()=>stage(own.jobId,'publish',{tenant:otherOrg.id})])await expect(call()).rejects.toThrow('not found');
  await service.finish(otherOrg.id,foreign.jobId,'failed','tenant failure');
  expect(repo.liveMedia(org.id)).toEqual([expect.objectContaining({id:ownJournal.mediaId})]);expect(repo.liveMedia(otherOrg.id)).toEqual([]);
  expect(storage.removeFile.mock.calls).toEqual([[foreignJournal.storagePath]]);expect([...storage.objects.keys()]).toEqual([ownJournal.storageKey]);
  expect(await statuses(org.id,own.jobId)).toEqual(['committed']);expect(repo.rows.get(own.jobId)!.cancellationRequested).toBe(false);
  expect((await service.status(org.id,own.jobId)).status).toBe('running');
 });
});
