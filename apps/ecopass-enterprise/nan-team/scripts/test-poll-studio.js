const { chromium } = require('playwright');

(async () => {
  const sessionId = 'f24931362c42e1163175c7b193c1cb27';
  console.log('[Playwright] Starting browser for account:', sessionId);

  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    env: { ...process.env, DISPLAY: ':1' }
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  // Inject session cookies for both tiktok.com and .tiktok.com
  await context.addCookies([
    { name: 'sessionid', value: sessionId, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'sessionid_ss', value: sessionId, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'sid_tt', value: sessionId, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'uid_tt', value: '5942b3d2af209765b492745fb132dfd5aaf51101f2d75b141e2041ecef085c77', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'uid_tt_ss', value: '5942b3d2af209765b492745fb132dfd5aaf51101f2d75b141e2041ecef085c77', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
  ]);

  const page = await context.newPage();
  console.log('[Playwright] 1. Visiting https://www.tiktok.com/ ...');
  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('[Playwright] 2. Visiting https://www.tiktok.com/tiktokstudio/upload ...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', {
    referer: 'https://www.tiktok.com/',
    waitUntil: 'domcontentloaded'
  });

  console.log('[Playwright] 3. Polling page state for 25s...');
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(5000);
    const url = page.url();
    const title = await page.title();
    console.log(`[Playwright] [${i * 5}s] URL: ${url} | Title: ${title}`);
    
    // Check if input[type=file] is present
    const inputs = await page.evaluate(() => document.querySelectorAll('input[type="file"]').length);
    console.log(`[Playwright] [${i * 5}s] input[type=file] count:`, inputs);

    // Check all iframes
    for (const frame of page.frames()) {
      if (frame !== page.mainFrame()) {
        const fi = await frame.evaluate(() => document.querySelectorAll('input[type="file"]').length).catch(() => 0);
        if (fi > 0) {
          console.log(`[Playwright] Found ${fi} input[type=file] in frame: ${frame.url()}`);
        }
      }
    }

    if (inputs > 0) {
      console.log('[Playwright] Upload input is ready!');
      break;
    }
  }

  await page.screenshot({ path: 'scripts/tiktok-studio-poll.png' });
  console.log('[Playwright] Screenshot saved to scripts/tiktok-studio-poll.png');

  await browser.close();
})();
