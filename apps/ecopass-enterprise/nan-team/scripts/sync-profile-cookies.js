const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function cleanLock(userDataDir) {
  for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    const p = path.join(userDataDir, f);
    try {
      if (fs.existsSync(p) || fs.lstatSync(p, { throwIfNoEntry: false })) {
        fs.unlinkSync(p);
      }
    } catch (e) {}
  }
}

async function extractCookies(userDataDir) {
  if (!fs.existsSync(userDataDir)) return null;
  cleanLock(userDataDir);

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: '/opt/google/chrome/chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const cookies = await context.cookies();
    await context.close();

    if (!cookies || cookies.length === 0) return null;
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch (err) {
    if (context) await context.close().catch(() => {});
    return null;
  }
}

async function syncAll() {
  console.log('--- Đồng bộ Cookies từ hồ sơ trình duyệt vào Database Postiz ---');

  const configs = [
    { provider: 'facebook', dir: '/home/chinhan/.config/postiz-fb-profile' },
    { provider: 'youtube', dir: '/home/chinhan/.config/postiz-youtube-profile' },
    { provider: 'tiktok', dir: '/home/chinhan/.config/postiz-tiktok-profile' },
  ];

  for (const item of configs) {
    const cookieStr = await extractCookies(item.dir);
    if (cookieStr) {
      const integration = await prisma.integration.findFirst({
        where: { providerIdentifier: item.provider, deletedAt: null },
      });

      if (integration) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: { token: cookieStr },
        });
        console.log(`[✔] Đã cập nhật Cookie cho kênh ${item.provider.toUpperCase()} (${integration.name})`);
      } else {
        console.log(`[-] Không tìm thấy kênh tích hợp ${item.provider} trong database`);
      }
    } else {
      console.log(`[!] Không lấy được Cookie từ hồ sơ ${item.dir}`);
    }
  }

  await prisma.$disconnect();
  console.log('Hoàn tất đồng bộ!');
}

syncAll().catch((e) => {
  console.error('Lỗi sync:', e);
  process.exit(1);
});
