# Danh sách Issues dự án NaN-EcoNet

Tài liệu quản lý và theo dõi tiến độ các hạng mục công việc (Issues Roadmap) của nhánh `dev/chinhan`.

---

### #1 [Architecture] Khởi tạo mô hình điều phối đa phân hệ (Workspace Multi-Service)
- **Labels**: `architecture`, `enhancement`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Thiết lập kiến trúc điều phối tập trung cho 5 phân hệ cốt lõi trong hệ sinh thái.
  - Chuẩn hóa bộ lọc `.gitignore` loại trừ `node_modules`, cache và file bí mật.
  - Xây dựng `Makefile` trung tâm và tài liệu `README.md`.

---

### #2 [EcoPass] Triển khai cơ chế khóa kép thực địa (Dual Phygital Lock)
- **Labels**: `feature`, `security`, `ecopass`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Bắt tọa độ GPS trạm rác từ trình duyệt WebApp (`client-scanner:3011`).
  - Ký số tem ly in nhiệt với cơ chế 1-Time Burn chống gian lận.
  - Tích hợp micro-survey 3 giây khảo sát khẩu vị người dùng.

---

### #3 [EcoPass] Xây dựng máy POS thu ngân kiểm tra và hủy voucher (Cashier POS)
- **Labels**: `feature`, `ecopass`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Xây dựng giao diện Cashier POS tại cổng `3009` cho thu ngân quán F&B.
  - Quét mã QR voucher trực tiếp từ điện thoại khách hàng.
  - Gọi API backend xác thực và burn voucher ngay lập tức.

---

### #4 [EcoPass] Thiết kế Dashboard nhãn hàng FMCG báo cáo EPR & R&D Khảo sát
- **Labels**: `feature`, `analytics`, `ecopass`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Dashboard theo dõi sản lượng vỏ thu hồi phục vụ báo cáo kiểm toán EPR.
  - Xuất dữ liệu khảo sát thị trường từ micro-survey hỗ trợ phòng R&D nhãn hàng.
  - Bổ sung tài liệu bảo vệ mô hình 4-Win vòng chung kết.

---

### #5 [AGY-Gateway] Xây dựng cơ chế Caching và điều phối Proxy đa nhà cung cấp AI
- **Labels**: `feature`, `backend`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Định tuyến proxy linh hoạt giữa OpenAI, Gemini, Grok.
  - Lưu đệm cache kết quả prompt trùng lặp để giảm chi phí token.
  - Daemon giám sát tiến trình và tự động phục hồi khi có sự cố.

---

### #6 [GPT-Image-2] Xây dựng thư viện so sánh phong cách trực quan (Side-by-Side Studio)
- **Labels**: `feature`, `ui/ux`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Phân loại hơn 500+ case mẫu theo danh mục kiến trúc, poster, nhiếp ảnh.
  - Bảng điều khiển so sánh tham số render và quản lý preset prompt chuẩn.
  - Tích hợp Supabase lưu trữ case yêu thích.

---

### #7 [NaN-Team] Tự động hóa phân phối nội dung đa kênh TikTok, YouTube Shorts & Facebook
- **Labels**: `feature`, `automation`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Lập lịch đăng bài và video đa nền tảng qua Postiz engine.
  - Tích hợp AI hỗ trợ sinh caption và tiêu đề chuẩn SEO mạng xã hội.
  - Quản lý đồng bộ cookie và token phiên làm việc tự động.

---

### #8 [BI-Copilot] Tích hợp Trợ lý phân tích dữ liệu điều hành doanh nghiệp (Executive Copilot)
- **Labels**: `feature`, `analytics`
- **Trạng thái**: Closed / Completed
- **Nội dung**:
  - Xây dựng Dashboard phân tích tài chính và vận hành thời gian thực (Port 3000).
  - Engine chuyển đổi câu hỏi tự nhiên thành truy vấn số liệu (Zero Mock data).
  - Tích hợp bộ chuyển đổi giao thức MCP Server.

---

### #9 [DevOps] Thiết lập quy trình kiểm thử tự động và đóng gói Docker cho các phân hệ
- **Labels**: `devops`, `enhancement`
- **Trạng thái**: Open / In-Progress
- **Nội dung**:
  - Đóng gói Docker Compose cho backend và cơ sở dữ liệu phụ trợ.
  - Kiểm tra tính tương thích chéo giữa các nền tảng OS (Linux, macOS, Windows).
  - Tích hợp CI/CD kiểm tra type và build tự động.
