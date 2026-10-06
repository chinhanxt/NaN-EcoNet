import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsObject, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AI_VIDEO_VOICES } from '../remotion/dto/ai.video.dto';
export type SourceAspectRatio = '9:16' | '16:9' | '1:1';
export class SourceSegmentDto {
  @IsNumber() @Min(0) @Max(14400) startSeconds: number;
  @IsNumber() @Min(0.1) @Max(14400) endSeconds: number;
}
export class SourceSelectionDto {
  @IsOptional() @IsNumber() @Min(10) @Max(180) minSeconds?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(180) maxSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) count?: number;
  @IsOptional() @IsString() @MaxLength(2000) prompt?: string;
}
export class SourceCaptionsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['karaoke','classic','neon','pop','box']) style?: string;
  @IsOptional() @IsIn(['top','middle','bottom']) position?: 'top'|'middle'|'bottom';
  @IsOptional() @IsString() @Matches(/^(?=.*\S)[A-Za-z0-9 _-]{1,80}$/) fontName?: string;
  @IsOptional() @IsNumber() @Min(10) @Max(200) fontSize?: number;
  @IsOptional() @IsString() @Matches(/^#[a-fA-F0-9]{6}$/) fontColor?: string;
  @IsOptional() @IsString() @Matches(/^#[a-fA-F0-9]{6}$/) borderColor?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(10) borderWidth?: number;
  @IsOptional() @IsString() @Matches(/^#[a-fA-F0-9]{6}$/) highlightColor?: string;
  @IsOptional() @IsString() @Matches(/^#[a-fA-F0-9]{6}$/) bgColor?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) bgOpacity?: number;
  @IsOptional() @IsIn(['none','glow','pop','box']) effect?: 'none'|'glow'|'pop'|'box';
  @IsOptional() @IsNumber() @Min(0) @Max(1) baseOpacity?: number;
  @IsOptional() @IsBoolean() uppercase?: boolean;
}
export class SourceHookDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(300) text?: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(14400) durationSeconds?: number;
  @IsOptional() @IsIn(['pill','classic','dark','yellow','red','outline','outline_yellow']) style?: string;
}
export class SourceAudioDto {
  @IsOptional() @IsIn(['keep','mute','mix-narration','replace-narration']) mode?: 'keep' | 'mute' | 'mix-narration' | 'replace-narration';
  @IsOptional() @IsIn(AI_VIDEO_VOICES) voice?: string;
  @IsOptional() @IsString() @MaxLength(1500) narrationText?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) bgmMediaId?: string;
}
export class SourceEffectDto {
  @IsIn(['zoom_in','punch_in','zoom_pulse','color_pop','bw_moment','flash','vignette']) type: string;
  @IsNumber() @Min(0) @Max(14400) start: number;
  @IsNumber() @Min(0) @Max(14400) end: number;
  @IsNumber() @Min(0) @Max(1) strength: number;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  /** Zoom types: focus point (0-1 of the frame) the zoom pushes toward; default centre. */
  @IsOptional() @IsNumber() @Min(0) @Max(1) centerX?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) centerY?: number;
}
export class SourceMotionDesignDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['clean','bold','minimal']) theme?: 'clean'|'bold'|'minimal';
  @IsOptional() @IsIn(['none','fade','slide']) transitions?: 'none'|'fade'|'slide';
  @IsOptional() @IsString() @MaxLength(300) lowerThird?: string;
}
export class SourceWebhookDto {
  @IsString() @MinLength(1) @MaxLength(4096) url:string;
  @IsString() @MinLength(16) @MaxLength(512) secret:string;
}
export class SourceVideoDto {
  @IsOptional() @ValidateNested() @Type(()=>SourceWebhookDto) webhook?:SourceWebhookDto;
  @IsOptional() @IsBoolean() reviewBeforeRender?: boolean;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) idempotencyKey?: string;
  @IsOptional() @ValidateNested() @Type(() => SourceMotionDesignDto) motionDesign?: SourceMotionDesignDto;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) mediaId?: string;
  @IsOptional() @IsString() @MaxLength(4096) sourceUrl?: string;
  @IsOptional() @IsIn(['clips', 'edit']) operation?: 'clips' | 'edit';
  @IsOptional() @IsIn(['9:16', '16:9', '1:1']) aspectRatio?: SourceAspectRatio;
  @IsOptional() @ValidateNested() @Type(() => SourceSelectionDto) selection?: SourceSelectionDto;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({each:true}) @Type(() => SourceSegmentDto) segments?: SourceSegmentDto[];
  @IsOptional() @IsIn(['auto', 'general', 'screencast', 'wide', 'speaker-cut']) layout?: 'auto' | 'general' | 'screencast' | 'wide' | 'speaker-cut';
  @IsOptional() @ValidateNested() @Type(() => SourceCaptionsDto) captions?: SourceCaptionsDto;
  @IsOptional() @ValidateNested() @Type(() => SourceHookDto) hook?: SourceHookDto;
  @IsOptional() @ValidateNested() @Type(() => SourceAudioDto) audio?: SourceAudioDto;
  @IsOptional() @IsString() @MaxLength(4000) designBrief?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({each:true}) @Type(() => SourceEffectDto) effects?: SourceEffectDto[];
  @IsOptional() @IsObject() cropOverrides?: Record<string,number|{top:number|{x:number;y:number};bottom:number|{x:number;y:number}}>;

}
export class ReviseSourceVideoDto extends SourceVideoDto {
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number;
  @IsString() @MinLength(1) @MaxLength(200) clipId: string;
}
/** Grounded copy written by AGY from the clip transcript and sampled frames (engine hook_decisions.clip_content). */
export interface SourceClipContent {
  version: number; source: 'agy-grounded'|'clip-selection'; language: string; title: string; description: string;
  hashtags: string[]; postText: string; hook?: string|null;
  narration?: {text:string;syllables:number;targetSyllables:number;durationSeconds:number;syllablesPerSecond:number|null;estimatedSeconds:number;coversWholeClip:boolean}|null;
  selectionRationale?: string|null; selection?: Record<string,unknown>; grounding?: Record<string,unknown>|null; warnings?: string[];
}
export interface SourceClip {
  clipId: string; title: string; durationSeconds: number; aspectRatio: SourceAspectRatio; content?: SourceClipContent|null;
  segments: SourceSegmentDto[]; transcript?: unknown; transcriptOmitted?: boolean; media: { id: string; path: string; thumbnail?: string | null }; sha256: string;
}
export interface SourceJobStatus {
  jobId: string; projectId: string; revision: number; parentJobId?: string;
  status: 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  progress: number; stage: string; plan?: SourcePublicPlan; workflowId?: string; clips: SourceClip[]; warnings: string[]; error?: string;
  webhook?:{status:string;attempts:number;nextAttemptAt:Date;lastStatusCode:number|null;lastError:string|null;deliveredAt:Date|null};
  /** 'summary' = polling snapshot without transcripts (GET ?include=transcript or /transcript for them). */
  detail?:'summary'; updatedAt?:string;
}
export interface SourceReceipt {
  orgId: string; createdAt: number; updatedAt: number; input: SourceVideoDto;
  sourcePath?: string; sourceSha256?: string; engineSha256?: string; workflowId?: string; workflowStarted?:boolean;
  plan?: SourceAnalysisPlan; approvedPlan?: SourceAnalysisPlan; rendered?: unknown; artifacts?: Record<string,string>;
  finalization?:{status:'completed'|'failed'|'cancelled';message?:string};
  parentClip?: Record<string,unknown>; narrationPath?:string; bgmPath?:string; agyReceipts?:unknown[]; state: SourceJobStatus;
}

export interface SourcePlanClip { clipId:string; title:string; segments:SourceSegmentDto[]; aspectRatio:SourceAspectRatio; layout:string; hook?:SourceHookDto; effects?:SourceEffectDto[]; scenes?:unknown[]; content?:SourceClipContent|null }
export interface SourcePublicPlan { version:number; planVersion:number; clips:SourcePlanClip[]; transcript?:unknown; transcriptOmitted?:boolean; media?:Record<string,unknown>; warnings?:string[] }
export interface SourceAnalysisPlan extends SourcePublicPlan { sourceFingerprint:string; engineFingerprint:string; requestFingerprint:string; scenes?:unknown[] }
export class ApproveSourceClipDto {
  @IsString() @MaxLength(200) clipId:string;
  @IsString() @MaxLength(300) title:string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({each:true}) @Type(()=>SourceSegmentDto) segments:SourceSegmentDto[];
}
export class ApproveSourceVideoDto {
  @IsInt() @Min(1) expectedPlanVersion:number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({each:true}) @Type(()=>ApproveSourceClipDto) clips?:ApproveSourceClipDto[];
}
