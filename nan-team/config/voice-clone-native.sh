#!/usr/bin/env bash
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_state="${POSTIZ_DEV_STATE_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/postiz-dev}"
voice_script="${VOICE_CLONE_SERVER_PATH:-${HOME}/Voice_Clone/server.py}"
voice_python="${VOICE_CLONE_PYTHON:-$(dirname "$voice_script")/.venv/bin/python}"
pid_file="$task_state/pids/voice-clone"
log_file="$task_state/logs/voice-clone.log"
cd "$task_root"
owned_voice() {
  [[ -f "$pid_file" ]] || return 1
  read -r voice_pid <"$pid_file"
  [[ "$voice_pid" =~ ^[0-9]+$ ]] && kill -0 "$voice_pid" 2>/dev/null || return 1
  [[ "$(ps -o pgid= -p "$voice_pid" | tr -d ' ')" == "$voice_pid" ]] || return 1
  [[ "$(readlink -f "/proc/$voice_pid/cwd")" == "$task_root" ]] || return 1
  local -a voice_argv=()
  mapfile -d '' -t voice_argv <"/proc/$voice_pid/cmdline"
  local arg
  for arg in "${voice_argv[@]}"; do [[ "$arg" == "$voice_script" ]] && return 0; done
  return 1
}
voice_health() {
  curl -fsS --max-time 3 http://127.0.0.1:8002/health |
    python3 -c 'import json,sys; r=json.load(sys.stdin); sys.exit(0 if r.get("status")=="ok" and "OmniVoice" in r.get("model","") else 1)' 2>/dev/null
}
case "${1:-start}" in
  start)
    if voice_health 2>/dev/null; then echo 'Voice Clone is ready on 127.0.0.1:8002'; exit 0; fi
    if owned_voice; then echo "Owned Voice Clone is starting (PID $voice_pid); inspect $log_file"; exit 0; fi
    if (echo >/dev/tcp/127.0.0.1/8002) 2>/dev/null; then echo 'Port 8002 is occupied by a different service' >&2; exit 1; fi
    [[ -f "$voice_script" && -x "$voice_python" ]] || { echo 'Voice Clone server or Python environment is missing' >&2; exit 1; }
    mkdir -p "$task_state/pids" "$task_state/logs"
    local_cpu="$(awk '/^Cpus_allowed_list:/ {split($2,a,/[-,]/); print a[1]}' /proc/self/status)"
    # Cached assets only; no implicit model download. One HTTP worker, bounded CPU threads.
    setsid nice -n 15 taskset -c "$local_cpu" env PORT=8002 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 PYTHONUNBUFFERED=1 \
      "$voice_python" "$voice_script" >>"$log_file" 2>&1 &
    voice_pid=$!
    printf '%s\n' "$voice_pid" >"$pid_file"
    echo "Started owned Voice Clone (PID $voice_pid); readiness is pending at 127.0.0.1:8002"
    ;;
  status)
    if voice_health 2>/dev/null; then echo 'Voice Clone ready'; exit 0; fi
    if owned_voice; then echo "Voice Clone starting (PID $voice_pid)"; exit 2; fi
    echo 'Voice Clone stopped'; exit 3
    ;;
  stop)
    if owned_voice; then
      kill -TERM -- "-$voice_pid"
      for ((attempt=0;attempt<100;attempt++)); do kill -0 -- "-$voice_pid" 2>/dev/null || break; sleep .2; done
      if kill -0 -- "-$voice_pid" 2>/dev/null; then echo 'Owned Voice Clone has not stopped yet' >&2; exit 1; fi
      rm -f "$pid_file"
    fi
    ;;
  *) echo "Usage: $0 [start|status|stop]" >&2; exit 2 ;;
esac
