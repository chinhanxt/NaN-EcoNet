# Thiết Kế Chi Tiết Ứng Dụng Flutter Mobile: Dịch Vụ Thu Gom Rác Cồng Kềnh Smartbin

**Dự án:** Smartbin Citizen Mobile Application  
**Module:** Thu Gom Rác Cồng Kềnh & Phế Thải Đô Thị (Bulky Waste Service)  
**Nền tảng:** Flutter 3.47+ / Dart 3.13+ (Hỗ trợ Android, iOS, Linux desktop)  
**Thư mục mã nguồn:** `mobile/` trong repository `Smartbin`  
**Ngày lập:** 24/09/2026  
**Trạng thái:** Đã phê duyệt (Approved)

---

## 1. Mục Tiêu & Phạm Vi (Goals & Scope)

### 1.1. Mục tiêu
- Xây dựng ứng dụng di động độc lập (Standalone Mobile App) bằng **Flutter** dành cho người dân đô thị đặt lịch thu gom rác cồng kềnh (sofa, nệm, tủ, bàn ghế, gạch ngói/phế thải xây dựng dân dụng).
- Tích hợp **AI Multimodal Vision (Google Gemini Flash 2.5 / 3.6)** để nhận diện tự động vật thể từ ảnh chụp camera, phân vùng toạ độ Bounding Box 2D và ước lượng phân loại vật liệu.
- Minh bạch hóa cước phí thông qua **Khảo sát vật liệu 1-Click (`LIGHT`, `STANDARD`, `HEAVY`)**, tính toán Khoảng giá ước tính (`Min - Max`), cam kết dung sai $\pm 15\%$ và mô phỏng đặt cọc giữ chỗ.
- Chạy độc lập hoàn chỉnh trên máy ảo Android (hoặc thiết bị thực / Linux Desktop) với kho lưu trữ cục bộ `MockBulkyStorage` lưu trên `SharedPreferences`.

### 1.2. Ngoài phạm vi ban đầu (Non-Goals)
- Chưa triển khai phân hệ tài xế/xe thu gom (Driver Fleet) hay nhân viên điều phối (thuộc phân hệ Dev 1 và Dev 2).
- Chưa tích hợp cổng thanh toán ngân hàng trực tiếp qua internet banking thực tế (sử dụng cổng mô phỏng VietQR/MoMo với webhook idempotent nội bộ).

---

## 2. Kiến Trúc Hệ Thống & Cấu Trúc Thư Mục

Ứng dụng áp dụng kiến trúc **Feature-First** kết hợp **Provider** để quản lý trạng thái, phân tách rõ ràng giữa Domain, Presentation và Data Access.

```
mobile/
├── pubspec.yaml                 # Dependencies: provider, image_picker, http, shared_preferences, intl
├── assets/
│   ├── images/                  # Ảnh mẫu thử nghiệm (sofa, nệm, tủ, rác phế thải)
│   └── icons/
├── lib/
│   ├── main.dart                # Khởi tạo App, MultiProvider, Routing, BulkyTheme
│   ├── core/
│   │   ├── theme/
│   │   │   ├── bulky_colors.dart       # Hệ màu thương hiệu: Primary Blue #1d4ed8, Emerald #16a34a, Slate #0f172a
│   │   │   └── bulky_theme.dart        # Material 3 Theme data
│   │   ├── constants/
│   │   │   ├── bulky_constants.dart    # Mã danh mục, bảng giá mặc định, hệ số vật liệu
│   │   │   └── api_constants.dart      # URL endpoint, Gemini API Key configuration
│   │   ├── domain/
│   │   │   ├── models/
│   │   │   │   ├── bulky_item.dart     # Model đồ vật (loại, kích thước, vật liệu, box_2d)
│   │   │   │   ├── bulky_order.dart    # Model đơn đặt (địa chỉ, ngày hẹn, trạng thái cọc)
│   │   │   │   ├── bulky_quote.dart    # Model bảng kê chi tiết báo giá và dung sai
│   │   │   │   └── bounding_box.dart   # Model toạ độ hộp 2D [ymin, xmin, ymax, xmax]
│   │   │   └── pricing/
│   │   │       └── pricing_engine.dart # Thuật toán tính giá ước tính & chính sách dung sai
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   └── gemini_vision_service.dart # Dịch vụ gọi Gemini AI với fallback & retry
│   │   │   └── storage/
│   │   │       └── mock_bulky_storage.dart    # Kho lưu trữ SharedPreferences + Seed data
│   │   └── utils/
│   │       ├── currency_formatter.dart # Format tiền tệ Việt Nam (VD: 150.000 đ)
│   │       └── date_formatter.dart     # Format ngày hẹn Việt Nam (VD: 25/09/2026)
│   └── features/
│       ├── scan/
│       │   ├── widgets/
│       │   │   ├── bulky_camera_preview.dart     # Khung xem ảnh và nút chụp/chọn
│       │   │   ├── bounding_box_painter.dart     # CustomPainter vẽ hộp nhận diện 2D
│       │   │   └── bounding_box_badge.dart       # Nhãn nổi hiển thị tên và độ tin cậy %
│       │   └── providers/
│       │       └── scan_provider.dart            # Quản lý trạng thái phân tích ảnh AI
│       ├── request_wizard/
│       │   ├── screens/
│       │   │   └── bulky_booking_wizard_screen.dart # Màn hình 3 bước đặt lịch
│       │   ├── widgets/
│       │   │   ├── step_items_editor.dart           # Bước 1: Danh mục đồ & Khảo sát vật liệu
│       │   │   ├── step_logistics_editor.dart       # Bước 2: Chọn địa chỉ & Bốc xếp
│       │   │   ├── step_review_summary.dart         # Bước 3: Xem lại tổng thể
│       │   │   ├── material_survey_chips.dart       # 3 Chip chọn vật liệu 1-Click
│       │   │   └── live_pricing_bottom_bar.dart     # Thanh nổi hiển thị giá Min - Max trực tiếp
│       │   └── providers/
│       │       └── booking_wizard_provider.dart     # State machine quản lý form 3 bước
│       ├── quote/
│       │   ├── screens/
│       │   │   └── bulky_quote_screen.dart          # Màn hình chi tiết báo giá và giữ chỗ
│       │   └── widgets/
│       │       ├── quote_breakdown_card.dart        # Bảng kê cước phí từng hạng mục
│       │       └── tolerance_guarantee_banner.dart  # Banner bảo đảm dung sai ±15%
│       ├── payment/
│       │   ├── screens/
│       │   │   └── bulky_payment_screen.dart        # Màn hình cọc QR MoMo & đếm ngược 15p
│       │   └── widgets/
│       │       └── countdown_timer_widget.dart      # Bộ đếm ngược giữ chỗ
│       └── orders/
│           ├── screens/
│           │   ├── bulky_orders_list_screen.dart    # Danh sách đơn hàng cá nhân
│           │   └── bulky_order_detail_screen.dart   # Chi tiết đơn & Timeline di chuyển xe
│           └── providers/
│               └── orders_provider.dart             # Quản lý danh sách đơn từ Storage
```

---

## 3. Quy Chuẩn Domain & Thuật Toán Tính Cước (Domain & Pricing Engine)

### 3.1. Danh mục & Bảng giá Cơ sở (`bulky_constants.dart`)
```dart
enum BulkyItemCategory {
  SOFA,       // Sofa phòng khách, nỉ, da
  MATTRESS,   // Đệm lò xo, đệm cao su, bông ép
  CABINET,    // Tủ áo, kệ sách, tủ giày
  TABLE,      // Bàn ăn, bàn làm việc, ghế các loại
  OTHER,      // Đồ cồng kềnh khác, phế thải gạch ngói, ván gỗ, gương kính
}

const Map<BulkyItemCategory, int> BASE_PRICES = {
  BulkyItemCategory.SOFA: 150000,
  BulkyItemCategory.MATTRESS: 100000,
  BulkyItemCategory.CABINET: 120000,
  BulkyItemCategory.TABLE: 80000,
  BulkyItemCategory.OTHER: 60000,
};

const Map<BulkyItemCategory, int> BASE_WEIGHTS = {
  BulkyItemCategory.SOFA: 45,
  BulkyItemCategory.MATTRESS: 30,
  BulkyItemCategory.CABINET: 40,
  BulkyItemCategory.TABLE: 20,
  BulkyItemCategory.OTHER: 15,
};
```

### 3.2. Khảo sát Vật liệu 1-Click (`MaterialFactor`)
| Mã chất liệu | Nhãn hiển thị | Mô tả đồ vật | Hệ số đơn giá (`priceFactor`) | Hệ số tải trọng (`weightFactor`) |
| :--- | :--- | :--- | :---: | :---: |
| `LIGHT` | **Nhựa / Ván ép / Mút nhẹ** | Đồ nhựa, mút xốp nhẹ, nhôm gấp | **0.8** | **0.7** |
| `STANDARD` | **Gỗ MDF / Tiêu chuẩn** | Nệm thông dụng, gỗ ép công nghiệp, da tiêu chuẩn | **1.0** | **1.0** |
| `HEAVY` | **Gỗ đặc / Mặt đá / Gạch ngói** | Gạch đá vỡ, bê tông xà bần, gỗ tự nhiên khối, kính lớn | **1.3** | **1.4** |

### 3.3. Công thức Ước lượng Khoảng giá & Cam kết Dung sai
1. **Tổng phí vật dụng:**
   $$\text{ItemsBaseVnd} = \sum_{i} \left( \text{BASE\_PRICES}[category_i] \times \text{priceFactor}_i \times quantity_i \right)$$
2. **Phụ phí dịch vụ bốc xếp:**
   - Phí tháo dỡ quá khổ (`disassemblyNeeded`): **30.000 đ**.
   - Phí bốc vác tầng lầu thang bộ: **20.000 đ / tầng** (nếu không có thang máy và tầng > 0).
3. **Phí vận chuyển khu vực (Area Fee):** **25.000 đ** (cố định theo quận/huyện).
4. **Khoảng giá ước tính:**
   $$\text{MinVnd} = \text{ItemsBaseVnd} + \text{HandlingFees} + \text{AreaFee}$$
   $$\text{MaxVnd} = \text{Round}(\text{MinVnd} \times 1.3)$$
5. **Tiền cọc giữ chỗ:** $\text{DepositHoldVnd} = \text{MinVnd}$.
6. **Chính sách bảo đảm:** Chi phí quyết toán thực tế không được vượt quá $\pm 15\%$ biên độ ước tính:
   $$\text{AllowedMaxVnd} = \text{Round}(\text{MaxVnd} \times 1.15)$$

---

## 4. Đặc Tả Dịch Vụ AI Thị Giác (Gemini Vision AI Service)

### 4.1. Khả năng chịu lỗi & Luân chuyển Model (Model Fallback)
1. **Thứ tự ưu tiên model:**
   - Model 1: `gemini-2.5-flash`
   - Model 2: `gemini-3.6-flash`
2. **Cơ chế thử lại (Retry with Backoff):**
   - Khi nhận mã lỗi HTTP `503` (Server High Demand) hoặc `429` (Rate Limit):
   - Đợi 1000ms và thử lại lần thứ 2 trên cùng model trước khi chuyển sang model dự phòng.
3. **Xử lý sự cố toàn bộ:**
   - Tuyệt đối không fallback ra preset sofa giả mạo.
   - Trả về thông báo trung thực: *"Hệ thống AI hiện đang quá tải hoặc gián đoạn kết nối. Vui lòng bấm Quét lại hoặc kiểm tra/thêm danh mục đồ vật bên dưới."*

### 4.2. Quy chuẩn phân loại phế thải
- **Gạch ngói vỡ, bê tông vụn, xà bần sinh hoạt, tấm ván gỗ ép:**
  - Tự động phân loại vào nhóm **`OTHER`**.
  - Tự động gán chất liệu nặng `HEAVY` (đối với gạch ngói/bê tông) hoặc `STANDARD` (đối với ván gỗ).
  - Tự động điền danh mục đồ vật, **không đánh dấu rác cấm nguy hại**, không kích hoạt chế độ xét duyệt thủ công (`requiresManualReview = false`, `containsHazardousWaste = false`).
- **Chỉ coi là rác nguy hại cấm thu gom (`containsHazardousWaste = true`):**
  - Khi phát hiện: bình gas cháy nổ, ắc quy chì, thùng hóa chất độc, rác y tế truyền nhiễm.

### 4.3. Cấu trúc JSON Trao Đổi
```json
{
  "decision": "SUGGESTED",
  "confidence": 0.95,
  "containsHazardousWaste": false,
  "hazardousReason": "",
  "explanation": "Đã nhận diện 01 đệm lò xo cũ và phế thải gạch ngói xây dựng.",
  "items": [
    {
      "itemType": "MATTRESS",
      "displayName": "Đệm lò xo cũ",
      "suggestedQuantity": 1,
      "dimensionsCm": { "length": 190, "width": 100, "height": 20 },
      "disassemblyNeeded": false,
      "box_2d": [100, 50, 700, 950],
      "confidence": 0.96,
      "suggestedMaterial": "STANDARD"
    },
    {
      "itemType": "OTHER",
      "displayName": "Phế thải gạch ngói / xà bần",
      "suggestedQuantity": 1,
      "dimensionsCm": { "length": 80, "width": 60, "height": 30 },
      "disassemblyNeeded": false,
      "box_2d": [650, 200, 950, 800],
      "confidence": 0.91,
      "suggestedMaterial": "HEAVY"
    }
  ],
  "boundingBoxes": [
    {
      "box_2d": [100, 50, 700, 950],
      "displayName": "Đệm lò xo cũ",
      "confidence": 0.96,
      "itemType": "MATTRESS",
      "isHazardous": false,
      "suggestedMaterial": "STANDARD"
    },
    {
      "box_2d": [650, 200, 950, 800],
      "displayName": "Phế thải gạch ngói",
      "confidence": 0.91,
      "itemType": "OTHER",
      "isHazardous": false,
      "suggestedMaterial": "HEAVY"
    }
  ]
}
```

---

## 5. Thiết Kế Đồ Họa Bounding Box (`CustomPainter`)

Lớp phủ `BoundingBoxPainter` chịu trách nhiệm render các hộp nhận diện 2D phủ lên ảnh gốc:
1. **Chuyển đổi toạ độ tỉ lệ:**
   - Toạ độ gốc Gemini: `[ymin, xmin, ymax, xmax]` thang $0 \to 1000$.
   - Toạ độ Canvas:
     $$y_1 = \frac{ymin}{1000} \times \text{canvasHeight}, \quad x_1 = \frac{xmin}{1000} \times \text{canvasWidth}$$
     $$\text{width} = \frac{xmax - xmin}{1000} \times \text{canvasWidth}, \quad \text{height} = \frac{ymax - ymin}{1000} \times \text{canvasHeight}$$
2. **Bảng màu theo nhóm danh mục:**
   - `SOFA`: Xanh lục lá cây `#10b981` (Border 2.5px, Fill 12% alpha)
   - `MATTRESS`: Xanh lam biển `#2563eb` (Border 2.5px, Fill 12% alpha)
   - `CABINET`: Tím thạch anh `#9333ea` (Border 2.5px, Fill 12% alpha)
   - `TABLE`: Cam hổ phách `#f59e0b` (Border 2.5px, Fill 12% alpha)
   - `OTHER`: Xám chì than `#475569` (Border 2.5px, Fill 12% alpha)
   - `HAZARDOUS`: Đỏ cảnh báo `#ef4444` (Nét đứt, Fill 20% alpha)
3. **Tương tác chạm (Touch Event):**
   - Khi chạm vào vùng toạ độ của hộp trên màn hình, kích hoạt callback `onSelectBox(int index)`, tự động cuộn (scroll) và làm nổi bật (highlight viền xanh) thẻ đồ vật tương ứng ở danh sách bên dưới.

---

## 6. Thiết Kế Các Màn Hình Chi Tiết (UI Wireframe)

### 6.1. Màn hình 1: Wizard Đặt Lịch & Quét AI (`BulkyBookingWizardScreen`)
- **AppBar:** Tiêu đề "Đặt Thu Gom Rác Cồng Kềnh", nút chuyển đổi vai trò kiểm thử.
- **Top Segmented Stepper:**
  - `[1: Đồ vật & Ảnh]` ➔ `[2: Địa điểm & Bốc xếp]` ➔ `[3: Xác nhận]`
- **Khu vực Chụp/Chọn ảnh:**
  - Nút chụp từ Camera, nút chọn từ Thư viện ảnh, hàng nút Preset ảnh mẫu (Sofa da, Nệm lò xo, Tủ gỗ 3 cánh, Rác phế thải).
  - Vùng hiển thị ảnh chụp kèm `CustomPaint` vẽ Bounding Box có công tắc bật/tắt hiển thị khung nhận diện.
- **Banner Trợ lý AI:**
  - Nút bấm `[✨ Quét với AI]` kèm trạng thái loading xoay vòng.
  - Thông báo thành công: `✓ Đã nhận diện X món đồ và tự động điền thông tin bên dưới`.
- **Danh sách thẻ đồ vật:**
  - Dropdown chọn loại cước (`Sofa`, `Nệm`, `Tủ`, `Bàn ghế`, `Đồ cồng kềnh khác / Phế thải`).
  - Ô nhập tên đồ vật tiếng Việt, cụm tăng giảm số lượng `[-] 1 [+]`, kích thước D x R x C (cm).
  - Khảo sát vật liệu 3 chip: `[Nhựa/Ván nhẹ]`, `[MDF/Tiêu chuẩn]`, `[Gỗ đặc/Đá/Nặng]`.
  - Khối lượng ước tính nhảy động: `~X kg / chiếc`.
- **Bottom Bar Cố Định:**
  - Hiển thị: "Ước tính: **180.000 đ - 234.000 đ** | Tổng tải: ~65 kg".
  - Nút `[Tiếp tục]` (Disabled nếu chưa có ảnh hoặc chưa có đồ vật).

### 6.2. Màn hình 2: Báo Giá & Giữ Chỗ (`BulkyQuoteScreen`)
- **Card Trạng thái xe gom:** Badge xanh lá `✓ Ngày YYYY-MM-DD có xe cẩu chuyên dụng sẵn sàng phục vụ`.
- **Card Bảng kê chi phí:**
  - Danh mục từng món đồ: Tên món, số lượng, chất liệu, thành tiền.
  - Phụ phí tháo dỡ/bốc vác thang bộ.
  - Phí xe khu vực: 25.000 đ.
  - Tổng cước dự kiến: `[Min] đ - [Max] đ`.
  - **Tiền cọc giữ chỗ (Cần thanh toán ngay):** `[Min] đ`.
- **Tolerance Guarantee Banner:** Thông báo cam kết dung sai $\pm 15\%$, nếu quá tải thực tế xe sẽ thông báo trước khi bốc dỡ.
- **Nút hành động:** `[LẤY BÁO GIÁ & GIỮ CHỖ]`.

### 6.3. Màn hình 3: Thanh Toán Cọc Giữ Chỗ (`BulkyPaymentScreen`)
- **Timer Banner:** `Thời gian giữ chỗ còn lại: 14:59` (Đếm ngược 15 phút, đổi màu vàng cam).
- **Mã QR MoMo / VietQR:** Tạo QR động dựa trên mã đơn và số tiền cọc.
- **Nút Mô phỏng:** `[Mô phỏng Thanh toán Thành công]` để chuyển thẳng đơn sang trạng thái `CONFIRMED`.

### 6.4. Màn hình 4: Quản Lý Đơn & Chi Tiết Lộ Trình (`BulkyOrdersListScreen` & `BulkyOrderDetailScreen`)
- Tab phân loại đơn: `Tất cả`, `Chờ lấy`, `Hoàn thành`.
- Timeline đơn hàng 4 chặng:
  1. `Đã đặt cọc giữ chỗ` (Thành công)
  2. `Đã điều phối xe cẩu` (Biển số xe: 51C-889.21)
  3. `Đang di chuyển đến hộ dân`
  4. `Đã thu gom & hoàn tất quyết toán`

---

## 7. Kế Hoạch Kiểm Thử (Testing & Verification Strategy)

1. **Unit Test (Dart test):**
   - Kiểm thử thuật toán `pricing_engine_test.dart`: Kiểm tra tính toán cước với các hệ số vật liệu `LIGHT`, `STANDARD`, `HEAVY`, dung sai $\pm 15\%$, và phí bê vác thang bộ.
   - Kiểm thử `gemini_vision_service_test.dart`: Mock API HTTP response, kiểm tra phân loại `OTHER` cho gạch ngói, kiểm tra retry 503, và kiểm tra parse toạ độ `box_2d`.
2. **Widget Test (Flutter test):**
   - Kiểm thử `bounding_box_painter_test.dart`: Kiểm tra tỷ lệ vẽ bounding box trên canvas.
   - Kiểm thử `booking_wizard_test.dart`: Kiểm tra luồng chuyển 3 bước, thao tác bấm đổi chip vật liệu và cập nhật tổng tiền.
3. **End-to-End Test trên Máy ảo / Desktop:**
   - Chạy lệnh `flutter run -d linux` (hoặc khởi động máy ảo Android `Medium_Phone` qua `flutter emulators --launch Medium_Phone && flutter run -d android`).
   - Kiểm tra luồng: Chọn ảnh mẫu ➔ Quét AI hiển thị bounding box ➔ Chỉnh vật liệu ➔ Báo giá ➔ Thanh toán cọc ➔ Xem đơn hàng hoàn tất.
