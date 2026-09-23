# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-26

Bản phát hành chính thức đầu tiên đánh dấu sự hợp nhất toàn diện của hệ sinh thái **NaN-EcoNet** thành một cấu trúc Monorepo thống nhất, giải quyết trọn vẹn chuỗi giá trị từ thu gom rác thải đô thị thông minh đến mô hình kinh tế tuần hoàn tạo động lực kinh tế 4 bên (4-Win Circular Economy).

### Added

#### 1. Kiến Trúc Hợp Nhất Monorepo (Monorepo Consolidation)
* Hợp nhất cấu trúc 3 phân hệ cốt lõi tại `apps/`:
  * `apps/smart-collection-engine`: Lõi tính toán tối ưu hóa tuyến đường & phân tích dữ liệu logistics.
  * `apps/ecopass-enterprise`: Nền tảng kinh tế tuần hoàn và trợ lý BI Copilot chuẩn MCP.
  * `apps/citizen-bulky-app`: Cổng dịch vụ cư dân và ứng dụng di động thu gom rác cồng kềnh AI.
* Xây dựng hệ thống quản trị dự án, hồ sơ mã nguồn mở đạt chuẩn cộng đồng quốc tế 100% (Apache-2.0, CFF, Contributing, Security, Code of Conduct, Architecture Decision Records).

#### 2. Lõi Điều Phối Tuyến Đường 3D-PACO & CVRPTW Engine
* **Định tuyến tối ưu đa mục tiêu (Multi-objective Routing)**:
  * Tích hợp thuật toán tối ưu hóa bầy kiến song song đa chiều (**3D-PACO** - Parallel Ant Colony Optimization) viết bằng C++ và Python.
  * Tích hợp bộ giải công nghiệp **Google OR-Tools CVRPTW** (Capacitated Vehicle Routing Problem with Time Windows).
* **Định tuyến bản đồ Offline & Bản quyền trung lập**:
  * Tích hợp máy chủ **OSRM (Open Source Routing Machine)** chạy cục bộ, tối ưu hóa ma trận thời gian và khoảng cách thực tế thay vì khoảng cách Euclid.
  * Giao diện bản đồ tương tác điều phối **MapLibre GL** và Leaflet sạch hoàn toàn, không đường lưỡi bò (`apps/smart-collection-engine/map_ui` chạy tại cổng `8502`).
* **Báo cáo định lượng phát thải ESG (Quantifiable Impact)**:
  * Phân hệ tính toán cắt giảm quãng đường di chuyển (km), nhiên liệu dầu Diesel tiết giảm (Lít) và lượng khí thải nhà kính giảm thiểu ($\text{kg CO}_2$).
  * Dashboard phân tích tham số thuật toán và đồ thị hội tụ bằng **Streamlit** tại cổng `8501`.

#### 3. AI Vision Scanner & Hệ Thống Đặt Thu Gom Rác Cồng Kềnh
* **Nhận diện thị giác phế thải với Gemini 2.5 Flash**:
  * Phân tích ảnh chụp hiện trường đồ nội thất, phế thải cồng kềnh (sofa, nệm, tủ, bàn ghế, thiết bị điện tử gia dụng).
  * Tự động vẽ bounding box, ước tính kích thước 3 chiều (Dài x Rộng x Cao) và phân loại nhóm vật liệu (gỗ ép, kim loại, da nỉ).
* **Quy trình Request Wizard 3 bước & Đa vai trò (RBAC)**:
  * Ứng dụng di động **Flutter** đa vai trò: Cổng cư dân (*Citizen*), Tài xế xe rác cồng kềnh (*Bulky Driver*), và Điều phối viên (*Operator*).
  * Tách biệt hoàn toàn luồng xe thu gom rác cồng kềnh chuyên dụng với xe thu gom rác thông thường.
* **Live Pricing Engine & Cam kết sai số (Tolerance Guarantee)**:
  * Bộ tính giá cước động theo công thức nghiệp vụ minh bạch: Phí vật dụng + Phí xe khu vực + Phụ phí bốc vác tầng lầu/tháo dỡ + VAT - Ưu đãi.
  * Cơ chế bảo hiểm cam kết sai số thực tế khi tài xế đến hiện trường không vượt quá $\le \pm 10\%$.
  * Đồng hồ đếm ngược **15 phút giữ chỗ cọc (Countdown Slot Timer)** tích hợp thanh toán mã QR, MoMo, VNPay.

#### 4. Nền Tảng Tuần Hoàn Rác - Thưởng EcoPass (4-Win Waste-to-Reward)
* **Liên kết lợi ích 4 bên (Citizen - Brand - Merchant - Recycler)**:
  * Mô hình tuần hoàn vỏ lon/ly cà phê đổi voucher khuyến mãi, đáp ứng trách nhiệm mở rộng của nhà sản xuất (EPR Compliance).
* **Cơ chế chống gian lận Tem Quét 1-Time Burn**:
  * Mã QR in nhiệt từ trạm rác kèm kiểm tra tọa độ GPS trạm thu gom và hash bảo mật.
* **Bộ ứng dụng phân hệ EcoPass**:
  * `client-scanner` (Port 3011): WebApp quét tem nhận thưởng và làm khảo sát thương hiệu.
  * `brand-portal` (Port 3009): Cổng nhãn hàng quản lý chiến dịch tài trợ voucher xanh và ngân sách EPR.
  * `cashier-pos` (Port 3010): Ứng dụng thu ngân tại cửa hàng quét xác thực và gạch nợ voucher (burn).
  * `partner-portal` (Port 3012) & `sso-portal` (Port 3013): Cổng đăng nhập tập trung và quản trị trạm thu hồi.

#### 5. Enterprise BI Copilot Chuẩn Model Context Protocol (MCP)
* **Kiến trúc MCP Server**:
  * Triển khai giao thức **Model Context Protocol (MCP)** cung cấp các công cụ (tools) và tài nguyên (resources) truy vấn dữ liệu tài chính, tốc độ đổi voucher và phân tích chiến dịch xanh theo thời gian thực.
  * Tích hợp CopilotKit hỗ trợ trợ lý AI trò chuyện, tra cứu dữ liệu và xuất báo cáo tự động cho ban điều hành doanh nghiệp.

---

### Changed
* Đồng bộ hóa biến môi trường và tài liệu hướng dẫn khởi động giữa các ứng dụng thành Makefile chuẩn hóa.
* Cải thiện bộ lọc bản đồ điều phối nhằm ngăn chặn triệt để tình trạng hiển thị bản đồ vi phạm chủ quyền lãnh thổ.

### Security
* Áp dụng mã hóa AES-256 cho token mạng xã hội tại phân hệ MMO Automation (`nan-team`).
* Chuẩn hóa chính sách bảo mật [SECURITY.md](SECURITY.md) và thiết lập quy trình báo cáo lỗ hổng có trách nhiệm.

[1.0.0]: https://github.com/chinhanxt/NaN-EcoNet/releases/tag/v1.0.0
