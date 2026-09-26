# Hạ Tầng Cổng & Hướng Dẫn Ánh Xạ Dịch Vụ NaN-EcoNet (Port & Infrastructure Reference)

Tài liệu này đặc tả toàn bộ hạ tầng mạng, danh mục cổng phân bổ cho 7 vi dịch vụ và 2 dịch vụ hạ tầng dùng chung, mức độ hoàn thiện kỹ thuật (Maturity Assessment), cùng chiến lược ánh xạ môi trường Phát triển (Development) và Vận hành (Production).

---

## 1. Bảng Tra Cứu Cổng Toàn Diện (Comprehensive Port Registry)

| Cổng Host | Dịch Vụ | Phân Hệ | Công Nghệ Chính | Biến Môi Trường (Fallback) | Cổng Nội Bộ (Container) | Trạng Thái Hoàn Thiện (Maturity) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **8502** | Dual-Map Interactive Dispatcher | Smart Collection Engine | MapLibre GL JS, OSRM, FastAPI | `COLLECTION_DISPATCHER_PORT:-8502` | `8502` | **Production-Ready** (Sẵn sàng vận hành) |
| **8501** | Parameter Convergence Dashboard | Smart Collection Engine | Streamlit, Python 3.11 | `COLLECTION_DASHBOARD_PORT:-8501` | `8501` | **Pilot / Research** (Nghiên cứu hội tụ) |
| **8000** | VRP CVRPTW Solver Core | Smart Collection Engine | FastAPI, C++ OpenMP, OR-Tools | `COLLECTION_ENGINE_PORT:-8000` | `8000` | **Production-Ready** (Lõi thuật toán tối ưu) |
| **3006** | Citizen Bulky Waste Portal | Citizen Bulky App | React 18, Vite, TailwindCSS, Nginx | `CITIZEN_PORTAL_PORT:-3006` | `80` | **Production-Ready** (Cổng tra cứu cư dân) |
| **3011** | Enterprise BI Copilot & MCP | EcoPass Enterprise | Node.js, TypeScript, MCP Protocol | `ENTERPRISE_BI_PORT:-3011` | `3011` | **Beta / Enterprise** (Thử nghiệm doanh nghiệp) |
| **3010** | EcoPass Voucher Client Scanner | EcoPass Enterprise | Next.js, HTML5 QR Scanner | `ECOPASS_SCANNER_PORT:-3010` | `3000` | **Production-Ready** (Quét tem tại quầy POS) |
| **5002** | AI Visual Synthesis Gateway | EcoPass Enterprise | FastAPI, FLUX, Gemini Imagen | `AI_GATEWAY_PORT:-5002` | `5002` | **Prototype** (Cổng sinh media thử nghiệm) |
| **5001** | EcoPass Voucher Backend & API | EcoPass Enterprise | Django, SQLite, Redis | `ECOPASS_API_PORT:-5001` | `8000` | **Production-Ready** (Xác thực chữ ký voucher) |
| **5003** | OSRM Local Routing Engine | Shared Infrastructure | OSRM Backend (MLD Algorithm) | `OSRM_PORT:-5003` | `5000` | **Production-Ready** (Định tuyến giao thông OSM) |
| **6379** | Redis Message Queue | Shared Infrastructure | Redis 7 Alpine (AOF Enabled) | `REDIS_PORT:-6379` | `6379` | **Production-Ready** (Hàng đợi tác vụ bất đồng bộ) |
| **8082** | Citizen IoT Telemetry / Traccar | Citizen Bulky App | Traccar Alpine | `CITIZEN_API_PORT:-8082` | `8082` | **Production-Ready** (Gateway GPS xe thu gom) |

---

## 2. Phân Loại Mức Độ Trưởng Thành (Maturity Assessment)

Hệ sinh thái **NaN-EcoNet** phân định rõ 4 mức độ trưởng thành của các vi dịch vụ nhằm bảo đảm tính minh bạch thực nghiệm đối với ban giám khảo và các kỹ sư vận hành:

1. **Production-Ready (Sẵn sàng vận hành thực tế):**
   - **Lõi tối ưu 3D-PACO / FastAPI (`:8000`):** Thuật toán C++ OpenMP biên dịch tối ưu hóa `-O3 -march=native`, vượt qua kiểm chứng 4 bất biến toán học và xử lý định tuyến cự ly cực ngắn.
   - **Giao diện điều phối MapLibre Dual-Map (`:8502`):** Trực quan hóa bản đồ kép 60 FPS, tương thích mượt mà với OSRM và Traccar.
   - **Cổng rác cồng kềnh cư dân (`:3006`):** Single Page Application chuẩn hóa Vite + React 18, đóng gói Nginx Alpine phục vụ static asset hiệu năng cao.
   - **EcoPass Voucher Scanner (`:3010`) & Backend (`:5001`):** Cơ chế 1-Time Burn Token chống tái sử dụng mã voucher, tích hợp hàng đợi Redis Queue.
   - **OSRM (`:5003`) & Redis (`:6379`):** Hạ tầng định tuyến và trung chuyển sự kiện chuẩn công nghiệp.

2. **Beta / Enterprise (Thử nghiệm doanh nghiệp):**
   - **Enterprise BI Copilot & MCP Server (`:3011`):** Cung cấp Model Context Protocol kết nối dữ liệu kế toán và phân tích phương sai ngân sách Q3/2026. Tích hợp bộ lọc an toàn AST/Regex 3 tầng chống SQL Injection.

3. **Pilot / Research (Môi trường nghiên cứu hội tụ):**
   - **Parameter Convergence Dashboard (`:8501`):** Dashboard Streamlit dùng cho nghiên cứu khoa học, tinh chỉnh các siêu tham số $\alpha, \beta, \rho$ của thuật toán đàn kiến và đối sánh đồ thị hội tụ thời gian thực.

4. **Prototype (Cổng thử nghiệm giao diện thị giác):**
   - **AI Visual Synthesis Gateway (`:5002`):** Cổng proxy tích hợp mô hình sinh ảnh AI (Gemini Imagen, FLUX) thử nghiệm sinh mockup tem voucher và tài liệu truyền thông.

---

## 3. Kiến Trúc Mạng & Ánh Xạ Môi Trường (Networking & Environment Mapping)

### 3.1. Môi Trường Phát Triển Cục Bộ (Local Development)
- **Phương thức thực thi:** Chạy trực tiếp qua lệnh Root Makefile:
  - `make dev-engine`: Khởi động đồng thời 3 tiến trình nền tảng logistics (Ports `8000`, `8501`, `8502`).
  - `make dev-citizen`: Khởi động giao diện quản trị rác cồng kềnh (Port `3006`).
  - `make dev-ecopass`: Khởi động cụm dịch vụ voucher & BI Copilot (Ports `3010`, `3011`, `5002`).
- **Ghi đè cổng:** Nhà phát triển có thể tạo tệp `.env` tại thư mục gốc để thay đổi cổng mặc định mà không cần sửa `docker-compose.yml`:
  ```bash
  # Ví dụ cấu hình .env tùy biến
  COLLECTION_ENGINE_PORT=8001
  COLLECTION_DISPATCHER_PORT=8503
  CITIZEN_PORTAL_PORT=3008
  ECOPASS_SCANNER_PORT=3020
  ```

### 3.2. Môi Trường Vận Hành Đóng Gói (Production Containerized)
- **Mạng Bridge nội bộ (`nan-econet-network`):**
  - Mọi microservice giao tiếp với nhau bằng Container DNS nội bộ, hoàn toàn độc lập với cổng bind trên host:
    - VRP Solver: `http://collection-engine:8000`
    - OSRM Routing: `http://osrm-backend:5000`
    - Redis Cache: `redis://redis-queue:6379`
    - EcoPass Backend: `http://ecopass-api:8000`
- **Volume đồng bộ hóa dữ liệu:**
  - `nan_econet_redis_data`: Lưu trữ snapshot AOF của Redis queue.
  - `nan_econet_collection_data`: Lưu trữ ma trận khoảng cách OSRM và cache lộ trình.
  - `nan_econet_ecopass_data`: Cơ sở dữ liệu SQLite quản lý danh mục tem ly và voucher.
  - `nan_econet_osrm_data`: Chứa tệp bản đồ `.osrm` trích xuất từ dữ liệu OSM TP.HCM.
  - `nan_econet_bi_copilot_data`: Dữ liệu phân tích tài chính doanh nghiệp.
  - `nan_econet_ai_gateway_storage`: Bộ nhớ đệm ảnh sinh thử nghiệm.
- **Bảo mật & Reverse Proxy:**
  - Chỉ mở các cổng giao diện công cộng (`3006`, `3010`, `8502`) qua Reverse Proxy Nginx/Cloudflare Tunnel với SSL/TLS tự động.
  - Các cổng nội bộ (`6379`, `8000`, `5001`) được bảo vệ trong mạng private bridge hoặc chỉ cho phép truy cập từ localhost.
