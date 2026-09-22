const { chromium } = require('playwright');

(async () => {
  const sessionId = 'f24931362c42e1163175c7b193c1cb27';

  // 1. Fetch passport info and extract all Set-Cookie headers
  const res = await fetch('https://www.tiktok.com/passport/web/account/info/', {
    headers: {
      'Cookie': 'sessionid=' + sessionId,
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    }
  });

  const rawHeaders = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  console.log('Got', rawHeaders.length, 'set-cookie headers from TikTok passport API');

  const cookiesToSet = [];
  // Add base session cookies for both .tiktok.com and tiktok.com
  for (const domain of ['.tiktok.com', 'tiktok.com', '.www.tiktok.com', 'www.tiktok.com']) {
    cookiesToSet.push(
      { name: 'sessionid', value: sessionId, domain, path: '/', httpOnly: true, secure: true },
      { name: 'sessionid_ss', value: sessionId, domain, path: '/', httpOnly: true, secure: true },
      { name: 'sid_tt', value: sessionId, domain, path: '/', httpOnly: true, secure: true }
    );
  }

  for (const raw of rawHeaders) {
    const parts = raw.split(';').map(p => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx === -1) continue;
    const name = nameVal.substring(0, eqIdx);
    const value = nameVal.substring(eqIdx + 1);
    let domain = '.tiktok.com';
    let path = '/';
    let secure = false;
    let httpOnly = false;
    for (const a of attrs) {
      const lower = a.toLowerCase();
      if (lower.startsWith('domain=')) domain = a.substring(7);
      if (lower.startsWith('path=')) path = a.substring(5);
      if (lower === 'secure') secure = true;
      if (lower === 'httponly') httpOnly = true;
    }
    cookiesToSet.push({ name, value, domain, path, secure, httpOnly });
  }

  console.log('Total cookies to inject:', cookiesToSet.length);

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

  await context.addCookies(cookiesToSet);

  const page = await context.newPage();
  console.log('Navigating to https://www.tiktok.com/tiktokstudio/upload ...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 45000 });

  console.log('Waiting 8 seconds for page render...');
  await page.waitForTimeout(8000);

  console.log('Final URL:', page.url());
  console.log('Final Title:', await page.title());
  await page.screenshot({ path: 'scripts/tiktok-final-upload.png' });
  console.log('Screenshot saved to scripts/tiktok-final-upload.png');

  const fileInputs = await page.$$('input[type="file"]');
  console.log('input[type=file] found in main page:', fileInputs.length);

  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) {
      const fi = await frame.$$('input[type="file"]');
      if (fi.length > 0) {
        console.log(`Subframe (${frame.url()}) has ${fi.length} file inputs!`);
      }
    }
  }

  await browser.close();
})();
