# 🚀 Agy Image Gateway Service

Cổng dịch vụ API (REST Gateway) quản lý **Antigravity CLI (`agy`)** để tạo ảnh tự động, hỗ trợ:
1. **Xoay vòng đa tài khoản**: Quản lý và tự động luân phiên 6 tài khoản Antigravity trên máy (kết nối proxy port `8899`, tự failover khi gặp lỗi 429 quota).
2. **Tối ưu Prompt-as-Code**: Tích hợp trực tiếp 22+ bộ templates công nghiệp và style library từ repository **[awesome-gpt-image-2](/home/chinhan/awesome-gpt-image-2)**.
3. **Tự động dọn sạch Session (Auto Clean Session)**: Trích xuất ảnh sang thư mục lưu trữ tĩnh và **xóa sạch toàn bộ thư mục session** trong `~/.gemini/antigravity-cli/brain/<session_id>` ngay sau khi hoàn tất, đảm bảo không rác ổ cứng.
4. **Tương thích Chatbot / Automation Workflow**: Phục vụ ảnh tĩnh qua HTTP URL trực tiếp hoặc Base64, cung cấp OpenAPI Swagger docs tại `/docs` và giao diện Web UI tại `/`.

---

## 📁 Cấu trúc thư mục

```
/home/chinhan/agy-image-gateway/
├── core/
│   ├── account_manager.py   # Quản lý 6 tài khoản & proxy 8899
│   ├── template_engine.py   # Tích hợp templates từ awesome-gpt-image-2
│   └── agy_executor.py      # Gọi agy CLI, copy ảnh, xóa session
├── storage/
│   └── images/              # Nơi lưu trữ ảnh đã tạo phục vụ tĩnh
├── main.py                  # FastAPI Application & Web UI
├── daemon.py                # Quản lý tiến trình chạy ngầm
├── start.sh                 # Khởi động Gateway (Port 8080)
├── stop.sh                  # Dừng Gateway
├── status.sh                # Kiểm tra trạng thái
├── test_client.py           # Script mẫu gọi API & Batch generation
└── README.md
```

---

## ⚡ Bắt đầu nhanh

### 1. Khởi động Service
```bash
/home/chinhan/agy-image-gateway/start.sh
```
* Service chạy ngầm tại: **`http://localhost:8080`**
* Swagger Documentation: **`http://localhost:8080/docs`**
* Web UI Dashboard: **`http://localhost:8080`**

### 2. Kiểm tra trạng thái
```bash
/home/chinhan/agy-image-gateway/status.sh
```

### 3. Dừng Service
```bash
/home/chinhan/agy-image-gateway/stop.sh
```

---

## 📡 API Endpoints

### 1. Sinh ảnh tự động (`POST /v1/images/generate`)

```bash
curl -X POST http://127.0.0.1:8080/v1/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Poster quảng cáo nước tăng lực vị chanh mát lạnh",
    "template_id": "poster-layout-system",
    "aspect_ratio": "3:4",
    "account": "auto"
  }'
```

**Phản hồi mẫu:**
```json
{
  "status": "success",
  "url": "http://127.0.0.1:8080/images/img_9a12c4_1790267000.jpg",
  "filename": "img_9a12c4_1790267000.jpg",
  "aspect_ratio": "3:4",
  "duration_sec": 18.5,
  "session_id": "4d5f8e12-32b1-4091-a159-8812bcfe1023",
  "session_cleaned": true,
  "account_used": "chinhan15102005@gmail.com",
  "original_prompt": "Poster quảng cáo nước tăng lực vị chanh mát lạnh",
  "enhanced_prompt": "Poster quảng cáo nước tăng lực vị chanh mát lạnh Style template: Poster Layout System (Posters & Typography)..."
}
```

### 2. Xem danh sách 6 tài khoản (`GET /v1/accounts`)
```bash
curl http://127.0.0.1:8080/v1/accounts
```

### 3. Đổi tài khoản chủ động (`POST /v1/accounts/switch`)
```bash
curl -X POST http://127.0.0.1:8080/v1/accounts/switch \
  -H "Content-Type: application/json" \
  -d '{"account": "2"}'
```

### 4. Danh sách Templates từ repo (`GET /v1/templates`)
```bash
curl http://127.0.0.1:8080/v1/templates
```

---

## 🤖 Tích hợp vào Chatbot (Python / Node.js)

```python
import requests

def bot_generate_image(user_prompt: str, user_ratio: str = "1:1"):
    response = requests.post("http://127.0.0.1:8080/v1/images/generate", json={
        "prompt": user_prompt,
        "aspect_ratio": user_ratio,
        "account": "auto"
    })
    if response.status_code == 200:
        data = response.json()
        return data["url"] # Gửi link ảnh này trực tiếp vào Telegram/Discord/Zalo
    return None
```
