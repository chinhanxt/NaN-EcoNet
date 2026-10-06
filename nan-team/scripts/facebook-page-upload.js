const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function cleanStaleSingletonLock(userDataDir) {
  try {
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
    for (const f of lockFiles) {
      const p = path.join(userDataDir, f);
      try {
        if (fs.existsSync(p) || fs.lstatSync(p, { throwIfNoEntry: false })) {
          fs.unlinkSync(p);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

function isChromeRunningOnProfile(userDataDir) {
  try {
    const escaped = userDataDir.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
    const out = execSync(`ps -eo pid,args | grep "\\[c\\]hrome.*${escaped}" || true`, { encoding: 'utf8' }).trim();
    return !!out;
  } catch (e) {
    return false;
  }
}

async function acquireProfileLock(userDataDir, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (!isChromeRunningOnProfile(userDataDir)) {
      cleanStaleSingletonLock(userDataDir);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Force clean stale hanging Chrome processes on this profile
  try {
    console.warn('[Facebook-Upload] Quá thời gian chờ profile lock, dọn dẹp các tiến trình Chrome cũ...');
    const escaped = userDataDir.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
    execSync(`pkill -9 -f "chrome.*${escaped}" || true`);
    await new Promise((r) => setTimeout(r, 1500));
    cleanStaleSingletonLock(userDataDir);
  } catch (e) {}
  return true;
}

async function safeCloseContext(context) {
  if (!context) return;
  try {
    for (const page of context.pages()) {
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
    await Promise.race([
      context.close(),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  } catch (e) {}
}

async function closeFacebookModal(page) {
  try {
    const closeBtn = await page.$(
      'div[aria-label="Close"], div[aria-label="Đóng"], div[role="dialog"] div[role="button"][tabindex="0"]'
    );
    if (closeBtn && (await closeBtn.isVisible())) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
}

/**
 * Upload post/video/photo to Facebook Page using Playwright automation
 * @param {Object} options
 * @param {string|string[]} [options.mediaPath] - Path or URL to video/photo
 * @param {string[]} [options.mediaPaths] - Array of paths or URLs
 * @param {string} [options.message] - Post message / caption
 * @param {string} [options.firstComment] - First comment to post right after publishing
 * @param {string} [options.pageId] - Facebook Page ID
 * @param {string} [options.pageName] - Facebook Page Name
 * @param {string} [options.cookieString] - Cookie string (c_user=...; xs=...)
 * @param {boolean} [options.headless=true] - Headless mode
 * @returns {Promise<{ status: string, postId: string, releaseURL: string }>}
 */
async function uploadToFacebook({
  mediaPath = '',
  mediaPaths = [],
  message = '',
  firstComment = '',
  pageId = '',
  pageName = '',
  cookieString = '',
  headless = true,
}) {
  // Collect all media paths
  const allMedia = [
    ...(Array.isArray(mediaPaths) ? mediaPaths : [mediaPaths]),
    ...(mediaPath ? (Array.isArray(mediaPath) ? mediaPath : [mediaPath]) : []),
  ].filter(Boolean);

  // 0. Auto-load cookies from Postiz database if not passed explicitly
  if (!cookieString) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const integration = await prisma.integration.findFirst({
        where: { providerIdentifier: 'facebook', deletedAt: null },
      });
      if (integration?.token && (integration.token.includes('=') || integration.token.includes(';'))) {
        cookieString = integration.token;
      }
      if (!pageId && integration?.internalId) {
        pageId = integration.internalId;
      }
      if (!pageName && integration?.name) {
        pageName = integration.name;
      }
      await prisma.$disconnect();
    } catch (e) {}
  }

  // 1. Resolve HTTP URLs to local disk files if inside uploads directory
  const uploadDir = process.env.UPLOAD_DIRECTORY || '/home/chinhan/.local/share/postiz-dev/uploads';
  const resolvedPaths = [];

  for (const item of allMedia) {
    let p = item;
    if (p.startsWith('http://') || p.startsWith('https://')) {
      if (p.includes('/uploads/')) {
        const rel = p.substring(p.indexOf('/uploads/') + '/uploads/'.length);
        const candidate = path.join(uploadDir, rel);
        if (fs.existsSync(candidate)) {
          p = candidate;
        }
      }
    }
    if (fs.existsSync(p)) {
      resolvedPaths.push(p);
    } else {
      console.warn(`[Facebook-Upload] Tệp không tồn tại: ${p}`);
    }
  }

  const userDataDir = '/home/chinhan/.config/postiz-fb-profile';
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Acquire lock to avoid ProcessSingleton clash
  await acquireProfileLock(userDataDir);

  console.log(`[Facebook-Upload] Bắt đầu đăng bài Facebook Page: "${pageName || pageId}"`);
  console.log(`[Facebook-Upload] Nội dung: "${message.slice(0, 100)}..."`);
  if (resolvedPaths.length > 0) {
    console.log(`[Facebook-Upload] Danh sách tệp phương tiện (${resolvedPaths.length}):`, resolvedPaths);
  }
  if (firstComment) {
    console.log(`[Facebook-Upload] Kèm bình luận đầu tiên: "${firstComment.slice(0, 50)}..."`);
  }

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
    console.error('[Facebook-Upload] Lỗi khởi động trình duyệt:', err.message);
    throw err;
  }

  try {
    // Inject cookies if available
    if (cookieString) {
      console.log('[Facebook-Upload] Nạp Facebook cookies vào trình duyệt...');
      const trimmed = cookieString.trim();
      const cookiesToAdd = [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          cookiesToAdd.push(
            ...parsed.map((c) => ({
              name: c.name,
              value: c.value,
              domain: c.domain || '.facebook.com',
              path: c.path || '/',
              secure: true,
            }))
          );
        } catch (e) {}
      } else if (trimmed.includes('=')) {
        const pairs = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
        for (const pair of pairs) {
          const idx = pair.indexOf('=');
          if (idx > -1) {
            const name = pair.substring(0, idx).trim();
            const value = pair.substring(idx + 1).trim();
            if (name && value) {
              cookiesToAdd.push({
                name,
                value,
                domain: '.facebook.com',
                path: '/',
                secure: true,
              });
            }
          }
        }
      }
      if (cookiesToAdd.length > 0) {
        await context.addCookies(cookiesToAdd).catch((err) => {
          console.warn('[Facebook-Upload] Cảnh báo addCookies:', err.message);
        });
        console.log(`[Facebook-Upload] Đã nạp thành công ${cookiesToAdd.length} cookies.`);
      }
    }

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Strategy 1: Meta Business Suite Composer
    console.log('[Facebook-Upload] Đang mở Meta Business Suite Composer...');
    const composerUrl = 'https://business.facebook.com/latest/composer';

    await page.goto(composerUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    await page.waitForTimeout(5000);

    let currentUrl = page.url();
    let isMetaComposer = currentUrl.includes('business.facebook.com') && currentUrl.includes('composer');

    if (!isMetaComposer) {
      console.log('[Facebook-Upload] Chưa vào được Meta Business Suite Composer. Thử điều hướng trang trực tiếp...');
      const directUrl = pageId ? `https://www.facebook.com/${pageId}` : 'https://www.facebook.com';
      await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(4000);
      currentUrl = page.url();

      // Trigger "What's on your mind?" if on direct page
      const triggerBtn = await page.$(
        'div[role="button"]:has-text("What\'s on your mind?"), div[role="button"]:has-text("Bạn đang nghĩ gì?"), div[role="button"]:has-text("Tạo bài viết"), div[role="button"]:has-text("Create post")'
      );
      if (triggerBtn) {
        console.log('[Facebook-Upload] Bấm mở khung tạo bài viết trên Facebook Page...');
        await triggerBtn.click().catch(() => {});
        await page.waitForTimeout(3000);
      }
    }

    // Check if session is logged out
    const isLoggedOut = await page.evaluate(() => {
      const hasLoginForm = !!document.querySelector('input[type="password"]');
      const text = document.body ? document.body.innerText : '';
      return hasLoginForm || text.includes('Log in to continue') || text.includes('Đăng nhập để tiếp tục') || text.includes('See more from');
    });

    if (isLoggedOut && !isMetaComposer) {
      throw new Error('Phiên đăng nhập Facebook đã hết hạn. Vui lòng đăng nhập lại tài khoản trên trình duyệt hoặc cập nhật Cookie mới.');
    }

    // 1. Đính kèm phương tiện (ảnh / video)
    if (resolvedPaths.length > 0) {
      console.log(`[Facebook-Upload] Đang đính kèm ${resolvedPaths.length} tệp phương tiện...`);
      try {
        const addBtn = await page.$(
          'div[role="button"]:has-text("Add photo/video"), button:has-text("Add photo/video"), ' +
          'div[role="button"]:has-text("Add photo"), button:has-text("Add photo"), ' +
          'div[role="button"]:has-text("Add video"), button:has-text("Add video"), ' +
          'div[role="button"]:has-text("Thêm ảnh"), button:has-text("Thêm ảnh"), ' +
          'div[role="button"]:has-text("Thêm video"), button:has-text("Thêm video"), ' +
          'div[role="button"]:has-text("Ảnh/video"), button:has-text("Ảnh/video"), ' +
          'div[role="button"]:has-text("Photo/video"), button:has-text("Photo/video"), ' +
          'div[aria-label="Photo/video"], div[aria-label="Ảnh/video"], div[aria-label*="photo/video" i]'
        );

        if (addBtn) {
          console.log('[Facebook-Upload] Tìm thấy nút thêm media, đang chọn tệp qua filechooser...');
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 15000 }),
            addBtn.click(),
          ]);
          await fileChooser.setFiles(resolvedPaths);
          console.log('[Facebook-Upload] Đã nạp tệp thành công vào filechooser:', resolvedPaths);
        } else {
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.setInputFiles(resolvedPaths);
            console.log('[Facebook-Upload] Đã chọn tệp qua input[type="file"]:', resolvedPaths);
          } else {
            throw new Error('Không tìm thấy nút thêm ảnh/video (Photo/video) trên trang Facebook');
          }
        }

        console.log('[Facebook-Upload] Đang chờ ảnh/video xử lý tải lên (6s)...');
        await page.waitForTimeout(6000);
      } catch (fileErr) {
        // Không đăng bài chỉ có chữ khi người dùng đã chọn ảnh/video.
        throw new Error(`Đính kèm ảnh/video thất bại: ${fileErr.message}`);
      }
    }

    // 2. Điền nội dung văn bản (message)
    if (message) {
      console.log('[Facebook-Upload] Đang điền nội dung bài viết...');
      try {
        const textBox = await page.waitForSelector(
          'div[contenteditable="true"], div[role="combobox"][contenteditable="true"], div[role="textbox"], textarea',
          { timeout: 20000 }
        ).catch(() => null);
        if (textBox) {
          await textBox.click();
          await page.waitForTimeout(300);
          await page.keyboard.insertText(message).catch(async () => {
            await textBox.fill(message).catch(async () => {
              await page.keyboard.type(message);
            });
          });
          console.log('[Facebook-Upload] Đã điền xong nội dung văn bản!');
          await page.waitForTimeout(2000);
        } else {
          console.warn('[Facebook-Upload] Không tìm thấy ô nhập nội dung văn bản!');
        }
      } catch (textErr) {
        console.warn('[Facebook-Upload] Cảnh báo điền text:', textErr.message);
      }
    }

    await page.waitForTimeout(2000);

    // 3. Tìm nút Publish / Đăng sẵn sàng
    console.log('[Facebook-Upload] Đang tìm nút Publish / Đăng...');
    const publishSelectors = [
      'div[role="button"]:has-text("Publish"):not([aria-disabled="true"])',
      'button:has-text("Publish"):not([disabled])',
      'div[role="button"]:has-text("Đăng"):not([aria-disabled="true"])',
      'button:has-text("Đăng"):not([disabled])',
      'div[aria-label="Publish"]:not([aria-disabled="true"])',
      'div[aria-label="Đăng"]:not([aria-disabled="true"])',
      'div[aria-label="Post"]:not([aria-disabled="true"])',
    ];

    let publishBtn = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      for (const sel of publishSelectors) {
        const btn = await page.$(sel);
        if (btn && (await btn.isVisible())) {
          const isBtnDisabled =
            (await btn.getAttribute('aria-disabled')) === 'true' ||
            (await btn.getAttribute('disabled')) !== null;
          if (!isBtnDisabled) {
            publishBtn = btn;
            console.log(`[Facebook-Upload] Đã tìm thấy nút đăng sẵn sàng (${sel})`);
            break;
          }
        }
      }
      if (publishBtn) break;
      await page.waitForTimeout(1000);
    }

    if (publishBtn) {
      console.log('[Facebook-Upload] Đang bấm nút Publish...');
      await publishBtn.click();
    } else {
      console.warn('[Facebook-Upload] Nút đăng chưa sẵn sàng, thử bấm fallback...');
      const fallbackBtn = await page.$(
        'div[role="button"]:has-text("Publish"), button:has-text("Publish"), div[role="button"]:has-text("Đăng"), button:has-text("Đăng")'
      );
      if (fallbackBtn) {
        await fallbackBtn.click();
      }
    }

    console.log('[Facebook-Upload] Đang chờ hoàn tất đăng bài (12s)...');
    await page.waitForTimeout(12000);

    // Đóng hộp thoại "Maybe later" nếu có
    try {
      const maybeLater = await page.$(
        'button:has-text("Maybe later"), button:has-text("Để sau"), div[role="button"]:has-text("Maybe later"), div[role="button"]:has-text("Để sau")'
      );
      if (maybeLater) {
        await maybeLater.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // 4. Nếu có bình luận đầu tiên (firstComment), thực hiện bình luận ngay trong cùng phiên trình duyệt!
    if (firstComment) {
      console.log(`[Facebook-Upload] Đang đăng bình luận đầu tiên: "${firstComment}"...`);
      try {
        const directUrl = pageId ? `https://www.facebook.com/${pageId}` : 'https://www.facebook.com';
        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(4000);

        await closeFacebookModal(page);

        await page.evaluate(() => window.scrollBy(0, 500)).catch(() => {});
        await page.waitForTimeout(2000);

        const commentSelectors = [
          'div[aria-label*="Comment as"]',
          'div[aria-label*="Bình luận dưới tên"]',
          'div[aria-label*="Write a comment"]',
          'div[aria-label*="Viết bình luận"]',
          'div[aria-label*="Comment"][role="textbox"]',
          'div[aria-label*="Bình luận"][role="textbox"]',
          'div[role="textbox"][contenteditable="true"]',
        ];

        let commentInput = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          for (const sel of commentSelectors) {
            const el = await page.$(sel);
            if (el) {
              await el.scrollIntoViewIfNeeded().catch(() => {});
              await page.waitForTimeout(500);
              commentInput = el;
              break;
            }
          }
          if (commentInput) break;

          const commentActionBtn = await page.$(
            'div[role="button"]:has-text("Comment"), div[role="button"]:has-text("Bình luận"), div[aria-label*="Leave a comment"], div[aria-label*="Viết bình luận"]'
          );
          if (commentActionBtn) {
            await commentActionBtn.scrollIntoViewIfNeeded().catch(() => {});
            await commentActionBtn.click().catch(() => {});
            await page.waitForTimeout(1000);
          } else {
            await page.evaluate(() => window.scrollBy(0, 400)).catch(() => {});
            await page.waitForTimeout(1500);
          }
        }

        if (commentInput) {
          await commentInput.click();
          await page.waitForTimeout(400);
          await page.keyboard.insertText(firstComment);
          await page.waitForTimeout(800);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(4000);
          console.log('[Facebook-Upload] Bình luận đầu tiên đã được gửi thành công!');
        } else {
          console.warn('[Facebook-Upload] Không tìm thấy ô nhập bình luận đầu tiên!');
        }
      } catch (commentErr) {
        console.warn('[Facebook-Upload] Cảnh báo gửi bình luận đầu tiên:', commentErr.message);
      }
    }

    const postId = `fb_post_${Date.now()}`;
    const releaseURL = pageId ? `https://www.facebook.com/${pageId}` : 'https://www.facebook.com';

    console.log('[Facebook-Upload] Đăng bài thành công!');
    console.log(`[Facebook-Upload] Post ID: ${postId}`);
    console.log(`[Facebook-Upload] URL: ${releaseURL}`);

    const result = {
      status: 'success',
      postId,
      releaseURL,
    };

    console.log('__RESULT__' + JSON.stringify(result));
    await safeCloseContext(context);
    return result;
  } catch (err) {
    try {
      await safeCloseContext(context);
    } catch (e) {}
    console.error('[Facebook-Upload] Thất bại:', err.message);
    throw err;
  }
}

/**
 * Post comment to Facebook Page using Playwright
 * @param {Object} options
 * @param {string} options.pageId
 * @param {string} options.message
 * @param {string} [options.cookieString]
 * @param {boolean} [options.headless=true]
 */
async function postCommentToFacebook({
  pageId = '',
  message = '',
  cookieString = '',
  headless = true,
}) {
  if (!message) {
    return { status: 'skipped', message: 'No comment message' };
  }

  if (!cookieString) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const integration = await prisma.integration.findFirst({
        where: { providerIdentifier: 'facebook', deletedAt: null },
      });
      if (integration?.token && (integration.token.includes('=') || integration.token.includes(';'))) {
        cookieString = integration.token;
      }
      if (!pageId && integration?.internalId) {
        pageId = integration.internalId;
      }
      await prisma.$disconnect();
    } catch (e) {}
  }

  const userDataDir = '/home/chinhan/.config/postiz-fb-profile';
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Acquire lock to avoid ProcessSingleton clash
  await acquireProfileLock(userDataDir);

  console.log(`[Facebook-Comment] Bắt đầu đăng bình luận lên Page "${pageId}": "${message}"`);
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
    console.error('[Facebook-Comment] Lỗi mở trình duyệt:', err.message);
    throw err;
  }

  try {
    if (cookieString) {
      const trimmed = cookieString.trim();
      const cookiesToAdd = [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          cookiesToAdd.push(
            ...parsed.map((c) => ({
              name: c.name,
              value: c.value,
              domain: c.domain || '.facebook.com',
              path: c.path || '/',
              secure: true,
            }))
          );
        } catch (e) {}
      } else if (trimmed.includes('=')) {
        const pairs = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
        for (const pair of pairs) {
          const idx = pair.indexOf('=');
          if (idx > -1) {
            const name = pair.substring(0, idx).trim();
            const value = pair.substring(idx + 1).trim();
            if (name && value) {
              cookiesToAdd.push({
                name,
                value,
                domain: '.facebook.com',
                path: '/',
                secure: true,
              });
            }
          }
        }
      }
      if (cookiesToAdd.length > 0) {
        await context.addCookies(cookiesToAdd).catch(() => {});
      }
    }

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    const targetUrl = pageId ? `https://www.facebook.com/${pageId}` : 'https://www.facebook.com';
    console.log(`[Facebook-Comment] Điều hướng tới ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);

    await closeFacebookModal(page);

    await page.evaluate(() => window.scrollBy(0, 500)).catch(() => {});
    await page.waitForTimeout(2000);

    const commentSelectors = [
      'div[aria-label*="Comment as"]',
      'div[aria-label*="Bình luận dưới tên"]',
      'div[aria-label*="Write a comment"]',
      'div[aria-label*="Viết bình luận"]',
      'div[aria-label*="Comment"][role="textbox"]',
      'div[aria-label*="Bình luận"][role="textbox"]',
      'div[role="textbox"][contenteditable="true"]',
    ];

    let commentInput = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      for (const sel of commentSelectors) {
        const el = await page.$(sel);
        if (el) {
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(500);
          commentInput = el;
          break;
        }
      }
      if (commentInput) break;

      const commentActionBtn = await page.$(
        'div[role="button"]:has-text("Comment"), div[role="button"]:has-text("Bình luận"), div[aria-label*="Leave a comment"], div[aria-label*="Viết bình luận"]'
      );
      if (commentActionBtn) {
        await commentActionBtn.scrollIntoViewIfNeeded().catch(() => {});
        await commentActionBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      } else {
        await page.evaluate(() => window.scrollBy(0, 400)).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    if (commentInput) {
      console.log('[Facebook-Comment] Đã tìm thấy ô nhập bình luận. Đang điền...');
      await commentInput.click();
      await page.waitForTimeout(400);
      await page.keyboard.insertText(message);
      await page.waitForTimeout(800);
      console.log('[Facebook-Comment] Đang nhấn Enter gửi bình luận...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      console.log('[Facebook-Comment] Bình luận đã được gửi!');
    } else {
      console.warn('[Facebook-Comment] Không tìm thấy ô nhập bình luận!');
    }

    const postId = `fb_cmt_${Date.now()}`;
    const result = {
      status: 'success',
      postId,
      releaseURL: targetUrl,
    };

    console.log('__RESULT__' + JSON.stringify(result));
    await safeCloseContext(context);
    return result;
  } catch (err) {
    try {
      await safeCloseContext(context);
    } catch (e) {}
    console.error('[Facebook-Comment] Lỗi:', err.message);
    throw err;
  }
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  let mode = 'upload';
  const mediaPaths = [];
  let message = '';
  let firstComment = '';
  let pageId = '';
  let pageName = '';
  let cookieString = '';
  let headless = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode') {
      mode = args[++i];
    } else if (args[i] === '--media' || args[i] === '--video' || args[i] === '--photo') {
      mediaPaths.push(args[++i]);
    } else if (args[i] === '--message' || args[i] === '--caption') {
      message = args[++i];
    } else if (args[i] === '--first-comment' || args[i] === '--comment') {
      firstComment = args[++i];
    } else if (args[i] === '--page-id') {
      pageId = args[++i];
    } else if (args[i] === '--page-name') {
      pageName = args[++i];
    } else if (args[i] === '--cookies') {
      cookieString = args[++i];
    } else if (args[i] === '--headed') {
      headless = false;
    }
  }

  const runner = mode === 'comment'
    ? postCommentToFacebook({ pageId, message: message || firstComment, cookieString, headless })
    : uploadToFacebook({ mediaPaths, message, firstComment, pageId, pageName, cookieString, headless });

  runner
    .then((res) => {
      console.log('HOÀN TẤT:', JSON.stringify(res));
      setTimeout(() => process.exit(0), 500);
    })
    .catch((err) => {
      console.error('LỖI:', err.message);
      setTimeout(() => process.exit(1), 500);
    });
}

module.exports = { uploadToFacebook, postCommentToFacebook };
