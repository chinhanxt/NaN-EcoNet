const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function autoFetchFacebookToken(targetPageName = 'Hot nhất hôm nay', targetPageId = '1362072293650275') {
  console.log(`[Auto-Token] Đang khởi động Google Chrome cho trang: "${targetPageName}" (ID: ${targetPageId})...`);

  const userDataDir = '/home/chinhan/.config/postiz-fb-playwright';
  const display = process.env.DISPLAY || ':1';

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: '/opt/google/chrome/chrome',
      headless: false,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
      ],
      env: {
        ...process.env,
        DISPLAY: display,
      },
      viewport: null,
    });
  } catch (err) {
    console.error('[Auto-Token] Không thể mở trình duyệt:', err.message);
    throw err;
  }

  const capturedTokens = new Set();

  function attachListeners(p) {
    p.on('request', (req) => {
      try {
        const url = req.url();
        const match = url.match(/access_token=(EAA[a-zA-Z0-9]+)/);
        if (match && match[1]) {
          capturedTokens.add(match[1]);
        }
      } catch (e) {}
    });

    p.on('response', async (res) => {
      try {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('application/json') || ct.includes('text/javascript')) {
          const text = await res.text();
          const matches = text.matchAll(/EAA[a-zA-Z0-9]{40,}/g);
          for (const m of matches) {
            capturedTokens.add(m[0]);
          }
        }
      } catch (e) {}
    });
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  attachListeners(page);

  context.on('page', (popup) => {
    console.log('[Auto-Token] Cửa sổ popup mới được mở:', popup.url());
    attachListeners(popup);

    // Tự động nhấn "Tiếp tục" / "Tiếp tục dưới tên" / "Continue" trên popup nếu có
    popup.on('load', async () => {
      try {
        await popup.waitForTimeout(1000);
        const confirmBtn = await popup.$(
          'button:has-text("Tiếp tục"), button:has-text("Continue"), div[role="button"]:has-text("Tiếp tục"), div[role="button"]:has-text("Continue")'
        );
        if (confirmBtn && (await confirmBtn.isVisible())) {
          console.log('[Auto-Token] Tự động nhấn xác nhận trên popup OAuth...');
          await confirmBtn.click();
        }
      } catch (e) {}
    });
  });

  console.log('[Auto-Token] Đang truy cập Graph API Explorer: https://developers.facebook.com/tools/explorer/ ...');
  await page.goto('https://developers.facebook.com/tools/explorer/', {
    timeout: 60000,
    waitUntil: 'domcontentloaded',
  });

  console.log('[Auto-Token] Đang chờ xác định Token trên trang...');
  console.log('[Auto-Token] (Nếu chưa đăng nhập, vui lòng đăng nhập tài khoản Facebook trên cửa sổ Chrome vừa mở)');

  let validPageToken = null;
  const startTime = Date.now();
  const maxWaitMs = 180000; // Đợi tối đa 3 phút để người dùng đăng nhập nếu cần

  while (Date.now() - startTime < maxWaitMs) {
    const currentUrl = page.url();

    // Nếu đã đăng nhập xong mà URL chuyển về facebook.com / business.facebook.com khác ngoài explorer
    if (
      !currentUrl.includes('/tools/explorer') &&
      !currentUrl.includes('/login') &&
      !currentUrl.includes('loginpage') &&
      (currentUrl.includes('facebook.com') || currentUrl.includes('developers.facebook.com'))
    ) {
      console.log('[Auto-Token] Đã đăng nhập xong, đang chuyển hướng vào Graph API Explorer...');
      await page.goto('https://developers.facebook.com/tools/explorer/', {
        timeout: 60000,
        waitUntil: 'domcontentloaded',
      }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 1. Kiểm tra các token đã bắt được từ network
    for (const token of capturedTokens) {
      const resolved = await resolvePageToken(token, targetPageId, targetPageName);
      if (resolved) {
        validPageToken = resolved;
        break;
      }
    }
    if (validPageToken) break;

    // 2. Kiểm tra các input / textarea trên trang
    try {
      const pageTokens = await page.evaluate(() => {
        const found = [];
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        for (const el of inputs) {
          const val = el.value || '';
          if (val.startsWith('EAA') && val.length > 50) {
            found.push(val);
          }
        }
        // Kiểm tra innerText của các block pre/code/span
        const codes = Array.from(document.querySelectorAll('pre, code, span, div'));
        for (const el of codes) {
          const text = el.innerText || '';
          if (text.startsWith('EAA') && text.length > 50 && text.length < 500) {
            found.push(text.trim());
          }
        }
        return found;
      });

      for (const t of pageTokens) {
        capturedTokens.add(t);
        const resolved = await resolvePageToken(t, targetPageId, targetPageName);
        if (resolved) {
          validPageToken = resolved;
          break;
        }
      }
      if (validPageToken) break;
    } catch (e) {}

    // 3. Tự động tương tác với giao diện nếu đang ở Graph Explorer
    try {
      if (currentUrl.includes('developers.facebook.com/tools/explorer')) {
        // Thử tìm nút Generate Access Token
        const genBtn = await page.$(
          'button:has-text("Generate Access Token"), button:has-text("Tạo mã truy cập"), button:has-text("Lấy mã truy cập"), div[role="button"]:has-text("Generate Access Token")'
        );
        if (genBtn && (await genBtn.isVisible())) {
          if (capturedTokens.size === 0) {
            console.log('[Auto-Token] Đang click "Generate Access Token"...');
            await genBtn.click().catch(() => {});
          }
        }

        // Kiểm tra popup permission nếu có dialog ngay trong trang
        const permBtn = await page.$(
          'button:has-text("Tiếp tục"), button:has-text("Continue"), div[role="button"]:has-text("Tiếp tục")'
        );
        if (permBtn && (await permBtn.isVisible())) {
          await permBtn.click().catch(() => {});
        }
      }
    } catch (e) {}

    await page.waitForTimeout(2000);
  }

  // Đóng trình duyệt sau khi hoàn thành
  try {
    await context.close();
  } catch (e) {}

  if (!validPageToken) {
    throw new Error(`Hết thời gian chờ hoặc không tìm thấy Page Token hợp lệ cho trang "${targetPageName}"`);
  }

  console.log(`[Auto-Token] Đã lấy thành công Token cho trang "${targetPageName}"!`);
  return validPageToken;
}

// Hàm kiểm tra xem token là Page Token hay User Token, và tự chuyển đổi sang Page Token
async function resolvePageToken(token, targetPageId, targetPageName) {
  if (!token || !token.startsWith('EAA') || token.length < 50) return null;

  try {
    // 1. Kiểm tra xem token này có phải là Page Token trực tiếp của đúng page không
    const meRes = await fetch(`https://graph.facebook.com/v25.0/me?fields=id,name&access_token=${token}`);
    const meData = await meRes.json();

    const isMatchMe =
      (targetPageId && meData?.id === targetPageId) ||
      (targetPageName && meData?.name?.toLowerCase().includes(targetPageName.toLowerCase()));

    if (isMatchMe && meData?.id) {
      console.log(`[Auto-Token] Phát hiện đúng Page Token trực tiếp của: ${meData.name} (${meData.id})`);
      return {
        token,
        pageId: meData.id,
        pageName: meData.name,
      };
    }

    // 2. Nếu là User Token, lấy danh sách Page của user qua /me/accounts
    const accountsRes = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&access_token=${token}`);
    const accountsData = await accountsRes.json();

    if (Array.isArray(accountsData?.data) && accountsData.data.length > 0) {
      console.log(`[Auto-Token] Tìm thấy ${accountsData.data.length} trang từ User Token:`);
      for (const p of accountsData.data) {
        console.log(`  - ${p.name} (ID: ${p.id})`);
      }

      for (const p of accountsData.data) {
        const isMatch =
          (targetPageId && p.id === targetPageId) ||
          (targetPageName && p.name?.toLowerCase().includes(targetPageName.toLowerCase())) ||
          !targetPageId;

        if (isMatch && p.access_token) {
          console.log(`[Auto-Token] Trích xuất thành công Page Token cho trang "${p.name}" (${p.id})!`);
          return {
            token: p.access_token,
            pageId: p.id,
            pageName: p.name,
          };
        }
      }
    }
  } catch (err) {}

  return null;
}

// Nếu chạy trực tiếp từ CLI
if (require.main === module) {
  (async () => {
    try {
      const pageNameArg = process.argv[2] || 'Hot nhất hôm nay';
      const pageIdArg = process.argv[3] || '1362072293650275';
      const integrationIdArg = process.argv[4] || '';

      const result = await autoFetchFacebookToken(pageNameArg, pageIdArg);
      console.log('\n=============================================');
      console.log('KẾT QUẢ TOKEN LẤY ĐƯỢC:');
      console.log('Trang:', result.pageName, '(', result.pageId, ')');
      console.log('Token:', result.token);
      console.log('=============================================\n');

      // Tự động cập nhật vào Database cho integration Facebook
      const fbIntegration = await prisma.integration.findFirst({
        where: {
          ...(integrationIdArg ? { id: integrationIdArg } : { providerIdentifier: 'facebook' }),
          deletedAt: null,
        },
      });

      if (fbIntegration) {
        await prisma.integration.update({
          where: { id: fbIntegration.id },
          data: {
            token: result.token,
            internalId: result.pageId || fbIntegration.internalId,
            rootInternalId: result.pageId || fbIntegration.rootInternalId,
            name: result.pageName || fbIntegration.name,
            disabled: false,
            refreshNeeded: false,
            updatedAt: new Date(),
          },
        });
        console.log(`[Database] Đã tự động cập nhật token vào DB cho kênh "${fbIntegration.name}" (${fbIntegration.id})!`);
      }

      console.log('__RESULT__' + JSON.stringify(result));
      await prisma.$disconnect();
      process.exit(0);
    } catch (e) {
      console.error('Lỗi:', e.message);
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
}

module.exports = { autoFetchFacebookToken, resolvePageToken };
