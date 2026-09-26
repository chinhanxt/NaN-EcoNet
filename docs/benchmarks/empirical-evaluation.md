# 📊 Đánh Giá Thực Nghiệm & Đối Sánh Hiệu Năng (Empirical Evaluation & Benchmarks)

Tài liệu này công bố phương pháp đo lường, tập dữ liệu thực nghiệm và kết quả đối sánh hiệu năng chi tiết giữa các giải thuật giải bài toán định tuyến thu gom rác thải đô thị trong hệ sinh thái NaN-EcoNet.

---

## 1. Phương Pháp & Điều Kiện Thử Nghiệm (Methodology & Test Setup)

### 1.1. Hạ Tầng Phần Cứng & Môi Trường Đo Đạc:
* **Hệ điều hành:** Ubuntu 22.04 LTS x86_64, Linux kernel 6.8.
* **Bộ vi xử lý:** AMD Ryzen 7 / Intel Core i7 (8 Cores, 16 Threads), xung nhịp cơ bản 3.8 GHz.
* **Bộ nhớ RAM:** 32 GB DDR4 3200 MHz.
* **Trình biên dịch:** GCC 11.4 với cờ tối ưu hóa `-O3 -fopenmp -march=native`.
* **Môi trường Python:** Python 3.11, OR-Tools v9.9.3963, NumPy 1.26.

### 1.2. Bản chất tập dữ liệu (Hybrid Dataset: tọa độ thực tế OpenStreetMap kết hợp phân phối Poisson sản lượng):
* **Địa bàn thử nghiệm:** Khu vực đô thị trung tâm TP. Hồ Chí Minh (các tuyến phố thuộc Quận 1 và Quận 3, khu vực phường Bến Nghé, Đa Kao, Tân Định, Võ Thị Sáu).
* **Bản chất Hybrid Dataset (Tập dữ liệu lai thực nghiệm):**
  - **Tọa độ không gian địa lý (Spatial Coordinates):** Trích xuất tọa độ GPS thực tế từ OpenStreetMap (OSM) phản ánh chính xác cấu trúc mạng lưới giao thông đô thị đặc thù của TP.HCM.
  - **Khối lượng rác phát sinh (Waste Demands):** Mô phỏng theo phân phối Poisson với kỳ vọng $\lambda = 15\text{ kg/thùng}$ dựa trên mật độ dân số và số hộ gia đình thực tế tại địa bàn khảo sát.
* **Quy mô và phân loại điểm dừng:** $N = 100$ điểm phát sinh rác bao gồm:
  - **65 điểm gom ven đường (Curbside Stops):** Thùng rác công cộng trên các trục đường chính và đường nhánh có bề rộng mặt đường $\ge 3.5\text{m}$, cho phép xe tải tiếp cận trực tiếp.
  - **35 điểm trong ngõ hẻm sâu (Walk-in Stops):** Nằm sâu trong các con hẻm có bề rộng $< 2.5\text{m}$, cự ly đi bộ từ đầu hẻm dao động từ $40\text{m}$ đến $180\text{m}$, xe tải không thể đi vào mà đòi hỏi thuật toán tự động giải quyết bài toán gom cụm tại điểm hẹn đầu hẻm.
* **Ma trận chi phí đường bộ:** Ma trận cự ly và thời gian di chuyển thực tế xuất phát từ máy chủ OSRM nội bộ (áp dụng luật cấm rẽ, đường một chiều, hệ số lượn vòng đô thị $1.35$ và vận tốc lưu thông trung bình giờ thấp điểm $18\text{ km/h}$).

### 1.3. Tham Số Đội Xe & Hệ Số Môi Trường:
* **Đội xe:** 2 xe tải gom rác nén chuyên dụng cỡ nhỏ (dòng Isuzu QKR 270, trọng tải 1.5 tấn, sức chứa thiết kế 500 kg rác nén mỗi ca).
* **Suất tiêu thụ nhiên liệu Diesel:** $0.28\text{ Lít/km}$ (định mức đo đạc thực tế của xe gom rác đô thị di chuyển dừng-đỗ liên tục).
* **Hệ số phát thải $\text{CO}_2$:** $2.68\text{ kg CO}_2/\text{Lít Diesel}$ (theo tiêu chuẩn hướng dẫn kiểm kê khí nhà kính của Ban Liên chính phủ về Biến đổi Khí hậu - IPCC).
* **Đơn giá dầu Diesel tham chiếu:** $22.500\text{ VNĐ/Lít}$.

---

## 2. Bảng Đối Sánh Hiệu Năng Chi Tiết (Head-to-Head Solver Battle)

<p align="center">
  <img src="../assets/diagrams/performance-growth.png" alt="Performance Growth Chart" width="100%" />
</p>
<p align="center"><i>Hình: So sánh mức cắt giảm cự ly, nhiên liệu tiêu thụ và tốc độ tính toán giữa các bộ giải</i></p>

| Chỉ Số Đo Lường (Benchmark Metrics) | Baseline Truyền Thống (Fixed Greedy Routes) | Tiêu Chuẩn Công Nghiệp (Google OR-Tools GLS) | Đề Xuất NaN-EcoNet (3D-PACO Multi-Decision) | Mức Cải Thiện Của 3D-PACO (So Với Baseline) |
| :--- | :--- | :--- | :--- | :--- |
| **Tổng Quãng Đường (Total Distance)** | 48.60 km | 37.10 km | **34.80 km** | **Giảm 28.4%** cự ly chạy xe (Tốt nhất) |
| **Tiêu Thụ Nhiên Liệu (Diesel Fuel)** | 13.61 Lít | 10.39 Lít | **9.74 Lít** | **Tiết kiệm 28.4%** nhiên liệu ($3.87\text{ Lít/ca}$) |
| **Phát Thải Khí Nhà Kính ($\text{CO}_2$)** | 36.47 kg $\text{CO}_2$ | 27.85 kg $\text{CO}_2$ | **26.10 kg $\text{CO}_2$** | **Cắt giảm 10.37 kg $\text{CO}_2$** mỗi ca chạy |
| **Thời Gian Tính Toán (Execution Time)** | 18 ms (Heuristic tuần tự) | 2.140 ms (Tuần tự 1 core) | **510 ms (OpenMP 8 cores)** | **Nhanh hơn 4.2 lần** so với Google OR-Tools |
| **Khả Năng Xử Lý Hẻm Sâu (Walk-in)** | 0% (Bỏ sót các điểm trong hẻm) | Cần tinh chỉnh thủ công | **100% Tự động hóa** qua 3D Decision Modality | Gom cụm thông minh tại 12 điểm hẹn đầu hẻm |
| **Thời Gian Khắc Phục Sự Cố Động** | 4 - 6 giờ (Chờ ca hôm sau) | Phải chạy lại từ đầu ($>3\text{s}$) | **< 350 ms** (Cơ chế Human-in-the-Loop) | Bảo toàn 100% các điểm đã gom trước đó |

---

## 3. Phân Tích Ý Nghĩa Kỹ Thuật

1. **Hiệu Quả Cắt Giảm Quãng Đường (28.4%):**
   * Phương pháp truyền thống chạy tuần tự theo danh sách trạm cố định dẫn đến hiện tượng xe tải phải quay đầu, chạy zigzag qua lại nhiều lần trên các trục đường nhánh.
   * Thuật toán 3D-PACO nhận diện các cụm điểm rác trong ngõ hẻm có cự ly đi bộ dưới 180m và gộp chúng vào trạm gom đầu hẻm lớn, giúp xe tải không cần phải luồn lách vào các con hẻm chật hẹp, vừa giảm cự ly di chuyển vừa giải phóng áp lực ùn tắc giao thông đô thị.

2. **Tính Tương Thích & Tính Nhất Quán Về Nhiên Liệu:**
   * Trong mô hình toán tuyến tính $f(d) = 0.28 \times d$, tỷ lệ cắt giảm nhiên liệu Diesel ($28.4\%$) tỷ lệ thuận trực tiếp với tỷ lệ cắt giảm tổng chiều dài lộ trình của đội xe.
   * Lượng khí phát thải nhà kính $\text{CO}_2$ được cắt giảm $10.37\text{ kg}$ trong mỗi ca chạy đối với cụm 100 điểm, tương đương với mức giảm hơn **7.5 tấn $\text{CO}_2$ mỗi năm** trên một địa bàn cấp phường/xã.

---

## 4. Nguy Cơ Ảnh Hưởng Tính Chuẩn Xác & Giới Hạn Thực Nghiệm (Threats to Validity & Empirical Limitations)

Mặc dù kết quả thực nghiệm chứng minh ưu thế vượt trội của giải thuật 3D-PACO trên tập dữ liệu mô phỏng chuẩn hóa, việc triển khai trong điều kiện thực địa tại TP. Hồ Chí Minh cần nhìn nhận khách quan các nguy cơ và giới hạn sau:

1. **Biến Động Triều Cường & Ngập Nước Đô Thị (Tidal Inundation & Urban Flooding):**
   * *Bối cảnh:* TP.HCM vào mùa mưa (tháng 5 – tháng 11) kết hợp các đợt triều cường rằm và mùng một âm lịch gây ngập cục bộ tại một số trục đường trũng thấp (khu vực chân cầu Bông, đường Nguyễn Văn Cừ, kênh Nhiêu Lộc - Thị Nghè).
   * *Tác động:* Độ sâu ngập $> 0.3\text{m}$ làm gián đoạn lộ trình của xe tải Isuzu 1.5T hoặc làm giảm vận tốc di chuyển xuống dưới $5\text{ km/h}$, khiến ma trận thời gian di chuyển OSRM tĩnh bị sai lệch so với thực tế.
   * *Biện pháp giảm thiểu:* Tích hợp dữ liệu trạm đo triều cường thời gian thực để tự động gán trọng số phạt cực lớn ($\infty$) cho các cung đường bị ngập sâu trong khung giờ triều dâng.

2. **Ùn Tắc Giao Thông Giờ Cao Điểm (Peak-Hour Traffic Congestion):**
   * *Bối cảnh:* Vận tốc tham chiếu $18\text{ km/h}$ được đo đạc trong khung giờ thấp điểm hoặc ban đêm (21h00 - 05h00) - khung giờ vận hành chủ yếu của xe gom rác đô thị.
   * *Tác động:* Khi xe phải vận hành trong các khung giờ cao điểm (07h00 - 08h30 hoặc 17h00 - 18h30), mặc dù cự ly vật lý không đổi nhưng thời gian hành trình thực tế có thể kéo dài thêm $35 - 40\%$, gây nguy cơ vi phạm cửa sổ thời gian (Time Windows).
   * *Biện pháp giảm thiểu:* Áp dụng mô hình ma trận thời gian phụ thuộc thời gian (Time-Dependent Travel Times - TDVRP) cập nhật theo hệ số giờ cao điểm.

3. **Phát Sinh Khối Lượng Rác Đột Xuất (Dynamic Demand Surges & Overload):**
   * *Bối cảnh:* Vào các dịp lễ hội, sự kiện văn hóa hoặc ngày cuối tuần tại trung tâm Quận 1 & Quận 3, khối lượng rác thực tế có thể vượt xa giá trị kỳ vọng của phân phối Poisson ($\lambda = 15\text{ kg}$).
   * *Tác động:* Xe tải có thể bị đầy tải sớm hơn dự kiến ($> 1500\text{ kg}$), buộc phải ngắt lộ trình giữa chừng để chạy về bãi trung chuyển Đa Phước/Bình Hưng Hòa đổ rác.
   * *Biện pháp giảm thiểu:* NaN-EcoNet trang bị cơ chế Human-in-the-Loop với thời gian tính toán lại lộ trình động (Dynamic Re-routing) dưới $350\text{ ms}$, cho phép chuyển giao các điểm dừng còn lại sang xe khác hoặc chia nhỏ ca chạy một cách thích ứng.

---

## 5. Khả Năng Tái Lập Độc Lập (Reproducibility)

Toàn bộ kết quả benchmark được thiết kế để có thể tái lập 100% bằng máy học hoặc con người:
* **Kịch bản tái lập tự động:** [`docs/benchmarks/reproduce_benchmark.py`](reproduce_benchmark.py) (chạy với `seed=42` tất định).
* **Kết quả JSON máy đọc:** [`results/benchmark_run_latest.json`](../../results/benchmark_run_latest.json).
* **Hướng dẫn chi tiết:** Xem [`RESULTS.md`](../../RESULTS.md) tại thư mục gốc repository.

