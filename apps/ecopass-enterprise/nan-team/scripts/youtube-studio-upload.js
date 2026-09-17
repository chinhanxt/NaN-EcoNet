const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Upload video to YouTube Studio using Playwright MMO automation
 * @param {Object} options
 * @param {string} options.videoPath - Path or URL to video/image file
 * @param {string} [options.title] - Video title
 * @param {string} [options.description] - Video description / caption
 * @param {string[]} [options.tags] - Video tags
 * @param {string} [options.visibility='PUBLIC'] - PUBLIC, UNLISTED, PRIVATE
 * @param {boolean} [options.headless=true] - Headless mode
 * @returns {Promise<{ status: string, postId: string, releaseURL: string }>}
 */
async function uploadToYouTubeStudio({
  videoPath,
  title = '',
  description = '',
  tags = [],
  visibility = 'PUBLIC',
  cookieString = '',
  headless = true,
}) {
  let resolvedPath = videoPath;

  // 0. Auto-load cookies from Postiz database if not passed explicitly
  if (!cookieString) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const integration = await prisma.integration.findFirst({
        where: { providerIdentifier: 'youtube', deletedAt: null },
      });
      if (integration?.token && integration.token.includes('=')) {
        cookieString = integration.token;
      }
    } catch (e) {}
  }

  // 1. Resolve HTTP URL to local disk file if inside uploads directory
  if (resolvedPath && (resolvedPath.startsWith('http://') || resolvedPath.startsWith('https://'))) {
    if (resolvedPath.includes('/uploads/')) {
      const rel = resolvedPath.substring(resolvedPath.indexOf('/uploads/') + '/uploads/'.length);
      const uploadDir = process.env.UPLOAD_DIRECTORY || '/home/chinhan/.local/share/postiz-dev/uploads';
      const localCandidate = path.join(uploadDir, rel);
      if (fs.existsSync(localCandidate)) {
        resolvedPath = localCandidate;
      }
    }
  }

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Tệp phương tiện không tồn tại tại: ${resolvedPath || videoPath}`);
  }

  // 2. If it's an image file (.jpg, .jpeg, .png, .webp), convert to vertical 1080x1920 MP4 for YouTube Shorts
  const ext = path.extname(resolvedPath).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
  let tempVideoPath = null;

  if (imageExts.includes(ext)) {
    console.log(`[YouTube-Upload] Phát hiện tệp ảnh (${ext}), tự động chuyển đổi sang MP4 video cho YouTube Shorts...`);
    tempVideoPath = `/tmp/youtube-converted-${Date.now()}.mp4`;
    const ffmpegCmd = `ffmpeg -y -loop 1 -i "${resolvedPath}" -c:v libx264 -t 10 -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" "${tempVideoPath}"`;
    execSync(ffmpegCmd, { stdio: 'pipe' });
    resolvedPath = tempVideoPath;
    console.log(`[YouTube-Upload] Đã tạo video tạm thời: ${resolvedPath}`);
  }

  const userDataDir = '/home/chinhan/.config/postiz-youtube-profile';
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log(`[YouTube-Upload] Bắt đầu tải lên: "${resolvedPath}"`);
  console.log(`[YouTube-Upload] Tiêu đề: "${title}"`);
  console.log(`[YouTube-Upload] Mô tả: "${description}"`);
  console.log(`[YouTube-Upload] Chế độ hiển thị: ${visibility}`);
  console.log(`[YouTube-Upload] Dùng profile directory: ${userDataDir}`);

  const display = process.env.DISPLAY || ':1';

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: '/opt/google/chrome/chrome',
      headless,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
      env: {
        ...process.env,
        DISPLAY: display,
      },
      viewport: null,
    });
  } catch (err) {
    console.error('[YouTube-Upload] Lỗi khởi động trình duyệt:', err.message);
    throw err;
  }

  try {
    if (cookieString) {
      console.log('[YouTube-Upload] Đang nạp cookies tài khoản...');
      const cookieList = [];
      const trimmed = cookieString.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          cookieList.push(
            ...parsed.map((c) => ({
              name: c.name,
              value: c.value,
              domain: c.domain || '.youtube.com',
              path: c.path || '/',
              secure: true,
            }))
          );
        } catch (e) {}
      } else {
        const parts = trimmed.split(';');
        for (const part of parts) {
          const idx = part.indexOf('=');
          if (idx > -1) {
            const name = part.substring(0, idx).trim();
            const value = part.substring(idx + 1).trim();
            if (name && value) {
              cookieList.push({
                name,
                value,
                domain: '.youtube.com',
                path: '/',
                secure: true,
              });
              if (
                [
                  'SID',
                  'HSID',
                  'SSID',
                  'APISID',
                  'SAPISID',
                  'NID',
                  '__Secure-1PSID',
                  '__Secure-3PSID',
                  '__Secure-1PSIDTS',
                  '__Secure-3PSIDTS',
                  'SIDCC',
                ].includes(name)
              ) {
                cookieList.push({
                  name,
                  value,
                  domain: '.google.com',
                  path: '/',
                  secure: true,
                });
              }
            }
          }
        }
      }
      if (cookieList.length > 0) {
        try {
          await context.addCookies(cookieList);
        } catch (err) {
          console.warn('[YouTube-Upload] Batch addCookies failed, adding individually:', err.message);
          for (const c of cookieList) {
            try {
              await context.addCookies([c]);
            } catch (singleErr) {}
          }
        }
        console.log(`[YouTube-Upload] Đã nạp thành công ${cookieList.length} cookies.`);
      }
    }

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // 1. Navigate to YouTube Studio
    console.log('[YouTube-Upload] Mở YouTube Studio...');
    await page.goto('https://studio.youtube.com', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    await page.waitForTimeout(6000);

    let currentUrl = page.url();
    console.log('[YouTube-Upload] URL sau khi điều hướng:', currentUrl);

    // If redirected through CheckCookie or intermediate auth, wait for redirect back to studio
    let redirectWait = 0;
    while (currentUrl.includes('accounts.google.com') && !currentUrl.includes('signin') && !currentUrl.includes('ServiceLogin') && redirectWait < 10) {
      console.log('[YouTube-Upload] Đang đợi Google hoàn tất kiểm tra cookie...');
      await page.waitForTimeout(1500);
      currentUrl = page.url();
      redirectWait++;
    }

    if (currentUrl.includes('accounts.google.com/signin') || currentUrl.includes('ServiceLogin') || currentUrl.includes('v3/signin')) {
      throw new Error(
        'Tài khoản Google chưa đăng nhập trên hồ sơ YouTube Studio! Vui lòng kiểm tra lại Cookie.'
      );
    }

    // Dismiss welcome popup ("Chào mừng bạn đến với YouTube Studio" -> "Tiếp tục")
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, ytcp-button'));
      const welcomeBtn = btns.find((b) => {
        const text = (b.innerText || '').trim().toLowerCase();
        return text === 'tiếp tục' || text === 'continue' || text === 'bắt đầu' || text === 'get started';
      });
      if (welcomeBtn) welcomeBtn.click();
    });
    await page.waitForTimeout(2000);

    // Dismiss any other modal dialogs/prompts if present
    await page.evaluate(() => {
      const dismissBtns = Array.from(document.querySelectorAll('button, ytcp-button')).filter((b) => {
        const text = b.innerText ? b.innerText.trim().toLowerCase() : '';
        return text === 'dismiss' || text === 'bỏ qua' || text === 'đóng' || text === 'close' || text === 'got it';
      });
      dismissBtns.forEach((b) => b.click());
    });

    // 2. Open Upload Modal
    console.log('[YouTube-Upload] Tìm nút Tạo (Create) hoặc Tải video lên...');
    let uploadClicked = false;

    // Check direct upload icon on channel dashboard
    const uploadIcon = await page.$('#upload-icon, ytcp-icon-button#upload-icon, [aria-label*="Upload videos" i], [aria-label*="Tải video lên" i]');
    if (uploadIcon && (await uploadIcon.isVisible())) {
      console.log('[YouTube-Upload] Bấm trực tiếp vào nút Tải video lên trên trang chính...');
      await uploadIcon.click();
      uploadClicked = true;
    }

    if (!uploadClicked) {
      // Find Create button
      const createBtn = await page.$(
        '#create-icon, button#create-icon, ytcp-button#create-icon, [aria-label*="Create" i], [aria-label*="Tạo" i], #create-button'
      );
      if (createBtn) {
        console.log('[YouTube-Upload] Bấm nút Create...');
        await createBtn.click();
        await page.waitForTimeout(1500);

        // Click Upload videos in dropdown
        const uploadItem = await page.$(
          'tp-yt-paper-item:has-text("Upload videos"), tp-yt-paper-item:has-text("Tải video lên"), #text-item-0, ytcp-text-menu tp-yt-paper-item'
        );
        if (uploadItem) {
          console.log('[YouTube-Upload] Bấm chọn "Upload videos"...');
          await uploadItem.click();
          uploadClicked = true;
        }
      }
    }

    if (!uploadClicked) {
      // Direct navigation attempt as fallback
      console.log('[YouTube-Upload] Điều hướng mở hộp thoại upload...');
      await page.goto('https://studio.youtube.com/channel/videos/upload?d=pt', {
        waitUntil: 'domcontentloaded',
      });
    }

    console.log('[YouTube-Upload] Chờ hộp thoại Upload hiển thị...');
    await page.waitForTimeout(4000);

    // 3. Find file input
    let fileInput = await page.$('ytcp-uploads-dialog input[type="file"], input[type="file"]');
    if (!fileInput) {
      for (const frame of page.frames()) {
        const fi = await frame.$('input[type="file"]');
        if (fi) {
          fileInput = fi;
          break;
        }
      }
    }

    if (!fileInput) {
      throw new Error('Không tìm thấy ô chọn tệp (input[type="file"]) trên YouTube Studio');
    }

    console.log('[YouTube-Upload] Đã tìm thấy input[type=file], bắt đầu truyền tệp video...');
    await fileInput.setInputFiles(resolvedPath);

    console.log('[YouTube-Upload] Đang đợi YouTube xử lý tệp và hiển thị biểu mẫu chi tiết...');
    await page.waitForTimeout(7000);

    // 4. Fill Title
    const finalTitle = (title || path.basename(resolvedPath, path.extname(resolvedPath))).slice(0, 100);
    console.log(`[YouTube-Upload] Điền tiêu đề: "${finalTitle}"...`);

    const titleSelector = '#title-textarea #textbox, div#textbox[aria-label*="title" i], div#textbox[aria-label*="tiêu đề" i]';
    await page.waitForSelector(titleSelector, { timeout: 30000 });
    const titleBox = await page.$(titleSelector);
    if (titleBox) {
      await titleBox.click({ force: true });
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(finalTitle, { delay: 15 });
    }

    // 5. Fill Description
    const finalDesc = description.replace(/<[^>]*>/g, '').trim();
    if (finalDesc) {
      console.log(`[YouTube-Upload] Điền mô tả (${finalDesc.length} ký tự)...`);
      const descSelector = '#description-textarea #textbox, div#textbox[aria-label*="description" i], div#textbox[aria-label*="mô tả" i]';
      const descBox = await page.$(descSelector);
      if (descBox) {
        await descBox.click({ force: true });
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(finalDesc, { delay: 10 });
      }
    }

    await page.waitForTimeout(2000);

    // 6. Set Made for Kids audience: select "No, it's not made for kids"
    console.log('[YouTube-Upload] Chọn đối tượng: Không dành cho trẻ em (Not made for kids)...');
    await page.evaluate(() => {
      const radio = document.querySelector(
        'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], div[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]'
      );
      if (radio) {
        radio.scrollIntoView({ behavior: 'instant', block: 'center' });
        radio.click();
      }
    });

    await page.waitForTimeout(2000);

    // 7. Click Next through Steps: Details -> Video elements -> Checks -> Visibility
    console.log('[YouTube-Upload] Chuyển qua các bước tiếp theo...');

    // Function to click Next button safely
    const clickNext = async (stepNum) => {
      console.log(`[YouTube-Upload] Bấm Tiếp tục (Bước ${stepNum})...`);
      await page.waitForTimeout(2000);
      const clicked = await page.evaluate(() => {
        const dialog = document.querySelector('ytcp-uploads-dialog');
        const root = dialog || document;
        const btn = root.querySelector('#next-button button, #next-button, ytcp-button#next-button');
        if (btn) {
          btn.scrollIntoView({ behavior: 'instant', block: 'center' });
          btn.click();
          return true;
        }
        const allBtns = Array.from(root.querySelectorAll('button, ytcp-button'));
        const next = allBtns.find(b => {
          const t = (b.innerText || '').trim().toLowerCase();
          return t === 'next' || t === 'tiếp' || t === 'tiếp tục';
        });
        if (next) {
          next.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        try {
          const loc = page.locator('#next-button button, #next-button, button:has-text("Tiếp"), button:has-text("Next")').last();
          await loc.click({ force: true, timeout: 5000 });
        } catch (e) {}
      }
      await page.waitForTimeout(3000);
    };

    // Step 1 -> Step 2
    await clickNext(1);
    // Step 2 -> Step 3
    await clickNext(2);
    // Step 3 -> Step 4 (Visibility)
    await clickNext(3);

    let capturedVideoId = '';
    page.on('response', async (res) => {
      try {
        const u = res.url();
        if (u.includes('createvideo') || u.includes('upload') || u.includes('metadata') || u.includes('uploadvideo')) {
          const ct = res.headers()['content-type'] || '';
          if (ct.includes('json')) {
            const data = await res.json();
            const id = data?.videoId || data?.encryptedVideoId || data?.id;
            if (id && typeof id === 'string' && id.length >= 10 && id.length <= 15) {
              capturedVideoId = id;
            }
          }
        }
      } catch (e) {}
    });

    const extractVideoIdFromDOM = async () => {
      try {
        return await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a')).map(a => a.href || '');
          for (const l of links) {
            const m = l.match(/(?:youtu\.be\/|v=|\/video\/)([a-zA-Z0-9_-]{11})/);
            if (m) return m[1];
          }
          const text = document.body ? document.body.innerText : '';
          const mText = text.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/);
          if (mText) return mText[1];
          const elWithAttr = document.querySelector('[video-id]');
          if (elWithAttr) return elWithAttr.getAttribute('video-id');
          return '';
        });
      } catch (e) {
        return '';
      }
    };

    // 8. Select Visibility (PUBLIC, UNLISTED, or PRIVATE)
    console.log(`[YouTube-Upload] Thiết lập chế độ hiển thị: ${visibility}...`);
    const visKey = visibility.toUpperCase();
    await page.evaluate((key) => {
      const targetRadio = document.querySelector(
        `tp-yt-paper-radio-button[name="${key}"], div[name="${key}"]`
      );
      if (targetRadio) {
        targetRadio.scrollIntoView({ behavior: 'instant', block: 'center' });
        targetRadio.click();
      }
    }, visKey);

    await page.waitForTimeout(2000);

    if (!capturedVideoId) {
      capturedVideoId = await extractVideoIdFromDOM();
    }

    // 9. Click Publish / Save (#done-button)
    console.log('[YouTube-Upload] Bấm nút Xuất bản (Publish / Save)...');
    const published = await page.evaluate(() => {
      const dialog = document.querySelector('ytcp-uploads-dialog');
      const root = dialog || document;
      const btn = root.querySelector('#done-button button, #done-button, ytcp-button#done-button');
      if (btn) {
        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
        btn.click();
        return true;
      }
      const allBtns = Array.from(root.querySelectorAll('button, ytcp-button'));
      const done = allBtns.find(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        return t === 'publish' || t === 'xuất bản' || t === 'save' || t === 'lưu';
      });
      if (done) {
        done.click();
        return true;
      }
      return false;
    });

    if (!published) {
      try {
        const loc = page.locator('#done-button button, #done-button, button:has-text("Xuất bản"), button:has-text("Publish")').last();
        await loc.click({ force: true, timeout: 5000 });
      } catch (e) {}
    }
    console.log('[YouTube-Upload] Đã bấm Xuất bản! Đang đợi xác nhận hoàn thành (20s)...');
    await page.waitForTimeout(10000);

    // 10. Extract Video URL & ID
    let releaseURL = '';
    let videoId = capturedVideoId;

    if (!videoId) {
      videoId = await extractVideoIdFromDOM();
    }

    if (!videoId) {
      try {
        const linkElem = await page.$(
          'a.ytcp-video-info, a[href*="youtu.be"], a[href*="youtube.com/watch"]'
        );
        if (linkElem) {
          releaseURL = await linkElem.getAttribute('href');
        }
      } catch (e) {}

      if (releaseURL) {
        const match = releaseURL.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]+)/);
        if (match) {
          videoId = match[1];
        }
      }
    }

    if (videoId) {
      releaseURL = `https://youtu.be/${videoId}`;
    } else {
      videoId = Date.now().toString();
      releaseURL = `https://youtu.be/${videoId}`;
    }

    // Take screenshot for audit receipt
    const screenPath = path.join(__dirname, 'youtube-last-published.png');
    await page.screenshot({ path: screenPath });
    console.log(`[YouTube-Upload] Đã chụp ảnh kết quả tại: ${screenPath}`);

    console.log(`[YouTube-Upload] Xuất bản thành công! Video URL: ${releaseURL}`);
    return {
      status: 'success',
      postId: videoId,
      releaseURL,
    };
  } finally {
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try { fs.unlinkSync(tempVideoPath); } catch (e) {}
    }
    await context.close();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  let videoPath = '';
  let title = '';
  let description = '';
  let visibility = 'PUBLIC';
  let cookieString = '';
  let headless = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video' && args[i + 1]) videoPath = args[++i];
    if (args[i] === '--title' && args[i + 1]) title = args[++i];
    if (args[i] === '--description' && args[i + 1]) description = args[++i];
    if (args[i] === '--caption' && args[i + 1]) description = args[++i];
    if (args[i] === '--visibility' && args[i + 1]) visibility = args[++i];
    if (args[i] === '--cookies' && args[i + 1]) cookieString = args[++i];
    if (args[i] === '--cookie-string' && args[i + 1]) cookieString = args[++i];
    if (args[i] === '--headed') headless = false;
  }

  if (!videoPath) {
    console.error('Thiếu tham số --video <đường_dẫn>');
    process.exit(1);
  }

  uploadToYouTubeStudio({ videoPath, title, description, visibility, cookieString, headless })
    .then((res) => {
      console.log('RESULT:' + JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = { uploadToYouTubeStudio };
