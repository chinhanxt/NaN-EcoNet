import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';
import { MAX_STATUS_WAIT_SECONDS, statusWaitSeconds, waitForJobChange } from './source.video.status.wait';
export { MAX_STATUS_WAIT_SECONDS, waitForJobChange };
// approve() only sets stage='approved'; status stays awaiting_approval until render takes the lease, so that is still in progress.
const awaitingReview=(job:{status?:string;stage?:string})=>job.status==='awaiting_approval'&&job.stage!=='approved';
const settledSource=(job:{status?:string;stage?:string})=>awaitingReview(job)||['completed','failed','cancelled'].includes(String(job.status));
@Injectable()
export class SourceVideoStatusTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='sourceVideoStatusTool';
  run(){return createTool({id:this.name,description:`Check source-video progress. For queued/running jobs pass waitSeconds (up to ${MAX_STATUS_WAIT_SECONDS}) instead of calling repeatedly; at most two waiting calls per chat turn: if the job is still running after them, reply in ONE short Vietnamese sentence with the jobId in backticks, e.g. "Video đang được xử lý (mã \`<jobId>\`), tiến trình hiển thị ngay bên dưới." No stage/progress/status lists, no Studio mention: the chat shows a live progress card for that jobId, and end the turn (the job keeps running; the user can ask again). Stop at awaiting_approval, show the plan and wait for explicit user approval before approveSourceVideoTool. Stop at completed/failed/cancelled and report the actual result. Only completed clips include saved media IDs and URLs. clip.content (when present) is AGY copy grounded in the clip transcript/frames: use content.postText as the post text, content.title/hook as written, content.narration.text as the voice-over script and content.selectionRationale to explain why a clip was chosen; never embellish it with facts not in the clip.`,inputSchema:z.object({jobId:z.string().uuid(),waitSeconds:statusWaitSeconds}),
    execute:async(input,context)=>{try{
      const org=requireOrganization(input,context);
      const {job,waitedSeconds}=await waitForJobChange(()=>this.videos.summary(org.id,input.jobId),input.waitSeconds,settledSource,(context as any)?.abortSignal);
      return {jobId:job.jobId,projectId:job.projectId,revision:job.revision,status:job.status,stage:job.stage,progress:job.progress,
        ...(input.waitSeconds?{waitedSeconds}:{}),
        warnings:job.warnings?.slice(0,10),error:job.error,webhook:job.webhook,
        plan:awaitingReview(job)?{planVersion:job.plan?.planVersion,clips:job.plan?.clips.map(clip=>({clipId:clip.clipId,title:clip.title,segments:clip.segments,aspectRatio:clip.aspectRatio,layout:clip.layout,hook:clip.hook,effects:clip.effects,content:clip.content}))}:undefined,
        clips:job.status==='completed'?job.clips.map(clip=>({clipId:clip.clipId,title:clip.title,durationSeconds:clip.durationSeconds,aspectRatio:clip.aspectRatio,segments:clip.segments,media:clip.media,sha256:clip.sha256,content:clip.content})):[]};
    }catch(e){return {error:e instanceof Error?e.message:'Source video request failed'};}}
  });}
}
