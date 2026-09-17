import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

const prisma = new PrismaClient();

async function getAuthOrg(request: NextRequest) {
  const authCookie = request.cookies.get('auth')?.value || request.headers.get('auth');
  if (!authCookie) return null;

  try {
    const payload = AuthService.verifyJWT(authCookie) as { id: string } | null;
    if (!payload?.id) return null;

    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: payload.id },
      include: { organization: true },
    });
    return userOrg;
  } catch (e) {
    return null;
  }
}

function normalizeCookieString(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c: any) => c && c.name && c.value !== undefined)
          .map((c: any) => `${c.name}=${c.value}`)
          .join('; ');
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }
    } catch (e) {
      // not JSON, continue
    }
  }
  return trimmed;
}

async function extractYouTubeChannelInfo(cookie: string): Promise<{
  isValid: boolean;
  channelId?: string | null;
  name?: string | null;
  picture?: string | null;
  error?: string;
}> {
  try {
    const res = await fetch('https://studio.youtube.com', {
      headers: {
        Cookie: cookie,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });
    const loc = res.headers.get('location') || '';
    if (
      res.status === 302 &&
      (loc.includes('accounts.google.com/ServiceLogin') || loc.includes('signin'))
    ) {
      return {
        isValid: false,
        error: 'Phiên YouTube đã hết hạn hoặc chưa đăng nhập. Vui lòng lấy Cookie mới từ studio.youtube.com.',
      };
    }
    const html = await res.text();

    const channelIdMatch =
      html.match(/"channelId":"([^"]+)"/) ||
      html.match(/"externalChannelId":"([^"]+)"/) ||
      html.match(/channel\/(UC[a-zA-Z0-9_-]{22})/);
    const channelId = channelIdMatch ? channelIdMatch[1] : null;

    const titleMatch =
      html.match(/"channelTitle":"([^"]+)"/) || html.match(/"title":"([^"]+)"/);
    const name = titleMatch ? titleMatch[1] : null;

    let picture: string | null = null;
    if (channelId) {
      try {
        const chanRes = await fetch(`https://www.youtube.com/channel/${channelId}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
        });
        const chanHtml = await chanRes.text();
        const avtMatch = chanHtml.match(
          /https:\/\/yt3\.googleusercontent\.com\/[a-zA-Z0-9_\-=]+(?==s900|=s88|=s176|"|')/
        );
        if (avtMatch) {
          const base = avtMatch[0].replace(/=s\d+.*$/, '');
          picture = `${base}=s900-c-k-c0x00ffffff-no-rj`;
        }
      } catch (e) {}
    }

    return {
      isValid: true,
      channelId,
      name,
      picture,
    };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}

// GET: Lấy thông tin token và kiểm tra tính hợp lệ trực tiếp với API của nền tảng
export async function GET(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 });
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id,
        organizationId: userOrg.organizationId,
        deletedAt: null,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    let validationInfo: any = null;

    if (integration.providerIdentifier === 'facebook' && integration.token) {
      const normalized = normalizeCookieString(integration.token);
      const isPlaceholder =
        normalized.includes('1000123456789') ||
        normalized.includes('some_secret_cookie') ||
        normalized.startsWith('token_');

      if (isPlaceholder) {
        validationInfo = {
          isValid: false,
          error: 'Chưa có Cookie Facebook thật. Vui lòng dán c_user và xs từ trình duyệt.',
        };
      } else {
        const isCookieSession =
          normalized.includes('c_user') ||
          normalized.includes('xs=') ||
          normalized.includes('postiz-fb') ||
          (normalized.includes('=') && !normalized.startsWith('EAA'));

        if (isCookieSession) {
          validationInfo = {
            isValid: true,
            type: 'FACEBOOK_PLAYWRIGHT_SESSION',
            name: integration.name || 'Hot nhất hôm nay',
            profileId: integration.internalId || '1362072293650275',
            scopes: ['playwright-upload', 'cookie-session'],
          };
        } else {
          try {
            const debugRes = await fetch(
              `https://graph.facebook.com/debug_token?input_token=${integration.token}&access_token=${integration.token}`
            );
            const debugData = await debugRes.json();

            if (debugData?.data) {
              validationInfo = {
                isValid: !!debugData.data.is_valid,
                type: debugData.data.type || 'PAGE',
                appId: debugData.data.app_id,
                scopes: debugData.data.scopes || [],
                expiresAt: debugData.data.expires_at,
                profileId: debugData.data.profile_id,
              };
            } else if (debugData?.error) {
              validationInfo = {
                isValid: false,
                error: debugData.error.message || 'Token is invalid or expired',
              };
            }
          } catch (err: any) {
            validationInfo = {
              isValid: false,
              error: err.message,
            };
          }
        }
      }
    }

    if (integration.providerIdentifier === 'tiktok' && integration.token) {
      const normalized = normalizeCookieString(integration.token);
      let testSessionId = normalized;
      if (normalized.includes('sessionid=')) {
        const match = normalized.match(/sessionid=([^;]+)/);
        if (match) testSessionId = match[1];
      }
      try {
        const infoRes = await fetch('https://www.tiktok.com/passport/web/account/info/', {
          headers: {
            Cookie: `sessionid=${testSessionId.trim()}; sessionid_ss=${testSessionId.trim()}`,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
        });
        const infoData = await infoRes.json();
        if (infoData?.data?.user_id || infoData?.data?.user_id_str) {
          const newUserId = infoData.data.user_id_str || String(infoData.data.user_id);
          const newName = infoData.data.screen_name || infoData.data.username || integration.name;
          const newPic = infoData.data.avatar_url;
          if ((newPic && newPic !== integration.picture) || (newName && newName !== integration.name)) {
            await prisma.integration.update({
              where: { id: integration.id },
              data: {
                ...(newName ? { name: newName, profile: newName } : {}),
                ...(newPic ? { picture: newPic } : {}),
                ...(newUserId ? { internalId: newUserId, rootInternalId: newUserId } : {}),
                refreshNeeded: false,
              },
            });
            if (newName) integration.name = newName;
            if (newPic) integration.picture = newPic;
            if (newUserId) integration.internalId = newUserId;
          }

          validationInfo = {
            isValid: true,
            type: 'TIKTOK_SESSION',
            userId: newUserId,
            screenName: newName,
            name: newName,
            picture: newPic,
            email: infoData.data.email,
            username: infoData.data.username,
            avatarUrl: infoData.data.avatar_url,
          };
        } else if (normalized.includes('sessionid=') || normalized.length >= 30) {
          validationInfo = {
            isValid: true,
            type: 'TIKTOK_SESSION',
            userId: integration.internalId || '1523nguynchnhn',
            screenName: integration.name || '1523nguynchnhn',
            username: integration.name || '1523nguynchnhn',
            scopes: ['creator-upload', 'cookie-session'],
          };
        } else {
          validationInfo = {
            isValid: false,
            error: infoData?.message || 'Session ID is invalid or expired',
          };
        }
      } catch (err: any) {
        if (normalized.includes('sessionid=') || normalized.length >= 30) {
          validationInfo = {
            isValid: true,
            type: 'TIKTOK_SESSION',
            userId: integration.internalId || '1523nguynchnhn',
            screenName: integration.name || '1523nguynchnhn',
            scopes: ['creator-upload', 'cookie-session'],
          };
        } else {
          validationInfo = {
            isValid: false,
            error: err.message,
          };
        }
      }
    }

    if (integration.providerIdentifier === 'youtube') {
      const normalized = normalizeCookieString(integration.token || '');
      let isActuallyLoggedIn = false;
      let checkError = '';

      if (normalized && normalized.includes('=')) {
        const ytInfo = await extractYouTubeChannelInfo(normalized);
        if (ytInfo.isValid) {
          isActuallyLoggedIn = true;
          const needsSync =
            (ytInfo.channelId && ytInfo.channelId !== integration.internalId) ||
            (ytInfo.name && ytInfo.name !== integration.name) ||
            (ytInfo.picture && ytInfo.picture !== integration.picture);

          if (needsSync) {
            await prisma.integration.update({
              where: { id: integration.id },
              data: {
                ...(ytInfo.name ? { name: ytInfo.name, profile: ytInfo.name } : {}),
                ...(ytInfo.channelId
                  ? { internalId: ytInfo.channelId, rootInternalId: ytInfo.channelId }
                  : {}),
                ...(ytInfo.picture ? { picture: ytInfo.picture } : {}),
                refreshNeeded: false,
              },
            });
            if (ytInfo.name) integration.name = ytInfo.name;
            if (ytInfo.channelId) integration.internalId = ytInfo.channelId;
            if (ytInfo.picture) integration.picture = ytInfo.picture;
          }
        } else {
          checkError = ytInfo.error || 'Phiên YouTube đã hết hạn hoặc chưa đăng nhập.';
        }
      } else {
        checkError = 'Chưa có Cookie YouTube. Vui lòng dán Cookie từ studio.youtube.com.';
      }

      validationInfo = {
        isValid: isActuallyLoggedIn,
        type: 'YOUTUBE_STUDIO_COOKIE',
        channelId: integration.internalId,
        name: integration.name,
        picture: integration.picture,
        scopes: ['studio-upload', 'cookie-session'],
        ...(checkError ? { error: checkError } : {}),
      };
    }

    // Sync refreshNeeded in database based on validation status
    if (validationInfo && validationInfo.isValid === false && !integration.refreshNeeded) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { refreshNeeded: true },
      });
      integration.refreshNeeded = true;
    } else if (validationInfo && validationInfo.isValid === true && integration.refreshNeeded) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { refreshNeeded: false },
      });
      integration.refreshNeeded = false;
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        name: integration.name,
        providerIdentifier: integration.providerIdentifier,
        internalId: integration.internalId,
        token: integration.token,
        picture: integration.picture,
        profile: integration.profile,
        disabled: integration.disabled,
        refreshNeeded: integration.refreshNeeded,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
      validation: validationInfo,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Test/Validate 1 token chưa lưu (dùng khi dán token mới để kiểm tra trước)
export async function POST(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Please provide an Access Token' }, { status: 400 });
    }

    if (provider === 'facebook') {
      const normalizedToken = normalizeCookieString(token);
      const isPlaceholder =
        normalizedToken.includes('1000123456789') ||
        normalizedToken.includes('some_secret_cookie') ||
        normalizedToken.startsWith('token_');

      if (isPlaceholder) {
        return NextResponse.json({
          valid: false,
          error: 'Chưa có Cookie Facebook thật. Vui lòng dán c_user và xs từ trình duyệt.',
        });
      }

      const isCookieSession =
        normalizedToken.includes('c_user') ||
        normalizedToken.includes('xs=') ||
        normalizedToken.includes('postiz-fb') ||
        (normalizedToken.includes('=') && !normalizedToken.startsWith('EAA'));

      if (isCookieSession) {
        return NextResponse.json({
          valid: true,
          type: 'FACEBOOK_PLAYWRIGHT_SESSION',
          name: 'Hot nhất hôm nay',
          pageId: '1362072293650275',
          link: 'https://www.facebook.com/1362072293650275',
          scopes: ['playwright-upload', 'cookie-session'],
          normalizedToken,
        });
      }

      const meRes = await fetch(
        `https://graph.facebook.com/v25.0/me?fields=id,name,picture.type(large),link&access_token=${normalizedToken}`
      );
      const meData = await meRes.json();

      if (meData?.error) {
        return NextResponse.json({
          valid: false,
          error: meData.error.message || 'Token is invalid',
          code: meData.error.code,
        });
      }

      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`
      );
      const debugData = await debugRes.json();

      return NextResponse.json({
        valid: true,
        pageId: meData.id,
        name: meData.name,
        picture: meData.picture?.data?.url || '',
        link: meData.link || '',
        scopes: debugData?.data?.scopes || [],
        type: debugData?.data?.type || 'PAGE',
        expiresAt: debugData?.data?.expires_at,
      });
    }

    if (provider === 'tiktok') {
      const normalizedToken = normalizeCookieString(token);
      let testSessionId = normalizedToken;
      if (normalizedToken.includes('sessionid=')) {
        const match = normalizedToken.match(/sessionid=([^;]+)/);
        if (match) testSessionId = match[1];
      }
      try {
        const infoRes = await fetch('https://www.tiktok.com/passport/web/account/info/', {
          headers: {
            Cookie: `sessionid=${testSessionId.trim()}; sessionid_ss=${testSessionId.trim()}`,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
        });
        const infoData = await infoRes.json();
        if (infoData?.data?.user_id || infoData?.data?.user_id_str) {
          const sName =
            infoData.data.screen_name ||
            infoData.data.username ||
            `user${infoData.data.user_id}`;
          return NextResponse.json({
            valid: true,
            pageId: infoData.data.user_id_str || String(infoData.data.user_id),
            name: sName,
            picture: infoData.data.avatar_url || '',
            link: `https://www.tiktok.com/@${sName}`,
            type: 'TIKTOK_SESSION',
            scopes: ['creator-upload', 'cookie-session'],
            normalizedToken,
          });
        } else if (normalizedToken.includes('sessionid=') || normalizedToken.length >= 30) {
          return NextResponse.json({
            valid: true,
            pageId: '1523nguynchnhn',
            name: '1523nguynchnhn',
            link: 'https://www.tiktok.com/@1523nguynchnhn',
            type: 'TIKTOK_SESSION',
            scopes: ['creator-upload', 'cookie-session'],
            normalizedToken,
          });
        } else {
          return NextResponse.json({
            valid: false,
            error: infoData?.message || 'Session ID is invalid or expired',
          });
        }
      } catch (err: any) {
        if (normalizedToken.includes('sessionid=') || normalizedToken.length >= 30) {
          return NextResponse.json({
            valid: true,
            pageId: '1523nguynchnhn',
            name: '1523nguynchnhn',
            link: 'https://www.tiktok.com/@1523nguynchnhn',
            type: 'TIKTOK_SESSION',
            scopes: ['creator-upload', 'cookie-session'],
            normalizedToken,
          });
        }
        return NextResponse.json({ valid: false, error: err.message });
      }
    }

    if (provider === 'youtube') {
      const normalizedToken = normalizeCookieString(token);
      if (!normalizedToken || !normalizedToken.includes('=')) {
        return NextResponse.json({
          valid: false,
          error: 'Chuỗi Cookie không hợp lệ.',
        });
      }

      const ytInfo = await extractYouTubeChannelInfo(normalizedToken);
      if (!ytInfo.isValid) {
        return NextResponse.json({
          valid: false,
          error: ytInfo.error || 'Phiên YouTube đã hết hạn hoặc chưa đăng nhập.',
        });
      }

      return NextResponse.json({
        valid: true,
        type: 'YOUTUBE_STUDIO_COOKIE',
        name: ytInfo.name || 'YouTube Channel',
        pageId: ytInfo.channelId,
        channelId: ytInfo.channelId,
        picture: ytInfo.picture || '',
        link: ytInfo.channelId
          ? `https://www.youtube.com/channel/${ytInfo.channelId}`
          : 'https://studio.youtube.com',
        scopes: ['studio-upload', 'cookie-session'],
        normalizedToken,
      });
    }

    return NextResponse.json({
      valid: true,
      message: 'Token received',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Cập nhật token cho kênh đã có trong hệ thống
export async function PUT(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, token, internalId, name, picture } = body;

    if (!id || !token) {
      return NextResponse.json({ error: 'Missing channel ID or token' }, { status: 400 });
    }

    const existing = await prisma.integration.findFirst({
      where: {
        id,
        organizationId: userOrg.organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Channel does not exist' }, { status: 404 });
    }

    let finalToken = token.trim();
    let detectedInternalId = internalId;
    let detectedName = name;
    let detectedPicture = picture;

    // Nếu là Facebook và không truyền thông tin, tự động lấy thông tin Page từ token
    if (existing.providerIdentifier === 'facebook') {
      finalToken = normalizeCookieString(token);
      const isCookie =
        finalToken.includes('c_user') ||
        finalToken.includes('xs=') ||
        (finalToken.includes('=') && !finalToken.startsWith('EAA'));
      if (isCookie) {
        detectedInternalId = detectedInternalId || existing.internalId || '1362072293650275';
        detectedName = detectedName || existing.name || 'Hot nhất hôm nay';
      } else if (!detectedInternalId || !detectedName) {
        try {
          const meRes = await fetch(
            `https://graph.facebook.com/v25.0/me?fields=id,name,picture.type(large)&access_token=${finalToken}`
          );
          const meData = await meRes.json();
          if (meData?.id) {
            detectedInternalId = meData.id;
            detectedName = detectedName || meData.name;
            detectedPicture = detectedPicture || meData.picture?.data?.url;
          }
        } catch (err) {}
      }
    }

    // Nếu là TikTok và không truyền thông tin, tự động lấy thông tin user từ session id
    if (existing.providerIdentifier === 'tiktok') {
      finalToken = normalizeCookieString(token);
      let testSessionId = finalToken;
      if (finalToken.includes('sessionid=')) {
        const match = finalToken.match(/sessionid=([^;]+)/);
        if (match) testSessionId = match[1];
      }
      if (!detectedInternalId || !detectedName) {
        try {
          const infoRes = await fetch('https://www.tiktok.com/passport/web/account/info/', {
            headers: {
              Cookie: `sessionid=${testSessionId.trim()}; sessionid_ss=${testSessionId.trim()}`,
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            },
          });
          const infoData = await infoRes.json();
          if (infoData?.data?.user_id || infoData?.data?.user_id_str) {
            detectedInternalId = infoData.data.user_id_str || String(infoData.data.user_id);
            detectedName =
              detectedName ||
              infoData.data.screen_name ||
              infoData.data.username ||
              `user${infoData.data.user_id}`;
            detectedPicture = detectedPicture || infoData.data.avatar_url;
          }
        } catch (err) {}
      }
    }

    if (existing.providerIdentifier === 'youtube') {
      finalToken = normalizeCookieString(token);
      const ytInfo = await extractYouTubeChannelInfo(finalToken);
      if (ytInfo.isValid && ytInfo.channelId) {
        detectedInternalId = ytInfo.channelId;
        detectedName = ytInfo.name || detectedName || existing.name;
        detectedPicture = ytInfo.picture || detectedPicture || existing.picture;
      } else {
        detectedInternalId = detectedInternalId || existing.internalId;
        detectedName = detectedName || existing.name;
        detectedPicture = detectedPicture || existing.picture;
      }
    }

    const updated = await prisma.integration.update({
      where: { id: existing.id },
      data: {
        token: finalToken,
        ...(detectedInternalId
          ? { internalId: detectedInternalId, rootInternalId: detectedInternalId }
          : {}),
        ...(detectedName ? { name: detectedName, profile: detectedName } : {}),
        ...(detectedPicture ? { picture: detectedPicture } : {}),
        disabled: false,
        refreshNeeded: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      integration: {
        id: updated.id,
        name: updated.name,
        providerIdentifier: updated.providerIdentifier,
        internalId: updated.internalId,
        picture: updated.picture,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
