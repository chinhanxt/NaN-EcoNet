const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Launch Chrome for Facebook / Meta Business Suite Login
 */
async function launchFacebookLogin() {
  const userDataDir = '/home/chinhan/.config/postiz-fb-profile';
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const display = process.env.DISPLAY || ':1';
  console.log(`[Facebook-Login] Khởi động Chrome với thư mục profile: ${userDataDir}`);
  console.log(`[Facebook-Login] DISPLAY: ${display}`);

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: '/opt/google/chrome/chrome',
      headless: false,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
      env: {
        ...process.env,
        DISPLAY: display,
      },
      viewport: null,
    });
  } catch (err) {
    console.error('[Facebook-Login] Không thể khởi động Chrome:', err.message);
    throw err;
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  console.log('[Facebook-Login] Đang mở https://www.facebook.com...');
  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('[Facebook-Login] Đang chờ đăng nhập... Hãy đăng nhập tài khoản Facebook trên cửa sổ vừa mở.');

  // Polling for login cookie (c_user) or authenticated session
  const startTime = Date.now();
  const maxWaitMs = 15 * 60 * 1000; // 15 phút cho người dùng đăng nhập

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const cookies = await context.cookies();
      const fbCookies = cookies.filter((c) => c.domain.includes('facebook.com'));
      const cUser = fbCookies.find((c) => c.name === 'c_user');
      const xs = fbCookies.find((c) => c.name === 'xs');

      if (cUser && xs) {
        console.log(`[Facebook-Login] Phát hiện đã đăng nhập thành công! User ID (c_user): ${cUser.value}`);

        // Build cookie string
        const cookieString = fbCookies
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');

        // Try getting page info from Postiz DB or Facebook
        const existingFb = await prisma.integration.findFirst({
          where: { providerIdentifier: 'facebook', deletedAt: null },
        });

        let pageName = existingFb?.name || 'Hot nhất hôm nay';
        let pageId = existingFb?.internalId || '1362072293650275';

        // Update database with active cookies / profile
        try {
          await prisma.integration.updateMany({
            where: { providerIdentifier: 'facebook', deletedAt: null },
            data: {
              token: cookieString,
              disabled: false,
              refreshNeeded: false,
              updatedAt: new Date(),
            },
          });
          console.log('[Facebook-Login] Đã lưu Facebook Session Cookies vào Postiz database!');
        } catch (dbErr) {
          console.error('[Facebook-Login] Lỗi cập nhật DB:', dbErr.message);
        }

        const result = {
          success: true,
          userId: cUser.value,
          pageId,
          pageName,
          profileDir: userDataDir,
          cookieCount: fbCookies.length,
        };

        console.log('__RESULT__' + JSON.stringify(result));

        // Keep open briefly then close
        await new Promise((r) => setTimeout(r, 3000));
        try {
          await context.close();
        } catch (e) {}

        return result;
      }
    } catch (e) {
      // page might be navigating
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  try {
    await context.close();
  } catch (e) {}

  throw new Error('Hết thời gian chờ đăng nhập Facebook (15 phút).');
}

if (require.main === module) {
  launchFacebookLogin()
    .then((res) => {
      console.log('HOÀN TẤT:', JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('LỖI:', err.message);
      process.exit(1);
    });
}

module.exports = { launchFacebookLogin };
