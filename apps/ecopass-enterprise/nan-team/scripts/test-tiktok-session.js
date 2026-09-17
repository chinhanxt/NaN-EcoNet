const { chromium } = require('playwright');

async function testTikTok() {
  const sessionId = 'f24931362c42e1163175c7b193c1cb27';
  console.log('[Test-TikTok] Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'sessionid',
      value: sessionId,
      domain: '.tiktok.com',
      path: '/',
      httpOnly: true,
      secure: true,
    },
    {
      name: 'sessionid_ss',
      value: sessionId,
      domain: '.tiktok.com',
      path: '/',
      httpOnly: true,
      secure: true,
    },
    {
      name: 'sid_tt',
      value: sessionId,
      domain: '.tiktok.com',
      path: '/',
      httpOnly: true,
      secure: true,
    }
  ]);

  const page = await context.newPage();
  console.log('[Test-TikTok] Navigating to https://www.tiktok.com/tiktokstudio/upload ...');
  try {
    const res = await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    console.log('[Test-TikTok] Status:', res?.status());
    console.log('[Test-TikTok] Waiting 5 seconds for client-side render...');
    await page.waitForTimeout(5000);
    console.log('[Test-TikTok] Current URL:', page.url());
    console.log('[Test-TikTok] Page title:', await page.title());

    // Take screenshot
    await page.screenshot({ path: 'scripts/tiktok-upload-screenshot.png' });
    console.log('[Test-TikTok] Saved screenshot to scripts/tiktok-upload-screenshot.png');

    // Inspect elements
    const fileInputs = await page.$$('input[type="file"]');
    console.log('[Test-TikTok] input[type="file"] count:', fileInputs.length);

    const buttons = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()).filter(Boolean));
    console.log('[Test-TikTok] Visible buttons:', buttons.slice(0, 15));

    // Also check iframes
    for (const frame of page.frames()) {
      if (frame !== page.mainFrame()) {
        const fi = await frame.$$('input[type="file"]');
        if (fi.length > 0) {
          console.log(`[Test-TikTok] Subframe (${frame.url()}) has ${fi.length} file inputs!`);
        }
      }
    }
  } catch (err) {
    console.error('[Test-TikTok] Error:', err.message);
  } finally {
    await browser.close();
  }
}

testTikTok();
