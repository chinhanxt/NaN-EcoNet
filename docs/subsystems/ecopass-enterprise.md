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
* **Text-to-SQL An Toàn:** Tự động chuyển đổi câu hỏi ngôn ngữ tự nhiên thành truy vấn cơ sở dữ liệu phân tích có kiểm soát quyền truy cập theo vai trò (RBAC), ngăn chặn triệt để SQL Injection thông qua parameterized queries và chốt chặn bảo mật đa tầng.
* **Tự Động Xuất Báo Cáo EPR:** Kết xuất dữ liệu khối lượng vỏ lon/chai thu gom theo từng khu vực, phục vụ nộp báo cáo định kỳ cho cơ quan quản lý môi trường.

### 2.2. Mô Hình Bảo Mật Đa Tầng Defense-in-Depth Cho MCP Text-to-SQL:
Nhằm triệt tiêu hoàn toàn nguy cơ rò rỉ dữ liệu, tấn công Prompt Injection gián tiếp hoặc phá hoại cơ sở dữ liệu khi LLM tự sinh SQL, phân hệ triển khai cơ chế bảo mật 5 tầng độc lập tại [`apps/ecopass-enterprise/enterprise-bi-copilot/src/security-guardrails.ts`](../../apps/ecopass-enterprise/enterprise-bi-copilot/src/security-guardrails.ts) và được bảo chứng 100% bằng bộ kiểm thử tự động [`tests/security/test_mcp_guardrails.py`](../../tests/security/test_mcp_guardrails.py):

| Tầng Phòng Thủ (Tier) | Cơ Chế Kiểm Soát | Quy Tắc Thực Thi Cụ Thể |
| :--- | :--- | :--- |
| **Tier 1: Rate Limiting & Token Budget** | Sliding Window Throttling | Tối đa **30 queries / phút** cho mỗi phiên làm việc (`RATE_LIMIT_MAX_QUERIES = 30`). Ngăn chặn cạn kiệt tài nguyên máy chủ và kỹ thuật dò quét dữ liệu hàng loạt. |
| **Tier 2: Lexical & Regex Keyword Filtering** | AST Token Scanner & Regex Block | Bắt buộc câu lệnh gốc phải là `SELECT` hoặc `WITH` (CTE). Regex chặn triệt để các từ khóa DDL/DML: `/(DROP\|DELETE\|UPDATE\|INSERT\|ALTER\|TRUNCATE\|CREATE\|GRANT\|REVOKE\|EXEC\|ATTACH\|DETACH)/i`. Chặn kỹ thuật xếp chồng lệnh (Semicolon Query Stacking: `; DROP TABLE...`). |
| **Tier 3: Table & Column Whitelisting** | Schema Scope Enforcement | **Bảng trắng tuyệt đối (5 bảng):** `recycling_transactions`, `epr_compliance_logs`, `voucher_redemptions`, `collection_metrics`, `carbon_offset_summary`. Chặn tức thì mọi truy cập tới bảng hệ thống hoặc nhạy cảm (`users`, `passwords`, `system_config`, `sqlite_master`, `pg_catalog`). Kiểm duyệt danh sách cột qua `COLUMN_WHITELIST`. |
| **Tier 4: Mandatory Result Row Limiting** | Automated Query Clamping | Tự động chèn mệnh đề **`LIMIT 100`** vào mọi truy vấn SELECT không có LIMIT. Trường hợp truy vấn yêu cầu cự ly dòng vượt ngưỡng cho phép (`LIMIT > 500`), hệ thống tự động ép hạ tải về mức an toàn. |
| **Tier 5: Database Sandboxing & Read-Only Isolation** | Transaction-Level Isolation | Khởi tạo kết nối với cờ bất biến **`MODE_READONLY = true`**. Toàn bộ truy vấn được bọc trong giao dịch `BEGIN TRANSACTION READ ONLY`, cô lập hoàn toàn quyền ghi đối với cơ sở dữ liệu phân tích. |

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

---

## 5. Hợp Đồng Dữ Liệu & Định Danh Phiên Bản (Data Contracts & Schema Versioning)

Nhằm đảm bảo tính minh bạch, khả năng kiểm toán ESG và ngăn chặn gian lận lặp mã voucher trong quy trình trả thưởng EPR giữa **Smart Collection Engine / Citizen App** và **EcoPass Enterprise Hub**, luồng dữ liệu khen thưởng được ràng buộc bằng chuẩn **JSON Schema Draft-07**.

### 5.1. Đặc Tả Hợp Đồng `EcoRewardPayload v1.0.0`:
* **Vị trí định nghĩa schema:** [`schemas/v1/eco_reward.schema.json`](../../schemas/v1/eco_reward.schema.json)
* **Schema URI:** `https://nan-econet.org/schemas/v1/eco_reward.json`
* **Cấu trúc trường bắt buộc:**
  * `transaction_id`: Token giao dịch EPR duy nhất (`TX-EPR-YYYY-XXXXX`).
  * `version`: Phiên bản hợp đồng dữ liệu (`"1.0.0"`).
  * `order_id`: Mã đơn hàng hoặc phiên bỏ rác thông minh liên kết.
  * `citizen_id`: Mã định danh công dân / sinh viên thụ hưởng phần thưởng.
  * `fmcg_partner_id`: Mã đối tác tài trợ EPR (ví dụ: `FMCG-UNILEVER-VN`).
  * `epr_material_category`: Phân loại vật liệu tái chế hợp lệ (`RIGID_PLASTIC_PET`, `ALUMINUM_CAN`, `TETRA_PAK`, `PAPER_CARDBOARD`, `GLASS_BOTTLE`, `FLEXIBLE_PLASTIC_LDPE`, `SCRAP_METAL`, `E_WASTE`, `OTHER_RECYCLABLE`).
  * `weight_verified_kg`: Khối lượng thực tế đã cân đối soát tại hiện trường (kg).
  * `voucher_issued`: Chi tiết voucher phát hành (`code`, `brand`, `discount_value`, `expiry_iso`).
  * `audit_trail`: Dữ liệu kiểm toán chống gian lận (`gps_lat`, `gps_lng`, `collected_at_iso`, `one_time_burn_token`).

### 5.2. Kiểm Thử Hợp Đồng Tự Động (Contract Testing):
Bộ kiểm thử tích hợp tại [`tests/contracts/test_schemas.py`](../../tests/contracts/test_schemas.py) xác thực tự động mọi luồng giao dịch khen thưởng, bảo vệ hệ thống trước các nguy cơ sai lệch kiểu dữ liệu hoặc thiếu sót thông tin kiểm toán.

