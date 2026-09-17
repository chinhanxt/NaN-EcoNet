#!/usr/bin/env bash
# ==============================================================================
# EcoPass - Chạy toàn bộ hệ sinh thái ở chế độ Chạy Ngầm (Background Daemon)
# ==============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$DIR/logs"
PID_FILE="$LOG_DIR/pids.txt"

export PATH="/home/chinhan/.bun/bin:/home/chinhan/.local/bin:$PATH"

# Colors
GREEN="\033[1;32m"
RED="\033[1;31m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
CYAN="\033[1;36m"
MAGENTA="\033[1;35m"
BOLD="\033[1m"
RESET="\033[0m"

mkdir -p "$LOG_DIR"

echo -e "${BOLD}${CYAN}🌿 Đang khởi động toàn bộ cổng dịch vụ EcoPass ở chế độ chạy ngầm...${RESET}"

# 1. Dọn dẹp cổng cũ
"$DIR/scripts/stop.sh" >/dev/null 2>&1 || true

# 2. Khởi chạy 5 dịch vụ ngầm
echo -e "${BLUE}▶ Đang khởi động 5 cổng dịch vụ...${RESET}"

setsid bash -c "cd '$DIR/client-scanner' && bun run dev -- -p 3011" </dev/null > "$LOG_DIR/client-scanner.log" 2>&1 &
echo $! >> "$PID_FILE"
setsid bash -c "cd '$DIR/brand-portal' && bun run dev" </dev/null > "$LOG_DIR/brand-portal.log" 2>&1 &
echo $! >> "$PID_FILE"
setsid bash -c "cd '$DIR/merchant-portal' && bun run dev" </dev/null > "$LOG_DIR/merchant-portal.log" 2>&1 &
echo $! >> "$PID_FILE"
setsid bash -c "cd '$DIR/partner-portal' && bun run dev" </dev/null > "$LOG_DIR/partner-portal.log" 2>&1 &
echo $! >> "$PID_FILE"
setsid bash -c "cd '$DIR/cashier-pos' && bun run dev -- --port 3009 --host" </dev/null > "$LOG_DIR/cashier-pos.log" 2>&1 &
echo $! >> "$PID_FILE"

# 3. Khởi chạy Cloudflare Tunnel
echo -e "${BLUE}▶ Đang thiết lập Cloudflare Tunnel ra internet cho điện thoại...${RESET}"
setsid cloudflared tunnel --url http://localhost:3011 </dev/null > "$LOG_DIR/cloudflared.log" 2>&1 &
echo $! >> "$PID_FILE"

# 4. Chờ đường link Cloudflare Tunnel
PUBLIC_URL=""
for i in {1..25}; do
  if [ -f "$LOG_DIR/cloudflared.log" ]; then
    PUBLIC_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | tail -n 1 || true)
    if [ -n "$PUBLIC_URL" ]; then
      break
    fi
  fi
  sleep 1
done

# 5. In bảng điều khiển đẹp mắt
echo ""
echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║                     🌿 ECOPASS BACKGROUND DAEMON ACTIVE 🌿                        ║${RESET}"
echo -e "${BOLD}${GREEN}║                       Tất cả cổng đang chạy ngầm an toàn!                         ║${RESET}"
echo -e "${BOLD}${GREEN}╠═══════════════════════════════════════════════════════════════════════════════════╣${RESET}"
if [ -n "$PUBLIC_URL" ]; then
echo -e "${BOLD}${GREEN}║${RESET}  ${BOLD}${YELLOW}📱 APP CHO ĐIỆN THOẠI QUÉT MÃ (PUBLIC INTERNET):${RESET}                                   ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}     👉 ${BOLD}${CYAN}${PUBLIC_URL}/vi${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}     (Mở link trên trên điện thoại, camera quét được cả Barcode & QR tem ly)       ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}╠═══════════════════════════════════════════════════════════════════════════════════╣${RESET}"
fi
echo -e "${BOLD}${GREEN}║${RESET}  ${BOLD}CÁC CỔNG DỊCH VỤ TRÊN MÁY (LOCAL PORTS):${RESET}                                         ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  1. 📱 App Sinh Viên & CSDL:      ${CYAN}http://localhost:3011/vi${RESET}                         ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  2. 🏢 Cổng Quản Trị Nhãn Hàng:   ${CYAN}http://localhost:3010${RESET}                            ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  3. ☕ Cổng Cửa Hàng (Highlands):  ${CYAN}http://localhost:3013/temlynuoc${RESET}                  ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  4. 🤝 Cổng Đối Tác (Căn Tin):    ${CYAN}http://localhost:3012${RESET}                            ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  5. 💳 Máy POS Thu Ngân:          ${CYAN}http://localhost:3009${RESET}                            ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  6. 🗄️ CSDL Trung Tâm REST API:   ${CYAN}http://localhost:3011/api/ecopass/stickers${RESET}       ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}╠═══════════════════════════════════════════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  💡 Lệnh hữu ích:                                                                 ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}     - ${BOLD}make status${RESET} : Kiểm tra trạng thái và link public                             ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}     - ${BOLD}make url${RESET}    : Lấy lại link public cho điện thoại                             ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}     - ${BOLD}make stop${RESET}   : Dừng toàn bộ 5 cổng và giải phóng tài nguyên                   ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════════════════════════════╝${RESET}"
echo ""
