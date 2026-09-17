#!/usr/bin/env bash
# ==============================================================================
# EcoPass - Chạy toàn bộ hệ sinh thái ở chế độ Interactive Dev (Foreground)
# ==============================================================================
set -e

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

cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Nhận tín hiệu dừng, đang tắt tất cả các cổng...${RESET}"
  "$DIR/scripts/stop.sh" >/dev/null 2>&1 || true
  exit 0
}
trap cleanup INT TERM

echo -e "${BOLD}${CYAN}🌿 Đang chuẩn bị khởi động hệ sinh thái EcoPass...${RESET}"

# 1. Dọn dẹp cổng cũ nếu đang bị chiếm
"$DIR/scripts/stop.sh" >/dev/null 2>&1 || true

# 2. Khởi chạy 5 dịch vụ ngầm vào file log
echo -e "${BLUE}▶ Đang khởi động 5 cổng dịch vụ...${RESET}"

# Port 3011: client-scanner (Next.js)
(cd "$DIR/client-scanner" && bun run dev -- -p 3011 > "$LOG_DIR/client-scanner.log" 2>&1) &
PID_SCANNER=$!

# Port 3010: brand-portal (Vite)
(cd "$DIR/brand-portal" && bun run dev > "$LOG_DIR/brand-portal.log" 2>&1) &
PID_BRAND=$!

# Port 3013: merchant-portal (Vite)
(cd "$DIR/merchant-portal" && bun run dev > "$LOG_DIR/merchant-portal.log" 2>&1) &
PID_MERCHANT=$!

# Port 3012: partner-portal (Vite)
(cd "$DIR/partner-portal" && bun run dev > "$LOG_DIR/partner-portal.log" 2>&1) &
PID_PARTNER=$!

# Port 3009: cashier-pos (Vite)
(cd "$DIR/cashier-pos" && bun run dev -- --port 3009 --host > "$LOG_DIR/cashier-pos.log" 2>&1) &
PID_POS=$!

# 3. Khởi chạy Cloudflare Tunnel
echo -e "${BLUE}▶ Đang thiết lập Cloudflare Tunnel ra internet cho điện thoại...${RESET}"
(cloudflared tunnel --url http://localhost:3011 > "$LOG_DIR/cloudflared.log" 2>&1) &
PID_TUNNEL=$!

# Lưu PIDs
echo "$PID_SCANNER" > "$PID_FILE"
echo "$PID_BRAND" >> "$PID_FILE"
echo "$PID_MERCHANT" >> "$PID_FILE"
echo "$PID_PARTNER" >> "$PID_FILE"
echo "$PID_POS" >> "$PID_FILE"
echo "$PID_TUNNEL" >> "$PID_FILE"

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
echo -e "${BOLD}${GREEN}║                          🌿 ECOPASS DEV ECOSYSTEM ACTIVE 🌿                       ║${RESET}"
echo -e "${BOLD}${GREEN}║                       Tất cả cổng dịch vụ đã sẵn sàng!                            ║${RESET}"
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
echo -e "${BOLD}${GREEN}║${RESET}  💡 Logs chi tiết lưu tại:        ${MAGENTA}ecopass/logs/*.log${RESET}                               ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  ⌨️  Bấm ${BOLD}${RED}Ctrl + C${RESET} bất cứ lúc nào để dừng và giải phóng toàn bộ cổng.               ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# Giữ tiến trình chạy foreground cho đến khi người dùng bấm Ctrl+C
wait
