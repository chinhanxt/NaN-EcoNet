import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AllProvidersSettings } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/all.providers.settings';
import { Integration } from '@prisma/client';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import {
  ValidUrlExtension,
  ValidUrlPath,
} from '@gitroom/helpers/utils/valid.url.path';
import dayjs from 'dayjs';
import striptags from 'striptags';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const VN_TZ = 'Asia/Ho_Chi_Minh';
const CALENDAR_URL = 'http://localhost:4200/launches';
// An explicit date further in the past than this is a conversion mistake, not "post now".
const PAST_TOLERANCE_MINUTES = 10;
// A retry with the same channel, publish date and content within this window returns the existing post.
const DUPLICATE_WINDOW_MINUTES = 30;

// Compare post bodies independent of HTML markup, entities and whitespace.
const normalizeContent = (html?: string | null) =>
  striptags(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

// settings may arrive as the documented [{key, value}] array, a single {key, value} item,
// or a plain {settingKey: value} object; all become the array form.
const toSettingsArray = (
  value: { key: string; value?: any }[] | Record<string, any>
): { key: string; value?: any }[] => {
  if (Array.isArray(value)) return value;
  if (typeof value.key === 'string' && 'value' in value) {
    return [{ key: value.key, value: value.value }];
  }
  return Object.entries(value).map(([key, v]) => ({ key, value: v }));
};

// The model sends UTC. A string without offset is UTC (never the server's local zone);
// a string with Z / +07:00 keeps its own offset.
const parseUtc = (date?: string) => dayjs.utc(date || 'invalid');

const validUrlExtension = new ValidUrlExtension();
const validUrlPath = new ValidUrlPath();

// Same URL validation as MediaDto (valid.url.path) - each attachment must
// point to an allowed upload domain and a supported file extension.
const attachmentUrl = z
  .string()
  .refine((url) => validUrlPath.validate(url, {} as any), {
    message: validUrlPath.defaultMessage({} as any),
  })
  .refine((url) => validUrlExtension.validate(url, {} as any), {
    message: validUrlExtension.defaultMessage({} as any),
  });

@Injectable()
export class IntegrationSchedulePostTool implements AgentToolInterface {
  constructor(
    private _postsService: PostsService,
    private _integrationService: IntegrationService
  ) {}
  name = 'integrationSchedulePostTool';

  run() {
    return createTool({
      id: 'schedulePostTool',
      mcp: {
        annotations: {
          title: 'Schedule Social Media Post',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      description: `
Use this when the user wants to create a draft, scheduled, or immediate social media post on their connected channels, based on the integrationSchema tool.
Examples of the input shape:

A single LinkedIn post with one comment
- socialPost array length will be one
- postsAndComments array length will be two (one for the post, one for the comment)

20 Facebook posts each on individual days without comments
- socialPost array length will be 20
- postsAndComments array length will be one

Do not use this to update or delete existing posts.
If validation fails, the result contains output.errors describing what to fix; the call can be retried with corrected parameters.
The post exists only when the result has success: true and output[].postId. Never tell the user a post was scheduled otherwise.
Once this tool returned success: true in this turn, do not call it again for the same post. A repeated call with the same channel, date and content returns the existing post (output[].duplicate: true) instead of creating a new one.
`,
      inputSchema: z.object({
        socialPost: z
          .array(
            z.object({
              integrationId: z
                .string()
                .describe('The id of the integration (not internal id)'),
              isPremium: z
                .boolean()
                .default(false)
                .describe(
                  "If the integration is X, return if it's premium or not (default false)"
                ),
              date: z
                .string()
                .describe(
                  'The date of the post in UTC ISO 8601 with Z, e.g. 2026-10-02T09:00:00Z for 16:00 Vietnam time (UTC+7) on 02/10/2026'
                ),
              shortLink: z
                .boolean()
                .default(false)
                .describe(
                  'If the post has a link inside, we can ask the user if they want to add a short link (default false)'
                ),
              type: z
                .enum(['draft', 'schedule', 'now'])
                .default('schedule')
                .describe(
                  "The type of the post, if we pass now, we should pass the current date also (default 'schedule')"
                ),
              postsAndComments: z
                .array(
                  z.object({
                    content: z
                      .string()
                      .describe(
                        "The content of the post, HTML, Each line must be wrapped in <p> here is the possible tags: h1, h2, h3, u, strong, li, ul, p (you can't have u and strong together)"
                      ),
                    attachments: z
                      .array(attachmentUrl)
                      .default([])
                      .describe('The image of the post (URLS), default []'),
                  })
                )
                .describe(
                  'first item is the post, every other item is the comments'
                ),
              settings: z
                .union([
                  z.array(
                    z.object({
                      key: z
                        .string()
                        .describe('Name of the settings key to pass'),
                      value: z
                        .any()
                        .describe(
                          'Value of the key, always prefer the id then label if possible'
                        ),
                    })
                  ),
                  z.record(z.string(), z.any()),
                ])
                .transform(toSettingsArray)
                .default([])
                .describe(
                  'Array of {key, value}; relies on the integrationSchema tool to get the settings [input:settings]. Default [] when the channel needs no settings'
                ),
            })
          )
          .describe('Individual post'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        output: z
          .array(
            z.object({
              postId: z.string(),
              integration: z.string(),
              channelName: z.string().optional(),
              provider: z.string().optional(),
              type: z.string().optional(),
              scheduledDate: z.string().optional(),
              scheduledTimeVietnam: z.string().optional(),
              scheduledTimeUtc: z.string().optional(),
              isAutoScheduled5Min: z.boolean().optional(),
              calendarUrl: z.string().optional(),
              explanation: z.string().optional(),
              duplicate: z.boolean().optional(),
              sameTimeWarning: z
                .object({ postIds: z.array(z.string()), message: z.string() })
                .optional(),
            })
          )
          .or(z.object({ errors: z.string() })),
        calendarUrl: z.string().optional(),
        message: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;
        const finalOutput = [];
        const fail = (errors: string) => ({
          success: false,
          output: { errors },
          message: `Chưa tạo bài đăng nào: ${errors}`,
        });

        if (!inputData.socialPost?.length) {
          return fail('socialPost is empty, pass at least one channel.');
        }

        const integrations = {} as Record<string, Integration>;
        for (const platform of inputData.socialPost) {
          const integration = await this._integrationService.getIntegrationById(
            organizationId,
            platform.integrationId
          );
          if (!integration || integration.deletedAt) {
            return fail(
              `Channel ${platform.integrationId} was not found in this organization. Call integrationList and use one of the returned ids.`
            );
          }
          if (
            integration.disabled ||
            integration.refreshNeeded ||
            integration.inBetweenSteps
          ) {
            return fail(
              `Channel "${integration.name}" (${integration.providerIdentifier}) cannot receive posts (${
                integration.disabled
                  ? 'disabled'
                  : integration.refreshNeeded
                  ? 'needs to be reconnected'
                  : 'setup not finished'
              }). Ask the user to pick another channel or reconnect it.`
            );
          }
          integrations[platform.integrationId] = integration;

          // Same server-side validation as the dashboard / public API
          // (settings DTO + media checkValidity + empty / too-long content).
          const settings = platform.settings.reduce(
            (acc: AllProvidersSettings, s: { key: string; value: any }) => ({
              ...acc,
              [s.key]: s.value,
            }),
            {} as AllProvidersSettings
          );

          const [validation] = await this._postsService.validatePosts(
            organizationId,
            [
              {
                integration: { id: platform.integrationId },
                settings,
                value: platform.postsAndComments.map((p: any) => ({
                  content: p.content,
                  image: (p.attachments || []).map((path: string) => ({
                    path,
                  })),
                })),
              },
            ]
          );

          if (validation.emptyContent) {
            return fail(
              `${validation.name}: Your post should have at least one character or one image.`
            );
          }

          if (platform.type !== 'draft') {
            if (!validation.valid) {
              return fail(
                `${validation.name}: ${
                  validation.settingsError || 'Please fix your settings'
                }, please fix it, and try integrationSchedulePostTool again.`
              );
            }

            if (validation.errors !== true) {
              return fail(
                `${validation.name}: ${validation.errors}, please fix it, and try integrationSchedulePostTool again.`
              );
            }

            if (validation.tooLong) {
              return fail(
                `${validation.name}: The maximum characters is ${validation.maximumCharacters}, please fix it, and try integrationSchedulePostTool again.`
              );
            }
          }
        }

        // Resolve every date before creating anything, so one bad date never leaves a partial batch.
        const now = dayjs.utc();
        const planned = [] as {
          post: (typeof inputData.socialPost)[number];
          finalType: 'draft' | 'schedule';
          finalDateStr: string;
          isAutoScheduled5Min: boolean;
        }[];
        for (const post of inputData.socialPost) {
          const requested = parseUtc(post.date);
          if (post.type === 'draft') {
            planned.push({
              post,
              finalType: 'draft',
              finalDateStr: (requested.isValid() ? requested : now).toISOString(),
              isAutoScheduled5Min: false,
            });
            continue;
          }
          if (
            post.type !== 'now' &&
            requested.isValid() &&
            requested.isBefore(now.subtract(PAST_TOLERANCE_MINUTES, 'minute'))
          ) {
            return fail(
              `The date ${post.date} is ${requested
                .tz(VN_TZ)
                .format('HH:mm DD/MM/YYYY')} Vietnam time, which is already in the past (now ${now
                .tz(VN_TZ)
                .format(
                  'HH:mm DD/MM/YYYY'
                )} Vietnam time). Recheck the UTC conversion (Vietnam = UTC+7) or ask the user for a new time.`
            );
          }
          // User policy: no explicit future time (or "now") -> schedule 5 minutes from now.
          const auto =
            post.type === 'now' ||
            !requested.isValid() ||
            !requested.isAfter(now.add(2, 'minute'));
          planned.push({
            post,
            finalType: 'schedule',
            finalDateStr: (auto ? now.add(5, 'minute') : requested)
              .second(0)
              .millisecond(0)
              .toISOString(),
            isAutoScheduled5Min: auto,
          });
        }

        for (const {
          post,
          finalType,
          finalDateStr,
          isAutoScheduled5Min,
        } of planned) {
          const integration = integrations[post.integrationId];

          // Idempotency: the same post (channel, publish date, content) created in the last
          // DUPLICATE_WINDOW_MINUTES is returned as is; other posts in the same slot are reported.
          const content = normalizeContent(post.postsAndComments[0]?.content);
          const duplicateSince = now.subtract(DUPLICATE_WINDOW_MINUTES, 'minute');
          const slotPosts = await this._postsService.getPostsForSlot(
            organizationId,
            integration.id,
            finalDateStr
          );
          const existing = slotPosts.find(
            (p) =>
              !dayjs.utc(p.createdAt).isBefore(duplicateSince) &&
              normalizeContent(p.content) === content
          );
          const sameTimePostIds = slotPosts
            .filter((p) => p.id !== existing?.id)
            .map((p) => p.id);

          const output = existing
            ? [{ postId: existing.id, integration: integration.id }]
            : await this._postsService.createPost(
            organizationId,
            {
              date: finalDateStr,
              type: finalType,
              shortLink: post.shortLink,
              tags: [],
              posts: [
                {
                  integration,
                  group: makeId(10),
                  settings: post.settings.reduce(
                    (acc: AllProvidersSettings, s: { key: string; value: any }) => ({
                      ...acc,
                      [s.key]: s.value,
                    }),
                    {
                      __type: integration.providerIdentifier,
                    } as AllProvidersSettings
                  ),
                  value: post.postsAndComments.map((p: any) => ({
                    content: p.content,
                    id: makeId(10),
                    delay: 0,
                    image: p.attachments.map((p: any) => ({
                      id: makeId(10),
                      path: p,
                    })),
                  })),
                },
              ],
            },
            'MCP'
          );

          if (!output?.length) {
            return fail(
              `The post for channel "${integration.name}" was not saved${
                finalOutput.length
                  ? ` (posts already created: ${finalOutput
                      .map((p) => `${p.channelName} ${p.postId}`)
                      .join(', ')})`
                  : ''
              }.`
            );
          }

          const scheduledDateObj = dayjs.utc(finalDateStr);
          const formattedVietnamTime = scheduledDateObj
            .tz(VN_TZ)
            .format('HH:mm DD/MM/YYYY');
          const formattedUtcTime = scheduledDateObj.utc().format('HH:mm DD/MM/YYYY');
          const humanExplanation = finalType === 'draft'
            ? `Bài viết đã được lưu nháp (chưa lên lịch đăng) cho ngày ${formattedVietnamTime}.`
            : isAutoScheduled5Min
            ? `Bài viết đã được tự động lên lịch đăng sau 5 phút tới (vào lúc ${formattedVietnamTime}) do yêu cầu không chỉ định thời gian cụ thể.`
            : `Bài viết đã được lên lịch đăng vào lúc ${formattedVietnamTime} theo đúng thời gian bạn yêu cầu.`;

          const shortTime = scheduledDateObj.tz(VN_TZ).format('HH:mm DD/MM');
          for (const item of output) {
            finalOutput.push({
              postId: item.postId,
              integration: item.integration,
              channelName: integration.name,
              provider: integration.providerIdentifier,
              type: finalType,
              scheduledDate: finalDateStr,
              scheduledTimeVietnam: formattedVietnamTime,
              scheduledTimeUtc: formattedUtcTime,
              isAutoScheduled5Min,
              calendarUrl: CALENDAR_URL,
              explanation: existing
                ? `Bài này đã có trên lịch (mã ${existing.id}, ${shortTime} trên ${integration.name}) — không tạo thêm`
                : humanExplanation,
              duplicate: !!existing,
              sameTimeWarning:
                !existing && sameTimePostIds.length
                  ? {
                      postIds: sameTimePostIds,
                      message: `Kênh ${integration.name} đã có bài khác lúc ${shortTime} (mã ${sameTimePostIds.join(', ')})`,
                    }
                  : undefined,
            });
          }
        }

        return {
          success: true,
          output: finalOutput,
          calendarUrl: CALENDAR_URL,
          message: finalOutput
            .map((p) =>
              p.duplicate
                ? `${p.explanation}.`
                : `Kênh ${p.channelName} (${p.provider}): ${
                    p.type === 'draft' ? 'nháp' : 'đã lên lịch'
                  } ${p.scheduledTimeVietnam} giờ Việt Nam, mã bài ${p.postId}.${
                    p.sameTimeWarning ? ` ⚠️ ${p.sameTimeWarning.message}.` : ''
                  }`
            )
            .join(' '),
        };
      },
    });
  }
}
