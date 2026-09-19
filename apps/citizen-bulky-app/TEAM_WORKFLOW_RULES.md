# QUY TẮC PHÁT TRIỂN SONG SONG & HỢP NHẤT DỰ ÁN SMARTBIN
*(Dành cho Team 3 Developers triển khai theo tài liệu Nghiệp vụ Thu gom IoT - Traccar - AI)*

---

## MỤC LỤC
1. [Bản đồ Bounded Context & Phân chia 3 Developers](#1-bản-đồ-bounded-context--phân-chia-3-developers)
2. [Ranh giới Thư mục & Quyền hạn File (Folder Ownership)](#2-ranh-giới-thư-mục--quyền-hạn-file-folder-ownership)
3. [Giao ước Dữ liệu Chung (Shared Contracts / Interfaces)](#3-giao-ước-dữ-liệu-chung-shared-contracts--interfaces)
4. [Kiến trúc Chống Xung đột (Zero-Conflict Modular Architecture)](#4-kiến-trúc-chống-xung-đột-zero-conflict-modular-architecture)
5. [Quy chuẩn Git & Chiến lược Nhánh (Git Branching & Merge Strategy)](#5-quy-chuẩn-git--chiến-lược-nhánh-git-branching--merge-strategy)
6. [Quy tắc Quản lý Dependencies (package.json & lockfile)](#6-quy-tắc-quản-lý-dependencies-packagejson--lockfile)
7. [Checklist Trước khi Tạo Pull Request (PR Checklist)](#7-checklist-trước-khi-tạo-pull-request-pr-checklist)

---

## 1. BẢN ĐỒ BOUNDED CONTEXT & PHÂN CHIA 3 DEVELOPERS

Dự án được phân chia thành **3 miền nghiệp vụ độc lập (Bounded Contexts)** tương ứng với 3 Developer, bám sát 13 trang tài liệu nghiệp vụ:

```
+---------------------------------------------------------------------------------------+
|                                    MAIN BRANCH (Production)                           |
+---------------------------------------------------------------------------------------+
               ^                                   ^                              ^
               |                                   |                              |
      (Merge PR 1)                        (Merge PR 2)                   (Merge PR 3)
               |                                   |                              |
+------------------------------+  +------------------------------+  +-----------------------------+
| DEV 1: IoT & Fleet Tracking  |  | DEV 2: Ticket & Dispatch Hub |  | DEV 3: Citizen & Billing    |
| - Telemetry thùng rác        |  | - Vòng đời 6 trạng thái      |  | - Portal cư dân theo hộ     |
| - GPS Traccar & Geofence     |  | - AI dự báo & Chống trùng    |  | - Thu phí tháng & Nhắc nợ   |
| - Bàn giao trạm & Cân rác    |  | - Tối ưu tuyến (OR-Tools)    |  | - Đặt rác cồng kềnh trả trc |
| (Trang 01, 02, 03, 04, 05)   |  | (Trang 01, 02, 03, 04, 06, 07)|  | (Trang 08, 09, 10, 11, 12, 13)
+------------------------------+  +------------------------------+  +-----------------------------+
               \                                   |                             /
                \------------------- SHARED CONTRACTS --------------------------/
                               (src/contracts/models.js)
```

### 1.1. DEV 1: Core IoT, Traccar Fleet & Station Offloading
* **Phạm vi nghiệp vụ (Trang 01, 02, 03, 04, 05):**
  * **IoT Telemetry:** Lắng nghe, lọc và hiển thị số đo thùng rác (mức đầy, pin, nhiệt độ, cảnh báo mùi). Xử lý tình trạng cảm biến lỗi/mất mạng (không tự ý xóa cảnh báo).
  * **Traccar GPS Tracking:** Tích hợp xe, lái xe, trạng thái di chuyển thời gian thực từ Traccar API/Socket. Xử lý sự kiện geofence vào/ra điểm thu gom.
  * **Trạm dỡ rác & Tải xe (Trang 05):** Quy trình xe đến điểm bàn giao/bãi dỡ rác; cập nhật tải trọng xe **sau khi có xác nhận phiếu cân/biên nhận** (không tự reset tải xe chỉ vì xe đã vào trạm).
  * **Xử lý sự cố hiện trường:** Cập nhật trạng thái xe hỏng, mất tín hiệu GPS (mất GPS không tự quy chụp là bỏ việc).

### 1.2. DEV 2: Ticket Engine, Route Optimization & Dispatcher Dashboard
* **Phạm vi nghiệp vụ (Trang 01, 02, 03, 04, 06, 07):**
  * **Ticket Lifecycle Engine (Trang 06):** Quản lý 6 trạng thái phiếu việc:
    `Chờ lập kế hoạch` $\rightarrow$ `Chờ duyệt` $\rightarrow$ `Đã giao` $\rightarrow$ `Đang thực hiện` $\rightarrow$ `Chờ nghiệm thu` $\rightarrow$ `Hoàn thành` + `Xử lý ngoại lệ`.
  * **Cơ chế chống trùng phiếu (Trang 02):** Gộp cảnh báo cùng thùng/loại việc vào phiếu đang mở, bảo toàn lịch sử sự kiện.
  * **Điều phối & Tối ưu tuyến (Trang 03, 07):** Giao diện Điều phối viên (Dispatcher Hub), tích hợp bộ tối ưu tuyến đường (OR-Tools / VRP Solver), quản lý phân công theo phiên bản kế hoạch (versioning).
  * **Nghiệm thu tại điểm (Trang 04):** Đối chiếu bằng chứng hình ảnh trước/sau gom, kiểm tra số đo cảm biến ổn định sau thu gom, xét duyệt ngoại lệ.

### 1.3. DEV 3: Citizen Portal, Billing Automation & Bulky Waste Service
* **Phạm vi nghiệp vụ (Trang 08, 09, 10, 11, 12, 13):**
  * **Cổng Cư Dân (Citizen App - Trang 08):** Hồ sơ gia đình theo mã thùng/mã hợp đồng, tra cứu lịch thu gom, theo dõi xe đến, gửi phản ánh chất lượng (bỏ sót rác, thùng hỏng).
  * **Thu phí định kỳ hàng tháng (Trang 09):** Tự động tạo bảng kê, tích hợp cổng thanh toán (MoMo/QR/trích tiền tự động), đối soát giao dịch, chống ghi nhận trùng.
  * **Xử lý nợ & Ngừng dịch vụ an toàn (Trang 10):** Lịch nhắc nợ (D, D+3, D+7, D+14), luồng xét duyệt tạm ngừng thu gom có thẩm quyền (**hệ thống không tự ý chặn thu gom**, cảm biến IoT vẫn chạy giám sát môi trường).
  * **Dịch vụ Rác Cồng Kềnh Trả Trước (Trang 11, 12):** Đặt thu sofa/nệm/tủ; AI nhận diện ảnh; tính phí theo bảng giá có phiên bản; kiểm tra xe/nhân lực & giữ chỗ có thời hạn; thanh toán trả trước mới xác nhận đơn.

---

## 2. RANH GIỚI THƯ MỤC & QUYỀN HẠN FILE (FOLDER OWNERSHIP)

Để **triệt tiêu 100% khả năng merge conflict**, mỗi developer chỉ làm việc trong thư mục được phân quyền:

| Developer | Thư mục Độc quyền (Được toàn quyền tạo mới/sửa) | Thư mục CẤM chạm vào nếu không thảo luận |
|---|---|---|
| **DEV 1** | `src/modules/fleet/`<br>`src/modules/iot-bins/`<br>`src/store/fleet/`<br>`src/store/bins/` | `src/modules/tickets/`, `src/modules/citizen/`, `src/modules/billing/` |
| **DEV 2** | `src/modules/tickets/`<br>`src/modules/dispatch/`<br>`src/modules/routing/`<br>`src/store/tickets/`<br>`src/store/dispatch/` | `src/modules/fleet/`, `src/modules/citizen/`, `src/modules/billing/` |
| **DEV 3** | `src/modules/citizen/`<br>`src/modules/billing/`<br>`src/modules/bulky/`<br>`src/store/citizen/`<br>`src/store/billing/` | `src/modules/fleet/`, `src/modules/tickets/`, `src/modules/dispatch/` |
| **TẤT CẢ** | `src/contracts/` *(Chỉ sửa khi có sự đồng thuận cả 3)* | `src/Navigation.jsx`, `src/store/index.js`, `package.json` *(Tuân thủ quy tắc mục 4 & 6)* |

---

## 3. GIAO ƯỚC DỮ LIỆU CHUNG (SHARED CONTRACTS / INTERFACES)

Trước khi code độc lập, cả 3 Dev tuân thủ các Schema chuẩn đặt tại `src/contracts/`:

### 3.1. Trạng thái Phiếu Việc (`src/contracts/ticketStatus.js`)
```javascript
export const TICKET_STATUS = {
  PENDING_PLAN: 'PENDING_PLAN',         // Chờ lập kế hoạch
  AWAITING_APPROVAL: 'AWAITING_APPROVAL', // Chờ duyệt phương án
  ASSIGNED: 'ASSIGNED',                 // Đã giao (chờ tài xế nhận việc)
  IN_PROGRESS: 'IN_PROGRESS',           // Đang thực hiện
  AWAITING_INSPECTION: 'AWAITING_INSPECTION', // Chờ nghiệm thu (đã gửi ảnh/bằng chứng)
  COMPLETED: 'COMPLETED',               // Hoàn thành
  EXCEPTION: 'EXCEPTION',               // Ngoại lệ (xe hỏng, từ chối việc, hẻm tắc)
};
```

### 3.2. Cấu trúc Đối tượng Nghiệp vụ cốt lõi
* **Bin Telemetry (DEV 1 $\rightarrow$ DEV 2):**
  `{ binId, householdId, fillLevel, odorLevel, battery, lastSeen, lat, lng, isSensorFault }`
* **Vehicle State (DEV 1 $\rightarrow$ DEV 2):**
  `{ vehicleId, driverId, currentCapacityKg, maxCapacityKg, lat, lng, status: 'IDLE'|'EN_ROUTE'|'COLLECTING'|'UNLOADING' }`
* **Bulky Waste Order (DEV 3 $\rightarrow$ DEV 2):**
  `{ orderId, householdId, itemType, estimatedVol, price, isPaid, pickupDate, address, lat, lng }`
* **Service Status (DEV 3 $\rightarrow$ DEV 2):**
  `{ householdId, serviceActive: boolean, debtDays: number, suspendedReason: string }`

---

## 4. KIẾN TRÚC CHỐNG XUNG ĐỘT (ZERO-CONFLICT MODULAR ARCHITECTURE)

### 4.1. Không sửa trực tiếp `src/Navigation.jsx`
* Thay vì mỗi người thêm `<Route>` trực tiếp vào file `Navigation.jsx`, sử dụng **Module Route Registry**:
  * Mỗi module tự tạo file: `src/modules/<module_name>/routes.jsx`
  * Một file cầu nối duy nhất: `src/modules/moduleRoutes.js` tổng hợp các route này.
  * Khi merge, file `Navigation.jsx` chỉ cần đọc mảng từ `moduleRoutes.js`.

### 4.2. Không sửa trực tiếp `src/store/index.js`
* Thay vì mỗi người import reducer vào `src/store/index.js`, sử dụng **Modular Reducers**:
  * Mỗi module tự tạo reducer riêng trong thư mục của mình.
  * Gom đăng ký tại `src/store/moduleReducers.js`.

---

## 5. QUY CHUẨN GIT & CHIẾN LƯỢC NHÁNH (GIT BRANCHING & MERGE STRATEGY)

### 5.1. Quy tắc Đặt tên Nhánh (Branch Naming)
Mọi dev tạo nhánh từ nhánh `main` mới nhất:
* Dev 1: `feat/dev1-iot-fleet-tracking`
* Dev 2: `feat/dev2-ticket-dispatch-routing`
* Dev 3: `feat/dev3-citizen-billing-bulky`
* Nhánh sửa lỗi phát sinh: `fix/<issue-name>-dev<X>`

### 5.2. Quy tắc Commit Message (Conventional Commits)
* `feat(fleet): add traccar socket listener for geofence entry`
* `feat(ticket): implement 6-state lifecycle transition machine`
* `feat(billing): add momo recurring payment webhook handler`
* `fix(bulky): correct pricing calculation formula for elevator access`

### 5.3. Quy trình Đồng bộ Hàng ngày (Daily Syncing)
Mỗi ngày trước khi bắt đầu code và trước khi tạo PR, dev bắt buộc rebase code mới từ `main`:
```bash
git checkout main
git pull origin main
git checkout feat/<your-branch>
git rebase main
```
> [!IMPORTANT]
> **Tuyệt đối KHÔNG dùng `git merge main` vào nhánh tính năng.** Hãy dùng `git rebase main` để giữ cây commit sạch và tuyến tính, tránh các commit rác `Merge branch 'main' into ...`.

### 5.4. Thứ tự Merge vào Main (Merge Sequence)
Để việc hợp nhất diễn ra mượt mà nhất, team tuân thủ thứ tự sau:

1. **Giai đoạn 0 (Sprint Setup):** Tạo PR chung cho `src/contracts/` và khung module rỗng. Merge vào `main` trước.
2. **Giai đoạn 1 (PR 1):** `DEV 1` merge trước (Nền tảng dữ liệu IoT & bản đồ Fleet).
3. **Giai đoạn 2 (PR 2):** `DEV 2` rebase `main` mới nhất $\rightarrow$ merge (Bộ điều phối & Phiếu việc sử dụng dữ liệu xe của DEV 1).
4. **Giai đoạn 3 (PR 3):** `DEV 3` rebase `main` mới nhất $\rightarrow$ merge (Cổng công dân kết nối đơn cồng kềnh vào luồng của DEV 2).

---

## 6. QUY TẮC QUẢN LÝ DEPENDENCIES (package.json & lockfile)

Xung đột `package-lock.json` là nguyên nhân hàng đầu gây hỏng build khi merge song song.
1. **Trước khi cài thêm thư viện:** Bắt buộc thảo luận trước với cả nhóm.
2. **Nếu cần cài thư viện mới:**
   * Dev thông báo cho nhóm.
   * Cài đặt bằng `npm install <package>`.
   * Tạo một PR nhỏ độc lập chỉ gồm `package.json` và `package-lock.json` để merge vào `main` trước, sau đó 2 dev còn lại `git pull` và `npm install` về.

---

## 7. CHECKLIST TRƯỚC KHI TẠO PULL REQUEST (PR CHECKLIST)

Trước khi bấm "Create Pull Request", mỗi developer phải tự kiểm tra các tiêu chí sau:

- [ ] **1. Không vi phạm ranh giới thư mục:** Không có file nào ngoài phạm vi module được chỉ định bị chỉnh sửa.
- [ ] **2. Rebase sạch sẽ:** Nhánh tính năng đã được `rebase` trên bản mới nhất của `origin/main`.
- [ ] **3. Linting Passed:** Chạy lệnh sau không có lỗi:
  ```bash
  npm run lint
  ```
- [ ] **4. Build Passed:** Chạy lệnh build kiểm tra không có lỗi bundle:
  ```bash
  npm run build
  ```
- [ ] **5. Nghiệp vụ khớp tài liệu PDF:**
  - Dev 1: Không suy tải xe từ GPS; chỉ cập nhật khi có phiếu cân/biên nhận.
  - Dev 2: Đủ 6 trạng thái phiếu việc; mất cảm biến không được tự ý xóa phiếu.
  - Dev 3: Bảng kê tháng tách riêng đơn rác cồng kềnh; nợ tiền không tự ngắt dịch vụ và cảm biến vẫn đo.
- [ ] **6. Không commit file rác:** Không commit `.env`, log, hay file sinh tạm thời.
