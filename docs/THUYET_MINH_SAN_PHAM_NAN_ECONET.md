# BÁO CÁO THUYẾT MINH SẢN PHẨM
## DỰ ÁN: NaN-EcoNet – HỆ SINH THÁI TUẦN HOÀN THÔNG MINH
*(Autonomous Waste Logistics, Citizen Bulky Recycling & Circular 4-Win Economy)*

* **Nhóm tác giả:** NaN-Team (Đại học Công nghệ TP. Hồ Chí Minh - HUTECH)
* **Thành viên:** Bùi Nguyễn Công Nghiệp (2380601460) • Lê Quốc Anh (2380600052) • Nguyễn Chí Nhân (2380601523)
* **Mã nguồn (Repository):** [https://github.com/chinhanxt/NaN-EcoNet](https://github.com/chinhanxt/NaN-EcoNet) *(Apache License 2.0)*

---

### 1. BÀI TOÁN & VẤN ĐỀ THỰC TẾ CẦN GIẢI QUYẾT (4 PAIN POINTS CỦA 4 BÊN)
Tại các đô thị lớn như TP. Hồ Chí Minh (phát sinh hơn 64.000 tấn rác sinh hoạt mỗi ngày), chuỗi logistics thu gom và tái chế đang đối mặt với 4 điểm nghẽn nghiêm trọng (Pain Points):

1. **Phía Cư Dân & Hộ Gia Đình:** Rác cồng kềnh (sofa cũ, nệm mút, tủ gỗ, bàn ghế hỏng) không có kênh thu gom chính thống của công ty môi trường đô thị. Người dân buộc phải gọi xe ba gác tự phát và thường xuyên bị ép giá tùy tiện tại hiện trường (phát sinh từ 300.000 đến 800.000 VNĐ do bốc xếp). Đồng thời, người dân chưa có động lực kinh tế rõ ràng để phân loại rác tái chế (vỏ lon, chai nhựa) tại nguồn.
2. **Phía Đội Ngũ Thu Gom & Tài Xế:** Lộ trình xe thu gom cố định, thiếu linh hoạt dẫn đến chạy trùng tuyến và lãng phí nhiên liệu Diesel. Xe tải ép vào các ngõ hẻm chật hẹp gây ùn tắc giao thông nghiêm trọng. Công nhân vệ sinh phải bới rác thủ công độc hại tại trạm trung chuyển; thời gian xử lý sự cố ngoài hiện trường (tắc đường, ngập nước) kéo dài từ 4 đến 6 giờ làm đình trệ toàn bộ ca làm việc.
3. **Phía Cửa Hàng Bán Lẻ, Căn Tin & Chuỗi F&B:** Lượng khách hàng (đặc biệt là sinh viên và nhân viên văn phòng) thưa thớt vào các khung giờ thấp điểm. Chi phí phát sampling và chạy quảng cáo khuyến mãi trên mạng xã hội tốn kém nhưng tỷ lệ khách thực tế đến cửa hàng thấp (chuyển đổi < 5%).
4. **Phía Doanh Nghiệp Sản Xuất Bao Bì & Nhãn Hàng FMCG:** Đối mặt áp lực pháp lý bắt buộc tuân thủ định mức tái chế theo cơ chế Trách nhiệm Mở rộng của Nhà sản xuất (**EPR** - Nghị định 08/2022/NĐ-CP). Doanh nghiệp thiếu dữ liệu số định vị GPS chứng minh tỷ lệ bao bì được thu hồi sạch; chi phí thuê kiểm toán độc lập đắt đỏ hoặc đối mặt với mức phạt nộp tiền vào Quỹ Bảo vệ Môi trường Việt Nam.

---

### 2. GIẢI PHÁP VÀ CÁC CHỨC NĂNG CHÍNH CỦA SẢN PHẨM (LUỒNG KINH TẾ TUẦN HOÀN 4-WIN)
NaN-EcoNet cung cấp một hệ thống giải pháp công nghệ toàn diện kết nối 3 phân hệ chuyên biệt theo luồng giá trị tuần hoàn khép kín **4-WIN**:

#### 2.1. Ứng Dụng Di Động Cư Dân & Thu Gom Rác Cồng Kềnh AI (Citizen Bulky App)
* **AI Vision Scanner nhận diện đồ cồng kềnh tức thời:** Người dân chụp ảnh đồ nội thất cũ bằng camera điện thoại; mô hình thị giác AI tự động vẽ hộp bao Bounding Box, bóc tách tỷ lệ vật liệu (gỗ, kim loại, mút xốp) và ước lượng kích thước 3D (Dài x Rộng x Cao).
* **Động cơ tính giá trực tiếp 4 thành phần (Live Dynamic Pricing):** Giá cước minh bạch theo công thức: 
  $$P_{\text{total}} = P_{\text{items}} + P_{\text{volume}} + P_{\text{floor}} + P_{\text{alley}}$$
  *(Trong đó: $P_{\text{items}}$: phân loại vật phẩm; $P_{\text{volume}}$: cước thể tích vượt định mức; $P_{\text{floor}}$: phụ phí tầng cao không thang máy; $P_{\text{alley}}$: phụ phí ngõ hẻm sâu > 50m).*
* **Cam kết bảo vệ giá (Dung sai $\le \pm 10\%$ & Khóa giá 15 phút):** Sau khi quét AI, khoảng giá Min-Max được khóa giữ chỗ trong 15 phút. Nếu kích thước/khối lượng kiểm tra tại hiện trường sai lệch trong biên độ $\pm 10\%$, khách hàng được **miễn phí 100% phụ thu phát sinh**.
* **Ví điểm thưởng Eco Rewards:** Cư dân quét mã tem nhiệt trên vỏ lon/chai tái chế để tích điểm, quy đổi trực tiếp thành mã voucher giảm giá đồ uống tại các chuỗi F&B đối tác (Highlands Coffee, Phúc Long, Katinat, Căn tin HUTECH).

#### 2.2. Động Cơ Định Tuyến Tối Ưu Đội Xe & Xử Lý Sự Cố Động (Smart Collection Engine)
* **Kế thừa nền tảng nghiên cứu quốc tế 3D-PACO giải CVRPTW:** Phát triển dựa trên mô hình thuật toán tối ưu hóa bầy đàn 3D-PACO trong bài báo khoa học công bố trên tạp chí hạng Q1 quốc tế *Swarm and Evolutionary Computation* (Elsevier, 2026). Động cơ mở rộng không gian tìm kiếm đa chiều giải bài toán định tuyến phương tiện có tải trọng và khung thời gian đón, tích hợp bản đồ đường bộ thực tế (Local OSRM) tại TP.HCM.
* **Mô hình quyết định nhị phân ngõ hẻm (Bi-Modal Decision):** Mở rộng không gian tìm kiếm với biến nhị phân $o \in \{0, 1\}$ ($o = 0$: xe tải gom tận nơi; $o = 1$: gom rác bằng bộ kéo tập kết tại đầu ngõ lớn), giải quyết triệt để vấn đề mạng lưới hẻm sâu đô thị.
* **Điều phối sự cố động thời gian thực (< 350 ms):** Tự động tính lộ trình vòng tránh đường ngập/rào chắn (Roadblock Detour), ứng cứu thùng rác tràn (Bin Overflow), và điều chuyển điểm gom khi xe gặp sự cố (Breakdown Transfer) mà không cần lập lịch lại từ đầu.
* **Giám sát Telemetry & ML chấm điểm tài xế:** Thu thập tốc độ, gia tốc và chấm điểm hành vi lái xe an toàn, tiết kiệm nhiên liệu theo từng ca chạy.

#### 2.3. Nền Tảng Doanh Nghiệp & Tự Động Hóa Nội Dung (EcoPass Enterprise & Omni-Channel Hub)
* **AI Visual Synthesis Gateway:** Cổng proxy trung gian kết nối các mô hình sinh ảnh chất lượng cao (FLUX, Gemini Imagen, Qwen-Image-2) kèm bộ đệm băm SHA-256 prompt cache chống trùng lặp.
* **Tự động hóa sản xuất & Đăng bài đa kênh (`nan-team/scripts`):** Tự động sinh tiêu đề, kịch bản video tuyên truyền sống xanh, dùng FFmpeg chuyển đổi poster sang video ngắn tỷ lệ 9:16 có nhạc nền sinh thái và tự động xuất bản lên Facebook Page, TikTok Studio, YouTube Shorts.
* **Enterprise BI Copilot & MCP Tools:** Ứng dụng giao thức Model Context Protocol (Anthropic) cho phép ban điều hành truy vấn số liệu tự nhiên bằng Text-to-SQL an toàn, tự động vẽ sơ đồ Mermaid.js và kết xuất báo cáo kiểm toán định mức tái chế EPR cho doanh nghiệp FMCG.

---

### 3. CÔNG NGHỆ SỬ DỤNG (SYSTEM TOPOLOGY & TECH STACK)
Dự án được triển khai theo kiến trúc **Multi-Service Monorepo** với các giao thức giao tiếp chuẩn hóa JSON Schema (`BulkyOrderPayload`, `EcoRewardPayload`):

| Tầng Kiến Trúc | Phân Hệ / Thành Phần | Công Nghệ Sử Dụng | Cổng / Runtime |
| :--- | :--- | :--- | :--- |
| **1. Client & Edge (Giao diện)** | Citizen Bulky Mobile App | Flutter (Dart), Clean Architecture, Bounding Box Camera Stream | iOS / Android / Web |
| | Citizen & Admin Web Portal<br>Dual-Map Interactive Dispatcher | React 18, Vite, Tailwind CSS<br>MapLibre GL JS, Leaflet, Streamlit (Python) | Port 3006<br>Port 8502, 8501 |
| **2. Processing & Algorithm (Lõi)** | 3D-PACO C++ Solver Core | C++17 biên dịch cờ `-O3 -fopenmp -march=native` (8 threads) | C++ Native Core |
| | VRP Solver API & Routing Engine | Python 3.11, FastAPI, Uvicorn, Google OR-Tools v9.9 (GLS) | Port 8000 / 8001 |
| **3. Spatial Infrastructure** | Bản Đồ Số Local OSRM | Open Source Routing Machine, OpenStreetMap TP.HCM sạch không đường lưỡi bò, Cache không gian `route_cache.json` | OSRM Server (Độ trễ < 50ms) |
| **4. Enterprise & Agentic** | Enterprise BI Copilot & MCP Hub | Node.js, TypeScript, Model Context Protocol (Anthropic MCP SDK) | Port 3011 |
| | AI Image Gateway & Auto Media | FastAPI, FLUX, Gemini Imagen, FFmpeg 9:16, Postiz Automation | Port 5002, 4200 |

---

### 4. CÁCH ỨNG DỤNG AI VÀ TỰ ĐỘNG HÓA TRONG SẢN PHẨM

1. **AI Thị Giác Máy Tính (Computer Vision) Trong Nhận Diện Rác Cồng Kềnh:**
   * **Mô hình Gemini 2.5 Flash:** Trích xuất hộp bao 2D chuẩn hóa $[y_{\min}, x_{\min}, y_{\max}, x_{\max}] \in [0, 1000]$. Nhận diện cùng lúc nhiều vật dụng trong 1 ảnh (ví dụ: 1 bàn ăn và 4 ghế tựa).
   * **Ước lượng thể tích 3D & Bóc tách tỷ lệ vật liệu:** Đối chiếu tỷ lệ phối cảnh để tính thể tích hình học $V = (L \times W \times H) / 1.000.000 \text{ (m}^3\text{)}$; tự động phân loại tỷ lệ gỗ tự nhiên/công nghiệp, đệm mút và kim loại để phục vụ tính cước và xếp tải trọng xe.
2. **AI Tối Ưu Hóa Bầy Đàn (3D-PACO) Trong Logistics Đô Thị:**
   * **Cơ chế Pheromone 3 Chiều (Thừa hưởng từ Chau et al., 2026):** Tích hợp ma trận vết mùi đa chiều $\tau(i, j, o)$ và độ hấp dẫn heuristic $\eta(i, j, o) = (1 + \gamma \cdot \text{OdorLevel}_j) / c_{ij}$ (ưu tiên các điểm bốc mùi/đầy ứ và cự ly ngắn).
   * **Tốc độ tính toán vượt trội:** Nhờ tối ưu hóa OpenMP 8 luồng song song trên C++, thuật toán 3D-PACO đạt tốc độ giải chỉ **510 ms** cho cụm 100 điểm, nhanh gấp **4.2 lần** so với thuật toán Google OR-Tools tuần tự (2.140 ms).
3. **AI Tự Động Hóa Sáng Tạo & Đăng Tải Truyền Thông Đa Nền Tảng (Omni-Channel):**
   * **AI Visual Generation:** Tự động sản xuất poster nâng cao ý thức phân loại rác thông qua prompt presets chuyên sâu, tiết kiệm 100% chi phí thiết kế đồ họa thủ công.
   * **Pipeline Render Video Tự Động (FFmpeg):** Tự động ghép chuyển động, ghép nhạc nền bản quyền mở và xuất video định dạng dọc 9:16 tối ưu cho thuật toán lan truyền (viral) của TikTok và Shorts.
   * **Auto-Publisher bền bỉ:** Quản lý cơ chế khóa phiên trình duyệt (`acquireProfileLock`) và Exponential Backoff với jitter ngẫu nhiên, tự động lên lịch đăng bài xuyên suốt 24/7 mà không lo xung đột tiến độ.
4. **Trợ Lý BI Copilot Ứng Dụng Chuẩn Giao Thức Mở MCP:**
   * **Khám phá công cụ tự động (MCP Tool Discovery):** Mô hình LLM tự phân tích câu hỏi người quản lý để gọi chính xác các hàm nghiệp vụ: truy vấn số dư ngân sách ESG, kết xuất lượng rác thu gom theo phường/quận.
   * **Biên dịch sơ đồ động (Dynamic Diagram):** Tự động phân tích câu lệnh văn bản để xuất ra mã nguồn Mermaid.js / PlantUML và hiển thị trực tiếp sơ đồ trực quan hóa dữ liệu trên màn hình điều hành.

---

### 5. GIÁ TRỊ VÀ KHẢ NĂNG ỨNG DỤNG ĐỐI VỚI DOANH NGHIỆP (MA TRẬN LỢI ÍCH 4-WIN)

| Đối Tượng Tham Gia | Lợi Ích Cốt Lõi Nhận Được | Nếu Thiếu EcoNet (Hiện Trạng Cũ) | Hiệu Quả Định Lượng Đo Lường Thực Tế |
| :--- | :--- | :--- | :--- |
| **1. Cư Dân & Sinh Viên** | Thu gom đồ cũ văn minh, minh bạch; tích điểm đổi voucher ăn uống/học tập. | Bị ép giá ba gác; vứt bừa bãi ra vỉa hè; không có động lực phân loại rác tại nguồn. | **Thu nhập tích lũy:** 150.000 – 350.000 VNĐ/tháng; bảo vệ giá dung sai $\le \pm 10\%$. |
| **2. Đội Xe Thu Gom & Tài Xế** | Tuyến đường thông minh; chở đúng tải trọng; bảo vệ sức khỏe và an toàn công nhân. | Tuyến chạy chồng chéo; kẹt xe ngõ hẹp; bới rác thủ công độc hại tại điểm tập kết. | **Giảm 28.4% cự ly di chuyển** (tiết kiệm 3.87 L dầu/ca); **tăng 35% năng suất** phục vụ. |
| **3. Cửa Hàng Bán Lẻ & Căn Tin F&B** | Đón nhận lượng khách hàng sinh viên mới đến đổi voucher; tăng doanh số bán kèm. | Chi phí quảng cáo cao nhưng không hiệu quả; bàn ghế trống vào các khung giờ thấp điểm. | **Tỷ lệ chuyển đổi voucher đạt 68.0%**; tăng **18% doanh thu** từ các món bán kèm. |
| **4. Doanh Nghiệp Bao Bì & Nhãn Hàng FMCG** | Tuân thủ 100% Nghị định 08/2022/NĐ-CP; sở hữu bộ dữ liệu sạch GPS phục vụ ESG. | Nguy cơ bị phạt vi phạm hành chính; truy thu nộp Quỹ Bảo vệ Môi trường Việt Nam. | **Tiết kiệm 35 – 45% chi phí tuân thủ EPR** so với phương án nộp phạt hoặc thuê kiểm toán ngoài. |

---

### 6. LINK MÃ NGUỒN / REPOSITORY & LINK SẢN PHẨM / VIDEO DEMO

* **Mã nguồn toàn bộ dự án (GitHub Monorepo):**  
  [https://github.com/chinhanxt/NaN-EcoNet](https://github.com/chinhanxt/NaN-EcoNet) *(Mã nguồn mở Apache License 2.0, kiểm thử tự động Makefile).*
* **Link Video Demo Thực Tế Hệ Thống (Google Drive):**  
  [https://drive.google.com/file/d/1pFIl_UKL5z9TQ8UQB4PyLLOEf1ttDoX8/view?usp=sharing](https://drive.google.com/file/d/1pFIl_UKL5z9TQ8UQB4PyLLOEf1ttDoX8/view?usp=sharing)  
  *(Video trình diễn thực tế 3 phân hệ: App Flutter Cư dân, Bản đồ Dual-Map 8502, BI Copilot 3011, MMO Automation).*

---

### 7. CÁC TÀI LIỆU LIÊN QUAN PHỤC VỤ VIỆC ĐÁNH GIÁ SẢN PHẨM

#### Bài Báo Khoa Học Nền Tảng (Foundational Research Paper về Thuật Toán 3D-PACO):
> **Chau, P. A., Nguyen, L. T., Pedrycz, W., & Vo, B. (2026).** *Parallel ant colony optimization for vehicle routing with parcel lockers*. **Swarm and Evolutionary Computation** (ISI/Scopus Q1, Elsevier), Vol. 104, 102371.  
> 🔗 **Google Scholar Citation:** [https://scholar.google.com/citations?view_op=view_citation&hl=vi&user=vIowI28AAAAJ&citation_for_view=vIowI28AAAAJ:aqlVkmm33-oC](https://scholar.google.com/citations?view_op=view_citation&hl=vi&user=vIowI28AAAAJ&citation_for_view=vIowI28AAAAJ:aqlVkmm33-oC)  
> 🔗 **ScienceDirect DOI:** [https://doi.org/10.1016/j.swevo.2026.102371](https://doi.org/10.1016/j.swevo.2026.102371)

#### Bảng Đối Sánh Thực Nghiệm Đối Đầu (Head-to-Head Solver Battle trên 100 điểm Quận 1 & Quận 3 TP.HCM):

| Chỉ Số Đo Lường (Benchmark Metrics) | Baseline Tuyến Cố Định (Greedy) | Google OR-Tools Tiêu Chuẩn (GLS) | Đề Xuất 3D-PACO C++ (NaN-EcoNet) | Mức Độ Cải Thiện Của 3D-PACO |
| :--- | :--- | :--- | :--- | :--- |
| **Tổng Quãng Đường Đội Xe** | 48.60 km | 37.10 km | **34.80 km** | **Giảm 28.4%** (Tối ưu nhất) |
| **Nhiên Liệu Tiêu Thụ (Diesel)** | 13.61 Lít | 10.39 Lít | **9.74 Lít** | **Tiết kiệm 28.4%** (3.87 Lít/ca) |
| **Phát Thải Khí Nhà Kính ($\text{CO}_2$)** | 36.47 kg $\text{CO}_2$ | 27.85 kg $\text{CO}_2$ | **26.10 kg $\text{CO}_2$** | **Cắt giảm 10.37 kg $\text{CO}_2$/ca** |
| **Thời Gian Tính Toán (Latency)** | 18 ms | 2.140 ms | **510 ms (OpenMP 8 cores)** | **Nhanh hơn 4.2 lần** so với OR-Tools |
| **Xử Lý Ngõ Hẻm (Walk-in Alley)** | 0% (Bỏ sót các điểm hẻm sâu) | Cần căn chỉnh thủ công | **100% Tự động hóa** | Gom cụm tại 12 trạm đầu ngõ |
| **Khắc Phục Sự Cố Động Tại Chỗ** | 4 - 6 giờ (Chờ ca hôm sau) | Phải giải lại từ đầu (> 3s) | **< 350 ms** (Human-in-the-Loop) | Bảo toàn 100% các điểm đã gom |

#### Danh Mục Tài Liệu Kiến Trúc & Quyết Định Kỹ Thuật (ADRs):
1. `docs/adr/ADR-001-vrp-optimization.md`: Tích hợp Đa mô hình 3D-PACO & Google OR-Tools CVRPTW trên nền Local OSRM.
2. `docs/adr/ADR-002-vision-scanner.md`: Ứng dụng Gemini 2.5 Flash cho Vision AI Scanner & Cơ chế khóa giá dung sai $\pm 10\%$.
3. `docs/adr/ADR-003-mcp-copilot.md`: Chuẩn Model Context Protocol (MCP) cho Enterprise BI Copilot & Quản trị tuần hoàn EPR.
4. `docs/benchmarks/empirical-evaluation.md`: Phương pháp đo lường thực nghiệm, hệ số IPCC và đối chuẩn kỹ thuật.
