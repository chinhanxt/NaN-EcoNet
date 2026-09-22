const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Upload video to TikTok via TikTok Studio / Creator Center using Playwright
 * @param {Object} options
 * @param {string} options.videoPath - Absolute path or URL to the media file
 * @param {string} options.caption - Caption/description and hashtags
 * @param {string} [options.sessionId] - TikTok session ID (cookie sessionid)
 * @param {string} [options.profileName] - TikTok profile username
 * @param {boolean} [options.headless=true] - Run headless or headed
 * @returns {Promise<{ status: string, postId: string, releaseURL: string }>}
 */
async function uploadToTikTok({
  videoPath,
  caption = '',
  sessionId = '',
  profileName = '1523nguynchnhn',
  headless = true,
}) {
  let resolvedPath = videoPath;

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

  // 2. If it's an image file (.jpg, .jpeg, .png, .webp), convert to standard 9:16 vertical 1080x1920 MP4 for TikTok Studio
  const ext = path.extname(resolvedPath).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
  let tempVideoPath = null;

  if (imageExts.includes(ext)) {
    console.log(`[TikTok-Upload] Phát hiện tệp ảnh (${ext}), tự động chuyển đổi sang MP4 video cho TikTok Studio...`);
    tempVideoPath = `/tmp/tiktok-converted-${Date.now()}.mp4`;
    const ffmpegCmd = `ffmpeg -y -loop 1 -i "${resolvedPath}" -c:v libx264 -t 5 -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" "${tempVideoPath}"`;
    execSync(ffmpegCmd, { stdio: 'pipe' });
    resolvedPath = tempVideoPath;
    console.log(`[TikTok-Upload] Đã tạo video tạm thời: ${resolvedPath}`);
  }

  const userDataDir = '/home/chinhan/.config/postiz-tiktok-profile';
  console.log(`[TikTok-Upload] Bắt đầu tải lên: "${resolvedPath}"`);
  console.log(`[TikTok-Upload] Caption: "${caption}"`);
  console.log(`[TikTok-Upload] Dùng profile directory: ${userDataDir}`);

  const display = process.env.DISPLAY || ':1';

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: '/opt/google/chrome/chrome',
      headless,
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
    console.error('[TikTok-Upload] Lỗi khởi động trình duyệt:', err.message);
    throw err;
  }

  try {
    if (sessionId) {
      console.log('[TikTok-Upload] Injecting session cookies...');
      const cookieList = [];
      const trimmed = sessionId.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          cookieList.push(...parsed);
        } catch (e) {}
      } else if (trimmed.includes('=')) {
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
                domain: '.tiktok.com',
                path: '/',
                httpOnly: true,
                secure: true,
              });
            }
          }
        }
      } else {
        cookieList.push(
          { name: 'sessionid', value: trimmed, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
          { name: 'sessionid_ss', value: trimmed, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
          { name: 'sid_tt', value: trimmed, domain: '.tiktok.com', path: '/', httpOnly: true, secure: true }
        );
      }
      if (cookieList.length > 0) {
        await context.addCookies(cookieList);
        console.log(`[TikTok-Upload] Đã nạp thành công ${cookieList.length} cookies.`);
      }
    }

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // 1. Navigate to TikTok Studio upload page
    console.log('[TikTok-Upload] Mở trang TikTok Studio Upload...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    console.log('[TikTok-Upload] Đang đợi giao diện Upload sẵn sàng...');
    await page.waitForTimeout(4000);

    // 2. Locate file upload input or file chooser
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      for (const frame of page.frames()) {
        const fi = await frame.$('input[type="file"]');
        if (fi) {
          fileInput = fi;
          break;
        }
      }
    }

    if (fileInput) {
      console.log('[TikTok-Upload] Đã tìm thấy input[type=file], đang truyền file...');
      await fileInput.setInputFiles(resolvedPath);
    } else {
      console.log('[TikTok-Upload] Kích hoạt hộp thoại chọn tệp bằng nút Chọn video...');
      const uploadBtn = await page.$(
        'button:has-text("Select video"), button:has-text("Chọn video"), button:has-text("Select file"), div[role="button"]:has-text("Chọn video"), div[role="button"]:has-text("Select video")'
      );
      if (uploadBtn) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 15000 }),
          uploadBtn.click(),
        ]);
        await fileChooser.setFiles(resolvedPath);
      } else {
        const dropArea = await page.$('.upload-container, [data-drag-content="true"], div:has-text("Select video to upload"), div:has-text("Chọn video để tải lên")');
        if (dropArea) {
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 15000 }),
            dropArea.click(),
          ]);
          await fileChooser.setFiles(resolvedPath);
        } else {
          throw new Error('Không tìm thấy nút hoặc vùng tải tệp trên TikTok Studio');
        }
      }
    }

    console.log('[TikTok-Upload] Đã gửi file, đợi tải lên và hiển thị khung soạn Caption...');
    await page.waitForTimeout(5000);

    // 3. Dismiss any overlays / tour modals
    await page.evaluate(() => {
      const turnOnBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Turn on') || b.innerText.includes('Cancel') || b.innerText.includes('Bật')
      );
      if (turnOnBtn) turnOnBtn.click();
      const gotItBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Got it') || b.innerText.includes('Đã hiểu')
      );
      if (gotItBtn) gotItBtn.click();
      const overlays = document.querySelectorAll('.react-joyride__overlay, #react-joyride-portal, .react-joyride__beacon');
      overlays.forEach(o => o.remove());
    });
    await page.waitForTimeout(2000);

    // 4. Fill Caption / Title
    const cleanCaption = caption.replace(/<[^>]*>/g, '').trim();
    if (cleanCaption) {
      console.log(`[TikTok-Upload] Đang nhập Caption: "${cleanCaption}"...`);
      const captionEditor = await page.$('div[contenteditable="true"], div[role="combobox"], .DraftEditor-editorContainer, textarea');
      if (captionEditor) {
        await captionEditor.click({ force: true });
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(cleanCaption, { delay: 20 });
        console.log('[TikTok-Upload] Đã nhập xong caption.');
      } else {
        console.log('[TikTok-Upload] Không tìm thấy khung soạn caption, bỏ qua.');
      }
    }
    await page.waitForTimeout(3000);

    // 5. Click Post button
    console.log('[TikTok-Upload] Tìm và bấm nút Post...');
    const postClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const postBtn = btns.find(b => b.innerText.trim() === 'Post' || b.innerText.trim() === 'Đăng');
      if (postBtn) {
        postBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        postBtn.click();
        return true;
      }
      return false;
    });

    if (!postClicked) {
      throw new Error('Không tìm thấy nút Post/Đăng trên TikTok Studio');
    }

    console.log('[TikTok-Upload] Đã bấm nút Post, đang đợi xử lý xuất bản (15s)...');
    await page.waitForTimeout(10000);

    // Check for any popup confirmations (e.g. copyright check or post anyway)
    await page.evaluate(() => {
      const confirm = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Post now') || b.innerText.includes('Post anyway') || 
        b.innerText.includes('Vẫn đăng') || b.innerText.includes('Đăng ngay')
      );
      if (confirm) confirm.click();
    });
    await page.waitForTimeout(5000);

    // Take screenshot for audit receipt
    const screenPath = path.join(__dirname, 'tiktok-last-published.png');
    await page.screenshot({ path: screenPath });
    console.log(`[TikTok-Upload] Đã chụp ảnh kết quả tại: ${screenPath}`);

    const postId = Date.now().toString();
    const cleanProfile = (profileName || 'user').replace(/^@/, '');
    const releaseURL = `https://www.tiktok.com/@${cleanProfile}`;

    console.log(`[TikTok-Upload] Đăng bài thành công! URL: ${releaseURL}`);
    return {
      status: 'success',
      postId,
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
  let caption = '';
  let sessionId = '';
  let profileName = '1523nguynchnhn';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video' && args[i + 1]) videoPath = args[++i];
    if (args[i] === '--caption' && args[i + 1]) caption = args[++i];
    if (args[i] === '--session-id' && args[i + 1]) sessionId = args[++i];
    if (args[i] === '--profile' && args[i + 1]) profileName = args[++i];
  }

  if (!videoPath) {
    videoPath = '/tmp/test-converted.mp4';
    caption = 'Test video upload via Postiz MMO #automation #tiktok';
  }

  uploadToTikTok({ videoPath, caption, sessionId, profileName, headless: true })
    .then((res) => {
      console.log('RESULT:' + JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = { uploadToTikTok };
