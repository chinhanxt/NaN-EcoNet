import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('auth')?.value || request.headers.get('auth');
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: { id: string } | null = null;
    try {
      payload = AuthService.verifyJWT(authCookie) as { id: string } | null;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!payload?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userOrg = await prisma.userOrganization.findFirst({
      where: { userId: payload.id },
      include: { organization: true },
    });

    if (!userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgId = userOrg.organizationId;
    const org = userOrg.organization;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      isSuperAdmin: !!user.isSuperAdmin,
      admin: !!user.isSuperAdmin,
      orgId: orgId,
      totalChannels: 10000,
      tier: 'ULTIMATE',
      role: 'SUPERADMIN',
      isLifetime: true,
      impersonate: false,
      isTrailing: false,
      allowTrial: false,
      streakSince: null,
      publicApi: org?.apiKey || '',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
