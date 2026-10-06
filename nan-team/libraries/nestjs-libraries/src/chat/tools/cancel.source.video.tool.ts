import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';
@Injectable()
export class CancelSourceVideoTool implements AgentToolInterface {
  constructor(private readonly videos:SourceVideoService){}
  name='cancelSourceVideoTool';
  run(){return createTool({id:this.name,description:'Request cancellation of a source-video job belonging to the authenticated organization. Cancellation may still be in progress; use sourceVideoStatusTool with waitSeconds to confirm terminal cancelled status before claiming the worker exited.',inputSchema:z.object({jobId:z.string().uuid()}),
    execute:async(input,context)=>{try{const org=requireOrganization(input,context);return await this.videos.cancel(org.id,input.jobId);}catch(e){return {error:e instanceof Error?e.message:'Source video request failed'};}}
  });}
}
