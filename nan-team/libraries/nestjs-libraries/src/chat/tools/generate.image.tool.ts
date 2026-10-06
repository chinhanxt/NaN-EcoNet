import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { AgyMcpService, MAX_REFERENCE_IMAGES, agyMaxImagesPerRequest } from '../../videos/agy-mcp/agy.mcp.service';
import { getReferenceImages } from '@gitroom/nestjs-libraries/chat/async.storage';

@Injectable()
export class GenerateImageTool implements AgentToolInterface {
  constructor(
    private _mediaService: MediaService,
    private _subscriptionService: SubscriptionService,
    private readonly nativeAgy: AgyMcpService,
  ) {}
  name = 'generateImageTool';

  run() {
    return createTool({
      id: 'generateImageTool',
      description: `Generate image to use in a post,
                    in case the user specified a platform that requires attachment and attachment was not provided,
                    ask if they want to generate a picture of a video.
                    When the user asks for several images (e.g. "tạo 4 ảnh"), call this tool ONCE with count
                    (max 6): every image is a separate job generated in parallel with a different composition.
                    Images attached to the user's latest message are passed automatically as reference images
                    (the new image keeps their layout and style, with the requested subject); referenceImageUrls overrides them.
      `,
      mcp: {
        annotations: {
          title: 'Generate Image',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      inputSchema: z.object({
        prompt: z.string(),
        count: z.number().int().min(1).max(6).optional().describe('How many different images to generate in parallel (default 1, max 6)'),
        referenceImageUrls: z.array(z.string()).max(MAX_REFERENCE_IMAGES).optional()
          .describe('Optional sample image URLs (uploads) to follow for layout/style; defaults to the images on the latest user message'),
      }),
      // Mastra validates the return against this schema, so it must also
      // allow the graceful { error } shape (same as uploadFromUrlTool)
      outputSchema: z.object({
        id: z.string().optional(),
        path: z.string().optional(),
        error: z.string().optional(),
        images: z.array(z.object({ id: z.string().optional(), path: z.string().optional() })).optional(),
        failed: z.number().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const org = JSON.parse((context?.requestContext as any)?.get('organization') as string);
        try {
          // Same credit gate as the dashboard's /media/generate-image route -
          // only enforced when billing is enabled (cloud), self-hosted is free
          const total = await this._subscriptionService.checkCredits(org);
          if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
            return {
              error: 'No AI image credits are available on this account.',
            };
          }

          const count = Math.min(agyMaxImagesPerRequest(), Math.max(1, Math.floor(inputData.count || 1)));
          const references = (inputData.referenceImageUrls?.length ? inputData.referenceImageUrls : getReferenceImages())
            .slice(0, MAX_REFERENCE_IMAGES);
          // With samples the reference decides the frame shape; without them keep the 9:16 default.
          const aspectRatio = references.length ? 'auto' as const : '9:16' as const;
          if (count === 1) {
            const file = await this.nativeAgy.image(inputData.prompt, undefined, aspectRatio, references);
            return await this._mediaService.saveFile(org.id, file.split('/').pop(), file);
          }
          // Fan-out: one AGY job per image, in parallel across accounts; each image is saved as soon as
          // it is ready and a failed image does not fail the others.
          const saved: { id?: string; path?: string }[] = [];
          const { errors } = await this.nativeAgy.imageBatch(inputData.prompt, count, undefined, aspectRatio, async (_index, file) => {
            const media = await this._mediaService.saveFile(org.id, file.split('/').pop(), file);
            saved.push({ id: media?.id, path: media?.path });
          }, references);
          return {
            ...saved[0],
            images: saved,
            ...(errors.length ? { failed: errors.length, error: `${errors.length} of ${count} images failed: ${errors[0].message}` } : {}),
          };
        } catch (err) {
          return {
            error: `Image generation failed: ${
              err instanceof Error ? err.message : String(err)
            }. The user's image credit was not used.`,
          };
        }
      },
    });
  }
}
