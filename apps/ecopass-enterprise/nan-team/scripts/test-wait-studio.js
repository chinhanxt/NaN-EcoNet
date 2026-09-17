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
  await page.waitForTimeout(3000);

  console.log('2. Clicking upload button via evaluate...');
  await page.evaluate(() => {
    const el = document.querySelector('a[href*="tiktokstudio/upload"]') || document.querySelector('a[aria-label*="Upload"]');
    if (el) el.click();
  });

  console.log('3. Waiting for TikTok Studio to finish loading...');
  // Wait up to 25s for loading spinner to disappear or upload input to appear
  try {
    await page.waitForSelector('input[type="file"]', { timeout: 25000 });
    console.log('SUCCESS: input[type="file"] detected directly!');
  } catch (e) {
    console.log('Direct input[type="file"] not detected yet, checking iframes or page state...');
  }

  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());
  console.log('Title:', await page.title());
  await page.screenshot({ path: 'scripts/tiktok-studio-loaded.png' });

  // Check inputs and frames
  const mainInputs = await page.evaluate(() => document.querySelectorAll('input[type="file"]').length);
  console.log('Main page file inputs:', mainInputs);

  for (const frame of page.frames()) {
    const fi = await frame.evaluate(() => document.querySelectorAll('input[type="file"]').length).catch(() => 0);
    console.log(`Frame ${frame.url()}: ${fi} file inputs`);
  }

  // Also print buttons or text on the page
  const texts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="button"], h1, h2, h3, span'))
      .map(el => el.innerText ? el.innerText.trim() : '')
      .filter(t => t.length > 0 && t.length < 50)
      .slice(0, 20);
  });
  console.log('Page sample texts:', texts);

  await browser.close();
})();
