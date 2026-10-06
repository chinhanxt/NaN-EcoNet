# NaN-EcoNet

Tập hợp mã nguồn và kiến trúc vận hành của 6 phân hệ cốt lõi trong hệ sinh thái **NaN-EcoNet**.

---

## 📌 Bản đồ hệ sinh thái (Architecture Map)

| Thư mục | Phân hệ | Vai trò chính | Tech Stack | Cổng mặc định |
|---|---|---|---|---|
| [`ecopass/`](file:///home/chinhan/NaN-EcoNet/ecopass) | **EcoPass** | Nền tảng tuần hoàn vỏ lon/ly đổi voucher khuyến mãi (Mô hình 4-Win) | Next.js, Django, SQLite | `3009` - `3013` |
| [`enterprise-bi-copilot/`](file:///home/chinhan/NaN-EcoNet/enterprise-bi-copilot) | **BI Copilot** | Trợ lý phân tích chỉ số kinh doanh & dữ liệu tài chính thời gian thực | React, Vite, MCP Server | `3000` |
| [`agy-image-gateway/`](file:///home/chinhan/NaN-EcoNet/agy-image-gateway) | **Image Gateway** | Cổng Proxy & điều phối API sinh ảnh AI đa nhà cung cấp | Python, FastAPI, Vite | `8000`, `5173` |
| [`awesome-gpt-image-2/`](file:///home/chinhan/NaN-EcoNet/awesome-gpt-image-2) | **GPT-Image-2** | Thư viện phong cách thị giác & Studio thiết kế prompt chuẩn công nghiệp | React, Vite, Supabase | `5174` |
| [`nan-team/`](file:///home/chinhan/NaN-EcoNet/nan-team) | **NaN-Team MMO** | Nền tảng sản xuất video AI ngắn, Polish Editor & tự động hóa đăng tải đa kênh | NestJS, Next.js, Remotion, OpenShorts | `4200`, `3000`, `8002` |
| [`codex-chatgpt-web/`](file:///home/chinhan/NaN-EcoNet/codex-chatgpt-web) | **Codex ChatGPT Web** | Responses API Bridge & MCP Server kết nối trực tiếp phiên ChatGPT Web | Bun, TypeScript, Playwright, MCP | `8080` (RPC / MCP) |

---

## ⚡ Hướng dẫn cài đặt & Khởi chạy trên máy mới

### Bước 1: Clone repo và chuyển sang nhánh dev/chinhan
```bash
git clone git@github.com:chinhanxt/NaN-EcoNet.git
cd NaN-EcoNet
git checkout dev/chinhan
```

### Bước 2: Cài đặt công cụ nền tảng (nếu máy mới chưa có)
- **Node.js** (v20+) & **pnpm** (`npm i -g pnpm`)
- **Python** (v3.10+) & **ffmpeg**
- **Bun** (`curl -fsSL https://bun.sh/install | bash`)

### Bước 3: Khởi chạy từng phân hệ
Dùng `Makefile` tại thư mục gốc để khởi động nhanh:

```bash
make dev-ecopass       # Chạy toàn bộ 5 cổng EcoPass
make dev-gateway       # Chạy Image Gateway & Proxy
make dev-bi            # Chạy Enterprise BI Copilot
make dev-image2        # Chạy Prompt Studio GPT-Image-2
make dev-mmo           # Chạy NaN-Team Native Stack (Full Video AI & Social Automation)
make dev-chatgpt-web   # Chạy Codex ChatGPT Web Launcher & MCP Bridge
```

---

## 🔍 Chi tiết chức năng từng phân hệ

### 1. `ecopass/` — Phygital Waste-to-Reward Platform
Nền tảng gắn kết hành vi tái chế tại nguồn của người tiêu dùng với quyền lợi kinh tế từ các nhãn hàng F&B/FMCG.
- **`client-scanner/` (Port 3011)**: WebApp cho sinh viên/khách hàng. Bắt tọa độ GPS trạm rác, quét mã tem ly in nhiệt (1-Time Burn), trả lời khảo sát thị trường 3 giây để nhận voucher vào ví.
- **`cashier-pos/` (Port 3009)**: Ứng dụng POS cho thu ngân quán nước (Highlands, Phúc Long...). Quét mã kiểm tra tính hợp lệ và tự động hủy voucher sau khi áp dụng.
- **`brand-portal/` (Port 3010)**: Dashboard dành cho nhãn hàng FMCG (Coca-Cola, Pepsi...) giám sát sản lượng vỏ thu hồi phục vụ báo cáo EPR và xuất dữ liệu R&D.
- **`merchant-portal/` (Port 3013)**: Cổng tạo và ký số cho danh sách mã tem ly nước theo từng chi nhánh cửa hàng.
- **`voucher-backend/`**: Máy chủ backend xác thực chữ ký mã tem, quản lý logic cấp phát và xác thực ví điện tử.

### 2. `enterprise-bi-copilot/` — Executive BI Copilot
Bộ công cụ phân tích dữ liệu hiệu năng cao dành cho nhà quản trị doanh nghiệp.
- **Executive Dashboard**: Trực quan hóa số liệu tài chính, doanh thu, dòng tiền theo thời gian thực (Zero Mock data).
- **Copilot Query Engine**: Tương tác hỏi đáp dữ liệu tự nhiên bằng ngôn ngữ giao tiếp, chuyển đổi câu hỏi thành truy vấn SQL chính xác.
- **MCP Integration**: Kết nối dữ liệu mở rộng thông qua giao thức Model Context Protocol.

### 3. `agy-image-gateway/` — Multi-Provider AI Image Gateway
Cổng điều phối tập trung cho các tác vụ xử lý và sinh ảnh bằng AI.
- **API Routing & Load Balancing**: Định tuyến yêu cầu linh hoạt giữa các nhà cung cấp mô hình (OpenAI, Gemini, Grok).
- **In-Memory & Storage Cache**: Tự động lưu cache các kết quả sinh ảnh trùng lặp để giảm chi phí token và độ trễ phản hồi.
- **Service Monitoring**: Daemon chạy ngầm quản lý tiến trình sinh ảnh, tự động restart khi lỗi và cung cấp API trạng thái hoạt động.

### 4. `awesome-gpt-image-2/` — Prompt Engineering & Style Studio
Thư viện quản lý phong cách thiết kế và công cụ biên tập prompt chuyên sâu.
- **Curated Style Showcase**: Hơn 500+ case mẫu phân loại theo phong cách kiến trúc, nhân vật, thương hiệu, poster, nhiếp ảnh.
- **Side-by-Side Comparison**: Xem trước và so sánh trực tiếp kết quả sinh ảnh thực tế giữa các bộ tham số.
- **Preset Management**: Lưu trữ các công thức prompt chuẩn có thể nhúng trực tiếp vào các quy trình tự động.

### 5. `nan-team/` — Automated Social Content & Video AI Engine
Hệ sinh thái tự động hóa sản xuất nội dung video ngắn và quản trị tài nguyên mạng xã hội đa kênh (xây dựng mở rộng từ Postiz):
- **AI Video Studio & Source Video Studio**: Hộp thoại studio tương tác trực quan ngay trên Dashboard để phân tích video gốc, chia đoạn theo hook giữ chân người xem (Retention Engineering), và sinh video định dạng 9:16.
- **`packages/openshorts-engine`**: Động cơ Python ASR tiếng Việt (PhoWhisper / Whisper-Turbo), căn chỉnh khung hình dọc, cắt đoạn thông minh và tạo phụ đề động đa tầng.
- **`packages/remotion-engine`**: Biên soạn và xuất video chuyển động programmatic bằng React, hỗ trợ template phong cách chữ động (Neon, Pop, Box, Classic).
- **`packages/agy-mcp-runner`**: Bộ chuyển đổi MCP cho phép AI Coding Agents (Codex, Antigravity, Claude) tự động điều phối sinh asset và kịch bản.
- **Native Dev Automation**: Quản trị bằng `Makefile` cục bộ (`make dev`, `make login-fb`, `make login-yt`, `make login-tiktok`, `make sync-cookies`, `make seed-admin`).

### 6. `codex-chatgpt-web/` — Responses API Bridge & MCP Server
Cầu nối hiệu năng cao giúp tận dụng trực tiếp tài khoản ChatGPT Web (kể cả gói Pro/Plus) cho môi trường coding agent Codex và MCP:
- **Zero Additional API Cost**: Sử dụng hạn mức ChatGPT Web có sẵn mà không làm tiêu hao quota API trả phí.
- **Full Model Access**: Mở khóa toàn bộ mô hình Web cao cấp: GPT-4o, o1, o3-mini, Canvas, Pro.
- **Turn Broker & Compaction**: Điều phối hội thoại liên tục, tự động nén token thông minh (Bigger Context Compaction) cho các tác vụ lập trình dài hơi.
- **Playwright Browser Automation**: Quản lý phiên trình duyệt cục bộ an toàn, tự động khôi phục session, vượt challenge và xử lý stream token mượt mà.

---

## 🔒 Quản lý biến môi trường (.env)

Các file `.env` chứa khóa bảo mật không được lưu trên Git. Trước khi chạy từng dự án:
1. Xem file mẫu `.env.example` trong thư mục tương ứng.
2. Tạo file `.env` cục bộ và điền API Keys cần thiết.

