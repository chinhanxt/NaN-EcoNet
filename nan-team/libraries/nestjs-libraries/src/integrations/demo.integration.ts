import type { Integration } from '@prisma/client';
import type { PostResponse } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

// Well-known token of the seeded demo channel (scripts/seed-admin.cjs).
// A channel holding this token is a sandbox: publishing never calls the
// provider API, the post is marked as published with a link to the calendar,
// and analytics return no data (so a fake token never triggers a refresh /
// disconnect). Keep the value in sync with DEMO_TOKEN in scripts/seed-admin.cjs.
export const DEMO_INTEGRATION_TOKEN = 'demo-not-a-real-token';

export const isDemoIntegration = (
  integration?: Pick<Integration, 'token'> | null
) => integration?.token === DEMO_INTEGRATION_TOKEN;

export const demoPostResponse = (posts: { id: string }[]): PostResponse[] =>
  posts.map((p) => ({
    id: p.id,
    postId: `demo-${p.id}`,
    releaseURL: `${process.env.FRONTEND_URL || ''}/launches`,
    status: 'success',
  }));
