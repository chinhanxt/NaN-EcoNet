import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';
@Injectable()
export class SourceVideoProjectsTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='sourceVideoProjectsTool';
  run(){return createTool({id:this.name,description:'List recent authenticated organization source-video jobs and revisions, newest first, without full plans/transcripts. The recent window includes up to 100 jobs. Follow nextOffset for this window; use sourceVideoStatusTool for a selected job and sourceVideoEvidenceTool for transcript/scenes.',inputSchema:z.object({offset:z.number().int().min(0).max(100).default(0),limit:z.number().int().min(1).max(25).default(10)}),
    execute:async(input,context)=>{try{
      const org=requireOrganization(input,context),jobs=await this.videos.list(org.id);
      const projects=jobs.slice(input.offset,input.offset+input.limit).map(job=>({jobId:job.jobId,projectId:job.projectId,revision:job.revision,parentJobId:job.parentJobId,status:job.status,stage:job.stage,progress:job.progress,
        warnings:job.warnings?.slice(0,10),error:job.error,clips:job.clips.map(clip=>({clipId:clip.clipId,title:clip.title,durationSeconds:clip.durationSeconds,aspectRatio:clip.aspectRatio,media:clip.media}))}));
      return {projects,recentWindowTotal:jobs.length,nextOffset:input.offset+projects.length<jobs.length?input.offset+projects.length:null};
    }catch(e){return {error:e instanceof Error?e.message:'Source video request failed'};}}
  });}
}
