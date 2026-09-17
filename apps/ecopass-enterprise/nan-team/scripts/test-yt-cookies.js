const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const yt = await prisma.integration.findFirst({ where: { providerIdentifier: 'youtube', deletedAt: null } });
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  if (yt?.token) {
    const pairs = yt.token.split(';').map(s => s.trim()).filter(Boolean);
    const cookies = [];
    pairs.forEach(p => {
      const idx = p.indexOf('=');
      if (idx > -1) {
        const name = p.substring(0, idx).trim();
        const value = p.substring(idx+1).trim();
        cookies.push({ name, value, domain: '.youtube.com', path: '/', secure: true });
        cookies.push({ name, value, domain: '.google.com', path: '/', secure: true });
      }
    });
    await context.addCookies(cookies);
    console.log(`Added ${cookies.length} cookies successfully.`);
  }
  console.log('Navigating to https://www.youtube.com ...');
  await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  console.log('YouTube Home Title:', await page.title());
  console.log('Current URL:', page.url());
  const avatar = await page.$('#avatar-btn');
  console.log('Avatar element found (logged in on www.youtube.com):', !!avatar);

  console.log('Navigating to https://studio.youtube.com ...');
  await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('YouTube Studio URL:', page.url());
  console.log('YouTube Studio Title:', await page.title());
  const isLoginPage = page.url().includes('accounts.google.com');
  console.log('Is on login page for Studio:', isLoginPage);

  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);
