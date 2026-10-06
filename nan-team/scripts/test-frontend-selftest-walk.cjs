'use strict';
// UI self-test walkthrough (headless Chrome) for the video-agent features, as a user would click them.
// Usage (wrap live stages in the shared lock):
//   flock /tmp/nan-live-job.lock nice -n 19 node scripts/test-frontend-selftest-walk.cjs <stage> [mediaId]
// Stages: open | idea (15s idea→video, attach) | source (Media → plan → approve → render)
//         | resume <jobId> (drive an already running source job from the UI through approval/render)
//         | retry (open the latest failed/cancelled source job → "Thử lại với cùng cấu hình" → approve → render)
//         | revise (latest history job → "Chỉnh clip" → 1:1 → approve → render) | attach (history clip → composer + postText)
// Signs in as the fixture user of reports/openshorts-integration/live-source-job.json (JWT_SECRET from .env).
// Screenshots + API logs: reports/openshorts-integration/frontend-selftest/
// On failure, every job this run created (idea render / source / retry / revise) that is still running is cancelled
// (DELETE /ai-video/:jobId, DELETE /ai-video/source-jobs/:jobId); result in walk-state.json `<stage>Cleanup`.
const path = require('node:path'), fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const { sign } = require('jsonwebtoken');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const shots = path.join(root, 'reports/openshorts-integration/frontend-selftest');
fs.mkdirSync(shots, { recursive: true });
const fixture = require(path.join(root, 'reports/openshorts-integration/live-source-job.json'));
const stage = process.argv[2] || 'open';
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const statePath = path.join(shots, 'walk-state.json');
const S = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const save = () => fs.writeFileSync(statePath, JSON.stringify(S, null, 2));
const terminal = new Set(['completed', 'failed', 'cancelled']);
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--disable-gpu', '--renderer-process-limit=2'] });
  const context = await browser.newContext({ baseURL: 'http://localhost:4200', viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addCookies([
    { name: 'auth', value: sign({ id: fixture.userId }, process.env.JWT_SECRET, { expiresIn: '2h' }), domain: 'localhost', path: '/', httpOnly: true },
    { name: 'showorg', value: fixture.orgId, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [], api = [], jobs = new Map(), created = [];
  page.on('pageerror', e => { errors.push(e.message); log('PAGEERROR', e.message.slice(0, 300)); });
  page.on('response', r => {
    const u = new URL(r.url()); if (u.port !== '3000' || u.pathname.includes('/notifications')) return;
    api.push(`${new Date().toTimeString().slice(0, 8)} ${r.request().method()} ${u.pathname}${u.search} ${r.status()}`);
    if (r.status() >= 400) log('API', r.request().method(), u.pathname, r.status());
    const m = u.pathname.match(/\/ai-video\/source-jobs\/([0-9a-f-]{36})$/);
    if (m && r.request().method() === 'GET' && r.ok()) r.json().then(b => jobs.set(m[1], b), () => {});
    // Jobs created by this run (not `resume`, whose job already existed) — cancelled on failure.
    if (r.request().method() === 'POST' && r.ok()) {
      const kind = u.pathname.endsWith('/ai-video/render') ? 'idea' : /\/ai-video\/source-jobs(\/[0-9a-f-]{36}\/(retry|revisions))?$/.test(u.pathname) ? 'source' : null;
      if (kind) created.push(r.json().then(b => b?.jobId && { kind, jobId: b.jobId }, () => null));
    }
  });
  const shot = async name => { await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }); log('shot', name); };
  const t0 = Date.now();
  try {
    await page.goto('/agents/new', { waitUntil: 'domcontentloaded', timeout: 600000 });
    await page.getByRole('button', { name: /Tạo Video AI/ }).first().click({ timeout: 600000 });
    log('agents page ready in', (Date.now() - t0) / 1000, 's');
    if (stage === 'open') await shot('01-studio-open');
    if (stage === 'idea') {
      const dialog = page.getByRole('dialog', { name: 'AI Video Studio' });
      await dialog.locator('#studio-topic').fill('3 thói quen buổi sáng giúp người trẻ Sài Gòn bớt căng thẳng trước giờ làm');
      await dialog.getByRole('button', { name: /^15s/ }).click();
      await shot('10-idea-setup');
      let t = Date.now();
      await dialog.getByRole('button', { name: '✦ Tạo kịch bản & sinh ảnh', exact: true }).click();
      const ready = dialog.getByRole('button', { name: 'Xuất video MP4', exact: true }).or(dialog.getByRole('alert')).first();
      for (let last = '', deadline = Date.now() + 900000; !(await ready.isVisible()); await page.waitForTimeout(5000)) {
        if (Date.now() > deadline) throw new Error('storyboard timeout');
        const txt = (await dialog.locator('section[role="status"]').first().innerText().catch(() => '')).replace(/\n/g, ' | ');
        const head = txt.split(' | ')[0];
        if (head !== last) { log('storyboard progress', txt.slice(0, 160)); last = head; }
      }
      S.ideaStoryboardSeconds = (Date.now() - t) / 1000; save(); log('storyboard', S.ideaStoryboardSeconds);
      await page.waitForTimeout(2000); await shot('11-idea-storyboard');
      if (await dialog.getByRole('alert').count()) throw new Error('storyboard alert: ' + await dialog.getByRole('alert').innerText());
      t = Date.now();
      const renderResp = page.waitForResponse(r => r.url().includes('/ai-video/render') && r.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Xuất video MP4', exact: true }).click();
      S.ideaJob = await (await renderResp).json(); save(); log('render job', JSON.stringify(S.ideaJob));
      let last = '';
      for (const deadline = Date.now() + 1200000; Date.now() < deadline; await page.waitForTimeout(3000)) {
        if (await dialog.getByRole('heading', { name: 'Video đã sẵn sàng' }).count()) break;
        if (await dialog.getByRole('alert').count()) log('ALERT', await dialog.getByRole('alert').innerText());
        const txt = await dialog.locator('section[aria-live="polite"]').first().innerText().catch(() => '');
        if (txt !== last) { log('progress', txt.replace(/\n/g, ' | ').slice(0, 160)); last = txt; }
        if (/chưa thành công|Đã hủy/.test(txt)) { await shot('12-idea-failed'); throw new Error('render ' + txt); }
      }
      S.ideaRenderSeconds = (Date.now() - t) / 1000; save();
      const pb = await dialog.getByLabel('Video AI đã hoàn tất').evaluate(async el => { if (el.readyState < 1) await new Promise((ok, ko) => { el.addEventListener('loadedmetadata', ok, { once: true }); el.addEventListener('error', ko, { once: true }); }); return { d: el.duration, w: el.videoWidth, h: el.videoHeight, src: el.currentSrc }; });
      S.ideaPlayback = pb; save(); log('playback', JSON.stringify(pb));
      await shot('13-idea-done');
      await dialog.getByRole('button', { name: 'Đính kèm vào bài đăng Agent', exact: true }).click();
      await page.locator('.sortable-container video').first().waitFor();
      await page.waitForTimeout(2000); await shot('14-idea-attached-composer');
    }
    if (['source', 'revise', 'attach', 'resume', 'retry'].includes(stage)) {
      await page.getByRole('tab', { name: 'Chỉnh video có sẵn', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Studio video nguồn' });
      await dialog.waitFor();
      if (stage === 'source') {
        await dialog.getByRole('button', { name: 'Kho media', exact: true }).click();
        const picker = dialog.getByLabel('Chọn video từ kho media'), mediaId = process.argv[3] || 'e3198558-c28f-4a66-bf1d-2d8c01d9ff0d';
        await picker.locator(`option[value="${mediaId}"]`).waitFor({ state: 'attached', timeout: 60000 });
        S.mediaPickerVideoOptions = await picker.locator('option').count() - 1; save();
        log('media picker video options', S.mediaPickerVideoOptions, '(API pages by 18; >18 media means paging works)');
        await picker.selectOption(mediaId);
        await dialog.getByLabel('Số clip').fill('1');
        await dialog.getByLabel('Tối thiểu (s)').fill('20');
        await dialog.getByLabel('Tối đa (s)').fill('40');
        const review = dialog.getByLabel('Duyệt các đoạn AI chọn trước khi xuất video');
        if (!(await review.isChecked())) await review.check();
        await shot('20-source-setup');
      } else if (stage !== 'resume') {
        const history = dialog.locator('details').filter({ has: page.getByText('Lịch sử dự án', { exact: true }) });
        await history.locator('summary').click();
        const row = history.getByRole('button', { name: stage === 'retry' ? /Xử lý thất bại|Đã hủy|failed|cancelled/ : /Đã hoàn tất/ }).first();
        await row.waitFor();
        await shot(stage === 'revise' ? '40-history' : stage === 'retry' ? '30-history-failed' : '50-history');
        await row.click();
        if (stage === 'retry') {
          await dialog.getByRole('button', { name: 'Thử lại với cùng cấu hình' }).waitFor({ timeout: 60000 });
          S.retryFailureText = await dialog.getByRole('alert').first().innerText().catch(() => ''); save();
          log('failure shown', S.retryFailureText.replace(/\n/g, ' | ').slice(0, 300));
          await shot('31-retry-failed-job');
        } else {
          await dialog.getByRole('heading', { name: 'Clip đã lưu vào kho media' }).waitFor({ timeout: 60000 });
          await dialog.locator('article video').first().waitFor();
        }
      }
      if (stage === 'revise') {
        await dialog.getByRole('button', { name: 'Chỉnh clip' }).first().click();
        await dialog.getByLabel('Tỉ lệ khung hình').selectOption('1:1');
        const review = dialog.getByLabel('Duyệt các đoạn AI chọn trước khi xuất video');
        if (!(await review.isChecked())) await review.check();
        await shot('41-revise-setup');
      }
      if (['source', 'revise', 'resume', 'retry'].includes(stage)) {
        let t = Date.now(), id = process.argv[3];
        if (stage !== 'resume') {
          const created = page.waitForResponse(r => /\/ai-video\/source-jobs(\/[0-9a-f-]{36}\/(revisions|retry))?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 120000 });
          if (stage === 'retry') await dialog.getByRole('button', { name: 'Thử lại với cùng cấu hình' }).click();
          else await dialog.getByRole('button', { name: /^Phân tích/ }).click();
          const cr = await created; const body = await cr.json();
          if (!cr.ok()) throw new Error('create failed ' + cr.status() + ' ' + JSON.stringify(body));
          id = body.jobId;
        }
        S[stage + 'JobId'] = id; save(); log('job', id);
        let last = '', approved = false;
        for (const deadline = Date.now() + 2400000; Date.now() < deadline; await page.waitForTimeout(4000)) {
          const job = jobs.get(id);
          const txt = await dialog.locator('section[aria-live="polite"] p').first().innerText().catch(() => '');
          if (txt !== last) {
            const step = await dialog.locator('ol[aria-label="Các bước xử lý"] li[aria-current="step"]').innerText().catch(() => '');
            const eta = await dialog.locator('section[aria-live="polite"] p').nth(1).innerText().catch(() => '');
            log('progress', txt, `| bước: ${step} | ${eta}`, job ? `[${job.status}/${job.stage}]` : ''); last = txt;
          }
          if (!approved && job?.status === 'awaiting_approval' && await dialog.getByRole('heading', { name: 'Duyệt kế hoạch cắt video' }).count()) {
            S[stage + 'AnalysisSeconds'] = (Date.now() - t) / 1000; save();
            await shot(stage === 'revise' ? '42-revise-approval' : stage === 'retry' ? '32-retry-approval' : '21-source-approval');
            await dialog.getByRole('button', { name: /^Duyệt & xuất/ }).click(); approved = true; t = Date.now();
            log('approved after', S[stage + 'AnalysisSeconds'], 's');
          }
          if (job && terminal.has(job.status)) {
            log('terminal', job.status, job.error || '');
            if (job.status !== 'completed') { await page.waitForTimeout(3000); log('UI failure', (await dialog.getByRole('alert').first().innerText().catch(() => '')).replace(/\n/g, ' | ').slice(0, 300), '| retry button:', await dialog.getByRole('button', { name: 'Thử lại với cùng cấu hình' }).count()); }
            break;
          }
        }
        S[stage + 'RenderSeconds'] = (Date.now() - t) / 1000; save();
        await page.waitForTimeout(2000);
        await shot(stage === 'revise' ? '43-revise-done' : stage === 'retry' ? '33-retry-done' : '22-source-done');
        if (jobs.get(id)?.status !== 'completed') throw new Error('job not completed: ' + jobs.get(id)?.status);
      }
      if (stage === 'attach') {
        const art = dialog.locator('article').filter({ has: page.locator('video') }).first();
        await art.locator('input[type="checkbox"]').check();
        await shot('51-attach-chosen');
        await dialog.getByRole('button', { name: /^Đính kèm 1 clip/ }).click();
        await page.locator('.sortable-container video').first().waitFor();
        await page.waitForTimeout(2000);
        await shot('52-attached-composer');
        S.attachComposerText = await page.locator('.copilotKitInput textarea').first().inputValue().catch(() => '');
        save(); log('composer text', S.attachComposerText.slice(0, 200));
      }
    }
  } catch (e) {
    log('ERROR', e.message.slice(0, 800));
    await shot(`${stage}-error`).catch(() => {});
    process.exitCode = 1;
    const cleanup = [];
    for (const job of (await Promise.all(created)).filter(Boolean)) {
      const url = job.kind === 'idea' ? `${BACKEND}/ai-video/${job.jobId}` : `${BACKEND}/ai-video/source-jobs/${job.jobId}`;
      const entry = { ...job };
      try {
        const current = await context.request.get(job.kind === 'idea' ? `${BACKEND}/ai-video/status/${job.jobId}` : url, { timeout: 30000 }).then(r => r.ok() ? r.json() : {}, () => ({}));
        entry.statusAtCleanup = current.status;
        if (!terminal.has(current.status)) entry.deleteStatus = (await context.request.delete(url, { timeout: 60000 })).status();
      } catch (err) { entry.error = err.message; }
      cleanup.push(entry); log('cleanup', JSON.stringify(entry));
    }
    S[stage + 'Cleanup'] = cleanup; save();
  } finally {
    fs.writeFileSync(path.join(shots, `${stage}-api.log`), api.join('\n'));
    log('pageErrors', errors.length, JSON.stringify(errors.slice(0, 3)));
    await browser.close();
  }
})();
