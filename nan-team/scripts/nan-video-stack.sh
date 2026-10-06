#!/usr/bin/env bash
# NaN video-agent stack: one command to start / stop / check everything.
# Một lệnh duy nhất để bật / tắt / kiểm tra toàn bộ stack video-agent.
#
# Usage:
#   scripts/nan-video-stack.sh start  [--no-frontend] [--no-voice]
#   scripts/nan-video-stack.sh stop   [--all]          # --all also stops postgres/redis/temporal
#   scripts/nan-video-stack.sh status
#   scripts/nan-video-stack.sh logs   [service] [lines|-f]
#   scripts/nan-video-stack.sh jobs                    # running source/idea jobs
#   scripts/nan-video-stack.sh doctor
#   scripts/nan-video-stack.sh retention [--apply] [--hours N]  # dọn file trung gian job đã xong (dry-run mặc định)
#
# Env overrides: NAN_STACK_CPU (taskset CPU for backend/orchestrator start, default 0),
#   VOICE_CLONE_PYTHON, VOICE_WAIT_SECONDS (240), POSTIZ_DEV_STATE_DIR, AGY_POOL_BASE_PORT (8911).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${POSTIZ_DEV_STATE_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/postiz-dev}"
DATA_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}"
PG_BIN="${POSTIZ_PG_BIN:-/usr/lib/postgresql/16/bin}"
VOICE_PY="${VOICE_CLONE_PYTHON:-/home/chinhan/VS_/Voice_Clone/.venv/bin/python}"
VOICE_SCRIPT="${VOICE_CLONE_SERVER_PATH:-${HOME}/Voice_Clone/server.py}"
POOL_BASE="${AGY_POOL_BASE_PORT:-8911}"
ACCOUNTS="${AGYXT_ACCOUNTS:-$HOME/.config/antigravity-switcher/accounts.json}"
FRONTEND_UNIT="${FRONTEND_UNIT:-nan-frontend}"
WHISPER_DIR="${OPENSHORTS_WHISPER_MODEL_DIRECTORY:-$DATA_HOME/nan-team/openshorts-models/faster-whisper-large-v3-turbo}"
YOLO_FILE="${OPENSHORTS_YOLO_MODEL_PATH:-$DATA_HOME/nan-team/openshorts-models/yolov8n.pt}"
DOCKER_IMAGE="${OPENSHORTS_DOCKER_IMAGE:-$(sed -n 's/.*OPENSHORTS_DOCKER_IMAGE:-\(sha256:[0-9a-f]\{64\}\).*/\1/p' "$ROOT/config/dev-native.sh" | head -1)}"

if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[1m'; N=$'\e[0m'; else G= R= Y= B= N=; fi
ok()   { echo "${G}[OK]${N}   $*"; }
bad()  { echo "${R}[FAIL]${N} $*"; }
warn() { echo "${Y}[WARN]${N} $*"; }
step() { echo; echo "${B}==> $*${N}"; }

pool_count() {
  python3 -c 'import json,sys;print(len(json.load(open(sys.argv[1]))))' "$ACCOUNTS" 2>/dev/null || echo 6
}
tcp_up()  { (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-3}" "$1" 2>/dev/null || true; }
http_ok() { curl -fsS -o /dev/null --max-time "${2:-3}" "$1" >/dev/null 2>&1; }
voice_ok() {
  curl -fsS --max-time 3 http://127.0.0.1:8002/health 2>/dev/null |
    python3 -c 'import json,sys; r=json.load(sys.stdin); sys.exit(0 if r.get("status")=="ok" else 1)' 2>/dev/null
}
redis_ok() {
  [[ "$(LD_LIBRARY_PATH="$STATE_DIR/lib" "$STATE_DIR/bin/redis-cli" -h 127.0.0.1 -p 6380 ping 2>/dev/null)" == PONG ]]
}
pg_ok() { pg_isready -q -h 127.0.0.1 -p 5433 2>/dev/null; }
avail_mb() { awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo; }
swap_used_mb() { awk '/^SwapTotal:/ {t=$2} /^SwapFree:/ {f=$2} END {print int((t-f)/1024)}' /proc/meminfo; }

wait_until() { # wait_until SECONDS label cmd...
  local secs="$1" label="$2"; shift 2
  local deadline=$((SECONDS + secs))
  until "$@"; do
    ((SECONDS < deadline)) || { bad "$label: timeout ${secs}s / hết thời gian chờ"; return 1; }
    sleep 2
  done
  ok "$label"
}

# ---- memory helpers -------------------------------------------------------
pid_by_port() {
  ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2
}
pid_from_file() {
  local f="$1" p=""
  [[ -f "$f" ]] && read -r p <"$f" 2>/dev/null
  [[ "$p" =~ ^[0-9]+$ ]] && kill -0 "$p" 2>/dev/null && echo "$p"
}
tree_rss_mb() { # RSS (MB) of pid + all descendants
  [[ -n "${1:-}" ]] || { echo "-"; return; }
  ps -eo pid=,ppid=,rss= | awk -v root="$1" '
    { pp[$1]=$2; rss[$1]=$3 }
    END {
      total=0
      for (p in pp) { q=p; while (q!="" && q!=0 && q!=1) { if (q==root) { total+=rss[p]; break } q=pp[q] } }
      printf "%d MB", total/1024
    }'
}
unit_pid() { systemctl --user show "$1" -p MainPID --value 2>/dev/null | grep -v '^0$'; }

# ---- status ---------------------------------------------------------------
row() { printf '%-16s %-7s %-6s %-9s %s\n' "$1" "$2" "$3" "$4" "${5:-}"; }
mark() { if "$@"; then echo "${G}UP${N}  "; else echo "${R}DOWN${N}"; fi; }

cmd_status() {
  echo "${B}NaN video-agent stack — trạng thái / status  ($(date '+%F %T'))${N}"
  row SERVICE PORT HEALTH MEMORY DETAIL
  row ------- ---- ------ ------ ------
  local pgpid; pgpid="$(head -1 "$STATE_DIR/postgres/postmaster.pid" 2>/dev/null)"
  row postgres 5433 "$(mark pg_ok)" "$(tree_rss_mb "$pgpid")" "native, $STATE_DIR/postgres"
  row redis 6380 "$(mark redis_ok)" "$(tree_rss_mb "$(pid_from_file "$STATE_DIR/pids/redis")")"
  row temporal 7233 "$(mark tcp_up 7233)" "$(tree_rss_mb "$(pid_from_file "$STATE_DIR/pids/temporal" || pid_by_port 7233)")" "UI http://localhost:8233"
  row backend-api 3000 "$(mark http_ok http://127.0.0.1:3000/)" "$(tree_rss_mb "$(pid_from_file "$STATE_DIR/pids/backend" || pid_by_port 3000)")" "http $(http_code http://127.0.0.1:3000/)"
  row orchestrator 3002 "$(mark http_ok http://127.0.0.1:3002/health/status)" "$(tree_rss_mb "$(pid_from_file "$STATE_DIR/pids/orchestrator" || pid_by_port 3002)")" "workers/temporal"
  local fcode; fcode="$(http_code http://127.0.0.1:4200/auth/login 8)"
  local fpid; fpid="$(unit_pid "$FRONTEND_UNIT" || pid_by_port 4200)"
  row frontend 4200 "$([[ "$fcode" =~ ^[23] ]] && echo "${G}UP${N}  " || echo "${R}DOWN${N}")" "$(tree_rss_mb "$fpid")" "http $fcode, unit $(systemctl --user is-active "$FRONTEND_UNIT" 2>/dev/null)"
  row voice-clone 8002 "$(mark voice_ok)" "$(tree_rss_mb "$(pid_from_file "$STATE_DIR/pids/voice-clone" || pid_by_port 8002)")" "OmniVoice /health"
  row agy-provider 8901 "$(mark tcp_up 8901)" "$(tree_rss_mb "$(pid_from_file "$STATE_DIR/pids/agy-provider" || pid_by_port 8901)")" "AGY CLI provider"
  row agyxt 8899 "$(mark tcp_up 8899)" "$(tree_rss_mb "$(pid_by_port 8899)")" "chores proxy (not managed)"
  local n i port; n="$(pool_count)"
  for ((i = 0; i < n; i++)); do
    port=$((POOL_BASE + i))
    row "agy-pool-$i" "$port" "$(mark tcp_up "$port")" "$(tree_rss_mb "$(unit_pid "agy-proxy-pool-$port" || pid_by_port "$port")")" "unit $(systemctl --user is-active "agy-proxy-pool-$port" 2>/dev/null)"
  done
  echo
  free -m | awk 'NR==1{print "RAM (MB):      " $0} NR==2{print "               " $0} NR==3{print "               " $0}'
  local a; a="$(avail_mb)"
  ((a < 2000)) && warn "RAM khả dụng thấp ${a} MB — tránh chạy nhiều job nặng song song / low available RAM"
  local jobs; jobs="$(docker ps --filter name=nan-openshorts- --format '{{.Names}}' 2>/dev/null | wc -l)"
  echo "OpenShorts containers đang chạy / running: $jobs"
  return 0
}

# ---- start ----------------------------------------------------------------
cmd_start() {
  local want_frontend=1 want_voice=1 a
  for a in "$@"; do
    case "$a" in
      --no-frontend) want_frontend=0 ;;
      --no-voice) want_voice=0 ;;
      *) echo "unknown flag: $a" >&2; exit 2 ;;
    esac
  done
  local cpu="${NAN_STACK_CPU:-0}"

  step "[1/4] Postgres + Redis + Temporal + Backend (:3000) + Orchestrator (:3002)"
  if pg_ok && redis_ok && tcp_up 7233 && http_ok http://127.0.0.1:3000/ && http_ok http://127.0.0.1:3002/health/status; then
    ok "Đã chạy sẵn / already running (dev-native start sẽ chỉ rebuild nếu code đổi)"
  fi
  # dev-native.sh is idempotent: it only (re)builds/starts what is missing or stale.
  if ! env POSTIZ_DEV_SKIP_FRONTEND=true POSTIZ_DEV_WARMUP=0 NODE_OPTIONS=--max-old-space-size=3072 \
       taskset -c "$cpu" nice -n 15 bash "$ROOT/config/dev-native.sh" start; then
    bad "config/dev-native.sh start lỗi / failed — xem: $0 logs backend"; exit 1
  fi
  wait_until 60 "Backend API :3000" http_ok http://127.0.0.1:3000/ || exit 1
  wait_until 60 "Orchestrator :3002" http_ok http://127.0.0.1:3002/health/status || exit 1

  step "[2/4] AGY proxy pool (:$POOL_BASE+)"
  bash "$ROOT/scripts/agy-proxy-pool.sh" start >/dev/null || warn "agy-proxy-pool start lỗi / failed"
  local n i; n="$(pool_count)"
  for ((i = 0; i < n; i++)); do
    wait_until 20 "AGY pool :$((POOL_BASE + i))" tcp_up $((POOL_BASE + i)) || true
  done

  if ((want_voice)); then
    step "[3/4] Voice Clone (:8002)"
    if voice_ok; then ok "Voice Clone đã sẵn sàng / ready"
    else
      local av; av="$(avail_mb)"; ((av < 2500)) && warn "RAM khả dụng ${av} MB; Voice Clone cần ~1.6 GB"
      VOICE_CLONE_PYTHON="$VOICE_PY" bash "$ROOT/config/voice-clone-native.sh" start || { bad "Voice Clone start failed"; exit 1; }
      wait_until "${VOICE_WAIT_SECONDS:-240}" "Voice Clone :8002 /health" voice_ok || warn "xem log: $0 logs voice"
    fi
  else
    step "[3/4] Voice Clone: bỏ qua / skipped (--no-voice)"
  fi

  if ((want_frontend)); then
    step "[4/4] Frontend Next.js (:4200, systemd unit $FRONTEND_UNIT, MemoryMax 4G)"
    if [[ "$(http_code http://127.0.0.1:4200/auth/login 8)" =~ ^[23] ]]; then ok "Frontend đã chạy / already running"
    else
      local av su; av="$(avail_mb)"; su="$(swap_used_mb)"
      if ((av < 3584 || su > 2048)); then
        bad "Không bật frontend: RAM khả dụng ${av} MB (cần ≥3584) / swap đã dùng ${su} MB (cần ≤2048)"
        echo "       Refusing to start frontend (low RAM or heavy swap). Đóng app khác / đợi job xong, rồi: $0 start"
        echo "       Override (tự chịu rủi ro OOM): NAN_STACK_FORCE_FRONTEND=1 $0 start"
        [[ "${NAN_STACK_FORCE_FRONTEND:-0}" == 1 ]] || { cmd_status; exit 3; }
        warn "NAN_STACK_FORCE_FRONTEND=1 — vẫn bật / starting anyway"
      fi
      if [[ -x "$ROOT/scripts/frontend-lowmem.sh" ]]; then
        echo "Đang compile frontend (lần đầu có thể 2-6 phút) / compiling, first load may take minutes..."
        bash "$ROOT/scripts/frontend-lowmem.sh" start || { bad "frontend start failed — $0 logs frontend"; exit 1; }
      else
        systemctl --user reset-failed "$FRONTEND_UNIT" 2>/dev/null || true
        systemd-run --user --unit="$FRONTEND_UNIT" --working-directory="$ROOT" -p MemoryMax=4G -p Nice=15 \
          --setenv=PATH="$PATH" --setenv=HOME="$HOME" --setenv=NODE_OPTIONS=--max-old-space-size=3072 \
          pnpm --filter ./apps/frontend dev >/dev/null
        wait_until 600 "Frontend :4200" http_ok http://127.0.0.1:4200/auth/login 10 || exit 1
      fi
    fi
  else
    step "[4/4] Frontend: bỏ qua / skipped (--no-frontend)"
  fi

  echo
  cmd_status
  echo
  echo "${B}Mở UI / Open UI:${N} http://localhost:4200   (API :3000, Temporal UI :8233)"
}

# ---- stop -----------------------------------------------------------------
stop_group() { # stop a setsid-managed service from its pid file (same rules as dev-native.sh)
  local name="$1" pid_file="$STATE_DIR/pids/$1" pid=""
  [[ -f "$pid_file" ]] || { echo "  $name: không chạy / not running"; return 0; }
  read -r pid <"$pid_file" || true
  if [[ "$pid" =~ ^[0-9]+$ ]] && [[ "$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')" == "$pid" ]]; then
    local cwd; cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    if [[ "$cwd" == "$ROOT" || "$cwd" == "$STATE_DIR" ]]; then
      kill -TERM -- "-$pid" 2>/dev/null
      local i
      for ((i = 0; i < 150; i++)); do kill -0 -- "-$pid" 2>/dev/null || break; sleep 0.2; done
      if kill -0 -- "-$pid" 2>/dev/null; then bad "$name chưa dừng / did not stop (PID $pid)"; return 1; fi
    fi
  fi
  rm -f -- "$pid_file"
  ok "$name đã dừng / stopped"
}

cmd_stop() {
  local all=0 a
  for a in "$@"; do
    case "$a" in --all) all=1 ;; *) echo "unknown flag: $a" >&2; exit 2 ;; esac
  done
  local jobs; jobs="$(docker ps --filter name=nan-openshorts- --format '{{.Names}}' 2>/dev/null | wc -l)"
  ((jobs > 0)) && warn "$jobs OpenShorts container đang chạy — job video sẽ bị ngắt / running jobs will be interrupted"

  step "Frontend"
  if [[ -x "$ROOT/scripts/frontend-lowmem.sh" ]]; then bash "$ROOT/scripts/frontend-lowmem.sh" stop
  else systemctl --user stop "$FRONTEND_UNIT" 2>/dev/null; ok "$FRONTEND_UNIT stopped"; fi
  stop_group frontend

  step "Voice Clone"
  VOICE_CLONE_PYTHON="$VOICE_PY" bash "$ROOT/config/voice-clone-native.sh" stop && ok "voice-clone đã dừng / stopped"

  step "Orchestrator + Backend + AGY provider (:8901)"
  stop_group orchestrator
  stop_group backend
  stop_group agy-provider

  step "AGY proxy pool"
  bash "$ROOT/scripts/agy-proxy-pool.sh" stop && ok "pool :$POOL_BASE+ đã dừng / stopped (AGYXT :8899 giữ nguyên / untouched)"

  if ((all)); then
    step "Temporal + Redis + Postgres (--all)"
    bash "$ROOT/config/dev-native.sh" stop
  else
    echo; echo "Postgres/Redis/Temporal vẫn chạy (dùng --all để tắt) / kept running (use --all)"
  fi
}

# ---- logs -----------------------------------------------------------------
cmd_logs() {
  local svc="${1:-}" arg="${2:-80}" f
  case "$svc" in
    ""|list)
      echo "Services: backend orchestrator temporal postgres redis voice agy-provider warmup frontend pool-<port>"
      echo "Log dir: $STATE_DIR/logs"; ls -la "$STATE_DIR/logs"
      echo "Frontend: journalctl --user -u $FRONTEND_UNIT   |   Pool: journalctl --user -u agy-proxy-pool-<port>"
      echo "Source-video jobs: ${SOURCE_VIDEO_JOB_DIRECTORY:-$DATA_HOME/nan-team/source-video-jobs}"
      return 0 ;;
    frontend) if [[ "$arg" == -f ]]; then journalctl --user -u "$FRONTEND_UNIT" -f -o cat; else journalctl --user -u "$FRONTEND_UNIT" -n "$arg" --no-pager -o cat; fi; return ;;
    pool-*) if [[ "$arg" == -f ]]; then journalctl --user -u "agy-proxy-pool-${svc#pool-}" -f -o cat; else journalctl --user -u "agy-proxy-pool-${svc#pool-}" -n "$arg" --no-pager -o cat; fi; return ;;
    voice) f="$STATE_DIR/logs/voice-clone.log" ;;
    *) f="$STATE_DIR/logs/$svc.log" ;;
  esac
  [[ -f "$f" ]] || { bad "không có log / no log: $f"; return 1; }
  if [[ "$arg" == -f ]]; then tail -n 50 -f "$f"; else tail -n "$arg" "$f"; fi
}

# ---- jobs -----------------------------------------------------------------
cmd_jobs() {
  echo "${B}Source-video jobs (DB, queued/running + 24h gần nhất / last 24h)${N}"
  if pg_ok; then
    psql -h 127.0.0.1 -p 5433 -U postiz-dev -d postiz-dev -P pager=off -c "
      select left(id,8) as job, revision as rev, status, stage, progress as pct,
             to_char(\"createdAt\" at time zone 'UTC','MM-DD HH24:MI') as created,
             to_char(\"updatedAt\" at time zone 'UTC','MM-DD HH24:MI:SS') as updated,
             concat_ws(' ', case when \"cancellationRequested\" then 'cancel' end,
               case when status in ('queued','running') and \"updatedAt\" < (now() at time zone 'UTC') - interval '15 minutes' then 'STALE?' end) as flag
      from \"SourceVideoJob\"
      where status in ('queued','running') or \"updatedAt\" > (now() at time zone 'UTC') - interval '24 hours'
      order by (status in ('queued','running')) desc, \"updatedAt\" desc limit 15" 2>&1
  else
    bad "Postgres :5433 không chạy / down"
  fi
  echo "${B}OpenShorts containers (engine đang chạy / running)${N}"
  docker ps --filter name=nan-openshorts- --format 'table {{.Names}}\t{{.RunningFor}}\t{{.Status}}' 2>/dev/null || warn "docker không truy cập được"
  docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' $(docker ps -q --filter name=nan-openshorts- 2>/dev/null) 2>/dev/null
  local dir="${AI_VIDEO_JOB_DIRECTORY:-${TMPDIR:-/tmp}/nan-ai-video-jobs}"
  echo "${B}Idea→video jobs ($dir, 10 mới nhất / newest)${N}"
  if [[ -d "$dir" ]]; then
    find "$dir" -maxdepth 1 -mindepth 1 -printf '%TY-%Tm-%Td %TH:%TM  %f\n' 2>/dev/null | sort -r | head -10
    local active; active="$(find "$dir" -maxdepth 1 -mmin -3 | wc -l)"
    ((active > 0)) && echo "  -> $active mục cập nhật trong 3 phút qua (có thể đang render) / recently active"
  else
    echo "  (chưa có job nào / none)"
  fi
  pgrep -af 'remotio[n]/|chrome-headless-shel[l]' 2>/dev/null | cut -c1-120 | head -5 | sed 's/^/  render: /'
  return 0
}

# ---- doctor ---------------------------------------------------------------
FAILS=0
chk() { # chk "label" "fix" cmd...
  local label="$1" fix="$2"; shift 2
  if "$@" >/dev/null 2>&1; then ok "$label"; else bad "$label"; echo "       fix: $fix"; FAILS=$((FAILS + 1)); fi
}
env_has() { grep -Eq "^[[:space:]]*(export[[:space:]]+)?$1=[^[:space:]]" "$ROOT/.env"; }
agy_logged_in() { timeout 25 agy models 2>/dev/null | grep -q 'gemini\|claude\|gpt'; }

cmd_doctor() {
  echo "${B}NaN video-agent doctor — kiểm tra điều kiện / prerequisites${N}"
  step "Công cụ / Tools"
  local t
  for t in node pnpm docker curl python3 taskset systemd-run ss pg_isready psql ffmpeg agy; do
    chk "$t" "cài đặt $t / install $t (PATH hiện tại thiếu)" command -v "$t"
  done
  chk "pg_ctl ($PG_BIN)" "sudo apt install postgresql-16 hoặc đặt POSTIZ_PG_BIN" test -x "$PG_BIN/pg_ctl"
  chk "redis-server + temporal trong $STATE_DIR/bin" "cài lại native binaries vào $STATE_DIR/bin" test -x "$STATE_DIR/bin/redis-server" -a -x "$STATE_DIR/bin/temporal"
  chk "Postgres data ($STATE_DIR/postgres)" "khởi tạo DB native: initdb vào $STATE_DIR/postgres" test -f "$STATE_DIR/postgres/PG_VERSION"
  chk "node_modules" "pnpm install" test -d "$ROOT/node_modules/.pnpm"
  chk "backend build (dist)" "pnpm --filter ./apps/backend run build (hoặc để start tự build)" test -f "$ROOT/apps/backend/dist/apps/backend/src/main.js"
  chk "orchestrator build (dist)" "pnpm --filter ./apps/orchestrator run build" test -f "$ROOT/apps/orchestrator/dist/apps/orchestrator/src/main.js"

  step "Video engine (OpenShorts)"
  chk "Whisper turbo model ($WHISPER_DIR/model.bin)" "python3 scripts/provision-whisper-turbo-test.py (tải faster-whisper-large-v3-turbo)" test -f "$WHISPER_DIR/model.bin"
  chk "YOLO weights ($YOLO_FILE)" "tải yolov8n.pt vào $YOLO_FILE" test -s "$YOLO_FILE"
  chk "Docker daemon" "sudo systemctl start docker; thêm user vào group docker" docker info
  chk "Docker image ${DOCKER_IMAGE:0:19}… (bin/docker-python)" "build lại image openshorts-backend và cập nhật OPENSHORTS_DOCKER_IMAGE trong config/dev-native.sh" docker image inspect "$DOCKER_IMAGE"
  chk "Job dir writable" "mkdir -p ~/.local/share/nan-team/source-video-jobs" test -w "$DATA_HOME/nan-team"

  step "Voice Clone"
  chk "server.py ($VOICE_SCRIPT)" "đặt VOICE_CLONE_SERVER_PATH" test -f "$VOICE_SCRIPT"
  chk "venv python ($VOICE_PY)" "đặt VOICE_CLONE_PYTHON tới venv có OmniVoice (~/VS_/Voice_Clone/.venv)" test -x "$VOICE_PY"

  step "AGY"
  chk "AGYXT proxy.py (~/antigravity-switcher)" "clone lại antigravity-switcher" test -f "${AGYXT_DIR:-$HOME/antigravity-switcher}/proxy.py"
  chk "accounts.json ($(pool_count) accounts)" "đăng nhập AGYXT để tạo accounts.json" test -s "$ACCOUNTS"
  chk "agy CLI đăng nhập / logged in (agy models)" "chạy 'agy' và đăng nhập lại" agy_logged_in

  step ".env (chỉ tên biến / names only)"
  if [[ -f "$ROOT/.env" ]]; then
    local k missing=()
    for k in DATABASE_URL REDIS_URL JWT_SECRET FRONTEND_URL MAIN_URL NEXT_PUBLIC_BACKEND_URL BACKEND_INTERNAL_URL \
             STORAGE_PROVIDER UPLOAD_DIRECTORY AGY_MCP_PROVIDER_URLS AGY_MCP_WORKER_CONCURRENCY AGY_IMAGE_GATEWAY_URL; do
      env_has "$k" || missing+=("$k")
    done
    if ((${#missing[@]})); then bad ".env thiếu / missing: ${missing[*]}"; echo "       fix: thêm các biến trên vào $ROOT/.env (AGY_MCP_PROVIDER_URLS = \$(scripts/agy-proxy-pool.sh urls))"; FAILS=$((FAILS + 1))
    else ok ".env có đủ biến chính / required keys present"; fi
  else
    bad ".env không tồn tại / missing"; echo "       fix: copy .env.example -> .env"; FAILS=$((FAILS + 1))
  fi

  step "Tài nguyên / Resources"
  local av sw; av="$(avail_mb)"; sw="$(awk '/^SwapFree:/ {print int($2/1024)}' /proc/meminfo)"
  if ((av >= 4000)); then ok "RAM khả dụng ${av} MB"; else warn "RAM khả dụng ${av} MB (swap trống ${sw} MB) — full stack cần ~7-8 GB; dùng --no-frontend/--no-voice hoặc đóng app khác"; fi
  local su; su="$(swap_used_mb)"
  if ((su <= 2048)); then ok "Swap đã dùng ${su} MB"
  else warn "Swap đã dùng ${su} MB (>2 GB) — máy sẽ chậm/đơ, frontend bị chặn khi start"
    echo "       fix: dừng bớt service ($0 stop, hoặc --no-frontend/--no-voice), đóng Chrome/IDE thừa; sau khi RAM trống: sudo swapoff -a && sudo swapon -a (xả swap)"
  fi
  local disk; disk="$(df -Pm "$DATA_HOME" | awk 'NR==2{print $4}')"
  if ((disk >= 10000)); then ok "Disk trống ${disk} MB ($DATA_HOME)"; else warn "Disk trống chỉ ${disk} MB — dọn: $0 retention --apply"; fi

  echo
  if ((FAILS == 0)); then ok "Doctor: tất cả điều kiện OK / all prerequisites OK"; else bad "Doctor: $FAILS lỗi / problems (xem fix ở trên)"; fi
  return "$FAILS"
}

case "${1:-status}" in
  start)  shift; cmd_start "$@" ;;
  stop)   shift; cmd_stop "$@" ;;
  status) cmd_status ;;
  logs)   shift; cmd_logs "$@" ;;
  jobs)   cmd_jobs ;;
  doctor) cmd_doctor ;;
  retention) shift; exec "$ROOT/scripts/nan-video-retention.sh" "$@" ;;
  smoke)  exec "$ROOT/scripts/nan-video-smoke.sh" ;;
  -h|--help|help) sed -n 2,15p "$0" ;;
  *) echo "usage: $0 start [--no-frontend] [--no-voice] | stop [--all] | status | logs [service] [N|-f] | jobs | doctor | retention [--apply] [--hours N]" >&2; exit 2 ;;
esac
