# AI Video Studio — triển khai và kiểm chứng

## Phạm vi

Năm agent đã thực hiện năm phạm vi độc lập: engine/composition, TTS,
storyboard/AGY, backend và frontend. Integration owner ghép thay đổi và kiểm thử.
Các bản sao làm việc nằm trong `/tmp/nan-video-agents-20260928/`.
Giới hạn chạy đồng thời là ba agent con, nên năm agent chạy thành hai đợt.

## Luồng thực tế

1. Trong Agent, chọn **Tạo Video AI**, nhập chủ đề, chọn 15/30/60 giây và giọng Việt.
2. Tải ảnh mồi hoặc để AI sinh toàn bộ ảnh.
3. Backend gọi **AGY CLI gateway** để viết JSON storyboard và sinh ảnh.
   Ảnh mồi được phân tích bằng vision, giữ nguyên làm cảnh đầu;
   Visual DNA được thêm vào mọi prompt sinh ảnh.
4. Chỉnh lời thoại, từ khóa, mô tả ảnh; nghe thử giọng hoặc vẽ lại ảnh.
5. Edge TTS cung cấp giọng và word boundaries. FFmpeg điều chỉnh tốc độ trong
   giới hạn 0.85–1.25, bổ sung khoảng nghỉ; tổng thời lượng là đúng số frame.
   Lời thoại quá dài bị từ chối thay vì cắt mất nội dung.
6. Remotion render 1080×1920, 30 FPS, H.264, YUV420P, BT.709, AAC 48 kHz;
   có Ken Burns, phụ đề từng từ và nhạc nền tự tạo giảm âm lượng khi có lời đọc.
7. `ffprobe` kiểm tra file trước khi lưu qua storage hiện có và bảng Media.
   Studio hiển thị video thật và cho phép đính kèm vào composer của Agent.

## Điều chỉnh so với bản kế hoạch ban đầu

- **Edge TTS cần mạng** tới dịch vụ Microsoft; không cần API key trả phí.
  Render và xử lý audio chạy local. Không gọi phần này là 100% offline.
- Nội dung và ảnh sử dụng AGY gateway theo yêu cầu của người dùng, không dùng
  OpenAI hoặc bộ sinh ảnh trả phí cũ của Postiz.
- Remotion dùng bản 4.0.529, khởi tạo bằng `create-video` template blank.
  Word captions dùng boundary thật của Edge TTS và component riêng.
- MP4 lưu qua UploadFactory/MediaRepository, tuân theo storage đang cấu hình;
  không cố định đường dẫn `apps/backend/uploads`.
- Nút Studio nằm trong `agent.tsx` → `MultiMediaComponent`; đây là toolbar
  thực tế của Agent. Không cần sửa `agent.chat.tsx` để mở modal.
- Job ID trả ngay; frontend poll tiến độ, retry kết nối và hỗ trợ hủy.
  Backend giới hạn concurrency, tenant ownership, URL nguồn và kích thước file.
   AGY response 5xx được retry tối đa ba lần với cùng prompt trong cùng khóa
   tuần tự; lỗi kết nối, timeout và lỗi 4xx không tự gửi lại.
- Chủ đề demo: **Một buổi sáng xanh ở Sài Gòn**, 30 giây, 5 cảnh;
  thay cho ví dụ Hutech trong kế hoạch.
- Kiểm thử scheduling gọi tool hiện có với boundary được mock, kiểm tra MP4
  truyền đúng tới createPost và link `/launches`. Không phải bằng chứng đã đăng
  hoặc lên lịch một bài thật trên mạng xã hội.

## Cài đặt và chạy

Backend cần Python có `edge-tts`, FFmpeg/ffprobe và Chrome/Chromium.
Từ thư mục dự án:

```bash
pnpm video:setup
pnpm video:typecheck
pnpm test:ai-video
pnpm exec tsc --noEmit --incremental false -p apps/backend/tsconfig.json
pnpm exec tsc --noEmit --incremental false -p apps/frontend/tsconfig.json
```

AGY gateway mặc định `http://127.0.0.1:8080`; có thể đặt
`AGY_IMAGE_GATEWAY_URL`. Backend tìm engine từ thư mục cha hoặc
`REMOTION_ENGINE_DIRECTORY` tuyệt đối. `REMOTION_BROWSER_EXECUTABLE` chọn Chrome
đã cài. `AI_VIDEO_JOB_DIRECTORY` chọn nơi lưu trạng thái và receipts.

Demo cần backend, frontend, Postgres và AGY gateway đang chạy:

```bash
pnpm video:demo
# Kiểm thử toàn bộ UI thật, bao gồm upload ảnh mồi, voice preview, render và attach:
node scripts/test-video-studio-browser.cjs --live
# Tiếp tục kiểm chứng đúng job hiện có nếu quá trình quan sát bị gián đoạn:
node scripts/test-video-pipeline.cjs --resume-job
```

Lệnh demo sử dụng người dùng local đã kích hoạt và organization hiện có;
không in token hay thay đổi tài khoản. Sinh AI cần dịch vụ gateway đang hoạt động.

## Bằng chứng

| Task | Kết quả và nguồn kiểm chứng |
| --- | --- |
| 1 — Engine | `packages/remotion-engine`, typecheck và bundle/render thực tế |
| 2 — TTS | Unit tests; `agent-tts-validation.json` đo WAV đúng 15/30/60 giây; `inputs-evidence.json` lưu word boundaries |
| 3 — Storyboard | AGY content/image responses, JSON word budget, ảnh mồi giữ ở cảnh đầu; browser gọi API thật |
| 4 — Composition | Ken Burns, phụ đề, keyword phrases, BGM ducking; MP4 và contact sheet đủ năm cảnh |
| 5 — Backend | Tenant/auth/validation/cancel/cleanup tests, job receipts, bảng Media thật và URL MP4 thật |
| 6 — Studio | `browser-verification.json` ghi request thật, mobile viewport, preview, playback và attachment |
| 7 — End-to-end | `verification.json`, ffprobe 900 frame/30 giây/1080×1920, full decode, SHA-256 và completion receipt |

`reports/video-pipeline/` lưu storyboard, responses thật từ gateway,
verification JSON, browser verification, source/input/output receipts,
MP4 và ảnh chụp kiểm tra. SHA-256 nối file đầu ra với input và source engine.
Các kiểm thử unit/contract được phân biệt với API/browser chạy thật.

Runtime local đang dùng Node 24.14.1; manifest dự án yêu cầu Node 22.12–22.x.
Các build/typecheck và kiểm thử được ghi nhận trên runtime local này.

Visual DNA ràng buộc phong cách, nhân vật, màu và trang phục bằng prompt;
không bảo đảm khuôn mặt giống tuyệt đối ở mọi ảnh. Subtitles đồng bộ với
word boundaries của giọng đọc; ảnh tĩnh không có chuyển động miệng.

Không thực hiện `git add`, commit, push hoặc publish trong công việc này.
