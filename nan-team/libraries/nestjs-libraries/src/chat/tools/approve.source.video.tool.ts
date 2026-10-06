import { HttpException, Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { SourceVideoService } from '../../videos/openshorts/source-video.service';
import { requireOrganization } from '../auth.context';

@Injectable()
export class ApproveSourceVideoTool implements AgentToolInterface {
  constructor(private readonly videos: SourceVideoService) {}
  name = 'approveSourceVideoTool';

  run() {
    return createTool({
      id: this.name,
      description: 'Approve a source-video plan only after the user has reviewed it and explicitly requested rendering. Read sourceVideoStatusTool first and pass its exact planVersion as expectedPlanVersion. Optional clips select/reorder proposed clips or apply user-requested titles and absolute source timestamps. Never approve automatically, invent clip IDs, or silently retry a changed plan: show the updated plan to the user. This starts rendering, not social publishing; call sourceVideoStatusTool with waitSeconds for saved Media.',
      inputSchema: z.object({
        jobId: z.string().uuid(),
        expectedPlanVersion: z.number().int().positive(),
        clips: z.array(z.object({
          clipId: z.string().min(1).max(200),
          title: z.string().max(300),
          segments: z.array(z.object({
            startSeconds: z.number().min(0).max(14400),
            endSeconds: z.number().min(0.1).max(14400),
          })).min(1).max(12),
        })).min(1).max(10).optional(),
      }),
      execute: async (input, context) => {
        try {
          const org = requireOrganization(input, context);
          const { jobId, ...approval } = input;
          const job = await this.videos.approve(org, jobId, approval);
          return { jobId: job.jobId, projectId: job.projectId, revision: job.revision, status: job.status, stage: job.stage };
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Source approval failed',
            statusCode: error instanceof HttpException ? error.getStatus() : undefined };
        }
      },
    });
  }
}
