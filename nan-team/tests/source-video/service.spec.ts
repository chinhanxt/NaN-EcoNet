import { mkdtemp, writeFile, mkdir, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
jest.mock('../../libraries/nestjs-libraries/src/videos/openshorts/source-video.worker',()=>({SourceVideoWorker:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/remotion/tts.service',()=>({TtsService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service',()=>({SourceVideoMotionService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/database/prisma/media/media.repository',()=>({MediaRepository:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/upload/upload.factory',()=>({UploadFactory:{createStorage:jest.fn()}}));
import { SourceVideoService } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.service';
import { UploadFactory } from '../../libraries/nestjs-libraries/src/upload/upload.factory';
import { SourceReceipt, SourceAnalysisPlan } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.dto';
const org={id:randomUUID()} as any;
const digest=(bytes:string)=>createHash('sha256').update(bytes).digest('hex');
class DurableFixture {
 readonly receipts=new Map<string,SourceReceipt>();readonly output=new Map<string,any>();readonly publicationsMap=new Map<string,any>();readonly media=new Map<string,any>();readonly started=new Set<string>();
 readonly leases=new Map<string,number>();readonly cancelledIds=new Set<string>();
 constructor(readonly directory:string){}
 path(id:string){return join(this.directory,id);}
 async create(orgId:string,input:any,parent?:SourceReceipt,expected?:number,_clip?:unknown,retryOf?:SourceReceipt){
  const existing=[...this.receipts.values()].find(r=>r.orgId===orgId&&r.input.idempotencyKey===input.idempotencyKey&&input.idempotencyKey);if(existing)return structuredClone(existing);
  const latest=[...this.receipts.values()].filter(r=>r.orgId===orgId&&r.state.projectId===parent?.state.projectId).sort((a,b)=>b.state.revision-a.state.revision)[0];
  if(parent&&(!expected||expected!==latest.state.revision))throw new Error('Clip revision changed');
  const id=randomUUID(),workflowId=`source-video-v1-${id}`;
  const receipt:SourceReceipt={orgId,createdAt:Date.now(),updatedAt:Date.now(),input,workflowId,sourcePath:parent?.sourcePath,sourceSha256:parent?.sourceSha256,state:{jobId:id,projectId:parent?.state.projectId||retryOf?.state.projectId||id,revision:(latest?.state.revision||0)+1,...(retryOf?{parentJobId:retryOf.state.jobId}:{}),status:'queued',stage:'queued',progress:0,clips:[],warnings:[]}};
  this.receipts.set(id,structuredClone(receipt));return receipt;
 }
 async get(tenant:string,id:string){const r=this.receipts.get(id);if(!r||r.orgId!==tenant)throw new Error('Video job not found');return {...structuredClone(r),workflowStarted:this.started.has(id)};}
 async webhookStatus():Promise<undefined>{return undefined;}
 async save(r:SourceReceipt,lease?:any){if(lease&&this.leases.get(lease.jobId)!==lease.epoch)throw new Error('fenced');this.receipts.set(r.state.jobId,structuredClone(r));this.versions.set(r.state.jobId,(this.versions.get(r.state.jobId)||0)+1);}
 readonly versions=new Map<string,number>();
 private row(r:SourceReceipt){return {id:r.state.jobId,updatedAt:new Date(this.versions.get(r.state.jobId)||0),status:r.state.status,stage:r.state.stage,progress:r.state.progress};}
 async version(tenant:string,id:string){const r=this.receipts.get(id);if(!r||r.orgId!==tenant)throw new Error('Video job not found');return {...this.row(r),webhookDelivery:null as unknown};}
 async listVersions(tenant:string){return [...this.receipts.values()].filter(r=>r.orgId===tenant).map(r=>this.row(r));}
 async listReceipts(tenant:string,ids:string[]){return [...this.receipts.values()].filter(r=>r.orgId===tenant&&ids.includes(r.state.jobId)).map(r=>({...this.row(r),receipt:structuredClone(r)}));}
 async markStarted(_tenant:string,id:string){this.started.add(id);}
 async acquire(tenant:string,id:string,owner:string){await this.get(tenant,id);if(this.cancelledIds.has(id))throw new Error('cancelled');const epoch=(this.leases.get(id)||0)+1;this.leases.set(id,epoch);return {orgId:tenant,jobId:id,owner,epoch};}
 async renew(lease:any){if(this.leases.get(lease.jobId)!==lease.epoch||this.cancelledIds.has(lease.jobId))throw new Error('fenced');}
 async release(){}
 async plan(r:SourceReceipt,p:SourceAnalysisPlan,lease:any){r.plan=p;r.state.plan=p;await this.save(r,lease);}
 async clips(tenant:string,id:string){await this.get(tenant,id);return [...this.output.values()].filter(c=>c.jobId===id);}
 async clip(lease:any,metadata:any,artifactPath:string,sha256:string,cleanPath?:string){await this.renew(lease);this.output.set(`${lease.jobId}:${metadata.clipId}`,{...metadata,metadata,artifactPath,sha256,cleanPath,orgId:lease.orgId,jobId:lease.jobId});}
 async reserve(lease:any,clipId:string,sha256:string,storageKey:string,storagePath:string){await this.renew(lease);const id=`${lease.jobId}:${clipId}`,prior=this.publicationsMap.get(id);if(prior)return prior;const row={id,orgId:lease.orgId,jobId:lease.jobId,clipId,sha256,storageKey,storagePath,status:'prepared',mediaId:id};this.publicationsMap.set(id,row);return row;}
 async commit(lease:any,p:any){await this.renew(lease);const media={id:p.mediaId,path:p.storagePath};this.media.set(media.id,media);p.status='committed';return media;}
 async cancelled(_tenant:string,id:string){return this.cancelledIds.has(id);}
 async requestCancel(tenant:string,id:string){const receipt=await this.get(tenant,id);this.cancelledIds.add(id);receipt.state.stage='cancelling';await this.save(receipt);}
 async publications(tenant:string,id:string){await this.get(tenant,id);return [...this.publicationsMap.values()].filter(p=>p.jobId===id);}
 async fenceTerminal(_tenant:string,id:string,status:string){this.leases.set(id,(this.leases.get(id)||0)+1);if(status!=='completed')for(const p of this.publicationsMap.values())if(p.jobId===id)p.status='compensating';}
 async compensateOne(_tenant:string,_id:string,id:string){const p=this.publicationsMap.get(id);this.media.delete(p.mediaId);p.status='compensated';}
 async approve(tenant:string,id:string,version:number,plan:SourceAnalysisPlan){const r=await this.get(tenant,id);if(r.state.status!=='awaiting_approval'||r.plan?.planVersion!==version||r.approvedPlan)throw new Error('plan changed');r.approvedPlan=plan;r.state.stage='approved';await this.save(r);return r;}
 async awaitApproval(tenant:string,id:string){const r=this.receipts.get(id);if(!r||r.orgId!==tenant)throw new Error('Video job not found');if(r.approvedPlan||r.state.stage==='approved')return true;r.state.status='awaiting_approval';r.state.stage='awaiting_approval';return false;}
 async list(tenant:string){return [...this.receipts.values()].filter(r=>r.orgId===tenant).map(r=>structuredClone(r));}
 async pendingStarts():Promise<any[]>{return [];}
 async pendingFinalizations():Promise<any[]>{return [];}
 async pendingCancels():Promise<any[]>{return [...this.cancelledIds].map(id=>{const receipt=this.receipts.get(id)!;return {id,orgId:receipt.orgId,workflowId:receipt.workflowId,workflowStarted:this.started.has(id)};}).filter(row=>!['completed','failed','cancelled'].includes(this.receipts.get(row.id)!.state.status));}
}
describe('durable source video orchestration boundary',()=>{
 let root:string,repo:DurableFixture,service:SourceVideoService,worker:any,media:any,temporal:any,storage:any;
 const makeService=()=>new SourceVideoService(repo as any,worker,media,{} as any,temporal,{} as any);
 const stage=(jobId:string,name:any)=>service.executeStage(org.id,jobId,name,randomUUID(),new AbortController().signal,()=>undefined);
 beforeEach(async()=>{
  root=await mkdtemp(join(tmpdir(),'source-stage-'));process.env.FRONTEND_URL='http://fixture.local';process.env.STORAGE_PROVIDER='local';process.env.UPLOAD_DIRECTORY=join(root,'uploads');await mkdir(process.env.UPLOAD_DIRECTORY);await writeFile(join(process.env.UPLOAD_DIRECTORY,'source.mp4'),'fixture-source');
  repo=new DurableFixture(join(root,'jobs'));
  media={getMediaStatus:jest.fn(async(tenant,id)=>tenant===org.id&&id==='source'?{path:'http://fixture.local/uploads/source.mp4',status:'ready'}:null)};
  temporal={client:{getRawClient:()=>({workflow:{start:jest.fn().mockResolvedValue({}),getHandle:()=>({cancel:jest.fn(),signal:jest.fn()})}})}};
  worker={run:jest.fn(async(_id,_source,dir,input)=>{
   if(input.phase==='analyze')return {phase:'analyze',clips:[],plan:{version:1,planVersion:1,sourceFingerprint:digest('fixture-source'),engineFingerprint:'engine',requestFingerprint:'request',media:{durationSeconds:60},clips:[{clipId:'clip',title:'Clip',segments:[{startSeconds:0,endSeconds:12}],aspectRatio:input.aspectRatio||'9:16',layout:'wide'}]}};
   const path=join(dir,'clip.mp4');await writeFile(path,'fixture-output');return {phase:'render',clips:[{clipId:'clip',path,title:input.plan.clips[0].title,segments:input.plan.clips[0].segments,durationSeconds:12,aspectRatio:input.aspectRatio||'9:16'}]};
  }),verify:jest.fn().mockResolvedValue({}),command:jest.fn()};
  storage={publicUrl:(key:string)=>`https://storage.example/${key}`,uploadStreamAtKey:jest.fn().mockResolvedValue({}),removeFile:jest.fn().mockResolvedValue({})};jest.mocked(UploadFactory.createStorage).mockReturnValue(storage);
  service=makeService();
 });
 afterEach(async()=>{service.onModuleDestroy();await rm(root,{recursive:true,force:true});});
 const renderReady=async(review=false)=>{const started=await service.start(org,{mediaId:'source',reviewBeforeRender:review});await stage(started.jobId,'prepare');await stage(started.jobId,'analyze');return started;};
 it('aborts ZIP requests before lookup and interrupts artifact hashing',async()=>{
  const cancelled=new AbortController();cancelled.abort(new Error('disconnected'));
  const lookup=jest.spyOn(repo,'get');
  await expect(service.downloadAll(org.id,randomUUID(),cancelled.signal)).rejects.toThrow('disconnected');
  expect(lookup).not.toHaveBeenCalled();expect(worker.command).not.toHaveBeenCalled();
  const file=join(root,'hash-source');await writeFile(file,Buffer.alloc(4*1024*1024));
  const controller=new AbortController(),pending=(service as any).hash(file,controller.signal);
  const rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});controller.abort();await rejected;
 });
 it('serves lean polling snapshots from a version-keyed cache and keeps full status for transcripts',async()=>{
  const job=await renderReady(),receipt=await repo.get(org.id,job.jobId);
  receipt.state.plan={...receipt.state.plan!,transcript:{segments:[{start:0,end:1,text:'large transcript'}]}};
  receipt.state.clips=[{clipId:'clip',title:'Clip',durationSeconds:12,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:12}],transcript:{text:'clip transcript'},media:{id:'m',path:'p'},sha256:'h'}];
  await repo.save(receipt);
  const get=jest.spyOn(repo,'get');get.mockClear();
  const first=await service.summary(org.id,job.jobId);
  expect(JSON.stringify(first)).not.toContain('large transcript');expect(JSON.stringify(first)).not.toContain('clip transcript');
  expect(first).toMatchObject({detail:'summary',plan:{planVersion:1,transcriptOmitted:true,clips:[{clipId:'clip'}]},clips:[{clipId:'clip',transcriptOmitted:true,media:{id:'m'}}]});
  const version=jest.spyOn(repo,'version');get.mockClear();
  // Unchanged row: only the small version probe runs, the receipt JSON is not re-read.
  await service.summary(org.id,job.jobId);await service.summary(org.id,job.jobId);
  expect(version).toHaveBeenCalledTimes(2);expect(get).not.toHaveBeenCalled();
  receipt.state.progress=77;await repo.save(receipt);
  expect((await service.summary(org.id,job.jobId)).progress).toBe(77);
  expect((await service.status(org.id,job.jobId)).plan?.transcript).toEqual({segments:[{start:0,end:1,text:'large transcript'}]});
  await expect(service.summary('other',job.jobId)).rejects.toThrow('not found');
 });
 it('refreshes the summary on a receipt-only write in the same updatedAt ms (clip count in the version key)',async()=>{
  const job=await renderReady(),at=new Date(1_700_000_000_000);
  const probe=jest.spyOn(repo,'version').mockResolvedValueOnce({updatedAt:at,status:'running',stage:'render',progress:40,clipCount:0,webhookDelivery:null} as any)
   .mockResolvedValueOnce({updatedAt:at,status:'running',stage:'render',progress:40,clipCount:1,webhookDelivery:null} as any);
  const get=jest.spyOn(repo,'get');get.mockClear();
  await service.summary(org.id,job.jobId);
  const receipt=await repo.get(org.id,job.jobId);receipt.state.clips=[{clipId:'late',title:'Late',durationSeconds:5,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:5}],media:{id:'m2',path:'p2'},sha256:'h2'}] as any;await repo.save(receipt);get.mockClear();
  expect((await service.summary(org.id,job.jobId)).clips.map(c=>c.clipId)).toEqual(['late']);expect(get).toHaveBeenCalledTimes(1);
  probe.mockRestore();
 });
 it('list() keeps every fresh row even when the LRU evicts them while receipts load',async()=>{
  const one=await renderReady(),two=await renderReady();
  await service.list(org.id);
  const cache=(service as any).summaries as Map<string,unknown>,load=repo.listReceipts.bind(repo);
  const three=await renderReady();
  jest.spyOn(repo,'listReceipts').mockImplementationOnce(async(tenant:string,ids:string[])=>{cache.delete(one.jobId);cache.delete(two.jobId);return load(tenant,ids);});
  const listed=await service.list(org.id);
  expect(listed.map(j=>j.jobId).sort()).toEqual([one.jobId,two.jobId,three.jobId].sort());
 });
 it('lists lean snapshots and re-reads receipts only for rows that changed',async()=>{
  const one=await renderReady(),two=await renderReady(),read=jest.spyOn(repo,'listReceipts');
  const first=await service.list(org.id);
  expect(first.map(j=>j.jobId).sort()).toEqual([one.jobId,two.jobId].sort());expect(read.mock.calls[0][1]).toHaveLength(2);
  await service.list(org.id);expect(read.mock.calls[1][1]).toHaveLength(0);
  const receipt=await repo.get(org.id,two.jobId);receipt.state.stage='rendering';await repo.save(receipt);
  const next=await service.list(org.id);expect(read.mock.calls[2][1]).toEqual([two.jobId]);
  expect(next.find(j=>j.jobId===two.jobId)?.stage).toBe('rendering');expect(await service.list('other')).toEqual([]);
 });
 it('rejects foreign source media and invalid ranges before creating a durable job',async()=>{
  await expect(service.start({id:'other'} as any,{mediaId:'source'})).rejects.toThrow('Ready source media');await expect(service.start(org,{mediaId:'source',segments:[{startSeconds:12,endSeconds:4}]})).rejects.toThrow('range');expect(repo.receipts.size).toBe(0);
 });
 it('retries only failed or cancelled jobs of the same org from the stored input, linked to the failed job',async()=>{
  const started=await service.start(org,{mediaId:'source',aspectRatio:'16:9'});
  await expect(service.retry(org,started.jobId)).rejects.toThrow('Chỉ có thể thử lại');
  const failed=await repo.get(org.id,started.jobId);failed.state.status='failed';failed.state.stage='failed';await repo.save(failed);
  await expect(service.retry({id:'other'} as any,started.jobId)).rejects.toThrow('not found');
  const retried=await service.retry(org,started.jobId);
  const receipt=await repo.get(org.id,retried.jobId);
  expect(retried.jobId).not.toBe(started.jobId);
  expect(receipt.state).toMatchObject({parentJobId:started.jobId,projectId:started.projectId,status:'queued'});
  expect(receipt.input).toMatchObject({mediaId:'source',aspectRatio:'16:9',idempotencyKey:`retry-${started.jobId}`});
  expect((await service.retry(org,started.jobId)).jobId).toBe(retried.jobId);
  media.getMediaStatus.mockResolvedValueOnce(null);
  const gone=await repo.get(org.id,retried.jobId);gone.state.status='cancelled';await repo.save(gone);
  await expect(service.retry(org,retried.jobId)).rejects.toThrow('không còn tồn tại');
 });
 it('coalesces bursty worker progress saves but persists stage changes and keeps progress monotonic',async()=>{
  const started=await service.start(org,{mediaId:'source'});await stage(started.jobId,'prepare');
  const analyze=worker.run.getMockImplementation();
  worker.run.mockImplementationOnce(async(id:string,source:string,dir:string,input:any,signal:AbortSignal,progress:(p:number,s:string)=>void)=>{
   for(let value=1;value<=30;value++)progress(value,'transcribing');progress(10,'transcribing');progress(35,'planning');
   return analyze(id,source,dir,input,signal,progress);
  });
  const stages:string[]=[];const save=repo.save.bind(repo);repo.save=async(receipt,lease)=>{stages.push(receipt.state.stage);return save(receipt,lease);};
  await stage(started.jobId,'analyze');
  expect(stages.filter(value=>value==='transcribing')).toHaveLength(1);expect(stages).toContain('planning');
  expect((await repo.get(org.id,started.jobId)).state.progress).toBe(35);
 });
 it('preserves caption appearance from durable input through worker and motion render',async()=>{
  const job=await renderReady();const receipt=await repo.get(org.id,job.jobId);
  const captions={enabled:true,style:'pop',position:'middle',fontName:'Anton',fontSize:24,
   fontColor:'#FFFF00',borderColor:'#000000',borderWidth:2,highlightColor:'#00FFFF',
   bgColor:'#112233',bgOpacity:.6,baseOpacity:.7,effect:'pop',uppercase:true} as const;
  receipt.input={...receipt.input,captions,motionDesign:{enabled:true}};await repo.save(receipt);
  const motion=jest.fn(async(clip:any,..._rest:any[])=>({path:clip.path}));(service as any).motion={render:motion};
  await stage(job.jobId,'render');
  expect(worker.run.mock.calls[1][3].captions).toEqual(captions);
  expect(motion.mock.calls[0][2].captions).toEqual(captions);
 });
 it('leaves queued/running state intact across backend restart and resumes from persisted analysis without rerunning AI',async()=>{
  const job=await renderReady();const before=await service.status(org.id,job.jobId);service=makeService();expect(await service.status(org.id,job.jobId)).toEqual(before);
  await stage(job.jobId,'prepare');await stage(job.jobId,'analyze');expect(worker.run).toHaveBeenCalledTimes(1);await stage(job.jobId,'render');expect(worker.run.mock.calls[1][3].plan.clips).toEqual(before.plan?.clips);
 });
 it('pauses for versioned editable approval and renders exactly the approved plan after reconnect',async()=>{
  const job=await renderReady(true);expect(await service.reviewState(org.id,job.jobId)).toEqual({required:true,approved:false});expect(worker.run).toHaveBeenCalledTimes(1);
  await expect(stage(job.jobId,'render')).rejects.toThrow('requires approval');service=makeService();
  await service.approve(org,job.jobId,{expectedPlanVersion:1,clips:[{clipId:'clip',title:'Approved title',segments:[{startSeconds:4,endSeconds:16}]}]});
  expect(await service.reviewState(org.id,job.jobId)).toEqual({required:true,approved:true});await stage(job.jobId,'render');expect(worker.run.mock.calls[1][3].plan.clips[0]).toMatchObject({title:'Approved title',segments:[{startSeconds:4,endSeconds:16}]});
 });
 it('approval polling never overwrites an approval committed after its stale read',async()=>{
  const job=await renderReady(true);const stale=await repo.get(org.id,job.jobId);
  await service.reviewState(org.id,job.jobId);
  await service.approve(org,job.jobId,{expectedPlanVersion:1,clips:[{clipId:'clip',title:'Approved title',segments:[{startSeconds:4,endSeconds:16}]}]});
  const get=jest.spyOn(repo,'get').mockResolvedValueOnce(stale as any);
  expect(await service.reviewState(org.id,job.jobId)).toEqual({required:true,approved:true});get.mockRestore();
  expect((await repo.get(org.id,job.jobId)).approvedPlan?.clips[0]).toMatchObject({title:'Approved title'});
 });
 it('fails an unwritable job directory with a clear non-retryable storage error instead of a raw EACCES',async()=>{
  const started=await service.start(org,{mediaId:'source'});await mkdir(repo.directory,{recursive:true});await chmod(repo.directory,0o500);
  try{await expect(stage(started.jobId,'prepare')).rejects.toMatchObject({name:'SourceVideoStorageError',message:expect.stringContaining('Không có quyền truy cập')});}
  finally{await chmod(repo.directory,0o700);}
  expect(worker.run).not.toHaveBeenCalled();
 });
 it('maps an engine disk-full failure (Errno 28) to a clear storage error',async()=>{
  const started=await service.start(org,{mediaId:'source'});await stage(started.jobId,'prepare');
  worker.run.mockRejectedValueOnce(new Error("[Errno 28] No space left on device: 'segment.wav'"));
  await expect(stage(started.jobId,'analyze')).rejects.toMatchObject({name:'SourceVideoStorageError',message:expect.stringContaining('Ổ đĩa đã đầy (ENOSPC)')});
  worker.run.mockRejectedValueOnce(new Error('AGY timed out'));
  await expect(stage(started.jobId,'analyze')).rejects.toMatchObject({name:'Error',message:'AGY timed out'});
 });
 it('retries a render stage killed mid-run (worker restart) in a fresh attempt directory and publishes once',async()=>{
  const job=await renderReady();
  worker.run.mockImplementationOnce(async()=>{throw new Error('Source video worker failed (null); inspect private worker diagnostics');});
  await expect(stage(job.jobId,'render')).rejects.toThrow('worker failed');
  expect((await repo.get(org.id,job.jobId)).rendered).toBeUndefined();
  service=makeService();await stage(job.jobId,'render');
  const dirs=worker.run.mock.calls.slice(1).map((call:any[])=>call[2]);expect(new Set(dirs).size).toBe(2);
  await stage(job.jobId,'render');expect(worker.run).toHaveBeenCalledTimes(3);
  await stage(job.jobId,'verify');await stage(job.jobId,'publish');await service.finish(org.id,job.jobId,'completed');
  expect(storage.uploadStreamAtKey).toHaveBeenCalledTimes(1);expect(await service.status(org.id,job.jobId)).toMatchObject({status:'completed'});
 });
 it('verifies fully before any journal/publication and retains no claimed Media after decode failure',async()=>{
  const job=await renderReady();await stage(job.jobId,'render');worker.verify.mockRejectedValue(new Error('decode failed'));await expect(stage(job.jobId,'verify')).rejects.toThrow('decode');expect(repo.publicationsMap.size).toBe(0);expect(storage.uploadStreamAtKey).not.toHaveBeenCalled();
 });
 it('survives upload then backend crash before receipt persistence without duplicate media or new storage keys',async()=>{
  const job=await renderReady();await stage(job.jobId,'render');await stage(job.jobId,'verify');
  const save=repo.save.bind(repo);let failed=false;repo.save=async(receipt,lease)=>{if(receipt.state.clips.length&&!failed){failed=true;throw new Error('backend crash after commit');}return save(receipt,lease);};
  await expect(stage(job.jobId,'publish')).rejects.toThrow('backend crash');expect(repo.media.size).toBe(1);service=makeService();await stage(job.jobId,'publish');await service.finish(org.id,job.jobId,'completed');
  expect(repo.media.size).toBe(1);expect(storage.uploadStreamAtKey).toHaveBeenCalledTimes(1);expect(await service.status(org.id,job.jobId)).toMatchObject({status:'completed',clips:[{media:{id:expect.any(String)}}]});
 });
 it('compensates a cancelled journal and fences stale publication writes',async()=>{
  const job=await renderReady();await stage(job.jobId,'render');await stage(job.jobId,'verify');await stage(job.jobId,'publish');await repo.requestCancel(org.id,job.jobId);await service.finish(org.id,job.jobId,'cancelled');expect(repo.media.size).toBe(0);expect(storage.removeFile).toHaveBeenCalledTimes(1);expect(await service.status(org.id,job.jobId)).toMatchObject({status:'cancelled',clips:[]});
 });
 it('cancels a live Temporal execution even when the start acknowledgement was lost',async()=>{
  const cancel=jest.fn().mockResolvedValue(undefined),start=jest.fn().mockResolvedValue({});
  temporal.client.getRawClient=()=>({workflow:{start,getHandle:()=>({cancel})}});
  repo.markStarted=jest.fn().mockRejectedValueOnce(new Error('backend lost start acknowledgement')) as any;
  await expect(service.start(org,{mediaId:'source'})).rejects.toThrow('start acknowledgement');
  const receipt=[...repo.receipts.values()][0];receipt.state.status='running';receipt.state.stage='analyzing';repo.receipts.set(receipt.state.jobId,receipt);
  expect(start).toHaveBeenCalledTimes(1);expect(repo.started.has(receipt.state.jobId)).toBe(false);
  await service.cancel(org.id,receipt.state.jobId);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect((await service.status(org.id,receipt.state.jobId)).status).toBe('running');
  service.onModuleInit();
  await new Promise(resolve=>setTimeout(resolve,50));
  expect(cancel).toHaveBeenCalledTimes(2);
  expect((await service.status(org.id,receipt.state.jobId)).status).toBe('running');
 });
 it('finalizes a cancelled queued job only after Temporal confirms no workflow exists',async()=>{
  const missing=Object.assign(new Error('missing'),{name:'WorkflowNotFoundError'});
  temporal.client.getRawClient=()=>({workflow:{start:jest.fn(),getHandle:()=>({cancel:jest.fn().mockRejectedValue(missing)})}});
  const receipt=await repo.create(org.id,{mediaId:'source'});
  await service.cancel(org.id,receipt.state.jobId);
  expect((await service.status(org.id,receipt.state.jobId)).status).toBe('cancelled');
 });
 it('checks tenant ownership for status, approval, revisions, cancellation and ZIP',async()=>{
  const job=await renderReady();for(const call of [()=>service.status('other',job.jobId),()=>service.approve({id:'other'} as any,job.jobId,{expectedPlanVersion:1}),()=>service.cancel('other',job.jobId),()=>service.downloadAll('other',job.jobId)])await expect(call()).rejects.toThrow('not found');expect(await service.list('other')).toEqual([]);
 });
 it('preserves framing and narration when a revision changes only caption style and BGM',async()=>{
  const job=await renderReady();const parent=await repo.get(org.id,job.jobId);
  parent.input={...parent.input,aspectRatio:'16:9',layout:'speaker-cut',audio:{mode:'mix-narration',voice:'Thuyết Minh',narrationText:'Giữ lời thuyết minh',bgmMediaId:'old-bgm'},captions:{enabled:true,style:'karaoke'},hook:{enabled:true,text:'Keep this hook'},motionDesign:{enabled:true,theme:'bold'}};
  parent.state.status='completed';parent.state.clips=[{clipId:'clip',title:'Clip',segments:[{startSeconds:4,endSeconds:16}],durationSeconds:12,aspectRatio:'16:9',media:{id:'saved',path:'https://storage.example/clip.mp4'},sha256:'hash'}];await repo.save(parent);
  const revision=await service.revise(org,job.jobId,{clipId:'clip',expectedRevision:1,captions:{style:'neon'},audio:{bgmMediaId:'new-bgm'}});
  expect((await repo.get(org.id,revision.jobId)).input).toMatchObject({aspectRatio:'16:9',layout:'speaker-cut',operation:'edit',segments:[{startSeconds:4,endSeconds:16}],audio:{mode:'mix-narration',voice:'Thuyết Minh',narrationText:'Giữ lời thuyết minh',bgmMediaId:'new-bgm'},captions:{enabled:true,style:'neon'},hook:parent.input.hook,motionDesign:parent.input.motionDesign});
  await expect(service.revise(org,job.jobId,{clipId:'clip',expectedRevision:1,captions:{enabled:false}})).rejects.toThrow('revision changed');
 });
 it('keeps the parent framing when a revision sends the studio default layout auto',async()=>{
  const job=await renderReady();const parent=await repo.get(org.id,job.jobId);
  parent.input={...parent.input,aspectRatio:'9:16',layout:'speaker-cut'};parent.state.status='completed';
  parent.state.clips=[{clipId:'clip',title:'Clip',segments:[{startSeconds:4,endSeconds:16}],durationSeconds:12,aspectRatio:'9:16',media:{id:'saved',path:'https://storage.example/clip.mp4'},sha256:'hash'}];await repo.save(parent);
  const kept=await service.revise(org,job.jobId,{clipId:'clip',expectedRevision:1,layout:'auto',segments:[{startSeconds:5,endSeconds:12}]});
  expect((await repo.get(org.id,kept.jobId)).input.layout).toBe('speaker-cut');
  const changed=await service.revise(org,job.jobId,{clipId:'clip',expectedRevision:2,layout:'general'});
  expect((await repo.get(org.id,changed.jobId)).input.layout).toBe('general');
 });
});
