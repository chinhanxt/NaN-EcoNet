'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { TERMINAL_STATUSES, describeError, formatEta } from './ai-video-studio.progress';
export interface SourceStudioMedia {id:string;path:string;thumbnail?:string|null;originalName?:string|null}
/** Grounded copy the backend returns per clip (SourceClipContent). */
export interface SourceStudioHookCandidate {text:string;pattern_id?:number|null;patternId?:number|null;curiosity?:number;specificity?:number;truthfulness?:number;fit?:number;scores?:{curiosity?:number;specificity?:number;truthfulness?:number;fit?:number}|null}
export interface SourceStudioHookDecision {contentKind?:string;patternId?:number|null;pattern?:string|{category?:string;template?:string}|null;candidates?:SourceStudioHookCandidate[]}
export interface SourceStudioClipContent {title:string;description:string;hashtags:string[];postText:string;hook?:string|null;narration?:{text:string}|null;selectionRationale?:string|null;grounding?:{hookDecision?:SourceStudioHookDecision|null}|null;warnings?:string[]}
export interface SourceStudioClip {clipId:string;title:string;durationSeconds:number;aspectRatio:string;segments:Array<{startSeconds:number;endSeconds:number}>;transcript?:unknown;content?:SourceStudioClipContent|null;media:SourceStudioMedia}
export interface SourceStudioPlan {planVersion:number;clips:Array<{clipId:string;title:string;segments:Array<{startSeconds:number;endSeconds:number}>;aspectRatio:string;layout:string;hook?:{text?:string};effects?:unknown[];content?:SourceStudioClipContent|null}>;transcript?:unknown}
export interface SourceStudioJob {plan?:SourceStudioPlan;jobId:string;projectId:string;revision:number;status:string;progress:number;stage:string;error?:string;clips:SourceStudioClip[];warnings:string[]}
export const useSourceVideoStudio = () => {
  const fetch=useFetch();const organization=useUser()?.orgId;const key=useRef<{key:string;input:string}|undefined>(undefined);
  const [jobId,setJobId]=useState<string>();
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const request=useCallback(async<T,>(url:string,options:RequestInit={}):Promise<T>=>{
    const response=await fetch(url,options);const data=await response.json().catch(()=>null);
    if(!response.ok || !data)throw new Error(Array.isArray(data?.message)?data.message.join(', '):data?.message||data?.error||'Không thể kết nối máy chủ.');
    return data;
  },[fetch]);
  const status=useSourceVideoStatus(jobId,request,organization);
  const history=useSourceVideoHistory(request,organization);
  const media=useSourceVideoMedia(request,organization);
  useEffect(()=>{setJobId(undefined);key.current=undefined;},[organization]);
  useEffect(()=>{if(!jobId){const pending=history.data?.find(job=>!TERMINAL_STATUSES.has(job.status));const latest=pending||history.data?.[0];if(latest)setJobId(latest.jobId);}},[jobId,history.data]);
  const run=async(label:string,action:()=>Promise<void>)=>{
    if(busy)return;setBusy(label);setError('');
    try{await action();}catch(e){setError(e instanceof Error?e.message:'Không thể xử lý video.');}finally{setBusy('');}
  };
  const start=(input:object)=>run('start',async()=>{
    const serialized=JSON.stringify(input);if(key.current?.input!==serialized)key.current={key:crypto.randomUUID(),input:serialized};
    const job=await request<{jobId:string}>('/ai-video/source-jobs',{method:'POST',body:JSON.stringify({...input,idempotencyKey:key.current.key})});
    key.current=undefined;
    setJobId(job.jobId);void history.mutate();
  });
  /** The backend re-creates a failed/cancelled job from its stored input (new job linked by parentJobId). */
  const canRetry=status.data?.status==='failed'||status.data?.status==='cancelled';
  const retry=()=>run('retry',async()=>{
    if(!jobId||!canRetry)return;
    const job=await request<{jobId:string}>(`/ai-video/source-jobs/${jobId}/retry`,{method:'POST'});
    setJobId(job.jobId);void history.mutate();
  });
  const revise=(clipId:string,input:object)=>run('revise',async()=>{
    if(!jobId)return;
    const serialized=JSON.stringify(input);if(key.current?.input!==serialized)key.current={key:crypto.randomUUID(),input:serialized};
    const job=await request<{jobId:string}>(`/ai-video/source-jobs/${jobId}/revisions`,{method:'POST',body:JSON.stringify({...input,idempotencyKey:key.current.key,clipId,expectedRevision:status.data?.revision})});key.current=undefined;
    setJobId(job.jobId);void history.mutate();
  });
  const approve=(clips:SourceStudioPlan['clips'])=>run('approve',async()=>{if(jobId){await request(`/ai-video/source-jobs/${jobId}/approve`,{method:'POST',body:JSON.stringify({expectedPlanVersion:status.data?.plan?.planVersion,clips:clips.map(({clipId,title,segments})=>({clipId,title,segments}))})});await status.mutate();void history.mutate();}});
  const cancel=()=>run('cancel',async()=>{if(jobId){await request(`/ai-video/source-jobs/${jobId}`,{method:'DELETE'});await status.mutate();void history.mutate();}});
  const upload=(file:File,onUploaded:(media:SourceStudioMedia)=>void)=>run('upload',async()=>{
    if(file.size>1024*1024*1024)throw new Error('Video tối đa 1 GB.');
    const body=new FormData();body.append('file',file);
    const uploaded=await request<SourceStudioMedia>('/media/upload-server',{method:'POST',body});
    if(!uploaded.id || !uploaded.path)throw new Error('Chưa lưu được video vào kho media.');
    onUploaded(uploaded);void media.mutate();
  });
  // A poll error while a snapshot is shown is transient (SWR keeps retrying): show a reconnect hint, not an error.
  return {job:status.data,history:history.data||[],media:media.data?.results||[],busy,error:error||(status.data?'':status.error?.message),
    disconnected:!!status.error,active:!!status.data && !TERMINAL_STATUSES.has(status.data.status),canRetry,retry,start,revise,cancel,approve,upload,setJobId};
};
/** Adaptive cadence: fast while the worker is active, slow while queued or waiting for the user's plan review. */
export const sourcePollInterval=(data?:{status:string})=>!data?2000:TERMINAL_STATUSES.has(data.status)?0:data.status==='awaiting_approval'?5000:data.status==='queued'?4000:2000;
export const useSourceVideoStatus = (id:string|undefined,request:<T>(url:string)=>Promise<T>,orgId?:string)=>useSWR<SourceStudioJob>(
  id&&orgId?[`/ai-video/source-jobs/${id}`,orgId]:null,([url]:[string,string])=>request<SourceStudioJob>(url),
  {refreshInterval:sourcePollInterval,revalidateOnFocus:true,dedupingInterval:1000,errorRetryInterval:3000});
export const useSourceVideoHistory = (request:<T>(url:string)=>Promise<T>,orgId?:string)=>useSWR<SourceStudioJob[]>(orgId?['/ai-video/source-jobs',orgId]:null,([url]:[string,string])=>request<SourceStudioJob[]>(url));
/** The media API pages by 18; source videos are often older than the newest rendered clips, so read up to 10 pages. */
export const useSourceVideoMedia = (request:<T>(url:string)=>Promise<T>,orgId?:string)=>useSWR<{results:SourceStudioMedia[]}>(orgId?['/media?pages',orgId]:null,async()=>{
  const results:SourceStudioMedia[]=[];
  for(let page=1;page<=10;page++){
    const data=await request<{pages:number;results:SourceStudioMedia[]}>(`/media?page=${page}`);
    results.push(...data.results);
    if(page>=(data.pages||1))break;
  }
  return {results};
});

/** Stepper for the source pipeline; the review step is passed straight through when review is off. */
export const SOURCE_STEPS=['Phân tích','Duyệt','Render','Lưu'] as const;
const SAVE_STAGES=new Set(['verify','verifying-clips','publish','publishing','saving-media','finalizing']);
export const sourceStep=(job:{status:string;stage:string;progress:number})=>
  job.status==='completed'?SOURCE_STEPS.length:job.status==='awaiting_approval'||job.stage==='approved'?1:SAVE_STAGES.has(job.stage)||job.progress>=91?3:job.progress>=40?2:0;
// Backend progress bands (analysis 0-39, render 40-90, verify/save 91-99) with typical durations: analysis ~4 min, render ~3 min per clip.
const sourcePhase=(step:number,clips:number):[number,number,number]=>step>=3?[91,99,40]:step===2?[40,90,180*Math.max(1,clips)]:[0,39,240];
/**
 * Never-decreasing percent, elapsed time and an ETA blended from the typical duration and the pace observed so far.
 * Re-renders once per second while the worker runs; the clock pauses while the plan waits for review.
 */
export const useSourceProgress=(job:SourceStudioJob|undefined)=>{
  const running=!!job && !TERMINAL_STATUSES.has(job.status) && job.status!=='awaiting_approval';
  const [,setTick]=useState(0);
  const memory=useRef({jobId:'',step:-1,stepAt:0,stepFrom:0,percent:0,elapsed:0,seenAt:0,eta:0});
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setTick(t=>t+1),1000);return ()=>clearInterval(timer);},[running]);
  if(!job)return undefined;
  const state=memory.current,now=Date.now(),step=sourceStep(job);
  if(state.jobId!==job.jobId)Object.assign(state,{jobId:job.jobId,step:-1,percent:0,elapsed:0,seenAt:now,eta:0});
  if(running)state.elapsed+=(now-state.seenAt)/1000;state.seenAt=now;
  if(step!==state.step)Object.assign(state,{step,stepAt:state.elapsed,stepFrom:Math.max(state.percent,job.progress)});
  const clips=job.plan?.clips.length||job.clips.length||1;
  if(job.status==='completed')state.percent=100;
  else if(running){
    const [,to,seconds]=sourcePhase(step,clips);
    const eased=Math.min(0.92,1-Math.exp(-1.6*(state.elapsed-state.stepAt)/seconds));
    state.percent=Math.max(state.percent,job.progress,Math.min(to,state.stepFrom+(to-state.stepFrom)*eased));
  }
  let eta='';
  if(running){
    // Remaining typical seconds: rest of the current band plus every later band.
    const [from,to,seconds]=sourcePhase(step,clips);
    let model=seconds*Math.max(0,to-state.percent)/Math.max(1,to-from);
    for(let later=Math.max(step,1)+1;later<=3;later++)model+=sourcePhase(later,clips)[2];
    const fraction=state.percent/100,observed=fraction>0.08?state.elapsed/fraction*(1-fraction):model,weight=Math.min(0.7,fraction);
    const target=Math.max(15,(1-weight)*model+weight*observed);
    state.eta=!state.eta?target:Math.max(15,state.eta+0.25*(target-state.eta));
    eta=formatEta(state.eta);
  }
  return {percent:Math.round(state.percent),step,elapsed:state.elapsed,eta};
};
/** Readable Vietnamese failure text for source jobs (storage errors already arrive in Vietnamese). */
export const describeSourceError=(message?:string)=>describeError(message,[
  [/cancell?ed/i,'Tác vụ đã được hủy.'],
  [/exceeds 1 GB/i,'Video nguồn vượt quá 1 GB.'],
  [/Ready source media not found|Background music not found/i,'Không tìm thấy video nguồn hoặc nhạc nền trong kho media (có thể đã bị xóa hoặc chưa xử lý xong).'],
  [/download|HTTP \d{3}|redirect|content-type/i,'Không tải được video nguồn từ URL. Kiểm tra lại đường dẫn rồi tạo lại.'],
  [/ASR|sentence boundaries|transcri/i,'Không nhận diện được đủ lời nói trong video để chọn đoạn. Hãy thử video có lời thoại rõ hơn.'],
  [/No hook region|hook is empty|captions/i,'Cấu hình hook/phụ đề không phù hợp với clip. Hãy chỉnh lại rồi tạo lại.'],
  [/Narration text is required|narration|voice|TTS/i,'Không tạo được giọng đọc. Hãy kiểm tra lời đọc hoặc chọn giọng Edge-TTS.'],
  [/aspect ratio|duration|verify|ffprobe|decode/i,'Clip dựng xong nhưng chưa qua bước kiểm tra chất lượng. Hãy tạo lại.'],
  [/authentication|account-eligibility|not-logged-in/i,'Tài khoản AI chưa sẵn sàng. Hãy thử lại sau ít phút.'],
  [/AGY|MCP|gateway|upstream|ECONNREFUSED|fetch failed|timed? ?out/i,'Dịch vụ AI tạm thời không phản hồi. Hãy thử lại sau ít phút.'],
  [/Worker exited|worker failed|interrupted|shutting down|restarted/i,'Bộ xử lý video bị gián đoạn. Hãy tạo lại.'],
  [/Failed to fetch|NetworkError|network/i,'Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.'],
],'Xử lý video chưa thành công. Hãy thử lại.');
