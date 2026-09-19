# HƯỚNG DẪN DÀNH CHO AI ASSISTANT & DEV 3 (EnglandLee)
**Nhánh Git:** `dev-EnglandLee`  
**Vai trò:** Developer 3 - Citizen Portal, Billing Automation, Debt Reminders & Bulky Waste Service  
**Tài liệu tham chiếu:** [quy-trinh-thu-gom-iot-traccar-ai (1).pdf](file:///home/congnghiep/nghich/Smartbin/quy-trinh-thu-gom-iot-traccar-ai%20%281%29.pdf) (Trọng tâm: **Trang 08, 09, 10, 11, 12, 13**)  
**Quy tắc chung toàn team:** [TEAM_WORKFLOW_RULES.md](file:///home/congnghiep/nghich/Smartbin/TEAM_WORKFLOW_RULES.md)

---

> [!IMPORTANT]
> ### CHỈ THỊ BẮT BUỘC CHO TẤT CẢ AI ASSISTANT LÀM VIỆC TRÊN NHÁNH NÀY:
> 1. Bạn đang hỗ trợ **DEV 3 (EnglandLee)** trên nhánh `dev-EnglandLee`.
> 2. **CHỈ ĐƯỢC PHÉP** tạo mới và chỉnh sửa mã nguồn trong phạm vi thư mục được phân quyền cho Dev 3:
>    * `src/modules/citizen/` (Cổng thông tin hộ gia đình, mã thùng, phản ánh chất lượng, lịch xe đến)
>    * `src/modules/billing/` (Bảng kê phí tháng, cổng thanh toán MoMo/QR, đối soát, luồng nhắc nợ D+3/D+7/D+14 và tạm ngừng dịch vụ)
>    * `src/modules/bulky/` (Dịch vụ đặt thu rác cồng kềnh, AI nhận diện ảnh sofa/nệm/tủ, tính phí theo bảng giá có phiên bản, giữ chỗ và trả trước)
>    * `src/store/citizen/` & `src/store/billing/` (Redux slices độc lập của Dev 3)
> 3. **TUYỆT ĐỐI KHÔNG ĐƯỢC CHẠM VÀO** các thư mục thuộc phạm vi của Dev 1 (`fleet/`, `iot-bins/`) hoặc Dev 2 (`tickets/`, `dispatch/`, `routing/`).
> 4. **TUYỆT ĐỐI KHÔNG SỬA TRỰC TIẾP** vào `src/Navigation.jsx` hay `src/store/index.js` để tránh gây xung đột Git (Merge Conflict) với Dev 1 và Dev 2. Hãy xuất route tại `src/modules/citizen/routes.jsx` và `src/modules/billing/routes.jsx`.

---

## 1. MỤC TIÊU NGHIỆP VỤ CỦA DEV 3 (THEO PDF)

### Trang 08: Cổng Quản lý Dành cho Người Dân (Citizen Portal)
- Mô hình: Mỗi hộ có một thùng riêng, một hồ sơ dịch vụ độc lập.
- Quét mã QR để mở hồ sơ hộ dân (lưu ý: QR chỉ mở hồ sơ, không tự chứng minh quyền sở hữu, cần đăng nhập xác thực).
- Chức năng:
  * Xem trạng thái thùng rác gia đình: Mức đầy (%), cảnh báo mùi hôi, thời gian cập nhật.
  * Xem lịch thu gom dự kiến tiếp theo; phản ánh nếu bị bỏ sót rác, thùng bốc mùi hoặc thùng hỏng.
  * Xem bảng kê phí tháng, tình trạng thanh toán, lịch sử đơn cồng kềnh.

### Trang 09 & 10: Thu Phí Định Kỳ Hàng Tháng & Xử Lý Nợ An Toàn
- **Tách biệt 2 khoản thu (Trang 09):** Phí thu gom thường kỳ và Phí rác cồng kềnh có mã khoản thu riêng biệt. Khách trả tiền sofa **không được tự ý cấn trừ vào nợ phí tháng**.
- Tích hợp thanh toán: Hỗ trợ thanh toán qua mã QR, liên kết cổng thanh toán (MoMo/VNPAY) và ủy quyền trích nợ tự động.
- Chống thu tiền trùng & Giao dịch lặp: Xử lý idempotent webhook từ cổng thanh toán; nếu phát sinh thanh toán 2 lần, tự động đưa vào danh sách đối soát hoàn tiền hoặc chuyển kỳ sau.
- **Quy trình nhắc nợ & Tạm ngừng thu gom (Trang 10):**
  * Lịch nhắc nợ: Ngày $D$ (hạn đóng), $D+3$ (nhắc lần 1), $D+7$ (nhắc lần 2), $D+14$ (chuyển quản lý duyệt).
  * **QUY TẮC SỐNG CÒN (Trang 10):** Hệ thống **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG CHẶN THU GOM**. Việc tạm ngừng thu gom bắt buộc phải qua bước kiểm tra chính sách an sinh và có **Người có thẩm quyền duyệt**.
  * **CẢNH BÁO MÔI TRƯỜNG VẪN HOẠT ĐỘNG:** Dù hộ bị tạm ngừng phục vụ vì nợ tiền rác, **cảm biến IoT vẫn tiếp tục ghi nhận mức đầy/mùi**, không được tắt cảm biến hoặc xóa lịch sử vì nợ!

### Trang 11 & 12: Đặt Thu Rác Cồng Kềnh Trả Trước (Bulky Waste Service)
- Danh mục nhận: Sofa, nệm, bàn/tủ... Rác nguy hại/xây dựng không nhận chung.
- Luồng dịch vụ:
  1. Hộ dân tải ảnh chụp vật dụng, chọn địa chỉ và ngày mong muốn.
  2. **AI nhận diện ảnh:** Nhận diện loại đồ đạc (sofa, nệm, bàn...). Khách xác nhận lại số lượng, kích thước, tầng lầu, thang máy, yêu cầu tháo dỡ.
     * *Lưu ý (Trang 12):* Không suy đoán khối lượng tuyệt đối từ ảnh.
  3. Kiểm tra năng lực phục vụ (xe tải cồng kềnh & tổ bốc xếp ngày đó còn trống hay không).
  4. **Tính phí & Giữ chỗ có thời hạn:** Áp dụng bảng giá có phiên bản:
     $$\text{Tổng phí} = \text{Phí vật dụng} + \text{Phí xe/khu vực} + \text{Phí bốc xếp/tháo dỡ} + \text{Thuế/phí} - \text{Ưu đãi}$$
  5. **Thanh toán trả trước:** Chỉ khi thanh toán thành công mới xác nhận đơn và chuyển sang đội thu gom (Dev 2). Nếu quá hạn giữ chỗ chưa trả tiền: tự động giải phóng chỗ.

### Trang 13: Xử Lý Ngoại Lệ & Hoàn Tiền
- Đơn vị hủy / Xe hỏng: Thông báo ngay cho khách đổi ngày; nếu khách không đồng ý thì xử lý hoàn tiền đầy đủ.
- Khách trả nợ sát giờ xe đến: Tự động hủy lệnh chặn, khôi phục trạng thái phục vụ và cập nhật vào lộ trình chuyến tiếp theo.

---

## 2. RANH GIỚI FILE VÀ THƯ MỤC CỦA DEV 3

```
src/
├── modules/
│   ├── citizen/                 <-- [DEV 3 TOÀN QUYỀN]
│   │   ├── components/          # HouseholdProfile, BinStatusCard, ComplaintForm
│   │   ├── pages/               # CitizenPortalPage, CitizenHistoryPage
│   │   └── routes.jsx           # Khai báo route riêng của Citizen
│   ├── billing/                 <-- [DEV 3 TOÀN QUYỀN]
│   │   ├── components/          # InvoiceTable, PaymentModal, DebtReminderList, SuspensionApprovalModal
│   │   ├── pages/               # BillingDashboardPage, DebtManagementPage
│   │   ├── services/            # PaymentGatewayService, DebtWorkflowService
│   │   └── routes.jsx           # Khai báo route riêng của Billing
│   └── bulky/                   <-- [DEV 3 TOÀN QUYỀN]
│       ├── components/          # ItemPhotoUploader, AiRecognitionPreview, PricingCalculator, BookingSlotPicker
│       ├── pages/               # BulkyBookingPage, BulkyOrderDetailPage
│       └── services/            # BulkyPricingEngineService, VisionAiService
├── store/
│   ├── citizen/                 <-- [DEV 3 TOÀN QUYỀN]
│   └── billing/                 <-- [DEV 3 TOÀN QUYỀN]
└── contracts/                   <-- [DÙNG CHUNG] Đọc interface tại đây
```

---

## 3. GIAO ƯỚC DỮ LIỆU CẦN TIÊU THỤ VÀ CUNG CẤP

### Tiêu thụ từ DEV 1:
- Dữ liệu mức đầy và mùi của thùng rác hộ gia đình để hiển thị lên Citizen App (`SmartBinTelemetry`).

### Cung cấp cho DEV 2:
- Trạng thái nợ / dịch vụ của hộ gia đình:
```typescript
interface HouseholdServiceStatus {
  householdId: string;
  serviceActive: boolean; // false nếu đã được cấp có thẩm quyền duyệt tạm ngừng
  suspendedReason?: string;
  suspendedAt?: string;
  approvedBy?: string;
}
```
- Đơn rác cồng kềnh đã chốt & thanh toán thành công:
```typescript
interface BulkyWasteOrder {
  orderId: string;
  householdId: string;
  itemType: 'SOFA' | 'MATTRESS' | 'CABINET' | 'TABLE' | 'OTHER';
  itemsCount: number;
  pickupDate: string; // YYYY-MM-DD
  address: string;
  latitude: number;
  longitude: number;
  hasElevator: boolean;
  floor: number;
  totalPriceVnd: number;
  isPaid: boolean;
  paymentTransactionId: string;
  status: 'PAID_CONFIRMED' | 'ASSIGNED' | 'COLLECTED' | 'REFUNDED';
}
```

---

## 4. QUY TRÌNH LÀM VIỆC TRÊN NHÁNH `dev-EnglandLee`

Trước khi bắt đầu code mỗi ngày hoặc trước khi chuẩn bị tạo Pull Request:
```bash
# 1. Cập nhật mã nguồn mới nhất từ nhánh main
git fetch origin
git rebase origin/main

# 2. Kiểm tra code style và build
npm run lint
npm run build

# 3. Đẩy lên nhánh remote
git push origin dev-EnglandLee
```

> Hãy tuân thủ nghiêm ngặt ranh giới thư mục để đảm bảo khi tạo PR vào `main`, lệnh merge sẽ diễn ra tự động 100% không có bất kỳ conflict nào!
