const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext('/home/chinhan/.config/postiz-tiktok-profile', {
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    env: { ...process.env, DISPLAY: ':1' }
  });
  await context.addCookies([
    { name: 'sessionid', value: 'bb453bfbdda015ee834073b6f9433297', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'sessionid_ss', value: 'bb453bfbdda015ee834073b6f9433297', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    { name: 'sid_tt', value: 'bb453bfbdda015ee834073b6f9433297', domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
  ]);
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles('/tmp/test-converted.mp4');
    await page.waitForTimeout(5000);
  }
  
  // 1. Dismiss overlays
  await page.evaluate(() => {
    const turnOnBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Turn on') || b.innerText.includes('Cancel') || b.innerText.includes('Bật'));
    if (turnOnBtn) turnOnBtn.click();
    const gotItBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Got it') || b.innerText.includes('Đã hiểu'));
    if (gotItBtn) gotItBtn.click();
    const overlays = document.querySelectorAll('.react-joyride__overlay, #react-joyride-portal, .react-joyride__beacon');
    overlays.forEach(o => o.remove());
  });
  await page.waitForTimeout(2000);
  
  // 2. Set caption
  const captionEditor = await page.$('div[contenteditable="true"], div[role="combobox"], .DraftEditor-editorContainer, textarea');
  if (captionEditor) {
    await captionEditor.click({ force: true });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('hi #fyp');
    console.log('Caption typed: hi #fyp');
  }
  await page.waitForTimeout(3000);
  
  // 3. Click Post Button
  console.log('Looking for exact Post button...');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const postBtn = btns.find(b => b.innerText.trim() === 'Post' || b.innerText.trim() === 'Đăng');
    if (postBtn) {
      postBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      postBtn.click();
      return { found: true, text: postBtn.innerText.trim(), className: postBtn.className };
    }
    return { found: false };
  });
  console.log('Post button click result:', clicked);
  
  // Wait for result / redirect or modal
  await page.waitForTimeout(10000);
  
  // If there is any confirmation popup (like "Post now" / "Post anyway")
  await page.evaluate(() => {
    const confirm = Array.from(document.querySelectorAll('button')).find(b => 
      b.innerText.includes('Post now') || b.innerText.includes('Post anyway') || 
      b.innerText.includes('Vẫn đăng') || b.innerText.includes('Đăng ngay')
    );
    if (confirm) confirm.click();
  });
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: '/tmp/tiktok-real-post-result.png' });
  console.log('Saved result screenshot to /tmp/tiktok-real-post-result.png');
  console.log('Current URL:', page.url());
  console.log('Page Title:', await page.title());
  
  await context.close();
})().catch(e => console.error(e));
