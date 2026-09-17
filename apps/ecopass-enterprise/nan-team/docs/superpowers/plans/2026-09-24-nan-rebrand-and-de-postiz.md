# Kế Hoạch Thực Thi: Chuyển Đổi Thương Hiệu NaN, Gỡ Bỏ Postiz & Vô Hiệu Hóa License Polotno

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện dự án `/home/chinhan/MMO/postiz` sang thương hiệu "NaN", xóa triệt để cảnh báo bản quyền Polotno ("LICENSE KEY IS MISSING"), gỡ bỏ toàn bộ module thanh toán Stripe/Billing và telemetry bên ngoài, đồng thời bảo vệ an toàn 100% các file kết nối kênh của Agent khác.

**Architecture:** Áp dụng phương pháp phẫu thuật chính xác (Surgical Extraction): Patch tại chỗ runtime Polotno và thiết lập hook tự động hóa; Rebrand toàn bộ UI/i18n sang NaN; Gỡ bỏ controller/route Billing ở cả NestJS và Next.js; Mở khóa mặc định toàn bộ quyền hạn (Unlimited Quota) trong PermissionsService; Tuyệt đối cách ly không can thiệp các file trong Blacklist của Agent kênh.

**Tech Stack:** TypeScript, Next.js 16 (App Router), NestJS, TailwindCSS, MobX / Konva (Polotno), Bash / Make.

**Spec:** [`docs/superpowers/specs/2026-09-24-nan-rebrand-and-de-postiz-design.md`](file:///home/chinhan/MMO/postiz/docs/superpowers/specs/2026-09-24-nan-rebrand-and-de-postiz-design.md)

## Global Constraints
- **Blacklist Files**: TUYỆT ĐỐI KHÔNG CHỈNH SỬA các file:
  - `libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts`
  - `apps/frontend/src/components/launches/add.provider.component.tsx`
  - `apps/backend/src/api/routes/copilot.controller.ts`
  - `apps/backend/src/services/auth/auth.middleware.ts`
  - `apps/frontend/src/app/(app)/direct-channel/`
  - `apps/frontend/src/app/(app)/direct-user/`
  - `apps/frontend/src/components/launches/channel.token.modal.tsx`
  - `libraries/helpers/src/utils/custom.fetch.func.ts`
- **Runtime Stability**: Giữ nguyên thư mục `/home/chinhan/MMO/postiz` và không làm gián đoạn PostgreSQL (5433), Redis (6380), Temporal (7233).
- **Branding**: Đổi tên hiển thị sang **`NaN`**.

---

### Task 1: Triệt tiêu vĩnh viễn cảnh báo bản quyền Polotno ("LICENSE KEY IS MISSING")

**Files:**
- Create: `scripts/patch-polotno.js`
- Modify: `package.json`
- Target: `node_modules/polotno/utils/validate-key.js`, `node_modules/polotno/polotno.bundle.js`

**Interfaces:**
- Produces: Polotno canvas editor không còn gắn cờ lỗi `bk.value = 1` hay credit `bS.value = true`.

- [ ] **Step 1: Viết script patch Polotno tự động `scripts/patch-polotno.js`**
Tạo file `scripts/patch-polotno.js` để tự động bypass logic kiểm tra license:
```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const filesToPatch = [
  path.join(rootDir, 'node_modules/polotno/utils/validate-key.js'),
  path.join(rootDir, 'node_modules/polotno/polotno.bundle.js')
];

filesToPatch.forEach((filePath) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Patch isKeyPaid and validateKey
  content = content.replace(/async function isKeyPaid\([\s\S]*?return console\.error\([\s\S]*?!0\}/g,
    'async function isKeyPaid(){ return true; }');
  content = content.replace(/export async function isKeyPaid\([\s\S]*?return console\.error\([\s\S]*?!0\}/g,
    'export async function isKeyPaid(){ return true; }');
  content = content.replace(/export async function validateKey\(e,o\)\{[\s\S]*?r\(\)\}/g,
    'export async function validateKey(){ return true; }');

  // In bundle: patch bL and bN
  content = content.replace(/async function bL\(e\)\{[\s\S]*?return console\.error\([\s\S]*?!0\}/g,
    'async function bL(e){ return !0; }');
  content = content.replace(/async function bN\(e,t\)\{[\s\S]*?bE\(\)\}/g,
    'async function bN(e,t){ return; }');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-polotno] Patched ${filePath} successfully.`);
});
```

- [ ] **Step 2: Thực thi script patch Polotno ngay lập tức**
Run: `node scripts/patch-polotno.js`
Expected: Output hiển thị `[patch-polotno] Patched ... successfully.`

- [ ] **Step 3: Gắn script patch vào hook `postinstall` của `package.json`**
Cập nhật `package.json`:
```json
"postinstall": "pnpm run prisma-generate && node scripts/patch-polotno.js"
```

- [ ] **Step 4: Commit Task 1**
```bash
git add scripts/patch-polotno.js package.json
git commit -m "fix(polotno): bypass commercial license check and watermark"
```

---

### Task 2: Rebranding giao diện người dùng sang "NaN" (Logo, Assets, Titles & i18n)

**Files:**
- Modify: `apps/frontend/src/components/new-layout/logo.tsx`
- Modify: `apps/frontend/src/components/ui/logo-text.component.tsx`
- Modify: `apps/frontend/public/logo-text.svg`
- Modify: `apps/frontend/public/postiz.svg`
- Modify: `apps/frontend/src/app/(app)/(site)/launches/page.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/agents/page.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/agents/[id]/page.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/agents/layout.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/analytics/page.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/settings/page.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/media/page.tsx`
- Modify: `apps/frontend/src/app/(app)/auth/login/page.tsx`
- Modify: `apps/frontend/src/app/(app)/auth/page.tsx`
- Modify: `libraries/react-shared-libraries/src/translation/locales/vi/translation.json`
- Modify: `libraries/react-shared-libraries/src/translation/locales/en/translation.json`

**Interfaces:**
- Produces: Mọi thành phần hiển thị nhận diện tên và biểu tượng "NaN" đồng nhất.

- [ ] **Step 1: Cập nhật text Logo trong `logo.tsx` và `logo-text.component.tsx`**
Thay thế `POST<span className="text-[#10B981]">IZ</span>` thành:
```tsx
<span className="text-[24px] font-black tracking-wider text-current font-sans uppercase">
  Na<span className="text-[#10B981]">N</span>
</span>
```

- [ ] **Step 2: Cập nhật file SVG logo và favicon**
Thay đổi nội dung văn bản trong `apps/frontend/public/logo-text.svg` và `apps/frontend/public/postiz.svg` để hiển thị biểu tượng NaN.

- [ ] **Step 3: Cập nhật Metadata HTML Title trong các route Next.js**
Đổi tiêu đề từ `Postiz ...` / `Gitroom ...` sang `NaN ...`:
- `(site)/launches/page.tsx`: title `NaN Calendar`
- `(site)/agents/page.tsx`: title `NaN Agent`
- `(site)/agents/[id]/page.tsx`: title `NaN Agent`
- `(site)/agents/layout.tsx`: title `NaN Agent`
- `(site)/analytics/page.tsx`: title `NaN Analytics`
- `(site)/settings/page.tsx`: title `NaN Settings`
- `(site)/media/page.tsx`: title `NaN Media`
- `auth/login/page.tsx`: title `NaN Login`
- `auth/page.tsx`: title `NaN Register`

- [ ] **Step 4: Cập nhật từ điển dịch thuật i18n (`vi/translation.json` và `en/translation.json`)**
Thay thế các cụm từ "Postiz" thành "NaN" trong thông báo chào mừng agent, hướng dẫn sử dụng.

- [ ] **Step 5: Commit Task 2**
```bash
git add apps/frontend/src/components/new-layout/logo.tsx apps/frontend/src/components/ui/logo-text.component.tsx apps/frontend/public/ apps/frontend/src/app/ libraries/react-shared-libraries/src/translation/
git commit -m "feat(branding): rebrand interface and metadata to NaN"
```

---

### Task 3: Bóc tách Backend Billing, Stripe & Mở khóa toàn diện (Unlimited Quota)

**Files:**
- Modify: `apps/backend/src/api/api.module.ts`
- Modify: `apps/backend/src/services/auth/permissions/permissions.service.ts`
- Modify: `apps/backend/src/services/auth/public.auth.middleware.ts`
- Delete: `apps/backend/src/api/routes/billing.controller.ts`
- Delete: `apps/backend/src/api/routes/stripe.controller.ts`
- Delete: `apps/backend/src/api/routes/payment.controller.ts`

**Interfaces:**
- Produces: API không còn route `/billing`, `/stripe`, `/payment`. Tất cả các thao tác xác thực quyền hạn luôn trả về gói đầy đủ `PRO`/`UNLIMITED`.

- [ ] **Step 1: Gỡ bỏ đăng ký BillingController, StripeController, PaymentController trong `api.module.ts`**
Loại bỏ import và gỡ khỏi mảng `authenticatedController` và mảng `controllers`.

- [ ] **Step 2: Xóa các file controller Billing, Stripe, Payment**
Run: `rm -f apps/backend/src/api/routes/billing.controller.ts apps/backend/src/api/routes/stripe.controller.ts apps/backend/src/api/routes/payment.controller.ts`

- [ ] **Step 3: Mở khóa quyền hạn toàn diện trong `permissions.service.ts`**
Cập nhật hàm `check()` và `getPackageOptions()` để luôn trả về tier `PRO` và không áp đặt bất kỳ giới hạn kênh, bài viết, webhook hay video:
```typescript
async getPackageOptions(orgId: string) {
  return {
    subscription: { subscriptionTier: 'PRO', totalChannels: 999999 },
    options: {
      channel: 999999,
      posts: 999999,
      webhooks: 999999,
      team_members: 999999,
      autoPost: true,
      ai_generation: 999999,
      clipping: 999999,
    },
  };
}
```

- [ ] **Step 4: Gỡ bỏ điều kiện chặn thuê bao trong `public.auth.middleware.ts`**
Loại bỏ đoạn code `if (!!process.env.STRIPE_SECRET_KEY && !org.subscription)` để API không bao giờ chặn người dùng.

- [ ] **Step 5: Kiểm tra build backend**
Run: `pnpm --filter ./apps/backend build`
Expected: Build thành công không có lỗi thiếu sót controller/service.

- [ ] **Step 6: Commit Task 3**
```bash
git add apps/backend/src/
git commit -m "refactor(backend): remove billing/stripe controllers and unlock unlimited quotas"
```

---

### Task 4: Dọn dẹp Frontend Navigation, Xóa Billing Route & Gỡ bỏ Telemetry

**Files:**
- Delete: `apps/frontend/src/app/(app)/(site)/billing/`
- Modify: `apps/frontend/src/components/layout/top.menu.tsx`
- Modify: `apps/frontend/src/components/new-layout/layout.component.tsx`
- Modify: `apps/frontend/src/app/(app)/layout.tsx`
- Modify: `apps/frontend/src/components/layout/settings.component.tsx`

**Interfaces:**
- Produces: Sidebar và Top bar sạch sẽ, không còn mục Billing hay Affiliate, không còn script telemetry `postiz.com`.

- [ ] **Step 1: Xóa thư mục route billing trong Frontend**
Run: `rm -rf apps/frontend/src/app/\(app\)/\(site\)/billing`

- [ ] **Step 2: Dọn dẹp menu trong `top.menu.tsx`**
Loại bỏ entry menu `/billing` và liên kết affiliate `https://affiliate.postiz.com`.

- [ ] **Step 3: Gỡ bỏ các wrapper chặn thanh toán trong `layout.component.tsx`**
Loại bỏ `CheckPayment`, `TrialTracker`, `NewSubscription`, `FirstBillingComponent`, và `ChromeExtensionComponent`.

- [ ] **Step 4: Gỡ bỏ telemetry theo dõi trong `layout.tsx`**
Xóa bỏ thẻ `<Script data-domain="postiz.com" ... />`.

- [ ] **Step 5: Mở khóa các tab Settings trong `settings.component.tsx`**
Đảm bảo các tab Teams, Webhooks, Autopost luôn mở cho người dùng truy cập.

- [ ] **Step 6: Commit Task 4**
```bash
git add apps/frontend/src/
git commit -m "refactor(frontend): remove billing routes, affiliate links and telemetry tracking"
```

---

### Task 5: Khởi động lại dịch vụ & Xác thực toàn diện (Health Check)

**Files:**
- N/A (Kiểm thử và xác nhận)

**Interfaces:**
- Produces: Toàn bộ stack hoạt động trơn tru trên thương hiệu NaN.

- [ ] **Step 1: Khởi động lại Frontend và Backend**
Run: `make restart-be && make restart-fe`
Expected: Cả Backend và Frontend compile thành công và online.

- [ ] **Step 2: Kiểm tra trạng thái HTTP endpoint bằng `make test-health`**
Run: `make test-health`
Expected:
```
✔ Backend API
✔ Worker
✔ Frontend
✔ Temporal UI
```

- [ ] **Step 3: Kiểm tra route kết nối kênh của Agent khác không bị ảnh hưởng**
Run: `curl -fsS -o /dev/null http://127.0.0.1:4200/direct-user && echo "✔ Channel direct-user online"`
Expected: HTTP 200 OK.

- [ ] **Step 4: Commit hoàn tất và cập nhật task checklist**
```bash
git status
```
