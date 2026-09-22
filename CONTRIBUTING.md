# Quy Chuẩn Đóng Góp Mã Nguồn NaN-EcoNet (Contributing Guidelines)

Chào mừng bạn đến với **NaN-EcoNet**! Chúng tôi trân trọng mọi đóng góp của cộng đồng, từ việc sửa lỗi nhỏ, bổ sung tài liệu đến việc phát triển các tính năng chiến lược mới cho hệ sinh thái tuần hoàn xanh và logistics rác thải thông minh.

Tài liệu này quy định chi tiết quy trình phát triển, quy ước phân nhánh, chuẩn viết commit và thủ tục mở Pull Request trên cấu trúc Monorepo của dự án.

---

## 🏛️ 1. Cấu Trúc Monorepo

Hệ sinh thái NaN-EcoNet được tổ chức theo mô hình Monorepo tại thư mục `apps/`, bao gồm 3 phân hệ chính:

```
NaN-EcoNet/
├── apps/
│   ├── smart-collection-engine/    # [Phân hệ 1] Lõi tối ưu hóa tuyến đường & Logistics
│   │   ├── backend/                # FastAPI dispatching service & VRP API
│   │   ├── src/                    # Thuật toán 3D-PACO, OR-Tools CVRPTW & C++ solver
│   │   ├── streamlit/              # Analytics Dashboard, ESG metrics & convergence graphs
│   │   └── map_ui/                 # Giao diện bản đồ tương tác điều phối (MapLibre GL)
│   │
│   ├── ecopass-enterprise/         # [Phân hệ 2] Nền tảng kinh tế tuần hoàn 4-Win
│   │   ├── ecopass/                # Waste-to-Reward webapps (Client Scanner, Brand Portal, Cashier POS)
│   │   ├── enterprise-bi-copilot/  # Trợ lý MCP BI Copilot & phân tích kinh doanh thời gian thực
│   │   ├── agy-image-gateway/      # Proxy điều phối API thị giác AI đa nhà cung cấp
│   │   ├── awesome-gpt-image-2/    # Studio thiết kế prompt phong cách công nghiệp
│   │   └── nan-team/               # Tự động hóa truyền thông & chiến dịch xanh
│   │
│   └── citizen-bulky-app/          # [Phân hệ 3] Cổng cư dân & Thu gom rác cồng kềnh AI
│       ├── mobile/                 # Ứng dụng di động Flutter đa vai trò (Citizen, Driver, Operator)
│       └── src/                    # Cổng quản trị web & bản đồ điều phối hiện trường
│
├── docs/                           # Tài liệu kỹ thuật, kiến trúc, slide thuyết trình & ADR
├── deploy/                         # Docker compose & k8s manifest triển khai hạ tầng
├── .github/                        # Workflows CI/CD, issue templates & PR templates
├── AGENTS.md                       # Bản đồ tri thức & quy tắc điều hướng cho AI Coding Agents
├── CHANGELOG.md                    # Lịch sử phiên bản theo chuẩn Keep a Changelog
├── CITATION.cff                    # Thông tin trích dẫn học thuật (CFF v1.2.0)
├── CODE_OF_CONDUCT.md              # Quy tắc ứng xử cộng đồng Contributor Covenant 2.1
├── LICENSE                         # Giấy phép mã nguồn mở Apache License 2.0
└── SECURITY.md                     # Chính sách bảo mật & quy trình báo cáo lỗ hổng
```

---

## 🌿 2. Quy Ước Nhánh Git (Branching Model)

Dự án áp dụng mô hình lai giữa **Git Flow** và **Trunk-Based Development** có kiểm soát nghiêm ngặt:

### 2.1. Nhánh Cố Định (Long-lived Branches)
* **`main`**: Nhánh nguồn chân lý (Source of Truth), luôn ở trạng thái sẵn sàng xuất bản (Production-Ready). Chỉ chấp nhận code thông qua Pull Request được review và vượt qua toàn bộ bộ kiểm thử CI.
* **`production`**: Nhánh phản chiếu môi trường triển khai thực tế (Live Deployment), gắn các Git Tag phiên bản (vd: `v1.0.0`).
* **Nhánh phát triển của Core Maintainers**:
  * `dev/chinhan`: Phụ trách Enterprise Architecture, EcoPass Platform, MCP Server & Monorepo Integration.
  * `dev/congnghip`: Phụ trách Smart Collection Engine, 3D-PACO Algorithm & VRP Solver.
  * `dev/quocanh`: Phụ trách Citizen Bulky App, Flutter Mobile, AI Vision Scanner & Live Pricing.

### 2.2. Nhánh Tính Năng & Sửa Lỗi (Short-lived Branches)
Khi phát triển tính năng hoặc sửa lỗi, hãy tạo nhánh mới từ nhánh phát triển phù hợp hoặc từ `main`:
* Tính năng mới: `feat/<app-name>-<tên-ngắn-gọn>` (ví dụ: `feat/bulky-tolerance-guarantee`, `feat/engine-paco-threads`)
* Sửa lỗi: `fix/<app-name>-<mô-tả-lỗi>` (ví dụ: `fix/mobile-modal-overflow`, `fix/bi-mcp-stream-timeout`)
* Tài liệu: `docs/<phân-hệ-cập-nhật>` (ví dụ: `docs/adr-002-gemini-vision`)
* Tối ưu hiệu năng: `perf/<tên-module>` (ví dụ: `perf/vrp-matrix-cache`)
* Tái cấu trúc: `refactor/<module>` (ví dụ: `refactor/voucher-ledger-sqlite`)

---

## 📝 3. Quy Chuẩn Conventional Commits

Mọi commit bắt buộc tuân thủ chuẩn **Conventional Commits v1.0.0**:

```
<type>(<scope>): <mô tả ngắn bằng tiếng Việt hoặc tiếng Anh>

[Tùy chọn: Mô tả chi tiết lý do thay đổi và giải pháp kỹ thuật]

[Tùy chọn: Footer ghi mã Issue liên quan, ví dụ: Closes #42 hoặc BREAKING CHANGE: ...]
```

### 3.1. Các Loại Commit (`type`)
* `feat`: Tính năng mới cho người dùng hoặc API.
* `fix`: Sửa lỗi phần mềm hoặc xử lý ngoại lệ.
* `docs`: Cập nhật tài liệu kỹ thuật, docstring, markdown.
* `refactor`: Tái cấu trúc mã nguồn mà không làm thay đổi hành vi nghiệp vụ.
* `perf`: Nâng cao hiệu năng thực thi hoặc tiết kiệm bộ nhớ.
* `test`: Thêm mới hoặc chuẩn hóa bộ kiểm thử tự động (Unit, Integration, E2E).
* `chore`: Thay đổi cấu hình build, dependencies, tooling không ảnh hưởng mã nguồn.
* `ci`: Chỉnh sửa cấu hình CI/CD GitHub Actions hoặc pipeline tự động.

### 3.2. Phạm Vi Commit (`scope`)
Chỉ định rõ phân hệ chịu tác động:
* `engine` / `vrp` / `paco` / `solver` : Phân hệ Smart Collection Engine.
* `mobile` / `bulky` / `citizen` : Phân hệ Citizen Bulky Mobile App.
* `ecopass` / `voucher` / `brand` : Nền tảng tuần hoàn quà tặng EcoPass.
* `bi` / `mcp` : Phân hệ Enterprise BI Copilot qua Model Context Protocol.
* `gateway` / `vision` : Cổng AI Gateway hoặc Gemini Flash Vision Scanner.
* `monorepo` / `deploy` / `docs` : Thay đổi cấp độ toàn dự án.

### 3.3. Ví Dụ Commit Chuẩn
```bash
# Tiếng Việt
feat(mobile): bổ sung đồng hồ đếm ngược 15 phút giữ chỗ đơn thu gom cồng kềnh
fix(engine): khắc phục lỗi deadlock khi khởi tạo ma trận khoảng cách OSRM song song
docs(adr): hoàn thiện hồ sơ ADR-001 về tích hợp 3D-PACO và Google OR-Tools

# Tiếng Anh
feat(mcp): implement real-time streaming tools for ESG voucher analytics
fix(bulky): resolve modal bottom sheet unbounded height freeze in Flutter UI
perf(paco): vectorize pheromone matrix evaporation using NumPy BLAS
```

---

## 🧪 4. Hướng Dẫn Chạy Kiểm Thử Cục Bộ (Local Testing)

Trước khi gửi commit và mở PR, bạn phải đảm bảo tất cả kiểm thử liên quan đều vượt qua tại môi trường máy phát triển cục bộ:

### 4.1. Phân hệ Smart Collection Engine (Python / C++)
```bash
cd apps/smart-collection-engine/backend

# Chạy xác minh tính toàn vẹn của VRP API
python verify_implementation.py

# Chạy kiểm thử đơn vị với pytest
pytest -v

# Kiểm tra cú pháp và định dạng mã nguồn Python
ruff check .
ruff format --check .
```

### 4.2. Phân hệ Citizen Bulky App (Flutter / Dart)
```bash
cd apps/citizen-bulky-app/mobile

# Phân tích cú pháp tĩnh Dart/Flutter
flutter analyze

# Chạy toàn bộ bộ kiểm thử widget và luồng nghiệp vụ
flutter test
```

### 4.3. Phân hệ EcoPass & BI Copilot (Node.js / TypeScript)
```bash
cd apps/ecopass-enterprise/enterprise-bi-copilot

# Cài đặt phụ thuộc với pnpm
pnpm install

# Kiểm tra lỗi biên dịch TypeScript
pnpm tsc --noEmit

# Chạy kiểm thử tự động với Vitest
pnpm test
```

---

## 🚀 5. Quy Trình Mở Pull Request (PR Workflow)

1. **Đồng bộ nhánh cục bộ**: Luôn rebase hoặc pull code mới nhất từ nhánh đích trước khi đẩy code (`git pull --rebase origin main`).
2. **Kiểm tra Secret & Bảo Mật**: Tuyệt đối không commit file `.env`, API Keys (Google Gemini API, Mapbox, Supabase, JWT secret, v.v.). Chạy rà soát bảo mật trước khi commit.
3. **Mở Pull Request**:
   * Đặt tiêu đề rõ ràng theo chuẩn Conventional Commits (ví dụ: `feat(engine): add dynamic fleet capacity constraint to 3D-PACO`).
   * Điền đầy đủ thông tin vào mẫu [`.github/pull_request_template.md`](file:///home/chinhan/NaN-EcoNet/.github/pull_request_template.md).
   * Đính kèm hình ảnh hoặc video ngắn minh họa nếu có thay đổi giao diện (UI/UX).
4. **Quy tắc Kiểm Duyệt (Code Review Policy)**:
   * Mỗi PR cần ít nhất **1 Core Maintainer phê duyệt (Approved)** trước khi gộp code.
   * Tất cả kiểm tra tự động trên GitHub Actions (Lint, Test, Docker Build) phải có trạng thái **Green (Passed)**.
   * Áp dụng phương thức **Squash and Merge** hoặc **Rebase and Merge** để giữ lịch sử git gọn gàng, liền mạch.

---

## 🤝 6. Cam Kết Bản Quyền & Giấy Phép (License & CLA)

Khi gửi mã nguồn đóng góp vào NaN-EcoNet:
* Bạn đồng ý rằng toàn bộ mã nguồn của bạn được cấp phép dưới điều khoản của [Apache License, Version 2.0](file:///home/chinhan/NaN-EcoNet/LICENSE).
* Bạn xác nhận rằng đóng góp là do chính bạn tạo ra hoặc bạn có toàn quyền pháp lý để cấp phép theo tiêu chuẩn nguồn mở.

Cảm ơn bạn đã đồng hành kiến tạo hệ sinh thái số vì một Việt Nam xanh và thông minh hơn!
