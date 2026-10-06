import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';

@Injectable()
export class SourceVideoDownloadTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='sourceVideoDownloadTool';
  run(){return createTool({id:this.name,
    description:'Get authenticated ZIP download links for all saved clips of a completed source-video job. downloadUrl requires the same Authorization Bearer credential as this MCP connection; the host supplies it privately, never ask the model/user to paste secrets. browserDownloadUrl uses an existing NaN-Team browser login. Links contain no credential and expire access when the account credential is revoked. ZIP is generated on download, verifies clip hashes and removes the temporary archive after transfer. Never present these protected links as public URLs.',
    inputSchema:z.object({jobId:z.string().uuid()}),
    execute:async(input,context)=>{try{
      const org=requireOrganization(input,context),job=await this.videos.status(org.id,input.jobId);
      if(job.status!=='completed'||!job.clips.length)throw new Error('Clips are not ready');
      const base=process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL||process.env.NEXT_PUBLIC_BACKEND_URL;
      if(!base)throw new Error('Backend download URL is not configured');
      const origin=new URL(base);if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('Invalid backend download URL');
      origin.search='';origin.hash='';origin.pathname=origin.pathname.replace(/\/?$/, '/');
      return {jobId:job.jobId,downloadUrl:new URL(`public/v1/source-video-jobs/${input.jobId}/download-all`,origin).toString(),
        ...(!process.env.MCP_ONLY?{browserDownloadUrl:new URL(`ai-video/source-jobs/${input.jobId}/download-all`,origin).toString()}:{}),
        authentication:'MCP Authorization Bearer credential for downloadUrl; NaN-Team browser login for browserDownloadUrl',
        contentType:'application/zip',filename:`clips-${job.jobId}.zip`,clipCount:job.clips.length};
    }catch(e){return {error:e instanceof Error?e.message:'Source video download request failed'};}}
  });}
}
