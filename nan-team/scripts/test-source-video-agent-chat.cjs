'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { sign } = require('jsonwebtoken');

async function main() {
  const root = path.resolve(__dirname, '..');
  const live = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BINARY || '/usr/bin/google-chrome' });
  try {
    const context = await browser.newContext({ baseURL: process.env.FRONTEND_URL || 'http://localhost:4200' });
    await context.addCookies([
      { name: 'auth', value: sign({ id: live.userId }, process.env.JWT_SECRET), domain: 'localhost', path: '/', httpOnly: true },
      { name: 'showorg', value: live.orgId, domain: 'localhost', path: '/' },
    ]);
    const page = await context.newPage();
    const errors = [], responses = [], chatBodies = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (/copilot|source-jobs/.test(response.url())) responses.push({ path: new URL(response.url()).pathname, status: response.status() });
      if (new URL(response.url()).pathname === '/copilot/chat') {
        void response.text().then(body => chatBodies.push(body.slice(-3000))).catch(error => chatBodies.push(`read failed: ${error.message}`));
      }
    });
    await page.goto('/agents/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const input = page.locator('textarea[placeholder*="AI NaN-Team"]');
    await input.fill(`Dùng sourceVideoStatusTool để kiểm tra job ${live.jobId}. Chỉ báo trạng thái thật và Media ID khi đã hoàn tất.`);
    await input.press('Enter');
    await page.waitForTimeout(20000);
    console.log(JSON.stringify({ diagnostic: 'agent-chat-after-20s', responses, chatBodies, pageErrors: errors, tail: (await page.locator('body').innerText()).slice(-700) }));
    await page.getByText(live.final.clips[0].media.id).first().waitFor({ timeout: 180000 });
    const receipt = { kind: 'authenticated-agent-chat-source-status', jobId: live.jobId, mediaId: live.final.clips[0].media.id, assistantMentionedSavedMedia: true, responses, errors };
    const directory = path.join(root, 'reports/openshorts-integration/browser');
    await page.screenshot({ path: path.join(directory, 'agent-source-status.png'), fullPage: true });
    await fs.writeFile(path.join(directory, 'agent-chat-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    if (errors.length) throw new Error(`Browser errors: ${errors.slice(0, 3).join('; ')}`);
    console.log(JSON.stringify(receipt));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
