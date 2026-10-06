#!/usr/bin/env bash
# Kiểm tra nhanh (<60 s, chỉ đọc) sức khỏe video-agent / Fast read-only video-agent health check.
# Usage: scripts/nan-video-smoke.sh        Exit code: 0 = PASS/WARN only, 1 = at least one FAIL.
# Không tạo job, không in API key / Never starts jobs, never prints keys.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POOL_BASE="${AGY_POOL_BASE_PORT:-8911}"
ACCOUNTS="${AGYXT_ACCOUNTS:-$HOME/.config/antigravity-switcher/accounts.json}"
if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; N=$'\e[0m'; else G= R= Y= N=; fi
ROWS=(); FAILS=0
add() { # add STATUS "check (vi / en)" "detail"
  ROWS+=("$1|$2|$3"); if [[ "$1" == FAIL ]]; then FAILS=$((FAILS + 1)); fi; return 0
}
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-3}" "$1" 2>/dev/null || echo 000; }
tcp_up() { (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

# 1. Core services / Dịch vụ lõi
c=$(http_code http://127.0.0.1:3000/); [[ "$c" =~ ^[23] ]] && add PASS "Backend :3000" "HTTP $c" || add FAIL "Backend :3000" "HTTP $c"
o=$(curl -s --max-time 3 http://127.0.0.1:3002/health/status 2>/dev/null)
[[ "$o" == *'"ok"'* ]] && add PASS "Orchestrator :3002" "health ok" || add FAIL "Orchestrator :3002" "health: ${o:-no response}"
tcp_up 7233 && add PASS "Temporal :7233" "reachable / kết nối được" || add FAIL "Temporal :7233" "not reachable / không kết nối được"

# 2. Authenticated MCP (tools/list, capabilities, latest completed jobs) / MCP có xác thực
mcp_out=$(cd "$ROOT" && timeout 45 node - <<'EOF' 2>&1
'use strict';
require('dotenv').config({ path: require('node:path').resolve(process.cwd(), '.env'), quiet: true });
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const out = (status, name, detail) => console.log(`${status}|${name}|${String(detail).replace(/[|\n]/g, ' ').slice(0, 160)}`);
const REQUIRED = ['processSourceVideoTool', 'sourceVideoStatusTool', 'approveSourceVideoTool', 'editVideoClipTool',
  'sourceVideoCapabilitiesTool', 'generateAiVideoTool', 'aiVideoStatusTool'];
(async () => {
  const prisma = new PrismaClient();
  const client = new Client({ name: 'nan-video-smoke', version: '1.0.0' });
  try {
    // Latest completed source job picks the organization; otherwise any org that already has an API key.
    const keyed = await prisma.organization.findMany({ where: { apiKey: { not: null } }, select: { id: true, apiKey: true } });
    const job = await prisma.sourceVideoJob.findFirst({ where: { status: 'completed', orgId: { in: keyed.map((o) => o.id) } }, orderBy: { updatedAt: 'desc' }, select: { id: true, orgId: true } });
    const org = keyed.find((o) => o.id === job?.orgId) || keyed[0];
    if (!org) { out('WARN', 'MCP auth', 'no organization with an API key; skipped (read-only check never creates keys)'); return; }
    const url = new URL('/mcp', process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000');
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${org.apiKey}` } } }));
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    const missing = REQUIRED.filter((name) => !names.includes(name));
    out(missing.length ? 'FAIL' : 'PASS', 'MCP tools/list', missing.length ? `missing: ${missing.join(', ')}` : `${names.length} tools, ${REQUIRED.length} video tools present`);
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 20000 });
      return JSON.parse(result.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n'));
    };
    const caps = await call('sourceVideoCapabilitiesTool', {});
    out(caps.prerequisitesPresent ? 'PASS' : 'FAIL', 'Source-video capabilities / Năng lực', caps.prerequisitesPresent ? 'prerequisitesPresent=true' : `prerequisites missing: ${JSON.stringify(caps).slice(0, 120)}`);
    if (job) {
      const state = await call('sourceVideoStatusTool', { jobId: job.id });
      const media = state.clips?.[0]?.media?.id;
      out(state.status === 'completed' && media ? 'PASS' : 'WARN', 'Latest source job / Job edit gần nhất', `${job.id.slice(0, 8)} ${state.status}${media ? ` media ${media.slice(0, 8)}` : ''}`);
    } else out('WARN', 'Latest source job / Job edit gần nhất', 'no completed source job yet');
    const dir = path.resolve(process.env.AI_VIDEO_JOB_DIRECTORY || path.join(os.tmpdir(), 'nan-ai-video-jobs'));
    const ideas = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => /^[0-9a-f-]{36}\.json$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)
      .map(({ f }) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return {}; } })
      .filter((j) => j.status === 'completed' && j.orgId === org.id);
    if (ideas[0]) {
      const state = await call('aiVideoStatusTool', { jobId: ideas[0].jobId });
      out(state.status === 'completed' && state.media?.id ? 'PASS' : 'WARN', 'Latest idea job / Job ý tưởng gần nhất', `${ideas[0].jobId.slice(0, 8)} ${state.status}${state.media?.id ? ` media ${state.media.id.slice(0, 8)}` : ''}`);
    } else out('WARN', 'Latest idea job / Job ý tưởng gần nhất', `no completed idea job record in ${dir}`);
  } catch (error) {
    out('FAIL', 'MCP', error.message);
  } finally {
    await client.close().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
})();
EOF
)
while IFS='|' read -r s n d; do
  [[ "$s" =~ ^(PASS|WARN|FAIL)$ ]] && add "$s" "$n" "$d"
done <<<"$mcp_out"
grep -qE '^(PASS|WARN|FAIL)\|' <<<"$mcp_out" || add FAIL "MCP" "$(tail -1 <<<"$mcp_out" | cut -c1-160)"

# 3. Voice Clone
v=$(curl -s --max-time 3 http://127.0.0.1:8002/health 2>/dev/null)
if [[ "$v" == *'"status":"ok"'* ]]; then add PASS "Voice Clone :8002" "$(python3 -c 'import json,sys;r=json.loads(sys.argv[1]);print(r.get("device"),len(r.get("cached_voices",[])),"voices")' "$v" 2>/dev/null)"
else add WARN "Voice Clone :8002" "down: narration/voice-clone voices unavailable (start: scripts/nan-video-stack.sh start)"; fi

# 4. AGY proxy pool: ports + per-app cooldown snapshots
count=$(python3 -c 'import json,sys;print(len(json.load(open(sys.argv[1]))))' "$ACCOUNTS" 2>/dev/null || echo 6)
up=0; down=()
for ((i = 0; i < count; i++)); do p=$((POOL_BASE + i)); tcp_up "$p" && up=$((up + 1)) || down+=("$p"); done
if ((up == count)); then add PASS "AGY proxy pool" "$up/$count ports up ($POOL_BASE-$((POOL_BASE + count - 1)))"
elif ((up > 0)); then add WARN "AGY proxy pool" "$up/$count up; down: ${down[*]}"
else add WARN "AGY proxy pool" "0/$count up: AGY uses native OAuth only (scripts/agy-proxy-pool.sh start)"; fi
# Provider cooldowns from the per-app snapshots written by AgyMcpService (no credentials inside).
pool_rows=$(python3 - "${XDG_DATA_HOME:-$HOME/.local/share}/nan-team" <<'EOF'
import glob, json, os, sys, time
from datetime import datetime
files = sorted(glob.glob(os.path.join(sys.argv[1], 'agy-pool-state-*.json')))
if not files:
    print('WARN|AGY pool state / Trạng thái pool|no snapshot yet (written by backend/orchestrator after the next build/start)')
for path in files:
    app = os.path.basename(path)[len('agy-pool-state-'):-5]
    try:
        state = json.load(open(path))
        age = time.time() - datetime.fromisoformat(state['updatedAt'].replace('Z', '+00:00')).timestamp()
    except Exception as error:
        print(f'WARN|AGY pool {app}|unreadable snapshot: {error}'); continue
    providers = state.get('providers') or []
    cooling = [p for p in providers if not p.get('active')]
    detail = f"{len(providers) - len(cooling)}/{len(providers)} ready, {sum(p.get('inFlight', 0) for p in providers)} in flight, {age / 60:.0f} min old"
    if cooling:
        detail += '; cooling: ' + ', '.join(f"{p['url'].rstrip('/').rsplit(':', 1)[-1]} until {p['cooldownUntil'][11:19]}Z ({p.get('reason') or '?'})" for p in cooling)
    errors = [p for p in providers if p.get('lastError')]
    if errors:
        latest = max(errors, key=lambda p: p.get('lastErrorAt') or '')
        detail += f"; last error {latest['url'].rstrip('/').rsplit(':', 1)[-1]}: {latest['lastError'][:60]}"
    status = 'WARN' if age > 600 or (providers and len(cooling) == len(providers)) else 'PASS'
    if age > 600: detail += ' (stale >10 min: process not writing?)'
    print(f'{status}|AGY pool {app} / Pool AGY|{detail}'.replace('\n', ' '))
EOF
)
while IFS='|' read -r s n d; do [[ "$s" =~ ^(PASS|WARN|FAIL)$ ]] && add "$s" "$n" "$d"; done <<<"$pool_rows"

# 5. Frontend (optional)
f=$(http_code http://127.0.0.1:4200/ 5)
[[ "$f" =~ ^[23] ]] && add PASS "Frontend :4200" "HTTP $f" || add WARN "Frontend :4200" "not running (optional / tùy chọn)"

# 6. Resources / Tài nguyên
mem=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
if ((mem >= 3500)); then add PASS "RAM MemAvailable" "${mem} MB"; elif ((mem >= 2000)); then add WARN "RAM MemAvailable" "${mem} MB (<3.5 GB: live jobs will wait)"; else add FAIL "RAM MemAvailable" "${mem} MB"; fi
for d in "$HOME/.local/share" /tmp; do
  free_gb=$(df -BG --output=avail "$d" 2>/dev/null | tail -1 | tr -dc 0-9)
  if ((free_gb >= 20)); then add PASS "Disk $d" "${free_gb} GB free"; elif ((free_gb >= 5)); then add WARN "Disk $d" "${free_gb} GB free"; else add FAIL "Disk $d" "${free_gb} GB free"; fi
done

# Report / Kết quả
printf '\n%-6s  %-40s  %s\n' "KQ" "Kiểm tra / Check" "Chi tiết / Detail"
printf '%s\n' "------  ----------------------------------------  ------------------------------"
for row in "${ROWS[@]}"; do
  IFS='|' read -r s n d <<<"$row"
  case "$s" in PASS) col=$G ;; WARN) col=$Y ;; *) col=$R ;; esac
  printf '%s%-6s%s  %-40s  %s\n' "$col" "$s" "$N" "$n" "$d"
done
if ((FAILS)); then echo; echo "${R}FAIL: $FAILS mục lỗi / check(s) failed${N}"; exit 1; fi
echo; echo "${G}OK: video-agent sẵn sàng / video agent healthy${N}"
