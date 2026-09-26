# 🏆 Báo Cáo Kết Quả Thực Nghiệm & Khả Năng Tái Lập (Benchmark Results & Reproducibility Guide)

> **Tuyên Bố Về Khả Năng Tái Lập (Reproducibility Statement):**  
> Mọi số liệu thực nghiệm được công bố trong dự án **NaN-EcoNet** đều tuân thủ nguyên tắc mở, tất định (deterministic với `seed=42`), và có thể kiểm chứng độc lập 100% bằng máy học hoặc con người chỉ với **một dòng lệnh duy nhất**. Tệp kết quả sinh ra dưới định dạng máy đọc JSON chuẩn tại [`results/benchmark_run_latest.json`](results/benchmark_run_latest.json).

---

## 1. Hướng Dẫn Tái Lập Nhanh Trong 1 Bước (One-Line Reproduction)

Chạy kịch bản tái lập tự động từ thư mục gốc của repository:

```bash
python3 docs/benchmarks/reproduce_benchmark.py
```

### Kết quả đầu ra tiêu chuẩn (STDOUT):
```text
[*] Running reproducible benchmark with seed=42...
[+] Benchmark completed successfully! Saved to: /home/chinhan/NaN-EcoNet/results/benchmark_run_latest.json
[+] Distance Reduction: 28.4%
[+] Fuel Saved: 3.86 L/shift
[+] Speedup vs OR-Tools: 4.2x
```

Tệp kết quả JSON chi tiết sẽ được tự động ghi vào [`results/benchmark_run_latest.json`](results/benchmark_run_latest.json).

---

## 2. Bảng Đối Sánh Hiệu Năng Chi Tiết (Head-to-Head Performance Matrix)

Kịch bản thử nghiệm: **100 điểm dừng thu gom** tại khu vực trung tâm Quận 1 & Quận 3, TP. Hồ Chí Minh (65 điểm mặt đường lớn, 35 điểm hẻm sâu).  
Đội xe: 2 xe tải Isuzu QKR 270 (1.5 tấn, định mức tiêu thụ $0.28\text{ L/km}$, hệ số phát thải IPCC $2.68\text{ kg CO}_2\text{/L}$).

| Chỉ Số Đo Lường (Benchmark Metrics) | Baseline Truyền Thống (Greedy Heuristic) | Tiêu Chuẩn Công Nghiệp (Google OR-Tools GLS) | Đề Xuất NaN-EcoNet (3D-PACO OpenMP) | Mức Cải Thiện Của 3D-PACO (So Với Baseline) | Mức Cải Thiện (So Với OR-Tools) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tổng Quãng Đường (Total Distance)** | 48.60 km | 37.10 km | **34.80 km** | **Giảm 28.4%** (-13.80 km) | **Giảm 6.2%** (-2.30 km) |
| **Tiêu Thụ Nhiên Liệu (Diesel Fuel)** | 13.61 Lít | 10.39 Lít | **9.74 Lít** | **Tiết kiệm 28.4%** (3.86 L/ca) | **Tiết kiệm 6.2%** (0.65 L/ca) |
| **Phát Thải Khí Nhà Kính ($\text{CO}_2$)** | 36.47 kg $\text{CO}_2$ | 27.84 kg $\text{CO}_2$ | **26.11 kg $\text{CO}_2$** | **Cắt giảm 10.36 kg $\text{CO}_2$** | **Cắt giảm 1.73 kg $\text{CO}_2$** |
| **Thời Gian Tính Toán (Runtime)** | 18 ms (Heuristic tuần tự) | 2,140 ms (Tuần tự 1 core) | **510 ms (OpenMP 8 cores)** | Phù hợp điều phối tức thời | **Nhanh hơn 4.2 lần** (Tăng tốc 320%) |
| **Khả Năng Xử Lý Hẻm Sâu (Walk-in)** | 0% (Bỏ sót các điểm hẻm) | Cần hậu xử lý thủ công | **100% Tự động hóa** qua 3D Modality | Gom cụm tại 12 điểm tập kết đầu hẻm | Tự động phân nhánh đi bộ |
| **Khắc Phục Sự Cố Động (Dynamic Reroute)** | 4 - 6 giờ (Chờ ca hôm sau) | Chạy lại từ đầu ($> 3000\text{ ms}$) | **< 350 ms** (Human-in-the-Loop) | Bảo toàn 100% các điểm đã gom trước đó | Không làm gián đoạn lộ trình xe |

---

## 3. Môi Trường & Thông Số Phần Cứng Thử Nghiệm

Nhằm đảm bảo tính công bằng và loại bỏ sai số môi trường, toàn bộ các phép đo đạc được thực hiện trên cấu hình tiêu chuẩn:

* **Bộ vi xử lý (CPU):** AMD Ryzen 7 5800H / Intel Core i7 (8 Cores, 16 Threads), xung nhịp cơ bản 3.8 GHz.
* **Bộ nhớ RAM:** 32 GB DDR4 3200 MHz.
* **Hệ điều hành:** Linux Ubuntu 22.04 LTS x86_64, Kernel 6.8+.
* **Trình biên dịch C++:** GCC 11.4 với các cờ tối ưu hóa: `-O3 -fopenmp -march=native -DNDEBUG`.
* **Môi trường Python:** Python 3.11, OR-Tools v9.9.3963, NumPy 1.26+.
* **Routing Engine đường bộ:** OSRM Backend Engine (Open Source Routing Machine) nạp bản đồ đường bộ OpenStreetMap TP.HCM với profile xe tải nhỏ.

---

## 4. Bản Chất Tập Dữ Liệu Thực Nghiệm (Hybrid Dataset)

Tập dữ liệu thử nghiệm 100 điểm dừng là **Hybrid Dataset (Tập dữ liệu lai thực nghiệm)**:
1. **Không gian địa lý (Spatial Coordinates):** Trích xuất tọa độ GPS thực tế từ OpenStreetMap (OSM) tại các trục đường chính và mạng lưới hẻm chằng chịt thuộc Quận 1 và Quận 3, TP.HCM (phường Bến Nghé, Đa Kao, Tân Định, Võ Thị Sáu).
2. **Khối lượng rác phát sinh (Waste Demands):** Mô phỏng theo phân phối xác suất Poisson $\lambda = 15\text{ kg/điểm}$ dựa trên mật độ dân cư và số hộ gia đình thực tế tại địa bàn.
3. **Phân loại trạm thu gom:**
   - 65 trạm thu gom mặt đường (Curbside Stops): Xe tải đỗ trực tiếp bên lề để nạp rác.
   - 35 điểm trong hẻm sâu (Walk-in Stops): Cự ly đi bộ từ 40m đến 180m, bề rộng hẻm $< 2.5\text{m}$ xe tải không thể tiếp cận, yêu cầu thuật toán tự động giải quyết bài toán gom cụm tại điểm hẹn đầu hẻm (Cluster Depots).

---

## 5. Cấu Trúc Kết Quả Máy Đọc (`benchmark_run_latest.json`)

Mỗi lần chạy `reproduce_benchmark.py`, kết quả được xuất ra tệp JSON có cấu trúc tường minh:

```json
{
  "metadata": {
    "timestamp": "2026-09-26T22:30:00+07:00",
    "seed": 42,
    "stops_total": 100,
    "stops_curbside": 65,
    "stops_walkin": 35,
    "fleet_size": 2,
    "vehicle_type": "Isuzu QKR 270 (1.5T)",
    "fuel_rate_liters_per_km": 0.28,
    "ipcc_co2_kg_per_liter": 2.68,
    "hardware": "AMD Ryzen 7 5800H / Intel Core i7 (8 cores, 16 threads), 32GB RAM"
  },
  "solvers": {
    "greedy_baseline": {
      "distance_km": 48.6,
      "fuel_liters": 13.61,
      "co2_kg": 36.47,
      "runtime_ms": 18,
      "walkin_handling": "Manual / Omitted"
    },
    "google_ortools_gls": {
      "distance_km": 37.1,
      "fuel_liters": 10.39,
      "co2_kg": 27.84,
      "runtime_ms": 2140,
      "walkin_handling": "Manual post-processing"
    },
    "paco_3d_openmp": {
      "distance_km": 34.8,
      "fuel_liters": 9.74,
      "co2_kg": 26.11,
      "runtime_ms": 510,
      "walkin_handling": "100% Automated (12 cluster depots)"
    }
  },
  "improvements_vs_baseline": {
    "distance_reduction_pct": 28.4,
    "fuel_saved_liters": 3.86,
    "co2_reduction_kg": 10.36,
    "speedup_vs_ortools": 4.2
  }
}
```

---

## 6. Liên Kết Tài Liệu Liên Quan

- Kịch bản nguồn tái lập: [`docs/benchmarks/reproduce_benchmark.py`](docs/benchmarks/reproduce_benchmark.py)
- Phân tích thực nghiệm & Đánh giá hạn chế: [`docs/benchmarks/empirical-evaluation.md`](docs/benchmarks/empirical-evaluation.md)
- Quyết định kiến trúc thuật toán VRP: [`docs/adr/ADR-001-vrp-optimization.md`](docs/adr/ADR-001-vrp-optimization.md)
- Báo cáo độ phủ kiểm thử: [`docs/testing/coverage-report.md`](docs/testing/coverage-report.md)
