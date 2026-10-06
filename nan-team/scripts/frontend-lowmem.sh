#!/usr/bin/env bash
# Frontend dev server (Next.js, low-memory mode) as a user systemd unit with a RAM/CPU cap.
# Usage: scripts/frontend-lowmem.sh start|stop|restart|status|logs|wait
#   FRONTEND_UNIT (default nan-frontend), FRONTEND_MEMORY_MAX (4G), FRONTEND_SWAP_MAX (256M),
#   FRONTEND_CPU_QUOTA (100%), FRONTEND_NICE (15)
# URL: http://localhost:4200  (backend must already run on :3000, see config/dev-native.sh)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
UNIT=${FRONTEND_UNIT:-nan-frontend}
URL=http://localhost:4200

wait_ready() {
  local deadline=$((SECONDS + ${1:-600}))
  until curl -s -o /dev/null --max-time 5 "$URL/auth/login"; do
    systemctl --user is-active --quiet "$UNIT" || { echo "unit $UNIT is not running" >&2; return 1; }
    ((SECONDS < deadline)) || { echo "timeout waiting for $URL" >&2; return 1; }
    sleep 3
  done
  echo "ready: $URL"
}

case "${1:-status}" in
  start)
    if systemctl --user is-active --quiet "$UNIT"; then echo "$UNIT already running"; exit 0; fi
    if ss -ltn 'sport = :4200' | grep -q 4200; then echo "port 4200 is busy (another frontend?)" >&2; exit 1; fi
    systemctl --user reset-failed "$UNIT" 2>/dev/null || true
    systemd-run --user --unit="$UNIT" --working-directory="$ROOT" \
      -p MemoryMax="${FRONTEND_MEMORY_MAX:-4G}" -p MemorySwapMax="${FRONTEND_SWAP_MAX:-256M}" \
      -p CPUQuota="${FRONTEND_CPU_QUOTA:-100%}" -p Nice="${FRONTEND_NICE:-15}" \
      --setenv=PATH="$PATH" --setenv=HOME="$HOME" \
      pnpm --filter ./apps/frontend run dev:lowmem >/dev/null
    echo "started $UNIT (logs: $0 logs)"
    wait_ready 600 ;;
  stop) systemctl --user stop "$UNIT" 2>/dev/null || true; echo "stopped $UNIT" ;;
  restart) "$0" stop; "$0" start ;;
  wait) wait_ready "${2:-600}" ;;
  status)
    echo "unit: $(systemctl --user is-active "$UNIT" 2>/dev/null || true)"
    systemctl --user show "$UNIT" -p MemoryCurrent -p MemoryPeak -p MemoryMax 2>/dev/null || true
    echo "http: $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL/auth/login" || echo down)" ;;
  logs) journalctl --user -u "$UNIT" -n "${2:-80}" --no-pager -o cat ;;
  *) echo "usage: $0 start|stop|restart|status|logs|wait" >&2; exit 2 ;;
esac
