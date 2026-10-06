# Webhook cho job chỉnh sửa video

`processSourceVideoTool` và request source-video REST/CLI nhận tùy chọn `webhook: { url, secret }`. URL cần là HTTPS công khai, có địa chỉ IPv4 công khai; secret ký cần dài 16–512 ký tự. Đưa secret vào file JSON riêng hoặc secret manager của caller, thay vì tham số dòng lệnh. CLI nhận file qua `--input`; không in cấu hình webhook trong kết quả.

Backend kiểm tra target trước khi tạo job mới. URL và secret được mã hóa AES-256-GCM trong bảng `SourceVideoWebhookDelivery`; chúng không nằm trong input worker, revision input, receipt export hoặc trạng thái trả qua MCP. Backend và orchestrator cần dùng cùng `SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY`; nếu không đặt, khóa được dẫn xuất từ `JWT_SECRET`. Giữ khóa ổn định trong khi còn delivery chưa kết thúc. Migration: `20260930050000_source_video_webhooks`.

Trạng thái terminal của job và payload webhook được ghi cùng transaction, sau khi xuất Media hoặc hoàn thành bù trừ khi lỗi/hủy. Chỉ cấu hình webhook tường minh của job mới được dùng; revision không kế thừa destination/secret của job cha. Request lặp với cùng `idempotencyKey` và cùng nội dung trả lại job đã lưu, kể cả khi callback đang lỗi DNS.

Headers:

- `Content-Type: application/json`
- `User-Agent: OpenShorts-Webhook/1.0`
- `X-OpenShorts-Signature`: HMAC-SHA256, dạng hex chữ thường, tính trên **đúng bytes UTF-8 của body nhận được**.
- `X-OpenShorts-Event-Id`: job ID ổn định, dùng để chống xử lý lặp ở receiver.

Payload tương thích contract OpenShorts:

```json
{"event":"job.completed","job_id":"JOB_ID","status":"completed","clips":[{"index":0,"title":"Tiêu đề","video_url":"SAVED_MEDIA_URL","duration":4.8}]}
```

Job failed/cancelled dùng `event: "job.failed"`, giữ `status` thực tế và `clips: []`. Trường `error` là thông báo chung; chi tiết xử lý được đọc qua status có xác thực. Không gửi log nội bộ hoặc credential trong error.

Receiver phải xác minh chữ ký trên raw body trước khi parse JSON. Ví dụ Node.js:

```js
function validSignature(rawBody, signature, secret) {
  const { createHmac, timingSafeEqual } = require('node:crypto');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const actual = Buffer.from(signature || '', 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

Lưu event ID đã xử lý trong kho bền vững của receiver trước khi trả 2xx. Nếu receiver nhận thành công nhưng sender chết trước khi lưu acknowledgement, cùng body/signature/event ID có thể được gửi lại. Đây là delivery có thể lặp; không có bảo đảm mỗi event chỉ đến một lần.

Dispatcher lưu mọi lượt trong database, tối đa ba lượt nhận lease; lượt đầu ngay khi terminal, các lượt tiếp theo cách lần thất bại trước 5 và 30 giây. Timeout mỗi lượt là 15 giây; lease hết hạn sau 30 giây. Lượt đã nhận lease nhưng bị restart trước khi gửi cũng tiêu tốn một lượt. Sau khi hết lượt, trạng thái `exhausted` được giữ để kiểm tra. URL bị chặn hoặc khóa mã hóa không đọc được kết thúc delivery với error code tương ứng; lỗi DNS tạm thời/network/HTTP được retry. Chỉ 2xx là thành công; không theo redirect. Kiểm tra IP được lặp lại ở lúc kết nối và không bị tắt bởi `DISABLE_SSRF_PROTECTION`.

`sourceVideoStatusTool` trả phần `webhook` với status/attempts/nextAttemptAt/lastStatusCode/lastError/deliveredAt; không trả target hoặc secret. Backend và orchestrator có thể cùng chạy dispatcher, nhưng mỗi lượt có owner/epoch/lease trong DB và owner cũ không thể acknowledge lượt mới.

Bằng chứng local: `live-webhook-process-restart.json` dùng code đã build và receiver loopback chỉ trong test script, kiểm tra 503 → SIGKILL sau receiver accept → process mới giao thành công với cùng chữ ký/event ID. Test fixture đẩy thời gian retry/lease để tránh chờ; kiểm tra production HTTPS, DNS đổi địa chỉ và URL bị chặn được chạy riêng. Receipt này không phải bằng chứng delivery tới một receiver bên ngoài đã cấu hình.
