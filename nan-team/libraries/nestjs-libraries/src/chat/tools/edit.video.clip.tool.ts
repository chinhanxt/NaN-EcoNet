import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';
import { sourceVideoRevisionOptions } from './process.source.video.tool';
@Injectable()
export class EditVideoClipTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='editVideoClipTool';
  run(){return createTool({id:this.name,description:'Create a new revision of a completed source clip. Read status and pass its current revision as expectedRevision. Segments use absolute source timestamps. For cropOverrides, read sourceVideoEvidenceTool kind crop-scenes for this clip and use the reported sceneIndex keys; these indices belong to the unchanged clip EDL, so recut first and inspect the new manifest before cropping. Omitted options preserve parent framing, layout and audio. Returns a new jobId to poll.',inputSchema:z.object({...sourceVideoRevisionOptions,jobId:z.string().uuid(),clipId:z.string().min(1).max(200),expectedRevision:z.number().int().positive()}),
    execute:async(input,context)=>{try{const org=requireOrganization(input,context);return await this.videos.revise(org,input.jobId,((({jobId,...revision})=>revision)(input)));}catch(e){return {error:e instanceof Error?e.message:'Source video request failed'};}}
  });}
}
