# QUY CHUẨN THIẾT KẾ GIAO DIỆN WEB ECOPASS (DESIGNWEB.MD)
> **Bản Quy Chuẩn Thiết Kế Giao Diện Điều Phối & Quản Trị EcoPass Operations Hub (SP 2)**  
> *Được chiết xuất từ mẫu thiết kế chuẩn: ReFi Biophilic Glassmorphism (Ảnh 1) kết hợp Tương tác Bản đồ Điều phối Campus (Ảnh 2 & Ảnh 3).*

---

## I. TRIẾT LÝ THIẾT KẾ CỐT LÕI (THE DESIGN MANIFESTO)

### 1. Ảnh 1 làm chuẩn tuyệt đối (The Primary North Star)
Toàn bộ phong cách thị giác của web điều phối EcoPass kế thừa trọn vẹn từ **Ảnh 1**:
* **Phong cách**: **Organic Eco-Fintech / Biophilic Glassmorphism** — Sự kết hợp giữa gam màu rêu đá tự nhiên cao cấp và giao diện tài chính tuần hoàn hiện đại.
* **Nguyên tắc "Zero-Fluff / Siêu ít chữ"**:
  - **Tuyệt đối không có đoạn văn bản dài dòng**. Người điều phối chỉ mất **1 giây** để nắm bắt toàn bộ trạng thái hệ thống.
  - Thông tin được biểu đạt qua 5 thành phần cô đọng:
    1. **Con số lớn (Big Numbers)**: `text-3xl` đến `text-5xl` làm nhân vật chính.
    2. **Hộp 3 chỉ số lồng (Double-Bezel Pods)**: Khối xám bo góc 3 cột `MỨC ĐẦY | ĐÃ GOM | TRẠNG THÁI`.
    3. **Badge hình viên thuốc (Pill Badges)**: Trạng thái, ngày tháng, danh mục gọn gàng.
    4. **Micro Sparklines**: Đường sóng SVG biểu thị xu hướng rác/voucher thay vì bảng số liệu khô khan.
    5. **Nút bấm viên thuốc xanh lá (Capsule CTA Buttons)**: `rounded-full` màu xanh rêu sống động `#6BA101`.

---

## II. HỆ THỐNG MÀU SẮC & CHẤT LIỆU (DESIGN TOKENS & PALETTE)

Chiết xuất màu chính xác theo pixel từ Ảnh 1:

```
┌────────────────────────────────────────────────────────────────────────┐
│  BẢNG MÀU CHỦ ĐẠO ECOPASS OPERATIONS HUB (THE MOSS & FOREST PALETTE)  │
├──────────────────┬─────────────────┬──────────────────┬────────────────┤
│ Primary Green    │ Dark Forest     │ Midtone Moss     │ Soft Mint Pill │
│ #6BA101          │ #3A5A42         │ #7F916B          │ #EBF7DC        │
│ (Nút CTA, Brand) │ (Tầng đáy biểu đồ│ (Chỉ số sinh thái│ (Badge tăng +) │
├──────────────────┼─────────────────┼──────────────────┼────────────────┤
│ Earth Taupe      │ Natural Cream   │ Charcoal Ink     │ Outer Canvas   │
│ #8C7A6C          │ #E2DFDA         │ #1A1D1A          │ #D8D8CC        │
│ (Tầng giữa chart)│ (Tầng đỉnh chart│ (Text chính, Logo│ (Nền ngoài cát │
└──────────────────┴─────────────────┴──────────────────┴────────────────┘
```

### 1. Chi tiết Bảng màu & Tỷ lệ ứng dụng
* **Màu nhấn hành động (Primary Brand / Action Green)**: `#6BA101` (Hover: `#5E8E00`).
  - *Ứng dụng*: Nút bấm viên thuốc ("Xem QR", "Kích hoạt", "Đồng bộ"), logo EcoPass, đường sparkline dương, icon active.
* **Xanh rừng già (Dark Forest Green)**: `#3A5A42`.
  - *Ứng dụng*: Tầng cơ sở của biểu đồ cột sinh thái, viền cụm điểm gom rác.
* **Xanh rêu mờ (Midtone Moss / Sage)**: `#7F916B`.
  - *Ứng dụng*: Điểm nhấn phụ, icon danh mục môi trường.
* **Nền Mint siêu nhạt (Soft Mint)**: `#EBF7DC` kết hợp chữ xanh đậm `#4D7C0F`.
  - *Ứng dụng*: Chip hiển thị tăng trưởng `↗ +14.2%`, badge trạng thái "Đã sẵn sàng".
* **Đỏ đất cảnh báo (Rust Red)**: `#D94841` hoặc `#E11D48`.
  - *Ứng dụng*: Cảnh báo thùng đầy $\ge 80\%$, sparkline giảm.
* **Màu mực than chì (Charcoal Ink)**: `#1A1D1A` (Thay vì đen thuần `#000000` gắt mắt).
  - *Ứng dụng*: Chữ tiêu đề H1, số liệu lớn, nền icon vuông bo góc của từng thẻ trạm.

### 2. Công thức Kính Mờ Đẳng Cấp (Frosted Acrylic Glassmorphism)
Áp dụng cho toàn bộ phần Hero trên cùng:
```css
/* Lớp kính mờ Hero Card */
background: rgba(255, 255, 255, 0.16);
backdrop-filter: blur(20px) saturate(130%);
border: 1px solid rgba(255, 255, 255, 0.28);
box-shadow: 
  inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), /* Đường sáng phản chiếu cạnh kính */
  0 20px 40px -15px rgba(0, 0, 0, 0.12);
```

### 3. Phân tầng Nền Canvas
* **Outer Canvas (Khung viền ngoài)**: `#D8D8CC` (Màu cát đá tự nhiên, có đường vân contour mờ).
* **Hero Canvas**: Ảnh nền thiên nhiên rêu đá kết hợp lớp gradient taupe (`rgba(155,146,139,0.55)` đến `rgba(45,64,18,0.7)`).
* **Lower Canvas (Phần dưới)**: `#FFFFFF` tinh khiết, sạch sẽ, làm nổi bật các thẻ trạm.

---

## III. BỐ CỤC TỔNG THỂ 4 TẦNG (PAGE ARCHITECTURE)

Toàn bộ trang Dashboard được gói gọn trong khung bo góc lớn `rounded-[32px]` chuẩn mực:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: HERO SECTION KÍNH MỜ (FROSTED GLASSMORPHISM)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ (Logo)       [ Overview ] [ Điểm Đặt & QR ] [ Khảo Sát ] [ Kho Voucher ]   (🔍)(⚙)(👤) │ │
│ ├─────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Welcome back,                                                                       │ │
│ │ EcoPass Hub!  ( Pill: Tue, April 26th 2026 )                                        │ │
│ │                                                                                     │ │
│ │ ┌─────────────────────────┐  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │ │
│ │ │ TVL / RÁC THU HỒI CHART │  │ LƯỢT QUÉT    │ │ TỶ LỆ ĐỔI    │ │ TOP ĐỐI TÁC      │ │ │
│ │ │ █ █ █ █ █ █ (Stacked)   │  │ 14,820       │ │ 68.4%        │ │ • Highlands 1.2M │ │ │
│ │ │ Jan Feb Mar Apr May Jun │  │ +12.4% tuần  │ │ +5.2% tuần   │ │ • TCP War.  840K │ │ │
│ │ └─────────────────────────┘  └──────────────┘ └──────────────┘ └──────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 2: BẢN ĐỒ CAMPUS TƯƠNG TÁC (CAMPUS BLUEPRINT INTERACTIVE MAP - Kế thừa Ảnh 2 & 3)  │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Sơ đồ: [ Tòa H6 - Trệt ▾ ] [ Toàn Campus ]              Pin Cluster: [ 4 ]   [ 8 ]  │ │
│ │                                                                                     │ │
│ │           📍 (Pin Thùng A1) ───► [ POPUP BUNG MÃ QR & TIẾN ĐỘ ]                     │ │
│ │                                  • Thùng A1 Căn Tin Tòa H6                          │ │
│ │                                  • Mức đầy: 82% (246/300 chai)                      │ │
│ │                                  • [ Tải QR In ] [ Điều Phối Gom ]                  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 3: THANH BỘ LỌC DẠNG PILL & PHÂN TRANG (FILTER PILL BAR - Kế thừa Ảnh 1)           │
│ [Tuần này ▾]  [Campus BK2 ▾]  [Đầy > 80% ▾]  [Chai PET ▾]  (⚙)        [<] 03 / 153 [>] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 4: LƯỚI THẺ ĐIỀU PHỐI ROUNDED-[28PX] (GRID SQUIRCLE CARDS - Kế thừa Ảnh 1)        │
│ ┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐ │
│ │ [H6] Trạm H6 Căn Tin   ↗ │ │ [H1] Trạm H1 Thí Nghiệm ↗ │ │ [LIB] Trạm Thư Viện   ↗ │ │
│ │ Căn tin Tòa H6 - HUTECH  │ │ Sảnh A2 Tòa H1 - HUTECH  │ │ Sảnh chính Thư Viện    │ │
│ │ ┌──────────────────────┐ │ │ ┌──────────────────────┐ │ │ ┌──────────────────────┐ │ │
│ │ │MỨC ĐẦY ĐÃ GOM RISK   │ │ │ │MỨC ĐẦY ĐÃ GOM RISK   │ │ │ │MỨC ĐẦY ĐÃ GOM RISK   │ │ │
│ │ │  82%   2.4K   High   │ │ │ │  34%   1.1K   Low    │ │ │ │  58%   1.8K   Med    │ │ │
│ │ └──────────────────────┘ │ │ └──────────────────────┘ │ │ └──────────────────────┘ │ │
│ │ ~/\~ ↗ 4.88%    [Xem QR] │ │ ~---~ ↘ 0.2%    [Xem QR] │ │ ~/\~ ↗ 6.78%    [Xem QR] │ │
│ └──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## IV. CHI TIẾT 4 TẦNG GIAO DIỆN & NGUYÊN TẮC 'ÍT CHỮ'

### 1. Tầng 1: Hero Frosted Glassmorphism
* **Thanh Navigation Capsule viên thuốc**:
  - Logo tròn xanh rêu `#6BA101` đường kính 44px (`w-11 h-11 rounded-full`).
  - Thanh menu kính mờ dạng viên thuốc:
    - Tab active: `bg-white text-[#1A1D1A] font-bold text-xs px-5 py-2 rounded-full shadow-sm`.
    - Tab inactive: `text-white/80 hover:text-white text-xs font-medium px-4 py-2 rounded-full`.
  - Icon công cụ bên phải: Nút Search tròn, Settings tròn kính mờ, Avatar người dùng.
* **Tiêu đề chào mừng & Badge ngày**:
  - Headline H1: `Welcome back, EcoPass Hub!` (`text-4xl md:text-5xl font-extrabold text-white tracking-tight`).
  - Pill Badge: `Tue, April 26th 2026` (`bg-white/15 backdrop-blur-md border border-white/30 text-white/90 text-xs px-3.5 py-1 rounded-full`).
* **Các thẻ kính mờ nổi (Floating Cards)**:
  - **Thẻ Biểu Đồ Cột 3 Tầng**: Thể hiện lượng rác thu gom 6 tháng qua với 3 tầng màu tự nhiên (Tầng đỉnh: Kem `#E2DFDA`, Tầng giữa: Taupe `#8C7A6C`, Tầng đáy: Rừng già `#3A5A42`).
  - **Thẻ Số Lớn 1 (Lượt Quét / Điểm Xanh)**: `14,820` kèm nhãn xanh lá `+12.4% tuần này`.
  - **Thẻ Số Lớn 2 (Tỷ lệ quy đổi voucher)**: `68.4%` kèm nhãn `Hiệu quả cao`.
  - **Thẻ Top Đối Tác**: Danh sách 3 thương hiệu lớn (*Highlands Coffee $1.2M*, *TCP Warrior $840K*, *Suntory Tea+ $620K*).

---

### 2. Tầng 2: Bản Đồ Campus Tương Tác (Kế thừa Ảnh 2 & 3)
* **Bản đồ mặt bằng Campus / Blueprint phẳng**:
  - Không tải bản đồ vệ tinh nặng nề; sử dụng **Interactive SVG Blueprint** vẽ các khối tòa nhà H1, H6, Căn tin, Thư viện. Cực kỳ nhẹ, hiển thị sắc nét trong 100ms.
* **Các Chấm Pin Vị Trí Thùng Rác (Location Pins)**:
  - Vỏ tròn trắng viền sáng `w-9 h-9 rounded-full bg-white shadow-md border-2 border-white`.
  - Hạt nhân trung tâm đổi màu theo dung tích thực tế:
    - `< 60%`: Xanh lá `#3A9A43` (Bình thường).
    - `60% - 85%`: Vàng cam `#F59E0B` (Gần đầy).
    - `> 85%`: Đỏ tươi `#E11D48` kèm **vòng tròn sóng hào quang nhấp nháy `animate-ping`** (Báo động cần gom).
  - Cụm gom nhóm (**Pin Clusters** - Ảnh 3): Vòng tròn rêu đậm `#1E5224` viền mint có số lượng thùng `[ 4 ]`, `[ 8 ]`.
* **Popup Card Neo Trực Tiếp Trên Chấm Pin (Pinned Popover - Ảnh 2)**:
  - Khi click vào 1 chấm pin, card nổi bung lên ngay phía trên đỉnh pin với tam giác chỉ hướng.
  - Chứa: **Mã QR thật có thể quét ngay (`QRCodeSVG`)**, Tên vị trí, Thanh đo tiến độ dung lượng `82% (246/300 chai)`, và Nút bấm *"Tải QR In Ấn"* / *"Điều Phối Dọn"*.

---

### 3. Tầng 3: Thanh Bộ Lọc Dạng Pill (Filter Pill Bar - Kế thừa Ảnh 1)
* **Dãy nút lọc viên thuốc bên trái**:
  - `[Tuần này ▾]` — Lọc theo mốc thời gian.
  - `[Campus HUTECH ▾]` — Lọc theo cơ sở/khuôn viên.
  - `[Mức đầy > 80% ▾]` — Lọc nhanh các thùng sắp tràn.
  - `[Vỏ lon / Chai PET ▾]` — Lọc theo chất liệu tái chế.
  - `[Nút tròn đen ⚙]` — Nút icon than chì `w-9 h-9 rounded-full bg-[#1A1D1A]` chứa `SlidersHorizontal`.
* **Cụm phân trang đối xứng bên phải**:
  - Nút lùi `[<]` tròn + Số trang `03 / 153` + Nút tiến `[>]` tròn.

---

### 4. Tầng 4: Lưới Thẻ Quản Trị Squircle `rounded-[28px]` (Grid Cards - Kế thừa Ảnh 1)
Mỗi thẻ trạm thu gom là một kiệt tác thiết kế tối giản:
* **Vỏ thẻ**: Nền trắng `#FFFFFF`, bo góc `rounded-[28px]`, đổ bóng mềm khuếch tán.
* **Header Thẻ**:
  - Logo vuông bo góc `w-12 h-12 rounded-[14px] bg-[#1A1D1A] text-white flex items-center justify-center font-black`.
  - Tên trạm: `Trạm H6 - Căn Tin 1 (Box #08)`, phụ đề vị trí `Khu vực Bàn nước Căn tin Tòa H6`.
  - Mũi tên chéo góc `ArrowUpRight` mở rộng chi tiết.
* **Thân Thẻ — Hộp 3 Cột Chỉ Số (Double Bezel `rounded-[18px]` nền `#F8FAF8`)**:
  - Cột 1: `MỨC ĐẦY` $\rightarrow$ `82%` (Đỏ nếu cao).
  - Cột 2: `ĐÃ GOM` $\rightarrow$ `2.4K` chai.
  - Cột 3: `TRẠNG THÁI` $\rightarrow$ `Cần gom`.
* **Footer Thẻ**:
  - Bên trái: Đường cong **Micro Sparkline** biểu thị xu hướng 7 ngày + Chip viên thuốc `↗ +14.2%`.
  - Bên phải: Nút Action viên thuốc màu xanh rêu `#6BA101`: `[Xem QR]` hoặc `[Điều Phối]`.

---

## V. ÁNH XẠ 4 CHỨC NĂNG NGHIỆP VỤ VÀO GIAO DIỆN MỚI

Toàn bộ nghiệp vụ tiếp nhận và điều phối giữa Cửa hàng (Highlands), Đối tác và 2 app `:3008` & `:3009` được thể hiện mượt mà trong giao diện này:

| Phân hệ nghiệp vụ | Cách hiển thị trên giao diện mới | Điểm chạm với app `:3008` & `:3009` |
| :--- | :--- | :--- |
| **1. Quản lý Mã QR Từng Chỗ** | Bản đồ Campus SVG (Tầng 2) + Lưới thẻ trạm (Tầng 4). Mỗi card có mã QR và nút tải ảnh SVG/PNG để in dán lên thùng. | Khi sinh viên ở `:3008` quét QR thùng, hệ thống map đúng vị trí đã đăng ký trên bản đồ. |
| **2. Tiếp nhận Khảo sát Cửa hàng (Highlands)** | Chuyển đổi lưới thẻ sang dạng **Chiến Dịch Khảo Sát**: Tên quán `Highlands Coffee`, câu hỏi *"Bạn đã thử Phindi Hạnh Nhân chưa?"*, nhãn cam *"Đẩy món chậm"*, thanh tiến độ `342/500 mẫu`. | Bấm **"Kích hoạt"** $\rightarrow$ Form trắc nghiệm 3s trên `:3008` tự động đổi sang câu hỏi này! |
| **3. Tiếp nhận Kho Voucher & Gói Thưởng Đối Tác** | Chuyển đổi lưới thẻ sang dạng **Kho Gói Thưởng**: Thẻ voucher `TCP Warrior 15k`, `Highlands 10k`; Cột 3 chỉ số hiển thị: `KHO MÃ | ĐÃ CẤP | ĐÃ DÙNG`; Mốc đổi quà sinh viên: 50đ EcoCup, 100đ Bình giữ nhiệt. | Bấm **"Đồng bộ"** $\rightarrow$ Cấp mã vào ví app `:3008` và gửi danh sách mã hợp lệ sang POS `:3009`. |
| **4. Đồng Bộ & Pipeline Monitor** | Thanh Live Status trên cùng: `Client Scanner (:3008): Online` & `Cashier POS (:3009): Online` kèm nút *"Đồng Bộ Toàn Hệ Thống"*. | Theo dõi luồng dữ liệu 2 chiều thời gian thực giữa cả 3 webapp. |

---

## VI. BỘ TOKENS TAILWIND CSS ĐỂ IMPORT VÀO `BRAND-PORTAL`

File `tailwind.config.js` của dự án đã sẵn sàng mở rộng các tokens chuẩn:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        moss: {
          DEFAULT: '#6BA101',  // Primary Green Action
          hover: '#5E8E00',
          dark: '#3A5A42',   // Forest base
          light: '#EBF7DC',  // Mint badge
          sage: '#7F916B',   // Moss midtone
        },
        earth: {
          taupe: '#8C7A6C',
          cream: '#E2DFDA',
          sand: '#D8D8CC',
        },
        charcoal: {
          DEFAULT: '#1A1D1A', // Primary text & Dark squircle
          soft: '#2C2C2C',
          muted: '#8E928E',
        }
      },
      borderRadius: {
        'squircle': '28px',
        'inner-pod': '18px',
      },
      boxShadow: {
        'glass-edge': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), 0 20px 40px -15px rgba(0, 0, 0, 0.12)',
        'card-ambient': '0 4px 24px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 16px 36px -6px rgba(107, 161, 1, 0.14)',
      }
    },
  },
  plugins: [],
}
```

---
*Tài liệu này là kim chỉ nam thiết kế giao diện cao cấp nhất cho toàn bộ hệ thống Web Điều Phối EcoPass Operations Hub (SP 2).*
