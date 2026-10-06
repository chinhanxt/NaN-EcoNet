import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { TemporalService } from 'nestjs-temporal-core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, realpath, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { MediaRepository } from '../../database/prisma/media/media.repository';
import { UploadFactory } from '../../upload/upload.factory';
import { SourceVideoDto, ReviseSourceVideoDto, SourceReceipt, SourceJobStatus, ApproveSourceVideoDto, SourceAnalysisPlan } from './source-video.dto';
import { SourceVideoRepository, SourceStageLease, SOURCE_TERMINAL_STATUSES, sourceDigest } from './source-video.repository';
import { SourceVideoWorker, WorkerResult, WorkerClip } from './source-video.worker';
import { TtsService, VietnameseVoice } from '../remotion/tts.service';
import { SourceVideoMotionService } from '../source-motion/source-video-motion.service';
import { copyUploadedSource, downloadSource, privatePath } from './source-video.source';
export type SourceVideoStage='prepare'|'analyze'|'render'|'verify'|'publish';
const terminal=new Set(SOURCE_TERMINAL_STATUSES);
const storageCodes:Record<string,string>={ENOSPC:'Ổ đĩa đã đầy',EDQUOT:'Đã vượt hạn mức dung lượng ổ đĩa',EROFS:'Thư mục job chỉ cho phép đọc',EACCES:'Không có quyền truy cập tệp hoặc thư mục job',EPERM:'Không có quyền truy cập tệp hoặc thư mục job'};
/** Maps disk-full / unwritable job directory failures (Node fs codes or engine OSError text) to a clear, non-retryable error. */
export function sourceStorageError(error:unknown):Error|undefined {
 const code=(error as {code?:unknown})?.code,message=error instanceof Error?error.message:String(error??'');
 const detected=typeof code==='string'&&storageCodes[code]?code:/No space left on device|Errno 28\b/i.test(message)?'ENOSPC':/Disk quota exceeded|Errno 122\b/i.test(message)?'EDQUOT':/Read-only file system|Errno 30\b/i.test(message)?'EROFS':undefined;
 if(!detected)return undefined;
 const failure=new Error(`${storageCodes[detected]} (${detected}) khi xử lý video; hãy giải phóng dung lượng hoặc sửa quyền thư mục job rồi tạo lại job. Source video storage failure: ${detected}`);
 failure.name='SourceVideoStorageError';return failure;
}
@Injectable()
export class SourceVideoService implements OnModuleInit,OnModuleDestroy {
 private reconciliation?:ReturnType<typeof setInterval>;
 constructor(private readonly repository:SourceVideoRepository,private readonly worker:SourceVideoWorker,
  private readonly media:MediaRepository,private readonly tts:TtsService,private readonly temporal:TemporalService,
  private readonly motion:SourceVideoMotionService){}
 private async validated<T extends object>(type:new()=>T,input:T) {
  const dto=plainToInstance(type,input);
  const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true,forbidUnknownValues:true});
  if(errors.length)throw new BadRequestException('Invalid source video request: '+errors.map(e=>e.property).join(', '));
  return dto;
 }
 private settings(dto:SourceVideoDto) {
  if(dto.segments?.some(s=>s.endSeconds<=s.startSeconds)||(dto.selection?.minSeconds&&dto.selection.maxSeconds&&dto.selection.minSeconds>dto.selection.maxSeconds))throw new BadRequestException('Invalid source segment/duration range');
  if(dto.effects?.some(e=>e.end<=e.start))throw new BadRequestException('Invalid effect range');
  if(dto.cropOverrides){
   const point=(v:any):boolean=>typeof v==='number'?Number.isFinite(v)&&v>=0&&v<=1:!!v&&Object.keys(v).every(k=>['x','y'].includes(k))&&typeof v.x==='number'&&typeof v.y==='number'&&point(v.x)&&point(v.y);
   if(Object.entries(dto.cropOverrides).length>100||Object.entries(dto.cropOverrides).some(([k,v])=>!/^\d{1,5}$/.test(k)||Number(k)>10000||!(typeof v==='number'?point(v):v&&Object.keys(v).every(key=>['top','bottom'].includes(key))&&point(v.top)&&point(v.bottom))))throw new BadRequestException('Invalid manual crop overrides');
  }
 }
 private enabled(){if(process.env.SOURCE_VIDEO_ENABLED==='false')throw new HttpException('Source video creation is disabled',503);}
 async start(org:Organization,input:SourceVideoDto) {
  this.enabled();
  if(!org?.id)throw new BadRequestException('Organization is required');
  const dto=await this.validated(SourceVideoDto,input);this.settings(dto);
  if(!!dto.mediaId===!!dto.sourceUrl)throw new BadRequestException('Provide exactly one mediaId or sourceUrl');
  if(dto.mediaId)await this.readyMedia(org.id,dto.mediaId,'Ready source media not found');
  const receipt=await this.repository.create(org.id,dto);await this.dispatch(receipt);
  return this.started(receipt);
 }
 /** Re-dispatches a failed/cancelled job's stored input as a new job (fresh idempotency key, parentJobId → the failed job). */
 async retry(org:Organization,jobId:string) {
  this.enabled();
  if(!org?.id)throw new BadRequestException('Organization is required');
  const previous=await this.repository.get(org.id,jobId);
  if(!['failed','cancelled'].includes(previous.state.status))throw new ConflictException('Chỉ có thể thử lại tác vụ đã thất bại hoặc đã hủy.');
  const {idempotencyKey:_previousKey,...input}=previous.input;
  if(input.mediaId)await this.readyMedia(org.id,input.mediaId,'Video nguồn trong kho media không còn tồn tại hoặc chưa sẵn sàng. Hãy chọn lại video nguồn rồi tạo mới.');
  const dto=await this.validated(SourceVideoDto,input);this.settings(dto);
  // One retry per failed job: a double click or client retry returns the same new job.
  const receipt=await this.repository.create(org.id,{...dto,idempotencyKey:`retry-${jobId}`},undefined,undefined,undefined,previous);await this.dispatch(receipt);
  return this.started(receipt);
 }
 private started(receipt:SourceReceipt){return {jobId:receipt.state.jobId,projectId:receipt.state.projectId,revision:receipt.state.revision,workflowId:receipt.workflowId};}
 private async dispatch(receipt:SourceReceipt) {
  if(terminal.has(receipt.state.status)||await this.repository.cancelled(receipt.orgId,receipt.state.jobId))return;
  const client=this.temporal.client.getRawClient();
  if(!client)throw new HttpException('Temporal is unavailable; persisted job will be retried',503);
  try{
   await client.workflow.start('sourceVideoWorkflowV1',{workflowId:receipt.workflowId!,taskQueue:'main',args:[{orgId:receipt.orgId,jobId:receipt.state.jobId}],workflowExecutionTimeout:'48 hours',workflowIdReusePolicy:'REJECT_DUPLICATE'});
  }catch(error:any){if(error.name!=='WorkflowExecutionAlreadyStartedError')throw error;}
  await this.repository.markStarted(receipt.orgId,receipt.state.jobId);
  if(await this.repository.cancelled(receipt.orgId,receipt.state.jobId))await this.cancelWorkflow(receipt.orgId,receipt.state.jobId,receipt.workflowId!);
 }
 private async cancelWorkflow(orgId:string,jobId:string,workflowId:string) {
  const client=this.temporal.client.getRawClient();
  if(!client)return;
  try{await client.workflow.getHandle(workflowId).cancel();}
  catch(error:any){
   if(error.name!=='WorkflowNotFoundError')throw error;
   // Only a confirmed missing execution may be finalized here. The durable
   // workflowStarted flag can lag behind a successfully started workflow.
   await this.finish(orgId,jobId,'cancelled','Source video cancelled');
  }
 }
 async onModuleInit() {
  const reconcile=async()=>{
   for(const row of await this.repository.pendingStarts())try{await this.dispatch(row.receipt as unknown as SourceReceipt);}catch{console.error('Source workflow outbox retry pending',row.id);}
   for(const row of await this.repository.pendingFinalizations())try{const intent=(row.receipt as unknown as SourceReceipt).finalization;if(intent)await this.finish(row.orgId,row.id,intent.status,intent.message);}catch{console.error('Source finalization outbox retry pending',row.id);}
   for(const row of await this.repository.pendingCancels())try{
    await this.cancelWorkflow(row.orgId,row.id,row.workflowId);
   }catch{console.error('Source cancellation outbox retry pending',row.id);}
  };
  void reconcile().catch(()=>undefined);
  this.reconciliation=setInterval(()=>void reconcile().catch(()=>undefined),15_000);this.reconciliation.unref();
 }
 onModuleDestroy(){if(this.reconciliation)clearInterval(this.reconciliation);}
 /** Full status, including source/clip transcripts (evidence, transcript export, ZIP). */
 async status(orgId:string,jobId:string):Promise<SourceJobStatus>{
  const receipt=await this.repository.get(orgId,jobId);const webhook=await this.repository.webhookStatus(orgId,jobId);
  return {...this.view(receipt),...(webhook?{webhook}:{})};
 }
 private view(receipt:SourceReceipt):SourceJobStatus{
  const state=receipt.state;
  // A failure/cancel finalization intent is compensating these Media; never expose them as deliverables.
  const compensating=state.stage==='finalizing'&&!!receipt.finalization&&receipt.finalization.status!=='completed';
  return {...state,...(compensating?{clips:[]}:{})};
 }
 /** Lean polling snapshots keyed by row version; transcripts stay behind GET ?include=transcript / transcript(). */
 private summaries=new Map<string,{orgId:string;version:string;state:SourceJobStatus}>();
 private remember(jobId:string,orgId:string,version:string,receipt:SourceReceipt,updatedAt:Date){
  const {plan,clips,...state}=this.view(receipt);
  const lean:SourceJobStatus={...state,...(plan?{plan:{...plan,transcript:undefined,transcriptOmitted:plan.transcript!==undefined}}:{}),
   clips:clips.map(({transcript,...clip})=>({...clip,transcriptOmitted:transcript!==undefined})),detail:'summary',updatedAt:updatedAt.toISOString()};
  this.summaries.delete(jobId);this.summaries.set(jobId,{orgId,version,state:lean});
  if(this.summaries.size>500)this.summaries.delete(this.summaries.keys().next().value as string);
  return lean;
 }
 // Clip rows count in the key so a clip push landing in the same updatedAt ms still refreshes. Known limit: a receipt-only
 // write (plan/agyEvents) in the same ms as the previous write, with no column change, stays cached until the next write.
 private static version(row:{updatedAt:Date;status:string;stage:string;progress:number;clipCount?:number}){return `${row.updatedAt.getTime()}:${row.status}:${row.stage}:${row.progress}:${row.clipCount??''}`;}
 /** Polling status: one small version query per poll; the receipt JSON is read only when the job row changed. */
 async summary(orgId:string,jobId:string):Promise<SourceJobStatus>{
  const row=await this.repository.version(orgId,jobId),version=SourceVideoService.version(row),cached=this.summaries.get(jobId);
  if(cached&&cached.orgId===orgId&&cached.version===version){this.summaries.delete(jobId);this.summaries.set(jobId,cached);}
  const state=cached&&cached.orgId===orgId&&cached.version===version?cached.state:this.remember(jobId,orgId,version,await this.repository.get(orgId,jobId),row.updatedAt);
  return {...state,...(row.webhookDelivery?{webhook:row.webhookDelivery}:{})};
 }
 async capabilities(){return this.worker.capabilities();}
 async sourceScenes(orgId:string,jobId:string):Promise<unknown[]> {
  const receipt=await this.repository.get(orgId,jobId);
  if(!receipt.plan)throw new ConflictException('Source analysis is not available yet');
  return receipt.plan.scenes||[];
 }
 async cropScenes(orgId:string,jobId:string,clipId:string):Promise<unknown[]> {
  const receipt=await this.repository.get(orgId,jobId);
  if(receipt.state.status!=='completed'||!receipt.state.clips.some(clip=>clip.clipId===clipId))throw new NotFoundException('Completed clip not found');
  const clip=(await this.repository.clips(orgId,jobId)).find(clip=>clip.clipId===clipId);
  const metadata=clip?.metadata as {renderDecision?:{cropScenes?:unknown[]}}|undefined;
  if(!Array.isArray(metadata?.renderDecision?.cropScenes))throw new ConflictException('This clip has no verified crop scene manifest; render a new source revision before selecting scene indices');
  return metadata.renderDecision.cropScenes;
 }
 async cancel(orgId:string,jobId:string) {
  const receipt=await this.repository.get(orgId,jobId);
  if(!terminal.has(receipt.state.status)){
   await this.repository.requestCancel(orgId,jobId);
   await this.cancelWorkflow(orgId,jobId,receipt.workflowId!);
  }
  return this.status(orgId,jobId);
 }
 async approve(org:Organization,jobId:string,input:ApproveSourceVideoDto) {
  const dto=await this.validated(ApproveSourceVideoDto,input),receipt=await this.repository.get(org.id,jobId);
  if(!receipt.plan)throw new ConflictException('Source plan is unavailable');
  const plan=JSON.parse(JSON.stringify(receipt.plan)) as SourceAnalysisPlan;
  if(dto.clips){
   const seen=new Set<string>();
   plan.clips=dto.clips.map(approved=>{
    const original=plan.clips.find(c=>c.clipId===approved.clipId);
    if(!original||seen.has(approved.clipId)||approved.segments.some(s=>s.endSeconds<=s.startSeconds||s.endSeconds>Number(plan.media?.durationSeconds)))throw new BadRequestException('Invalid approved source clip');
    seen.add(approved.clipId);return {...original,title:approved.title,segments:approved.segments};
   });
  }
  await this.repository.approve(org.id,jobId,dto.expectedPlanVersion,plan);
  const client=this.temporal.client.getRawClient();
  if(client)try{await client.workflow.getHandle(receipt.workflowId!).signal('sourceVideoApproveV1');}catch{console.error('Source approval wakeup pending; workflow will read persisted approval',jobId);}
  return this.status(org.id,jobId);
 }
 async revise(org:Organization,jobId:string,input:ReviseSourceVideoDto) {
  this.enabled();
  const dto=await this.validated(ReviseSourceVideoDto,input);this.settings(dto);
  if(dto.mediaId||dto.sourceUrl)throw new BadRequestException('A revision uses the original source');
  const parent=await this.repository.get(org.id,jobId),clip=parent.state.clips.find(c=>c.clipId===dto.clipId);
  if(parent.state.status!=='completed'||!clip||!parent.sourcePath)throw new NotFoundException('Completed clip not found');
  const {clipId,expectedRevision,...rawSettings}=dto;
  // Class fields can exist with undefined values after DTO transformation.
  const defined=<T extends object>(value:T):T=>Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined)) as T;
  const settings=defined(rawSettings);
  const inherit=<T extends object>(previous:T|undefined,update:T|undefined):T|undefined=>update?{...previous,...defined(update)}:previous;
  const merged={...parent.input,...settings,
   audio:inherit(parent.input.audio,settings.audio),captions:inherit(parent.input.captions,settings.captions),
   hook:inherit(parent.input.hook,settings.hook),motionDesign:inherit(parent.input.motionDesign,settings.motionDesign),
   selection:inherit(parent.input.selection,settings.selection),
   // 'auto' (the studio default) keeps the parent's framing: re-deciding it would drop the base crop decisions.
   layout:settings.layout&&settings.layout!=='auto'?settings.layout:(parent.input.layout??settings.layout)};
  this.settings(merged);
  const privateClip=(await this.repository.clips(org.id,jobId)).find(c=>c.clipId===clipId);
  const parentClip=privateClip?{...privateClip.metadata as object,clipId,cleanPath:privateClip.cleanPath,sourceFingerprint:parent.sourceSha256}:undefined;
  const receipt=await this.repository.create(org.id,{...merged,idempotencyKey:settings.idempotencyKey||randomUUID(),operation:'edit',segments:settings.segments||clip.segments},parent,expectedRevision,parentClip);
  await this.dispatch(receipt);return this.started(receipt);
 }
 async list(orgId:string):Promise<SourceJobStatus[]>{
  if(!orgId)throw new BadRequestException('Organization is required');
  // Build the page in a local map: LRU evictions during the await (other orgs' polls) must not drop rows from this result.
  const rows=await this.repository.listVersions(orgId),result=new Map<string,SourceJobStatus>(),versions=new Map(rows.map(r=>[r.id,SourceVideoService.version(r)])),stale:string[]=[];
  for(const r of rows){
   const cached=this.summaries.get(r.id);
   if(cached&&cached.orgId===orgId&&cached.version===versions.get(r.id)){result.set(r.id,cached.state);this.summaries.delete(r.id);this.summaries.set(r.id,cached);}
   else stale.push(r.id);
  }
  // Keyed by the probed version: a receipt newer than the probe is simply re-read on the next poll.
  for(const row of await this.repository.listReceipts(orgId,stale))result.set(row.id,this.remember(row.id,orgId,versions.get(row.id)!,row.receipt,row.updatedAt));
  return rows.map(r=>result.get(r.id)).filter((state):state is SourceJobStatus=>!!state);
 }
 async transcript(orgId:string,jobId:string){const state=await this.status(orgId,jobId);return {jobId,transcript:state.plan?.transcript,clips:state.clips.map(c=>({clipId:c.clipId,title:c.title,segments:c.segments,transcript:c.transcript||[]}))};}
 private async hash(path:string,signal?:AbortSignal){
  signal?.throwIfAborted();const hash=createHash('sha256'),stream=createReadStream(path);
  const abort=()=>stream.destroy(Object.assign(new Error('Artifact hashing aborted'),{name:'AbortError'}));
  signal?.addEventListener('abort',abort,{once:true});
  try{for await(const chunk of stream)hash.update(chunk);signal?.throwIfAborted();return hash.digest('hex');}
  finally{signal?.removeEventListener('abort',abort);stream.destroy();}
 }
 async executeStage(orgId:string,jobId:string,stage:SourceVideoStage,owner:string,signal:AbortSignal,heartbeat:()=>void) {
  const lease=await this.repository.acquire(orgId,jobId,owner),abort=new AbortController();
  const forward=()=>abort.abort(signal.reason);signal.addEventListener('abort',forward,{once:true});if(signal.aborted)forward();
  const timer=setInterval(()=>{try{heartbeat();}catch(error){abort.abort(error);return;}void this.repository.renew(lease).catch(error=>abort.abort(error));},10_000);
  let failed=false;
  try{
   const receipt=await this.repository.get(orgId,jobId);abort.signal.throwIfAborted();
   if(terminal.has(receipt.state.status))return;
   if(stage==='render'&&receipt.input.reviewBeforeRender&&!receipt.approvedPlan)throw new ConflictException('Source plan requires approval');
   const directory=join(this.repository.path(jobId),`attempt-${lease.epoch}`);await mkdir(directory,{recursive:true,mode:0o700});
   // Node-owned stages report their own label; worker stages refine it via progress events (analysis 0-39, render 40-90).
   const label=({prepare:[1,'downloading-source'],verify:[91,'verifying-clips'],publish:[93,'saving-media']} as Record<string,[number,string]>)[stage];
   receipt.state.status='running';receipt.state.stage=label?.[1]||stage;if(label)receipt.state.progress=Math.max(receipt.state.progress,label[0]);await this.repository.save(receipt,lease);
   // Progress stays monotonic in memory; persistence is coalesced to one save per second unless the stage label changes or progress hits its 94 cap.
   let lastProgressSave=0;
   const progress=(value:number,label:string)=>{try{heartbeat();}catch(error){abort.abort(error);return;}
    const stageChanged=receipt.state.stage!==label;receipt.state.progress=Math.max(receipt.state.progress,Math.min(94,Math.round(value)));receipt.state.stage=label;
    if(!stageChanged&&receipt.state.progress<94&&Date.now()-lastProgressSave<1000)return;
    lastProgressSave=Date.now();void this.repository.save(receipt,lease).catch(error=>abort.abort(error));};
   if(stage==='prepare')await this.prepare(receipt,directory,lease,abort.signal);
   if(stage==='analyze')await this.analyze(receipt,directory,lease,abort.signal,progress);
   if(stage==='render')await this.render(receipt,directory,lease,abort.signal,progress);
   if(stage==='verify')await this.verify(receipt,lease,abort.signal);
   if(stage==='publish')await this.publish(receipt,lease,abort.signal);
   abort.signal.throwIfAborted();await this.repository.save(receipt,lease);
  }catch(error){
   failed=true;const storage=sourceStorageError(error);
   if(storage){console.error('Source video storage failure',jobId,stage,error instanceof Error?error.message:error);throw storage;}
   throw error;
  }
  finally{
   clearInterval(timer);signal.removeEventListener('abort',forward);
   // A release failure (e.g. database down) must not mask the stage error; the lease then expires on its own.
   await this.repository.release(lease).catch(error=>{if(!failed)throw error;console.error('Source stage lease release failed after stage error',jobId);});
  }
 }
 private async readyMedia(orgId:string,mediaId:string,notFound:string) {
  const media=await this.media.getMediaStatus(orgId,mediaId);
  if(!media||['processing','failed'].includes(media.status))throw new NotFoundException(notFound);
  return media;
 }
 private agyEvents(receipt:SourceReceipt,lease:SourceStageLease) {
  return async (event:unknown)=>{if((event as {type?:string})?.type==='receipt'){receipt.agyReceipts=[...(receipt.agyReceipts||[]),(event as {receipt:unknown}).receipt].slice(-400);await this.repository.save(receipt,lease);}else if((event as {type?:string})?.type==='mcp-error'){const issue=event as {name?:string;message?:string};receipt.agyReceipts=[...(receipt.agyReceipts||[]),{type:'mcp-error',name:issue.name,message:String(issue.message||'').slice(0,1000)}].slice(-400);await this.repository.save(receipt,lease);}};
 }
 private async prepare(receipt:SourceReceipt,directory:string,lease:SourceStageLease,signal:AbortSignal) {
  if(receipt.sourcePath&&receipt.sourceSha256){privatePath(this.repository.directory,await realpath(receipt.sourcePath));if(await this.hash(receipt.sourcePath)!==receipt.sourceSha256)throw new Error('Source artifact integrity changed');return;}
  const source=join(directory,'source.mp4');let url=receipt.input.sourceUrl;
  if(receipt.input.mediaId){url=(await this.readyMedia(receipt.orgId,receipt.input.mediaId,'Ready source media not found')).path;if(await copyUploadedSource(url,source))url=undefined;}
  if(url)await downloadSource(url,source,signal);signal.throwIfAborted();
  if((await stat(source)).size>1024*1024*1024)throw new Error('Source exceeds 1 GB');
  receipt.sourcePath=source;receipt.sourceSha256=await this.hash(source);await this.repository.save(receipt,lease);
 }
 private async analyze(receipt:SourceReceipt,directory:string,lease:SourceStageLease,signal:AbortSignal,progress:(p:number,s:string)=>void) {
  if(receipt.plan)return;
  // A revision of the same source reuses the parent's scenes + repaired transcript; the engine re-checks source/engine/ASR identity.
  const parent=receipt.state.parentJobId?await this.repository.get(receipt.orgId,receipt.state.parentJobId).catch(()=>undefined):undefined;
  const base=parent?.sourceSha256===receipt.sourceSha256?(parent?.approvedPlan||parent?.plan):undefined;
  const parentAnalysis=base?{sourceFingerprint:base.sourceFingerprint,engineFingerprint:base.engineFingerprint,asrRuntime:(base as unknown as {asrRuntime?:unknown}).asrRuntime,media:base.media,scenes:base.scenes,transcript:base.transcript,layout:(receipt.parentClip as {layout?:string}|undefined)?.layout}:undefined;
  const result=await this.worker.run(receipt.state.jobId,receipt.sourcePath!,directory,{...receipt.input,phase:'analyze',parentAnalysis},signal,progress,this.agyEvents(receipt,lease));
  if(!result.plan||result.plan.sourceFingerprint!==receipt.sourceSha256)throw new Error('Analysis does not match source hash');
  result.plan.planVersion=1;receipt.engineSha256=result.plan.engineFingerprint;receipt.state.warnings=result.warnings||[];
  await this.repository.plan(receipt,result.plan,lease);
 }
 async reviewState(orgId:string,jobId:string) {
  const receipt=await this.repository.get(orgId,jobId);
  if(!receipt.input.reviewBeforeRender)return {required:false,approved:true};
  if(receipt.approvedPlan)return {required:true,approved:true};
  // Conditional transition: a stale read must never overwrite an approval committed meanwhile.
  return {required:true,approved:await this.repository.awaitApproval(orgId,jobId)};
 }
 private async render(receipt:SourceReceipt,directory:string,lease:SourceStageLease,signal:AbortSignal,progress:(p:number,s:string)=>void) {
  if(receipt.rendered)return;
  const input:SourceVideoDto & {phase:'render';plan:SourceAnalysisPlan;narrationPath?:string;bgmPath?:string;reuse?:Record<string,unknown>}={...receipt.input,phase:'render',plan:receipt.approvedPlan||receipt.plan!};
  if(!input.plan)throw new Error('Source analysis is unavailable');
  if(receipt.input.reviewBeforeRender&&!receipt.approvedPlan)throw new ConflictException('Source plan requires approval');
  if(input.audio?.mode&& !['keep','mute'].includes(input.audio.mode)){
   const narrationText=input.audio.narrationText?.trim()||input.plan.clips[0]?.content?.narration?.text?.trim();
   if(!narrationText)throw new BadRequestException('Narration text is required');
   progress(40,'synthesizing-narration');
   // One clip: tempo-fit the voice-over into the clip instead of letting the render cut it off.
   const fitSeconds=input.plan.clips.length===1?input.plan.clips[0].segments.reduce((sum,s)=>sum+s.endSeconds-s.startSeconds,0):undefined;
   const speech=await this.tts.synthesizePreview(narrationText,(input.audio.voice||'vi-VN-HoaiMyNeural') as VietnameseVoice,directory,signal,fitSeconds&&fitSeconds>1?fitSeconds:undefined);input.narrationPath=speech.audioPath;
   if(speech.voiceFallback)receipt.state.warnings=[...new Set([...(receipt.state.warnings||[]),speech.voiceFallback.warning])];
  }
  if(input.audio?.bgmMediaId){const music=await this.readyMedia(receipt.orgId,input.audio.bgmMediaId,'Background music not found');input.bgmPath=join(directory,'bgm.mp3');if(!await copyUploadedSource(music.path,input.bgmPath))await downloadSource(music.path,input.bgmPath,signal);}
  if(receipt.parentClip?.cleanPath){
   const clean=await realpath(privatePath(this.repository.directory,String(receipt.parentClip.cleanPath)));privatePath(this.repository.directory,clean);
   if(await this.hash(clean)===receipt.parentClip.cleanSha256){const staged=join(directory,'parent-clean.mp4');await copyFile(clean,staged);input.reuse={...receipt.parentClip,cleanPath:staged,sourceSegments:receipt.parentClip.segments};}
  }
  const result=await this.worker.run(receipt.state.jobId,receipt.sourcePath!,directory,input,signal,progress,this.agyEvents(receipt,lease));
  if(input.motionDesign?.enabled)for(const clip of result.clips){
   const design={enabled:true,theme:input.motionDesign.theme||'clean',transitions:input.motionDesign.transitions||'fade',lowerThird:input.motionDesign.lowerThird,designBrief:input.designBrief,captions:{...input.captions,enabled:input.captions?.enabled!==false,style:input.captions?.style||'karaoke'},hook:{enabled:input.hook?.enabled||false,text:input.hook?.text,style:input.hook?.style||'pill',durationSeconds:input.hook?.durationSeconds}};
   clip.path=(await this.motion.render(clip,directory,design,signal,progress)).path;
  }
  receipt.rendered=result;receipt.state.warnings=[...new Set([...(receipt.state.warnings||[]),...(result.warnings||[])])];await this.repository.save(receipt,lease);
 }
 private async verify(receipt:SourceReceipt,lease:SourceStageLease,signal:AbortSignal) {
  const result=receipt.rendered as WorkerResult;if(!result?.clips?.length)throw new Error('Rendered clips unavailable');
  const seen=new Set<string>();
  for(const clip of result.clips){
   if(!clip.clipId||seen.has(clip.clipId)||typeof clip.title!=='string'||!Number.isFinite(clip.durationSeconds)||clip.aspectRatio!==(receipt.input.aspectRatio||'9:16'))throw new Error('Invalid rendered clip metadata');seen.add(clip.clipId);
   const path=await realpath(privatePath(this.repository.path(receipt.state.jobId),clip.path));privatePath(this.repository.path(receipt.state.jobId),path);
   await this.worker.verify(path,clip.aspectRatio,clip.durationSeconds,signal);signal.throwIfAborted();
   const sha256=await this.hash(path);let cleanPath:string|undefined;
   if(clip.cleanPath){cleanPath=await realpath(privatePath(this.repository.path(receipt.state.jobId),clip.cleanPath));privatePath(this.repository.path(receipt.state.jobId),cleanPath);clip.cleanSha256=await this.hash(cleanPath);}
   await this.repository.clip(lease,clip as unknown as Record<string,unknown>,path,sha256,cleanPath);
  }
 }
 private async publish(receipt:SourceReceipt,lease:SourceStageLease,signal:AbortSignal) {
  const clips=await this.repository.clips(receipt.orgId,receipt.state.jobId),storage=UploadFactory.createStorage();
  if(!storage.uploadStreamAtKey)throw new Error('Storage provider must support deterministic publication');
  for(const clip of clips){
   const path=await realpath(privatePath(this.repository.path(lease.jobId),clip.artifactPath));privatePath(this.repository.path(lease.jobId),path);
   if(await this.hash(path)!==clip.sha256)throw new Error('Verified clip artifact changed');
   await this.repository.renew(lease);signal.throwIfAborted();
   const key=`source-video/${receipt.orgId}/${lease.jobId}/${sourceDigest(clip.clipId).slice(0,32)}.mp4`;
   const publicPath=storage.publicUrl?storage.publicUrl(key):`${process.env.FRONTEND_URL}/uploads/${key}`;
   const publication=await this.repository.reserve(lease,clip.clipId,clip.sha256,key,publicPath);
   if(publication.status!=='committed')try{
    await storage.uploadStreamAtKey(createReadStream(path),'video/mp4',key,signal);
    await this.repository.renew(lease);signal.throwIfAborted();
   }catch(error){
    // finish() may have compensated this journal while the upload was in flight; the object landed afterwards,
    // so this fenced publisher removes it. finish() marks the row before deleting, so either order is covered.
    const journal=(await this.repository.publications(receipt.orgId,lease.jobId).catch(()=>[])).find(item=>item.id===publication.id);
    if(journal&&['compensating','compensated'].includes(journal.status))await storage.removeFile(publication.storagePath).catch(()=>undefined);
    throw error;
   }
   const media=await this.repository.commit(lease,publication,clip.title),metadata=clip.metadata as unknown as WorkerClip;
   const saved={clipId:clip.clipId,title:clip.title,segments:metadata.segments,durationSeconds:metadata.durationSeconds,aspectRatio:metadata.aspectRatio,transcript:metadata.transcript,content:(metadata as any).content,sha256:clip.sha256,media};
   receipt.state.clips=receipt.state.clips.filter(c=>c.clipId!==clip.clipId);receipt.state.clips.push(saved);
   receipt.artifacts={...receipt.artifacts,[clip.clipId]:path};await this.repository.save(receipt,lease);
  }
 }
 async finish(orgId:string,jobId:string,status:'completed'|'failed'|'cancelled',message?:string) {
  let receipt=await this.repository.get(orgId,jobId);
  if(terminal.has(receipt.state.status))return;
  if(await this.repository.cancelled(orgId,jobId))status='cancelled';
  receipt=await this.repository.fenceTerminal(orgId,jobId,status,message)||receipt;
  if(terminal.has(receipt.state.status))return;
  status=receipt.finalization?.status||status;message=receipt.finalization?.message||message;
  if(status!=='completed'){
   const storage=UploadFactory.createStorage();
   for(const item of await this.repository.publications(orgId,jobId))if(item.status==='compensating'){
    try{await storage.removeFile(item.storagePath);}catch(error:any){if(!['ENOENT','NoSuchKey'].includes(error.code)&&error.$metadata?.httpStatusCode!==404)throw error;}
    await this.repository.compensateOne(orgId,jobId,item.id);
   }
   receipt.state.clips=[];receipt.artifacts={};
  }
  receipt.state.status=status;receipt.state.stage=status;receipt.state.error=message;receipt.state.progress=status==='completed'?100:receipt.state.progress;
  await this.repository.save(receipt);
 }
 async downloadAll(orgId:string,jobId:string,signal?:AbortSignal) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('ZIP deadline exceeded')),60_000);
  const scopedSignal=signal?AbortSignal.any([controller.signal,signal]):controller.signal;
  let zip:string|undefined;
  try {
   scopedSignal.throwIfAborted();
   const state=await this.status(orgId,jobId);if(state.status!=='completed')throw new BadRequestException('Clips are not ready');
   scopedSignal.throwIfAborted();
   const directory=this.repository.path(jobId),receipt=await this.repository.get(orgId,jobId);
   zip=join(directory,`clips-${randomUUID()}.zip`);
   const files=await Promise.all(state.clips.map(async(clip,index)=>{
    scopedSignal.throwIfAborted();
    const path=await realpath(privatePath(directory,receipt.artifacts?.[clip.clipId]||''));privatePath(directory,path);
    if(await this.hash(path,scopedSignal)!==clip.sha256)throw new Error('Clip artifact integrity check failed');
    return {path,name:`clip-${index+1}.mp4`};
   }));
   scopedSignal.throwIfAborted();
   await this.worker.command(process.env.OPENSHORTS_PYTHON||'python3',['-c','import sys,zipfile,json; z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_STORED); [z.write(p["path"],p["name"]) for p in json.loads(sys.argv[2])]; z.close()',zip,JSON.stringify(files)],scopedSignal);
   scopedSignal.throwIfAborted();return zip;
  }catch(error){controller.abort(error);if(zip)await unlink(zip).catch(()=>undefined);throw error;}
  finally{clearTimeout(timer);}
 }
}
