<p align="center">
  <img src="docs/assets/econet-nan-banner.png" alt="EcoNet - NaN Header Banner" width="100%" />
</p>

# NaN-EcoNet: The Agentic Green Ecosystem
### Autonomous Waste Logistics, Citizen Bulky Recycling & Circular 4-Win Economy

<p align="center">
  <a href="https://github.com/chinhanxt/NaN-EcoNet/actions/workflows/ci.yml"><img src="https://github.com/chinhanxt/NaN-EcoNet/actions/workflows/ci.yml/badge.svg" alt="CI Monorepo Build" /></a>
  <a href="https://github.com/chinhanxt/NaN-EcoNet/releases"><img src="https://img.shields.io/github/v/release/chinhanxt/NaN-EcoNet?style=flat&color=3b82f6&logo=github" alt="GitHub Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/chinhanxt/NaN-EcoNet?style=flat&color=059669" alt="License" /></a>
  <a href="https://github.com/chinhanxt/NaN-EcoNet/stargazers"><img src="https://img.shields.io/github/stars/chinhanxt/NaN-EcoNet?style=flat&color=eab308&logo=github" alt="Stars" /></a>
  <a href="https://github.com/chinhanxt/NaN-EcoNet/issues"><img src="https://img.shields.io/github/issues/chinhanxt/NaN-EcoNet?style=flat&color=ef4444" alt="Issues" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat&logo=github" alt="PRs Welcome" /></a>
</p>

---

## 🌍 1. Tổng Quan Dự Án (Executive Summary)

Tại các siêu đô thị đang phát triển nhanh như TP. Hồ Chí Minh và Hà Nội, tốc độ đô thị hóa nhanh chóng tạo ra hơn **64.000 tấn rác thải sinh hoạt mỗi ngày**. Trong cấu trúc này, ba điểm nghẽn nghiêm trọng đang làm tê liệt hạ tầng đô thị:
1. **Rác cồng kềnh quá tải**: Đồ nội thất cũ (sofa, nệm, tủ gỗ) bị xả trộm ra vỉa hè do thiếu kênh đặt lịch thu gom chính thống và chi phí phát sinh tùy tiện tại chỗ.
2. **Logistics thu gom kém hiệu quả**: Xe tải rác chạy theo tuyến cố định, tiêu tốn nhiên liệu Diesel, luồn lách vào các con hẻm nhỏ gây tắc nghẽn giao thông và xả khí thải $\text{CO}_2$.
3. **Thiếu động lực kinh tế tuần hoàn**: Người dân chưa có thói quen phân loại rác tại nguồn; trong khi các doanh nghiệp sản xuất bao bì đối mặt với áp lực pháp lý kiểm toán định mức tái chế bắt buộc (**EPR** - Nghị định 08/2022/NĐ-CP).

**NaN-EcoNet** là hệ sinh thái công nghệ mở tích hợp 3 phân hệ liên hoàn:
* 🤖 **Smart Collection Engine**: Tối ưu hóa tuyến xe rác CVRPTW bằng thuật toán đàn kiến đa quyết định (3D-PACO) song song C++ và Google OR-Tools trên nền bản đồ Local OSRM.
* 📱 **Citizen Bulky Waste Platform**: Ứng dụng di động Flutter tích hợp AI Vision (Gemini 2.5 Flash) nhận diện kích thước đồ vật, định giá 4 thành phần minh bạch và cam kết sai số thực địa $\le \pm 10\%$.
* 🌿 **EcoPass Enterprise**: Nền tảng điều phối kinh tế tuần hoàn 4-WIN, tích hợp trợ lý phân tích dữ liệu Enterprise BI qua Model Context Protocol (MCP).

---

## ⚖️ 2. Ma Trận Vấn Đề & Giải Pháp 4-WIN

<p align="center">
  <img src="docs/assets/diagrams/ecopass-4win.png" alt="Mô hình Kinh tế Tuần hoàn 4-WIN" width="100%" />
</p>
<p align="center"><i>Hình 1: Mô hình liên kết lợi ích 4 bên trong nền kinh tế tuần hoàn EcoPass</i></p>

| Bên Tham Gia | Thách Thức Trước Đây | Giải Pháp NaN-EcoNet | Giá Trị Đo Lường Thực Tế |
| :--- | :--- | :--- | :--- |
| **1. Sinh Viên / Người Dân** | Bị ép giá khi gọi xe chở rác cồng kềnh; vứt rác lẫn lộn không có thưởng. | Camera AI quét báo giá cố định 15 phút; quét tem rác tích điểm đổi quà Highlands/căn tin. | **Thu nhập tích lũy:** Đạt 150.000 – 350.000 VNĐ/tháng; bảo vệ giá dung sai $\pm 10\%$. |
| **2. Đội Ngũ Thu Gom** | Lộ trình chồng chéo; kẹt xe trong hẻm sâu; nhặt rác thủ công độc hại. | 3D-PACO gom cụm rác đầu ngõ; điều hướng OSRM né đường cấm và phân bổ tải trọng cân bằng. | **Giảm 28.4% quãng đường** ($3.87\text{ L Diesel/ca}$); tăng 35% năng suất lao động. |
| **3. Cửa Hàng / Căn Tin** | Tốn kém chi phí marketing phát tờ rơi và tìm kiếm khách hàng mới. | Trở thành điểm đổi quà EcoPass, thu hút dòng sinh viên đến quầy sử dụng voucher. | **Tỷ lệ chuyển đổi voucher 68%**; tăng 18% doanh thu từ các đơn hàng mua kèm tại quầy. |
| **4. Doanh Nghiệp FMCG** | Nguy cơ bị xử phạt vi phạm định mức tái chế bắt buộc theo Nghị định 08/2022/NĐ-CP. | Cung cấp cổng dữ liệu kiểm toán EPR định vị GPS sạch và báo cáo tuân thủ tự động qua MCP. | **Tiết kiệm 35 – 45% chi phí tuân thủ EPR** so với phương án nộp phạt hoặc thuê kiểm toán ngoài. |

---

## 🏛️ 3. Kiến Trúc Hợp Nhất & Phân Công Trách Nhiệm

Hệ thống được tổ chức theo mô hình Monorepo với ranh giới trách nhiệm kỹ thuật rõ ràng giữa 3 kỹ sư nòng cốt:

<p align="center">
  <img src="docs/assets/diagrams/system-topology.png" alt="Kiến trúc Tổng thể NaN-EcoNet" width="100%" />
</p>
<p align="center"><i>Hình 2: Kiến trúc Monorepo phân tầng và luồng dữ liệu liên phân hệ</i></p>

### Ma Trận Phân Hệ & Mức Độ Trưởng Thành (Maturity Matrix):

| Phân Hệ | Thư Mục Mã Nguồn | Kỹ Sư Phụ Trách | Trọng Tâm Kỹ Thuật | Mức Độ Hoàn Thiện |
| :--- | :--- | :--- | :--- | :--- |
| **Logistics VRP Engine** | [`apps/smart-collection-engine`](apps/smart-collection-engine) | **Bùi Nguyễn Công Nghiệp** (`congnghip`) | Thuật toán 3D-PACO C++ OpenMP, Google OR-Tools CVRPTW, Local OSRM, Telemetry ML. | **Production-Ready** (Đã đối chuẩn 100 điểm) |
| **Citizen Bulky Mobile** | [`apps/citizen-bulky-app`](apps/citizen-bulky-app) | **Lê Quốc Anh** (`EnglandLee`) | Flutter Client (iOS/Android), Gemini 2.5 Flash Vision Scanner, Live Dynamic Pricing. | **Production-Ready** (Đã kiểm thử unit/widget) |
| **Enterprise BI & MCP** | [`apps/ecopass-enterprise`](apps/ecopass-enterprise) | **Nguyễn Chí Nhân** (`chinhanxt`) | MCP Query Engine, Dynamic Diagram Engine, AI Visual Gateway, Social Automation. | **Beta / Experimental** (Đã kết nối API mẫu) |

---

## 📊 4. Đối Sánh Hiệu Năng Thực Nghiệm (Empirical Benchmarks)

Dữ liệu thực nghiệm được đo đạc tại cụm 100 điểm thu gom rác thực tế tại Quận 1 & Quận 3, TP.HCM với 2 xe tải 1.5 tấn (Định mức tiêu hao: $0.28\text{ L Diesel/km}$, hệ số phát thải: $2.68\text{ kg CO}_2\text{/L}$):

| Chỉ Số Đo Lường (Benchmark Metrics) | Baseline Truyền Thống (Fixed Greedy) | Tiêu Chuẩn Công Nghiệp (Google OR-Tools GLS) | Đề Xuất NaN-EcoNet (3D-PACO Multi-Decision) | Mức Cải Thiện Của 3D-PACO |
| :--- | :--- | :--- | :--- | :--- |
| **Tổng Quãng Đường (Total Distance)** | 48.60 km | 37.10 km | **34.80 km** | **Giảm 28.4%** cự ly chạy xe |
| **Tiêu Thụ Nhiên Liệu (Diesel Fuel)** | 13.61 Lít | 10.39 Lít | **9.74 Lít** | **Tiết kiệm 28.4%** dầu Diesel ($3.87\text{ L/ca}$) |
| **Phát Thải Khí Nhà Kính ($\text{CO}_2$)** | 36.47 kg $\text{CO}_2$ | 27.85 kg $\text{CO}_2$ | **26.10 kg $\text{CO}_2$** | **Cắt giảm 10.37 kg $\text{CO}_2$** mỗi ca chạy |
| **Thời Gian Tính Toán (Runtime)** | 18 ms (Heuristic tuần tự) | 2.140 ms (Tuần tự 1 core) | **510 ms (OpenMP 8 cores)** | **Nhanh hơn 4.2 lần** so với OR-Tools |
| **Thu Gom Ngõ Hẻm (Walk-in)** | 0% (Bỏ sót các điểm trong hẻm) | Cần tinh chỉnh thủ công | **100% Tự động hóa** | Gom cụm tại 12 điểm hẹn đầu hẻm |
| **Thời Gian Xử Lý Sự Cố Động** | 4 - 6 giờ (Chờ ca hôm sau) | Phải chạy lại từ đầu ($>3\text{s}$) | **< 350 ms** (Human-in-the-Loop) | Bảo toàn 100% các điểm đã thu gom |

> 📖 *Xem phương pháp đo đạc chi tiết, cấu hình phần cứng và công thức kiểm kê khí nhà kính tại: [docs/benchmarks/empirical-evaluation.md](docs/benchmarks/empirical-evaluation.md).*

---

## ⚡ 5. Hướng Dẫn Khởi Chạy Nhanh (Quick Start)

### 5.1. Yêu Cầu Môi Trường:
* **Hệ điều hành:** Linux (khuyến nghị Ubuntu 22.04+) hoặc macOS.
* **Công cụ cốt lõi:** Node.js $\ge 20$, Python $\ge 3.11$, Docker & Docker Compose, Bun hoặc pnpm.

### 5.2. Cài Đặt & Khởi Chạy:
```bash
# 1. Clone repository
git clone https://github.com/chinhanxt/NaN-EcoNet.git
cd NaN-EcoNet

# 2. Cài đặt toàn bộ dependencies cho cả 3 phân hệ
make install-all

# 3. Khởi chạy từng phân hệ độc lập:
make dev-engine    # Chạy cụm Smart Collection Engine & 3D-PACO (Ports 8000, 8501, 8502)
make dev-citizen   # Chạy cụm Citizen Bulky Waste Portal & Web Client (Port 3006)
make dev-ecopass   # Chạy cụm EcoPass Enterprise & MCP Tools (Ports 3009, 3010, 3011, 3012, 3013)

# Hoặc khởi chạy toàn bộ dịch vụ qua Docker Compose:
make docker-up
```

---

## 📚 6. Hệ Thống Tài Liệu Kỹ Thuật Chuyên Sâu (Documentation Index)

Để giữ cho trang chủ ngắn gọn và trực quan, toàn bộ tài liệu đặc tả kỹ thuật chi tiết đã được phân tách thành các chuyên đề độc lập:

* 🏛️ **[Kiến Trúc Hợp Nhất & Hợp Đồng Dữ Liệu](docs/architecture/unified-architecture.md)**: Chi tiết sơ đồ sequence end-to-end, cấu trúc JSON Schema trao đổi dữ liệu giữa 3 phân hệ.
* 🚛 **[Động Cơ Thuật Toán 3D-PACO & CVRPTW](docs/subsystems/smart-collection-engine.md)**: Chứng minh toán học, công thức chuyển dời xác suất đàn kiến, bộ lọc địa lý OSRM và mô hình ML Telemetry.
* 📱 **[Nền Tảng AI Vision & Định Giá Cồng Kềnh](docs/subsystems/citizen-bulky-app.md)**: Quy trình nhận diện bounding box Gemini Flash, công thức tính cước 4 thành phần và cam kết bảo vệ giá $\pm 10\%$.
* 🌿 **[EcoPass Enterprise & Model Context Protocol (MCP)](docs/subsystems/ecopass-enterprise.md)**: Thiết kế MCP server, trợ lý BI Copilot, proxy sinh ảnh và bộ công cụ tự động hóa truyền thông.
* 📊 **[Đánh Giá Thực Nghiệm & Báo Cáo Đo Đạc ESG](docs/benchmarks/empirical-evaluation.md)**: Dữ liệu mẫu 100 điểm TP.HCM, tham số đội xe Isuzu QKR 270 và đối chuẩn thời gian thực.
* 📋 **[Hồ Sơ Quyết Định Kiến Trúc (Architecture Decision Records - ADRs)](docs/adr/)**: Lịch sử quyết định kỹ thuật (`ADR-001` Định tuyến VRP, `ADR-002` Thị giác AI, `ADR-003` Giao thức MCP).

---

## 📜 7. Bản Quyền & Trích Dẫn Nghiên Cứu (Citation)

Dự án phát hành theo giấy phép nguồn mở **[Apache License 2.0](LICENSE)**.

Nếu bạn sử dụng mã nguồn, kiến trúc hệ thống hoặc các thuật toán đề xuất trong dự án này cho các công trình nghiên cứu khoa học, khóa luận tốt nghiệp hoặc bài báo hội thảo, xin vui lòng trích dẫn theo định dạng BibTeX từ file [`CITATION.cff`](CITATION.cff):

```bibtex
@software{Nguyen_NaN-EcoNet_2026,
  author       = {Nguyen, Chi Nhan and Bui, Nguyen Cong Nghiep and Le, Quoc Anh},
  title        = {{NaN-EcoNet: The Agentic Green Ecosystem for Autonomous Waste Logistics & Circular 4-Win Economy}},
  month        = sep,
  year         = 2026,
  publisher    = {GitHub},
  version      = {1.0.0},
  url          = {https://github.com/chinhanxt/NaN-EcoNet},
  license      = {Apache-2.0}
}
```

### Đội Ngũ Phát Triển Cốt Lõi (Core Engineering Team):
* **Nguyễn Chí Nhân** ([@chinhanxt](https://github.com/chinhanxt)) — *System Architect & Enterprise Lead*
* **Bùi Nguyễn Công Nghiệp** ([@congnghip](https://github.com/congnghip)) — *Logistics & Metaheuristics Specialist*
* **Lê Quốc Anh** ([@EnglandLee](https://github.com/EnglandLee)) — *Frontend & Computer Vision Engineer*

<br/>

<p align="center">
  <b>NaN-EcoNet — Kiến tạo Đô thị Thông minh, Bền vững và Tuần hoàn cho Việt Nam.</b><br/>
  <i>Đại học Công nghệ TP. Hồ Chí Minh (HUTECH) & Cộng đồng Nguồn mở Toàn cầu.</i>
</p>
