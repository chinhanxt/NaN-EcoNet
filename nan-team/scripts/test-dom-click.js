const { chromium } = require('playwright');

(async () => {
  const sessionId = 'f24931362c42e1163175c7b193c1cb27';
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

  await context.addCookies([
    { name: 'sessionid', value: sessionId, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'sessionid_ss', value: sessionId, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'sid_tt', value: sessionId, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'uid_tt', value: '5942b3d2af209765b492745fb132dfd5aaf51101f2d75b141e2041ecef085c77', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'uid_tt_ss', value: '5942b3d2af209765b492745fb132dfd5aaf51101f2d75b141e2041ecef085c77', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
  ]);

  const page = await context.newPage();
  console.log('1. Navigating to https://www.tiktok.com/ ...');
  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  console.log('2. Clicking upload button via evaluate / DOM click...');
  await page.evaluate(() => {
    const el = document.querySelector('a[href*="tiktokstudio/upload"]') || document.querySelector('a[aria-label*="Upload"]');
    if (el) el.click();
  });

  console.log('3. Waiting for navigation/load...');
  await page.waitForTimeout(8000);
  console.log('Current URL:', page.url());
  console.log('Title:', await page.title());

  await page.screenshot({ path: 'scripts/tiktok-after-dom-click.png' });

  // If still on tiktok.com, navigate directly with referer
  if (!page.url().includes('tiktokstudio')) {
    console.log('4. Navigating directly with referer...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', {
      referer: 'https://www.tiktok.com/',
      waitUntil: 'domcontentloaded'
    });
    await page.waitForTimeout(8000);
    console.log('Current URL 2:', page.url());
    console.log('Title 2:', await page.title());
    await page.screenshot({ path: 'scripts/tiktok-after-direct-referer.png' });
  }

  // Check file inputs
  const inputsCount = await page.evaluate(() => document.querySelectorAll('input[type="file"]').length);
  console.log('Main frame file inputs:', inputsCount);

  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) {
      const fi = await frame.evaluate(() => document.querySelectorAll('input[type="file"]').length).catch(() => 0);
      if (fi > 0) {
        console.log(`Subframe (${frame.url()}) has ${fi} file inputs!`);
      }
    }
  }

  await browser.close();
})();
