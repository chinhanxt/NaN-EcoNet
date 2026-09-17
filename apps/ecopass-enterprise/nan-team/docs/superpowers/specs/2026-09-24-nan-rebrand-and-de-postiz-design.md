# Thiết Kế Hệ Thống: Chuyển Đổi Thương Hiệu NaN, Loại Bỏ Postiz & Vô Hiệu Hóa Cảnh Báo Bản Quyền

- **Dự án**: NaN Platform (tiền thân Postiz/Gitroom)
- **Đường dẫn**: `/home/chinhan/MMO/postiz`
- **Ngày lập**: 2026-09-24
- **Trạng thái**: Đã phê duyệt (Approved)

---

## 1. Bối cảnh & Mục tiêu

Dự án hiện tại là bản fork từ Postiz/Gitroom được đặt tại `/home/chinhan/MMO/postiz`.
Hiện tại, một Agent khác đang song song thực hiện công việc kết nối các kênh mạng xã hội (Facebook, TikTok, v.v.).
Mục tiêu của tài liệu thiết kế này là:
1. **Rebranding toàn diện sang "NaN"**: Đổi toàn bộ logo, biểu tượng, nhận diện thương hiệu, metadata và văn bản hiển thị từ Postiz sang NaN.
2. **Triệt tiêu cảnh báo bản quyền (License Key Missing & Watermark)**: Vô hiệu hóa vĩnh viễn banner cảnh báo đỏ `LICENSE KEY IS MISSING` và liên kết `polotno.com/contact` trên trình biên tập ảnh Polotno.
3. **Bóc tách triệt để Cloud Bloatware (Billing / Stripe / Marketplace)**: Gỡ bỏ toàn bộ controller, route, menu UI liên quan đến thanh toán thuê bao, Stripe, và link affiliate Postiz; mở khóa toàn bộ tính năng và quyền hạn (unlimited quota) cho người dùng.
4. **Bảo vệ tuyệt đối tiến trình làm việc của Agent kết nối kênh**: Thiết lập ranh giới an toàn (Safety Envelope), tuyệt đối không gây xung đột mã nguồn hoặc làm gián đoạn các dịch vụ đang chạy.

---

## 2. Kiến trúc & Các thành phần thay đổi

### 2.1. Nhận diện thương hiệu NaN & Triệt tiêu License (Frontend)
- **Logo & Thương hiệu**:
  - `apps/frontend/src/components/new-layout/logo.tsx`: Cập nhật text hiển thị thành **`NaN`**, giữ phong cách Emerald Green hiện đại.
  - `apps/frontend/src/components/ui/logo-text.component.tsx`: Đồng bộ text logo sang **`NaN`**.
  - `apps/frontend/public/`: Thay thế các asset `postiz.svg`, `logo-text.svg`, `favicon.png`, `postiz-fav.png` bằng biểu tượng NaN.
  - Cập nhật HTML Titles trong `apps/frontend/src/app/(app)/`: Đổi các tiền tố `Postiz ...` thành `NaN ...`.
  - Từ điển i18n (`vi/translation.json`, `en/translation.json`): Thay thế tất cả từ khóa "Postiz" thành "NaN".
- **Bypass License Polotno**:
  - Vô hiệu hóa logic kiểm tra key trong `node_modules/polotno/utils/validate-key.js` và `node_modules/polotno/polotno.bundle.js`:
    - `isKeyPaid()` luôn trả về `true` và kích hoạt đầy đủ các cờ tính năng (`remove_background_enabled = true`).
    - Cờ cảnh báo `bk.value` giữ nguyên bằng `0` (không bao giờ vẽ banner đỏ `LICENSE KEY IS MISSING`).
    - Cờ bản quyền `bS.value` giữ nguyên bằng `false` (không vẽ watermark "Powered by polotno.com").
  - Tạo script `scripts/patch-polotno.js` và đăng ký trong hook `postinstall` của `package.json` để duy trì bản patch bền vững.

### 2.2. Gỡ bỏ Billing, Stripe & Cloud Bloatware (Backend & Frontend)
- **Backend (NestJS)**:
  - `apps/backend/src/api/api.module.ts`: Gỡ bỏ đăng ký `BillingController`, `StripeController`, `PaymentController`.
  - Xóa các file:
    - `apps/backend/src/api/routes/billing.controller.ts`
    - `apps/backend/src/api/routes/stripe.controller.ts`
    - `apps/backend/src/api/routes/payment.controller.ts`
  - `apps/backend/src/services/auth/permissions/permissions.service.ts`: Cấu hình cấp quyền mặc định là gói cao nhất (UNLIMITED / PRO) mà không phụ thuộc vào trạng thái thuê bao, cho phép số kênh, bài đăng, webhook, AI generation không giới hạn.
  - `apps/backend/src/services/auth/public.auth.middleware.ts`: Gỡ bỏ kiểm tra `STRIPE_SECRET_KEY` và `org.subscription`.
- **Frontend (Next.js)**:
  - Xóa thư mục route `apps/frontend/src/app/(app)/(site)/billing/`.
  - `apps/frontend/src/components/layout/top.menu.tsx`: Gỡ bỏ mục menu `/billing` và link affiliate `affiliate.postiz.com`.
  - `apps/frontend/src/components/new-layout/layout.component.tsx`: Gỡ bỏ `CheckPayment`, `TrialTracker`, `NewSubscription`, `FirstBillingComponent`, `ChromeExtensionComponent`.
  - `apps/frontend/src/app/(app)/layout.tsx`: Gỡ bỏ script telemetry `data-domain="postiz.com"`.
  - `apps/frontend/src/components/layout/settings.component.tsx`: Mở khóa tất cả các tab (Teams, Webhooks, Autopost) mà không yêu cầu tier thuê bao.

---

## 3. Ranh giới an toàn (Safety Envelope)

Để đảm bảo không ảnh hưởng đến Agent đang thực hiện kết nối kênh:
- **Tuyệt đối không can thiệp vào các file sau**:
  1. `libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts`
  2. `apps/frontend/src/components/launches/add.provider.component.tsx`
  3. `apps/backend/src/api/routes/copilot.controller.ts`
  4. `apps/backend/src/services/auth/auth.middleware.ts`
  5. `apps/frontend/src/app/(app)/direct-channel/`
  6. `apps/frontend/src/app/(app)/direct-user/`
  7. `apps/frontend/src/components/launches/channel.token.modal.tsx`
  8. `libraries/helpers/src/utils/custom.fetch.func.ts`
- **Môi trường vận hành**:
  - Không thay đổi cổng hoặc khởi động lại các dịch vụ nền tảng: PostgreSQL (5433), Redis (6380), Temporal (7233/8233).
  - Không di chuyển thư mục gốc `/home/chinhan/MMO/postiz`.

---

## 4. Kế hoạch kiểm thử & Xác thực (Verification)

1. **Kiểm tra License Polotno**: Mở trình biên tập ảnh, xác nhận không còn bất kỳ dấu vết nào của `LICENSE KEY IS MISSING`.
2. **Kiểm tra Rebrand NaN**: Xác nhận logo "NaN", tiêu đề trang và giao diện người dùng hiển thị nhất quán.
3. **Kiểm tra Gỡ bỏ Billing**: Xác nhận menu và routing không còn vết tích của Billing/Stripe, quyền hạn hệ thống full không hạn ngạch.
4. **Kiểm tra Sức khỏe Hệ thống (Health Check)**: Chạy `make test-health` để xác thực toàn bộ các dịch vụ Backend API, Worker, Frontend, Temporal UI đều hoạt động bình thường.
