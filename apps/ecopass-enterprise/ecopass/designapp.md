# EcoPass — Mobile UI/UX Design System (`designapp.md`)
> **Chuẩn Thiết Kế Giao Diện Mobile Apple iOS (Organic Apple Minimalism)**  
> *Được chiết xuất và số hóa trực tiếp từ các mẫu iPhone UI thực tế cho SP 1 (Client Scanner) & SP 3 (Cashier POS).*

---

## 1. Triết Lý Thiết Kế Cốt Lõi (Core Visual Philosophy)
* **Tone màu**: Trắng tinh khiết (`#FFFFFF`) kết hợp Nền canvas ấm (`#F8FAF8`) và Sắc xanh ngọc lục bảo sinh thái (`#3A9A43`).
* **Phong cách**: Tối giản, thanh lịch chuẩn iOS Human Interface Guidelines (HIG).
* **Quy tắc "1 Giây Quan Sát" (1-Second Glanceability)**:
  - Cực ít text, câu ngắn dưới 7 từ.
  - Font to rõ, tiêu đề in đậm, mệnh giá voucher và số tiền giảm có kích thước vượt trội.
* **Xúc giác Haptic & Double-Bezel**:
  - Bo góc Squircle liên tục (`rounded-[28px]` đến `rounded-[32px]`).
  - Lồng viền kép đồng tâm giữa khung ngoài và khung trong.
* **Nói KHÔNG với AI-Slop**:
  - Cấm tiệt bóng đen gắt `shadow-md` mặc định.
  - Cấm gradient tím-xanh rẻ tiền.
  - Cấm icon emoji linh tinh trong giao diện. 100% dùng icon SVG nét mảnh chuẩn (Lucide / SF Symbols).

---

## 2. Hệ Thống Mã Màu (Color Palette & Tokens)

| Token Name | Mã Hex | Ý nghĩa & Vị trí áp dụng | Tiêu chuẩn tương phản WCAG |
| :--- | :--- | :--- | :--- |
| `eco-canvas` | `#F8FAF8` | Nền canvas toàn bộ ứng dụng (Off-white ánh lục nhẹ, chống lóa mắt ngoài trời) | Nền gốc |
| `eco-surface` | `#FFFFFF` | Nền thẻ Card chính, Modal Sheet trượt đáy, Khung Voucher | Tương phản phân cách bằng bóng mờ |
| `eco-primary` | `#3A9A43` | **Xanh lá chủ đạo**: Nút bấm CTA, góc ngắm camera, scanline, active tab | **3.4:1** (Chuẩn Components) |
| `eco-primary-dark` | `#286B30` | Trạng thái hover / active / pressed của nút bấm xanh | **5.1:1** (Chuẩn AA Text) |
| `eco-primary-light` | `#4E9F3D` | Màu tia laser quét mã, viền sáng highlight | 2.8:1 |
| `eco-tint` | `#E8F5E9` | Nền badges, chip danh mục đã chọn, nền icon sinh thái | N/A (Surface tint) |
| `eco-soft` | `#F0F7F0` | Nền ô input, container lồng trong (Double-bezel inner) | N/A (Surface soft) |
| `eco-text-main` | `#1A1D1A` | Chữ chính: Tiêu đề H1, mệnh giá voucher, số tiền giảm | **15.2:1** (Chuẩn AAA Siêu nét) |
| `eco-text-muted` | `#606861` | Chữ phụ: Điều kiện áp dụng, hạn dùng, hướng dẫn quét | **4.9:1** (Chuẩn AA) |
| `eco-text-faint` | `#949E95` | Placeholder, icon chưa active, chú thích mờ | 2.5:1 (Không dùng cho text quan trọng) |
| `eco-error` | `#E11D48` | Báo lỗi voucher đã dùng / gian lận tại quầy thu ngân | **4.6:1** trên nền trắng |
| `eco-error-bg` | `#FFF1F2` | Nền card cảnh báo lỗi tại màn hình POS | N/A |

---

## 3. Hình Học, Bo Góc & Kỹ Thuật Double-Bezel

### A. Thang đo Bo góc Squircle:
* **Thẻ bề mặt chính (Main Cards)**: `rounded-[28px]` hoặc `rounded-[32px]` (Chuẩn Squircle của Apple iOS).
* **Nút bấm, Tabs, Pills, Ô tìm kiếm**: `rounded-full` (True Pill shape 100%).
* **Modal Bottom Sheet (Khay trượt đáy)**: `rounded-t-[36px]` (Khớp hoàn hảo viền màn hình iPhone).
* **Khung Reticle Camera**: `rounded-[24px]` với độ dày viền 4px ở 4 góc.

### B. Kỹ thuật Lồng viền kép (Double-Bezel Architecture):
Tạo chiều sâu vật lý cho các thẻ nội dung quan trọng:
* **Khung ngoài (Outer Shell)**:  
  `bg-white rounded-[32px] p-3 border border-black/[0.04] shadow-ios-card`
* **Khung trong (Inner Core)**:  
  `bg-[#F8FAF8] rounded-[22px] p-4 border border-black/[0.02]`
* **Quy tắc toán học**: $Radius_{inner} = Radius_{outer} - Padding_{gap} \Rightarrow 32px - 12px \approx 20px - 22px$. Các đường cong đồng tâm tuyệt đối, tạo cảm giác xúc giác (haptic) mượt mà.

---

## 4. Đổ Bóng & Hiệu Ứng Chiều Sâu (Elevation & Glow)

> **CẢNH BÁO**: Tuyệt đối **KHÔNG** dùng các class bóng mặc định (`shadow-md`, `shadow-lg`) vì tạo bóng đen sì, thô cứng.

### Bộ 4 Công Thức Bóng Khuếch Tán Cao Cấp:
1. **Bóng Thẻ Bề Mặt (`shadow-ios-card`)**:
   ```css
   box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
   ```
2. **Bóng Thanh Dock Nổi & Bottom Sheet (`shadow-ios-float`)**:
   ```css
   box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.03);
   ```
3. **Bóng Phát Quang Nút Bấm Xanh (`shadow-ios-glow`)**:
   ```css
   box-shadow: 0 10px 24px -4px rgba(58, 154, 67, 0.35), 0 3px 8px rgba(58, 154, 67, 0.15);
   ```
4. **Kính Mờ Apple (Frosted Glassmorphism)**:
   ```css
   backdrop-filter: blur(24px) saturate(180%);
   background-color: rgba(255, 255, 255, 0.85);
   border: 1px solid rgba(255, 255, 255, 0.4);
   ```

---

## 5. Typography & Phân Cấp Thị Giác

* **Font chữ tiêu chuẩn**: `Plus Jakarta Sans` hoặc `SF Pro Display / Text`.
* **Tracking**: `-0.02em` (cho cảm giác hiện đại, gọn gàng).

| Cấp bậc | Cỡ chữ Tailwind | Độ đậm (Weight) | Màu sắc | Mục đích sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Hero / Big Digits** | `text-[32px]` - `text-[36px]` | `font-black` | `#3A9A43` / `#1A1D1A` | Mệnh giá voucher (`GIẢM 10.000Đ`), tiền thối |
| **Screen Title (H1)** | `text-[26px]` - `text-[28px]` | `font-extrabold` | `#1A1D1A` | Tên màn hình chính, lời chào |
| **Section Heading (H2)**| `text-[18px]` - `text-[20px]` | `font-bold` | `#1A1D1A` | Câu hỏi khảo sát, nhóm tính năng |
| **Card Title (H3)** | `text-[16px]` | `font-bold` | `#1A1D1A` | Tên món nước, tên thương hiệu |
| **Body Text** | `text-[14px]` - `text-[15px]` | `font-medium` | `#606861` | Điều kiện áp dụng, hướng dẫn quét |
| **Caption / Badge** | `text-[11px]` - `text-[12px]` | `font-bold uppercase` | `#3A9A43` | Nhãn HSD, nhãn thương hiệu |

---

## 6. Giải Phẫu Chi Tiết Các Component Trọng Tâm

### Component 1: Viewfinder Camera (SP 1 - Client Scanner)
* **Khung ngắm**: Khung vuông tỷ lệ 1:1, căn giữa màn hình. 4 góc bo squircle (`rounded-[24px]`) bằng stroke xanh `#3A9A43` dày 4px.
* **Tia quét Laser (Scanline)**: Thanh ngang gradient xanh chuyển động dọc từ trên xuống dưới kèm ánh sáng phát quang `box-shadow: 0 0 16px #3A9A43`.
* **Nút chức năng**: Nút tròn kính mờ góc trên (`h-11 w-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-white`).
* **Khay trượt đáy (Result Sheet)**: Khi nhận diện mã EAN-13, khay tự động trượt lên (`rounded-t-[36px] bg-white p-6 shadow-ios-float`) hiển thị tên lon nước và nút CTA *"Làm khảo sát 3s nhận Voucher"*.

### Component 2: Khảo Sát Trắc Nghiệm 3s (Micro-Survey Modal)
* **Thanh đếm lùi**: Thanh tiến trình siêu mỏng 3px ở đỉnh modal, đếm lùi trong 3 giây.
* **Thẻ lựa chọn A/B**:
  - Kích thước: Chiều cao tối thiểu 72px, chiều ngang chiếm trọn màn hình (full-width).
  - Trạng thái bình thường: `bg-[#F8FAF8] border border-black/[0.04] rounded-[22px]`.
  - Trạng thái khi chọn: `bg-[#E8F5E9] border-2 border-[#3A9A43] shadow-ios-glow`, kích hoạt rung haptic nhẹ (`15ms`) và hiện checkmark xanh.

### Component 3: Thẻ Voucher Đục Lỗ (Apple Passbook Style)
* **Thiết kế vết khuyết vé (Perforated Notch)**: 2 vết khuyết bán nguyệt đối xứng hai bên đường kẻ đứt đoạn ngăn cách giữa phần Giá trị ưu đãi và phần Mã QR.
* **Mã QR Siêu Tương Phản**: Kích thước `180x180px`, đặt trong khung trắng đệm `p-3 rounded-[22px] border border-black/[0.06]`.
* **Dãy mã số dự phòng**: In hoa to rõ `font-mono tracking-widest text-base font-bold` bên dưới để thu ngân gõ tay khi cần.

### Component 4: Floating Bottom Navigation Dock
* **Vị trí**: Nằm cách đáy màn hình `bottom-6`, căn giữa, chiều rộng `w-[90%] max-w-[360px]`, cao `h-[66px]`.
* **Chất liệu**: `bg-white/85 backdrop-blur-2xl rounded-full border border-black/[0.05] shadow-ios-float`.
* **Nút Quét trung tâm**: Hình tròn nổi bật đường kính 52px nền xanh lá `#3A9A43`, icon Scan trắng, đổ bóng `shadow-ios-glow`.

### Component 5: Màn Hình Thu Ngân POS (SP 3 - Cashier POS)
* **Khi HỢP LỆ (Valid)**: Thẻ hóa xanh `bg-[#E8F5E9] border-2 border-[#3A9A43]`, icon checkmark rung nhẹ, số tiền giảm `-10.000đ` cực to kèm nút bấm khổng lồ `h-16 rounded-full` *"XÁC NHẬN TRỪ TIỀN"*.
* **Khi KHÔNG HỢP LỆ (Fraud/Used)**: Thẻ chuyển đỏ `bg-[#FFF1F2] border-2 border-[#E11D48]`, thông báo rõ *"MÃ ĐÃ ĐƯỢC SỬ DỤNG LÚC 14:20"*.

---

## 7. Cấu Hình Tailwind CSS Sẵn Sàng (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        eco: {
          canvas: '#F8FAF8',       // Warm organic canvas
          surface: '#FFFFFF',      // Pure white card
          tint: '#E8F5E9',         // Soft green badge/pill tint
          soft: '#F0F7F0',         // Secondary input/inner container
          primary: '#3A9A43',      // Core Brand Green (Organic Emerald)
          dark: '#286B30',         // Pressed / Dark Green
          light: '#4E9F3D',        // Light vibrant highlight
          text: {
            main: '#1A1D1A',       // WCAG AAA high-contrast text
            muted: '#606861',      // Subtitle & secondary info
            faint: '#949E95',      // Placeholder & borders
          },
          border: 'rgba(0, 0, 0, 0.04)',
        }
      },
      borderRadius: {
        'squircle-sm': '16px',
        'squircle-md': '22px',     // Khung lồng trong (Double-bezel inner)
        'squircle-lg': '28px',     // Thẻ con
        'squircle-xl': '32px',     // Thẻ chính (Squircle chuẩn Apple)
        'sheet': '36px',           // Khay trượt bottom sheet
      },
      boxShadow: {
        'ios-card': '0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'ios-float': '0 16px 40px -8px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.03)',
        'ios-glow': '0 10px 24px -4px rgba(58, 154, 67, 0.35), 0 3px 8px rgba(58, 154, 67, 0.15)',
        'ios-scanline': '0 0 16px rgba(58, 154, 67, 0.75)',
      },
      animation: {
        'scan': 'scanline 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        scanline: {
          '0%, 100%': { transform: 'translateY(0%)', opacity: '0.8' },
          '50%': { transform: 'translateY(240px)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.92' },
        }
      }
    },
  },
};
```

---

## 8. Checklist Kiểm Định Trước Khi Xuất Code (UI Delivery Gate)

- [ ] Nền ứng dụng có dùng mã ấm `#F8FAF8` hay không? (Cấm dùng màu trắng chói lóa `#FFFFFF` cho toàn trang).
- [ ] Các thẻ Card có bo góc chuẩn `rounded-[28px]` hoặc `rounded-[32px]` không?
- [ ] Các nút bấm CTA có dạng viên thuốc `rounded-full` và có bóng phát quang `shadow-ios-glow` không?
- [ ] Không có bất kỳ bóng đen thô ráp nào (`shadow-md`, `shadow-lg`) xuất hiện trong code.
- [ ] Chữ số tiền giảm giá và tiêu đề có to bản và rõ ràng theo quy tắc 1 giây quan sát không?
- [ ] Không sử dụng icon emoji rác trong UI.
- [ ] Khung ngắm Camera có đủ 4 góc Squircle xanh lá và tia laser quét không?
- [ ] Modal trượt từ dưới lên có bo cong `rounded-t-[36px]` đúng chuẩn iPhone không?
