# EcoPass iOS Design System & Tokens
> **Quy chuẩn Thiết kế Giao diện Chuẩn Apple iOS (Organic Apple Minimalism)**  
> *Được chiết xuất và số hóa trực tiếp từ 3 mẫu UI iPhone thực tế của dự án.*

---

## 1. Triết lý Thiết kế (Design Principles)
* **Organic Apple Minimalism**: Nền sáng ấm chống mỏi mắt (`#F8FAF8`), thẻ màu trắng tinh khiết (`#FFFFFF`), sắc xanh ngọc lục bảo sinh thái (`#3A9A43`).
* **Quy tắc 1 Giây (1-Second Glanceability)**: Font chữ to rõ, tiêu đề in đậm, mệnh giá voucher lớn, ít text rườm rà.
* **Xúc giác Haptic & Double-Bezel**: Bo góc Squircle liên tục (`rounded-[32px]`), các đường cong đồng tâm ($R_{inner} = R_{outer} - Padding$).
* **Nói Không Với AI-Slop**: Cấm đổ bóng đen gắt `shadow-md`, cấm gradient tím xanh lạm dụng, cấm nhồi nhét icon linh tinh.

---

## 2. Bảng Mã Màu (Color Palette & Tokens)

| Token Name | Mã Hex | Ý nghĩa & Vị trí sử dụng |
| :--- | :--- | :--- |
| `eco-canvas` | `#F8FAF8` | Nền canvas toàn app (Warm off-white ánh lục nhẹ, chống lóa) |
| `eco-surface` | `#FFFFFF` | Nền thẻ chính, modal bottom sheet, voucher card |
| `eco-primary` | `#3A9A43` | **Xanh lá chủ đạo**: Nút bấm CTA, góc ngắm camera, scanline, active tab |
| `eco-primary-dark` | `#286B30` | Trạng thái hover / active / pressed của nút bấm |
| `eco-tint` | `#E8F5E9` | Nền badge, chip đã chọn, nền icon sinh thái |
| `eco-soft` | `#F0F7F0` | Nền input, container lồng trong (Double-bezel inner) |
| `eco-text-main` | `#1A1D1A` | Chữ chính: Tiêu đề H1, mệnh giá voucher, số tiền giảm (WCAG AAA) |
| `eco-text-muted` | `#606861` | Chữ phụ: Điều kiện áp dụng, hạn dùng, hướng dẫn quét (WCAG AA) |
| `eco-text-faint` | `#949E95` | Placeholder, icon inactive, chú thích mờ |
| `eco-error` | `#E11D48` | Báo lỗi voucher đã dùng / gian lận tại quầy POS |
| `eco-error-bg` | `#FFF1F2` | Nền card cảnh báo lỗi POS |

---

## 3. Hình học, Bo góc & Đổ bóng (Geometry & Elevation)

### Bo góc Squircle:
* Thẻ bề mặt chính: `rounded-[28px]` hoặc `rounded-[32px]`.
* Nút bấm CTA, Thanh điều hướng Dock, Ô tìm kiếm: `rounded-full` (True Pill shape).
* Modal Bottom Sheet trượt đáy: `rounded-t-[36px]`.
* Khung ngắm Camera Reticle: `rounded-[24px]` với viền góc dày 4px.

### 4 Công thức Đổ bóng Khuếch tán (Diffused Shadows):
1. **Thẻ nổi nhẹ**: `box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);`
2. **Thanh dock nổi & Sheet**: `box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.03);`
3. **Phát quang nút CTA xanh**: `box-shadow: 0 10px 24px -4px rgba(58, 154, 67, 0.35), 0 3px 8px rgba(58, 154, 67, 0.15);`
4. **Kính mờ Apple Frosted Glass**: `backdrop-filter: blur(24px) saturate(180%); background-color: rgba(255, 255, 255, 0.85); border: 1px solid rgba(255, 255, 255, 0.4);`

---

## 4. Cấu hình Tailwind CSS chuẩn (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        eco: {
          canvas: '#F8FAF8',
          surface: '#FFFFFF',
          tint: '#E8F5E9',
          soft: '#F0F7F0',
          primary: '#3A9A43',
          dark: '#286B30',
          light: '#4E9F3D',
          text: {
            main: '#1A1D1A',
            muted: '#606861',
            faint: '#949E95',
          }
        }
      },
      borderRadius: {
        'squircle-inner': '22px',
        'squircle-card': '32px',
        'sheet': '36px',
      },
      boxShadow: {
        'ios-card': '0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'ios-float': '0 16px 40px -8px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.03)',
        'ios-glow': '0 10px 24px -4px rgba(58, 154, 67, 0.35), 0 3px 8px rgba(58, 154, 67, 0.15)',
        'ios-scanline': '0 0 16px rgba(58, 154, 67, 0.75)',
      }
    }
  }
};
```
