# Đặc Tả Kỹ Thuật: Quy Trình Xét Duyệt Chốt Giá Của Điều Phối Viên & Xử Lý Sai Lệch Tại Hiện Trường

- **Ngày ban hành:** 2026-09-26
- **Tác giả:** Dev-EnglandLee (Developer 3)
- **Nhánh thực hiện:** `dev-EnglandLee`
- **Trạng thái:** Đã phê duyệt (Approved)
- **Mục tiêu:** Tái cấu trúc vòng đời đơn hàng rác cồng kềnh (Smartbin Bulky) theo mô hình chuẩn dịch vụ công đô thị: Cư dân gửi đơn chờ duyệt $\to$ Điều phối viên kiểm tra ảnh & chốt giá chính thức $\to$ Cư dân nhận thông báo giá duyệt và đặt cọc $\to$ Tài xế nhận lệnh thu gom & xử lý ngoại lệ sai lệch / phát sinh tại hiện trường.

---

## 1. Vòng Đời Đơn Hàng Hoàn Chỉnh (Complete Order Lifecycle)

```
[ CƯ DÂN: Đặt lịch & Quét AI ]
              │
              ▼ (Tạo đơn: PENDING_REVIEW)
[ ĐIỀU PHỐI VIÊN: Kiểm tra ảnh AI & Chốt giá chính xác ]
       │                                     │
       ▼ (Chấp thuận: APPROVED)              ▼ (Không phù hợp: REJECTED)
[ CƯ DÂN: Nhận báo giá đã duyệt ]     [ CƯ DÂN: Nhận lý do từ chối ]
       │
       ▼ (Đặt cọc VietQR/MoMo 15p: SCHEDULED)
[ ĐIỀU PHỐI VIÊN / HỆ THỐNG: Điều xe tải & Tài xế ]
       │
       ▼ (Tài xế nhận lệnh & di chuyển: IN_PROGRESS)
[ TÀI XẾ ĐẾN HIỆN TRƯỜNG ]
       │
       ├─► [Trường hợp 1: Đúng đồ] ──► Bốc xếp ──► COMPLETED (Quyết toán trừ cọc)
       │
       ├─► [Trường hợp 2: Sai đồ / Thêm đồ] ──► Tài xế lập phát sinh (DISCREPANCY_PENDING)
       │         │
       │         ├─► Cư dân [Đồng ý phụ thu] ──► Bốc xếp ──► COMPLETED
       │         └─► Cư dân [Không đồng ý] ──► Chỉ bốc đồ ban đầu hoặc hủy
       │
       └─► [Trường hợp 3: Rác cấm / Nguy hại] ──► Tài xế từ chối tại chỗ (REJECTED_ON_SITE)
                 │
                 └─► Khấu trừ 50.000 đ phí điều xe, hoàn phần cọc còn lại.
```

---

## 2. Chi Tiết Mô Hình Dữ Liệu & Trạng Thái

### 2.1. Mở rộng `BulkyOrderStatus` (`bulky_constants.dart`)
Bổ sung các trạng thái mới, giữ nguyên tương thích ngược với các trạng thái cũ:
* `PENDING_REVIEW`: 'Chờ điều phối viên duyệt giá' (Khởi tạo khi cư dân hoàn tất wizard).
* `APPROVED_AWAITING_PAYMENT`: 'Đã duyệt giá • Chờ đặt cọc' (Điều phối viên đã chốt giá, chờ cư dân cọc).
* `CONFIRMED`: 'Đã cọc • Sẵn sàng điều xe'.
* `SCHEDULED`: 'Đã duyệt & Lên lịch xe tải'.
* `ASSIGNED`: 'Đã điều phối xe thu gom'.
* `IN_PROGRESS`: 'Xe tải đang đến thu gom'.
* `DISCREPANCY_PENDING`: 'Chờ duyệt phát sinh tại chỗ'.
* `COLLECTED`: 'Đã thu gom tại hiện trường'.
* `COMPLETED`: 'Hoàn tất quyết toán'.
* `CANCELLED`: 'Đã hủy'.
* `REJECTED`: 'Bị từ chối khi xét duyệt'.
* `REJECTED_ON_SITE`: 'Từ chối tại hiện trường (Vi phạm an toàn)'.

### 2.2. Mở rộng `BulkyOrder` (`bulky_order.dart`)
* `final int? finalizedPriceVnd`: Mức giá chính thức do Điều phối viên chốt (nếu null thì dùng `quote.maxVnd`).
* `final String? operatorNote`: Ghi chú xét duyệt của Điều phối viên.
* `final int? onSiteAdjustedPriceVnd`: Mức giá điều chỉnh do Tài xế báo khi có phát sinh.
* `final String? onSiteDiscrepancyNote`: Ghi chú hiện trường của Tài xế.
* `final String? onSiteRejectionReason`: Lý do từ chối thu gom tại hiện trường.
* `final int calloutFeeVnd`: Phí xăng xe điều động khấu trừ vào cọc (mặc định 0, 50.000 đ khi bị từ chối tại chỗ).

---

## 3. Thiết Kế Giao Diện & Tương Tác

### 3.1. Wizard Đặt Thu Gom (`BulkyBookingWizardScreen` - Bước 3)
* Thay vì bắt cư dân đặt cọc ngay khi mức giá chỉ là ước tính tham khảo:
  * Nút CTA cuối cùng: **`[ GỬI YÊU CẦU XÉT DUYỆT ➔ ]`** (Key: `wizard_submit_review_button`).
  * Gọi `ordersProvider.createOrderForReview(wizard)`.
  * Đơn hàng được tạo với trạng thái `PENDING_REVIEW`.
  * Chuyển cư dân sang màn hình `BulkyOrderDetailScreen` để theo dõi.

### 3.2. Cổng Thông Tin Điều Phối Viên (`BulkyOperatorScreen`)
* Danh mục tab/filter bổ sung: `Chờ xét duyệt giá` (`PENDING_REVIEW`).
* Khi mở đơn hàng `PENDING_REVIEW`:
  * Xem danh sách đồ vật, ảnh chụp AI, địa chỉ, loại hình bốc vác (thang bộ/thang máy).
  * Hiển thị dải cước tham khảo của AI (Min - Max).
  * **Form chốt giá chính thức:**
    * Ô nhập liệu: **`Mức giá chốt duyệt (VNĐ)`** (Gợi ý mặc định là mức giá chuẩn/giá sàn, ví dụ `280.000`).
    * Ô nhập liệu: **`Ghi chú duyệt đơn`** (Ví dụ: *"Đã kiểm tra ảnh, chấp nhận hỗ trợ bốc vác tầng 2"*).
    * Hàng nút hành động:
      * **`[✓ Phê duyệt & Chốt giá gửi Cư dân]`** (Key: `operator_approve_pricing_button`) $\to$ Trạng thái chuyển sang `APPROVED_AWAITING_PAYMENT`.
      * **`[✕ Từ chối đơn]`** (Key: `operator_reject_booking_button`) $\to$ Trạng thái chuyển sang `REJECTED`.

### 3.3. Chi Tiết Đơn Hàng Cư Dân (`BulkyOrderDetailScreen`)
* **Khi đơn ở trạng thái `PENDING_REVIEW`:**
  * Banner vàng cảnh báo: *"⏳ Đơn hàng đang được Điều phối viên kiểm tra ảnh và chốt mức giá chính xác. Bạn sẽ nhận được thông báo để đặt cọc ngay khi đơn được duyệt."*
* **Khi đơn ở trạng thái `APPROVED_AWAITING_PAYMENT`:**
  * Banner xanh lục bảo Emerald: *"🎉 Đơn hàng đã được duyệt! Mức giá chính thức: 280.000 đ (Tiền cọc giữ xe: 100.000 đ)"*.
  * Thể hiện ghi chú của Điều phối viên.
  * Nút CTA: **`[ TIẾN HÀNH ĐẶT CỌC GIỮ XE (15 PHÚT) ➔ ]`** (Key: `proceed_to_deposit_button`) $\to$ Mở màn hình VietQR / MoMo đếm ngược (`BulkyPaymentScreen`).
* **Sau khi đặt cọc thành công:**
  * Trạng thái chuyển thành `SCHEDULED` (Đã xếp xe & Lịch hẹn).

### 3.4. Xử Lý Ngoại Lệ Tại Hiện Trường (`BulkyDriverScreen` & `BulkyOrderDetailScreen`)
* **Trên màn hình Tài xế (`BulkyDriverScreen`):**
  * Khi tài xế ở trạng thái `IN_PROGRESS` (đang thu gom), hiển thị thêm 2 nút:
    1. **`[⚠️ Báo phát sinh đồ tại hiện trường]`** (Key: `driver_report_discrepancy_button`):
       - Nhập mức giá đề xuất mới (hoặc đồ phát sinh).
       - Nhập ghi chú (Ví dụ: *"Phát sinh thêm 1 nệm và đổi chất liệu sang gỗ đặc"*).
       - Bấm `[Gửi báo giá điều chỉnh cho Cư dân]` $\to$ Đơn chuyển sang `DISCREPANCY_PENDING`.
    2. **`[⛔ Từ chối thu gom (Rác cấm / Nguy hại)]`** (Key: `driver_reject_safety_button`):
       - Chọn lý do: Cháy nổ (bình gas/xăng), hóa chất độc hại, rác công nghiệp quá tải.
       - Bấm `[Xác nhận từ chối & Trừ phí điều xe 50.000 đ]` $\to$ Đơn chuyển sang `REJECTED_ON_SITE`.
* **Trên màn hình Cư dân (`BulkyOrderDetailScreen`):**
  * Khi ở trạng thái `DISCREPANCY_PENDING`:
    - Thẻ so sánh cước ban đầu vs Cước điều chỉnh mới.
    - Nút `[✓ Đồng ý cước điều chỉnh]` $\to$ Cập nhật cước mới, tài xế tiếp tục bốc đồ.
    - Nút `[✕ Giữ danh mục cũ / Không bốc đồ thêm]` $\to$ Tài xế chỉ bốc đồ ban đầu.
  * Khi ở trạng thái `REJECTED_ON_SITE`:
    - Thông báo đơn bị từ chối do vi phạm an toàn, trừ 50.000 đ phí điều xe, hoàn cọc còn lại.

---

## 4. Kiểm Thử & Đảm Bảo Chất Lượng
1. Unit test cập nhật trong `pricing_engine_test.dart` và `mock_bulky_storage_test.dart`.
2. Widget test cập nhật trong `bulky_booking_wizard_test.dart`, `quote_and_orders_test.dart`, và `role_workflow_test.dart`.
3. Đảm bảo 100% tests tiếp tục vượt qua (94/94+ tests passing), 0 linter issues (`flutter analyze`).
