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

function runAutoTokenScript(pageName: string, pageId: string, integrationId: string): Promise<{ token: string; pageName: string; pageId: string }> {
  return new Promise((resolve, reject) => {
    const candidates = [
      path.resolve(process.cwd(), 'scripts', 'auto-facebook-token.js'),
      path.resolve(process.cwd(), '..', '..', 'scripts', 'auto-facebook-token.js'),
      '/home/chinhan/MMO/postiz/scripts/auto-facebook-token.js',
    ];

    const scriptPath = candidates.find((p) => fs.existsSync(p));
    if (!scriptPath) {
      return reject(new Error('File scripts/auto-facebook-token.js not found'));
    }

    const workingDir = path.dirname(path.dirname(scriptPath));

    execFile(
      'node',
      [scriptPath, pageName, pageId, integrationId],
      {
        cwd: workingDir,
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':1',
        },
        timeout: 180000, // Tối đa 3 phút
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[Auto-Token Child Process Error]', error);
          console.error('[Auto-Token Child Process Stderr]', stderr);
          return reject(new Error(error.message || 'Error executing token fetch process'));
        }

        const match = stdout.match(/__RESULT__(.*)/);
        if (match && match[1]) {
          try {
            const data = JSON.parse(match[1]);
            return resolve(data);
          } catch (e) {
            return reject(new Error('Unable to parse script output'));
          }
        }

        return reject(new Error('Token not found after execution'));
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

    // Chạy tiến trình Playwright qua Node riêng biệt để không xung đột với bundler của Next.js
    const result = await runAutoTokenScript(
      integration.name,
      integration.internalId,
      integration.id
    );

    if (!result?.token) {
      return NextResponse.json({ error: 'Unable to extract token' }, { status: 400 });
    }

    // Cập nhật lại vào DB để đảm bảo trạng thái mới nhất
    const updated = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        token: result.token.trim(),
        internalId: result.pageId || integration.internalId,
        rootInternalId: result.pageId || integration.internalId,
        name: result.pageName || integration.name,
        disabled: false,
        refreshNeeded: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      token: result.token,
      pageName: result.pageName,
      pageId: result.pageId,
      integration: {
        id: updated.id,
        name: updated.name,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error auto-fetching token' }, { status: 500 });
  }
}
