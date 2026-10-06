#!/usr/bin/env bash
# Tích hợp các patch sau live wave / Integrate queued patches after the live wave.
# Usage: scripts/post-wave-integrate.sh [--dry-run]
#   --dry-run: only the idle check, patch dry-runs and syntax checks (no file changes, no restarts).
# Steps: 1 idle check -> 2 patches (dry-run, apply if clean) -> 3 source-manifest refresh
#        -> 4 engine pytest -> 5 rebuild/restart backend+orchestrator, restart frontend -> 6 smoke -> 7 summary
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
PATCH_DIR=reports/openshorts-integration
PATCHES=(l3-layout.patch e4-engine-p2.patch x4-caption-contrast.patch)
LOCK=/tmp/nan-live-job.lock
DRY=0; [[ "${1:-}" == --dry-run ]] && DRY=1
SUMMARY=(); APPLIED=()
note() { SUMMARY+=("$*"); echo "$*"; }
die() { note "STOP: $*"; print_summary; exit 1; }
print_summary() {
  echo; echo "===== Tóm tắt / Summary ($( ((DRY)) && echo dry-run || echo apply)) ====="
  printf '  %s\n' "${SUMMARY[@]}"
}

# 1. Idle check / Kiểm tra không có job đang chạy
busy=$(psql -h 127.0.0.1 -p 5433 -U postiz-dev -d postiz-dev -Atc \
  "select left(id,8)||' '||status||'/'||coalesce(stage,'') from \"SourceVideoJob\" where status not in ('completed','failed','cancelled')" 2>&1) \
  || die "cannot query SourceVideoJob (Postgres :5433): $busy"
[[ -z "$busy" ]] || die "source jobs still active / còn job đang chạy: $(tr '\n' ';' <<<"$busy")"
exec 9>"$LOCK"
flock -n 9 || die "$LOCK is held: a live job is running / đang có live job"
docker ps -q --filter name=nan-openshorts- 2>/dev/null | grep -q . && die "engine container still running / container engine còn chạy"
note "1. idle: no active source job, lock free, no engine container"

# 2. Patches: dry-run, then apply when clean / Thử trước, áp dụng nếu sạch
for name in "${PATCHES[@]}"; do
  file="$PATCH_DIR/$name"
  if [[ ! -f "$file" ]]; then note "2. $name: not present, skipped"; continue; fi
  if out=$(patch -p1 -N --dry-run -s -d "$ROOT" <"$file" 2>&1); then
    if ((DRY)); then note "2. $name: dry-run clean (would apply)"; continue; fi
    if out=$(patch -p1 -N -s -d "$ROOT" <"$file" 2>&1); then APPLIED+=("$name"); note "2. $name: APPLIED"
    else die "$name failed after a clean dry-run: $out"; fi
  elif patch -p1 -R --dry-run -s -d "$ROOT" <"$file" >/dev/null 2>&1; then
    note "2. $name: already applied, skipped"
  else
    note "2. $name: SKIPPED, does not apply cleanly: $(head -3 <<<"$out" | tr '\n' ' ')"
  fi
done

# Syntax checks (both modes) / Kiểm tra cú pháp
for f in scripts/post-wave-integrate.sh scripts/nan-video-smoke.sh scripts/nan-video-stack.sh config/dev-native.sh; do
  bash -n "$f" || die "bash syntax error in $f"
done
python3 -c 'import ast,sys
for f in sys.argv[1:]: ast.parse(open(f, encoding="utf-8").read(), f)' packages/openshorts-engine/src/*.py packages/openshorts-engine/core/*.py || die "python syntax error in the engine"
note "   syntax: bash + engine python OK"
if ((DRY)); then print_summary; exit 0; fi

# 3. source-manifest snapshot hashes + patch notes
python3 - "${APPLIED[@]}" <<'EOF' || die "source-manifest refresh failed"
import hashlib, json, sys
from pathlib import Path
package = Path('packages/openshorts-engine'); path = package / 'source-manifest.json'
manifest = json.loads(path.read_text())
changed = []
for entry in manifest['files']:
    digest = hashlib.sha256((package / entry['path']).read_bytes()).hexdigest()
    if entry.get('snapshotSha256') != digest: changed.append(entry['path'])
    entry['snapshotSha256'] = digest
for name in sys.argv[1:]:
    note = f'Post-wave integration: {name}'
    if note not in manifest['patches']: manifest['patches'].append(note)
path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print('changed snapshot hashes:', ', '.join(changed) or 'none')
EOF
note "3. source-manifest refreshed"

# 4. Engine tests / Kiểm thử engine
# fd 9 (the live-job lock) is closed for children so no restarted service inherits it.
if ! nice -n 19 taskset -c 4-7 python3 -m pytest -q tests/openshorts 9>&-; then
  die "pytest tests/openshorts failed; revert newest first: $(for ((i=${#APPLIED[@]}-1; i>=0; i--)); do printf 'patch -p1 -R < %s/%s; ' "$PATCH_DIR" "${APPLIED[i]}"; done)"
fi
note "4. pytest tests/openshorts passed"

# 5. Rebuild + restart backend/orchestrator, then the frontend unit
POSTIZ_DEV_SKIP_FRONTEND=true POSTIZ_DEV_WARMUP=0 NODE_OPTIONS=--max-old-space-size=3072 \
  taskset -c 8-11 nice -n 10 bash config/dev-native.sh restart-app 9>&- || die "restart-app failed (backend/orchestrator)"
note "5. backend + orchestrator rebuilt/restarted"
if systemctl --user is-active --quiet "${FRONTEND_UNIT:-nan-frontend}"; then
  bash scripts/frontend-lowmem.sh restart 9>&- && note "   frontend restarted" || note "   WARN: frontend restart failed"
else
  note "   frontend not running: left off (start: scripts/frontend-lowmem.sh start)"
fi

# 6. Smoke check
if bash scripts/nan-video-smoke.sh 9>&-; then note "6. smoke: OK"; else note "6. smoke: FAIL (see table above)"; fi

# 7. Summary
print_summary
