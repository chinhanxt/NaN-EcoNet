# Báo giá theo vật dụng và kích thước

Luồng đã thống nhất: AI gợi ý loại vật dụng; người dân xác nhận số lượng và nhóm kích thước. Không dùng kg suy đoán từ ảnh để báo giá. Bảng giá `2026.2-item-size-demo` trong `services/mock/mockSeed.js` chỉ là số liệu minh họa, cần đơn vị vận hành phê duyệt trước khi áp dụng thực tế.

- Phí = tổng đơn giá theo loại/kích thước × số lượng + phí khu vực/xe + phí thang bộ + tháo dỡ + thuế − ưu đãi.
- Phí thang bộ tính theo số tầng, không áp dụng khi đồ ở mặt đường/tầng trệt hoặc có thang máy đủ chỗ.
- Chưa rõ kích thước, quá khổ, loại OTHER hoặc AI yêu cầu xem xét: lưu `MANUAL_REVIEW`, thông báo nhân viên, chưa cho tạo báo giá tự động/thanh toán.
- Nhân viên mở chi tiết đơn, xem ảnh/thông tin, nhập tổng phí trọn gói và nội dung bao gồm. Dịch vụ kiểm tra quyền `DISPATCH_BULKY_ORDERS`, lưu người báo giá và thời điểm. Rác nguy hại/xây dựng không nhận chung.
- Người dân xem đề xuất, tạo báo giá và giữ chỗ rồi thanh toán toàn bộ. Đề xuất của nhân viên không tự xác nhận lịch hoặc đánh dấu đã thanh toán.
- Chênh lệch thực tế phải được khách đồng ý trước khi thực hiện. Không dùng mức tăng mặc định 30% hoặc lời hứa dung sai ±15% cho đơn mới.

## Phạm vi hiện tại

Luồng chạy trên dịch vụ mock/localStorage sẵn có, gồm thanh toán mô phỏng và chuyển vai trò demo. Chưa phải backend nghiệp vụ/thanh toán thật. Bảng giá cũ `2026.1` được nâng cấp riêng, giữ nguyên dữ liệu đơn và báo giá đã chốt; lịch sử cũ vẫn hiển thị chính sách tại thời điểm đặt.

Kiểm thử tập trung vào tính phí/kích thước/tầng lầu, chặn báo giá khi thiếu thông tin, lưu và duyệt báo giá riêng theo quyền, người dân xác nhận kích thước sau AI và luồng thanh toán cũ.
