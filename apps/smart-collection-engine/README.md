# NaN-EcoNet — Smart Waste Collection & Incident Dispatching Engine

Phân hệ **Tối ưu hóa Tuyến đường Thu gom Rác Thông minh & Xử lý Sự cố Động Thời gian Thực** thuộc hệ sinh thái **NaN-EcoNet**.

Hệ thống kết hợp thuật toán tối ưu hóa bầy đàn 3D song song (**3D-PACO**), thư viện định tuyến công nghiệp **Google OR-Tools**, mạng lưới định tuyến đường bộ thực tế (**OSRM**), cùng mô hình máy học (**ML**) giám sát telemetry đội xe thu gom rác đô thị.

---

## 📌 Tính năng cốt lõi (Core Features)

### 1. Thuật toán Định tuyến Tối ưu Đa xe (Multi-Vehicle Waste VRP)
* **3D-PACO (3D-Parallel Ant Colony Optimization)**: Thuật toán đàn kiến song song 3 chiều tối ưu hóa phân bổ lộ trình cho đội xe thu gom rác, cân bằng tải trọng (Capacitated VRP) và khung thời gian phục vụ (Time Windows).
* **Google OR-Tools Benchmark**: Tích hợp bộ giải Guided Local Search làm đối chuẩn công nghiệp để so sánh hiệu năng và độ tối ưu.
* **Baseline Heuristic**: Lộ trình tham lam (Greedy / Nearest-Neighbor) mô phỏng quy trình gom rác truyền thống để đối sánh hiệu quả cải thiện.
* **Định tuyến đường phố thực tế (Real-World OSRM Routing)**: Lộ trình bám sát 100% mạng lưới giao thông đường bộ đô thị (khu vực TP.HCM), tích hợp hệ thống cache tọa độ (`route_cache.json`) giúp tăng tốc phản hồi dưới 50ms.

### 2. Nghiệp vụ Quản lý & Thu gom Rác Đô thị
* **Đa dạng phân loại điểm thu gom**:
  * **Thùng rác tập trung đô thị (Centralized Bins)**: Điểm gom lớn, dung tích cao.
  * **Thùng rác công cộng linh hoạt (Flexible Bins)**: Các thùng rác vãng lai theo trục đường phố.
  * **Điểm gom rác ngõ hẻm (Walk-in / Alley Bins)**: Hỗ trợ tự động định tuyến nhân viên đi bộ vào ngõ hẻm gom rác tới điểm tập kết xe tải.
* **Giám sát mức rác thông minh (IoT Fill-Level)**: Tích hợp dữ liệu dung tích rác thời gian thực, lọc và ưu tiên các điểm có nguy cơ quá tải (>80%).
* **An toàn địa lý**: Tự động nhận diện và chặn các điểm lỗi nằm trên sông, kênh rạch hoặc vùng nước.

### 3. Điều phối & Xử lý Sự cố Động (Dynamic Incident Resolution)
Cơ chế **Human-in-the-Loop** cho phép điều phối viên xử lý tức thời các biến động ngoài hiện trường:
* **Chướng ngại vật / Ngập úng / Đường cấm (Roadblock Detour)**: Tự động tính toán đường vòng tránh chướng ngại vật qua các trục đường huyết mạch thay thế.
* **Thùng rác quá tải đột xuất (Emergency Overflow Bins)**: Điều hướng xe thu gom còn tải trọng gần nhất đến xử lý ngay trong ca làm việc.
* **Sự cố phương tiện (Vehicle Breakdown)**: Chuyển giao các điểm thu gom chưa thực hiện sang cho các xe khác trong đội xe mà không làm gián đoạn kế hoạch chung.
* **Bảo toàn tiến độ**: Tự động giữ nguyên các điểm đã gom xong (`completed stops`) và chỉ tái lập kế hoạch cho các điểm còn lại.

### 4. Telemetry Hành trình & Mô hình ML Đánh giá Tài xế
* **Giám sát Telemetry thời gian thực**: Đo lường gia tốc, tốc độ, quãng đường, thời gian dừng đỗ thu gom tại từng trạm.
* **Mô hình ML Đánh giá Vận hành**: Phân tích dữ liệu hành vi lái xe, chấm điểm độ êm ái, an toàn và tối ưu năng lượng của từng tài xế trong đội xe.

### 5. Chỉ số Môi trường & Báo cáo Bền vững ESG
* **Báo cáo hiệu quả định lượng**:
  * Tổng quãng đường di chuyển tiết kiệm được (km).
  * Lượng nhiên liệu dầu Diesel tiết giảm (Lít).
  * Lượng khí phát thải nhà kính cắt giảm ($\text{kg CO}_2$).
  * Tỷ lệ tối ưu hóa chi phí vận hành so với phương pháp thủ công.

---

## 🗺️ Giao diện Trực quan hóa (UI & Dashboards)

| Cổng (Port) | Phân hệ Giao diện | Mô tả chức năng | Công nghệ |
|---|---|---|---|
| **`8502`** | **Waste Collection Map UI** | Bản đồ tương tác chính, điều phối sự cố, so sánh song song Dual-Map (PACO vs OR-Tools), mô phỏng xe chạy thời gian thực. Bản đồ sạch không đường lưỡi bò. | MapLibre GL, Leaflet, Tailwind CSS |
| **`8501`** | **Streamlit Analytics Dashboard** | Bảng phân tích chi tiết tham số thuật toán, trực quan hóa đồ thị hội tụ, biểu đồ so sánh ESG và xuất báo cáo. | Streamlit, Folium, Plotly |
| **`8001` / `8000`** | **FastAPI Core Engine** | API Backend phục vụ giải thuật toán VRP, quản lý tham số PACO và điều phối sự cố động. | FastAPI, Uvicorn, C++ Solver |

---

## 📂 Cấu trúc Thư mục Dự án

```text
routing-PL/
├── backend/                  # Máy chủ FastAPI & Wrapper C++ Solver
│   ├── bin/                  # File nhị phân thực thi C++ (test) & thư viện chia sẻ (libyaml-cpp)
│   ├── parameters/           # File cấu hình tham số thuật toán (paco.param.yaml)
│   ├── service.py            # Service điều phối chạy tiến trình C++ VRP
│   └── utils.py              # Xử lý định dạng dữ liệu VRP instances
├── map_ui/                   # Ứng dụng Bản đồ Điều phối Thu gom Rác (Port 8502)
│   ├── server.py             # FastAPI server cho Map UI & API định tuyến rác
│   ├── waste_solver.py       # Engine tối ưu VRP thu gom rác & xử lý sự cố
│   ├── telemetry_ml.py       # Phân tích dữ liệu telemetry & ML chấm điểm tài xế
│   ├── index.html            # Giao diện MapLibre GL / Dual-Map tương tác
│   ├── driver_data.html      # Dashboard giám sát tài xế & dữ liệu hành trình
│   ├── engine.html           # Bảng thông số hiệu năng thuật toán
│   └── route_cache.json      # Cache đường phố OSRM đã tính toán
├── streamlit/                # Dashboard phân tích & so sánh giải thuật (Port 8501)
│   ├── app.py                # Ứng dụng Streamlit chính
│   └── map_visualizer.py     # Trực quan hóa tuyến đường thu gom trên nền Folium
├── src/                      # Mã nguồn C++ gốc của bộ giải PACO / SA
│   ├── src/solvers/          # C++ implementation (PACO.cpp, SA.cpp, v.v.)
│   └── build/                # Makefiles & binaries biên dịch
├── docker-compose.yml        # Cấu hình khởi chạy trọn bộ 3 dịch vụ qua Docker
├── Dockerfile                # Dockerfile build môi trường Python & C++
└── start.sh                  # Script khởi động đồng thời cả 3 cổng 8000, 8501, 8502
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Cách 1: Khởi chạy bằng Docker (Khuyến nghị)

Chỉ cần một lệnh duy nhất để chạy toàn bộ hệ thống gồm Backend API, Streamlit Dashboard và Map UI:

```bash
docker-compose up -d --build
```

Kiểm tra trạng thái các dịch vụ:
* **Map UI Điều phối Thu gom Rác**: [http://localhost:8502](http://localhost:8502)
* **Streamlit Dashboard**: [http://localhost:8501](http://localhost:8501)
* **API Documentation**: [http://localhost:8001/docs](http://localhost:8001/docs)

Dừng container:
```bash
docker-compose down
```

---

### Cách 2: Khởi chạy trực tiếp trên Local (Python Virtual Environment)

#### 1. Cài đặt Dependencies
```bash
# Cài đặt thư viện Python cần thiết
pip install fastapi uvicorn streamlit folium requests pyyaml ortools scikit-learn
```

#### 2. Khởi chạy từng dịch vụ
* **Khởi chạy Map UI Server (Cổng 8502)**:
  ```bash
  cd map_ui
  uvicorn server:app --host 0.0.0.0 --port 8502 --reload
  ```
* **Khởi chạy Backend Solver Service (Cổng 8000)**:
  ```bash
  cd backend
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ```
* **Khởi chạy Streamlit Visualizer (Cổng 8501)**:
  ```bash
  cd streamlit
  streamlit run app.py --server.port=8501
  ```

---

## 🛠️ API Endpoints Chính (Map UI Server — Port 8502)

* `GET /api/presets`: Lấy danh sách mạng lưới thùng rác mẫu (Quận 1, Bến Nghé, Đa Kao...).
* `POST /api/solve`: Chạy thuật toán tối ưu tuyến đường thu gom rác (hỗ trợ solver `paco`, `ortools`, `baseline`).
* `POST /api/compare`: So sánh song song hiệu năng giữa 3 bộ giải thuật toán.
* `POST /api/incident`: Xử lý sự cố hiện trường động (vật cản đường, ngập nước, thùng rác quá tải, xe hỏng).
* `GET /api/telemetry/drivers`: Lấy dữ liệu telemetry và điểm số phong cách lái xe của đội tài xế.
* `GET /api/fleet`: Lấy danh sách đội xe thu gom rác và trạng thái tải trọng.