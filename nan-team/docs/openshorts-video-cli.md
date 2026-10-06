# Video CLI qua MCP của NaN-Team

CLI gọi cùng các tool có xác thực mà agent video sử dụng, qua AGY MCP ở backend. Hai luồng là `generate` (ý tưởng → storyboard/ảnh/giọng đọc/video) và `process` (video đã có → phân tích/cắt/chỉnh/video). Không cần khởi động frontend để renderer đọc ảnh trong kho local.

Đặt `NAN_MCP_URL` và `NAN_MCP_TOKEN` trong môi trường riêng của terminal hoặc secret manager. CLI không nhận credential trong URL/tham số dòng lệnh và không ghi credential vào report. HTTP chỉ được dùng với localhost; server từ xa cần HTTPS.

```bash
node packages/openshorts-engine/bin/nan-video.cjs capabilities
node packages/openshorts-engine/bin/nan-video.cjs process --input /absolute/source-request.json --watch
node packages/openshorts-engine/bin/nan-video.cjs process --file /absolute/source.mp4 --input /absolute/edit-request.json --watch
node packages/openshorts-engine/bin/nan-video.cjs generate --input /absolute/idea-request.json --watch
node packages/openshorts-engine/bin/nan-video.cjs status JOB_ID
node packages/openshorts-engine/bin/nan-video.cjs idea-status JOB_ID --watch
node packages/openshorts-engine/bin/nan-video.cjs projects
node packages/openshorts-engine/bin/nan-video.cjs evidence JOB_ID --input /absolute/evidence-request.json
node packages/openshorts-engine/bin/nan-video.cjs approve JOB_ID --input /absolute/approval-request.json
node packages/openshorts-engine/bin/nan-video.cjs revise JOB_ID --input /absolute/revision-request.json --watch
node packages/openshorts-engine/bin/nan-video.cjs cancel JOB_ID
node packages/openshorts-engine/bin/nan-video.cjs zip JOB_ID --output /absolute/new-clips.zip
```

`--input -` đọc JSON từ stdin. Options theo schema MCP của hệ thống; payload tối đa 128 KiB. Ví dụ source request:

```json
{"mediaId":"OWNED_MEDIA_ID","operation":"edit","aspectRatio":"16:9","segments":[{"startSeconds":0,"endSeconds":12}],"hook":{"enabled":true,"text":"Thông điệp mở đầu","durationSeconds":0.75},"reviewBeforeRender":true}
```

Với `process --file`, bỏ `mediaId` và `sourceUrl` khỏi JSON. CLI stream file MP4 qua endpoint upload có xác thực của cùng backend, rồi truyền Media ID thuộc tổ chức hiện tại vào MCP. File tối đa 1 GiB; server kiểm tra định dạng theo nội dung. Dòng JSON `event: "uploaded"` được in trước khi tạo job để có thể dùng lại `mediaId` nếu kết nối MCP mất ngay sau upload. Không thêm `--file` khi tiếp tục từ Media ID này để tránh upload lặp.

Trước khi gửi, nên đặt `idempotencyKey` cố định trong JSON request. Nếu CLI bị ngắt sau khi in `uploaded` nhưng trước khi in `jobId`, thử lại bằng Media ID đã in và cùng key; không lặp lại upload. Nếu CLI in `jobId`, dùng `status JOB_ID` để tiếp tục quan sát.

Ý tưởng:

```json
{"topic":"Ba thói quen tiết kiệm nước","targetDuration":15,"aspectRatio":"1:1","voice":"Thuyết Minh"}
```

Nếu `idea-status` xác nhận job đã `failed`, gọi `generate` với cùng các trường ban đầu và thêm `resumeJobId` của job đó. Backend tạo job mới, giữ kịch bản/ảnh đã lưu và chỉ tạo những ảnh còn thiếu. Checkpoint được lưu sau khi kịch bản hợp lệ và sau mỗi ảnh; job tạo trước khi cơ chế này được triển khai có thể không có checkpoint. Không dùng resume cho job còn chạy hoặc đã completed, và không đổi topic/duration/voice/aspect/seed khi resume.

Watch in ra JSON khi status/stage/progress đổi và dừng khi job chờ duyệt. Lệnh approve cần `expectedPlanVersion` đọc từ status và quyết định duyệt rõ ràng của người dùng. Revision cần `clipId` và `expectedRevision`; các trường không yêu cầu đổi được kế thừa. `cropOverrides` dùng `sceneIndex` đọc từ evidence `kind: "crop-scenes"` của đúng clip; sau recut cần đọc manifest mới trước khi crop.

Ctrl+C dừng quan sát, không hủy job hoặc tạo job thay thế. Dùng job ID đã trả để tiếp tục; chỉ gọi `cancel` khi muốn hủy job nguồn cụ thể. ZIP dùng credential kết nối hiện có, không theo redirect, giới hạn tải 1 GiB và không ghi đè file đã tồn tại.

Source request cũng nhận `webhook: { url, secret }`; xem [contract callback và retry](openshorts-webhooks.md). Callback chỉ dùng cho source-video job và cần đặt tường minh ở từng revision.

CLI upstream `cli/openshorts_cli.py subtitle` có các cờ font/subtitle; `main.py` không có các cờ này. NaN-Team nhận các cờ tương đương trên `process` và `revise`, rồi chuyển thành `captions` trong request MCP. Worker NDJSON/Python vẫn là adapter nội bộ có RPC từ host. Smoke CLI/MCP có xác thực đã kiểm chứng source edit và revision dùng Voice Clone, tùy chỉnh phụ đề, Media có checksum đúng. Kiểm chứng các loại video đầu vào khác vẫn là hạng mục riêng.

Các cờ phụ đề trên `process`/`revise`: `--style`, `--position`, `--font-size`, `--font-name`, `--font-color`, `--highlight-color`, `--uppercase`. Các tùy chọn bổ sung: `--border-color`, `--border-width`, `--bg-color`, `--bg-opacity`, `--effect`, `--base-opacity`. Cờ dòng lệnh ghi đè trường tương ứng trong JSON; các trường khác giữ nguyên. Nếu JSON đã đặt `captions.enabled: false`, cờ appearance không tự đổi nó thành true. Để bỏ uppercase, dùng `captions.uppercase: false` trong JSON.

```bash
node packages/openshorts-engine/bin/nan-video.cjs process --input /absolute/source-request.json --style pop --position middle --font-name Anton --font-size 24 --font-color '#FFFFFF' --highlight-color '#00FFFF' --uppercase
node packages/openshorts-engine/bin/nan-video.cjs revise JOB_ID --input /absolute/revision-request.json --style classic --position top --font-name 'Noto Serif Bold'
```

`captions` dùng cùng các trường camelCase: `position`, `fontName`, `fontSize`, `fontColor`, `borderColor`, `borderWidth`, `highlightColor`, `bgColor`, `bgOpacity`, `effect`, `baseOpacity`, `uppercase`. Font size 10–200 theo độ phân giải ảo PlayResY=288 của upstream, border 0–10, opacity 0–1, màu `#RRGGBB`. Effect `none|glow|pop|box` ghi đè effect của preset. Classic là chữ tĩnh và bỏ qua highlight/effect/baseOpacity; uppercase áp dụng ở cả hai renderer. BaseOpacity của ASS/motion làm giảm độ sáng RGB của từ chưa active, không phải alpha toàn bộ chữ.

Motion dùng font đã đóng gói: Anton/Impact; Montserrat/Montserrat ExtraBold; Noto Serif/Noto Serif Bold; Liberation Sans/Verdana/Arial/Helvetica; Liberation Serif/Georgia. Alias theo fontmap upstream. Font khác cần được cài sẵn trong môi trường browser; motion dừng với lỗi rõ ràng nếu không tìm thấy, trong khi Python/libass có thể thay bằng font dự phòng. Không dùng receipt render để khẳng định các font tùy ý đều có sẵn.

Với `replace-narration`, chữ thuyết minh đã biết được ánh xạ vào các mốc ASR của audio tổng hợp, chỉ khi số từ khớp, có ít nhất 75% từ đồng ý và đủ anchor quanh phần sửa. Giữ kết quả ASR gốc trong `narrationAlignment`; điều này không chứng minh phát âm hoặc căn chỉnh phoneme. Source speech và chế độ mix không dùng cơ chế sửa chữ này. Clean reuse/checkpoint được gắn thêm checksum của narration/BGM thực tế, để một lần tổng hợp mới không dùng audio cũ với phụ đề mới.
