# Thiết kế Kỹ thuật: Nhận diện đồ cồng kềnh với Bounding Box YOLOv11 & Gemini Multimodal Vision (Phase 2)

- **Ngày ban hành:** 2026-09-23
- **Tác giả:** Dev-EnglandLee (Developer 3)
- **Phạm vi tác động:** `src/modules/bulky/`
- **Mục tiêu:** Cung cấp trải nghiệm thị giác AI trực quan cao cấp cho công dân và điều phối viên: nhận diện chính xác vị trí đồ vật qua tọa độ Bounding Box 2D chuẩn YOLO11 (`box_2d`), phân loại nhãn tiếng Việt rõ ràng, đo lường độ tin cậy (`confidence`), hiển thị lớp vẽ Canvas/SVG tương tác 2 chiều trên ảnh, và tự động liên kết với khảo sát chất liệu Phase 1.

---

## 1. Bối cảnh & Vấn đề giải quyết

Trong quy trình đăng ký thu gom đồ cồng kềnh:
1. **Thiếu phản hồi trực quan:** Người dân tải ảnh chụp phòng khách/nhà kho lên nhưng chỉ thấy danh sách text khô khan, không biết AI đã quét trúng phần nào của bức ảnh (chiếc sofa hay cái bàn trà cạnh đó).
2. **Khó kiểm chứng phát hiện rác độc hại:** Khi AI cảnh báo "Phát hiện rác cấm/nguy hại", người dùng không biết vật nguy hại đó nằm ở góc nào trong ảnh để loại bỏ hoặc giải trình.
3. **Liên kết dữ liệu AI với Khảo sát vật liệu (Phase 1):** Phase 1 đã xây dựng thành công 3 nhóm vật liệu (`LIGHT`, `STANDARD`, `HEAVY`). AI cần gợi ý luôn nhóm vật liệu sơ bộ từ ảnh chụp để giảm tối đa thao tác của người dân.

---

## 2. Kiến trúc & Mô hình dữ liệu

### 2.1 Cấu trúc tọa độ Bounding Box (`box_2d`)
Quy chuẩn chuẩn hóa theo tỷ lệ $0 \to 1000$ (hoặc $0.0 \to 1.0$) cho mọi ảnh chụp bất kể kích thước gốc:
```json
{
  "box_2d": [ymin, xmin, ymax, xmax],
  "confidence": 0.96,
  "itemType": "SOFA",
  "catalogItemCode": "SOFA",
  "displayName": "Sofa da 3 chỗ phòng khách",
  "suggestedMaterial": "STANDARD",
  "dimensionsCm": { "length": 210, "width": 90, "height": 85 },
  "disassemblyNeeded": false
}
```
Trong đó:
- `ymin`: Tọa độ Y mép trên (0 - 1000)
- `xmin`: Tọa độ X mép trái (0 - 1000)
- `ymax`: Tọa độ Y mép dưới (0 - 1000)
- `xmax`: Tọa độ X mép phải (0 - 1000)

### 2.2 Màu sắc nhận diện theo phân loại danh mục
- **SOFA (Sofa/Ghế salon):** Emerald Green (`#059669`)
- **MATTRESS (Đệm/Giường):** Ocean Blue (`#2563eb`)
- **CABINET (Tủ/Kệ gỗ):** Amber Orange (`#d97706`)
- **TABLE (Bàn/Ghế ăn):** Purple Violet (`#7c3aed`)
- **OTHER (Đồ cồng kềnh khác):** Slate Teal (`#0d9488`)
- **HAZARDOUS (Rác cấm / Nguy hại):** Crimson Red (`#dc2626`) với hiệu ứng viền cảnh báo nhấp nháy.

---

## 3. Thành phần giao diện & Tương tác

### 3.1 Component `BulkyImageBoundingBoxOverlay.jsx`
- **Props:**
  - `image`: Object ảnh (`dataUrl`, `filename`, `mimeType`).
  - `boxes`: Mảng các đối tượng chứa `box_2d`, `displayName`, `confidence`, `itemType`, `isHazardous`.
  - `selectedBoxIndex`: Index của box đang được hover hoặc chọn.
  - `onSelectBox(index)`: Callback kích hoạt khi click hoặc hover vào bounding box.
- **Tính năng:**
  - Render thẻ `<img>` và lớp SVG overlay có viewBox tỷ lệ $1000 \times 1000$.
  - Tự động co giãn theo responsive container.
  - Badge nhãn nổi: Hiển thị icon danh mục, tên tiếng Việt và thanh độ tin cậy dạng % (`96%`).
  - Nút bật/tắt (Toggle): Cho phép người dùng chuyển đổi giữa ảnh nguyên bản và ảnh có khung AI.

### 3.2 Tương tác 2 chiều (Bidirectional Highlighting)
- Rê chuột vào Bounding Box trên ảnh $\to$ Thẻ món đồ tương ứng trong danh sách `confirmedItems` bên dưới được viền nổi bật.
- Rê chuột vào Thẻ món đồ $\to$ Bounding Box trên ảnh đổi màu viền đậm và phóng to badge nhãn.

---

## 4. Tích hợp AI Service (`geminiVisionService.js`)

1. **Cập nhật Prompt có cấu trúc:** Yêu cầu Gemini 2.5 Flash trích xuất tọa độ `box_2d` cho từng vật thể nhận diện được.
2. **Preset Bounding Box:** Thiết lập sẵn tọa độ chuẩn cho 3 bộ ảnh mẫu (`sofa_da_phong_khach.jpg`, `nem_lo_xo_1m8.jpg`, `tu_go_3_canh.jpg`) để người dùng thử nghiệm nhanh mà không cần key API hoặc mạng ngoài.
3. **Khả năng chịu lỗi (Graceful degradation):** Nếu ảnh chụp không trích xuất được bounding box, hệ thống tự động suy diễn box trung tâm mặc định `[100, 100, 900, 900]` và vẫn hiển thị danh mục hoàn hảo.

---

## 5. Chiến lược Kiểm thử (Testing Strategy)

1. **Unit Tests:**
   - `src/modules/bulky/services/ai/geminiVisionService.test.js`: Kiểm tra trích xuất và chuẩn hóa `box_2d`, `confidence`, và `suggestedMaterial`.
2. **Component Tests:**
   - `src/modules/bulky/components/BulkyImageBoundingBoxOverlay.test.jsx`: Kiểm tra hiển thị SVG rects, nhãn badge, toggle hiển thị, và sự kiện click/hover.
3. **Integration Tests:**
   - `src/modules/bulky/pages/BulkyBookingPage.test.jsx`: Kiểm tra toàn bộ luồng từ khi ảnh mẫu được thêm $\to$ AI quét hiển thị Bounding Box $\to$ chọn vật liệu $\to$ chuyển bước bốc xếp và đặt lịch.
