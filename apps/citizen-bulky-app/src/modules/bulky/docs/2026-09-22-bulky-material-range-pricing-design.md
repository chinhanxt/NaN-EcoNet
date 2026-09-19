# Thiết Kế Kỹ Thuật: Hệ Thống Khoảng Giá Dự Toán (Min - Max), Khảo Sát Chất Liệu 1-Chạm & Cơ Chế Giảm Thiểu Rủi Ro Định Giá

- **Ngày ban hành:** 2026-09-22
- **Tác giả:** Dev-EnglandLee (Developer 3)
- **Phân hệ:** Thu gom rác cồng kềnh (`src/modules/bulky/`)
- **Trạng thái:** Đã phê duyệt thiết kế (Design Approved)

---

## 1. Bối cảnh & Vấn đề Nghiệp vụ

### 1.1. Vấn đề thực tế
Trước đây, hệ thống tính cước thu gom rác cồng kềnh dựa trên một mức giá cố định duy nhất (`totalVnd`) sau khi quét ảnh. Tuy nhiên, trong thực tế vật lý:
- Ảnh chụp 2D **không thể xác định được khối lượng bên trong** của đồ vật. Một chiếc bàn gỗ ép rỗng ruột chỉ nặng ~15 kg, nhưng cùng kích thước bằng gỗ lim/mặt đá có thể nặng tới 70-80 kg.
- Nếu hệ thống chốt giá cứng cố định (Fixed Price):
  - *Đoán thiếu:* Người dân trả ít, tài xế đến nơi từ chối chở vì quá tải hoặc lỗ công bốc xếp, gây hủy đơn và tranh cãi.
  - *Đoán thừa:* Giá quá cao khiến người dân bỏ nền tảng.
- Repository YOLOv11 mà người dùng khảo sát (`joaopferreira19/Food-Waste-Detection-using-YOLOv11`) là mô hình nghiên cứu chuyên biệt cho thức ăn thừa trên khay ăn canteen, không có dữ liệu cho đồ nội thất dân dụng.

### 1.2. Mục tiêu giải pháp
1. **Chuyển đổi sang Khoảng giá dự toán (Estimated Price Range: Min - Max):** Người dân thanh toán trước số tiền tạm tính giữ chỗ (mức Min), hiển thị rõ trần giá (Max) để minh bạch kỳ vọng.
2. **Khảo sát chất liệu 1-chạm (1-Click Material Survey):** Ngay sau khi AI quét hoặc khi thêm đồ, hiển thị 3 nút chọn chất liệu trực quan (Nhựa/Ván ép, Gỗ MDF/Chuẩn, Gỗ đặc/Đá) để cập nhật ngay khối lượng ước tính và hệ số đơn giá.
3. **Cơ chế Dung sai Nghiệm thu $\pm 15\%$ & Đối soát Bàn giao (On-site Reconciliation):** Bảo đảm không phụ thu nếu sai lệch trong ngưỡng $\pm 15\%$, và có cơ chế xử lý rõ ràng nếu phát sinh chênh lệch lớn khi tài xế đến nhận hàng.
4. **Chuẩn bị nền tảng cho Giai đoạn 2 (YOLO11 Object Detection):** Xây dựng cấu trúc dữ liệu tương thích để sau này tích hợp mô hình YOLO11 vẽ bounding box trực quan lên ảnh.

---

## 2. Cấu Trúc Dữ Liệu & Công Thức Tính Toán

### 2.1. Phân loại chất liệu (`material`)
Mỗi món đồ trong `confirmedItems` được bổ sung trường `material`:

| Mã (`material`) | Nhãn tiếng Việt | Mô tả & Loại đồ tiêu biểu | Hệ số giá (`priceFactor`) | Hệ số khối lượng (`weightFactor`) |
|---|---|---|---|---|
| `LIGHT` | 🪶 Nhẹ (Nhựa / Ván ép / Mút) | Bàn nhựa, ghế xoay văn phòng, tủ vải, nệm mút, ván ép mỏng | `0.85` | `0.70` |
| `STANDARD` | 🪵 Tiêu chuẩn (Gỗ MDF / Kim loại rỗng) | Bàn ghế gỗ công nghiệp, kệ sắt, tủ quần áo MDF thông dụng | `1.00` | `1.00` |
| `HEAVY` | 🪨 Nặng (Gỗ tự nhiên đặc / Mặt đá / Kính) | Bàn ăn mặt đá, gỗ lim/gõ đỏ nguyên khối, tủ kính cường lực | `1.35` | `1.80` |

### 2.2. Công thức tính Khoảng giá trong `pricing.js`
- **Đơn giá từng món:**
  ```javascript
  const material = item.material || 'STANDARD';
  const priceFactor = MATERIAL_FACTORS[material]?.priceFactor || 1.0;
  const itemMinVnd = Math.round(unitPriceVnd * quantity * priceFactor);
  const itemMaxVnd = Math.round(itemMinVnd * 1.30); // 30% spread cho dung sai kích thước & bốc vác
  ```
- **Tổng đơn hàng:**
  - $\text{subtotalMinVnd} = \sum \text{itemMinVnd}$
  - $\text{subtotalMaxVnd} = \sum \text{itemMaxVnd}$
  - $\text{totalMinVnd} = \text{subtotalMinVnd} + \text{Phụ phí bốc xếp lầu} + \text{Phụ phí tháo dỡ} + \text{Phụ phí xe/khu vực}$
  - $\text{totalMaxVnd} = \text{subtotalMaxVnd} + \text{Phụ phí bốc xếp lầu} + \text{Phụ phí tháo dỡ} + \text{Phụ phí xe/khu vực}$
- **Mức giữ chỗ tạm tính (`depositHoldVnd`):**
  $$\text{depositHoldVnd} = \text{totalMinVnd}$$
- **Đối tượng `quote` mở rộng:**
  ```javascript
  {
    quoteId: "quote-...",
    subtotalVnd: totalMinVnd,
    totalVnd: totalMinVnd,
    estimatedRange: {
      minVnd: totalMinVnd,
      maxVnd: totalMaxVnd,
      depositHoldVnd: totalMinVnd
    },
    tolerancePolicy: {
      allowedPercent: 15,
      message: "Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo."
    }
  }
  ```

---

## 3. Thiết Kế Trải Nghiệm Giao Diện Người Dùng (UI/UX)

### 3.1. Thẻ đồ vật tại Bước 1 (`BulkyRequestWizard.jsx`)
- Hiển thị thông tin đồ vật: Tên, biểu tượng, số lượng, kích thước.
- Ngay dưới thông tin đồ vật là cụm nút chọn chất liệu:
  - 3 Chip/Button: `[🪶 Nhựa / Ván ép]` | `[🪵 Gỗ MDF / Chuẩn]` | `[🪨 Gỗ đặc / Mặt đá]`
  - Khi người dùng chạm:
    - Cập nhật tức thì `item.material`.
    - Tính lại khối lượng ước tính: `estimatedWeightKg = baseWeight * weightFactor`.
- Thanh tóm tắt nổi (Floating Summary Bar) cập nhật thời gian thực:
  > **Khoảng giá dự toán:** `180.000đ – 240.000đ` • **Tạm tính giữ chỗ:** `180.000đ`  
  > 🛡️ *Bảo đảm dung sai ±15% khi bàn giao thực tế.*

### 3.2. Bước 3: Xem lại & Báo giá (`BulkyRequestWizard.jsx` & `BulkyQuotePage.jsx`)
- Bảng danh sách đồ hiển thị rõ chất liệu đã chọn kèm icon tương ứng.
- Khung tổng kết giá 2 tầng:
  1. Khoảng giá dự toán toàn đơn: `Min – Max`.
  2. Số tiền thanh toán tạm giữ chỗ: `Min`.
- Banner cam kết minh bạch:
  > 🛡️ **Chính sách nghiệm thu Smartbin:**  
  > *Tài xế sẽ kiểm tra nhanh chất liệu và kích thước khi nhận đồ. Nếu sai lệch thực tế nằm trong ngưỡng $\pm 15\%$, đơn hàng giữ nguyên mức thanh toán tạm tính ban đầu, tuyệt đối không phụ thu.*

### 3.3. Trang Chi tiết Đơn hàng (`BulkyOrderDetailPage.jsx`)
- Hiển thị rõ:
  - Trạng thái thanh toán: Đã tạm giữ chỗ (Deposit Held).
  - Khoảng giá dự kiến đã cam kết ban đầu: `Min – Max`.
  - Trạng thái nghiệm thu bàn giao: `VERIFIED_WITHIN_TOLERANCE` (Đạt dung sai) / `PENDING_ON_SITE_REVIEW` (Chờ nghiệm thu tại chỗ).

---

## 4. Nghiệp Vụ Nghiệm Thu Hiện Trường (On-Site Reconciliation)

1. **Khớp hoặc sai lệch $\le 15\%$:**
   - Trạng thái: `VERIFIED_WITHIN_TOLERANCE`.
   - Giữ nguyên số tiền tạm tính `depositHoldVnd`. Đơn hàng chuyển sang `COMPLETED`.
2. **Thực tế nhẹ hơn / giảm đồ:**
   - Trạng thái: `REFUND_DISCREPANCY`.
   - Tự động hoàn phần chênh lệch về tài khoản của cư dân.
3. **Phát sinh vượt quá $15\%$ (thêm đồ hoặc đồ nặng đặc biệt):**
   - Trạng thái: `SUPPLEMENTAL_REVIEW`.
   - Tài xế tạo yêu cầu phụ thu bổ sung trên app điều phối.
   - Cư dân nhận thông báo xác nhận: Nếu đồng ý thì thanh toán phần phụ thu; nếu không đồng ý thì tài xế chỉ thu gom đúng các món đã đăng ký ban đầu.

---

## 5. Chiến Lược Kiểm Thử (Testing Strategy)

1. **Unit Tests (`pricing.test.js` / `domain.test.js`):**
   - Kiểm tra `calculateQuote` trả về `estimatedRange` chính xác cho `LIGHT`, `STANDARD`, `HEAVY`.
   - Kiểm tra công thức trần giá `maxVnd` và mức tạm giữ chỗ `depositHoldVnd`.
2. **Component Tests (`BulkyRequestWizard.test.jsx` / `BulkyBookingPage.test.jsx`):**
   - Kiểm tra bấm nút chọn chất liệu cập nhật đúng state và khối lượng hiển thị.
   - Kiểm tra hiển thị khoảng giá Min - Max tại Bước 1 và Bước 3.
3. **Regression Tests:**
   - Đảm bảo toàn bộ 14 test suites hiện tại của `src/modules/bulky/` tiếp tục PASS 100%.
   - Đảm bảo `npm run build` thành công không lỗi.
