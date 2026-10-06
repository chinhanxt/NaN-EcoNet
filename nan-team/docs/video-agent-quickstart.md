# Video agent — Quickstart

Một lệnh cho toàn bộ stack: `scripts/nan-video-stack.sh`.

## 1. Bật / tắt / kiểm tra

```bash
cd /home/chinhan/MMO/NaN-Team
scripts/nan-video-stack.sh doctor                 # kiểm tra điều kiện (model, docker image, venv, AGY login, .env)
scripts/nan-video-stack.sh start                  # bật tất cả theo thứ tự, chờ health
scripts/nan-video-stack.sh start --no-frontend    # chỉ API/worker/AGY/Voice (tiết kiệm ~3 GB RAM)
scripts/nan-video-stack.sh start --no-voice       # bỏ Voice Clone (idea→video lồng tiếng sẽ không chạy)
scripts/nan-video-stack.sh status                 # bảng service/port/health/RAM + RAM trống
scripts/nan-video-stack.sh jobs                   # job source (DB) + container engine + job idea đang chạy
scripts/nan-video-stack.sh stop                   # tắt app, giữ Postgres/Redis/Temporal
scripts/nan-video-stack.sh stop --all             # tắt hết
```

Thứ tự `start`: Postgres :5433 → Redis :6380 → Temporal :7233 → Backend :3000 → Orchestrator :3002
(qua `config/dev-native.sh start`, `taskset -c 0 nice -n 15`, `NODE_OPTIONS=--max-old-space-size=3072`,
tự build lại nếu code đổi) → AGY proxy pool :8911–8916 → Voice Clone :8002 → Frontend :4200
(systemd unit `nan-frontend`, MemoryMax 4G, qua `scripts/frontend-lowmem.sh`). Lệnh idempotent: chạy lại
chỉ bật những gì đang tắt.

Frontend bị chặn khi RAM khả dụng <3.5 GB hoặc swap đã dùng >2 GB (script in lý do, exit 3);
ép bật: `NAN_STACK_FORCE_FRONTEND=1 scripts/nan-video-stack.sh start`.

`stop` sẽ ngắt job video đang render (script cảnh báo nếu còn container `nan-openshorts-*`).

## 2. Mở UI

- Web app: http://localhost:4200 (lần compile đầu 2–6 phút)
- Video agent: tạo video từ ý tưởng (idea→video), chỉnh video nguồn (upload → duyệt → revisions), đính kèm vào composer.
- Temporal UI: http://localhost:8233 — API: http://localhost:3000

## 3. Log

```bash
scripts/nan-video-stack.sh logs                   # liệt kê file log
scripts/nan-video-stack.sh logs backend 200       # 200 dòng cuối
scripts/nan-video-stack.sh logs orchestrator -f   # follow (job video, AGY MCP)
scripts/nan-video-stack.sh logs voice
scripts/nan-video-stack.sh logs frontend          # journalctl --user -u nan-frontend
scripts/nan-video-stack.sh logs pool-8911         # một proxy AGY
```

- File log: `~/.local/share/postiz-dev/logs/{backend,orchestrator,temporal,postgres,redis,voice-clone,agy-provider}.log`
- Thư mục job video nguồn: `~/.local/share/nan-team/source-video-jobs/`
- Receipt/báo cáo test: `reports/openshorts-integration/`

## 4. Chạy live harness

Chạy tuần tự (không song song job nặng), `nice -n 19`. Tên report mới cho mỗi lần chạy — receipt đã có
verdict không bị ghi đè (harness từ chối). Seed report (orgId, sourceMediaId, input…) đặt sẵn trong
`reports/openshorts-integration/<tên>.json`; thêm `--dry-run` để kiểm seed offline.

```bash
# Idea → video (cần Voice Clone :8002)
nice -n 19 node scripts/test-ai-video-mcp-live.cjs live-idea-<ngày>
# Chỉnh video nguồn (S1 hội thoại / S2 screencast / S3 im lặng)
nice -n 19 node scripts/test-source-video-mcp-live.cjs live-<tên-seed> [--dry-run]
# Revisions R1–R4 + cancel + ZIP trên một job source đã PASS
nice -n 19 node scripts/test-source-video-revisions-live.cjs live-<tên>-revisions [--dry-run]
# CLI
nice -n 19 node scripts/test-video-cli-live.cjs <base-report> <new-report>
# Browser (cần frontend :4200)
nice -n 19 node scripts/test-current-video-composer-browser.cjs --report <job>.json --second-report <job2>.json --receipt browser-<ngày>.json
nice -n 19 node scripts/test-studio-content-browser.cjs --receipt studio-content-<ngày>.json
```

Ma trận nghiệm thu: `reports/openshorts-integration/acceptance-matrix-final.md`.

## 5. Khi lỗi

- `scripts/nan-video-stack.sh doctor` → in lệnh sửa cho từng mục FAIL.
- `jobs` hiện `STALE?` = job queued/running không cập nhật >15 phút (có thể kẹt sau reboot).
- RAM thấp (<4 GB khả dụng) hoặc swap >2 GB: `start --no-frontend`, hoặc tắt Voice Clone khi không làm idea→video.
- AGY lỗi: kiểm `status` (pool 8911–8916 phải UP), `agy models` phải liệt kê model (đã đăng nhập).
- Sau reboot: chỉ cần `scripts/nan-video-stack.sh start`.
