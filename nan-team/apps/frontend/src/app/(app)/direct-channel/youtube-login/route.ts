import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

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

function runYouTubeLoginScript(): Promise<{ channelId: string; channelName: string; profileDir: string }> {
  return new Promise((resolve, reject) => {
    const candidates = [
      path.resolve(process.cwd(), 'scripts', 'login-youtube.js'),
      path.resolve(process.cwd(), '..', '..', 'scripts', 'login-youtube.js'),
      '/home/chinhan/MMO/postiz/scripts/login-youtube.js',
    ];

    const scriptPath = candidates.find((p) => fs.existsSync(p));
    if (!scriptPath) {
      return reject(new Error('File scripts/login-youtube.js not found'));
    }

    const workingDir = path.dirname(path.dirname(scriptPath));

    execFile(
      'node',
      [scriptPath],
      {
        cwd: workingDir,
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':1',
        },
        timeout: 900000, // 15 phút cho người dùng đăng nhập
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[YouTube-Login Error]', error);
          return reject(new Error(error.message || 'Error opening YouTube login browser'));
        }

        const match = stdout.match(/__RESULT__(.*)/);
        if (match && match[1]) {
          try {
            const data = JSON.parse(match[1]);
            return resolve(data);
          } catch (e) {
            return reject(new Error('Unable to parse result'));
          }
        }

        return resolve({
          channelId: 'youtube_channel',
          channelName: 'YouTube Studio Channel',
          profileDir: '/home/chinhan/.config/postiz-youtube-profile',
        });
      }
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id } = body;

    const integration = await prisma.integration.findFirst({
      where: {
        ...(id ? { id } : { providerIdentifier: 'youtube' }),
        organizationId: userOrg.organizationId,
        deletedAt: null,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'YouTube channel not found' }, { status: 404 });
    }

    // Launch Chrome for user to login
    const result = await runYouTubeLoginScript();

    // Update integration in DB
    const updated = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        ...(result.channelName ? { name: result.channelName, profile: `@${result.channelName.toLowerCase().replace(/\s+/g, '_')}` } : {}),
        ...(result.channelId ? { internalId: result.channelId, rootInternalId: result.channelId } : {}),
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
        profile: updated.profile,
        internalId: updated.internalId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
