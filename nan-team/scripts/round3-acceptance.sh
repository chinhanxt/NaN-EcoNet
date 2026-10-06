#!/usr/bin/env bash
# Round 3 live acceptance (run by root after the rebuild). Steps run strictly one at a time; each
# step takes flock /tmp/nan-live-job.lock, waits for MemAvailable >= 3500 MB and SwapFree >= 1 GB,
# and steps are separated by a 30 s pause.
#   1 idea15   idea 15s 9:16, topic with 3 listed tips
#   2 idea30   idea 30s 9:16
#   3 idea60   idea 60s 9:16 "5 mẹo tiết kiệm điện…" (no facts given: check for invented numbers)
#   4 dialogue source clips on 8saigon (sourceMediaId of live-final-dialogue6-mcp, fresh seed)
#   5 recut    recut revision of job (4) with analysisReuse, no layout passed
#   6 narration 8saigon edit with replace-narration (fresh seed from live-retest-0250-narration2-mcp)
# Usage: scripts/round3-acceptance.sh [--only 1,3|idea15,recut] [--ts <timestamp>] [--dry-run]
#   --ts reuses the receipt names of an earlier run (e.g. --only recut --ts 20261001-120000 to
#   revise the dialogue job of that run). Seeds are written only when missing; terminal receipts are
#   never overwritten (the harnesses refuse them).
# Receipts: reports/openshorts-integration/round3-<ts>-<step>.json, step logs <receipt>.wave.log
# (WAVE_START / WAVE_END exit= secs=), summary round3-<ts>-summary.json.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DRY=0; ONLY=""; TS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1;;
    --only) ONLY=${2:?--only needs a value}; shift;;
    --ts) TS=${2:?--ts needs a value}; shift;;
    *) echo "unknown arg $1" >&2; exit 64;;
  esac
  shift
done
TS=${TS:-$(date +%Y%m%d-%H%M%S)}
[[ "$TS" =~ ^[0-9]{8}-[0-9]{6}$ ]] || { echo "bad --ts $TS" >&2; exit 64; }
R=reports/openshorts-integration
export AI_VIDEO_JOB_DIRECTORY="${AI_VIDEO_JOB_DIRECTORY:-$HOME/.local/share/postiz-dev/ai-video-jobs}"
STEPS=(idea15 idea30 idea60 dialogue recut narration)
selected() { # name index(1-based)
  [ -z "$ONLY" ] && return 0
  local item; IFS=',' read -ra items <<< "$ONLY"
  for item in "${items[@]}"; do [ "$item" = "$1" ] || [ "$item" = "$2" ] && return 0; done
  return 1
}
for item in ${ONLY//,/ }; do
  case "$item" in 1|2|3|4|5|6|idea15|idea30|idea60|dialogue|recut|narration) ;; *) echo "unknown step $item" >&2; exit 64;; esac
done
export R3_IDEA15=round3-$TS-idea15 R3_IDEA30=round3-$TS-idea30 R3_IDEA60=round3-$TS-idea60
export R3_SRC=round3-$TS-dialogue R3_REV=round3-$TS-recut R3_NARR=round3-$TS-narration
export R3_TS=$TS R3_DRY=$DRY R3_SUMMARY=$R/round3-$TS-summary.json

IDEA15_TOPIC='3 mẹo uống đủ nước mỗi ngày cho dân văn phòng: 1) để sẵn bình nước 1 lít trên bàn làm việc; 2) uống một cốc nước sau mỗi lần họp hoặc đi vệ sinh; 3) đặt nhắc nhở uống nước mỗi giờ trên điện thoại. Cảnh minh họa điện ảnh nhất quán, lời kể tiếng Việt tự nhiên; không chữ trong ảnh.'
IDEA30_TOPIC='4 cách giảm căng thẳng khi làm việc tại nhà: 1) tách góc làm việc khỏi giường ngủ; 2) nghỉ 5 phút đứng dậy vận động sau mỗi giờ; 3) tắt thông báo không cần thiết trong giờ tập trung; 4) kết thúc ngày làm việc bằng một danh sách việc cho ngày mai. Cảnh minh họa điện ảnh nhất quán, lời kể tiếng Việt tự nhiên; không chữ trong ảnh.'
# No facts supplied on purpose: every number in the narration must come from the model's own checked facts.
IDEA60_TOPIC='5 mẹo tiết kiệm điện trong gia đình: 1) tắt thiết bị ở chế độ chờ; 2) dùng bóng đèn LED; 3) đặt điều hòa 26 độ; 4) giặt đồ bằng nước lạnh; 5) rút sạc khi pin đầy.'

# Fresh seeds (no jobId, new idempotency keys) only for the selected source steps, only when missing.
NEED_SRC=0; NEED_REV=0; NEED_NARR=0
selected dialogue 4 && NEED_SRC=1
selected recut 5 && NEED_REV=1
selected narration 6 && NEED_NARR=1
export NEED_SRC NEED_REV NEED_NARR
node - <<'EOF' || exit 1
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R='reports/openshorts-integration',file=n=>path.join(R,n+'.json'),read=n=>JSON.parse(fs.readFileSync(file(n),'utf8'));
const seeded=[];
const write=(n,v)=>{if(fs.existsSync(file(n)))return;fs.writeFileSync(file(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});seeded.push(n);};
const keep=(base,keys)=>Object.fromEntries(keys.filter(k=>k in base).map(k=>[k,base[k]]));
if(process.env.NEED_SRC==='1'){
  const base=read('live-final-dialogue6-mcp');
  write(process.env.R3_SRC,{...keep(base,['kind','orgId','sourcePath','sourceSha256','sourceMediaId','sourcePage','expectedTitle','expectedAudio','maxReferenceWer','referenceTranscriptPath','referenceTranscriptNote','covers','policyDecision','limitations']),
    stages:[],input:{...base.input,idempotencyKey:crypto.randomUUID()},seededFrom:'live-final-dialogue6-mcp'});
}
if(process.env.NEED_REV==='1'){
  const rev=read('live-final-dialogue6-revisions');
  // No layout: the revision must inherit the base job's layout.
  write(process.env.R3_REV,{kind:rev.kind,orgId:rev.orgId,baseReport:process.env.R3_SRC,covers:['recut revision reuses base analysis (analysisReuse) without passing layout'],
    revisions:[{label:'R-recut-reuse',segmentsFrom:'base-split',input:{idempotencyKey:crypto.randomUUID(),aspectRatio:'9:16',captions:{enabled:true,style:'karaoke'},reviewBeforeRender:false},expect:{aspectRatio:'9:16'}}]});
}
if(process.env.NEED_NARR==='1'){
  const base=read('live-retest-0250-narration2-mcp');
  write(process.env.R3_NARR,{...keep(base,['kind','orgId','sourceMediaId','sourceSha256','expectedAudio','expectedDurationSeconds','maxReferenceWer','expectedTitle','purpose']),
    stages:[],input:{...base.input,idempotencyKey:crypto.randomUUID()},seededFrom:'live-retest-0250-narration2-mcp'});
}
fs.writeFileSync(path.join(R,`.round3-${process.env.R3_TS}.seeded`),seeded.join('\n'));
console.log(JSON.stringify({ts:process.env.R3_TS,seeded}));
EOF

FIRST=1
run_step() { # name report cmd...
  local name=$1 report=$2; shift 2
  local log=$R/$report.wave.log
  if [ "$FIRST" = 0 ]; then echo "== pause 30s"; [ "$DRY" = 1 ] || sleep 30; fi
  FIRST=0
  echo "== $(date +%T) step $name ($report)"
  if [ "$DRY" = 1 ]; then echo "DRY: flock /tmp/nan-live-job.lock <MemAvailable>=3500MB, SwapFree>=1024MB> $*"; return 0; fi
  flock /tmp/nan-live-job.lock bash -c '
    while :; do
      a=$(awk "/MemAvailable/{print int(\$2/1024)}" /proc/meminfo); s=$(awk "/SwapFree/{print int(\$2/1024)}" /proc/meminfo)
      [ "$a" -ge "${ACCEPT_MIN_AVAIL_MB:-3500}" ] && [ "$s" -ge "${ACCEPT_MIN_SWAP_MB:-1024}" ] && break
      echo "$(date +%T) wait MemAvailable=${a}MB SwapFree=${s}MB"; sleep 15
    done
    start=$(date +%s); echo "WAVE_START $start MemAvailable=${a}MB SwapFree=${s}MB"
    "$@"; code=$?
    end=$(date +%s); echo "WAVE_END $end exit=$code secs=$((end-start))"; exit $code' _ "$@" 2>&1 | tee -a "$log"
}

echo "== dry-run validation (offline)"
[ "$NEED_SRC" = 1 ] && { node scripts/test-source-video-mcp-live.cjs "$R3_SRC" --dry-run || true; }
[ "$NEED_REV" = 1 ] && { node scripts/test-source-video-revisions-live.cjs "$R3_REV" --dry-run || true; }
[ "$NEED_NARR" = 1 ] && { node scripts/test-source-video-mcp-live.cjs "$R3_NARR" --dry-run || true; }
node --check scripts/test-ai-video-mcp-live.cjs && echo '{"ideaHarness":"syntax ok"}'

selected idea15 1 && run_step idea15 "$R3_IDEA15" env AI_VIDEO_ASPECT=9:16 AI_VIDEO_DURATION=15 AI_VIDEO_TOPIC="$IDEA15_TOPIC" node scripts/test-ai-video-mcp-live.cjs "$R3_IDEA15"
selected idea30 2 && run_step idea30 "$R3_IDEA30" env AI_VIDEO_ASPECT=9:16 AI_VIDEO_DURATION=30 AI_VIDEO_TOPIC="$IDEA30_TOPIC" node scripts/test-ai-video-mcp-live.cjs "$R3_IDEA30"
selected idea60 3 && run_step idea60 "$R3_IDEA60" env AI_VIDEO_ASPECT=9:16 AI_VIDEO_DURATION=60 AI_VIDEO_TOPIC="$IDEA60_TOPIC" node scripts/test-ai-video-mcp-live.cjs "$R3_IDEA60"
selected dialogue 4 && run_step dialogue "$R3_SRC" nice -n 5 node scripts/test-source-video-mcp-live.cjs "$R3_SRC"
selected recut 5 && run_step recut "$R3_REV" nice -n 5 node scripts/test-source-video-revisions-live.cjs "$R3_REV"
selected narration 6 && run_step narration "$R3_NARR" nice -n 5 node scripts/test-source-video-mcp-live.cjs "$R3_NARR"

# Summary: per step exit code, seconds, pass flags; idea60 also lists narration numbers absent from grounding facts.
node - <<'EOF'
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const R='reports/openshorts-integration',dry=process.env.R3_DRY==='1';
const read=n=>{try{return JSON.parse(fs.readFileSync(path.join(R,n+'.json'),'utf8'));}catch{return undefined;}};
const timing=n=>{try{const log=fs.readFileSync(path.join(R,n+'.wave.log'),'utf8');const e=[...log.matchAll(/WAVE_END (\d+) exit=(\d+) secs=(\d+)/g)].at(-1);
  return e?{exitCode:+e[2],totalSeconds:+e[3]}:{exitCode:null,totalSeconds:null};}catch{return {exitCode:null,totalSeconds:null};}};
const inventedNumbers=r=>{try{const sb=JSON.parse(fs.readFileSync(path.join(process.env.AI_VIDEO_JOB_DIRECTORY,`${r.jobId}.storyboard.json`),'utf8'));
  const facts=(sb.grounding?.facts||[]).map(f=>f.claim).join(' '),num=s=>(s.match(/\d+(?:[.,]\d+)?/g)||[]);
  const known=new Set(num(facts));return [...new Set(sb.scenes.flatMap(s=>num(s.voiceText)))].filter(n=>!known.has(n));}catch{return null;}};
const steps=[];
for(const [step,env] of [['idea15','R3_IDEA15'],['idea30','R3_IDEA30'],['idea60','R3_IDEA60'],['dialogue','R3_SRC'],['recut','R3_REV'],['narration','R3_NARR']]){
  const n=process.env[env],r=read(n);if(!r||!fs.existsSync(path.join(R,n+'.wave.log')))continue;
  const entry={step,report:n,...timing(n),technicalPipelinePassed:r.technicalPipelinePassed??null,passed:r.passed??null,jobId:r.jobId??null,
    mediaId:r.artifact?.mediaId??null,error:r.observationError??r.final?.error??null};
  if(step.startsWith('idea'))Object.assign(entry,{stageTimes:r.stageTimes??null,...(step==='idea60'&&r.jobId?{numbersNotInFacts:inventedNumbers(r)}:{})});
  if(step==='recut'){const res=r.results?.['R-recut-reuse'];let reuse=null;
    if(res?.jobId){const dir=path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY||path.join(os.homedir(),'.local/share/nan-team/source-video-jobs'),res.jobId);
      for(const a of fs.existsSync(dir)?fs.readdirSync(dir):[]){try{const c=JSON.parse(fs.readFileSync(path.join(dir,a,'analysis-checkpoint.json'),'utf8'));if(c?.data?.analysisReuse)reuse=c.data.analysisReuse;}catch{}}}
    Object.assign(entry,{jobId:res?.jobId??null,functionalPassed:res?.functionalPassed??null,mediaId:res?.artifact?.mediaId??null,analysisReuse:reuse});}
  steps.push(entry);
}
const summary={round:3,ts:process.env.R3_TS,dryRun:dry,finishedAt:new Date().toISOString(),steps};
if(!dry){const f=process.env.R3_SUMMARY;fs.writeFileSync(fs.existsSync(f)?f.replace(/\.json$/,`-${Date.now()}.json`):f,JSON.stringify(summary,null,2)+'\n');}
console.log(JSON.stringify(summary,null,1));
EOF

if [ "$DRY" = 1 ]; then
  while read -r seed; do [ -n "$seed" ] && rm -f "$R/$seed.json"; done < "$R/.round3-$TS.seeded"
  echo "dry-run: seeds removed, no jobs started"
fi
rm -f "$R/.round3-$TS.seeded"
