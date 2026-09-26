# 📱 Smartbin Bulky & Citizen Mobile App

> **Phân hệ Ứng dụng Di động Đa Vai Trò (Flutter)** thuộc hệ sinh thái Smartbin, phục vụ **Cổng Hộ Gia Đình (Citizen Portal)**, **Dịch vụ Thu gom Rác Cồng Kềnh thông minh với AI (Bulky Waste Service)** và **Hệ thống Điểm thưởng Xanh (Eco Rewards)**.  
> Được phụ trách và phát triển bởi: **Dev 3 - Quốc Anh (EnglandLee)**.

---

## 🌟 Tổng Quan & Nghiệp Vụ Cốt Lõi

Ứng dụng được xây dựng trên nền tảng **Flutter**, hỗ trợ chuyển đổi linh hoạt giữa 3 vai trò người dùng (Role-Based Access Control - RBAC):

1. **Cư dân (Citizen)**: Cổng thông tin gia đình, tích điểm đổi voucher quà tặng, đặt lịch thu gom rác cồng kềnh bằng camera AI, tra cứu hóa đơn & thanh toán trực tuyến.
2. **Tài xế thu gom rác cồng kềnh (Bulky Driver)**: Theo dõi lộ trình ca làm việc, danh sách các điểm thu gom cồng kềnh được gán, định vị bản đồ và cập nhật trạng thái thu gom tại chỗ.
3. **Điều phối viên (Operator)**: Giám sát tải trọng xe, kiểm tra năng lực phục vụ theo ngày, duyệt đơn và điều phối chuyến xe thu gom cồng kềnh.

---

## 🚀 Các Tính Năng Nổi Bật

### 1. 📷 Quét & Nhận diện Rác Cồng Kềnh Bằng AI (AI Vision Scanner)
- **Nhận diện vật thể thông minh**: Tích hợp mô hình AI (Gemini Vision) nhận diện chính xác các loại đồ nội thất và phế thải cồng kềnh (Sofa, nệm, bàn, tủ, ghế, đồ gia dụng...).
- **Bounding Box trực quan**: Hiển thị khung định vị vật thể và độ tin cậy nhận diện (%) trực tiếp trên ảnh chụp.
- **Ước lượng kích thước & Phân loại vật liệu**: Tự động gợi ý kích thước (Dài x Rộng x Cao) và thành phần vật liệu (Gỗ, kim loại, da, nỉ, kính...).

### 2. 📋 Quy Trình Đặt Dịch Vụ Wizard 3 Bước (Request Wizard)
- **Bước 1 - Danh mục vật dụng**: Chọn nhanh danh mục mẫu hoặc tải từ kết quả quét AI, chỉnh sửa số lượng, kích thước từng món.
- **Bước 2 - Khảo sát hiện trường & Hậu cần**:
  - Khảo sát lối đi, tầng lầu, có thang máy hay thang bộ.
  - Vị trí lấy rác: Đặt tại vỉa hè (*Curbside*) hoặc bốc dỡ trong nhà (*Inside Home*).
  - Tùy chọn yêu cầu tháo dỡ nội thất phức tạp.
- **Bước 3 - Xem xét & Xác nhận**: Tóm tắt toàn bộ thông tin đơn hàng, phụ phí và thời gian dự kiến thu gom.

### 3. 💰 Động Cơ Định Giá Trực Quan (Live Pricing Engine) & Cam Kết Sai Số
- **Công thức tính phí minh bạch theo chuẩn nghiệp vụ**:
  $$\text{Tổng phí} = \text{Phí vật dụng} + \text{Phí xe / khu vực} + \text{Phí bốc xếp / tầng lầu / tháo dỡ} + \text{Thuế VAT} - \text{Ưu đãi}$$
- **Bảo hiểm cam kết sai số (Tolerance Guarantee)**: Cam kết chênh lệch phụ phí thực tế khi tài xế đến nơi không vượt quá ngưỡng quy định (±10%), tạo sự tin tưởng tuyệt đối cho cư dân.

### 4. 🎁 Eco Rewards - Đổi Điểm Xanh Lấy Voucher Thương Hiệu Việt
- **Tích điểm hành động xanh**: Cư dân phân loại rác đúng quy chuẩn hoặc tham gia chương trình thu gom rác cồng kềnh được cộng điểm Eco Points.
- **Đổi voucher giải khát phổ biến**: Tích hợp danh mục quà tặng quy đổi trực tiếp sang voucher của các thương hiệu hàng đầu: **Highlands Coffee**, **Phúc Long Coffee & Tea**, **Katinat Saigon Kafe**.

### 5. ⏳ Thanh Toán Trả Trước & Giữ Chỗ Thời Gian Thực (Prepaid Booking)
- **Cơ chế giữ chỗ có thời hạn**: Đơn hàng sau khi chốt sẽ giữ slot phục vụ trong 15 phút kèm đồng hồ đếm ngược (*Countdown Timer*).
- **Đa dạng phương thức thanh toán**: Hỗ trợ quét mã QR, cổng thanh toán MoMo / VNPAY hoặc chuyển khoản định danh. Tự động giải phóng slot nếu quá hạn chưa hoàn tất trả trước.

### 6. 🚛 Điều Phối Xe & Bản Đồ Lộ Trình Ca Thu Gom (Bulky Driver & Operator)
- **Dành riêng cho xe rác cồng kềnh**: Phân tách rành mạch với đội xe rác sinh hoạt thông thường.
- **Bản đồ ca làm việc (Driver Route Map)**: Hiển thị các chặng dừng (Waypoints), địa chỉ bốc rác, thông tin liên hệ hộ dân và trạng thái hoàn thành chuyến.

---

## 📂 Kiến Trúc & Cấu Trúc Thư Mục

Dự án áp dụng mô hình **Feature-Driven Architecture** kết hợp nguyên lý phân tách trách nhiệm cao:

```text
mobile/
├── assets/
│   └── samples/                    # Ảnh mẫu vật dụng nội thất phục vụ demo & test
├── lib/
│   ├── core/
│   │   ├── constants/              # Tham số hệ thống, danh mục rác cồng kềnh
│   │   ├── domain/
│   │   │   ├── models/             # BulkyOrder, BulkyItem, BulkyQuote, BoundingBox
│   │   │   └── pricing/            # PricingEngine tính toán chi phí minh bạch
│   │   ├── services/
│   │   │   ├── ai/                 # GeminiVisionService, AiRecognitionResult
│   │   │   └── storage/            # MockBulkyStorage, lưu trữ cục bộ
│   │   ├── theme/                  # BulkyTheme, BulkyColors (Bảng màu chuẩn UX)
│   │   └── widgets/                # BulkyAppBottomNavBar, các widget dùng chung
│   ├── features/
│   │   ├── auth/                   # Quản lý tài khoản, CitizenUser, chuyển đổi Role RBAC
│   │   ├── citizen_home/           # Màn hình chính cư dân, Eco Rewards, voucher đồ uống
│   │   ├── driver/                 # Giao diện tài xế xe cồng kềnh, bản đồ lộ trình ca trực
│   │   ├── operator/               # Giao diện điều phối viên, kiểm tra năng lực phục vụ
│   │   ├── orders/                 # Danh sách đơn thu gom, chi tiết đơn hàng & timeline
│   │   ├── payment/                # Thanh toán QR/MoMo, đếm ngược giữ chỗ
│   │   ├── quote/                  # Màn hình chi tiết báo giá, banner cam kết sai số
│   │   ├── request_wizard/         # Wizard 3 bước đặt lịch, bộ chọn danh mục, khảo sát lầu
│   │   └── scan/                   # Chụp/tải ảnh, AI bounding box painter
│   └── main.dart                   # Khởi tạo App, MultiProvider & khai báo Route
└── test/
    ├── core/                       # Kiểm thử đơn vị cho PricingEngine, Storage
    ├── features/                   # Kiểm thử tích hợp UI, Wizard, Auth, Đơn hàng
    └── widget_test.dart            # Smoke test và kiểm tra điều hướng Bottom Navigation
```

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Yêu cầu môi trường
- **Flutter SDK**: `>= 3.13.2` (Khuyến nghị Flutter 3.24.x trở lên)
- **Dart SDK**: `^3.13.2`
- **Thiết bị**: Máy ảo Android (Android Emulator), iOS Simulator, thiết bị vật lý hoặc chạy thử trên Chrome (`flutter run -d chrome`).

### Các bước khởi chạy

1. **Di chuyển vào thư mục mobile:**
   ```bash
   cd mobile
   ```

2. **Cài đặt các gói thư viện dependencies:**
   ```bash
   flutter pub get
   ```

3. **Chạy ứng dụng:**
   ```bash
   # Chạy trên thiết bị mặc định
   flutter run

   # Hoặc chạy trên trình duyệt Chrome (Web Mode)
   flutter run -d chrome

   # Hoặc chọn thiết bị cụ thể
   flutter devices
   flutter run -d <device_id>
   ```

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Toàn bộ hệ thống tính phí, luồng Wizard, phân quyền RBAC và các widget giao diện đều có bộ kiểm thử tự động toàn diện:

```bash
cd mobile
flutter test
```

> **Kết quả kiểm thử:** Toàn bộ **121/121 tests** đều vượt qua thành công (`All tests passed!`), đảm bảo tính ổn định và chính xác 100% của mọi nghiệp vụ.
