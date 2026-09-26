# Kế Hoạch Thực Thi: Quy Trình Xét Duyệt Chốt Giá Của Điều Phối Viên & Xử Lý Sai Lệch Tại Hiện Trường

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai quy trình xét duyệt chốt giá chính thức của Điều phối viên trước khi Cư dân đặt cọc, và quy trình xử lý sai lệch / vi phạm an toàn tại hiện trường của Tài xế trên ứng dụng di động Smartbin Bulky.

**Architecture:** Bổ sung các trạng thái mới (`PENDING_REVIEW`, `APPROVED_AWAITING_PAYMENT`, `DISCREPANCY_PENDING`, `REJECTED_ON_SITE`) vào `BulkyOrderStatus` và `BulkyOrder`, mở rộng `MockBulkyStorage` và `OrdersProvider`, nâng cấp các màn hình tương ứng (`BulkyBookingWizardScreen`, `BulkyOperatorScreen`, `BulkyOrderDetailScreen`, `BulkyDriverScreen`), tuân thủ TDD và đảm bảo 100% tests tiếp tục pass.

**Tech Stack:** Flutter 3.x, Dart 3.x, Provider, SharedPreferences, Material 3.

## Global Constraints
- Nền tảng: Flutter di động trong thư mục `mobile/` (`dev-EnglandLee`).
- Ngôn ngữ giao diện: 100% tiếng Việt cho nhãn, thông báo, dialog và định dạng tiền tệ VNĐ.
- Thuật ngữ phương tiện: 100% chuẩn hóa là "xe tải thu gom" / "xe thu gom chuyên dụng" (không dùng "xe cẩu").
- Không commit API key bí mật dạng thô.
- Bảo toàn 100% bài kiểm thử hiện có (94/94+ tests passing) và 0 lỗi linter (`flutter analyze`).

---

### Task 1: Mở Rộng Domain Model & Trạng Thái Đơn Hàng (`BulkyOrderStatus` & `BulkyOrder`)

**Files:**
- Modify: `mobile/lib/core/constants/bulky_constants.dart`
- Modify: `mobile/lib/core/domain/models/bulky_order.dart`
- Test: `mobile/test/core/domain/bulky_order_status_test.dart`

**Interfaces:**
- Consumes: `BulkyCategory`, `BulkyQuote`, `BulkyItem`.
- Produces: `BulkyOrderStatus.PENDING_REVIEW`, `BulkyOrderStatus.APPROVED_AWAITING_PAYMENT`, `BulkyOrderStatus.DISCREPANCY_PENDING`, `BulkyOrderStatus.REJECTED_ON_SITE`, các trường mới trong `BulkyOrder`: `finalizedPriceVnd`, `operatorNote`, `onSiteAdjustedPriceVnd`, `onSiteDiscrepancyNote`, `onSiteRejectionReason`, `calloutFeeVnd`.

- [ ] **Step 1: Viết test cho enum trạng thái mới và serialization của `BulkyOrder`**

```dart
// mobile/test/core/domain/bulky_order_status_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_order.dart';
import 'package:bulky_mobile/core/domain/models/bulky_quote.dart';

void main() {
  group('BulkyOrderStatus & BulkyOrder Model Extensions', () {
    test('contains new workflow statuses with Vietnamese labels', () {
      expect(BulkyOrderStatus.PENDING_REVIEW.displayName, 'Chờ điều phối viên duyệt giá');
      expect(BulkyOrderStatus.APPROVED_AWAITING_PAYMENT.displayName, 'Đã duyệt giá • Chờ đặt cọc');
      expect(BulkyOrderStatus.DISCREPANCY_PENDING.displayName, 'Chờ duyệt phát sinh tại chỗ');
      expect(BulkyOrderStatus.REJECTED_ON_SITE.displayName, 'Từ chối tại hiện trường');
    });

    test('BulkyOrder serializes and deserializes new workflow fields', () {
      final now = DateTime.now();
      final order = BulkyOrder(
        id: 'order-workflow-test',
        items: const [],
        quote: const BulkyQuote(
          subtotalMinVnd: 200000,
          subtotalMaxVnd: 250000,
          depositHoldVnd: 100000,
          minVnd: 220000,
          maxVnd: 270000,
          totalEstimatedWeightKg: 40,
        ),
        address: '123 Test St',
        pickupDate: '2026-09-30',
        status: BulkyOrderStatus.APPROVED_AWAITING_PAYMENT,
        createdAt: now,
        finalizedPriceVnd: 250000,
        operatorNote: 'Đã xác nhận bàn gỗ ép',
        onSiteAdjustedPriceVnd: 350000,
        onSiteDiscrepancyNote: 'Phát sinh thêm nệm',
        onSiteRejectionReason: 'Bình gas rác cấm',
        calloutFeeVnd: 50000,
      );

      final json = order.toJson();
      final restored = BulkyOrder.fromJson(json);

      expect(restored.status, BulkyOrderStatus.APPROVED_AWAITING_PAYMENT);
      expect(restored.finalizedPriceVnd, 250000);
      expect(restored.operatorNote, 'Đã xác nhận bàn gỗ ép');
      expect(restored.onSiteAdjustedPriceVnd, 350000);
      expect(restored.onSiteDiscrepancyNote, 'Phát sinh thêm nệm');
      expect(restored.onSiteRejectionReason, 'Bình gas rác cấm');
      expect(restored.calloutFeeVnd, 50000);
    });
  });
}
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

```bash
cd mobile && flutter test test/core/domain/bulky_order_status_test.dart
```

- [ ] **Step 3: Cập nhật `bulky_constants.dart` và `bulky_order.dart`**

Cập nhật `BulkyOrderStatus` với các enum mới và nhãn tiếng Việt tương ứng.
Cập nhật `BulkyOrder` với `finalizedPriceVnd`, `operatorNote`, `onSiteAdjustedPriceVnd`, `onSiteDiscrepancyNote`, `onSiteRejectionReason`, `calloutFeeVnd`, `copyWith`, `toJson`, `fromJson`.

- [ ] **Step 4: Chạy lại test xác nhận thành công**

```bash
cd mobile && flutter test test/core/domain/bulky_order_status_test.dart
```

- [ ] **Step 5: Chạy full test suite để đảm bảo zero regression**

```bash
cd mobile && flutter test
```

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/core/constants/ mobile/lib/core/domain/ mobile/test/core/
git commit -m "feat(mobile): add operator approval and on-site discrepancy statuses to BulkyOrder"
```

---

### Task 2: Cập Nhật Lưu Trữ & Quản Lý Trạng Thái (`MockBulkyStorage` & `OrdersProvider`)

**Files:**
- Modify: `mobile/lib/core/services/storage/mock_bulky_storage.dart`
- Modify: `mobile/lib/features/orders/providers/orders_provider.dart`
- Test: `mobile/test/core/services/mock_bulky_storage_test.dart`
- Test: `mobile/test/features/providers_test.dart`

**Interfaces:**
- Consumes: `BulkyOrder`, `BulkyOrderStatus`, `BulkyQuote`.
- Produces:
  - `ordersProvider.approveWithFinalPrice(String orderId, int finalizedPriceVnd, {String? operatorNote})`
  - `ordersProvider.rejectOrderWithReason(String orderId, String reason)`
  - `ordersProvider.reportOnSiteDiscrepancy(String orderId, int adjustedPriceVnd, String note)`
  - `ordersProvider.respondToOnSiteDiscrepancy(String orderId, {required bool accept})`
  - `ordersProvider.rejectOnSiteSafetyViolation(String orderId, String reason, {int calloutFee = 50000})`

- [ ] **Step 1: Viết test cho các phương thức mới trong `mock_bulky_storage_test.dart` và `providers_test.dart`**

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

```bash
cd mobile && flutter test test/core/services/mock_bulky_storage_test.dart
```

- [ ] **Step 3: Triển khai các phương thức trong `mock_bulky_storage.dart` và `orders_provider.dart`**

- [ ] **Step 4: Chạy test xác nhận thành công**

```bash
cd mobile && flutter test test/core/services/mock_bulky_storage_test.dart test/features/providers_test.dart
```

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/services/storage/ mobile/lib/features/orders/providers/ mobile/test/
git commit -m "feat(mobile): implement storage and provider workflows for pricing approval and discrepancy"
```

---

### Task 3: Cập Nhật Luồng Wizard Gửi Đơn Chờ Xét Duyệt (`BulkyBookingWizardScreen`)

**Files:**
- Modify: `mobile/lib/features/request_wizard/screens/bulky_booking_wizard_screen.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/step_review_summary.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/live_pricing_bottom_bar.dart`
- Test: `mobile/test/features/request_wizard/bulky_booking_wizard_test.dart`

**Interfaces:**
- Consumes: `BookingWizardProvider`, `OrdersProvider`.
- Produces: Nút CTA `[GỬI YÊU CẦU XÉT DUYỆT ➔]` ở Bước 3 tạo đơn với trạng thái `PENDING_REVIEW` và điều hướng sang `BulkyOrderDetailScreen`.

- [ ] **Step 1: Viết test cho luồng gửi xét duyệt trong `bulky_booking_wizard_test.dart`**
- [ ] **Step 2: Chạy test để xác nhận**
- [ ] **Step 3: Triển khai thay đổi trên Wizard và LivePricingBottomBar**
- [ ] **Step 4: Chạy test xác nhận thành công**
- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/request_wizard/ mobile/test/features/request_wizard/
git commit -m "feat(mobile): submit bulky wizard request for operator pricing review"
```

---

### Task 4: Nâng Cấp Màn Hình Điều Phối Viên Chốt Giá Phê Duyệt (`BulkyOperatorScreen`)

**Files:**
- Modify: `mobile/lib/features/operator/screens/bulky_operator_screen.dart`
- Test: `mobile/test/features/auth/role_workflow_test.dart`

**Interfaces:**
- Consumes: `OrdersProvider`, `BulkyOrder`.
- Produces: Form chốt giá chính thức cho đơn `PENDING_REVIEW`, nhập mức giá chính thức VNĐ, ghi chú duyệt đơn, nút `[✓ Phê duyệt & Chốt giá gửi Cư dân]` chuyển sang `APPROVED_AWAITING_PAYMENT`.

- [ ] **Step 1: Viết test luồng Điều phối viên chốt giá trong `role_workflow_test.dart`**
- [ ] **Step 2: Chạy test để xác nhận**
- [ ] **Step 3: Triển khai giao diện chốt giá và nút duyệt trong `BulkyOperatorScreen`**
- [ ] **Step 4: Chạy test xác nhận thành công**
- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/operator/ mobile/test/features/auth/
git commit -m "feat(mobile): add exact price finalization and approval form to operator screen"
```

---

### Task 5: Nâng Cấp Chi Tiết Đơn Hàng Cư Dân & Đặt Cọc Sau Khi Duyệt (`BulkyOrderDetailScreen`)

**Files:**
- Modify: `mobile/lib/features/orders/screens/bulky_order_detail_screen.dart`
- Test: `mobile/test/features/quote_and_orders_test.dart`

**Interfaces:**
- Consumes: `OrdersProvider`, `BulkyOrder`.
- Produces:
  - Banner `PENDING_REVIEW` (Chờ xét duyệt).
  - Banner & Thẻ `APPROVED_AWAITING_PAYMENT` với mức giá chính thức đã duyệt + nút `[TIẾN HÀNH ĐẶT CỌC GIỮ XE ➔]`.
  - Thẻ `DISCREPANCY_PENDING` so sánh cước cũ vs mới + 2 nút `[Đồng ý]` / `[Giữ danh mục cũ]`.
  - Thẻ `REJECTED_ON_SITE` thông báo từ chối vi phạm an toàn, phí điều xe 50.000 đ.

- [ ] **Step 1: Viết widget tests cho các trạng thái mới của `BulkyOrderDetailScreen`**
- [ ] **Step 2: Chạy test để xác nhận**
- [ ] **Step 3: Triển khai các card và banner tương tác trên `BulkyOrderDetailScreen`**
- [ ] **Step 4: Chạy test xác nhận thành công**
- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/orders/screens/ mobile/test/features/
git commit -m "feat(mobile): display finalized pricing, deposit CTA and discrepancy alerts on order detail"
```

---

### Task 6: Nâng Cấp Màn Hình Tài Xế Xử Lý Sai Lệch & Từ Chối An Toàn (`BulkyDriverScreen`)

**Files:**
- Modify: `mobile/lib/features/driver/screens/bulky_driver_screen.dart`
- Test: `mobile/test/features/auth/role_workflow_test.dart`

**Interfaces:**
- Consumes: `OrdersProvider`, `BulkyOrder`.
- Produces: Nút `[⚠️ Báo phát sinh đồ tại hiện trường]` mở dialog nhập cước phát sinh, nút `[⛔ Từ chối thu gom (Rác cấm / Nguy hại)]` mở dialog chọn lý do vi phạm an toàn và trừ phí 50.000 đ.

- [ ] **Step 1: Viết test cho hành động hiện trường của tài xế trong `role_workflow_test.dart`**
- [ ] **Step 2: Chạy test để xác nhận**
- [ ] **Step 3: Triển khai các dialog và nút thao tác trên `BulkyDriverScreen`**
- [ ] **Step 4: Chạy test xác nhận thành công**
- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/driver/ mobile/test/features/auth/
git commit -m "feat(mobile): add on-site discrepancy reporting and safety rejection to driver screen"
```

---

### Task 7: Kiểm Thử Toàn Diện & Phân Tích Linter

**Files:**
- Command: `flutter analyze`, `flutter test`

- [ ] **Step 1: Chạy linter toàn bộ dự án di động**
```bash
cd mobile && flutter analyze
```
*Kỳ vọng:* `No issues found!` (0 errors, 0 warnings).

- [ ] **Step 2: Chạy toàn bộ test suite**
```bash
cd mobile && flutter test
```
*Kỳ vọng:* 100% tests pass.

- [ ] **Step 3: Commit tổng kết**
```bash
git add mobile/
git commit -m "chore(mobile): complete verification of operator pricing approval and on-site discrepancy workflows"
```
