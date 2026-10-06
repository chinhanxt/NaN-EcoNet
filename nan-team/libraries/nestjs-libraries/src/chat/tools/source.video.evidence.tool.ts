import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';

@Injectable()
export class SourceVideoEvidenceTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='sourceVideoEvidenceTool';
  run(){return createTool({id:this.name,
    description:'Read paginated transcript, words, source scenes or crop-scenes for an authenticated video job. Without clipId, timestamps refer to the original source. Completed clip transcripts and crop-scenes use the concatenated clip timeline; sourceSegments maps back to source timestamps. editVideoClipTool always expects original-source segments. scenes is source-only and its array positions are NOT crop indices. crop-scenes requires a completed clipId and returns actual detector sceneIndex values for cropOverrides. Preserve its sourceSegments when applying those indices; after recutting, read the new revision manifest before cropping. Follow nextOffset; ASR may contain recognition errors.',
    inputSchema:z.object({jobId:z.string().uuid(),kind:z.enum(['transcript','words','scenes','crop-scenes']),clipId:z.string().min(1).max(200).optional(),offset:z.number().int().min(0).max(1_000_000).default(0),limit:z.number().int().min(1).max(100).default(20)}),
    execute:async(input,context)=>{try{
      const org=requireOrganization(input,context),job=await this.videos.status(org.id,input.jobId);
      if(!job.plan)throw new Error('Source analysis is not available yet');
      if(input.clipId&&input.kind==='scenes')throw new Error('Scene evidence uses original-source timestamps; omit clipId');
      const clip=input.clipId?job.clips.find(item=>item.clipId===input.clipId):undefined;
      if(input.clipId&&!clip)throw new Error('Completed clip not found');
      if(input.kind==='crop-scenes'&&!clip)throw new Error('crop-scenes requires a completed clipId');
      if(clip&&!clip.transcript&&['transcript','words'].includes(input.kind))throw new Error('Clip transcript is not available');
      const transcript=(clip?clip.transcript:job.plan.transcript) as {language?:string;segments?:Array<{start:number;end:number;text?:string;words?:Array<{start:number;end:number;word?:string}>}>}|undefined;
      const segments=Array.isArray(transcript?.segments)?transcript.segments:[];
      let entries:Array<Record<string,unknown>>;
      if(input.kind==='crop-scenes'){
        const scenes=await this.videos.cropScenes(org.id,input.jobId,input.clipId!);
        entries=scenes.map(item=>{const scene=item as Record<string,unknown>;return {sceneIndex:scene.sceneIndex,startSeconds:scene.startSeconds,endSeconds:scene.endSeconds,strategy:scene.strategy};});
      }else if(input.kind==='scenes'){
        const scenes=await this.videos.sourceScenes(org.id,input.jobId);
        entries=scenes.map(item=>{const scene=item as Record<string,unknown>;return {startSeconds:scene.startSeconds,endSeconds:scene.endSeconds};});
      }else if(input.kind==='words'){
        entries=segments.flatMap(segment=>(segment.words||[]).map(word=>({startSeconds:word.start,endSeconds:word.end,text:String(word.word||'').slice(0,300)})));
      }else{
        entries=segments.map(segment=>({startSeconds:segment.start,endSeconds:segment.end,text:String(segment.text||'').slice(0,2000),textTruncated:String(segment.text||'').length>2000}));
      }
      const limit=input.kind==='transcript'?Math.min(input.limit,25):input.limit;
      const page=entries.slice(input.offset,input.offset+limit);
      return {jobId:job.jobId,clipId:input.clipId,kind:input.kind,timestampBasis:clip?'clip':'source',sourceSegments:clip?.segments,language:transcript?.language,
        items:page,total:entries.length,nextOffset:input.offset+page.length<entries.length?input.offset+page.length:null};
    }catch(e){return {error:e instanceof Error?e.message:'Source video evidence request failed'};}}
  });}
}
