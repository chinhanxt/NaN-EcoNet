import { Injectable } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, resolve, basename } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { resolveWorkspaceArtifact } from '../runtime.path';
import { createInterface } from 'node:readline';
import { AgyMcpService } from '../agy-mcp/agy.mcp.service';
import { privatePath } from './source-video.source';
import { SourceVideoDto, SourceAspectRatio, SourceSegmentDto, SourceAnalysisPlan } from './source-video.dto';
export interface WorkerClip { cleanSha256?:string; baseFingerprint?:string; layout?:string; scenes?:unknown[]; renderMode?:string; clipId: string; path: string; cleanPath?: string; title: string; segments: SourceSegmentDto[]; durationSeconds: number; aspectRatio: SourceAspectRatio; transcript?: unknown }
export interface WorkerResult {phase?:'analyze'|'render'|'all';plan?:SourceAnalysisPlan;clips:WorkerClip[];warnings?:string[]}
export async function sourceExecutablePresent(executable:string,path=process.env.PATH||'') {
  const candidates=isAbsolute(executable)||executable.includes('/')?[resolve(executable)]:path.split(delimiter).filter(Boolean).map(directory=>resolve(directory,executable));
  for(const candidate of candidates)if(await stat(candidate).then(info=>info.isFile(),()=>false)&&await access(candidate,constants.X_OK).then(()=>true,()=>false))return true;
  return false;
}
// `docker image inspect` is cached briefly so capability polls never block on (or repeatedly spawn) the Docker CLI.
const dockerImageChecks=new Map<string,{at:number;present:Promise<boolean>}>();
function sourceDockerImagePresent(image:string) {
  const cached=dockerImageChecks.get(image);
  if(cached&&Date.now()-cached.at<60_000)return cached.present;
  const present=new Promise<boolean>(resolvePresent=>execFile('docker',['image','inspect',image,'--format','{{.Id}}'],{timeout:2000},error=>resolvePresent(!error)));
  dockerImageChecks.set(image,{at:Date.now(),present});
  return present;
}
@Injectable()
export class SourceVideoWorker {
  constructor(private readonly agy: AgyMcpService) {}
  async capabilities() {
    const exists=async(path?:string,mode=constants.R_OK)=>!!path && await access(path,mode).then(()=>true,()=>false);
    const executable=process.env.OPENSHORTS_PYTHON || 'python3';
    const usesDockerAdapter=basename(executable)==='docker-python';
    const worker=resolveWorkspaceArtifact('packages/openshorts-engine/src/worker.py',process.env.OPENSHORTS_WORKER_PATH);
    const image=process.env.OPENSHORTS_DOCKER_IMAGE;
    const [dockerImagePresent,workerPresent,pythonPresent,asrAssetsPresent,yoloAssetsPresent]=await Promise.all([
      !!image && /^sha256:[a-f0-9]{64}$/.test(image) && sourceDockerImagePresent(image),exists(worker),sourceExecutablePresent(executable),
      exists(process.env.OPENSHORTS_WHISPER_MODEL_DIRECTORY && `${process.env.OPENSHORTS_WHISPER_MODEL_DIRECTORY}/model.bin`),
      exists(process.env.OPENSHORTS_YOLO_MODEL_PATH),
    ]);
    return {featureEnabled:process.env.SOURCE_VIDEO_ENABLED!=='false',workerPresent,pythonPresent,
      asrAssetsPresent,yoloAssetsPresent,dockerImagePresent,usesDockerAdapter,
      nativeModel:'unverified: requires an authenticated live AGY MCP task',
      prerequisitesPresent:workerPresent && pythonPresent && asrAssetsPresent && yoloAssetsPresent && (!usesDockerAdapter || dockerImagePresent)};
  }
  async run(jobId: string, sourcePath: string, workDir: string, input: SourceVideoDto & {phase?:'analyze'|'render'|'all';plan?:SourceAnalysisPlan;reuse?:Record<string,unknown>;parentAnalysis?:Record<string,unknown>;narrationPath?:string;bgmPath?:string},
    signal: AbortSignal, progress: (value:number, stage:string) => void, onEvent?:(event:unknown)=>void|Promise<void>): Promise<WorkerResult> {
    signal.throwIfAborted();
    const worker = resolveWorkspaceArtifact('packages/openshorts-engine/src/worker.py',process.env.OPENSHORTS_WORKER_PATH);
    return new Promise((resolveResult,reject) => {
      // ASR/YOLO/FFmpeg share the API cgroup: run them at the lowest CPU weight and a
      // conservative thread count so the API, MCP job server and AGY stay responsive.
      const python=process.env.OPENSHORTS_PYTHON || 'python3';
      const niceness=process.env.OPENSHORTS_NICE ?? '19';
      const lowPriority=process.platform!=='win32' && /^(?:[1-9]|1\d)$/.test(niceness);
      const threads=process.env.OPENSHORTS_THREADS || '1';
      const child = spawn(lowPriority?'nice':python, lowPriority?['-n',niceness,python,worker]:[worker], {stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32',
        env:{...process.env,OPENSHORTS_OWNER_PID:String(process.pid),OPENSHORTS_THREADS:threads,OMP_NUM_THREADS:process.env.OMP_NUM_THREADS||threads,
          OPENBLAS_NUM_THREADS:process.env.OPENBLAS_NUM_THREADS||threads,MKL_NUM_THREADS:process.env.MKL_NUM_THREADS||threads}});
      let result: WorkerResult | undefined, failure: Error | undefined, bytes=0;
      // AGY requests run one at a time (AGY_MCP_WORKER_CONCURRENCY) in arrival order instead of failing the job.
      const aiLimit=Math.max(1,Math.min(4,Number(process.env.AGY_MCP_WORKER_CONCURRENCY)||1));
      const aiQueue:(()=>Promise<void>)[]=[]; let aiActive=0;
      const drainAi=()=>{ while(aiActive<aiLimit && aiQueue.length){ const next=aiQueue.shift() as ()=>Promise<void>; aiActive++; void next().finally(()=>{aiActive--;drainAi();}); } };
      const requestIds=new Set<string>();
      const aiAbort=new AbortController();
      const aiSignal=AbortSignal.any([signal,aiAbort.signal]);
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const kill = (force=false) => {
        if (!child.pid) return;
        try { if (process.platform==='win32') child.kill(force?'SIGKILL':'SIGTERM'); else if (Number.isInteger(child.pid) && child.pid! > 1 && child.pid !== process.pid) process.kill(-child.pid!,force?'SIGKILL':'SIGTERM'); } catch { /* process already exited */ }
      };
      const abort = () => { failure=signal.reason instanceof Error ? signal.reason : new Error('Source video cancelled'); kill(); killTimer=setTimeout(() => kill(true),1500); };
      signal.addEventListener('abort',abort,{once:true});
      const lines = createInterface({input:child.stdout});
      child.stdout.on('data',(chunk:Buffer) => {
        bytes+=chunk.length;
        if (bytes>32*1024*1024) { failure=new Error('Worker protocol exceeded output limit'); kill(); }
      });
      child.stderr.resume();
      child.stdin.on('error', (error) => { if (!failure && !result) { failure=error; kill(); } });
      const send = (data:object) => { if (!child.stdin.destroyed && !signal.aborted) child.stdin.write(JSON.stringify(data)+'\n'); };
      lines.on('line',(line) => {
        if (failure || signal.aborted) return;
        let message:any;
        try { message=JSON.parse(line); } catch { failure=new Error('Invalid worker protocol'); kill(); return; }
        if (message.type==='progress') progress(Number(message.progress)||0,String(message.stage||'processing').slice(0,100));
        else if (message.type==='result') result = {phase:message.phase,plan:message.plan,clips:message.clips,warnings:message.warnings};
        else if (message.type==='error') {
          failure=new Error(String(message.message||message.error||'Source video processing failed'));
          if (/native authentication unavailable/i.test(failure.message)) failure.name='SourceVideoNativeAuthError';
          if (/ASR contains no sentence boundaries|Complete sentences cannot fit the requested clip duration|fingerprint mismatch/i.test(failure.message)) failure.name='SourceVideoInputError';
          // Deterministic render rejections: the same plan and media fail identically on every retry.
          if (/No hook region avoids|hook is empty or too long|Approved plan is missing its hook decision|Rendered aspect ratio does not match|Replacement narration has no word timings|unsupported captions|invalid captions/i.test(failure.message)) failure.name='SourceVideoInputError';
          // AGY failures that a stage retry cannot fix (account/auth, invalid tool input, schema) must not re-run ASR five times.
          if (/account-eligibility|not-logged-in|authentication/i.test(failure.message)) failure.name='SourceVideoNativeAuthError';
          else if (/invalid-tool-input|schema violation|did not return a result/i.test(failure.message)) failure.name='SourceVideoInputError';
          kill();
        }
        else if (message.type==='ai-request') {
          if (aiQueue.length>=16) { failure=new Error('Too many queued worker AI requests'); kill(); return; }
          aiQueue.push(async () => {
            try {
              if (aiSignal.aborted) throw new Error('Worker exited');
              if (typeof message.requestId!=='string' || message.requestId.length>200 || requestIds.has(message.requestId) || typeof message.prompt!=='string' || message.prompt.length>200000 || !message.schema || typeof message.schema!=='object' || Array.isArray(message.schema) || (message.frames && (!Array.isArray(message.frames) || message.frames.length>12))) throw new Error('Invalid worker AI request');
              requestIds.add(message.requestId);
              const frames = await Promise.all((message.frames || []).map(async (frame:any) => {
                if(!frame || typeof frame.path!=='string' || !Number.isFinite(frame.timestampSeconds) || frame.timestampSeconds<0)throw new Error('Invalid worker frame');
                const path = await realpath(privatePath(workDir,frame.path)); privatePath(workDir,path);
                if ((await stat(path)).size>10*1024*1024) throw new Error('Frame exceeds size limit');
                return {path,timestampSeconds:Number(frame.timestampSeconds)||0};
              }));
              const response = await this.agy.analyzeJson({prompt:message.prompt,schema:message.schema,frames,role:message.role,nativeReview:message.nativeReview===true,
                // Each AGY attempt restarts the Python RPC deadline (AGY deadline + 60 s), so queue time and retries do not race it.
                onAttempt:()=>send({type:'ai-started',requestId:message.requestId})},aiSignal,onEvent);
              send({type:'ai-result',requestId:message.requestId,data:response});
            } catch (error) {
              send({type:'ai-error',requestId:message.requestId,message:error instanceof Error ? error.message : 'AGY MCP request failed'});
            }
          });
          drainAi();
        }
      });
      child.once('error',(error) => { failure=error; });
      child.once('close',(code) => {
        aiAbort.abort(new Error('Worker exited'));
        signal.removeEventListener('abort',abort); if (killTimer) clearTimeout(killTimer); lines.close();
        if (failure || signal.aborted) reject(failure || signal.reason);
        else if (code!==0 || !result || !Array.isArray(result.clips) || (result.phase!=='analyze' && !result.clips.length) || result.clips.length>10 || (result.phase==='analyze' && !result.plan)) {
          reject(new Error(`Source video worker failed (${code}); inspect private worker diagnostics`));
        } else resolveResult(result);
      });
      send({type:'start',request:{jobId,sourcePath,workDir,...input,
        selection:{count:3,minSeconds:30,maxSeconds:60,...input.selection},
        operation:input.operation||'clips',aspectRatio:input.aspectRatio||'9:16',layout:input.layout||'auto',
        captions:{enabled:true,style:'karaoke',...input.captions},hook:{enabled:false,...input.hook},
        audio:{mode:'keep',...input.audio,narrationPath:input.narrationPath,bgmPath:input.bgmPath}}});
      if (signal.aborted) abort();
    });
  }
  async verify(path:string, ratio:SourceAspectRatio, expectedSeconds:number, signal:AbortSignal) {
    const probe = await this.command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],signal);
    const metadata = JSON.parse(probe);
    const video = metadata.streams?.find((stream:any) => stream.codec_type==='video');
    const duration=Number(metadata.format?.duration);
    const [width,height]=ratio.split(':').map(Number);
    if (!video || !Number.isFinite(duration) || duration<=0 || Math.abs(duration-expectedSeconds)>0.75 || Math.abs(video.width/video.height-width/height)>0.02) {
      throw new Error('Rendered clip metadata does not match requested duration/aspect ratio');
    }
    await this.command('ffmpeg',['-v','error','-xerror','-threads','1','-filter_threads','1','-i',path,'-threads','1','-f','null','-'],signal);
    return {durationSeconds:duration,width:video.width,height:video.height,audio:metadata.streams.some((s:any) => s.codec_type==='audio')};
  }
  async command(binary:string,args:string[],signal:AbortSignal):Promise<string> {
    signal.throwIfAborted();
    return new Promise((resolveOutput,reject) => {
      const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']}); let output='',error='';
      let timer:ReturnType<typeof setTimeout> | undefined;
      const abort=() => { child.kill('SIGTERM'); timer=setTimeout(() => child.kill('SIGKILL'),1000); };
      signal.addEventListener('abort',abort,{once:true});
      child.stdout.on('data',(c:Buffer) => {output+=c.toString();if(output.length>1024*1024) child.kill('SIGKILL');});
      child.stderr.on('data',(c:Buffer) => {error=(error+c.toString()).slice(-2048);});
      child.once('error',reject);
      child.once('close',(code) => {signal.removeEventListener('abort',abort);if(timer)clearTimeout(timer); if(signal.aborted)reject(signal.reason);else if(code)reject(new Error(`${binary} failed (${code}); inspect private renderer diagnostics`));else resolveOutput(output);});
      if(signal.aborted)abort();
    });
  }
}
