# 🌐 Codex ChatGPT Web — Responses API Bridge & MCP Server

> Cầu nối cục bộ hiệu năng cao kết nối trực tiếp phiên ChatGPT Web (kể cả gói Plus / Pro) với môi trường coding agent Codex và giao thức Model Context Protocol (MCP) trong hệ sinh thái **NaN-EcoNet**.

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <strong>Tiếng Việt</strong>
</p>

---

## 📌 Giới Thiệu & Ưu Điểm Nổi Bật

`codex-chatgpt-web` cho phép bạn sử dụng toàn bộ sức mạnh của các mô hình hàng đầu trên ChatGPT Web (bao gồm các chế độ suy luận chuyên sâu như **o1**, **o3-mini**, **GPT-4o**, **Canvas**, **Thinking**, và **Pro**) trực tiếp bên trong các agent lập trình (Codex, Antigravity, Claude Code, Cursor, OpenClaw) thông qua giao thức MCP:

1. **Không Tốn Quota API Trả Phí**: Tận dụng trực tiếp gói đăng ký ChatGPT Web cá nhân (Free / Plus / Pro / Team).
2. **Turn Broker & Streaming Mượt Mà**: Đồng bộ lượt hội thoại thời gian thực, truyền nhận stream phản hồi ổn định.
3. **Bigger Context & Compaction Tự Động**: Cơ chế nén ngữ cảnh thông minh, tự động gọt dũa lịch sử hội thoại khi context quá dài mà vẫn bảo toàn các checkpoint quan trọng.
4. **Playwright Browser Automation Tự Động**: Quản lý trình duyệt headless / headed, tự động vượt qua challenge kiểm tra phiên và khôi phục khi ngắt kết nối.
5. **Giao Diện Điều Khiển Đa Năng**: Hỗ trợ cả Desktop Launcher UI (Electron/Vite) lẫn CLI dev tương tác trực tiếp (`dev:chat`).

---

## 🏗️ Cấu Trúc Mã Nguồn

```text
codex-chatgpt-web/
├── src/
│   ├── adapters/
│   │   └── chatgpt-web/      # Bộ chuyển đổi ChatGPT Web (browser-worker, prompt, turn-broker, mcp-main)
│   ├── dev-chat/             # Giao diện dòng lệnh trò chuyện tương tác (cli, session, driver)
│   ├── responses/            # Schema phân giải định dạng phản hồi Responses API
│   ├── cli.ts                # Entrypoint lệnh CLI chính
│   └── bridge.ts             # Khởi tạo cầu nối giữa Codex và Web session
├── launcher/                 # Ứng dụng Desktop điều khiển GUI (Electron, React, Vite)
├── scripts/                  # Script build runtime bundle, smoke test, setup
├── tests/                    # 80+ file kiểm thử đơn vị & tích hợp (hơn 1100 bài test)
└── package.json              # Khai báo script và dependencies quản lý bằng Bun
```

---

## ⚡ Hướng Dẫn Cài Đặt & Sử Dụng

### 1. Yêu cầu môi trường
- **Bun**: v1.4+ (`curl -fsSL https://bun.sh/install | bash`)
- **Node.js**: v20+
- **Playwright / Chromium**: Để chạy browser worker

### 2. Cài đặt thư viện
```bash
cd codex-chatgpt-web
bun install
```

### 3. Các lệnh khởi chạy chính

| Lệnh | Ý nghĩa |
|---|---|
| `bun run dev:launcher` | Khởi chạy giao diện Launcher Desktop để cấu hình tài khoản & mô hình trực quan |
| `bun run dev:chat` | Mở CLI tương tác hỏi đáp trực tiếp với ChatGPT Web ngay trên terminal |
| `bun run start` | Khởi chạy background server Responses API bridge (cổng mặc định) |
| `bun run doctor` | Kiểm tra tính toàn vẹn của runtime, kết nối trình duyệt và phiên ChatGPT |
| `bun run test` | Chạy bộ kiểm thử tự động toàn diện |
| `bun test tests/cli.test.ts tests/prompt-contract.test.ts` | Chạy nhanh các bài kiểm tra giao tiếp CLI và hợp đồng prompt |

### 4. Tích hợp MCP vào Agent Lập Trình (Codex / Antigravity / Claude Code)

Thêm cấu hình MCP Server vào file cấu hình của agent (ví dụ `mcp.json` hoặc cấu hình Claude/Codex):

```json
{
  "mcpServers": {
    "chatgpt-web": {
      "command": "bun",
      "args": ["run", "/đường_dẫn_tới/codex-chatgpt-web/src/cli.ts", "serve"]
    }
  }
}
```

---

## 🔧 Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Phiên đăng nhập hết hạn (Session Expired / Cloudflare Challenge)**:
   - Chạy `bun run dev:launcher`, mở trình duyệt nhúng và hoàn thành đăng nhập tài khoản OpenAI.
   - Hoặc chạy `bun run doctor` để kiểm tra trạng thái xác thực.

2. **Lỗi hết hạn thời gian phản hồi (Turn Timeout / Upstream Stall)**:
   - Đối với các bài toán yêu cầu suy luận nặng (Pro / Extra High reasoning), thời gian suy nghĩ có thể kéo dài.
   - Hệ thống đã tích hợp sẵn cơ chế heartbeat giữ phiên sống và thông báo tiến trình định kỳ.

3. **Xung đột cổng hoặc tiến trình mồ côi**:
   - Sử dụng lệnh `bun run clean` để dọn dẹp các tiến trình trình duyệt và file runtime socket cũ trước khi khởi động lại.

---

## 📄 Bản Quyền (License)

Dự án phát hành theo giấy phép [MIT License](LICENSE).
