# Thiết Kế Hệ Thống UI/UX Mobile Eco-Tech - Smartbin Bulky

- **Ngày ban hành:** 2026-09-26
- **Tác giả:** Dev-EnglandLee (Developer 3)
- **Nhánh thực hiện:** `dev-EnglandLee`
- **Trạng thái:** Đã phê duyệt (Approved)
- **Mục tiêu:** Tái thiết kế toàn diện trải nghiệm giao diện người dùng (UI/UX) ứng dụng di động Flutter, tích hợp tinh hoa từ 3 mẫu thiết kế hàng đầu Dribbble (**LazyInterface**, **Deepthi N Anekal**, **Nixtio**) theo phong cách **Eco-Tech Hiện Đại**.

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ

### 1.1. Hiện trạng
- Ứng dụng di động Smartbin Bulky trong thư mục `mobile/` đã hoàn thiện đầy đủ nghiệp vụ:
  - Nhận diện ảnh AI đa phương thức với tọa độ khung định vị `box_2d` và đề xuất chất liệu (`LIGHT`, `STANDARD`, `HEAVY`).
  - Động cơ định giá động tính cước minh bạch theo dải Min-Max, tiền cọc giữ chỗ xe tải thu gom và chính sách cam kết bảo vệ giá dung sai $\pm 15\%$.
  - Phân quyền 3 vai trò (RBAC): Cư dân (Citizen), Điều phối viên (Operator), Tài xế thu gom (Driver).
  - Quy trình phê duyệt đơn hàng: Đặt cọc $\to$ Kiểm duyệt & Phê duyệt $\to$ Điều xe & Lộ trình thu gom.
  - Toàn bộ 86 bài kiểm thử tự động đang vượt qua (86/86 tests passing).

### 1.2. Mục tiêu cải tiến UI/UX
- Nâng tầm toàn diện thẩm mỹ từ dạng khung chức năng sang chuẩn di động quốc tế:
  1. **LazyInterface (Garbage Recycling App):** Tinh thần Eco-modern, sắc thái xanh lục bảo (Emerald) & bạc hà (Mint), các thẻ bo cong mềm mại (20px), huy hiệu sinh thái, số liệu tác động CO₂ & Điểm Xanh.
  2. **Deepthi N Anekal (Waste Collection Schedule):** Dải lịch thu gom tuần ngang (T2–CN) nổi bật ngày hiện tại, hệ thống tag phân loại rác theo màu quy chuẩn quốc tế, chỉ số định vị khoảng cách xe thu gom tiếp cận theo thời gian thực.
  3. **Nixtio (Waste Management Mobile UI):** Thẻ đo lường viễn thám IoT thông minh (Thanh đo độ đầy chuyển sắc gradient, cảm biến mùi, dung lượng pin, kết nối nhịp thở trực tuyến), tương tác ngắm ảnh camera AI bounding box hai chiều.
- Duy trì 100% tiếng Việt cho nhãn, thông báo, tiền tệ VNĐ.
- Không gây hồi quy (Zero regressions) đối với 86 bài kiểm thử hiện có.

---

## 2. Hệ Thống Design System Tokens (Visual Foundation)

### 2.1. Bảng màu Sinh thái & Công nghệ (Eco-Tech Palette)
* **Màu sắc thương hiệu chủ đạo:**
  * `BulkyColors.primary`: `#059669` (Emerald 600 - Xanh lục bảo sang trọng).
  * `BulkyColors.primaryLight`: `#10B981` (Emerald 500 - Điểm nhấn hover / active).
  * `BulkyColors.primaryContainer`: `#ECFDF5` (Emerald 50 - Nền nhạt cho icon, container).
  * `BulkyColors.accentMint`: `#34D399` (Mint sáng dùng làm gradient viền và đồ họa tiến độ).
* **Bề mặt & Nền (Surfaces & Background):**
  * `BulkyColors.background`: `#F8FAFC` (Slate 50 - Chống lóa, chiều sâu hiện đại).
  * `BulkyColors.surface`: `#FFFFFF` (Nền thẻ card trắng sắc nét).
  * `BulkyColors.border`: `#E2E8F0` (Slate 200 - Viền vi mảnh 1px).
  * `BulkyColors.textPrimary`: `#0F172A` (Slate 900 - Đen than chì dễ đọc).
  * `BulkyColors.textSecondary`: `#64748B` (Slate 500 - Xám ghi cho thông tin phụ).
* **Mã màu phân loại rác quy chuẩn (Deepthi Schedule):**
  * ♻️ Rác Tái chế: `#2563EB` (Nền `#DBEAFE`).
  * 🍏 Rác Hữu cơ: `#16A34A` (Nền `#DCFCE7`).
  * 🛋️ Rác Cồng kềnh: `#EA580C` (Nền `#FFEDD5`).
  * ⚠️ Rác Nguy hại: `#DC2626` (Nền `#FEE2E2`).
* **Thang màu đo lường IoT Telemetry (Nixtio Smart Gauge):**
  * `< 50%`: Gradient `#10B981` $\to$ `#059669` (Xanh an toàn).
  * `50% - 80%`: Gradient `#F59E0B` $\to$ `#D97706` (Vàng hổ phách cảnh báo).
  * `> 80%`: Gradient `#EF4444` $\to$ `#B91C1C` (Đỏ rực sắp tràn).

### 2.2. Ngôn ngữ tạo hình & Chiều sâu
* **Góc bo (Border Radius):** Thẻ card chính: `20px`; Chip tag / Filter: `24px` (dáng con nhộng pill); Nút bấm CTA: `14px`, chiều cao chuẩn `52px`.
* **Đổ bóng (Ambient Elevation):** `BoxShadow(color: Color(0x0A000000), blurRadius: 16, offset: Offset(0, 4))` - khử bỏ bóng xám đen cũ, tạo cảm giác mượt mà, bay bổng.

---

## 3. Kiến Trúc Màn Hình & Trải Nghiệm Chi Tiết

### 3.1. Màn hình Trang Chủ Cư Dân (`CitizenHomeScreen`)
- **Header:** Logo `SMARTBIN CITIZEN` với đèn xanh IoT trực tuyến, chuông thông báo có badge số đỏ, chip avatar hồ sơ cư dân kèm mã hộ `HH-78921`.
- **Thẻ Hero IoT Telemetry (Nixtio):**
  - Mức đầy dạng thanh đo viễn thám chuyển sắc với tỷ lệ 68%.
  - Trạng thái mùi: 🍃 `Bình thường`.
  - Pin cảm biến: ⚡ `92%`.
  - Cập nhật: 🕒 `5 phút trước` kèm huy hiệu `IoT Online` xanh lục.
- **Dải Lịch Thu Gom Tuần Ngang (Deepthi):**
  - Thanh cuộn 7 ngày trong tuần `[T2, T3, T4, T5, T6, T7, CN]`, nổi bật ngày hôm nay.
  - Phân loại rác hôm nay với tag màu sinh thái (🍏 Rác hữu cơ, ♻️ Rác tái chế định kỳ).
  - Thẻ định vị xe thu gom thời gian thực: `🚚 Xe số 03 đang đến thu gom • Cách bạn 1.2 km (Khoảng 8 phút nữa)`.
- **Lưới 2x2 Hành Động Nhanh (LazyInterface):**
  1. `🛋️ ĐẶT THU RÁC CỒNG KỀNH (AI)`: Chuyển sang Tab Wizard.
  2. `💳 PHÍ THÁNG & NỢ`: Mở Modal cước vệ sinh môi trường tháng 09 (45.000 đ).
  3. `🎁 ĐỔI ĐIỂM XANH`: Mở Modal đổi quà ví Điểm Xanh (120 điểm • Hạng Bạc).
  4. `📢 PHẢN ÁNH THÙNG`: Mở Hộp thoại báo cáo thùng quá tải / bốc mùi.
- **Thẻ Đóng Góp Môi Trường (Eco Impact):**
  - Số liệu sinh thái: `34.5 kg rác phân loại` & `6.8 kg CO₂ giảm thiểu` (~0.4 cây xanh tương đương).

### 3.2. Quy Trình Đặt Thu Gom Rác Cồng Kềnh (`BulkyBookingWizardScreen`)
- **Pill Stepper 3 Bước:** `1. Đồ vật & Ảnh` $\to$ `2. Địa điểm & Thời gian` $\to$ `3. Xác nhận & Báo giá`.
- **Bước 1 - Khung ngắm Camera AI & Bounding Box (`StepItemsEditor`):**
  - Viewfinder bo cong 20px với góc quét hiện đại.
  - Bounding Box vẽ bằng `CustomPainter`, hiển thị tên tiếng Việt và độ tin cậy AI.
  - Tương tác 2 chiều (Bidirectional Highlighting): Chạm hộp AI trên ảnh làm sáng thẻ đồ vật bên dưới và ngược lại.
  - Nút chọn preset chụp mẫu: "Sofa da", "Nệm King Size", "Tủ gỗ 3 cánh".
  - Thẻ đồ vật với bộ chọn chất liệu 1-chạm (`LIGHT`, `STANDARD`, `HEAVY`) và bước nhảy số lượng `[-] 1 [+]`.
- **Bước 2 - Địa điểm & Vận chuyển (`StepLogisticsEditor`):**
  - Địa chỉ thu gom (Gợi ý nhanh địa chỉ hộ gia đình).
  - Chọn ngày (`Hôm nay`, `Ngày mai`, chọn lịch) và khung giờ (4 khung giờ chuẩn).
  - Tùy chọn xếp dỡ: Vỉa hè (Miễn phí) vs Trong nhà (Thang máy miễn phí / Thang bộ +20k/tầng / Tháo dỡ +30k).
- **Bước 3 - Tổng kết & Bảo vệ giá (`StepReviewSummary`):**
  - Tóm tắt danh mục đồ vật, tổng khối lượng, địa chỉ và khung giờ.
  - Dải giá ước tính Min - Max và số tiền cọc giữ chỗ xe thu gom.
  - Banner Cam kết bảo vệ giá (Dung sai $\pm 15\%$).
- **Thanh báo giá động gắn đáy (`LivePricingBottomBar`):**
  - Thể hiện mức giá hiện thời, tiền cọc và nút xem chi tiết bảng giá.

### 3.3. Màn Hình Báo Giá, Thanh Toán QR & Theo Dõi Đơn Hàng
- **`BulkyQuoteScreen`:**
  - Bảng bóc tách chi phí minh bạch từng hạng mục.
  - Banner bảo vệ giá dung sai $\pm 15\%$.
  - Hàng nút hành động: `[Quay lại]` và `[Tiến hành đặt cọc giữ chỗ ➔]`.
  - Tích hợp thanh điều hướng cố định dưới đáy (`BulkyAppBottomNavBar`).
- **`BulkyPaymentScreen`:**
  - Đồng hồ đếm ngược 15 phút (`CountdownTimerWidget`).
  - Thẻ VietQR / MoMo chuyên nghiệp với tính năng sao chép 1-chạm.
  - Nút `[Xác nhận đã thanh toán cọc]` kích hoạt xác thực và lưu đơn.
- **`BulkyOrdersListScreen`:**
  - Bộ lọc trạng thái pill chip: `Tất cả`, `Đang xử lý`, `Đã hoàn tất`.
  - Thẻ đơn hàng sắc nét với mã đơn, thời gian và huy hiệu trạng thái.
- **`BulkyOrderDetailScreen`:**
  - Quy trình 5 bước theo thời gian thực (Đã cọc $\to$ Kiểm duyệt $\to$ Đã xếp xe $\to$ Đang lấy $\to$ Hoàn tất).
  - Banner thông báo kiểm duyệt dành cho cư dân.
  - Thẻ thông tin xe tải & tài xế thu gom.
  - Khu vực phê duyệt / từ chối dành riêng cho Điều phối viên (Operator).

### 3.4. Cổng Quản Trị Phân Quyền (Operator, Driver & Account)
- **`BulkyOperatorScreen`:**
  - Thống kê chỉ số KPI: Đơn chờ duyệt, xe trên tuyến, khối lượng thu gom.
  - Hộp thoại Phê duyệt & Điều xe tải chuyên dụng (`51C-889.21 (Xe tải 2.5T)`).
  - Hộp thoại Từ chối & Hoàn trả cọc.
- **`BulkyDriverScreen`:**
  - Thẻ chuyến xe đang thực hiện, nút gọi cư dân và nút cập nhật trạng thái lấy rác tại hiện trường.
- **`BulkyAccountScreen`:**
  - Hồ sơ cư dân, điểm thưởng Điểm Xanh.
  - Bộ chuyển đổi vai trò 1-chạm (RBAC Role Switcher: Citizen $\longleftrightarrow$ Operator $\longleftrightarrow$ Driver).

---

## 4. Quản Lý Trạng Thái & Dữ Liệu
- Sử dụng `Provider` (`AuthProvider`, `ScanProvider`, `BookingWizardProvider`, `OrdersProvider`).
- Dữ liệu lưu trữ bền vững qua `MockBulkyStorage` trên nền tảng `SharedPreferences`.
- Tự động sinh dữ liệu mẫu ban đầu (2 đơn hàng: 1 đang chờ thực hiện, 1 đã hoàn tất) khi khởi chạy lần đầu.

---

## 5. Chiến Lược Kiểm Thử & Đảm Bảo Chất Lượng
1. **Kiểm thử Widget & Tích hợp:**
   - Bảo toàn 100% các `Key` định danh của widget phục vụ kiểm thử tự động.
   - Giữ nguyên các chuỗi hiển thị quan trọng để đảm bảo 86/86 bài kiểm thử hiện có tiếp tục vượt qua.
2. **Kiểm thử Tĩnh (Static Analysis):**
   - Đảm bảo `flutter analyze` đạt 0 lỗi (0 warnings, 0 errors).
3. **Môi trường Trực quan (Visual Verification):**
   - Ứng dụng chạy trực tiếp trên máy chủ Flutter Web Chrome (`http://localhost:8080/`).
