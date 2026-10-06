import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { requireOrganization } from '../auth.context';
import { RemotionService } from '../../videos/remotion/remotion.service';
import { MAX_STATUS_WAIT_SECONDS, statusWaitSeconds, waitForJobChange } from './source.video.status.wait';

@Injectable()
export class AiVideoStatusTool implements AgentToolInterface {
  constructor(private readonly videos: RemotionService) {}
  name = 'aiVideoStatusTool';
  run() {
    return createTool({
      id: this.name,
      mcp: { annotations: { title: 'AI Video Progress', readOnlyHint: true,
        destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      description: 'Check a job started by generateAiVideoTool. While queued or rendering, pass waitSeconds '
        + `(up to ${MAX_STATUS_WAIT_SECONDS}) instead of calling repeatedly; at most two waiting calls per chat turn: if it is still rendering after them, `
        + 'reply in ONE short Vietnamese sentence with the jobId in backticks, e.g. "Video đang được tạo (mã `<jobId>`), tiến trình hiển thị ngay bên dưới." No stage/progress/status lists, no Studio mention: the chat shows a live progress card for that jobId, and end the turn (the job keeps running; the user can ask again). '
        + 'When completed, media.id and media.path are the real saved video attachment for scheduling. '
        + 'When failed or cancelled, report the error and do not claim that a video was created.',
      inputSchema: z.object({ jobId: z.string().uuid(), waitSeconds: statusWaitSeconds }),
      outputSchema: z.object({
        jobId: z.string().optional(), status: z.string().optional(), progress: z.number().optional(),
        stage: z.string().optional(), media: z.object({ id:z.string(), path:z.string() }).passthrough().optional(),
        error: z.string().optional(), waitedSeconds: z.number().optional(),
      }),
      execute: async (input, context) => {
        try {
          const organization = requireOrganization(input, context);
          const { job, waitedSeconds } = await waitForJobChange(() => this.videos.getStatus(organization.id, input.jobId),
            input.waitSeconds, (state) => !['queued', 'rendering'].includes(state.status), (context as any)?.abortSignal);
          return input.waitSeconds ? { ...job, waitedSeconds } : job;
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Cannot read AI video progress' };
        }
      },
    });
  }
}
