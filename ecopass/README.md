# EcoPass — Phygital Waste-to-Reward Platform
> **Mô hình tuần hoàn rác thải thông minh liên kết Doanh nghiệp & Người tiêu dùng**  
> *Lấy cảm hứng từ các giải pháp xuất sắc tại Kosen Procon Nhật Bản (POOI & Triplean), tinh chỉnh tối ưu cho thị trường Việt Nam.*  
> 📌 **Tài liệu chiến lược cốt lõi**: Xem chi tiết tại [PROJECT_STRATEGY.md](file:///home/chinhan/ecopass/PROJECT_STRATEGY.md) (Bản Tuyên Ngôn Triết Lý Kinh Doanh & Hướng Đi Cốt Lõi 4-Win).  
> 🏆 **Kịch bản Demo Vòng Chung Kết**: Xem chi tiết tại [FINALS_DEMO_STRATEGY.md](file:///home/chinhan/ecopass/FINALS_DEMO_STRATEGY.md) (Kịch bản 15s thực chiến, phản biện BGK & thiết lập GPS/QR).

---

## 1. Định vị & Tinh thần Cốt lõi
* **Slogan**: *"Biến vỏ chai thành ưu đãi – Đổi hành vi bằng giá trị kinh tế"*
* **Bài học từ phản hồi Giám khảo**: Tránh bẫy "cố ép quá nhiều công nghệ cồng kềnh" (IoT nặng, cảm biến đắt tiền, AI nhận diện nặng nề khó bảo trì ở môi trường thùng rác thực tế).
* **Triết lý sản phẩm**: Dùng **công nghệ nhẹ (Web/QR/Barcode)** kết hợp **động lực kinh tế (Incentive Economics)** để giải quyết vấn đề rác thải tại nguồn và mang lại doanh thu tức thì cho doanh nghiệp đối tác.

---

## 2. Giá trị Doanh nghiệp (Tại sao nhãn hàng & chuỗi F&B chịu bỏ tiền?)

| Doanh nghiệp cần gì? | Giải pháp của EcoPass | Giá trị đo lường được (Metrics) |
| :--- | :--- | :--- |
| **1. Khảo sát thị trường (Market Research)** | Người dùng muốn nhận voucher phải trả lời 1 micro-survey (3 giây). | Chi phí thu thập mẫu giảm từ **25.000đ** (thuê agency/Macromill) xuống còn **~2.000đ/data**, phản hồi tức thì từ đúng người vừa uống sản phẩm. |
| **2. Tăng khách đến quán (Foot-traffic & Upsell)** | Phát hành **Voucher bẫy mua có điều kiện** (VD: Giảm 10.000đ cho đơn từ 50.000đ tại Highlands, Phúc Long, Căn tin). | Kích thích khách quay lại mua lần 2, mang về ít nhất **40.000đ doanh thu mới** trên mỗi voucher được đổi. |
| **3. Báo cáo ESG & Tuân thủ EPR (Bộ TN&MT)** | Dashboard tự động ghi nhận số lon/chai nhựa thu hồi theo từng nhãn hàng (Coca, Pepsi, Highlands...). | Cung cấp dữ liệu kiểm toán phát thải và báo cáo trách nhiệm mở rộng nhà sản xuất (EPR) theo Luật BVMT 2020. |

---

## 3. Luồng hoạt động (User Journey 3 Bước Siêu Đơn Giản)

```
[1. Người dùng uống xong nước]
           │
           ▼
[Quét mã vạch vỏ lon EAN-13 + Quét QR thùng rác tại quán/trường]
           │  (Hệ thống nhận diện nhãn hàng đồ uống & địa điểm)
           ▼
[Hiện Pop-up 1 câu hỏi khảo sát 3 giây của chính nhãn hàng đó]
           │  (VD: "Bạn thấy độ ngọt của vị mới này thế nào?")
           ▼
[Nhận ngay mã QR Voucher lưu vào ví web]
           │
           ▼
[Đến quầy thu ngân / máy bán nước: Thu ngân quét duyệt trừ tiền]
```

---

## 4. Kiến trúc 4 Module Độc lập (Mapping với Codebase đã Clone)

Dự án được cấu trúc thành 4 module tách biệt, dễ bảo trì, dễ deploy độc lập:

```
ecopass/
├── client-scanner/     # MODULE 1: Webapp di động người dùng (Scan mã vạch & Ví voucher)
├── brand-portal/       # MODULE 2: Cổng thông tin & Dashboard phân tích cho Nhãn hàng
├── cashier-pos/        # MODULE 3: Webapp thu ngân tại quầy (Quét duyệt Voucher)
└── voucher-backend/    # MODULE 4: Backend API quản lý vòng đời Voucher & Chống gian lận
```

### Chi tiết từng Module:

1. **`client-scanner/` (Module 1 — User Mobile Web / PWA)**
   - *Nguồn gốc repo*: `frontendnetwork/veganify` (TypeScript, Vite, PWA).
   - *Chức năng*: Mở camera điện thoại quét mã vạch EAN-13 của chai/lon nước, tự động gọi API tra cứu tên sản phẩm qua Open Food Facts, hiển thị câu hỏi khảo sát 3s và lưu voucher vào ví cá nhân.
2. **`brand-portal/` (Module 2 — Brand Management & Analytics Dashboard)**
   - *Nguồn gốc repo*: `Kiranism/next-shadcn-dashboard-starter` (Next.js 16, shadcn/ui, Tailwind CSS).
   - *Chức năng*: Dành cho đối tác (Highlands, Suntory PepsiCo, Coca-Cola) đăng nhập tạo chiến dịch khảo sát, nạp ngân sách voucher, xem biểu đồ tỷ lệ phản hồi khảo sát, lượng rác thu gom theo chi nhánh và chỉ số ESG.
3. **`cashier-pos/` (Module 3 — Cashier POS Voucher Validator)**
   - *Nguồn gốc repo*: `5ks55/my-qrs-pwa` (React 19, Vite, Tailwind CSS, PWA).
   - *Chức năng*: Màn hình dành cho nhân viên thu ngân/pha chế tại quầy. Bật camera quét mã QR voucher trên máy khách $\rightarrow$ gọi API đổi trạng thái sang `REDEEMED` $\rightarrow$ hiện banner Xanh (Hợp lệ, trừ tiền) hoặc Đỏ (Mã đã dùng/Hết hạn).
4. **`voucher-backend/` (Module 4 — Core Voucher Engine & Anti-Fraud API)**
   - *Nguồn gốc repo*: `l4rm4nd/VoucherVault` (Python/Django REST API) + Node.js Open Food Facts SDK.
   - *Chức năng*: Quản lý vòng đời mã voucher (Tạo mã $\rightarrow$ Gán $\rightarrow$ Thu ngân dùng $\rightarrow$ Hết hạn), bảo đảm tính Idempotency (chống dùng lại 2 lần) và lưu log kiểm toán giao dịch.

---

## 5. Lời giải cho các Bài toán Thực tế hóc búa (Phục vụ trả lời Giám khảo)

#### ❓ Vấn đề 1: Thùng rác ở Việt Nam quá nhiều, làm sao cắm định vị GPS cho từng thùng rác vỉa hè?
* **Phương pháp giải quyết**: **Bỏ qua thùng rác công cộng vỉa hè, định vị theo Venue / Chi nhánh đối tác.**
* Thay vì quản lý 100.000 thùng rác công cộng vô định, ta gom phạm vi vào **Partner Venues (Chi nhánh đối tác)**:
  - Chuỗi F&B (Highlands Coffee, Phúc Long, The Coffee House).
  - Căn tin, sảnh các trường Đại học, Tòa nhà văn phòng.
  - Cụm máy bán nước tự động (Vending Machines).
* Mỗi điểm chỉ cần dán 1 tấm decal QR mang mã định danh `Store_ID` (Chi nhánh cụ thể). Không cần lắp bất kỳ thiết bị điện tử hay GPS nào lên thùng rác (Chi phí phần cứng = 0 VNĐ).

---

### ❓ Vấn đề 2: Người dùng nhặt rác cũ trong thùng lên quét, hoặc chụp ảnh mang về nhà quét để cày voucher?
* **CẶP BÀI TRÙNG ĐỘT PHÁ (Kỹ thuật Đời thường + Kinh tế học Hành vi)**:
  
  **1. Về Kỹ thuật — Ràng buộc "Mã Tem ly / Hóa đơn in nhiệt 1 lần" (Single-use Order Token):**
  - Khách mua nước tại Căn tin, Highlands hay Phúc Long luôn có một **tem in nhiệt dán trên ly** (in mã đơn hàng, ví dụ `#8921`) hoặc mã in trên hóa đơn thanh toán.
  - Người dùng muốn nhận voucher: Bật camera quét **Mã QR thùng rác** + quét **Mã đơn hàng trên tem ly**.
  - **Mỗi mã tem ly chỉ được kích hoạt ĐÚNG 1 LẦN DUY NHẤT** trên server. Ai tha vỏ ly về nhà quét thì mã đó đã chết (trạng thái `REDEEMED`), không thể dùng lại được. Muốn có mã mới bắt buộc phải mua ly nước mới!
  
  **2. Về Kinh tế học — Lời phản biện Đánh gục Ban Giám Khảo ("Voucher bẫy mua có điều kiện"):**
  - Người ta chỉ gian lận tha rác về nhà khi rác đổi ra **TIỀN MẶT** (như Momo, nạp thẻ điện thoại).
  - Hệ thống EcoPass đổi ra **VOUCHER CÓ ĐIỀU KIỆN (Giảm 10.000đ cho đơn từ 50.000đ)**.
  - Kể cả một người có cố tình nhặt 10 vỏ ly để lấy 10 voucher thì mỗi lần sử dụng họ vẫn phải **tự bỏ 40.000đ tiền túi** ra thanh toán cho quán.
  - **Kết luận thuyết phục**: Càng có nhiều người mang voucher đi đổi thì cửa hàng F&B đối tác **càng bán được nhiều ly nước và tăng doanh thu tiền tươi**! Rủi ro tài chính của doanh nghiệp bằng 0. Không cần tốn hàng trăm triệu tiền công nghệ phức tạp để chống lại một hành vi... đang mang lại lợi nhuận cho đối tác!

---

### ❓ Vấn đề 3: Làm sao nhận diện được lon nước của hãng nào để hiện câu khảo sát đúng nhãn hàng mà không cần camera AI đắt tiền?
* **Phương pháp giải quyết**: **Dùng mã vạch thương mại chuẩn EAN-13 (893...)**
* 100% chai nhựa, lon nước ngọt bán ở siêu thị, canteen, máy bán nước tại VN đều in sẵn mã vạch EAN-13 tiêu chuẩn.
* Client quét mã vạch $\rightarrow$ Tra cứu qua Open Food Facts / Cache nội bộ $\rightarrow$ Trả về chính xác: Tên sản phẩm, Thương hiệu, Thể tích, Loại bao bì (Nhựa PET hay Nhôm).
* Khi hệ thống phát hiện đây là sản phẩm của *Suntory PepsiCo*, nó sẽ tự động kích hoạt câu hỏi khảo sát do PepsiCo cấu hình sẵn trên Cổng Doanh nghiệp!

---

## 6. Hướng dẫn Chạy Thử Nhanh (Quick Start)

### 1. Khởi chạy Client Scanner (Module 1):
```bash
cd client-scanner
npm install
npm run dev
```

### 2. Khởi chạy Brand Portal (Module 2):
```bash
cd brand-portal
npm install
npm run dev
```

### 3. Khởi chạy Cashier POS (Module 3):
```bash
cd cashier-pos
npm install
npm run dev
```

### 4. Khởi chạy Voucher Backend (Module 4):
```bash
cd voucher-backend
pip install -r requirements.txt
python manage.py runserver
```
