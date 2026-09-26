# 🌿 Phân Hệ 1: EcoPass Enterprise & Omni-Channel Agentic Hub

**Thư mục mã nguồn:** [`apps/ecopass-enterprise`](../../apps/ecopass-enterprise)  
**Phụ trách kỹ thuật:** **Nguyễn Chí Nhân** (`chinhanxt`)

Phân hệ Enterprise đóng vai trò hạt nhân kết nối dòng dữ liệu và giá trị kinh tế của toàn bộ hệ sinh thái tuần hoàn, liên kết trách nhiệm mở rộng của nhà sản xuất (EPR) từ các doanh nghiệp FMCG tới quầy thu ngân của các chuỗi bán lẻ và ví điểm thưởng của người tiêu dùng / sinh viên.

---

## 1. Mô Hình Kinh Tế Tuần Hoàn 4-WIN

<p align="center">
  <img src="../assets/diagrams/ecopass-4win.png" alt="EcoPass 4-Win Model" width="100%" />
</p>
<p align="center"><i>Hình: Ma trận lợi ích 4 bên trong hệ sinh thái kinh tế tuần hoàn EcoPass</i></p>

### Ma Trận Lợi Ích & Giá Trị Định Lượng Của 4 Bên:

| Đối Tượng Tham Gia | Lợi Ích Cốt Lõi Nhận Được | Nếu Thiếu Hệ Sinh Thái (Trạng Thái Cũ) | Giá Trị Đo Lường Thực Tế |
| :--- | :--- | :--- | :--- |
| **1. Sinh viên / Người tiêu dùng** | Tích điểm đổi quà trực tiếp, voucher đồ uống, giảm giá căn tin trường học. | Vứt rác lẫn lộn vào bãi rác sinh hoạt; không có động lực phân loại; lãng phí tài nguyên tái chế. | **Thu nhập tích lũy:** Đạt trung bình 150.000 – 350.000 VNĐ/tháng qua việc quy đổi điểm thưởng phế liệu sạch. |
| **2. Đơn vị thu gom rác / Tài xế** | Nhận nguồn rác đã được phân loại sẵn tại nguồn; tối ưu hóa cự ly lộ trình; tăng thêm thu nhập trên mỗi chuyến xe. | Phải bới rác thủ công độc hại tại các bãi tập kết; lộ trình xe chồng chéo gây tốn dầu; năng suất thấp. | **Năng suất lao động tăng 35%**; giảm 28.4% quãng đường di chuyển và chi phí nhiên liệu Diesel. |
| **3. Cửa hàng bán lẻ / Căn tin đối tác** | Thu hút lượng khách hàng sinh viên mới đến quét mã voucher; tăng doanh số bán chéo các sản phẩm khác. | Tốn nhiều chi phí in ấn tờ rơi, chạy quảng cáo phát sampling không nhắm đúng tệp khách hàng. | **Tỷ lệ chuyển đổi voucher tại quầy đạt 68%**; tăng 18% doanh thu từ các đơn hàng mua kèm khi dùng voucher. |
| **4. Nhãn hàng FMCG (Doanh nghiệp đóng gói)** | Đảm bảo tuân thủ quy chuẩn tái chế bắt buộc theo Nghị định 08/2022/NĐ-CP; sở hữu bộ dữ liệu tái chế sạch định vị GPS phục vụ báo cáo ESG. | Nguy cơ bị phạt vi phạm hành chính và truy thu nộp tiền vào Quỹ Bảo vệ Môi trường Việt Nam; tổn hại uy tín thương hiệu. | **Tiết kiệm 35 – 45% chi phí tuân thủ EPR** so với phương án nộp phạt hoặc thuê các đơn vị kiểm toán môi trường độc lập bên ngoài. |

---

## 2. Enterprise BI Copilot & Chuẩn Giao Thức MCP (Model Context Protocol)

<p align="center">
  <img src="../assets/diagrams/ecopass-enterprise-arch.png" alt="Enterprise Architecture" width="100%" />
</p>
<p align="center"><i>Hình: Kiến trúc phân hệ Enterprise tích hợp MCP Server, BI Copilot và AI Gateway</i></p>

### 2.1. Cơ Chế Hoạt Động của BI Copilot:
Xây dựng trên nền tảng TypeScript, Node.js và giao thức mở Model Context Protocol (MCP) của Anthropic:
* **Tool Discovery & Execution:** Cho phép các mô hình ngôn ngữ lớn (Claude, Gemini) tự động nhận diện và gọi các công cụ phân tích nghiệp vụ nội bộ theo ngữ cảnh trò chuyện của người quản lý.
* **Text-to-SQL An Toàn:** Tự động chuyển đổi câu hỏi ngôn ngữ tự nhiên thành truy vấn cơ sở dữ liệu phân tích có kiểm soát quyền truy cập theo vai trò (RBAC), ngăn chặn triệt để SQL Injection thông qua parameterized queries.
* **Tự Động Xuất Báo Cáo EPR:** Kết xuất dữ liệu khối lượng vỏ lon/chai thu gom theo từng khu vực, phục vụ nộp báo cáo định kỳ cho cơ quan quản lý môi trường.

---

## 3. AI Visual Synthesis Gateway & Chatbot Biên Dịch Sơ Đồ Động

### 3.1. AI Image Gateway:
* Cung cấp một cổng proxy tập trung kết nối các mô hình thị giác hàng đầu (FLUX, Google Imagen, Alibaba Qwen-Image-2).
* Tích hợp bộ đệm SHA-256 prompt cache nhằm tái sử dụng các hình ảnh đồ họa đã sinh, tiết kiệm tài nguyên tính toán và chi phí API.
* Thư viện style preset (`awesome-gpt-image-2`) hỗ trợ tạo các ấn phẩm truyền thông nâng cao ý thức bảo vệ môi trường theo phong cách đồ họa hiện đại.

### 3.2. Dynamic Diagram Engine:
* Cho phép người dùng ra lệnh tạo sơ đồ trực quan hóa dữ liệu kinh doanh (ví dụ: *"Vẽ sơ đồ dòng tiền tài trợ voucher của Coca-Cola trong tháng 9"*).
* Hệ thống biên dịch trực tiếp sang cú pháp Mermaid hoặc PlantUML và hiển thị tức thời trên giao diện trò chuyện.

---

## 4. Công Cụ Tiện Ích Tự Động Hóa Truyền Thông (`nan-team/scripts`)

> [!NOTE]  
> **Tuyên bố Tuân thủ & Đạo đức Sử dụng (ToS & Ethical Compliance Disclaimer):**  
> Các kịch bản tại thư mục `nan-team/scripts` được phát triển dưới dạng công cụ thử nghiệm dành riêng cho nhà phát triển (Developer Utilities) nhằm kiểm chứng tính khả thi của quy trình truyền thông tự động về lối sống xanh. Trong môi trường vận hành thương mại quy mô lớn, các đơn vị cần sử dụng API đối tác chính thức được cấp phép (Meta Graph API Partner, TikTok for Business API, YouTube Data API v3).

### Các Tính Năng Kỹ Thuật Chính:
1. **Quản Lý Phiên & Ngăn Chặn Xung Đột Trình Duyệt (Session Resilience):**
   * Sử dụng cơ chế khóa tài nguyên `acquireProfileLock()` và dọn dẹp các tệp khóa treo `cleanStaleSingletonLock()` (`SingletonLock`, `SingletonSocket`) nhằm đảm bảo nhiều worker headless Chromium có thể chạy ổn định trên Linux mà không gây xung đột hồ sơ người dùng.
2. **Cơ Chế Phục Hồi Lỗi & Rate-Limit Backoff:**
   * Áp dụng thuật toán Exponential Backoff với jitter ngẫu nhiên (`withExponentialBackoff`) để giãn cách các lượt gọi mạng, tuân thủ giới hạn tần suất yêu cầu và tránh gây tải đột biến cho hạ tầng máy chủ.
3. **Pipeline Chuyển Đổi FFmpeg Tự Động:**
   * Tự động chuyển đổi các poster hình ảnh tĩnh thành video ngắn định dạng 9:16 kèm nhạc nền sinh thái để tối ưu hóa khả năng tương tác trên các nền tảng video ngắn (TikTok, YouTube Shorts).
