## 📌 Mục Tiêu Thay Đổi (PR Overview)
<!-- Tóm tắt ngắn gọn mục đích của Pull Request này (giải quyết bài toán gì, thêm tính năng nào, hoặc sửa lỗi gì). -->

* **Phân hệ liên quan**:
  - [ ] `apps/smart-collection-engine` (3D-PACO / OR-Tools / OSRM / VRP)
  - [ ] `apps/citizen-bulky-app` (Flutter Mobile / Gemini Vision / Live Pricing)
  - [ ] `apps/ecopass-enterprise` (EcoPass / Web Portals / 1-Time Burn QR)
  - [ ] `apps/ecopass-enterprise/enterprise-bi-copilot` (MCP Server / BI Analytics)
  - [ ] `deploy` / `docs` / `.github` (Hạ tầng, tài liệu & CI/CD)

* **Mã Issue liên quan**: Closes # <!-- ví dụ: Closes #123 -->

---

## 🛠️ Chi Tiết Kỹ Thuật (Technical Implementation)
<!-- Mô tả tóm tắt giải pháp kỹ thuật, thuật toán hoặc các file chính bị thay đổi -->

- 
- 
- 

---

## 📸 Bằng Chứng Thử Nghiệm (Testing & Validation Evidence)
<!-- Bắt buộc cung cấp bằng chứng cho thấy mã nguồn đã được kiểm thử thành công trước khi gửi PR -->

- [ ] Lệnh kiểm thử đã chạy tại máy cục bộ (Local terminal output):
  ```bash
  # Dán kết quả chạy test tại đây (pytest, flutter test, pnpm test)
  ```
- [ ] Ảnh chụp màn hình hoặc GIF minh họa giao diện (nếu có thay đổi UI/UX):
  <!-- Kéo thả ảnh vào đây -->

---

## 📋 Danh Sách Kiểm Tra Chuẩn (PR Checklist)
Vui lòng đánh dấu vào tất cả các ô dưới đây trước khi yêu cầu Reviewer phê duyệt:

- [ ] **Quy chuẩn mã nguồn**: Mã nguồn tuân thủ phong cách lập trình của dự án (đã chạy `ruff`, `flutter analyze` hoặc `pnpm lint`).
- [ ] **Kiểm thử tự động**: Đã bổ sung Unit Test hoặc Integration Test tương ứng và toàn bộ test đều đạt (Passed).
- [ ] **Tài liệu hóa**: Đã cập nhật tài liệu liên quan (`README.md`, `AGENTS.md`, hoặc viết mới `ADR` nếu thay đổi kiến trúc lớn).
- [ ] **Bảo mật bí mật**: Đã kiểm tra kỹ lưỡng và cam kết **KHÔNG CÓ** file `.env`, mật khẩu, Private Key hay API Key nào bị commit.
- [ ] **Chủ quyền bản đồ**: Tuyệt đối không sử dụng hoặc tích hợp bất kỳ nguồn bản đồ/dữ liệu địa lý nào vi phạm chủ quyền lãnh thổ quốc gia.
- [ ] **Chuẩn Commit**: Toàn bộ commit tuân thủ quy tắc Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`).
- [ ] **Lịch sử Git**: Nhánh sạch sẽ (Clean Git Diff), không chứa commit rác hay file tạm (`.DS_Store`, `node_modules`, `build/`).
