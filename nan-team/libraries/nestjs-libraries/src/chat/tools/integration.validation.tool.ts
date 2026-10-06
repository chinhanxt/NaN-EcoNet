import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
  IntegrationManager,
  socialIntegrationList,
} from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { getValidationSchemas } from '@gitroom/nestjs-libraries/chat/validation.schemas.helper';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';

@Injectable()
export class IntegrationValidationTool implements AgentToolInterface {
  constructor(
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService
  ) {}
  name = 'integrationSchema';

  run() {
    return createTool({
      id: 'integrationSchema',
      description: `Everytime we want to schedule a social media post, we need to understand the schema of the integration.
         This tool helps us get the schema of the integration.
         Sometimes we might get a schema back the requires some id, for that, you can get information from 'tools'
         And use the triggerTool function.
        `,
      mcp: {
        annotations: {
          title: 'Get Integration Schema',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe(
            'The channel (integration) id; platform and isPremium are resolved from it when omitted'
          ),
        isPremium: z
          .boolean()
          .optional()
          .describe(
            'is this the user premium? if not, set to false (default: from the channel id, else false)'
          ),
        platform: z
          .string()
          .optional()
          .describe(
            `platform identifier (${socialIntegrationList
              .map((p) => p.identifier)
              .join(', ')}); optional when id is given`
          ),
      }),
      outputSchema: z.object({
        output: z.object({
          rules: z.string(),
          maxLength: z
            .number()
            .describe('The maximum length of a post / comment'),
          settings: z
            .any()
            .describe('List of settings need to be passed to schedule a post'),
          tools: z
            .array(
              z.object({
                description: z.string().describe('Description of the tool'),
                methodName: z
                  .string()
                  .describe('Method to call to get the information'),
                dataSchema: z
                  .array(
                    z.object({
                      key: z
                        .string()
                        .describe('Name of the settings key to pass'),
                      description: z
                        .string()
                        .describe('Description of the setting key'),
                      type: z.string(),
                    })
                  )
                  .describe(
                    'This will be passed to schedulePostTool [output:settings]'
                  ),
              })
            )
            .describe(
              "Sometimes settings require some id, tags and stuff, if you don't have, trigger the `triggerTool` function from the tools list [output:callable-tools]"
            ),
        }),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        let platform = inputData.platform;
        let premium: unknown = inputData.isPremium;
        if (inputData.id && (!platform || premium === undefined)) {
          const organizationId = JSON.parse(
            (context?.requestContext as any)?.get('organization') as string
          ).id;
          const channel = await this._integrationService.getIntegrationById(
            organizationId,
            inputData.id
          );
          if (channel && !channel.deletedAt) {
            platform = platform || channel.providerIdentifier;
            if (premium === undefined) {
              // Same source as post validation: the channel's additionalSettings ("Verified" for X).
              try {
                premium = JSON.parse(channel.additionalSettings || '[]');
              } catch {
                premium = false;
              }
            }
          }
        }
        const integration = socialIntegrationList.find(
          (p) => p.identifier === platform
        )!;

        if (!integration) {
          return {
            output: { rules: '', maxLength: 0, settings: {}, tools: [] },
          };
        }

        const maxLength = integration.maxLength(premium ?? false);
        const schemas = !integration.dto
          ? false
          : getValidationSchemas()[integration.dto.name];
        const tools = this._integrationManager.getAllTools();
        const rules = this._integrationManager.getAllRulesDescription();

        return {
          output: {
            rules: rules[integration.identifier],
            maxLength,
            settings: !schemas ? 'No additional settings required' : schemas,
            tools: tools[integration.identifier],
          },
        };
      },
    });
  }
}
