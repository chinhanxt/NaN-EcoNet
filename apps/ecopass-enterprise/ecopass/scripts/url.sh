#!/usr/bin/env bash
# ==============================================================================
# EcoPass - Hiển thị đường dẫn Public Web cho điện thoại
# ==============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$DIR/logs"

# Colors
YELLOW="\033[1;33m"
GREEN="\033[1;32m"
CYAN="\033[1;36m"
BOLD="\033[1m"
RESET="\033[0m"

PUBLIC_URL=""

# 1. Look in cloudflared.log
if [ -f "$LOG_DIR/cloudflared.log" ]; then
  PUBLIC_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | tail -n 1 || true)
fi

# 2. If not found in log, check if cloudflared is running
if [ -z "$PUBLIC_URL" ] && pgrep -f "cloudflared" >/dev/null 2>&1; then
  # Fallback to checking active task log if running from agent or background
  for f in $(ls -t /home/chinhan/.gemini/antigravity-cli/brain/*/tasks/task-*.log /home/chinhan/.gemini/antigravity-cli/brain/*/.system_generated/tasks/task-*.log 2>/dev/null); do
    if grep -q "trycloudflare.com" "$f" 2>/dev/null; then
      PUBLIC_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$f" | tail -n 1 || true)
      [ -n "$PUBLIC_URL" ] && break
    fi
  done
fi

if [ -n "$PUBLIC_URL" ]; then
  echo -e "${BOLD}${GREEN}✓ ĐÃ TÌM THẤY ĐƯỜNG DẪN PUBLIC CHO ĐIỆN THOẠI:${RESET}"
  echo -e "👉 ${BOLD}${YELLOW}${PUBLIC_URL}/vi${RESET}"
  echo -e ""
  echo -e "Mở link trên bằng camera điện thoại hoặc trình duyệt Safari / Chrome để test quét mã!"
else
  echo -e "⚠️ Chưa tìm thấy đường dẫn Cloudflare Tunnel!"
  echo -e "Hãy chạy: ${BOLD}make dev${RESET} hoặc ${BOLD}make start${RESET} để kích hoạt đường dẫn public."
fi
