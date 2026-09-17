const { chromium } = require('playwright');

async function testProfileLaunch() {
  const userDataDir = '/home/chinhan/.config/postiz-tiktok-test';
  console.log('[Test-Profile] Launching Chrome with copied profile...');

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: '/opt/google/chrome/chrome',
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ':1',
    },
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  console.log('[Test-Profile] Navigating to https://www.tiktok.com/tiktokstudio/upload ...');

  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    console.log('[Test-Profile] Waiting 6 seconds...');
    await page.waitForTimeout(6000);
    console.log('[Test-Profile] Current URL:', page.url());
    console.log('[Test-Profile] Title:', await page.title());

    await page.screenshot({ path: 'scripts/profile-test-screenshot.png' });
    console.log('[Test-Profile] Screenshot saved to scripts/profile-test-screenshot.png');

    const fileInputs = await page.$$('input[type="file"]');
    console.log('[Test-Profile] File inputs count:', fileInputs.length);

    // Also check iframes
    for (const frame of page.frames()) {
      if (frame !== page.mainFrame()) {
        const fi = await frame.$$('input[type="file"]');
        if (fi.length > 0) {
          console.log(`[Test-Profile] Subframe (${frame.url()}) has ${fi.length} file inputs!`);
        }
      }
    }
  } catch (err) {
    console.error('[Test-Profile] Error:', err.message);
  } finally {
    await context.close();
  }
}

testProfileLaunch();
