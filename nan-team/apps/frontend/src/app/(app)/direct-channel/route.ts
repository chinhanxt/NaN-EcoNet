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

export async function GET(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channels = await prisma.integration.findMany({
      where: {
        organizationId: userOrg.organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const integrations = channels.map((p) => {
      let parsedTimes = [{ time: 120 }, { time: 400 }, { time: 700 }];
      try {
        if (p.postingTimes) parsedTimes = JSON.parse(p.postingTimes);
      } catch (e) {}

      return {
        name: p.name,
        id: p.id,
        internalId: p.internalId,
        disabled: p.disabled,
        editor: undefined,
        stripLinks: false,
        picture: p.picture || `/icons/platforms/${p.providerIdentifier}.png`,
        identifier: p.providerIdentifier,
        inBetweenSteps: p.inBetweenSteps,
        refreshNeeded: p.refreshNeeded,
        isCustomFields: false,
        display: p.profile,
        type: p.type,
        time: parsedTimes,
        changeProfilePicture: true,
        changeNickName: true,
        customer: null,
        additionalSettings: p.additionalSettings || '[]',
      };
    });

    return NextResponse.json({ success: true, integrations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, provider, username, picture, token: customToken, internalId: customInternalId } = body;

    if (!name || !provider) {
      return NextResponse.json({ error: 'Channel name and provider are required' }, { status: 400 });
    }

    const cleanProvider = String(provider).toLowerCase().trim();
    const cleanName = String(name).trim();
    const cleanUsername = username
      ? (String(username).startsWith('@') ? String(username).trim() : `@${String(username).trim()}`)
      : `@${cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    const internalId = customInternalId
      ? String(customInternalId).trim()
      : `manual_${cleanProvider}_${Date.now()}`;
    const avatar = picture || `/icons/platforms/${cleanProvider}.png`;
    const token = customToken
      ? String(customToken).trim()
      : `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const existing = await prisma.integration.findFirst({
      where: {
        organizationId: userOrg.organizationId,
        internalId,
      },
    });

    let integration;
    if (existing) {
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          profile: cleanUsername,
          picture: avatar,
          token,
          deletedAt: null,
          disabled: false,
          refreshNeeded: false,
          updatedAt: new Date(),
        },
      });
    } else {
      integration = await prisma.integration.create({
        data: {
          name: cleanName,
          providerIdentifier: cleanProvider,
          profile: cleanUsername,
          picture: avatar,
          type: 'social',
          token,
          organizationId: userOrg.organizationId,
          internalId,
          rootInternalId: internalId,
          disabled: false,
          refreshNeeded: false,
          postingTimes: JSON.stringify([{ time: 120 }, { time: 400 }, { time: 700 }]),
          additionalSettings: '[]',
        },
      });
    }

    return NextResponse.json({ success: true, integration });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    await prisma.integration.updateMany({
      where: { id, organizationId: userOrg.organizationId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userOrg = await getAuthOrg(request);
    if (!userOrg) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, disabled, name, times } = body;

    const updateData: any = {};
    if (typeof disabled === 'boolean') updateData.disabled = disabled;
    if (name) updateData.name = name;
    if (times) updateData.postingTimes = JSON.stringify(times);

    await prisma.integration.updateMany({
      where: { id, organizationId: userOrg.organizationId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
