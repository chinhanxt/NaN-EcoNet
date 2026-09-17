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
  console.log('Navigating to https://www.tiktok.com/ ...');
  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
  await page.screenshot({ path: 'scripts/tiktok-home.png' });

  // Look for upload button on home page: usually an Upload icon or link href='/upload'
  const uploadLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="upload"]')).map(a => a.href);
  });
  console.log('Upload links on home page:', uploadLinks);

  const profileLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="@"]')).map(a => a.href);
  });
  console.log('Profile links:', profileLinks.slice(0, 5));

  const hasLogin = await page.evaluate(() => {
    return !!document.querySelector('#header-login-button, [data-e2e="top-login-button"]');
  });
  console.log('Has top login button:', hasLogin);

  await browser.close();
})();
