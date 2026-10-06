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

wait_redis() {
  for ((i = 0; i < 60; i++)); do
    if [[ "$(redis_cli ping 2>/dev/null || true)" == PONG ]]; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

start_managed() {
  local name="$1"
  shift
  local -a resource_prefix=()
  if [[ "$name" == backend || "$name" == orchestrator || "$name" == frontend ]]; then
    resource_prefix=(nice -n "${POSTIZ_DEV_NICE:-15}")
    if [[ "${POSTIZ_DEV_LIMIT_CPU:-true}" == true ]] && command -v taskset >/dev/null && [[ -r /proc/self/status ]]; then
      local development_cpu
      development_cpu="$(awk '/^Cpus_allowed_list:/ {split($2, a, /[-,]/); print a[1]}' /proc/self/status)"
      resource_prefix+=(taskset -c "$development_cpu")
    fi
  fi
  # Own systemd scope per service: otherwise the service lives in the cgroup of the terminal that ran
  # this script, and closing that terminal tab (its vte-spawn scope stops) SIGKILLs the backend
  # (seen 2026-10-02 05:22:56: backend "Killed", no OOM, vte-spawn-835a5328 scope ended 05:22:59).
  local -a scope_prefix=()
  if [[ "${POSTIZ_DEV_OWN_SCOPE:-true}" == true ]] && command -v systemd-run >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    scope_prefix=(systemd-run --user --scope --quiet --collect --unit="postiz-dev-$name-$(date +%s)-$$")
  fi
  setsid "${scope_prefix[@]}" "${resource_prefix[@]}" "$@" >>"$STATE_DIR/logs/$name.log" 2>&1 &
  echo "$!" >"$STATE_DIR/pids/$name"
}

stop_managed() {
  local name="$1"
  local pid_file="$STATE_DIR/pids/$name"
  [[ -f "$pid_file" ]] || return 0
  local pid
  read -r pid <"$pid_file" || true
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

owned_provider() {
  local provider_pid="$1" provider_script="$2"
  [[ "$provider_pid" =~ ^[0-9]+$ ]] && kill -0 "$provider_pid" 2>/dev/null || return 1
  [[ "$(readlink -f "/proc/$provider_pid/cwd" 2>/dev/null)" == "$ROOT_DIR" ]] || return 1
  [[ "$(ps -o pgid= -p "$provider_pid" 2>/dev/null | tr -d ' ')" == "$provider_pid" ]] || return 1
  local -a provider_argv=()
  mapfile -d '' -t provider_argv <"/proc/$provider_pid/cmdline"
  [[ "${provider_argv[1]:-}" == "$provider_script" && "${provider_argv[4]:-}" == "--port" && "${provider_argv[5]:-}" == "8901" ]]
}

# dotenv-cli never overrides variables already exported here, so .env must win over the defaults below.
dotenv_value() {
  local value
  value="$(sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1)"
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "${value:-$2}"
}

start_stack() {
  local frontend_started=0
  # The system owns a separate CLI provider route. Interactive agy-switch
  # sessions may stop their shared 8899 route when the terminal closes.
  export AGY_MCP_PROVIDER_URL="${AGY_MCP_PROVIDER_URL:-${CLOUD_CODE_URL:-http://127.0.0.1:8901}}"
  export SOURCE_VIDEO_JOB_DIRECTORY="${SOURCE_VIDEO_JOB_DIRECTORY:-${XDG_DATA_HOME:-${HOME}/.local/share}/nan-team/source-video-jobs}"
  # Local video work: two CPUs unless .env sets more (ASR threads capped at 4 in the engine), one active source job.
  export SOURCE_VIDEO_MAX_ACTIVE="${SOURCE_VIDEO_MAX_ACTIVE:-1}"
  export OPENSHORTS_DOCKER_CPUS="${OPENSHORTS_DOCKER_CPUS:-$(dotenv_value OPENSHORTS_DOCKER_CPUS 2)}"
  export OPENSHORTS_DOCKER_MEMORY="${OPENSHORTS_DOCKER_MEMORY:-$(dotenv_value OPENSHORTS_DOCKER_MEMORY 3g)}"
  export OPENSHORTS_THREADS="${OPENSHORTS_THREADS:-$(dotenv_value OPENSHORTS_THREADS 2)}"
  export OPENSHORTS_PYTHON="${OPENSHORTS_PYTHON:-${ROOT_DIR}/packages/openshorts-engine/bin/docker-python}"
  export OPENSHORTS_WHISPER_MODEL_DIRECTORY="${OPENSHORTS_WHISPER_MODEL_DIRECTORY:-${XDG_DATA_HOME:-${HOME}/.local/share}/nan-team/openshorts-models/faster-whisper-large-v3-turbo}"
  export WHISPER_LANGUAGE="${WHISPER_LANGUAGE:-vi}"
  export OPENSHORTS_YOLO_MODEL_PATH="${OPENSHORTS_YOLO_MODEL_PATH:-${XDG_DATA_HOME:-${HOME}/.local/share}/nan-team/openshorts-models/yolov8n.pt}"
  export OPENSHORTS_DOCKER_IMAGE="${OPENSHORTS_DOCKER_IMAGE:-sha256:bb3a5c5b38150730c8a3bde616d8a5f735de378d7c0f58d557655e08092e9d52}"
  mkdir -p "${SOURCE_VIDEO_JOB_DIRECTORY}"
  chmod 700 "${SOURCE_VIDEO_JOB_DIRECTORY}"

  [[ -f .env ]] || { echo "Missing $ROOT_DIR/.env" >&2; exit 1; }
  [[ -f "$STATE_DIR/postgres/PG_VERSION" ]] || { echo "Missing native PostgreSQL data in $STATE_DIR" >&2; exit 1; }
  [[ -x "$STATE_DIR/bin/redis-server" && -x "$STATE_DIR/bin/temporal" ]] || {
    echo "Missing native Redis or Temporal binary in $STATE_DIR/bin" >&2
    exit 1
  }
  mkdir -p "$STATE_DIR/logs" "$STATE_DIR/pids" "$STATE_DIR/redis" "$STATE_DIR/uploads"
  touch "$STATE_DIR/logs/frontend.log" "$STATE_DIR/logs/backend.log" "$STATE_DIR/logs/orchestrator.log" "$STATE_DIR/logs/postgres.log" "$STATE_DIR/logs/redis.log"

  if [[ "$AGY_MCP_PROVIDER_URL" == "http://127.0.0.1:8901" ]]; then
    local provider_script="${AGY_MCP_PROVIDER_SCRIPT:-${HOME}/antigravity-switcher/proxy.py}"
    [[ -f "$provider_script" ]] || { echo "Missing AGY CLI provider script: $provider_script" >&2; return 1; }
    local provider_pid=""
    if [[ -f "$STATE_DIR/pids/agy-provider" ]]; then read -r provider_pid <"$STATE_DIR/pids/agy-provider" || true; fi
    if ! owned_provider "$provider_pid" "$provider_script"; then
      if (echo >"/dev/tcp/127.0.0.1/8901") >/dev/null 2>&1; then
        echo "Port 8901 is occupied without a matching managed AGY provider" >&2; return 1
      fi
      start_managed agy-provider python3 "$provider_script" --host 127.0.0.1 --port 8901 --pid-file "$STATE_DIR/pids/agy-provider"
    fi
    wait_tcp 8901
    read -r provider_pid <"$STATE_DIR/pids/agy-provider" || true
    owned_provider "$provider_pid" "$provider_script" || { echo "Managed AGY provider exited or ownership changed" >&2; return 1; }
  fi

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
  wait_redis || { echo "Redis is unavailable" >&2; exit 1; }

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
    sleep 0.5
    backend_rebuilt=1
  fi

  if [[ "$backend_rebuilt" == 1 ]] || ! curl -fsS --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    sleep 0.2
    start_managed backend pnpm --filter ./apps/backend start
  fi
  wait_http http://127.0.0.1:3000/ 40

  local orch_rebuilt=0
  if needs_build apps/orchestrator/dist/apps/orchestrator/src/main.js apps/orchestrator/src libraries/nestjs-libraries; then
    echo "    📦 Phát hiện thay đổi Orchestrator/Libraries, đang build lại..."
    pnpm --filter ./apps/orchestrator run build
    stop_managed orchestrator
    sleep 0.5
    orch_rebuilt=1
  fi

  if [[ "$orch_rebuilt" == 1 ]] || ! curl -fsS --max-time 2 http://127.0.0.1:3002/health/status >/dev/null 2>&1; then
    sleep 0.2
    start_managed orchestrator pnpm --filter ./apps/orchestrator start
  fi
  wait_http http://127.0.0.1:3002/health/status 40

  if [[ "${POSTIZ_DEV_SKIP_FRONTEND:-false}" != true ]]; then
    echo "--> [4/5] Kiểm tra Frontend Next.js (:4200)..."
    # POSTIZ_DEV_FRONTEND_MODE=prod (mặc định): chạy bản build sẵn, mở nhanh; tự build lại khi code frontend đổi.
    # POSTIZ_DEV_FRONTEND_MODE=dev: next dev (hot reload, lần đầu biên dịch vài phút).
    local frontend_wait=120
    if ! curl -fsS --max-time 2 http://127.0.0.1:4200/auth >/dev/null 2>&1; then
      sleep 0.2
      if [[ "${POSTIZ_DEV_FRONTEND_MODE:-prod}" == dev ]]; then
        start_managed frontend pnpm --filter ./apps/frontend dev
        frontend_wait=420
      else
        if [[ ! -f apps/frontend/.next/BUILD_ID ]] || [[ -n "$(find apps/frontend/src libraries -path '*/node_modules' -prune -o -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.scss' -o -name '*.css' \) -newer apps/frontend/.next/BUILD_ID -print -quit)" ]]; then
          echo "    📦 Phát hiện thay đổi Frontend, đang build bản production (vài phút)..."
          (cd apps/frontend && NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=4096 nice -n 10 pnpm exec dotenv -e ../../.env -- next build --webpack)
        fi
        start_managed frontend pnpm --filter ./apps/frontend start
      fi
      frontend_started=1
    fi
    wait_http http://127.0.0.1:4200/auth "$frontend_wait"
  else
    echo "--> [4/5] Chỉ chạy API/MCP; không khởi động Frontend."
  fi

  if [[ "${POSTIZ_DEV_TUNNEL:-true}" == true ]]; then
    echo "--> Cloudflare quick tunnel (proxy :${TUNNEL_PROXY_PORT:-4280})..."
    bash config/tunnel-native.sh start || echo "WARN: Cloudflare tunnel failed; continuing without it" >&2
  fi

  echo "--> [5/5] Kiểm tra AGY CLI native MCP..."
  command -v "${AGY_MCP_BINARY:-agy}" >/dev/null || { echo "AGY CLI is unavailable" >&2; return 1; }
  "${AGY_MCP_BINARY:-agy}" --version

  if [[ "${POSTIZ_DEV_WARMUP:-1}" == 1 ]]; then
    setsid nice -n 10 bash config/warmup-native.sh >>"$STATE_DIR/logs/warmup.log" 2>&1 &
  fi
}

stop_stack() {
  bash config/tunnel-native.sh stop || true
  stop_managed frontend
  stop_managed orchestrator
  stop_managed backend
  stop_managed agy-provider
  stop_managed temporal
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
  echo "  🔗 AI Runtime:    AGY CLI + native MCP"
  echo "  🔗 Worker:        http://localhost:3002"
  echo "  🔗 Temporal UI:   http://localhost:8233"
  if [[ -s "$STATE_DIR/tunnel-url" ]]; then
    echo ""
    echo "  🌐 PUBLIC (Cloudflare): $(cat "$STATE_DIR/tunnel-url")"
    echo "     (đổi mỗi lần chạy; xem lại: make tunnel-url)"
  fi
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
    sleep 1
    start_stack
    ;;
  stop-frontend)
    stop_managed frontend
    ;;
  restart-frontend)
    stop_managed frontend
    sleep 0.5
    start_stack
    ;;
  restart-backend)
    stop_managed backend
    sleep 0.5
    start_stack
    ;;
  restart-orchestrator)
    stop_managed orchestrator
    sleep 0.5
    start_stack
    ;;
  status-redis)
    [[ "$(redis_cli ping 2>/dev/null || true)" == PONG ]] && exit 0 || exit 1
    ;;
  *) echo "Usage: $0 [dev|start|stop|restart-app|stop-frontend|restart-frontend|restart-backend|restart-orchestrator|status-redis]" >&2; exit 2 ;;
esac
