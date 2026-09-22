import {
  Logger,
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Query,
  Param,
} from '@nestjs/common';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MastraAgent } from '@ag-ui/mastra';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { Request, Response } from 'express';
import { RequestContext } from '@mastra/core/di';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

export type ChannelsContext = {
  integrations: string;
  organization: string;
  ui: string;
};

// the copilot runtime writes its own CORS headers on the response, keep them aligned with main.ts
const copilotCors = () => ({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:6274',
    ...(process.env.MAIN_URL ? [process.env.MAIN_URL] : []),
  ],
  credentials: !process.env.NOT_SECURED,
});

const defaultCopilotAgents = {
  default: {
    name: 'default',
    description: 'NaN-Team Assistant Agent',
  },
  postiz: {
    name: 'postiz',
    description: 'NaN-Team Assistant Agent',
  },
};

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _mastraService: MastraService
  ) {}
  @Post('/chat')
  chatAgent(@Req() req: Request, @Res() res: Response) {
    if (req.body?.method === 'info') {
      return res.status(200).json({
        version: '1.0.0',
        agents: defaultCopilotAgents,
        actions: [],
      });
    }

    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return res.status(200).json({
        version: '1.0.0',
        agents: defaultCopilotAgents,
        actions: [],
        disabled: true,
      });
    }

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/chat',
      cors: copilotCors(),
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Get('/chat')
  chatGet(@Res() res: Response) {
    return res.status(200).json({
      version: '1.0.0',
      agents: defaultCopilotAgents,
      actions: [],
    });
  }

  @Get('/chat/info')
  chatInfo(@Res() res: Response) {
    return res.status(200).json({
      version: '1.0.0',
      agents: defaultCopilotAgents,
      actions: [],
    });
  }

  @Get('/agent')
  agentGet(@Res() res: Response) {
    return res.status(200).json({
      version: '1.0.0',
      agents: defaultCopilotAgents,
      actions: [],
    });
  }

  @Get('/agent/info')
  agentInfo(@Res() res: Response) {
    return res.status(200).json({
      version: '1.0.0',
      agents: defaultCopilotAgents,
      actions: [],
    });
  }

  @Post('/agent')
  async agent(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (req.body?.method === 'info') {
      return res.status(200).json({
        version: '1.0.0',
        agents: defaultCopilotAgents,
        actions: [],
      });
    }

    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return res.status(200).json({
        version: '1.0.0',
        agents: defaultCopilotAgents,
        actions: [],
        disabled: true,
      });
    }
    const mastra = await this._mastraService.mastra();
    const requestContext = new RequestContext<ChannelsContext>();
    requestContext.set(
      'integrations',
      req?.body?.body?.forwardedProps?.integrations || []
    );

    requestContext.set('organization', JSON.stringify(organization));
    requestContext.set('ui', 'true');

    const agents = MastraAgent.getLocalAgents({
      resourceId: organization.id,
      mastra,
      requestContext: requestContext as any,
    });

    const runtime = new CopilotRuntime({
      agents,
    });

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/agent',
      cors: copilotCors(),
      runtime,
      serviceAdapter: new OpenAIAdapter({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos'
  ) {
    return this._subscriptionService.checkCredits(
      organization,
      type || 'ai_images'
    );
  }

  @Get('/:thread/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getMessagesList(
    @GetOrgFromRequest() organization: Organization,
    @Param('thread') threadId: string
  ): Promise<any> {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      return await memory.recall({
        resourceId: organization.id,
        threadId,
      });
    } catch (err) {
      Logger.warn(`Could not recall messages for thread ${threadId}: ${err}`);
      return { messages: [] };
    }
  }

  @Get('/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getList(@GetOrgFromRequest() organization: Organization) {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    const list = await memory.listThreads({
      filter: { resourceId: organization.id },
      perPage: 100000,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    return {
      threads: list.threads.map((p) => ({
        id: p.id,
        title: p.title,
      })),
    };
  }

  @Delete('/:thread')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async deleteThread(
    @GetOrgFromRequest() organization: Organization,
    @Param('thread') threadId: string
  ) {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      await memory.deleteThread(threadId);
      return { success: true };
    } catch (err) {
      Logger.warn(`Could not delete thread ${threadId}: ${err}`);
      return { success: false, error: (err as any)?.message };
    }
  }
}
