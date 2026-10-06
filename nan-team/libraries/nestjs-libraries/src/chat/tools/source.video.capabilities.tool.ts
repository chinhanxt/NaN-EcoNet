import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';

@Injectable()
export class SourceVideoCapabilitiesTool implements AgentToolInterface {
  constructor(private readonly videos: SourceVideoService) {}
  name = 'sourceVideoCapabilitiesTool';
  run() {
    return createTool({
      id: this.name,
      description: 'Check local OpenShorts worker, ASR/tracking assets and runtime prerequisites before starting a source video. Installed prerequisites do not prove AGY authentication or successful vision inference; only a real task proves that. Do not claim missing assets or model connections are ready.',
      inputSchema: z.object({}),
      execute: async (input, context) => {
        try {
          requireOrganization(input, context);
          return await this.videos.capabilities();
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Source capabilities unavailable' };
        }
      },
    });
  }
}
