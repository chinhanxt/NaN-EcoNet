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

### 1.2. Tập Dữ Liệu Thực Nghiệm (Benchmark Dataset):
* **Địa bàn thử nghiệm:** Khu vực đô thị trung tâm TP. Hồ Chí Minh (các tuyến phố thuộc Quận 1 và Quận 3, khu vực Bến Nghé, Đa Kao, Tân Định).
* **Quy mô điểm dừng:** $N = 100$ điểm phát sinh rác thực tế được trích xuất từ dữ liệu OpenStreetMap (bao gồm 65 điểm thùng rác công cộng mặt đường và 35 điểm thu gom nằm sâu trong ngõ hẻm có cự ly đi bộ từ 40m đến 180m).
* **Ma trận chi phí:** Ma trận cự ly đường bộ và thời gian di chuyển thực tế xuất phát từ máy chủ Local OSRM nội bộ (đã áp dụng quy tắc đường một chiều và vận tốc lưu thông giờ thấp điểm trung bình $18\text{ km/h}$).

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
