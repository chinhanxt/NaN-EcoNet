# 🏗️ Kiến Trúc Hợp Nhất & Giao Thức Liên Phân Hệ (Unified Architecture & Inter-Service Synergy)

Hệ sinh thái **NaN-EcoNet** được thiết kế theo mô hình kiến trúc Monorepo phân tán nhiều dịch vụ (Multi-Service Monorepo). Ba phân hệ độc lập về mặt triển khai nhưng được kết nối chặt chẽ thông qua các hợp đồng dữ liệu chuẩn hóa (Data Contracts) và hàng đợi thông điệp bất đồng bộ.

---

## 1. Sơ Đồ Kiến Trúc Hệ Sinh Thái (System Topology)

<p align="center">
  <img src="../assets/diagrams/system-topology.png" alt="NaN-EcoNet Unified Architecture" width="100%" />
</p>
<p align="center"><i>Hình 1: Kiến trúc Monorepo tích hợp giữa EcoPass Enterprise, Smart Collection Engine và Citizen Bulky App</i></p>

### 1.1. Phân Tầng Hệ Thống (Architectural Layers)

1. **Tầng Giao Diện Tiền Tuyến (Presentation & Edge Layer):**
   * **Mobile Client (Flutter):** Ứng dụng dành cho hộ gia đình và tài xế gom rác, hỗ trợ quét ảnh AI trực tiếp tại camera (`apps/citizen-bulky-app/mobile`).
   * **Citizen & Municipal Web Portal (React / Vite):** Cổng thông tin dành cho cư dân và cán bộ đô thị tra cứu đơn hàng và lịch xe (`apps/citizen-bulky-app/src`).
   * **Interactive Dual-Map UI (MapLibre GL JS):** Giao diện bản đồ đối đầu trực quan hóa kết quả thuật toán VRP (`apps/smart-collection-engine/map_ui`).
   * **Streamlit Parameter Studio:** Bảng điều khiển phân tích đồ thị hội tụ và mô phỏng tham số thuật toán (`apps/smart-collection-engine/streamlit`).
   * **EcoPass Partner Scanner WebApp:** WebApp quét mã tem thưởng một lần (1-Time Burn) tại quầy thu ngân đối tác (`apps/ecopass-enterprise/ecopass/client-scanner`).

2. **Tầng Điều Phối & Tính Toán Lõi (Core Processing Layer):**
   * **Smart Collection Engine (FastAPI & C++ OpenMP):** Động cơ giải bài toán CVRPTW tích hợp thuật toán đàn kiến đa quyết định (3D-PACO) và Google OR-Tools.
   * **AI Vision Inference Gateway (Gemini 2.5 Flash):** Pipeline phân tích thị giác nhận diện phân loại vật phẩm, ước lượng kích thước 3D và thành phần vật liệu.
   * **Live Dynamic Pricing Engine:** Mô đun tính toán cước thu gom 4 thành phần minh bạch với cơ chế khóa giá giữ chỗ 15 phút.

3. **Tầng Doanh Nghiệp & Trí Tuệ Nhân Tạo Agentic (Enterprise & Agentic Layer):**
   * **Enterprise BI Copilot:** Trợ lý ảo truy vấn số liệu kinh doanh và báo cáo EPR sử dụng Model Context Protocol (MCP).
   * **Dynamic Diagram Generator:** Engine biên dịch sơ đồ trực quan hóa dữ liệu theo thời gian thực (Mermaid/PlantUML).
   * **AI Visual Synthesis Gateway:** Proxy kết nối các mô hình sinh ảnh chất lượng cao (FLUX, Gemini Imagen, Qwen-Image-2).
   * **Distribution Utilities (`nan-team/scripts`):** Bộ công cụ kịch bản tự động hóa hỗ trợ xuất bản nội dung truyền thông môi trường.

---

## 2. Quy Trình Vòng Lặp Khép Kín (End-to-End Sequence Loop)

<p align="center">
  <img src="../assets/diagrams/sequence-flow.png" alt="End-to-End Sequence Flow" width="100%" />
</p>
<p align="center"><i>Hình 2: Quy trình khép kín từ lúc cư dân chụp ảnh rác cồng kềnh đến khi hoàn tất tái chế và cấp voucher</i></p>

### Các Bước Vận Hành Chi Tiết:

1. **Phát Hiện & Định Giá (Detection & Quote):**
   * Cư dân mở ứng dụng di động, chụp ảnh món đồ cũ cồng kềnh (sofa, nệm, tủ gỗ...).
   * Ảnh được gửi tới AI Vision Gateway (Gemini 2.5 Flash), trả về bounding box, phân loại danh mục, kích thước ước tính ($L \times W \times H$) và tỷ lệ vật liệu (gỗ, đệm mút, kim loại).
   * Pricing Engine tính cước 4 thành phần (phí cơ sở, cước thể tích, phí tầng cao, phụ phí hẻm sâu), hiển thị khoảng giá Min-Max và cam kết dung sai thực địa $\le \pm 10\%$. Báo giá được khóa giữ chỗ trong 15 phút.

2. **Đặt Lịch & Đẩy Hàng Đợi (Booking & Queue Dispatch):**
   * Cư dân xác nhận đặt lịch hẹn và đặt cọc (hoặc cam kết thanh toán).
   * Đơn hàng hợp lệ được chuẩn hóa theo hợp đồng dữ liệu `BulkyOrderPayload` và đẩy vào hàng đợi thu gom của Smart Collection Engine.

3. **Tối Ưu Tuyến Đường & Điều Phối Đội Xe (Routing & Dispatch):**
   * Định kỳ (hoặc khi có yêu cầu đột xuất), Smart Collection Engine tổng hợp các điểm gom rác trong khu vực (bao gồm cả thùng rác công cộng và đơn rác cồng kềnh của cư dân).
   * Bộ giải 3D-PACO phối hợp cùng Local OSRM tính toán lộ trình tối ưu cho đội xe 1.5 tấn, tự động phân loại hình thức thu gom (xe vào tận nơi vs nhân viên gom bộ đầu hẻm).
   * Lộ trình chi tiết theo từng mốc thời gian (Time Windows) được đẩy xuống ứng dụng của tài xế.

4. **Thu Gom & Cấp Tem Thưởng (Collection & Verification):**
   * Tài xế tiếp cận hiện trường, kiểm tra món đồ và bấm xác nhận thu gom thành công trên app.
   * Hệ thống ghi nhận khối lượng rác được chuyển hóa về kho phân loại / tái chế, tự động kích hoạt cấp điểm thưởng EcoPass tương ứng cho cư dân.

5. **Đổi Thưởng & Báo Cáo Doanh Nghiệp (Redemption & EPR Compliance):**
   * Cư dân sử dụng điểm EcoPass quy đổi voucher giảm giá đồ uống hoặc nhu yếu phẩm tại quầy đối tác.
   * Dữ liệu thu gom định vị GPS và hóa đơn tái chế được lưu vết vào cơ sở dữ liệu kiểm toán EPR, cung cấp báo cáo tuân thủ tự động cho các nhãn hàng đối tác qua Enterprise BI Copilot.

---

## 3. Hợp Đồng Dữ Liệu Liên Phân Hệ (Data Contracts)

Để đảm bảo tính độc lập và khả năng mở rộng giữa các phân hệ, toàn bộ giao tiếp tuân thủ cấu trúc hợp đồng dữ liệu JSON schema:

### 3.1. Hợp Đồng Yêu Cầu Thu Gom Rác Cồng Kềnh (`BulkyOrderPayload`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "BulkyOrderPayload",
  "type": "object",
  "required": ["order_id", "citizen_id", "location", "items", "quote"],
  "properties": {
    "order_id": { "type": "string", "example": "BLK-20260926-0881" },
    "citizen_id": { "type": "string", "example": "ctz-774921" },
    "pickup_window": {
      "type": "object",
      "properties": {
        "start_time": { "type": "string", "format": "date-time" },
        "end_time": { "type": "string", "format": "date-time" }
      }
    },
    "location": {
      "type": "object",
      "required": ["lat", "lon", "address"],
      "properties": {
        "lat": { "type": "number", "example": 10.7769 },
        "lon": { "type": "number", "example": 106.7009 },
        "address": { "type": "string", "example": "Hẻm 47 Cô Bắc, Phường Cầu Ông Lãnh, Quận 1" },
        "alley_depth_meters": { "type": "number", "example": 85.0 },
        "floor_number": { "type": "integer", "example": 2 },
        "has_elevator": { "type": "boolean", "example": false }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item_id": { "type": "string" },
          "category": { "type": "string", "enum": ["SOFA", "MATTRESS", "CABINET", "TABLE", "OTHER"] },
          "dimensions_cm": {
            "type": "object",
            "properties": { "length": { "type": "number" }, "width": { "type": "number" }, "height": { "type": "number" } }
          },
          "estimated_volume_m3": { "type": "number", "example": 1.25 },
          "estimated_weight_kg": { "type": "number", "example": 45.0 },
          "material_composition": {
            "type": "object",
            "properties": { "wood": { "type": "number" }, "foam": { "type": "number" }, "metal": { "type": "number" } }
          }
        }
      }
    },
    "quote": {
      "type": "object",
      "properties": {
        "quote_id": { "type": "string" },
        "min_vnd": { "type": "integer", "example": 280000 },
        "max_vnd": { "type": "integer", "example": 360000 },
        "deposit_hold_vnd": { "type": "integer", "example": 280000 },
        "tolerance_percent": { "type": "number", "example": 10.0 },
        "expires_at": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### 3.2. Hợp Đồng Điểm Thưởng & Tái Chế (`EcoRewardPayload`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EcoRewardPayload",
  "type": "object",
  "required": ["transaction_id", "user_id", "waste_type", "points_credited", "co2_offset_kg"],
  "properties": {
    "transaction_id": { "type": "string", "example": "TX-REW-99120" },
    "user_id": { "type": "string", "example": "usr-88129" },
    "brand_id": { "type": "string", "example": "brand-coca-cola" },
    "waste_type": { "type": "string", "enum": ["PET_BOTTLE", "ALUMINUM_CAN", "BULKY_WOOD", "BULKY_METAL"] },
    "quantity": { "type": "number", "example": 5 },
    "weight_kg": { "type": "number", "example": 0.15 },
    "points_credited": { "type": "integer", "example": 150 },
    "co2_offset_kg": { "type": "number", "example": 0.42 },
    "verified_location": {
      "type": "object",
      "properties": { "lat": { "type": "number" }, "lon": { "type": "number" } }
    },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```
