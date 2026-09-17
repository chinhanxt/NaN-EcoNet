#!/usr/bin/env bash
# ==============================================================================
# EcoPass - Kiểm tra trạng thái các cổng dịch vụ & Cloudflare Tunnel
# ==============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$DIR/logs"

# Colors
GREEN="\033[1;32m"
RED="\033[1;31m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
CYAN="\033[1;36m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e "${BOLD}════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "              ${BOLD}${GREEN}TRẠNG THÁI HỆ THỐNG ECOPASS DỰ ÁN${RESET}                   "
echo -e "${BOLD}════════════════════════════════════════════════════════════════════════${RESET}"

check_port() {
  local port=$1
  local name=$2
  local path=$3
  if fuser "$port/tcp" >/dev/null 2>&1 || ss -tlpn 2>/dev/null | grep -q ":$port "; then
    echo -e "  ${GREEN}● ONLINE ${RESET} [Cổng ${port}] ${BOLD}${name}${RESET} -> ${CYAN}http://localhost:${port}${path}${RESET}"
  else
    echo -e "  ${RED}○ OFFLINE${RESET} [Cổng ${port}] ${name}"
  fi
}

check_port 3011 "App Sinh Viên & CSDL API" "/vi"
check_port 3010 "Cổng Nhãn Hàng Brand" ""
check_port 3013 "Cổng Cửa Hàng Highlands" "/temlynuoc"
check_port 3012 "Cổng Đối Tác Căn Tin" ""
check_port 3009 "Máy POS Thu Ngân Highlands" ""

echo -e "────────────────────────────────────────────────────────────────────────"

# Check Cloudflare Tunnel
if pgrep -f "cloudflared tunnel.*3011" >/dev/null 2>&1 || pgrep -f "cloudflared tunnel" >/dev/null 2>&1; then
  PUBLIC_URL=""
  if [ -f "$LOG_DIR/cloudflared.log" ]; then
    PUBLIC_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | tail -n 1 || true)
  fi
  if [ -n "$PUBLIC_URL" ]; then
    echo -e "  ${GREEN}● ONLINE ${RESET} [Tunnel]  ${BOLD}Cloudflare Public Web App (Điện thoại)${RESET}"
    echo -e "             👉 ${BOLD}${YELLOW}${PUBLIC_URL}/vi${RESET}"
  else
    echo -e "  ${YELLOW}● CONNECTING${RESET} [Tunnel] Cloudflare tunnel đang thiết lập đường truyền..."
  fi
else
  echo -e "  ${RED}○ OFFLINE${RESET} [Tunnel] Cloudflare tunnel chưa được kích hoạt"
fi

echo -e "${BOLD}════════════════════════════════════════════════════════════════════════${RESET}"
