# Kế Hoạch Triển Khai: Smartbin Bulky Waste Flutter Mobile App

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng ứng dụng di động Flutter độc lập (`mobile/`) cho dịch vụ Thu gom rác cồng kềnh Smartbin, tích hợp AI Vision quét ảnh vẽ Bounding Box, khảo sát vật liệu 1-Click, tính giá Min-Max, cam kết dung sai $\pm 15\%$ và mô phỏng đặt cọc giữ chỗ.

**Architecture:** Kiến trúc Feature-First kết hợp Provider State Management. Chuyển giao 1:1 logic tính cước từ Web sang Dart thuần, tích hợp trực tiếp Google Gemini Multimodal Vision API có cơ chế luân chuyển model (`gemini-2.5-flash` ⇄ `gemini-3.6-flash`) và retry khi quá tải, sử dụng `CustomPainter` để vẽ hộp bounding box 2D.

**Tech Stack:** Flutter 3.47+ / Dart 3.13+, Provider, http, shared_preferences, image_picker, intl, flutter_test.

## Global Constraints
- Nền tảng: Flutter di động (chạy trên Android Emulator `Medium_Phone`, thiết bị thực, và Linux desktop).
- Thư mục mã nguồn: Đặt gọn trong `mobile/` của repo `Smartbin`.
- Ngôn ngữ giao diện: 100% tiếng Việt cho nhãn, thông báo, đơn vị tính và báo giá.
- Không hardcode API key nhạy cảm trực tiếp vào file public; ưu tiên lấy từ cấu hình runtime hoặc fallback an toàn.
- Tuân thủ TDD: Viết test trước, kiểm tra test fail, viết code, kiểm tra test pass, commit thường xuyên.

---

### Task 1: Khởi Tạo Dự Án Flutter & Cấu Hình Nền Tảng (`mobile/`)

**Files:**
- Create: `mobile/pubspec.yaml`
- Create: `mobile/lib/main.dart`
- Create: `mobile/lib/core/theme/bulky_colors.dart`
- Create: `mobile/lib/core/theme/bulky_theme.dart`
- Test: `mobile/test/widget_test.dart`

**Interfaces:**
- Consumes: Flutter SDK tại `/home/quocanh/flutter/bin/flutter`.
- Produces: Ứng dụng Flutter cơ sở khởi chạy được, cấu hình xong dependencies (`provider`, `http`, `shared_preferences`, `image_picker`, `intl`) và hệ màu Smartbin Theme (Primary: `#1D4ED8`, Emerald: `#16A34A`, Background: `#F8FAFC`).

- [ ] **Step 1: Tạo dự án Flutter bằng lệnh `flutter create`**

Run command:
```bash
flutter create --org com.smartbin --project-name bulky_mobile --platforms android,linux,web mobile
```
Expected: Thư mục `mobile/` được tạo thành công với cấu trúc chuẩn.

- [ ] **Step 2: Cập nhật dependencies trong `mobile/pubspec.yaml`**

Thêm các package: `provider: ^6.1.2`, `http: ^1.2.2`, `shared_preferences: ^2.3.2`, `image_picker: ^1.1.2`, `intl: ^0.19.0`.
Run:
```bash
cd mobile && flutter pub get
```
Expected: `pubspec.lock` sinh ra sạch sẽ, exit code 0.

- [ ] **Step 3: Định nghĩa Theme & Màu sắc (`bulky_colors.dart` & `bulky_theme.dart`)**

Tạo `mobile/lib/core/theme/bulky_colors.dart`:
```dart
import 'package:flutter/material.dart';

class BulkyColors {
  static const Color primary = Color(0xFF1D4ED8);
  static const Color primaryLight = Color(0xFF3B82F6);
  static const Color primaryDark = Color(0xFF1E40AF);
  
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE2E8F0);
  
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  
  static const Color success = Color(0xFF16A34A);
  static const Color successBg = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFD97706);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorBg = Color(0xFFFEE2E2);

  // Category Bounding Box Colors
  static const Color boxSofa = Color(0xFF10B981);
  static const Color boxMattress = Color(0xFF2563EB);
  static const Color boxCabinet = Color(0xFF9333EA);
  static const Color boxTable = Color(0xFFF59E0B);
  static const Color boxOther = Color(0xFF475569);
  static const Color boxHazardous = Color(0xFFEF4444);
}
```

Tạo `mobile/lib/core/theme/bulky_theme.dart` thiết lập Material 3 `ThemeData`.

- [ ] **Step 4: Chạy test cơ bản để xác minh dự án**

Run: `cd mobile && flutter test`
Expected: 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold Flutter project with dependencies and Smartbin theme"
```

---

### Task 2: Core Domain Models & Pricing Engine (`pricing_engine.dart`, tests)

**Files:**
- Create: `mobile/lib/core/constants/bulky_constants.dart`
- Create: `mobile/lib/core/domain/models/bulky_item.dart`
- Create: `mobile/lib/core/domain/models/bounding_box.dart`
- Create: `mobile/lib/core/domain/models/bulky_quote.dart`
- Create: `mobile/lib/core/domain/models/bulky_order.dart`
- Create: `mobile/lib/core/domain/pricing/pricing_engine.dart`
- Test: `mobile/test/core/domain/pricing_engine_test.dart`

**Interfaces:**
- Consumes: None (Pure Dart).
- Produces:
  - `BulkyItem`: `{ id, category, displayName, quantity, lengthCm, widthCm, heightCm, material, weightKg, box2d, confidence }`
  - `MaterialType`: `{ LIGHT, STANDARD, HEAVY }`
  - `PricingEngine.calculateQuote({ List<BulkyItem> items, bool requiresDisassembly, int floorNumber, bool hasElevator }) -> BulkyQuote`

- [ ] **Step 1: Viết test thất bại `pricing_engine_test.dart`**

Tạo `mobile/test/core/domain/pricing_engine_test.dart`:
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_item.dart';
import 'package:bulky_mobile/core/domain/pricing/pricing_engine.dart';

void main() {
  group('PricingEngine', () {
    test('calculates correct quote with standard and heavy items', () {
      final items = [
        BulkyItem(
          id: '1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da 3 chỗ',
          quantity: 1,
          material: MaterialType.STANDARD,
        ),
        BulkyItem(
          id: '2',
          category: BulkyCategory.OTHER,
          displayName: 'Phế thải gạch ngói',
          quantity: 1,
          material: MaterialType.HEAVY, // 60.000 * 1.3 = 78.000
        ),
      ];

      final quote = PricingEngine.calculateQuote(
        items: items,
        requiresDisassembly: true, // +30.000
        floorNumber: 2,
        hasElevator: false,        // 2 floors * 20.000 = +40.000
      );

      // Total items: 150.000 (Sofa) + 78.000 (Heavy other) = 228.000
      // Handling fees: 30.000 + 40.000 = 70.000
      // Area fee: 25.000
      // Min: 323.000, Max: round(323.000 * 1.3) = 419.900
      expect(quote.minVnd, equals(323000));
      expect(quote.maxVnd, equals(419900));
      expect(quote.depositHoldVnd, equals(323000));
      expect(quote.tolerancePolicy.allowedMaxVnd, equals(482885));
    });
  });
}
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd mobile && flutter test test/core/domain/pricing_engine_test.dart`
Expected: Compile error do các class chưa tồn tại.

- [ ] **Step 3: Triển khai Models & `PricingEngine`**

1. `mobile/lib/core/constants/bulky_constants.dart`: Khai báo `BulkyCategory`, `MaterialType`, `BASE_PRICES`, `BASE_WEIGHTS`, `MATERIAL_FACTORS`.
2. `mobile/lib/core/domain/models/bulky_item.dart`: Chứa thông tin món đồ, kích thước và toạ độ `box2d`.
3. `mobile/lib/core/domain/models/bulky_quote.dart`: Chứa bảng kê chi tiết từng món (`QuoteItemBreakdown`), phụ phí, `minVnd`, `maxVnd`, `depositHoldVnd`, `tolerancePolicy`.
4. `mobile/lib/core/domain/pricing/pricing_engine.dart`: Cài đặt thuật toán tính giá chuẩn xác.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd mobile && flutter test test/core/domain/pricing_engine_test.dart`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/constants/ mobile/lib/core/domain/ mobile/test/core/
git commit -m "feat(mobile): implement core domain models and pricing engine with material factors"
```

---

### Task 3: Gemini Multimodal Vision AI Service (`gemini_vision_service.dart`, tests)

**Files:**
- Create: `mobile/lib/core/services/ai/gemini_vision_service.dart`
- Create: `mobile/lib/core/services/ai/ai_recognition_result.dart`
- Test: `mobile/test/core/services/gemini_vision_service_test.dart`

**Interfaces:**
- Consumes: `http.Client`, `BulkyConstants`, Gemini Multimodal API endpoint.
- Produces: `GeminiVisionService.analyzeImageBytes(Uint8List imageBytes, { String? mimeType, http.Client? client }) -> Future<AiRecognitionResult>`

- [ ] **Step 1: Viết test `gemini_vision_service_test.dart` với Mock HTTP Client**

Tạo `mobile/test/core/services/gemini_vision_service_test.dart`:
Kiểm tra:
1. Parse chuẩn phản hồi JSON thành danh sách `BulkyItem` và `BoundingBox`.
2. Phân loại gạch ngói/xà bần vào `OTHER` với chất liệu `HEAVY` và `requiresManualReview: false`.
3. Tự động chuyển đổi sang model dự phòng khi model chính trả về mã lỗi 503.
4. Phát hiện bình gas/chất cấm thì kích hoạt `containsHazardousWaste: true` và `requiresManualReview: true`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd mobile && flutter test test/core/services/gemini_vision_service_test.dart`
Expected: FAIL do service chưa được tạo.

- [ ] **Step 3: Triển khai `gemini_vision_service.dart`**

- Định nghĩa system prompt tiếng Việt hướng dẫn Gemini nhận diện đồ cồng kềnh, gạch ngói xếp vào `OTHER`.
- Triển khai vòng lặp thử lại `gemini-2.5-flash` và `gemini-3.6-flash`.
- Xử lý trích xuất base64 và parse `box_2d: [ymin, xmin, ymax, xmax]` normalized.
- Chuẩn hóa tên tiếng Việt và mapping linh hoạt category.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd mobile && flutter test test/core/services/gemini_vision_service_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/services/ai/ mobile/test/core/services/
git commit -m "feat(mobile): implement resilient Gemini multimodal vision service with model fallback"
```

---

### Task 4: Mock Local Storage & State Management Providers

**Files:**
- Create: `mobile/lib/core/services/storage/mock_bulky_storage.dart`
- Create: `mobile/lib/features/scan/providers/scan_provider.dart`
- Create: `mobile/lib/features/request_wizard/providers/booking_wizard_provider.dart`
- Create: `mobile/lib/features/orders/providers/orders_provider.dart`
- Test: `mobile/test/core/services/mock_bulky_storage_test.dart`

**Interfaces:**
- Consumes: `SharedPreferences`, `PricingEngine`, `GeminiVisionService`.
- Produces:
  - `MockBulkyStorage`: `saveOrder`, `getOrders`, `getOrderById`, `seedInitialOrdersIfEmpty`.
  - `BookingWizardProvider`: Quản lý danh sách món đồ, bước hiện tại (0-2), live pricing, chọn ảnh, xử lý chuyển bước.

- [ ] **Step 1: Viết test `mock_bulky_storage_test.dart`**

Sử dụng `SharedPreferences.setMockInitialValues({})` để test việc lưu và tải danh sách đơn hàng.

- [ ] **Step 2: Triển khai `mock_bulky_storage.dart`**

Lưu trữ JSON vào SharedPreferences, tự động seed 2 đơn mẫu (1 đơn `SCHEDULED`, 1 đơn `COMPLETED`) để người dùng xem ngay lịch sử.

- [ ] **Step 3: Triển khai các Provider (`ScanProvider`, `BookingWizardProvider`, `OrdersProvider`)**

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `cd mobile && flutter test test/core/services/mock_bulky_storage_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/services/storage/ mobile/lib/features/*/providers/ mobile/test/
git commit -m "feat(mobile): implement mock local storage and state management providers"
```

---

### Task 5: CustomPainter Vẽ Bounding Box & Xem Trước Ảnh Quét

**Files:**
- Create: `mobile/lib/features/scan/widgets/bounding_box_painter.dart`
- Create: `mobile/lib/features/scan/widgets/bounding_box_badge.dart`
- Create: `mobile/lib/features/scan/widgets/bulky_camera_preview.dart`
- Test: `mobile/test/features/scan/bounding_box_painter_test.dart`

**Interfaces:**
- Consumes: `BoundingBox` models, ảnh `Uint8List` hoặc `File`.
- Produces: `BulkyCameraPreview` widget có hỗ trợ CustomPaint bounding box, công tắc bật/tắt hiển thị, chạm box kích hoạt `onBoxSelected(int index)`.

- [ ] **Step 1: Viết test `bounding_box_painter_test.dart`**

Kiểm tra thuật toán scale toạ độ `[ymin, xmin, ymax, xmax]` sang kích thước Canvas `Size(300, 200)`.

- [ ] **Step 2: Triển khai `bounding_box_painter.dart`**

Vẽ khung viền bo góc (`RRect`), tô màu phủ trong suốt 12%, vẽ badge tên đồ vật và % tự tin ở góc trên bên trái của box.

- [ ] **Step 3: Triển khai `bulky_camera_preview.dart`**

Widget tích hợp chọn ảnh từ thư viện hoặc chụp từ camera (hoặc chọn 3 ảnh preset mẫu để kiểm thử nhanh), lớp phủ hiển thị bounding box mượt mà.

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `cd mobile && flutter test test/features/scan/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/scan/ mobile/test/features/scan/
git commit -m "feat(mobile): implement responsive CustomPainter bounding box overlay and camera preview"
```

---

### Task 6: Wizard Đặt Lịch & Khảo Sát Vật Liệu 1-Click

**Files:**
- Create: `mobile/lib/features/request_wizard/widgets/material_survey_chips.dart`
- Create: `mobile/lib/features/request_wizard/widgets/step_items_editor.dart`
- Create: `mobile/lib/features/request_wizard/widgets/step_logistics_editor.dart`
- Create: `mobile/lib/features/request_wizard/widgets/step_review_summary.dart`
- Create: `mobile/lib/features/request_wizard/widgets/live_pricing_bottom_bar.dart`
- Create: `mobile/lib/features/request_wizard/screens/bulky_booking_wizard_screen.dart`
- Test: `mobile/test/features/request_wizard/bulky_booking_wizard_test.dart`

**Interfaces:**
- Consumes: `BookingWizardProvider`, `MaterialSurveyChips`, `BulkyCameraPreview`.
- Produces: Màn hình đặt lịch 3 bước hoàn chỉnh, cho phép sửa đổi danh mục, chọn vật liệu, ước tính tải trọng và xem giá Min - Max trực tiếp.

- [ ] **Step 1: Viết widget test `bulky_booking_wizard_test.dart`**

Kiểm tra:
1. Chuyển đổi giữa 3 bước của wizard.
2. Thao tác bấm vào chip vật liệu `HEAVY` làm tăng giá và trọng lượng ước tính.
3. Nhấn "Quét với AI" tự động điền danh mục món đồ.

- [ ] **Step 2: Triển khai `material_survey_chips.dart` & `live_pricing_bottom_bar.dart`**

3 chip lựa chọn nhanh `[Nhựa/Mút nhẹ]`, `[MDF/Tiêu chuẩn]`, `[Gỗ đặc/Đá/Nặng]` với màu sắc và icon tương ứng.

- [ ] **Step 3: Triển khai 3 bước của Wizard & `bulky_booking_wizard_screen.dart`**

- Bước 1: Quét ảnh & Danh mục món đồ.
- Bước 2: Địa chỉ thu gom, ngày hẹn (chọn nhanh Ngày mai / Ngày kia), điều kiện thang máy/tháo dỡ.
- Bước 3: Xem lại đơn hàng và chuyển sang báo giá.

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `cd mobile && flutter test test/features/request_wizard/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/request_wizard/ mobile/test/features/request_wizard/
git commit -m "feat(mobile): implement 3-step bulky booking wizard with 1-click material survey"
```

---

### Task 7: Màn Hình Báo Giá, Thanh Toán Cọc & Quản Lý Đơn Hàng

**Files:**
- Create: `mobile/lib/features/quote/screens/bulky_quote_screen.dart`
- Create: `mobile/lib/features/quote/widgets/tolerance_guarantee_banner.dart`
- Create: `mobile/lib/features/payment/screens/bulky_payment_screen.dart`
- Create: `mobile/lib/features/payment/widgets/countdown_timer_widget.dart`
- Create: `mobile/lib/features/orders/screens/bulky_orders_list_screen.dart`
- Create: `mobile/lib/features/orders/screens/bulky_order_detail_screen.dart`
- Modify: `mobile/lib/main.dart` (Đăng ký routes và BottomNavigationBar)
- Test: `mobile/test/features/quote_and_orders_test.dart`

**Interfaces:**
- Consumes: `PricingEngine`, `MockBulkyStorage`, `OrdersProvider`.
- Produces: Hoàn chỉnh luồng người dùng từ Báo giá ➔ Đặt cọc giữ chỗ 15 phút ➔ Quản lý danh sách đơn và xem chi tiết lộ trình xe thu gom.

- [x] **Step 1: Viết test `quote_and_orders_test.dart`**

Kiểm tra hiển thị banner cam kết dung sai $\pm 15\%$, kiểm tra nút thanh toán cọc chuyển trạng thái đơn sang `CONFIRMED`.

- [x] **Step 2: Triển khai `bulky_quote_screen.dart`**

Bảng kê chi tiết từng món đồ, phụ phí bê vác/tháo dỡ, phí vận chuyển và banner bảo đảm dung sai.

- [x] **Step 3: Triển khai `bulky_payment_screen.dart`**

Đồng hồ đếm ngược giữ chỗ 15 phút, hiển thị mã QR MoMo/VietQR và nút mô phỏng thanh toán thành công.

- [x] **Step 4: Triển khai `bulky_orders_list_screen.dart` & `bulky_order_detail_screen.dart`**

Hiển thị danh sách đơn hàng đã lưu, timeline di chuyển 4 bước của xe thu gom.

- [x] **Step 5: Kết nối toàn bộ vào `mobile/lib/main.dart`**

Cung cấp các Provider, BottomNavigationBar (Tab 1: Đặt lịch thu gom, Tab 2: Đơn của tôi).

- [x] **Step 6: Chạy toàn bộ test suite của ứng dụng Mobile**

Run: `cd mobile && flutter test`
Expected: 100% tests pass (63/63 tests passed).

- [x] **Step 7: Khởi chạy kiểm thử trên Desktop hoặc Máy ảo**

Run: `cd mobile && flutter run -d linux` (hoặc `flutter run -d chrome`)
Expected: Ứng dụng chạy mượt mà, đầy đủ các tính năng.

- [x] **Step 8: Commit & Push**

```bash
git add mobile/
git commit -m "feat(mobile): complete bulky quote, payment simulation and orders tracking"
git push origin dev-EnglandLee
```
