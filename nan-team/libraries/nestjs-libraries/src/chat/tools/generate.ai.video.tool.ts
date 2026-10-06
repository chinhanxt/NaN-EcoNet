import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { requireOrganization } from '../auth.context';
import { RemotionService } from '../../videos/remotion/remotion.service';
import { AI_VIDEO_VOICES } from '../../videos/remotion/dto/ai.video.dto';

@Injectable()
export class GenerateAiVideoTool implements AgentToolInterface {
  constructor(private readonly videos: RemotionService) {}
  name = 'generateAiVideoTool';
  run() {
    return createTool({
      id: this.name,
      mcp: { annotations: { title: 'Create Narrated AI Video', readOnlyHint: false,
        destructiveHint: false, idempotentHint: false, openWorldHint: true } },
      description: 'Create a complete 15, 30, or 60 second Vietnamese narrated vertical video from a topic. '
        + 'Use this tool for AI storyboard videos with coherent generated images, Vietnamese voice, animated word captions, and background music. '
        + 'Native AGY CLI uses authenticated MCP tools and design skills; rendering runs locally. '
        + 'Returns a jobId immediately; the job takes several minutes. Do not wait on aiVideoStatusTool after starting: reply in ONE short Vietnamese sentence with the jobId in backticks, e.g. \"Đã bắt đầu tạo video (mã `<jobId>`), tiến trình hiển thị ngay bên dưới.\" No stage/progress/status lists, no Studio mention: the chat shows a live progress card for that jobId and end the turn (the job keeps running). Only a completed status provides the media id and URL for the post attachment. '
        + 'If an idea job failed, resumeJobId reuses its saved script and images; supply the same original inputs. Retry only after confirming its terminal failed status. '
        + 'Generate the video before offering scheduling; follow the existing scheduling confirmation rules.',
      inputSchema: z.object({
        topic: z.string().trim().min(3).max(4000),
        targetDuration: z.union([z.literal(15), z.literal(30), z.literal(60)]),
        voice: z.enum(AI_VIDEO_VOICES).default('Thuyết Minh'),
        aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
        seedImageUrl: z.string().url().optional(),
        resumeJobId: z.string().uuid().optional(),
      }),
      outputSchema: z.object({ jobId: z.string().optional(), error: z.string().optional() }),
      execute: async (input, context) => {
        try {
          const organization = requireOrganization(input, context);
          return await this.videos.startFromTopic(organization, input);
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'AI video generation failed' };
        }
      },
    });
  }
}
