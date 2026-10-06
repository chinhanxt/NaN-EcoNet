#!/usr/bin/env bash
# Cloudflare quick tunnel for the native dev stack:
#   cloudflared (https://<random>.trycloudflare.com) -> config/tunnel-proxy.js (:4280) -> backend :3000 (/api) + frontend :4200
# Usage: tunnel-native.sh start|restart|stop|url|status
# Never fails the caller: problems are printed as warnings.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${POSTIZ_DEV_STATE_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/postiz-dev}"
CLOUDFLARED="${CLOUDFLARED_BIN:-$(command -v cloudflared || echo "${HOME}/.local/bin/cloudflared")}"
PROXY_PORT="${TUNNEL_PROXY_PORT:-4280}"
URL_FILE="$STATE_DIR/tunnel-url"
TUNNEL_LOG="$STATE_DIR/logs/tunnel.log"

cd "$ROOT_DIR"
mkdir -p "$STATE_DIR/logs" "$STATE_DIR/pids"

dotenv_value() {
  local value
  value="$(sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1)"
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "${value:-$2}"
}

alive() {
  local pid=""
  [[ -f "$STATE_DIR/pids/$1" ]] && read -r pid <"$STATE_DIR/pids/$1"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

launch() {
  local name="$1"
  shift
  local -a scope_prefix=()
  # Own systemd scope so closing the terminal that ran `make dev` does not kill it (same as dev-native.sh).
  if command -v systemd-run >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    scope_prefix=(systemd-run --user --scope --quiet --collect --unit="postiz-dev-$name-$(date +%s)-$$")
  fi
  setsid "${scope_prefix[@]}" "$@" >>"$STATE_DIR/logs/$name.log" 2>&1 &
  echo "$!" >"$STATE_DIR/pids/$name"
}

halt() {
  local pid=""
  [[ -f "$STATE_DIR/pids/$1" ]] && read -r pid <"$STATE_DIR/pids/$1"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    for ((i = 0; i < 50; i++)); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
    kill -0 "$pid" 2>/dev/null && kill -KILL -- "-$pid" 2>/dev/null
  fi
  rm -f -- "$STATE_DIR/pids/$1"
}

start_proxy() {
  alive tunnel-proxy && return 0
  if (echo >"/dev/tcp/127.0.0.1/$PROXY_PORT") >/dev/null 2>&1; then
    echo "WARN: port $PROXY_PORT is busy and not owned by the tunnel proxy" >&2
    return 1
  fi
  FRONTEND_URL="$(dotenv_value FRONTEND_URL http://localhost:4200)" \
  NEXT_PUBLIC_BACKEND_URL="$(dotenv_value NEXT_PUBLIC_BACKEND_URL http://localhost:3000)" \
  TUNNEL_PROXY_PORT="$PROXY_PORT" launch tunnel-proxy node "$ROOT_DIR/config/tunnel-proxy.js"
  for ((i = 0; i < 50; i++)); do
    (echo >"/dev/tcp/127.0.0.1/$PROXY_PORT") >/dev/null 2>&1 && return 0
    sleep 0.1
  done
  echo "WARN: tunnel proxy did not open :$PROXY_PORT (see $STATE_DIR/logs/tunnel-proxy.log)" >&2
  return 1
}

start_tunnel() {
  start_proxy || return 0
  if alive tunnel && [[ -s "$URL_FILE" ]]; then
    return 0
  fi
  halt tunnel
  rm -f -- "$URL_FILE"
  if [[ ! -x "$CLOUDFLARED" ]]; then
    echo "WARN: cloudflared not found ($CLOUDFLARED); tunnel skipped" >&2
    return 0
  fi
  : >"$TUNNEL_LOG"
  launch tunnel "$CLOUDFLARED" tunnel --no-autoupdate --url "http://127.0.0.1:$PROXY_PORT"
  local url=""
  for ((i = 0; i < 60; i++)); do
    url="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -n 1)"
    [[ -n "$url" ]] && break
    alive tunnel || break
    sleep 0.5
  done
  if [[ -z "$url" ]]; then
    echo "WARN: Cloudflare tunnel did not come up (see $TUNNEL_LOG); continuing without it" >&2
    halt tunnel
    return 0
  fi
  # The hostname only routes once the edge connection is registered.
  for ((i = 0; i < 30; i++)); do
    grep -q 'Registered tunnel connection' "$TUNNEL_LOG" && break
    sleep 0.5
  done
  printf '%s\n' "$url" >"$URL_FILE"
}

stop_tunnel() {
  halt tunnel
  halt tunnel-proxy
  rm -f -- "$URL_FILE"
}

print_url() {
  if alive tunnel && [[ -s "$URL_FILE" ]]; then
    cat "$URL_FILE"
  else
    echo "(tunnel not running)"
    return 1
  fi
}

case "${1:-start}" in
  start) start_tunnel; print_url >/dev/null && echo "🌐 Public URL: $(cat "$URL_FILE")" ;;
  restart) stop_tunnel; start_tunnel; print_url >/dev/null && echo "🌐 Public URL: $(cat "$URL_FILE")" ;;
  stop) stop_tunnel ;;
  url) print_url ;;
  status) print_url >/dev/null; exit $? ;;
  *) echo "Usage: $0 [start|restart|stop|url|status]" >&2; exit 2 ;;
esac
exit 0
