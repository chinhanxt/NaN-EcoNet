# 🚛 Phân Hệ 2: Smart Collection & 3D-PACO Routing Engine

**Thư mục mã nguồn:** [`apps/smart-collection-engine`](../../apps/smart-collection-engine)  
**Phụ trách kỹ thuật:** **Bùi Nguyễn Công Nghiệp** (`congnghip`)

Phân hệ đóng vai trò động cơ tính toán tối ưu hóa tuyến đường thu gom rác thải đô thị, giải quyết bài toán định tuyến phương tiện có tải trọng và khung thời gian (**CVRPTW** - Capacitated Vehicle Routing Problem with Time Windows), thích ứng với mạng lưới đường sá ngõ hẹp đặc trưng của các siêu đô thị Việt Nam.

---

## 1. Kiến Trúc Bộ Não Định Tuyến

<p align="center">
  <img src="../assets/diagrams/smart-routing.png" alt="Smart Routing Architecture" width="100%" />
</p>
<p align="center"><i>Hình: Quy trình tối ưu hóa tuyến thu gom với bộ giải lai 3D-PACO & Google OR-Tools trên nền Local OSRM</i></p>

### Các Thành Phần Nòng Cốt:

1. **Hạ Tầng Bản Đồ Thực Tế (Local OSRM & Spatial Cache):**
   * Tự host máy chủ Open Source Routing Machine (OSRM) trên nền dữ liệu bản đồ OpenStreetMap sạch của khu vực TP.HCM.
   * Tính toán ma trận khoảng cách và thời gian di chuyển theo luật giao thông thực tế (đường một chiều, cấm tải theo giờ).
   * Spatial Cache Matrix (`route_cache.json`) lưu trữ trước cự ly giữa các nút giao thông trọng điểm, giảm độ trễ phản hồi xuống dưới **50ms**.
   * Bộ lọc an toàn địa lý (**Waterbody Safety Filter**) tự động kiểm tra và triệt tiêu các tọa độ lỗi bị lệch vào kênh rạch, sông ngòi hoặc công viên.

2. **Động Cơ Tối Ưu Hóa 3D-PACO (Bi-Modal Decision Parallel ACO):**
   * Mở rộng đồ thị thuật toán đàn kiến truyền thống sang không gian quyết định hai phương thức phục vụ:
     * $o = 0$: Xe tải vào tận nơi thu gom trực tiếp (Curbside Collection).
     * $o = 1$: Điểm nằm trong ngõ hẹp; nhân viên thu gom đi bộ kéo rác ra điểm hẹn đầu hẻm lớn (Walk-in Alley Bundling).
   * Lớp lõi thuật toán được viết bằng C++ và tối ưu hóa tập lệnh đa luồng OpenMP (8 luồng CPU), mang lại tốc độ hội tụ cao và khả năng xử lý bài toán quy mô lớn.

3. **Bộ Giải Đối Chuẩn Công Nghiệp (Google OR-Tools CVRPTW):**
   * Sử dụng thuật toán `RoutingModel` với chiến lược tìm kiếm cục bộ có hướng dẫn (Guided Local Search - GLS) và chèn tiết kiệm (Cheapest Insertion).
   * Thỏa mãn 100% các ràng buộc cứng về cửa sổ thời gian (Time Windows) tại từng điểm thu gom và tải trọng xe.

---

## 2. Mô Hình Toán Học & Ràng Buộc Hệ Thống (Mathematical Formulation)

Bài toán được phát biểu dưới dạng tối ưu hóa tổ hợp trên đồ thị có hướng $G = (V, A)$, trong đó:
* $V = \{0\} \cup C$: Tập các đỉnh, với đỉnh $0$ là trạm tập kết/kho xe (Depot) và $C = \{1, 2, \dots, n\}$ là tập các điểm thu gom rác.
* Mỗi điểm gom $i \in C$ có khối lượng rác phát sinh $d_i > 0$, khung thời gian phục vụ $[e_i, l_i]$, thời gian dừng bốc dỡ $s_i$, và cự ly ngõ hẹp $h_i$.
* Đội xe gồm $K$ xe tải giống nhau, mỗi xe có tải trọng tối đa $Q$.

### 2.1. Biến Quyết Định:
* $x_{ijk} \in \{0, 1\}$: Bằng $1$ nếu xe $k \in K$ di chuyển trực tiếp từ điểm $i$ đến điểm $j$; bằng $0$ nếu ngược lại.
* $y_{io} \in \{0, 1\}$: Biến lựa chọn phương thức phục vụ cho điểm $i$ ($o = 0$: xe gom tận nơi; $o = 1$: gom cụm đầu hẻm).
* $w_{ik} \ge 0$: Thời điểm xe $k$ bắt đầu phục vụ tại điểm $i$.

### 2.2. Hàm Mục Tiêu:
Tối thiểu hóa tổng chi phí vận hành (quãng đường di chuyển đường bộ, cước gom bộ đầu hẻm và lượng tiêu hao nhiên liệu Diesel):

$$\min \quad Z = \sum_{k \in K} \sum_{i \in V} \sum_{j \in V} c_{ij} x_{ijk} + \lambda \sum_{i \in C} h_i y_{i1} + \mu \sum_{k \in K} \sum_{i \in V} \sum_{j \in V} f(c_{ij}) x_{ijk}$$

*Trong đó:*
* $c_{ij}$: Khoảng cách đường bộ thực tế từ $i$ đến $j$ do máy chủ Local OSRM cung cấp.
* $h_i$: Khoảng cách đi bộ từ điểm phát sinh trong ngõ hẻm ra điểm hẹn đầu hẻm chính.
* $f(c_{ij}) = 0.28 \times c_{ij}$: Suất tiêu thụ dầu Diesel ($0.28\text{ L/km}$ cho xe tải 1.5 tấn).
* $\lambda, \mu$: Các trọng số hiệu chỉnh kinh tế và môi trường.

### 2.3. Các Ràng Buộc Chính:
1. **Mỗi điểm rác chỉ được phục vụ đúng một lần bởi một xe duy nhất:**
   $$\sum_{k \in K} \sum_{j \in V, j \ne i} x_{ijk} = 1, \quad \forall i \in C$$

2. **Bảo toàn luồng di chuyển tại mỗi nút (xe vào thì phải ra):**
   $$\sum_{j \in V, j \ne p} x_{jpk} - \sum_{j \in V, j \ne p} x_{pjk} = 0, \quad \forall p \in C, \; \forall k \in K$$

3. **Ràng buộc tải trọng xe không vượt quá ngưỡng an toàn:**
   $$\sum_{i \in C} d_i \sum_{j \in V, j \ne i} x_{ijk} \le Q, \quad \forall k \in K$$

4. **Ràng buộc cửa sổ thời gian (Time Windows):**
   $$x_{ijk} = 1 \implies w_{ik} + s_i + t_{ij} \le w_{jk}, \quad \forall i, j \in V, \; \forall k \in K$$
   $$e_i \le w_{ik} \le l_i, \quad \forall i \in C, \; \forall k \in K$$

### 2.4. Quy Tắc Xác Suất Chuyển Dời trong 3D-PACO:
Xác suất để kiến chọn chuyển dời từ điểm $i$ sang điểm $j$ với phương thức phục vụ $o \in \{0, 1\}$ được xác định bởi:

$$P_{ij}^k(o) = \frac{\left[\tau(i, j, o)\right]^\alpha \cdot \left[\eta(i, j, o)\right]^\beta}{\sum_{l \in \mathcal{N}_i^k} \sum_{m \in \{0, 1\}} \left[\tau(i, l, m)\right]^\alpha \cdot \left[\eta(i, l, m)\right]^\beta}$$

*Trong đó:*
* $\tau(i, j, o)$: Mật độ vết mùi pheromone trên cạnh $(i, j)$ tương ứng với hình thức phục vụ $o$.
* $\eta(i, j, o) = \frac{1 + \gamma \cdot \text{OdorLevel}_j}{c_{ij}}$: Độ hấp dẫn heuristic (khoảng cách $c_{ij}$ càng ngắn và chỉ số bốc mùi/đầy ứ $\text{OdorLevel}_j$ càng cao thì độ ưu tiên càng lớn).
* $\alpha = 1.2, \beta = 2.5$: Các hệ số kiểm soát mức độ ảnh hưởng của pheromone và thông tin khoảng cách.

---

## 3. Điều Phối Sự Cố Động (Human-in-the-Loop Incident Resolution)

Trong ca vận hành thực tế tại các đô thị, sự cố giao thông thường xuyên phát sinh. Engine cung cấp cơ chế xử lý sự cố động với thời gian phản hồi dưới **350ms**:
1. **Rào chắn công trình / Đường ngập nước (Roadblock Detour):** Khi nhận được tín hiệu báo đường nghẽn, engine tự động gán trọng số vô hạn cho cung đường bị chặn và tái định tuyến cục bộ các điểm kế tiếp.
2. **Thùng rác đầy đột xuất (Emergency Bin Overflow):** Khi cảm biến IoT hoặc người dân báo thùng rác quá tải, hệ thống kiểm tra tải trọng rỗng của các xe lân cận và điều phối xe gần nhất ghé gom bổ sung.
3. **Sự cố Hỏng Hóc Xe Tải (Vehicle Breakdown Transfer):** Tự động đóng băng trạng thái của các điểm đã hoàn thành (`completed stops`), chia sẻ toàn bộ các điểm chưa gom còn lại cho các xe khác trong khu vực mà không phải bắt đầu lại từ đầu.

---

## 4. Telemetry Giám Sát & Mô Hình ML Đánh Giá Lái Xe

* **Thu thập Telemetry:** Cập nhật liên tục vận tốc tức thời, gia tốc trọng trường, góc bẻ lái và thời gian nổ máy dừng đỗ tại từng điểm thu gom.
* **Mô hình Máy học (Driver Safety & Eco-Score):** Phân tích các sự kiện phanh gấp (Hard Braking), tăng ga đột ngột (Rapid Acceleration) và thời gian nổ máy chờ (Excessive Idling), xếp hạng hành vi lái xe an toàn và tiết kiệm nhiên liệu cho từng tài xế.
