# Kế Hoạch Thực Thi: Nâng Cấp Toàn Diện UI/UX Mobile Eco-Tech - Smartbin Bulky

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện đại hóa toàn diện giao diện di động Flutter của Smartbin Bulky theo ngôn ngữ thiết kế Eco-Tech, kết hợp 3 hình mẫu Dribbble (LazyInterface, Deepthi N Anekal, Nixtio), đảm bảo 100% tiếng Việt và 100% bài kiểm thử tự động vượt qua (86/86+ tests passing).

**Architecture:** Mở rộng và tinh chỉnh trực tiếp hệ thống Design Tokens (`BulkyColors`, `BulkyTheme`), nâng cấp từng màn hình chuyên biệt (`CitizenHomeScreen`, `BulkyBookingWizardScreen`, `BulkyQuoteScreen`, `BulkyPaymentScreen`, `BulkyOrderDetailScreen`, `BulkyOperatorScreen`, `BulkyDriverScreen`, `BulkyAccountScreen`), giữ vững cấu trúc phân quyền RBAC và hệ thống State Management Provider (`AuthProvider`, `ScanProvider`, `BookingWizardProvider`, `OrdersProvider`).

**Tech Stack:** Flutter 3.x, Dart 3.x, Provider, SharedPreferences, CustomPainter Canvas, Material 3 Design System.

## Global Constraints
- Nền tảng: Flutter di động (hỗ trợ Android, Linux desktop, Chrome web).
- Thư mục mã nguồn: Đặt gọn trong `mobile/` của kho mã nguồn Smartbin (`dev-EnglandLee`).
- Ngôn ngữ giao diện: 100% tiếng Việt cho nhãn, thông báo, dialog và định dạng tiền tệ VNĐ.
- Thuật ngữ phương tiện: 100% chuẩn hóa là "xe tải thu gom" / "xe thu gom chuyên dụng", tuyệt đối không dùng "xe cẩu".
- Không commit khóa API bí mật dạng thô (`GEMINI_API_KEY` truyền qua `--dart-define`).
- Bảo toàn 100% bài kiểm thử (86/86+ tests passing) và 0 lỗi linter (`flutter analyze` 0 issues).

---

### Task 1: Nâng Cấp Hệ Thống Design System Tokens (`BulkyColors` & `BulkyTheme`)

**Files:**
- Modify: `mobile/lib/core/theme/bulky_colors.dart`
- Modify: `mobile/lib/core/theme/bulky_theme.dart`
- Test: `mobile/test/core/theme/bulky_theme_test.dart`

**Interfaces:**
- Consumes: Nothing (nền tảng visual tokens).
- Produces: `BulkyColors.wasteOrganic`, `BulkyColors.wasteRecyclable`, `BulkyColors.wasteBulky`, `BulkyColors.wasteHazardous`, `BulkyColors.iotSafeGradient`, `BulkyColors.iotWarnGradient`, `BulkyColors.iotDangerGradient`, `BulkyColors.softShadow`, `BulkyTheme.lightTheme`.

- [ ] **Step 1: Viết test kiểm tra các tokens mới trong `bulky_theme_test.dart`**

```dart
// mobile/test/core/theme/bulky_theme_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/core/theme/bulky_colors.dart';
import 'package:bulky_mobile/core/theme/bulky_theme.dart';

void main() {
  group('BulkyTheme & BulkyColors Design Tokens', () {
    test('provides modern eco-tech color tokens', () {
      expect(BulkyColors.primary, const Color(0xFF059669));
      expect(BulkyColors.background, const Color(0xFFF8FAFC));
      expect(BulkyColors.wasteOrganic, const Color(0xFF16A34A));
      expect(BulkyColors.wasteRecyclable, const Color(0xFF2563EB));
      expect(BulkyColors.wasteBulky, const Color(0xFFEA580C));
      expect(BulkyColors.wasteHazardous, const Color(0xFFDC2626));
    });

    test('theme uses border radius and elevated surface tokens', () {
      final theme = BulkyTheme.lightTheme;
      expect(theme.scaffoldBackgroundColor, BulkyColors.background);
      expect(theme.cardTheme.elevation, 0);
      expect(theme.cardTheme.shape, isA<RoundedRectangleBorder>());
    });
  });
}
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

```bash
cd mobile && flutter test test/core/theme/bulky_theme_test.dart
```
*Kỳ vọng:* Thất bại do chưa định nghĩa các tokens `wasteOrganic`, `wasteRecyclable`, v.v.

- [ ] **Step 3: Cập nhật `bulky_colors.dart` và `bulky_theme.dart`**

Cập nhật `mobile/lib/core/theme/bulky_colors.dart`:
Bổ sung các hằng số màu phân loại rác (Deepthi), gradient viễn thám IoT (Nixtio) và soft ambient shadow, đồng thời giữ nguyên toàn bộ các hàm hỗ trợ như `formatCurrency`.

Cập nhật `mobile/lib/core/theme/bulky_theme.dart`:
Cấu hình Card shape với `BorderRadius.circular(20.0)`, viền `Color(0xFFE2E8F0)`, AppBar nền trắng, ElevatedButton bo cong `14.0` chiều cao 52px.

- [ ] **Step 4: Chạy lại test xác nhận thành công**

```bash
cd mobile && flutter test test/core/theme/bulky_theme_test.dart
```
*Kỳ vọng:* PASS 2/2 tests.

- [ ] **Step 5: Chạy toàn bộ test hiện có để bảo đảm zero regression**

```bash
cd mobile && flutter test
```
*Kỳ vọng:* Toàn bộ 87 tests passed.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/core/theme/ mobile/test/core/theme/
git commit -m "feat(mobile): add eco-tech visual tokens and theme cards"
```

---

### Task 2: Hiện Đại Hóa Màn Hình Trang Chủ Cư Dân (`CitizenHomeScreen`)

**Files:**
- Modify: `mobile/lib/features/citizen_home/screens/citizen_home_screen.dart`
- Test: `mobile/test/features/citizen_home/citizen_home_screen_test.dart`

**Interfaces:**
- Consumes: `BulkyColors`, `BulkyTheme`, `AuthProvider`, `CitizenUser`.
- Produces: Thẻ IoT Telemetry viễn thám chuyển sắc, dải lịch tuần 7 ngày Deepthi với định vị xe thu gom, lưới 2x2 hành động nhanh bo 20px, thẻ đóng góp sinh thái CO₂ và cây xanh.

- [ ] **Step 1: Viết test mở rộng trong `citizen_home_screen_test.dart`**

Thêm các test cases kiểm tra:
1. Dải lịch 7 ngày trong tuần `[T2 - CN]` với hôm nay được đánh dấu `Hôm nay`.
2. Chỉ số xe thu gom tiếp cận `Xe số 03 đang cách bạn 1.2 km`.
3. Thẻ IoT viễn thám với thanh tiến trình `68%`, cảm biến mùi `Bình thường`, pin `92%`.
4. Lưới 2x2 thẻ bo cong với đầy đủ các `Key` định danh (`quick_action_bulky_booking`, `quick_action_billing`, `quick_action_rewards`, `quick_action_complaint`).
5. Thống kê sinh thái `34.5 kg` và `6.8 kg CO₂`.

- [ ] **Step 2: Chạy test để xác nhận test thất bại với các yêu cầu mới**

```bash
cd mobile && flutter test test/features/citizen_home/citizen_home_screen_test.dart
```

- [ ] **Step 3: Cập nhật `citizen_home_screen.dart`**

1. Xây dựng dải lịch ngang 7 ngày trong tuần (`_buildWeeklyScheduleStrip`):
   - Thứ 2 đến Chủ nhật, highlight ngày hiện tại bằng chip tròn màu xanh lục bảo Emerald `#059669`.
   - Phân loại rác hôm nay với tag màu sinh thái (🍏 Rác hữu cơ & ♻️ Tái chế định kỳ).
   - Thẻ định vị xe thu gom: `🚚 Xe số 03 đang đến thu gom • Cách bạn 1.2 km (Khoảng 8 phút nữa)` kèm thanh tiếp cận trực quan.
2. Nâng cấp Thẻ IoT Telemetry (`_buildIotTelemetryCard`):
   - Thanh đo mức đầy bo tròn 12px với dải gradient vàng hổ phách tương ứng 68%.
   - Hộp trạng thái cảm biến mùi `🍃 Mùi: Bình thường`, pin `⚡ Pin cảm biến: 92%`, nhịp thở trực tuyến `📶 IoT Online`.
3. Nâng cấp Lưới 2x2 Hành Động Nhanh (`_buildQuickActionsGrid`):
   - Bo tròn 20px, bóng mờ ambient, icon nằm trong khối tròn pastel chuyên nghiệp.
   - Thẻ `Đặt thu rác cồng kềnh (AI)`, `Phí tháng & Nợ`, `Đổi Điểm Xanh`, `Phản ánh thùng`.
4. Nâng cấp Thẻ Đóng Góp Môi Trường (`_buildEcoImpactCard`):
   - Hai khối số liệu lớn `34.5 kg rác phân loại` (+12%) và `6.8 kg CO₂ giảm thiểu` (~0.4 cây xanh tương đương).

- [ ] **Step 4: Chạy test xác nhận toàn bộ test trang chủ vượt qua**

```bash
cd mobile && flutter test test/features/citizen_home/citizen_home_screen_test.dart
```
*Kỳ vọng:* PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/citizen_home/
git commit -m "feat(mobile): redesign citizen home screen with IoT gauge and weekly schedule strip"
```

---

### Task 3: Hiện Đại Hóa Quy Trình Đặt Thu Gom Rác Cồng Kềnh (`BulkyBookingWizardScreen`)

**Files:**
- Modify: `mobile/lib/features/request_wizard/screens/bulky_booking_wizard_screen.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/step_items_editor.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/material_survey_chips.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/step_logistics_editor.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/step_review_summary.dart`
- Modify: `mobile/lib/features/request_wizard/widgets/live_pricing_bottom_bar.dart`
- Test: `mobile/test/features/request_wizard/bulky_booking_wizard_test.dart`

**Interfaces:**
- Consumes: `BookingWizardProvider`, `ScanProvider`, `BulkyItem`, `BoundingBox`, `PricingEngine`.
- Produces: Pill segmented stepper 3 bước, khung ngắm camera AI bo góc công nghệ cao, chip khảo sát chất liệu 1-chạm phong cách Dribbble, thanh báo giá nổi với dải Min-Max và tiền cọc.

- [ ] **Step 1: Viết test xác thực giao diện wizard cải tiến trong `bulky_booking_wizard_test.dart`**

Xác minh:
1. Stepper 3 bước với nhãn `Đồ vật & Ảnh`, `Địa điểm`, `Xác nhận`.
2. Chip khảo sát chất liệu `LIGHT`, `STANDARD`, `HEAVY` cập nhật giá tức thì.
3. Chuyển đổi Vỉa hè (Curbside) vs Trong nhà (Inside Home) cập nhật số tầng và phụ phí.
4. Nút mở bảng phân tích giá minh bạch (transparency modal bottom sheet).

- [ ] **Step 2: Chạy test để kiểm tra hiện trạng**

```bash
cd mobile && flutter test test/features/request_wizard/bulky_booking_wizard_test.dart
```

- [ ] **Step 3: Cải tiến giao diện các widget trong `request_wizard/`**

1. `BulkyBookingWizardScreen`: Thay Stepper truyền thống bằng Pill Segmented Stepper với nền bo tròn, icon tích xanh khi hoàn thành, màu Emerald sáng khi đang chọn.
2. `StepItemsEditor`:
   - Viewfinder camera bo góc 20px với góc quét hiện đại.
   - Thẻ đồ vật bo 18px, tích hợp bộ chọn số lượng `[-] 1 [+]` dạng nút tròn thanh lịch.
   - Nhãn khối lượng động `X kg` kèm icon cân nặng.
3. `MaterialSurveyChips`:
   - 3 chip: `🪶 Nhẹ/Mút (-20%)`, `🪵 Gỗ ép (Chuẩn)`, `🪨 Rất nặng (+30%)`.
   - Hiệu ứng viền nổi và màu nền Emerald khi được kích hoạt.
4. `StepLogisticsEditor`:
   - Card chọn địa chỉ có nút định vị GPS.
   - Card chọn ngày thu gom dạng chip `Hôm nay`, `Ngày mai`, `Chọn ngày`.
   - Selector loại hình bốc dỡ: Thang máy miễn phí, Thang bộ (+20k/tầng), Tháo dỡ (+30k).
5. `StepReviewSummary`:
   - Bảng tổng kết dạng biên lai hiện đại, nổi bật dải giá Min - Max và tiền cọc giữ chỗ.
   - `ToleranceGuaranteeBanner` cam kết bảo vệ giá dung sai $\pm 15\%$.
6. `LivePricingBottomBar`:
   - Thanh nổi bo cong 16px với dải chuyển màu mượt mà, nút `Tiếp tục` / `Xác nhận & Báo giá` cao 52px.

- [ ] **Step 4: Chạy test xác nhận toàn bộ test wizard vượt qua**

```bash
cd mobile && flutter test test/features/request_wizard/bulky_booking_wizard_test.dart
```
*Kỳ vọng:* PASS 8/8 test cases.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/request_wizard/
git commit -m "feat(mobile): modernize bulky booking wizard with pill stepper and eco-tech cards"
```

---

### Task 4: Nâng Cấp Màn Hình Báo Giá, Thanh Toán QR & Theo Dõi Đơn Hàng

**Files:**
- Modify: `mobile/lib/features/quote/screens/bulky_quote_screen.dart`
- Modify: `mobile/lib/features/payment/screens/bulky_payment_screen.dart`
- Modify: `mobile/lib/features/payment/widgets/countdown_timer_widget.dart`
- Modify: `mobile/lib/features/orders/screens/bulky_orders_list_screen.dart`
- Modify: `mobile/lib/features/orders/screens/bulky_order_detail_screen.dart`
- Test: `mobile/test/features/quote_and_orders_test.dart`

**Interfaces:**
- Consumes: `OrdersProvider`, `BulkyOrder`, `BulkyQuote`, `ToleranceGuaranteeBanner`, `BulkyAppBottomNavBar`.
- Produces: Giao diện báo giá chi tiết, đồng hồ đếm ngược 15 phút, mã VietQR/MoMo sao chép 1-chạm, quy trình 5 bước theo dõi lộ trình xe thu gom với thanh bottom navigation luôn hiển thị.

- [ ] **Step 1: Viết test kiểm tra quy trình đặt cọc, thanh toán và điều xe**

Kiểm tra:
1. `BulkyQuoteScreen` hiển thị đầy đủ bảng phân tách cước và hàng nút `[Quay lại]`, `[Tiến hành đặt cọc]`.
2. `BulkyPaymentScreen` hiển thị đồng hồ đếm ngược 15 phút và thông tin VietQR/MoMo.
3. `BulkyOrderDetailScreen` hiển thị quy trình 5 bước, thẻ xe tải thu gom và banner chờ duyệt.

- [ ] **Step 2: Chạy test để kiểm tra hiện trạng**

```bash
cd mobile && flutter test test/features/quote_and_orders_test.dart
```

- [ ] **Step 3: Cập nhật giao diện các màn hình Quote, Payment và Orders**

1. `BulkyQuoteScreen`:
   - Thẻ biên lai chi tiết: Đồ vật, phụ phí bốc vác, phí xe tải thu gom chuyên dụng.
   - Thẻ tiền cọc giữ chỗ và `ToleranceGuaranteeBanner` cam kết dung sai $\pm 15\%$.
   - Giữ nguyên `BulkyAppBottomNavBar` ở đáy màn hình.
2. `BulkyPaymentScreen`:
   - Nâng cấp `CountdownTimerWidget`: Đồng hồ dạng pill chip `⏳ 14:59 còn lại`, cảnh báo đỏ khi dưới 3 phút.
   - Thẻ VietQR / MoMo: QR code sắc nét, nút sao chép 1-chạm cho STK và cú pháp chuyển tiền.
   - Nút `[Quay lại]` và `[Xác nhận đã thanh toán cọc]`.
3. `BulkyOrdersListScreen`:
   - Filter chip: `Tất cả`, `Đang xử lý`, `Đã hoàn tất`.
   - Thẻ đơn hàng bo cong 18px với mã đơn, thời gian và huy hiệu trạng thái quy chuẩn.
4. `BulkyOrderDetailScreen`:
   - Timeline 5 bước trực quan: Đã cọc $\to$ Kiểm duyệt & Phê duyệt $\to$ Đã xếp xe $\to$ Đang lấy $\to$ Hoàn tất.
   - Banner chờ duyệt dành cho cư dân.
   - Thẻ Xe tải & Tài xế thu gom: Biển số xe tải, tên tài xế, nút gọi điện thoại.
   - Thẻ phê duyệt / từ chối dành riêng cho tài khoản Operator.

- [ ] **Step 4: Chạy test xác nhận toàn bộ test quote & orders vượt qua**

```bash
cd mobile && flutter test test/features/quote_and_orders_test.dart
```
*Kỳ vọng:* PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/quote/ mobile/lib/features/payment/ mobile/lib/features/orders/
git commit -m "feat(mobile): elevate quote, payment QR countdown and order tracking screens"
```

---

### Task 5: Nâng Cấp Cổng Quản Trị Operator, Driver & Account

**Files:**
- Modify: `mobile/lib/features/operator/screens/bulky_operator_screen.dart`
- Modify: `mobile/lib/features/driver/screens/bulky_driver_screen.dart`
- Modify: `mobile/lib/features/auth/screens/bulky_account_screen.dart`
- Test: `mobile/test/features/auth/role_workflow_test.dart`

**Interfaces:**
- Consumes: `AuthProvider`, `OrdersProvider`, `UserRole`.
- Produces: KPI cards quản trị điều phối xe, thẻ chuyến xe tài xế hiện tại, bộ chuyển đổi vai trò 1-chạm (RBAC switcher).

- [ ] **Step 1: Viết test kiểm tra chuyển đổi vai trò và luồng duyệt đơn**

Kiểm tra:
1. Chuyển đổi linh hoạt giữa Citizen, Operator, Driver trong `BulkyAccountScreen`.
2. Operator duyệt đơn và điều xe tải thu gom `51C-889.21`.
3. Driver nhận chuyến, gọi điện và hoàn tất thu gom tại hiện trường.

- [ ] **Step 2: Chạy test để kiểm tra hiện trạng**

```bash
cd mobile && flutter test test/features/auth/role_workflow_test.dart
```

- [ ] **Step 3: Cập nhật giao diện Operator, Driver và Account**

1. `BulkyOperatorScreen`:
   - Các thẻ chỉ số KPI: Đơn chờ duyệt, Xe tải đang trên tuyến, Khối lượng hoàn tất.
   - Hộp thoại Phê duyệt & Điều xe tải chuyên dụng trực quan.
   - Hộp thoại Từ chối & Hoàn trả tiền cọc.
2. `BulkyDriverScreen`:
   - Thẻ Chuyến xe Hiện tại: Biển số xe tải phụ trách, địa chỉ lấy rác, nút gọi cư dân, nút cập nhật trạng thái `Đang đến lấy rác` và `Hoàn tất thu gom`.
3. `BulkyAccountScreen`:
   - Card hồ sơ cư dân kèm mã hộ gia đình và ví Điểm Xanh.
   - Bộ chuyển đổi vai trò 1-chạm (RBAC Role Switcher: Citizen $\longleftrightarrow$ Operator $\longleftrightarrow$ Driver).

- [ ] **Step 4: Chạy test xác nhận toàn bộ test phân quyền vượt qua**

```bash
cd mobile && flutter test test/features/auth/role_workflow_test.dart
```
*Kỳ vọng:* PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/operator/ mobile/lib/features/driver/ mobile/lib/features/auth/
git commit -m "feat(mobile): modernize operator KPI cards, driver active trip and account RBAC switcher"
```

---

### Task 6: Kiểm Thử Toàn Diện, Phân Tích Linter & Xác Minh Web Trực Quan

**Files:**
- Test: Toàn bộ thư mục `mobile/test/`
- Command: `flutter analyze`, `flutter test`

- [ ] **Step 1: Chạy linter toàn bộ dự án di động**

```bash
cd mobile && flutter analyze
```
*Kỳ vọng:* `No issues found!` (0 errors, 0 warnings).

- [ ] **Step 2: Chạy toàn bộ bộ test tự động**

```bash
cd mobile && flutter test
```
*Kỳ vọng:* Toàn bộ bài kiểm thử (87+ tests) đều pass 100%.

- [ ] **Step 3: Tải lại Hot-Restart ứng dụng trên máy chủ Web**

Kiểm tra trực tiếp trên Chrome `http://localhost:8080/` để xác nhận giao diện mới hiển thị hoàn hảo.

- [ ] **Step 4: Commit tổng kết**

```bash
git add mobile/
git commit -m "chore(mobile): complete full UI/UX eco-tech redesign verification"
```
