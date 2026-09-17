const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Launch Chrome for YouTube Studio Login
 */
async function launchYouTubeLogin() {
  const userDataDir = '/home/chinhan/.config/postiz-youtube-profile';
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const display = process.env.DISPLAY || ':1';
  console.log(`[YouTube-Login] Khởi động Chrome với thư mục profile: ${userDataDir}`);
  console.log(`[YouTube-Login] DISPLAY: ${display}`);

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
    console.error('[YouTube-Login] Không thể khởi động Chrome:', err.message);
    throw err;
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  console.log('[YouTube-Login] Đang mở https://studio.youtube.com...');
  await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('[YouTube-Login] Đang chờ đăng nhập... Hãy đăng nhập tài khoản Google / YouTube trên cửa sổ vừa mở.');

  // Polling for studio.youtube.com channel URL or channel dashboard
  const startTime = Date.now();
  const maxWaitMs = 15 * 60 * 1000; // 15 minutes for user login

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('studio.youtube.com/channel/') || currentUrl.includes('studio.youtube.com/video/')) {
        console.log(`[YouTube-Login] Phát hiện đã đăng nhập thành công vào: ${currentUrl}`);

        // Try extracting channel ID & channel name
        let channelName = '';
        let channelId = '';

        const channelMatch = currentUrl.match(/channel\/([a-zA-Z0-9_-]+)/);
        if (channelMatch) {
          channelId = channelMatch[1];
        }

        try {
          await page.waitForTimeout(3000);
          channelName = await page.evaluate(() => {
            const el = document.querySelector('#channel-name, .channel-name, #entity-name, ytcp-entity-page[aria-label]');
            return el ? el.innerText.trim() : '';
          });
        } catch (e) {}

        const finalName = channelName || 'Kênh YouTube';
        const finalId = channelId || 'youtube_channel';

        try {
          await prisma.integration.updateMany({
            where: { providerIdentifier: 'youtube', deletedAt: null },
            data: {
              name: finalName,
              profile: `@${finalName.toLowerCase().replace(/\s+/g, '_')}`,
              internalId: finalId,
              rootInternalId: finalId,
              disabled: false,
              refreshNeeded: false,
              updatedAt: new Date(),
            },
          });
          console.log('[YouTube-Login] Đã cập nhật thông tin kênh vào Postiz database!');
        } catch (dbErr) {
          console.error('[YouTube-Login] Lỗi cập nhật DB:', dbErr.message);
        }

        const result = {
          success: true,
          channelId: finalId,
          channelName: finalName,
          profileDir: userDataDir,
        };

        console.log('__RESULT__' + JSON.stringify(result));
        return result;
      }
    } catch (e) {
      // page might be navigating
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error('Hết thời gian chờ đăng nhập YouTube (15 phút).');
}

if (require.main === module) {
  launchYouTubeLogin()
    .then((res) => {
      console.log('HOÀN TẤT:', JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('LỖI:', err.message);
      process.exit(1);
    });
}

module.exports = { launchYouTubeLogin };
