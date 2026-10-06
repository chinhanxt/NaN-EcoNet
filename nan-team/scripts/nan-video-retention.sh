#!/usr/bin/env bash
# NaN video-agent artifact retention. Dry-run by default; --apply deletes.
# Dọn file trung gian của job video đã kết thúc. Mặc định chỉ liệt kê; --apply mới xoá.
#
# Usage: scripts/nan-video-retention.sh [--apply] [--hours N] [--verbose]
#
# (a) Source-video jobs ($SOURCE_VIDEO_JOB_DIRECTORY, default ~/.local/share/nan-team/source-video-jobs):
#     only jobs whose DB SourceVideoJob status is completed/failed/cancelled (receipt.json fallback when the
#     row is missing), not leased, DB updatedAt AND newest file older than N hours (default 24).
#     Deletes: *-cut/-framed/-effects/-clean/-hook/-audio.mp4, parent-clean.mp4, frame-*.jpg, clips-*.zip,
#     runtime-cache/, motion-*/ (per-render Remotion bundle), speech-*/ (TTS temp).
#     Never deletes: receipt.json, checkpoints, source.mp4, final clips, and ANY path referenced by
#     SourceVideoClip.artifactPath/cleanPath or any receipt's sourcePath/parentClip/rendered/artifacts
#     (a revision re-reads the parent's source.mp4 and copies the parent's clean file).
#     --apply takes the engine's exclusive .retention.lock gate (non-blocking): refuses while any worker runs.
# (b) Idea-flow jobs ($AI_VIDEO_JOB_DIRECTORY, default /tmp/nan-ai-video-jobs): terminal and older than N
#     hours -> deletes <id>.inputs.json and stale *.tmp; keeps <id>.json, generation.json, storyboard.json.
# (c) Remotion bundle cache ($REMOTION_BUNDLE_CACHE_DIRECTORY, default /tmp/nan-remotion-bundle-cache):
#     same rule as remotion.renderer.ts pruneBundles (non-newest digest untouched for 24h).
# (d) Orphaned render temp dirs in $TMPDIR (nan-remotion-*, nan-tts-prefetch-*, react-motion-render*,
#     remotion-v4*-assets*): nothing modified for N hours and no process holding a file inside.
set -uo pipefail

APPLY=0 HOURS=24 VERBOSE=0
while (($#)); do
  case "$1" in
    --apply) APPLY=1 ;;
    --hours) HOURS="${2:?--hours N}"; shift ;;
    --hours=*) HOURS="${1#*=}" ;;
    -v|--verbose) VERBOSE=1 ;;
    -h|--help) sed -n 2,24p "$0"; exit 0 ;;
    *) echo "usage: $0 [--apply] [--hours N] [--verbose]" >&2; exit 2 ;;
  esac
  shift
done
[[ "$HOURS" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "--hours must be a number" >&2; exit 2; }

DATA_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}"
export NAN_RET_APPLY="$APPLY" NAN_RET_HOURS="$HOURS" NAN_RET_VERBOSE="$VERBOSE"
export NAN_RET_SOURCE_DIR="${SOURCE_VIDEO_JOB_DIRECTORY:-$DATA_HOME/nan-team/source-video-jobs}"
export NAN_RET_IDEA_DIR="${AI_VIDEO_JOB_DIRECTORY:-${TMPDIR:-/tmp}/nan-ai-video-jobs}"
export NAN_RET_BUNDLE_DIR="${REMOTION_BUNDLE_CACHE_DIRECTORY:-${TMPDIR:-/tmp}/nan-remotion-bundle-cache}"
export NAN_RET_TMP="${TMPDIR:-/tmp}"

DB_FILE="$(mktemp "${TMPDIR:-/tmp}/nan-retention-db.XXXXXX")"
trap 'rm -f "$DB_FILE"' EXIT
if pg_isready -q -h 127.0.0.1 -p 5433 2>/dev/null; then
  psql -h 127.0.0.1 -p 5433 -U postiz-dev -d postiz-dev -Atq -v ON_ERROR_STOP=1 -c "
    select json_build_object(
      'jobs', coalesce((select json_agg(json_build_object(
          'id', id, 'status', status, 'stage', stage,
          'updated', extract(epoch from (\"updatedAt\" at time zone 'UTC')),
          'leased', (\"leaseUntil\" is not null and \"leaseUntil\" > (now() at time zone 'UTC')),
          'refs', json_build_array(receipt->>'sourcePath', receipt->'parentClip'->>'cleanPath',
                                   receipt->'parentClip'->>'path', receipt->'artifacts', receipt->'rendered')))
        from \"SourceVideoJob\"), '[]'),
      'clips', coalesce((select json_agg(json_build_array(\"artifactPath\", \"cleanPath\")) from \"SourceVideoClip\"), '[]'))" >"$DB_FILE" 2>/dev/null || : >"$DB_FILE"
fi
export NAN_RET_DB_FILE="$DB_FILE"

python3 - <<'PY'
import fcntl, json, os, re, shutil, time
from pathlib import Path

APPLY = os.environ['NAN_RET_APPLY'] == '1'
HOURS = float(os.environ['NAN_RET_HOURS'])
VERBOSE = os.environ['NAN_RET_VERBOSE'] == '1'
NOW = time.time()
CUTOFF = NOW - HOURS * 3600
TERMINAL = {'completed', 'failed', 'cancelled'}
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
FILE_RX = re.compile(r'^(?:[0-9a-f]{32}-(?:cut|framed|effects|clean|hook|audio)\.mp4|parent-clean\.mp4|'
                     r'frame-[0-9a-f]{32}\.jpg|clips-[0-9a-f-]{36}\.zip)$')
DIR_RX = re.compile(r'^(?:runtime-cache|motion-[0-9a-f]+|speech-[A-Za-z0-9]+)$')

def human(n):
    for unit in ('B', 'KB', 'MB', 'GB'):
        if n < 1024 or unit == 'GB':
            return f'{n:.1f} {unit}' if unit != 'B' else f'{n} B'
        n /= 1024

def size(p):
    try:
        if p.is_symlink() or p.is_file():
            return p.lstat().st_size
        return sum(f.lstat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink())
    except OSError:
        return 0

def newest_mtime(p):
    try:
        best = p.lstat().st_mtime
        if p.is_dir() and not p.is_symlink():
            for f in p.rglob('*'):
                try: best = max(best, f.lstat().st_mtime)
                except OSError: pass
        return best
    except OSError:
        return NOW

def remove(p):
    if p.is_dir() and not p.is_symlink():
        shutil.rmtree(p)
    else:
        p.unlink()

report = {}
def plan(category, path, reason):
    b = size(path)
    report.setdefault(category, []).append((path, b, reason))

def canon(value):
    try: return str(Path(value).resolve())
    except (OSError, TypeError, ValueError): return None

def collect_refs(obj, out):
    if isinstance(obj, str):
        if obj.startswith('/'):
            c = canon(obj)
            if c: out.add(c)
    elif isinstance(obj, dict):
        for v in obj.values(): collect_refs(v, out)
    elif isinstance(obj, list):
        for v in obj: collect_refs(v, out)

# ---------------- (a) source-video jobs ----------------
src_root = Path(os.environ['NAN_RET_SOURCE_DIR'])
src_note = ''
gate = None
db_raw = Path(os.environ['NAN_RET_DB_FILE']).read_text().strip()
if not src_root.is_dir():
    src_note = f'skip: {src_root} missing'
elif not db_raw:
    src_note = 'skip: Postgres :5433 unreachable — source jobs need DB status (never inferred from file age)'
else:
    db = json.loads(db_raw)
    jobs = {j['id']: j for j in db['jobs']}
    protected = set()
    for j in db['jobs']: collect_refs(j.get('refs'), protected)
    for pair in db['clips']: collect_refs(pair, protected)
    receipts = {}
    for rec in src_root.glob('*/receipt.json'):
        try:
            r = json.loads(rec.read_text())
        except (OSError, ValueError):
            r = None
        receipts[rec.parent.name] = r
        if r:
            collect_refs({k: r.get(k) for k in ('sourcePath', 'parentClip', 'artifacts', 'rendered')}, protected)
    if APPLY:
        gate = open(src_root / '.retention.lock', 'a')
        try:
            fcntl.flock(gate, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            gate.close(); gate = None
            src_note = 'skip: a source-video worker holds .retention.lock (job running) — retry later'
    if not src_note:
        stats = {'kept_active': 0, 'kept_recent': 0, 'unknown': 0, 'eligible': 0}
        for d in sorted(src_root.iterdir()):
            if not d.is_dir() or d.is_symlink() or not UUID.match(d.name):
                continue
            j = jobs.get(d.name)
            if j:
                status, updated, leased = j['status'], float(j['updated']), j['leased']
            else:
                r = receipts.get(d.name)
                if not r:
                    stats['unknown'] += 1; continue
                status = (r.get('state') or {}).get('status')
                updated = d.joinpath('receipt.json').stat().st_mtime
                leased = False
            if status not in TERMINAL or leased:
                stats['kept_active'] += 1; continue
            if updated > CUTOFF or newest_mtime(d) > CUTOFF:
                stats['kept_recent'] += 1; continue
            stats['eligible'] += 1
            for attempt in sorted(d.glob('attempt-*')):
                if not attempt.is_dir() or attempt.is_symlink():
                    continue
                for item in sorted(attempt.iterdir()):
                    if not (FILE_RX.match(item.name) if item.is_file() else DIR_RX.match(item.name) if item.is_dir() else False):
                        continue
                    if item.is_symlink():
                        continue
                    rp = str(item.resolve())
                    if rp in protected or (item.is_dir() and any(p.startswith(rp + os.sep) for p in protected)):
                        continue
                    plan('a source-video intermediates', item, f'{d.name[:8]} {status}')
        src_note = (f"jobs: {stats['eligible']} eligible, {stats['kept_active']} active/non-terminal kept, "
                    f"{stats['kept_recent']} terminal <{HOURS:g}h kept, {stats['unknown']} without DB row/receipt skipped; "
                    f"{len(protected)} protected paths")

# ---------------- (b) idea-flow jobs ----------------
idea_root = Path(os.environ['NAN_RET_IDEA_DIR'])
idea_note = ''
if idea_root.is_dir():
    n_term = n_kept = 0
    for status_file in sorted(idea_root.glob('*.json')):
        job = status_file.name[:-5]
        if not UUID.match(job):
            continue
        try:
            s = json.loads(status_file.read_text())
        except (OSError, ValueError):
            continue
        updated = float(s.get('updatedAt') or s.get('createdAt') or 0) / 1000
        st = s.get('status')
        # queued/rendering snapshots older than N hours are backend-interrupted (reported failed by getStatus).
        if (st in TERMINAL or st in {'queued', 'rendering'}) and updated and updated < CUTOFF \
                and max(p.stat().st_mtime for p in idea_root.glob(job + '.*')) < CUTOFF:
            n_term += 1
            f = idea_root / f'{job}.inputs.json'
            if f.is_file():
                plan('b idea-flow evidence', f, st)
        else:
            n_kept += 1
    for tmp in idea_root.glob('*.tmp'):
        if tmp.stat().st_mtime < CUTOFF:
            plan('b idea-flow evidence', tmp, 'stale tmp')
    idea_note = f'jobs: {n_term} terminal ≥{HOURS:g}h, {n_kept} recent/active kept'
else:
    idea_note = f'skip: {idea_root} missing'

# ---------------- (c) Remotion bundle cache ----------------
bundle_root = Path(os.environ['NAN_RET_BUNDLE_DIR'])
bundle_note = ''
if bundle_root.is_dir():
    digests = {}
    for e in bundle_root.iterdir():
        name = e.name[:-5] if e.name.endswith('.json') else e.name
        if re.fullmatch(r'[0-9a-f]{64}', name):
            digests.setdefault(name, []).append(e)
    newest = max(digests, key=lambda k: max(p.stat().st_mtime for p in digests[k]), default=None)
    for k, entries in digests.items():
        if k == newest:
            continue
        for e in entries:
            if e.stat().st_mtime < NOW - 86400:
                plan('c remotion bundle cache', e, 'old digest')
    bundle_note = f'{len(digests)} digest(s), current kept: {(newest or "-")[:12]}, total {human(size(bundle_root))}'
else:
    bundle_note = f'skip: {bundle_root} missing'

# ---------------- (d) orphaned render temp dirs ----------------
tmp_root = Path(os.environ['NAN_RET_TMP'])
open_paths = set()
for proc in Path('/proc').glob('[0-9]*'):
    for sub in ('fd', 'cwd'):
        try:
            targets = [os.readlink(proc / 'cwd')] if sub == 'cwd' else [os.readlink(f) for f in (proc / 'fd').iterdir()]
        except OSError:
            continue
        open_paths.update(t for t in targets if t.startswith(str(tmp_root)))
tmp_count = 0
for pattern in ('nan-remotion-*', 'nan-tts-prefetch-*', 'react-motion-render*', 'remotion-v4*-assets*'):
    for d in tmp_root.glob(pattern):
        if not d.is_dir() or d.is_symlink() or d == bundle_root:
            continue
        tmp_count += 1
        prefix = str(d) + os.sep
        if any(p == str(d) or p.startswith(prefix) for p in open_paths):
            continue
        if newest_mtime(d) < CUTOFF:
            plan('d orphaned render temp', d, 'idle')
tmp_note = f'{tmp_count} render temp dir(s) seen'

# ---------------- report / apply ----------------
notes = {'a source-video intermediates': src_note, 'b idea-flow evidence': idea_note,
         'c remotion bundle cache': bundle_note, 'd orphaned render temp': tmp_note}
mode = 'APPLY' if APPLY else 'DRY-RUN (thêm --apply để xoá)'
print(f'NaN video retention — {mode}, older than {HOURS:g}h')
total = 0; deleted = 0; errors = 0
for cat in notes:
    items = report.get(cat, [])
    b = sum(x[1] for x in items)
    total += b
    print(f'\n[{cat}] {len(items)} item(s), {human(b)} reclaimable — {notes[cat]}')
    for path, sz, reason in items:
        if VERBOSE or APPLY:
            print(f'  {"rm" if APPLY else "would rm"} {human(sz):>9}  {path}  ({reason})')
        if APPLY:
            try:
                remove(path); deleted += sz
            except OSError as e:
                errors += 1; print(f'  ! {path}: {e}')
    if items and not (VERBOSE or APPLY):
        by = {}
        for path, sz, _ in items:
            key = re.sub(r'^[0-9a-f]{32}', '*', path.name) if not path.name.startswith(('frame-', 'motion-', 'speech-', 'clips-')) \
                else path.name.split('-')[0] + '-*'
            by.setdefault(key, [0, 0]); by[key][0] += 1; by[key][1] += sz
        for key, (n, sz) in sorted(by.items(), key=lambda kv: -kv[1][1]):
            print(f'  {n:5d} × {key:<22} {human(sz):>9}')
print(f'\nTOTAL reclaimable: {human(total)}' + (f' — deleted {human(deleted)}, errors {errors}' if APPLY else ''))
if gate:
    fcntl.flock(gate, fcntl.LOCK_UN); gate.close()
PY
