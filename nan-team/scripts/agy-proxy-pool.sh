#!/usr/bin/env bash
# One AGYXT rotation proxy per Antigravity account (ports BASE..BASE+N-1), so parallel
# AGY jobs pinned by AgyMcpService (AGY_MCP_PROVIDER_URLS) spend different accounts.
# Usage: scripts/agy-proxy-pool.sh start|stop|status|urls   (AGY_POOL_BASE_PORT, default 8911)
set -euo pipefail
BASE=${AGY_POOL_BASE_PORT:-8911}
SWITCHER=${AGYXT_DIR:-$HOME/antigravity-switcher}
ACCOUNTS=${AGYXT_ACCOUNTS:-$HOME/.config/antigravity-switcher/accounts.json}
POOL=$HOME/.config/antigravity-switcher/pool
COUNT=$(python3 -c 'import json,sys;print(len(json.load(open(sys.argv[1]))))' "$ACCOUNTS")

case "${1:-status}" in
  start)
    mkdir -p "$POOL"; chmod 700 "$POOL"
    python3 - "$ACCOUNTS" "$POOL" <<'EOF'
import json, os, sys
accounts = json.load(open(sys.argv[1]))
for i, account in enumerate(accounts):
    path = os.path.join(sys.argv[2], f"account-{i}.json")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump([account], f)
EOF
    for ((i = 0; i < COUNT; i++)); do
      port=$((BASE + i)); unit=agy-proxy-pool-$port
      systemctl --user is-active --quiet "$unit" && continue
      systemctl --user reset-failed "$unit" 2>/dev/null || true
      systemd-run --user --unit="$unit" -p MemoryMax=200M -p Nice=10 /usr/bin/python3 "$SWITCHER/proxy.py" \
        --port "$port" --accounts-file "$POOL/account-$i.json" --pid-file "$POOL/proxy-$port.pid" >/dev/null
    done
    "$0" status ;;
  stop)
    for ((i = 0; i < COUNT; i++)); do systemctl --user stop "agy-proxy-pool-$((BASE + i))" 2>/dev/null || true; done ;;
  status)
    for ((i = 0; i < COUNT; i++)); do port=$((BASE + i)); echo "$port $(systemctl --user is-active agy-proxy-pool-$port 2>/dev/null || true)"; done ;;
  urls)
    urls=(); for ((i = 0; i < COUNT; i++)); do urls+=("http://127.0.0.1:$((BASE + i))"); done
    (IFS=,; echo "${urls[*]}") ;;
  *) echo "usage: $0 start|stop|status|urls" >&2; exit 2 ;;
esac
