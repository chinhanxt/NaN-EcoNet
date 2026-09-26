# Chính Sách Bảo Mật NaN-EcoNet (Security Policy)

Đội ngũ phát triển **NaN-EcoNet** coi trọng tính an toàn, bảo mật dữ liệu của người dùng, tài xế, doanh nghiệp đối tác cũng như tính toàn vẹn của hệ thống điều phối logistics môi trường. Tài liệu này xác lập chính sách bảo mật, quy trình báo cáo lỗ hổng có trách nhiệm và các nguyên tắc quản trị khóa truy cập (secrets management).

---

## 🛡️ 1. Các Phiên Bản Được Hỗ Trợ (Supported Versions)

Chúng tôi cung cấp các bản vá bảo mật và cập nhật quan trọng cho các phiên bản phát hành theo bảng dưới đây:

| Phiên Bản | Trạng Thái Hỗ Trợ | Ghi Chú |
|---|---|---|
| **`v1.x`** | :white_check_mark: Được hỗ trợ chính thức | Phiên bản hiện tại (Active Maintenance & Security Patches) |
| `< 1.0.0` | :x: Ngưng hỗ trợ | Các bản thử nghiệm Alpha / Beta nội bộ |

---

## 🚨 2. Quy Trình Báo Cáo Lỗ Hổng Có Trách Nhiệm (Responsible Disclosure)

Nếu bạn phát hiện một vấn đề hoặc nguy cơ bảo mật trong bất kỳ thành phần nào của NaN-EcoNet (Bao gồm Smart Collection Engine, EcoPass, Citizen Bulky App, MCP BI Copilot hoặc AI Gateway):

### 2.1. Kênh Tiếp Nhận Bảo Mật
* **KHÔNG** tạo Public Issue hoặc thảo luận công khai trên GitHub về lỗ hổng bảo mật chưa được khắc phục.
* Vui lòng gửi thông tin chi tiết qua email tới Hội đồng Kỹ thuật dự án:
  * **Email chính (Lead Architect)**: `chinhanxt@gmail.com`
  * **Email đồng thuận**: `buinguyencongnghiep@gmail.com`, `lequocanh125@gmail.com`
* Tiêu đề email quy ước: `[SECURITY-VULNERABILITY] <Tên thành phần bị ảnh hưởng> - <Mô tả ngắn>`

### 2.2. Nội Dung Cần Cung Cấp
Để giúp chúng tôi nhanh chóng xác thực và khắc phục, vui lòng cung cấp:
1. Phân hệ và file mã nguồn hoặc endpoint API bị ảnh hưởng.
2. Các bước tái hiện chi tiết (Step-by-step reproduction guide) hoặc Proof-of-Concept (PoC) an toàn.
3. Đánh giá mức độ nghiêm trọng và phạm vi tác động dự kiến (theo thang điểm CVSS v3 nếu có).
4. Đề xuất giải pháp khắc phục (nếu có).

### 2.3. Quy Trình Phản Hồi & Thời Gian Biểu
* **Trong vòng 48 giờ**: Đội ngũ bảo mật xác nhận đã nhận thông báo và bắt đầu phân tích sơ bộ.
* **Trong vòng 7 ngày làm việc**: Đưa ra kết luận đánh giá rủi ro, xác thực PoC và tiến hành xây dựng bản vá nội bộ (Private Patch).
* **Phát hành bản vá công khai (Public Release)**: Bản vá sẽ được phát hành trong bản cập nhật bản vá (vd: `v1.0.1`), kèm theo thông cáo bảo mật (Security Advisory) và ghi nhận đóng góp (Credit/Acknowledgment) cho nhà nghiên cứu.

---

## 🔑 3. Quản Trị Khóa Bí Mật & Môi Trường (Secrets Management)

Hệ sinh thái NaN-EcoNet tích hợp nhiều dịch vụ ngoài (AI Models, Map Providers, Payment Gateways, Social Platforms). Việc quản lý bí mật tuân thủ nghiêm ngặt các nguyên tắc sau:

### 3.1. Tuyệt Đối Không Lưu Secret Vào Mã Nguồn
* Mọi tệp `.env`, `.env.local`, `.env.production` đều được liệt kê trong `.gitignore` và không được phép commit vào kho chứa.
* Chỉ lưu trữ các tệp mẫu không chứa dữ liệu nhạy cảm (vd: `.env.example`) với các giá trị giả lập hoặc chỉ dẫn cấu hình.
* Dự án tích hợp công cụ quét tự động (Gitleaks / TruffleHog) trong pipeline CI để chặn đứng các commit vô tình để lộ private key, database URL hay access token.

### 3.2. Quản Trị & Luân Chuyển Token (Token Rotation)
* **Google Gemini API Key**:
  * Được bảo vệ thông qua backend proxy (`apps/ecopass-enterprise/agy-image-gateway` hoặc backend riêng của bulky app).
  * Ứng dụng di động Flutter và Web App không bao giờ nhúng trực tiếp API Key quyền năng cao vào client build.
  * Định kỳ luân chuyển key mỗi 90 ngày hoặc ngay lập tức khi phát hiện nghi vấn rò rỉ.
* **Social Media Automation & Scheduler Tokens (`nan-team`)**:
  * Token truy cập YouTube, TikTok, Facebook OAuth được lưu trữ dạng mã hóa đối xứng (AES-256-GCM).
  * Áp dụng quy chế làm mới phiên tự động (Refresh Token Rotation) trước khi hết hạn.
* **Khóa Cổng Thanh Toán (MoMo / VNPay Secret Keys)**:
  * Khóa bí mật đối soát chữ ký điện tử (HMAC-SHA256 / SHA512) chỉ tồn tại trên biến môi trường an toàn của máy chủ backend.
  * Phân tách rạch ròi giữa môi trường Thử nghiệm (Sandbox Keys) và Môi trường Thực tế (Production Keys).

---

## 🔒 4. Bảo Vệ Dữ Liệu Cá Nhân & Bản Quyền Không Gian (Data Privacy)

1. **Thông tin định danh cư dân (PII)**:
   * Số điện thoại, địa chỉ nhà riêng và hình ảnh phế thải của hộ dân được mã hóa khi lưu trữ và truyền tải qua HTTPS/TLS 1.3.
   * Dữ liệu vị trí GPS của cư dân chỉ được thu thập khi có sự cho phép rõ ràng trên thiết bị di động và chỉ dùng cho mục đích định tuyến xe rác.
2. **Tính toàn vẹn của Tem Mã Thưởng (Thermal QR Ticket)**:
   * Tem quét vỏ lon/ly trên EcoPass áp dụng cơ chế **1-Time Burn** (Quét một lần là hủy hiệu lực) kết hợp mã hash SHA-256 có muối (Salted) và kiểm tra địa bàn GPS nhằm chống gian lận trục lợi điểm thưởng.
3. **Tuân thủ Chủ quyền Không gian & Bản đồ số**:
   * Toàn bộ bản đồ hiển thị trong hệ thống (MapLibre GL, Leaflet) sử dụng nguồn dữ liệu sạch, trung lập (OpenStreetMap / OSRM local server), tuyệt đối không hiển thị hoặc chấp nhận các nguồn dữ liệu vi phạm chủ quyền lãnh thổ quốc gia.

---

Cảm ơn bạn đã chung tay bảo vệ an toàn cho hệ sinh thái công nghệ xanh NaN-EcoNet!
