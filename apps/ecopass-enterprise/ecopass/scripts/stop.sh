#!/usr/bin/env bash
# ==============================================================================
# EcoPass - Dừng toàn bộ cổng dịch vụ và Cloudflare Tunnel
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$DIR/logs"
PID_FILE="$LOG_DIR/pids.txt"

echo "🛑 Đang dừng toàn bộ cổng dịch vụ EcoPass..."

# 1. Kill saved PIDs if available
if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# 2. Release all EcoPass ports (3009 - 3013)
PORTS=(3009 3010 3011 3012 3013)
for port in "${PORTS[@]}"; do
  # Try fuser first
  if which fuser >/dev/null 2>&1; then
    fuser -k -n tcp "$port" 2>/dev/null || true
  fi
  # Fallback to lsof
  if which lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      kill -9 $PIDS 2>/dev/null || true
    fi
  fi
done

# 3. Kill cloudflared tunnel
pkill -f "cloudflared tunnel --url http://localhost:3011" 2>/dev/null || true
pkill -f "cloudflared tunnel.*3011" 2>/dev/null || true

# Wait a brief moment to ensure ports are freed
sleep 1

echo "✓ Đã giải phóng toàn bộ cổng (3009, 3010, 3011, 3012, 3013)."
echo "✓ Đã tắt Cloudflare tunnel."
echo "🟢 Hệ thống EcoPass đã dừng an toàn."
