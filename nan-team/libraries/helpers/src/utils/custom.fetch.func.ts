export interface Params {
  baseUrl: string;
  beforeRequest?: (url: string, options: RequestInit) => Promise<RequestInit>;
  afterRequest?: (
    url: string,
    options: RequestInit,
    response: Response
  ) => Promise<boolean>;
}

const defaultSocialProviders = [
  { identifier: 'tiktok', name: 'TikTok', isExternal: false, isWeb3: false },
  { identifier: 'facebook', name: 'Facebook', isExternal: false, isWeb3: false },
  { identifier: 'youtube', name: 'YouTube', isExternal: false, isWeb3: false },
  { identifier: 'x', name: 'X (Twitter)', isExternal: false, isWeb3: false },
  { identifier: 'instagram', name: 'Instagram', isExternal: false, isWeb3: false },
  { identifier: 'threads', name: 'Threads', isExternal: false, isWeb3: false },
  { identifier: 'linkedin', name: 'LinkedIn', isExternal: false, isWeb3: false },
  { identifier: 'pinterest', name: 'Pinterest', isExternal: false, isWeb3: false },
  { identifier: 'telegram', name: 'Telegram', isExternal: false, isWeb3: false },
  { identifier: 'discord', name: 'Discord', isExternal: false, isWeb3: false },
  { identifier: 'slack', name: 'Slack', isExternal: false, isWeb3: false },
  { identifier: 'reddit', name: 'Reddit', isExternal: false, isWeb3: false },
  { identifier: 'bluesky', name: 'Bluesky', isExternal: false, isWeb3: false },
  { identifier: 'mastodon', name: 'Mastodon', isExternal: false, isWeb3: false },
  { identifier: 'medium', name: 'Medium', isExternal: false, isWeb3: false },
  { identifier: 'devto', name: 'Dev.to', isExternal: false, isWeb3: false },
  { identifier: 'hashnode', name: 'Hashnode', isExternal: false, isWeb3: false },
  { identifier: 'wordpress', name: 'WordPress', isExternal: false, isWeb3: false },
  { identifier: 'dribbble', name: 'Dribbble', isExternal: false, isWeb3: false },
  { identifier: 'twitch', name: 'Twitch', isExternal: false, isWeb3: false },
];

function createJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleFallback(url: string, options: RequestInit = {}, original?: Response): Promise<Response> {
  const cleanUrl = url.split('?')[0];

  if (cleanUrl === '/user/self') {
    try {
      const res = await fetch('/direct-user');
      if (res.ok) return res;
    } catch (e) {}
    return createJsonResponse({ error: 'User unavailable' }, 502);
  }

  if (cleanUrl === '/integrations/list') {
    try {
      const res = await fetch('/direct-channel');
      if (res.ok) return res;
    } catch (e) {}
    return createJsonResponse({ integrations: [] }, 200);
  }

  if (cleanUrl === '/integrations/plug/list') {
    return createJsonResponse(
      {
        plugs: [
          {
            name: 'X (Twitter)',
            identifier: 'x',
            plugs: [
              {
                identifier: 'x-autoRepostPost',
                title: 'Auto Repost Posts',
                description:
                  'When a post reached a certain number of likes, repost it to increase engagement (1 week old posts)',
                runEveryMilliseconds: 21600000,
                totalRuns: 3,
                methodName: 'autoRepostPost',
                fields: [
                  {
                    name: 'likesAmount',
                    type: 'number',
                    placeholder: 'Amount of likes',
                    description: 'The amount of likes to trigger the repost',
                    validation: '^\\d+$',
                  },
                ],
              },
              {
                identifier: 'x-autoPlugPost',
                title: 'Auto plug post',
                description:
                  'When a post reached a certain number of likes, add another post to it so you followers get a notification about your promotion',
                runEveryMilliseconds: 21600000,
                totalRuns: 3,
                methodName: 'autoPlugPost',
                fields: [
                  {
                    name: 'likesAmount',
                    type: 'number',
                    placeholder: 'Amount of likes',
                    description: 'The amount of likes to trigger the repost',
                    validation: '^\\d+$',
                  },
                  {
                    name: 'post',
                    type: 'richtext',
                    placeholder: 'Post to plug',
                    description: 'Message content to plug',
                    validation: '^[\\s\\S]{3,}$',
                  },
                ],
              },
            ],
          },
          {
            name: 'Facebook Page',
            identifier: 'facebook',
            plugs: [
              {
                identifier: 'facebook-autoRepostPost',
                title: 'Auto Repost Posts',
                description:
                  'When a post reached a certain number of likes, repost it to increase engagement (1 week old posts)',
                runEveryMilliseconds: 21600000,
                totalRuns: 3,
                methodName: 'autoRepostPost',
                fields: [
                  {
                    name: 'likesAmount',
                    type: 'number',
                    placeholder: 'Amount of likes',
                    description: 'The amount of likes to trigger the repost',
                    validation: '^\\d+$',
                  },
                ],
              },
              {
                identifier: 'facebook-autoPlugPost',
                title: 'Auto plug post',
                description:
                  'When a post reached a certain number of likes, add another post to it so you followers get a notification about your promotion',
                runEveryMilliseconds: 21600000,
                totalRuns: 3,
                methodName: 'autoPlugPost',
                fields: [
                  {
                    name: 'likesAmount',
                    type: 'number',
                    placeholder: 'Amount of likes',
                    description: 'The amount of likes to trigger the repost',
                    validation: '^\\d+$',
                  },
                  {
                    name: 'post',
                    type: 'richtext',
                    placeholder: 'Post to plug',
                    description: 'Message content to plug',
                    validation: '^[\\s\\S]{3,}$',
                  },
                ],
              },
            ],
          },
        ],
      },
      200
    );
  }

  if (cleanUrl.includes('/plugs')) {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/integrations') {
    if (options.method && options.method.toUpperCase() !== 'GET') {
      try {
        const res = await fetch('/direct-channel', options);
        if (res.ok) return res;
      } catch (e) {}
    }
    return createJsonResponse({ social: defaultSocialProviders, article: [] }, 200);
  }

  if (cleanUrl === '/third-party/list') {
    return createJsonResponse([
      {
        identifier: 'heygen',
        title: 'HeyGen',
        description: 'Tạo video AI hình đại diện chân thực từ kịch bản của bạn.',
        fields: [],
      },
      {
        identifier: 'reelfarm',
        title: 'ReelFarm',
        description: 'Tự động tạo các video ngắn hấp dẫn cho mạng xã hội.',
        fields: [],
      },
    ], 200);
  }

  if (cleanUrl === '/third-party') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl.includes('/copilot')) {
    return createJsonResponse({ threads: [], messages: [] }, 200);
  }

  if (cleanUrl.includes('/posts/find-slot')) {
    return createJsonResponse({ slot: new Date().toISOString() }, 200);
  }

  if (cleanUrl === '/user/organizations') {
    try {
      const userRes = await fetch('/direct-user');
      if (userRes.ok) {
        const u = await userRes.json();
        if (u?.orgId) {
          return createJsonResponse(
            [
              {
                id: u.orgId,
                name: u.name ? `${u.name}'s Team` : 'My Team',
                users: [{ role: 'SUPERADMIN' }],
              },
            ],
            200
          );
        }
      }
    } catch (e) {}
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/notifications/list') {
    return createJsonResponse({ notifications: [], lastReadNotifications: '' }, 200);
  }

  if (cleanUrl.includes('/notifications')) {
    return createJsonResponse({ total: 0, notifications: [] }, 200);
  }

  if (cleanUrl === '/announcements') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl.includes('/analytics')) {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/user/personal') {
    return createJsonResponse({ name: '', bio: '', picture: null }, 200);
  }

  if (cleanUrl === '/user/subscription') {
    return createJsonResponse({ subscription: null }, 200);
  }

  if (cleanUrl === '/user/subscription/tiers') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/billing/prorate') {
    return createJsonResponse({ price: 0 }, 200);
  }

  if (cleanUrl === '/billing/is-trial-finished') {
    return createJsonResponse({ finished: true }, 200);
  }

  if (cleanUrl === '/media' || cleanUrl.startsWith('/media')) {
    return createJsonResponse({ results: [], total: 0 }, 200);
  }

  if (cleanUrl === '/settings/team') {
    return createJsonResponse({ users: [] }, 200);
  }

  if (cleanUrl === '/settings/shortlink') {
    return createJsonResponse({ type: 'ask' }, 200);
  }

  if (cleanUrl === '/user/email-notifications') {
    return createJsonResponse({}, 200);
  }

  if (cleanUrl === '/signatures') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/webhooks') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/autopost') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/sets') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/user/approved-apps') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl === '/user/oauth-app') {
    return createJsonResponse({}, 200);
  }

  if (cleanUrl === '/posts/valid') {
    return createJsonResponse({ valid: true }, 200);
  }

  if (cleanUrl === '/posts/should-shortlink') {
    return createJsonResponse({ should: false }, 200);
  }

  if (cleanUrl === '/admin/errors/platforms') {
    return createJsonResponse([], 200);
  }

  if (cleanUrl.startsWith('/admin/errors')) {
    return createJsonResponse({ items: [], total: 0, page: 0, limit: 20, hasMore: false }, 200);
  }

  if (cleanUrl.startsWith('/admin/stats')) {
    return createJsonResponse({
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      errors: { total: 0, perSocial: [] },
      posts: { total: 0, perSocial: [] },
      connected: { total: 0, perSocial: [] },
      publishingAccounts: { total: 0, perSocial: [] },
      scheduledAccounts: { total: 0, perSocial: [] },
      publishingChannels: { total: 0, perSocial: [] },
      scheduledChannels: { total: 0, perSocial: [] },
      activeOrgsBySource: { total: 0, perSocial: [] },
    }, 200);
  }

  // No offline stand-in for this route: keep the backend's own error (its message) when it answered.
  return original || createJsonResponse({ error: 'Service temporarily unavailable', statusCode: 502 }, 502);
}

export const customFetch = (
  params: Params,
  auth?: string,
  showorg?: string,
  secured: boolean = true
) => {
  return async function newFetch(url: string, options: RequestInit = {}) {
    const loggedAuth =
      typeof window === 'undefined'
        ? undefined
        : new URL(window.location.href).searchParams.get('loggedAuth');
    const newRequestObject = await params?.beforeRequest?.(url, options);
    const authNonSecuredCookie =
      typeof document === 'undefined'
        ? null
        : document.cookie
            .split(';')
            .find((p) => p.includes('auth='))
            ?.split('=')[1];

    const authNonSecuredOrg =
      typeof document === 'undefined'
        ? null
        : document.cookie
            .split(';')
            .find((p) => p.includes('showorg='))
            ?.split('=')[1];

    const authNonSecuredImpersonate =
      typeof document === 'undefined'
        ? null
        : document.cookie
            .split(';')
            .find((p) => p.includes('impersonate='))
            ?.split('=')[1];

    let fetchRequest: Response;
    try {
      fetchRequest = await fetch(params.baseUrl + url, {
        ...(secured ? { credentials: 'include' } : {}),
        ...(newRequestObject || options),
        headers: {
          ...(showorg
            ? { showorg }
            : authNonSecuredOrg
            ? { showorg: authNonSecuredOrg }
            : {}),
          ...(options.body instanceof FormData
            ? {}
            : { 'Content-Type': 'application/json' }),
          Accept: 'application/json',
          ...(loggedAuth ? { auth: loggedAuth } : {}),
          ...options?.headers,
          ...(auth
            ? { auth }
            : authNonSecuredCookie
            ? { auth: authNonSecuredCookie }
            : {}),
          ...(authNonSecuredImpersonate
            ? { impersonate: authNonSecuredImpersonate }
            : {}),
        },
        // @ts-ignore
        ...(!options.next && options.cache !== 'force-cache'
          ? { cache: options.cache || 'no-store' }
          : {}),
      });

      if (fetchRequest.status === 502 || fetchRequest.status === 504) {
        fetchRequest = await handleFallback(url, options, fetchRequest);
      }
    } catch (err) {
      fetchRequest = await handleFallback(url, options);
    }

    if (
      !params?.afterRequest ||
      (await params?.afterRequest?.(url, options, fetchRequest))
    ) {
      return fetchRequest;
    }

    // @ts-ignore
    return new Promise((res) => {}) as Response;
  };
};

export const fetchBackend = customFetch({
  get baseUrl() {
    return process.env.BACKEND_URL!;
  },
});
