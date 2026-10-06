// Idempotent seed for the shared demo account (username login, LOCAL provider).
// The account lives in its own sandbox organization with one fake channel, so
// it never sees real data or real channel tokens.
// Usage: pnpm run seed:admin   (or: make seed-admin)
// Env overrides: SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, SEED_ADMIN_ORG,
//                SEED_ADMIN_FEATURES_FROM (org whose feature flags are copied)
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { hashSync, compareSync } = require('bcrypt');
const EVP_BytesToKey = require('evp_bytestokey');

const USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || '123456';
const ORG_NAME = process.env.SEED_ADMIN_ORG || 'NaN Demo';
const FEATURES_FROM = process.env.SEED_ADMIN_FEATURES_FROM || 'MMO Team';

// Must equal DEMO_INTEGRATION_TOKEN in
// libraries/nestjs-libraries/src/integrations/demo.integration.ts: a channel
// with this token is never sent to the provider API.
const DEMO_TOKEN = 'demo-not-a-real-token';
const DEMO_CHANNEL = {
  internalId: 'nan-demo-fanpage',
  name: 'Fanpage Demo NaN (thử nghiệm)',
  providerIdentifier: 'facebook',
  type: 'social',
  picture: '/logo.png',
};

// Same as AuthService.fixedEncryption (aes-256-cbc, EVP key from JWT_SECRET)
function fixedEncryption(value) {
  const algorithm = 'aes-256-cbc';
  const { keyLength, ivLength } = crypto.getCipherInfo(algorithm);
  const { key, iv } = EVP_BytesToKey(
    Buffer.from(process.env.JWT_SECRET || '', 'utf8'),
    null,
    keyLength * 8,
    ivLength,
    'md5'
  );
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  return Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString(
    'hex'
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // Feature-gating fields only (no data) from the reference org
    const source = await prisma.organization.findFirst({
      where: { name: FEATURES_FROM, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { subscription: true },
    });
    const features = {
      allowTrial: source ? source.allowTrial : true,
      isTrailing: source ? source.isTrailing : true,
      shortlink: source ? source.shortlink : 'ASK',
    };

    let org = await prisma.organization.findFirst({
      where: { name: ORG_NAME, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    org = org
      ? await prisma.organization.update({
          where: { id: org.id },
          data: features,
        })
      : await prisma.organization.create({
          data: {
            name: ORG_NAME,
            apiKey: fixedEncryption(crypto.randomBytes(15).toString('hex')),
            ...features,
          },
        });

    const sub = source && source.subscription;
    if (sub && !sub.deletedAt) {
      const subData = {
        subscriptionTier: sub.subscriptionTier,
        period: sub.period,
        totalChannels: sub.totalChannels,
        isLifetime: sub.isLifetime,
        provider: sub.provider,
        cancelAt: sub.cancelAt,
        deletedAt: null,
      };
      await prisma.subscription.upsert({
        where: { organizationId: org.id },
        update: subData,
        create: { organizationId: org.id, ...subData },
      });
    }

    // Same hashing as AuthService.hashPassword (bcrypt, 10 rounds)
    const password = hashSync(PASSWORD, 10);

    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: USERNAME, mode: 'insensitive' },
        providerName: 'LOCAL',
        deletedAt: null,
      },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { password, activated: true },
        })
      : await prisma.user.create({
          data: {
            email: USERNAME,
            password,
            providerName: 'LOCAL',
            providerId: '',
            name: USERNAME,
            timezone: 0,
            activated: true,
          },
        });

    // Org creator role, as in OrganizationRepository.createOrgAndUser
    const membership = await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId: org.id },
      },
      update: { role: 'SUPERADMIN', disabled: false },
      create: { userId: user.id, organizationId: org.id, role: 'SUPERADMIN' },
    });

    // The demo account must not reach any other organization
    const removed = await prisma.userOrganization.deleteMany({
      where: { userId: user.id, organizationId: { not: org.id } },
    });

    const farFuture = new Date('2099-12-31T00:00:00.000Z');
    const channelData = {
      name: DEMO_CHANNEL.name,
      picture: DEMO_CHANNEL.picture,
      providerIdentifier: DEMO_CHANNEL.providerIdentifier,
      type: DEMO_CHANNEL.type,
      token: DEMO_TOKEN,
      refreshToken: DEMO_TOKEN,
      tokenExpiration: farFuture,
      profile: DEMO_CHANNEL.internalId,
      rootInternalId: DEMO_CHANNEL.internalId,
      disabled: false,
      refreshNeeded: false,
      inBetweenSteps: false,
      deletedAt: null,
    };
    const channel = await prisma.integration.upsert({
      where: {
        organizationId_internalId: {
          organizationId: org.id,
          internalId: DEMO_CHANNEL.internalId,
        },
      },
      update: channelData,
      create: {
        organizationId: org.id,
        internalId: DEMO_CHANNEL.internalId,
        ...channelData,
      },
    });

    const check = await prisma.user.findUnique({ where: { id: user.id } });
    console.log(
      JSON.stringify(
        {
          action: existing ? 'updated' : 'created',
          userId: user.id,
          login: USERNAME,
          organization: { id: org.id, name: org.name, ...features },
          role: membership.role,
          removedOtherMemberships: removed.count,
          channel: {
            id: channel.id,
            name: channel.name,
            provider: channel.providerIdentifier,
          },
          activated: check.activated,
          passwordMatches: compareSync(PASSWORD, check.password),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
