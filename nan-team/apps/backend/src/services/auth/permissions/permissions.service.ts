import { Ability, AbilityBuilder, AbilityClass } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { AuthorizationActions, Sections } from './permission.exception.class';

export type AppAbility = Ability<[AuthorizationActions, Sections]>;

@Injectable()
export class PermissionsService {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _postsService: PostsService,
    private _integrationService: IntegrationService,
    private _webhooksService: WebhooksService
  ) {}
  async getPackageOptions(orgId: string) {
    return {
      subscription: { subscriptionTier: 'PRO', totalChannels: 999999 },
      options: {
        channel: 999999,
        channels: 999999,
        posts: 999999,
        posts_per_month: 999999,
        webhooks: 999999,
        team_members: 999999,
        autoPost: true,
        ai: true,
        ai_generation: 999999,
        image_generation_count: 999999,
        clipping: 999999,
        clipping_minutes: 999999,
        generate_videos: 999999,
        community_features: true,
        featured_by_gitroom: true,
        import_from_channels: true,
        image_generator: true,
        public_api: true,
      },
    };
  }

  async check(
    orgId: string,
    created_at: Date,
    permission: 'USER' | 'ADMIN' | 'SUPERADMIN',
    requestedPermission: Array<[AuthorizationActions, Sections]>,
    refreshChannelId?: string
  ) {
    const { can, build } = new AbilityBuilder<
      Ability<[AuthorizationActions, Sections]>
    >(Ability as AbilityClass<AppAbility>);

    for (const [action, section] of requestedPermission) {
      if (
        section === Sections.ADMIN &&
        !['ADMIN', 'SUPERADMIN'].includes(permission)
      ) {
        continue;
      }
      can(action, section);
    }

    return build({
      detectSubjectType: (item) =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        item.constructor,
    });
  }
}
