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

function runFacebookLoginScript(): Promise<{ pageId: string; pageName: string; profileDir: string; userId?: string }> {
  return new Promise((resolve, reject) => {
    const candidates = [
      path.resolve(process.cwd(), 'scripts', 'login-facebook.js'),
      path.resolve(process.cwd(), '..', '..', 'scripts', 'login-facebook.js'),
      '/home/chinhan/MMO/postiz/scripts/login-facebook.js',
    ];

    const scriptPath = candidates.find((p) => fs.existsSync(p));
    if (!scriptPath) {
      return reject(new Error('File scripts/login-facebook.js not found'));
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
          console.error('[Facebook-Login Error]', error);
          return reject(new Error(error.message || 'Error opening Facebook login browser'));
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
          pageId: '1362072293650275',
          pageName: 'Hot nhất hôm nay',
          profileDir: '/home/chinhan/.config/postiz-fb-profile',
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
        ...(id ? { id } : { providerIdentifier: 'facebook' }),
        organizationId: userOrg.organizationId,
        deletedAt: null,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Facebook channel not found' }, { status: 404 });
    }

    // Launch Chrome for user to login
    const result = await runFacebookLoginScript();

    const updated = await prisma.integration.findUnique({
      where: { id: integration.id },
    });

    return NextResponse.json({
      success: true,
      integration: {
        id: updated?.id || integration.id,
        name: updated?.name || result.pageName,
        profile: updated?.profile,
        internalId: updated?.internalId || result.pageId,
        token: updated?.token,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
