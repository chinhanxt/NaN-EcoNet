# Thiết Kế Tinh Gọn Quy Trình Đặt Lịch Thu Gom Rác Cồng Kềnh (3-Step Bulky Booking Wizard)

- **Ngày ban hành:** 2026-09-17
- **Phân hệ:** Bulky Waste Collection (Dev 3 - EnglandLee)
- **Mục tiêu:** Tinh gọn từ quy trình 6 bước phân mảnh sang quy trình 3 bước trực quan, tích hợp AI Vision tại chỗ, tối ưu trải nghiệm công dân số (GovTech UX).

---

## 1. Hiện Trạng & Vấn Đề (Problem Statement)
Quy trình hiện tại bao gồm 6 bước rời rạc trong `BulkyRequestWizard.jsx`:
1. `Bước 0`: Chọn địa điểm & Ngày thu gom
2. `Bước 1`: Tải ảnh đồ đạc lên
3. `Bước 2`: Bấm nút chạy Gemini AI nhận diện
4. `Bước 3`: Chỉnh sửa / xác nhận danh mục đồ và kích thước
5. `Bước 4`: Khai báo điều kiện bốc xếp (vị trí, lầu, thang máy)
6. `Bước 5`: Xem lại thông tin và xác nhận gửi đơn

### Nhược điểm:
- Cụm `Bước 1 -> Bước 2 -> Bước 3` gây cảm giác chờ đợi và thao tác thừa: Người dùng phải tải ảnh ở bước 1, bấm Next sang bước 2 để bấm nút phân tích AI, rồi lại bấm Next sang bước 3 để thấy danh mục đồ.
- Việc tách riêng `Địa điểm (Bước 0)` và `Điều kiện bốc xếp (Bước 4)` làm phân tán thông tin hậu cần vận chuyển xe gom rác.

---

## 2. Kiến Trúc Quy Trình 3 Bước Mới (Streamlined 3-Step Wizard)

```
┌────────────────────────────────────────────────────────────────────────┐
│ BƯỚC 1: 📸 Chụp ảnh & AI Quét đồ trực tiếp                            │
│  - Tải ảnh / Kéo thả ảnh đồ đạc cũ (1–3 ảnh)                           │
│  - Gemini Vision AI quét tự động / 1-click                              │
│  - Hiển thị & chỉnh sửa danh mục đồ (Bàn, Ghế, Sofa...) ngay bên dưới  │
│  - Hỗ trợ thêm đồ thủ công hoặc xóa/sửa số lượng, kích thước           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BƯỚC 2: 📍 Địa điểm & Điều kiện bốc xếp                                │
│  - Địa chỉ thu gom (Gợi ý sẵn từ Hộ gia đình hoặc nhập mới)             │
│  - Ngày mong muốn thu gom (Lịch Date Picker)                           │
│  - Vị trí để rác (Mặt đường, Trong nhà, Ban công...)                   │
│  - Điều kiện tầng lầu & Có thang máy hay không                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BƯỚC 3: 📋 Xem lại & Báo giá minh bạch                                 │
│  - Thẻ tóm tắt toàn bộ thông tin đơn hàng                              │
│  - Ước tính chi phí sơ bộ theo bảng giá chuẩn                          │
│  - Nút bấm chính: "Xác nhận & Giữ chỗ xe thu gom"                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Từng Bước (Component Breakdown)

### Bước 1: `StepItemsCapture` — Chụp ảnh & AI Quét đồ tức thì
- **Đầu vào:**
  - Kéo thả file ảnh hoặc nút chụp ảnh từ máy ảnh / thư viện.
  - Hỗ trợ xem trước (thumbnail), nút xóa ảnh.
- **Tích hợp AI Vision:**
  - Tự động kích hoạt `analyzeBulkyWasteWithGemini` khi ảnh được tải lên (hoặc nút bấm nổi bật "✨ AI Nhận diện ngay").
  - Thanh trạng thái / loading spinner nhẹ nhàng khi AI đang đọc ảnh.
- **Danh mục đồ tương tác ngay tại chỗ:**
  - Nhận diện đồ đạc và hiển thị trực tiếp danh sách các thẻ đồ vật.
  - Tên đồ cụ thể (ví dụ: Bàn tròn, Ghế ăn...), nhóm thanh toán (TABLE, CHAIR, SOFA...), kích thước (D x R x C cm).
  - Nút thêm đồ thủ công cho người dùng muốn khai báo thêm vật phẩm chưa có trong ảnh.
- **Validation Bước 1:**
  - Danh sách đồ (`confirmedItems`) phải có ít nhất 1 món đồ hợp lệ.

### Bước 2: `StepLogistics` — Địa điểm & Điều kiện bốc xếp
- **Địa điểm thu gom:**
  - Dropdown chọn địa điểm đã lưu trong Hộ gia đình hoặc nhập địa chỉ mới.
- **Ngày thu gom mong muốn:**
  - Ô chọn ngày (chỉ cho phép chọn từ ngày mai trở đi).
- **Điều kiện bốc xếp:**
  - Vị trí tập kết rác (Vỉa hè / Mặt đường / Trong nhà).
  - Tầng lầu (0 nếu tầng trệt).
  - Switch: "Có thang máy vận chuyển" (tự động bật nếu tầng > 0 và có thang máy chung cư).
- **Validation Bước 2:**
  - Phải có `serviceLocationId` và `requestedDate` hợp lệ (YYYY-MM-DD).

### Bước 3: `StepReviewSubmit` — Xem lại & Xác nhận gửi đơn
- **Tóm tắt tổng thể:**
  - 1 Card hiển thị thông tin địa điểm, ngày hẹn và điều kiện bốc xếp.
  - 1 Card hiển thị các ảnh đã chụp và danh mục đồ kèm kích thước.
  - Dự toán chi phí tạm tính minh bạch theo biểu phí dịch vụ công.
- **Hành động:**
  - Nút "Quay lại" để chỉnh sửa bước trước.
  - Nút "Xác nhận & Giữ chỗ" (`handleSubmit`) -> Tạo đơn draft trên Redux store và chuyển sang trang Báo giá & Thanh toán (`/bulky/quote/:orderId`).

---

## 4. Tương Thích Kỹ Thuật (Contracts & Tests)
1. **Redux Store Payload:**
   - Hoàn toàn giữ nguyên cấu trúc gửi lên:
     ```javascript
     {
       serviceLocationId: string,
       requestedDate: string,
       imageMetadata: Array<{ imageId, url, filename }>,
       confirmedItems: Array<{ catalogItemCode, displayName, quantity, dimensionsCm }>,
       handlingConditions: { placement, floorNumber, hasLift }
     }
     ```
2. **Validation Rules (`requestValidation.js`):**
   - Giữ nguyên tính toàn vẹn của các hàm `validateRequestLocation`, `validateRequestItems`, `validateHandlingConditions`, `validateCanProceedToQuote`.
3. **Test Suite:**
   - Cập nhật các bài test trong `BulkyRequestWizard.jsx` và `BulkyBookingPage.test.jsx` theo 3 bước mới.
   - Đảm bảo 100% test files (13/13) và toàn bộ 78+ tests đều tiếp tục vượt qua thành công.
