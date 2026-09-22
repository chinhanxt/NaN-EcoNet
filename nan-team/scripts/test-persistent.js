const { chromium } = require('playwright');

async function test() {
  const userDataDir = '/home/chinhan/.config/postiz-tiktok-profile';
  console.log('Launching persistent context in:', userDataDir);
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: '/opt/google/chrome/chrome',
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    env: { ...process.env, DISPLAY: ':1' },
    viewport: null
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  console.log('Navigating to https://www.tiktok.com/tiktokstudio/upload ...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded' });
  console.log('URL:', page.url());
  console.log('Keeping open for 10 seconds...');
  await page.waitForTimeout(10000);
  console.log('Done!');
  await context.close();
}

test().catch(console.error);
