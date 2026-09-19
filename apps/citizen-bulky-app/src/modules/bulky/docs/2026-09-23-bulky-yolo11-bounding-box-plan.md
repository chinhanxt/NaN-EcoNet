# Kế hoạch Triển khai: Bounding Box YOLOv11 & Nhận diện Trực quan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung hiển thị Bounding Box 2D chuẩn YOLO11 (`box_2d`) trên ảnh chụp, hỗ trợ tương tác 2 chiều (hover box $\leftrightarrow$ highlight thẻ món đồ), tự động đồng bộ vật liệu gợi ý (`suggestedMaterial`) vào khảo sát chất liệu Phase 1, và cảnh báo trực quan rác cấm/nguy hại.

**Architecture:** Mở rộng `geminiVisionService.js` để trả về tọa độ `box_2d` chuẩn hóa (0 - 1000) và `suggestedMaterial` (LIGHT / STANDARD / HEAVY). Xây dựng component mới `BulkyImageBoundingBoxOverlay.jsx` vẽ lớp SVG responsive trên ảnh với nhãn badge và thanh tin cậy %. Tích hợp vào Step 0 của `BulkyRequestWizard.jsx`.

**Tech Stack:** React 18, Material UI (MUI v6), SVG overlays, Vitest, React Testing Library.

## Global Constraints
- Branch: `dev-EnglandLee` (Developer 3)
- Scope: Chỉ chỉnh sửa trong `src/modules/bulky/`
- Language: 100% tiếng Việt cho nhãn, thông báo và tooltip
- Bảo mật: Tuyệt đối không hardcode API key vào git

---

### Task 1: Cập nhật Schema AI Service, Bounding Box Presets & Parser

**Files:**
- Modify: `src/modules/bulky/services/ai/geminiVisionService.js`
- Test: `src/modules/bulky/services/ai/geminiVisionService.test.js`

**Interfaces:**
- Produces: Mỗi item trong `res.items` có thêm `box_2d: [ymin, xmin, ymax, xmax]`, `confidence: number`, `suggestedMaterial: 'LIGHT' | 'STANDARD' | 'HEAVY'`. `res.boundingBoxes` tổng hợp toàn bộ các boxes.

- [ ] **Step 1: Viết test failing trong `geminiVisionService.test.js`**
Bổ sung test case kiểm tra `box_2d` và `suggestedMaterial` được trả về từ presets mẫu và từ hàm phân tích.

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Chạy: `npx vitest run src/modules/bulky/services/ai/geminiVisionService.test.js`
Expected: FAIL vì `box_2d` chưa có trong kết quả preset.

- [ ] **Step 3: Cập nhật `geminiVisionService.js`**
Thêm `box_2d` vào `PRESET_MAPPINGS`:
  - `sofa_da_phong_khach.jpg`: `box_2d: [180, 120, 850, 910]`, `confidence: 0.96`, `suggestedMaterial: 'STANDARD'`
  - `nem_lo_xo_1m8.jpg`: `box_2d: [150, 100, 880, 900]`, `confidence: 0.94`, `suggestedMaterial: 'STANDARD'`
  - `tu_go_3_canh.jpg`: `box_2d: [100, 150, 920, 850]`, `confidence: 0.91`, `suggestedMaterial: 'HEAVY'`
Cập nhật prompt và bộ parser chuẩn hóa `box_2d` từ API.

- [ ] **Step 4: Chạy lại test xác nhận PASS**
Chạy: `npx vitest run src/modules/bulky/services/ai/geminiVisionService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/modules/bulky/services/ai/geminiVisionService.js src/modules/bulky/services/ai/geminiVisionService.test.js
git commit -m "feat(bulky): add box_2d coordinates and suggestedMaterial to AI vision service"
```

---

### Task 2: Xây dựng Component `BulkyImageBoundingBoxOverlay`

**Files:**
- Create: `src/modules/bulky/components/BulkyImageBoundingBoxOverlay.jsx`
- Create: `src/modules/bulky/components/BulkyImageBoundingBoxOverlay.test.jsx`

**Interfaces:**
- Consumes: `image` (URL/dataUrl), `boxes` (mảng `{ box_2d, displayName, confidence, itemType, isHazardous }`), `selectedBoxIndex`, `onSelectBox`, `showBoxesToggle`.
- Produces: UI component render thẻ `<img>` kèm lớp SVG viewBox `0 0 1000 1000` hiển thị viền bounding box và badge nhãn nổi.

- [ ] **Step 1: Viết test failing trong `BulkyImageBoundingBoxOverlay.test.jsx`**
Kiểm tra component render đúng số lượng SVG rect, hiển thị badge tên và độ tin cậy %, phản hồi sự kiện hover/click, và nút bật/tắt hiển thị khung.

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Chạy: `npx vitest run src/modules/bulky/components/BulkyImageBoundingBoxOverlay.test.jsx`
Expected: FAIL vì file component chưa tồn tại.

- [ ] **Step 3: Triển khai component `BulkyImageBoundingBoxOverlay.jsx`**
Cấu trúc SVG overlay trên ảnh với mã màu:
  - SOFA: `#059669`
  - MATTRESS: `#2563eb`
  - CABINET: `#d97706`
  - TABLE: `#7c3aed`
  - OTHER: `#0d9488`
  - HAZARDOUS: `#dc2626`
Render badge HTML/SVG tại tọa độ góc trên bên trái của box. Thêm switch toggle hiển thị.

- [ ] **Step 4: Chạy test xác nhận PASS**
Chạy: `npx vitest run src/modules/bulky/components/BulkyImageBoundingBoxOverlay.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/modules/bulky/components/BulkyImageBoundingBoxOverlay.jsx src/modules/bulky/components/BulkyImageBoundingBoxOverlay.test.jsx
git commit -m "feat(bulky): create BulkyImageBoundingBoxOverlay component with SVG boxes and badges"
```

---

### Task 3: Tích hợp Bounding Box Overlay vào Wizard & Tương tác 2 Chiều

**Files:**
- Modify: `src/modules/bulky/features/request/BulkyRequestWizard.jsx`
- Modify: `src/modules/bulky/pages/BulkyBookingPage.test.jsx`

**Interfaces:**
- Consumes: `BulkyImageBoundingBoxOverlay` từ Task 2, `box_2d` và `suggestedMaterial` từ Task 1.
- Produces: Giao diện Wizard Step 0 hiển thị ảnh có overlay bounding box, hover tương tác 2 chiều giữa ảnh và danh sách thẻ items, tự động gán vật liệu gợi ý.

- [ ] **Step 1: Viết test failing trong `BulkyBookingPage.test.jsx`**
Kiểm tra khi người dùng chọn ảnh mẫu hoặc chạy AI, component Bounding Box hiển thị trên wizard, và hover item card làm nổi bật bounding box tương ứng.

- [ ] **Step 2: Chạy test để xác nhận FAIL**
Chạy: `npx vitest run src/modules/bulky/pages/BulkyBookingPage.test.jsx`
Expected: FAIL vì wizard chưa nhúng overlay.

- [ ] **Step 3: Nhúng `BulkyImageBoundingBoxOverlay` vào Step 0 của `BulkyRequestWizard.jsx`**
Thêm state `hoveredItemIndex`, truyền boxes từ `aiResult` hoặc `formData.imageMetadata`, tự động điền `material: item.suggestedMaterial || 'STANDARD'`. Kết nối hover event giữa card và box.

- [ ] **Step 4: Chạy test xác nhận PASS**
Chạy: `npx vitest run src/modules/bulky/pages/BulkyBookingPage.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/modules/bulky/features/request/BulkyRequestWizard.jsx src/modules/bulky/pages/BulkyBookingPage.test.jsx
git commit -m "feat(bulky): integrate bounding box overlay into request wizard with bidirectional hover"
```

---

### Task 4: Chạy Toàn Bộ Test Suite, Kiểm Tra Build & Đồng Bộ Git Remote

**Files:**
- Toàn bộ module `src/modules/bulky/`

- [ ] **Step 1: Chạy toàn bộ test suite của module bulky**
Chạy: `npx vitest run src/modules/bulky`
Expected: 15/15 test files (100+ tests) PASS 100%.

- [ ] **Step 2: Chạy build production**
Chạy: `npm run build`
Expected: Build thành công không lỗi.

- [ ] **Step 3: Push lên `origin/dev-EnglandLee`**
Chạy: `git push origin dev-EnglandLee`
Expected: Push thành công.
