#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${POSTIZ_DEV_STATE_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/postiz-dev}"
PG_BIN="${POSTIZ_PG_BIN:-/usr/lib/postgresql/16/bin}"
REDIS_LIB="${STATE_DIR}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

cd "$ROOT_DIR"

wait_http() {
  local url="$1"
  local attempts="${2:-60}"
  for ((i = 0; i < attempts; i++)); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

wait_tcp() {
  local port="$1"
  for ((i = 0; i < 60; i++)); do
    if (echo >"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for port $port" >&2
  return 1
}

redis_cli() {
  LD_LIBRARY_PATH="$REDIS_LIB" "$STATE_DIR/bin/redis-cli" -h 127.0.0.1 -p 6380 "$@"
}

start_managed() {
  local name="$1"
  shift
  setsid "$@" >>"$STATE_DIR/logs/$name.log" 2>&1 &
  echo "$!" >"$STATE_DIR/pids/$name"
}

stop_managed() {
  local name="$1"
  local pid_file="$STATE_DIR/pids/$name"
  [[ -f "$pid_file" ]] || return 0
  local pid
  read -r pid <"$pid_file"
  if [[ "$pid" =~ ^[0-9]+$ ]] && [[ "$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')" == "$pid" ]]; then
    local cwd
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    if [[ "$cwd" == "$ROOT_DIR" || "$cwd" == "$STATE_DIR" ]]; then
      kill -TERM -- "-$pid"
      for ((i = 0; i < 150; i++)); do
        if ! kill -0 -- "-$pid" 2>/dev/null; then
          break
        fi
        sleep 0.2
      done
      if kill -0 -- "-$pid" 2>/dev/null; then
        echo "Service $name did not stop; check PID $pid" >&2
        return 1
      fi
    fi
  fi
  rm -f -- "$pid_file"
}

needs_build() {
  local output="$1"
  shift
  [[ ! -f "$output" ]] && return 0
  [[ -n "$(find "$@" -type f -name '*.ts' -newer "$output" -print -quit)" ]]
}

start_stack() {
  local frontend_started=0
  [[ -f .env ]] || { echo "Missing $ROOT_DIR/.env" >&2; exit 1; }
  [[ -f "$STATE_DIR/postgres/PG_VERSION" ]] || { echo "Missing native PostgreSQL data in $STATE_DIR" >&2; exit 1; }
  [[ -x "$STATE_DIR/bin/redis-server" && -x "$STATE_DIR/bin/temporal" ]] || {
    echo "Missing native Redis or Temporal binary in $STATE_DIR/bin" >&2
    exit 1
  }
  mkdir -p "$STATE_DIR/logs" "$STATE_DIR/pids" "$STATE_DIR/redis" "$STATE_DIR/uploads"
  touch "$STATE_DIR/logs/frontend.log" "$STATE_DIR/logs/backend.log" "$STATE_DIR/logs/orchestrator.log" "$STATE_DIR/logs/postgres.log" "$STATE_DIR/logs/redis.log"

  echo "--> [1/5] Kiểm tra PostgreSQL (:5433) & Redis (:6380)..."
  if ! pg_isready -q -h 127.0.0.1 -p 5433; then
    "$PG_BIN/pg_ctl" -D "$STATE_DIR/postgres" -l "$STATE_DIR/logs/postgres.log" \
      -o "-h 127.0.0.1 -p 5433 -k $STATE_DIR" start
  fi
  for ((i = 0; i < 15; i++)); do
    if pg_isready -q -h 127.0.0.1 -p 5433; then
      break
    fi
    sleep 0.5
  done

  local active_pg
  active_pg="$(psql -h 127.0.0.1 -p 5433 -U postiz-dev -d postiz-dev -Atqc 'show data_directory' 2>/dev/null || true)"
  if [[ -n "$active_pg" && "$active_pg" != "$STATE_DIR/postgres" ]]; then
    echo "Port 5433 belongs to another PostgreSQL data directory: $active_pg" >&2
    exit 1
  fi

  if ! redis_cli ping >/dev/null 2>&1; then
    LD_LIBRARY_PATH="$REDIS_LIB" "$STATE_DIR/bin/redis-server" --bind 127.0.0.1 \
      --port 6380 --dir "$STATE_DIR/redis" --appendonly yes --daemonize yes \
      --pidfile "$STATE_DIR/pids/redis" --logfile "$STATE_DIR/logs/redis.log"
  fi
  [[ "$(redis_cli ping 2>/dev/null || true)" == PONG ]] || { echo "Redis is unavailable" >&2; exit 1; }

  local prisma_schema="libraries/nestjs-libraries/src/database/prisma/schema.prisma"
  local prisma_client="node_modules/.prisma/client/index.js"
  if [[ -f "$prisma_schema" && (! -f "$prisma_client" || "$prisma_schema" -nt "$prisma_client") ]]; then
    echo "    ⚙️ Đang đồng bộ Prisma Client..."
    pnpm prisma-generate
  fi

  echo "--> [2/5] Kiểm tra Temporal Server (:7233, UI :8233)..."
  if ! (echo >/dev/tcp/127.0.0.1/7233) >/dev/null 2>&1; then
    start_managed temporal "$STATE_DIR/bin/temporal" server start-dev --ip 127.0.0.1 \
      --port 7233 --ui-port 8233 --db-filename "$STATE_DIR/temporal.sqlite" \
      --search-attribute organizationId=Keyword --search-attribute postId=Keyword
  fi
  wait_tcp 7233

  echo "--> [3/5] Kiểm tra Backend API (:3000) & Worker (:3002)..."
  local backend_rebuilt=0
  if needs_build apps/backend/dist/apps/backend/src/main.js apps/backend/src libraries/nestjs-libraries; then
    echo "    📦 Phát hiện thay đổi Backend/Libraries, đang build lại..."
    pnpm --filter ./apps/backend run build
    stop_managed backend
    fuser -k 3000/tcp >/dev/null 2>&1 || true
    sleep 0.5
    backend_rebuilt=1
  fi

  if [[ "$backend_rebuilt" == 1 ]] || ! curl -fsS --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    fuser -k 3000/tcp >/dev/null 2>&1 || true
    sleep 0.2
    start_managed backend pnpm --filter ./apps/backend start
  fi
  wait_http http://127.0.0.1:3000/ 40

  local orch_rebuilt=0
  if needs_build apps/orchestrator/dist/apps/orchestrator/src/main.js apps/orchestrator/src libraries/nestjs-libraries; then
    echo "    📦 Phát hiện thay đổi Orchestrator/Libraries, đang build lại..."
    pnpm --filter ./apps/orchestrator run build
    stop_managed orchestrator
    fuser -k 3002/tcp >/dev/null 2>&1 || true
    sleep 0.5
    orch_rebuilt=1
  fi

  if [[ "$orch_rebuilt" == 1 ]] || ! curl -fsS --max-time 2 http://127.0.0.1:3002/health/status >/dev/null 2>&1; then
    fuser -k 3002/tcp >/dev/null 2>&1 || true
    sleep 0.2
    start_managed orchestrator pnpm --filter ./apps/orchestrator start
  fi
  wait_http http://127.0.0.1:3002/health/status 40

  echo "--> [4/5] Kiểm tra Frontend Next.js (:4200)..."
  if ! curl -fsS --max-time 2 http://127.0.0.1:4200/auth >/dev/null 2>&1; then
    fuser -k 4200/tcp >/dev/null 2>&1 || true
    sleep 0.2
    start_managed frontend pnpm --filter ./apps/frontend dev
    frontend_started=1
  fi
  wait_http http://127.0.0.1:4200/auth 45

  echo "--> [5/5] Kiểm tra Agy Image Gateway (:8080)..."
  if ! curl -fsS --max-time 2 http://127.0.0.1:8080/health >/dev/null 2>&1; then
    bash /home/chinhan/agy-image-gateway/start.sh >/dev/null 2>&1 || true
  fi
  wait_http http://127.0.0.1:8080/health 15

  if [[ "${POSTIZ_DEV_WARMUP:-1}" == 1 ]]; then
    setsid nice -n 10 bash config/warmup-native.sh >>"$STATE_DIR/logs/warmup.log" 2>&1 &
  fi
}

stop_stack() {
  bash /home/chinhan/agy-image-gateway/stop.sh >/dev/null 2>&1 || true
  stop_managed frontend
  stop_managed orchestrator
  stop_managed backend
  stop_managed temporal
  fuser -k 8080/tcp 4200/tcp 3000/tcp 3002/tcp 8233/tcp 7233/tcp >/dev/null 2>&1 || true
  if [[ -x "$STATE_DIR/bin/redis-cli" ]]; then
    redis_cli shutdown >/dev/null 2>&1 || true
  fi
  if [[ -f "$STATE_DIR/postgres/PG_VERSION" ]]; then
    "$PG_BIN/pg_ctl" -D "$STATE_DIR/postgres" stop -m fast >/dev/null 2>&1 || true
  fi
  echo "NaN-Team native dev stopped"
}

dev_foreground() {
  start_stack
  echo ""
  echo "============================================================"
  echo "  🚀 NaN-Team Dev đang chạy (Foreground Mode)"
  echo ""
  echo "  🔗 Web App:       http://localhost:4200"
  echo "  🔗 Backend API:   http://localhost:3000"
  echo "  🔗 AI Gateway:    http://localhost:8080 (AI Art & Agent Chat)"
  echo "  🔗 Worker:        http://localhost:3002"
  echo "  🔗 Temporal UI:   http://localhost:8233"
  echo ""
  echo "  >> Bấm Ctrl+C để dừng toàn bộ dịch vụ và tắt web <<"
  echo "============================================================"
  echo ""

  local stopped=0
  cleanup() {
    if [[ "$stopped" == 1 ]]; then
      return 0
    fi
    stopped=1
    echo ""
    echo "Đang dừng toàn bộ dịch vụ NaN-Team..."
    stop_stack
    exit 0
  }

  trap cleanup INT TERM HUP

  tail -n 0 -f "$STATE_DIR/logs/frontend.log" "$STATE_DIR/logs/backend.log" &
  local tail_pid=$!

  wait "$tail_pid" 2>/dev/null || true
  cleanup
}

case "${1:-dev}" in
  dev) dev_foreground ;;
  start) start_stack ;;
  stop) stop_stack ;;
  restart-app)
    stop_managed frontend
    stop_managed orchestrator
    stop_managed backend
    fuser -k 4200/tcp 3000/tcp 3002/tcp >/dev/null 2>&1 || true
    sleep 1
    start_stack
    ;;
  restart-frontend)
    stop_managed frontend
    fuser -k 4200/tcp >/dev/null 2>&1 || true
    sleep 0.5
    start_stack
    ;;
  restart-backend)
    stop_managed backend
    fuser -k 3000/tcp >/dev/null 2>&1 || true
    sleep 0.5
    start_stack
    ;;
  restart-orchestrator)
    stop_managed orchestrator
    fuser -k 3002/tcp >/dev/null 2>&1 || true
    sleep 0.5
    start_stack
    ;;
  status-redis)
    [[ "$(redis_cli ping 2>/dev/null || true)" == PONG ]] && exit 0 || exit 1
    ;;
  *) echo "Usage: $0 [dev|start|stop|restart-app|restart-frontend|restart-backend|restart-orchestrator|status-redis]" >&2; exit 2 ;;
esac
