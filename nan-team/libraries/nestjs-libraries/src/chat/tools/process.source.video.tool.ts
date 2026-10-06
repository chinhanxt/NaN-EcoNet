import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { requireOrganization } from '../auth.context';
import { AI_VIDEO_VOICES } from '../../videos/remotion/dto/ai.video.dto';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
export const sourceVideoOptions = {
  webhook:z.object({url:z.string().url().max(4096),secret:z.string().min(16).max(512)}).optional().describe('Optional signed completion/failure callback. Use a public HTTPS URL and a shared signing secret supplied privately. The backend encrypts callback configuration and excludes it from worker inputs and exported receipts. Each revision requires an explicit callback.'),
  idempotencyKey:z.string().min(1).max(200).optional(),reviewBeforeRender:z.boolean().optional(),
  motionDesign:z.object({enabled:z.boolean().optional(),theme:z.enum(['clean','bold','minimal']).optional(),transitions:z.enum(['none','fade','slide']).optional(),lowerThird:z.string().max(300).optional()}).optional(),
  operation:z.enum(['clips','edit']).optional(),aspectRatio:z.enum(['9:16','16:9','1:1']).default('9:16'),
  selection:z.object({count:z.number().int().min(1).max(10).optional(),minSeconds:z.number().min(10).max(180).optional(),maxSeconds:z.number().min(10).max(180).optional(),prompt:z.string().max(2000).optional()}).optional(),
  segments:z.array(z.object({startSeconds:z.number().min(0).max(14400),endSeconds:z.number().min(0.1).max(14400)})).min(1).max(12).optional(),
  layout:z.enum(['auto','general','screencast','wide','speaker-cut']).default('auto'),
  captions:z.object({enabled:z.boolean().optional(),style:z.enum(['karaoke','classic','neon','pop','box']).optional(),
    position:z.enum(['top','middle','bottom']).optional(),fontName:z.string().regex(/^(?=.*\S)[A-Za-z0-9 _-]{1,80}$/).optional(),
    fontSize:z.number().finite().min(10).max(200).optional(),fontColor:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
    borderColor:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),borderWidth:z.number().finite().min(0).max(10).optional(),
    highlightColor:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),bgColor:z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
    bgOpacity:z.number().finite().min(0).max(1).optional(),effect:z.enum(['none','glow','pop','box']).optional(),
    baseOpacity:z.number().finite().min(0).max(1).optional(),uppercase:z.boolean().optional()}).optional(),
  hook:z.object({enabled:z.boolean().optional(),text:z.string().max(300).optional(),durationSeconds:z.number().min(0.1).max(14400).optional().describe('Display from the start of the clip for this many seconds, capped at clip duration; default 5 seconds.'),style:z.enum(['pill','classic','dark','yellow','red','outline','outline_yellow']).optional()}).optional(),
  audio:z.object({mode:z.enum(['keep','mute','mix-narration','replace-narration']).default('keep'),voice:z.enum(AI_VIDEO_VOICES).optional(),narrationText:z.string().max(1500).optional(),bgmMediaId:z.string().min(1).max(200).optional()}).optional(),
  designBrief:z.string().max(4000).optional().describe('Free-text design/effects request in the user\'s words. When the user asks to zoom/punch in on important moments, emphasise key points or make the edit more dynamic, pass it here (e.g. "punch-in nhẹ vào ý quan trọng, mỗi lần 1-3 giây"): the engine plans timed zoom/punch-in effects from the transcript. Prefer this over effects unless the user gives exact clip-local seconds.'),
  effects:z.array(z.object({type:z.enum(['zoom_in','punch_in','zoom_pulse','color_pop','bw_moment','flash','vignette']),start:z.number().min(0),end:z.number().positive(),strength:z.number().min(0).max(1),reason:z.string().max(300).optional(),centerX:z.number().min(0).max(1).optional().describe('Zoom focus X 0-1'),centerY:z.number().min(0).max(1).optional().describe('Zoom focus Y 0-1')})).max(12).optional().describe('Explicit effects at CLIP-LOCAL seconds; only when the user gives exact times. Overrides designBrief effect planning.'),
  cropOverrides:z.record(z.string(),z.union([z.number().min(0).max(1),z.object({top:z.union([z.number().min(0).max(1),z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)})]),bottom:z.union([z.number().min(0).max(1),z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)})])})])).optional(),
};
export const sourceVideoRevisionOptions = {
  ...sourceVideoOptions,
  aspectRatio: sourceVideoOptions.aspectRatio.removeDefault().optional(),
  layout: sourceVideoOptions.layout.removeDefault().optional(),
  audio: sourceVideoOptions.audio.unwrap().extend({
    mode: sourceVideoOptions.audio.unwrap().shape.mode.removeDefault().optional(),
  }).optional(),
};
@Injectable()
export class ProcessSourceVideoTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='processSourceVideoTool';
  run(){return createTool({id:this.name,
    description:'Process an existing source video into multiple short clips or edit the whole video. Use an uploaded mediaId or public HTTPS sourceUrl, never a server path. When the user message has a [--Media--] block, each "Video:" line is followed by a "MediaId: <id>" line; pass that id as mediaId and do not pass the Video URL as sourceUrl. Keep original sound by default; explicitly choose 9:16, 16:9 or 1:1. Native AGY MCP selects relevant moments, grounded hooks and layout. Returns durable Temporal jobId; processing takes several minutes, so call sourceVideoStatusTool with waitSeconds at most twice in this turn, then reply in ONE short Vietnamese sentence with the jobId in backticks, e.g. "Đã bắt đầu xử lý video (mã `<jobId>`), tiến trình hiển thị ngay bên dưới." No stage/progress/status lists, no Studio mention: the chat shows a live progress card for that jobId, and end the turn (the job keeps running). reviewBeforeRender pauses with an editable plan: show it to the user and use approveSourceVideoTool only after explicit approval, or review in Studio. Never claim output before completed. Reuse idempotencyKey for an identical retried request. Only completed saved media.id/media.path are attachments; do not claim success while queued or failed. Follow existing scheduling approval rules.',
    inputSchema:z.object({...sourceVideoOptions,mediaId:z.string().min(1).max(200).optional(),sourceUrl:z.string().url().max(4096).optional()}),
    outputSchema:z.object({jobId:z.string().optional(),projectId:z.string().optional(),revision:z.number().optional(),error:z.string().optional()}),
    execute:async(input,context)=>{try{return await this.videos.start(requireOrganization(input,context),input);}catch(e){return {error:e instanceof Error?e.message:'Source video failed'};}}
  });}
}
