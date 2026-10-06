#!/usr/bin/env bash
# Final live wave (run right after the backend rebuild). Steps run one at a time, each under
# flock /tmp/nan-live-job.lock, and each waits for MemAvailable >= 3.5 GB (no swap gate).
#   1 idea 15s (9:16, 3 listed tips)          2 source clips on 8saigon (fresh seed)
#   3 recut revision on that base (analysisReuse)  4 T1 narration rerun (live-retest-0250-narration2-mcp)
#   5 idea 60s (only with --with-60s)
# Usage: scripts/final-live-wave.sh [--dry-run] [--with-60s]
# Summary: reports/openshorts-integration/final-live-wave-<timestamp>.json; passing mp4s are copied
# to ~/Videos/NaN-demo-20260930/ with the next free numbers.
set -uo pipefail
ROOT=/home/chinhan/MMO/NaN-Team
cd "$ROOT"
DRY=0; WITH60=0
for arg in "$@"; do case "$arg" in --dry-run) DRY=1;; --with-60s) WITH60=1;; *) echo "unknown arg $arg" >&2; exit 64;; esac; done
TS=$(date +%Y%m%d-%H%M%S)
R=reports/openshorts-integration
export AI_VIDEO_JOB_DIRECTORY=/home/chinhan/.local/share/postiz-dev/ai-video-jobs
export WAVE_TS=$TS WAVE_DRY=$DRY WAVE_WITH60=$WITH60
export WAVE_IDEA15=final-wave-$TS-idea15 WAVE_SRC=final-wave-$TS-dialogue WAVE_REV=final-wave-$TS-revisions
export WAVE_NARR=live-retest-0250-narration2-mcp WAVE_IDEA60=final-wave-$TS-idea60
export WAVE_SUMMARY=$R/final-live-wave-$TS.json
IDEA15_TOPIC='3 mẹo ngủ ngon cho người làm việc muộn. Sự thật: người trưởng thành cần 7–9 giờ ngủ mỗi đêm (Quỹ Giấc ngủ Quốc gia Hoa Kỳ); ánh sáng xanh từ màn hình làm chậm tiết melatonin. Ba mẹo: 1) tắt màn hình 30 phút trước khi ngủ; 2) giữ phòng ngủ mát khoảng 18–20°C; 3) đi ngủ và thức dậy cùng một giờ mỗi ngày, kể cả cuối tuần. Cảnh minh họa điện ảnh nhất quán, lời kể tiếng Việt tự nhiên; không chữ trong ảnh.'
IDEA60_TOPIC='Tiết kiệm điện mùa nóng cho gia đình. Sự thật: mỗi độ tăng nhiệt độ cài đặt điều hòa giúp giảm khoảng 3–5% điện năng tiêu thụ; nhiệt độ khuyến nghị là 26–28°C (Bộ Công Thương); thiết bị ở chế độ chờ vẫn tiêu thụ điện. Mẹo: 1) đặt điều hòa 26–28°C kèm quạt; 2) vệ sinh lưới lọc điều hòa định kỳ; 3) rút phích thiết bị không dùng; 4) dùng đèn LED; 5) phơi đồ tự nhiên thay máy sấy. Cảnh minh họa điện ảnh nhất quán, lời kể tiếng Việt tự nhiên; không chữ trong ảnh.'

# Fresh seeds (no jobId, new idempotency keys). Dry-run seeds are removed at the end.
node - <<'EOF' || exit 1
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R='reports/openshorts-integration',read=n=>JSON.parse(fs.readFileSync(path.join(R,n+'.json'),'utf8'));
const write=(n,v)=>{const f=path.join(R,n+'.json');if(fs.existsSync(f))throw new Error('refusing to overwrite '+f);fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
const base=read('live-final-dialogue6-mcp');
const keep=['kind','orgId','sourcePath','sourceSha256','sourceMediaId','sourcePage','expectedTitle','expectedAudio','maxReferenceWer','referenceTranscriptPath','referenceTranscriptNote','covers','policyDecision','limitations'];
const seed=Object.fromEntries(keep.filter(k=>k in base).map(k=>[k,base[k]]));
seed.stages=[];seed.input={...base.input,idempotencyKey:crypto.randomUUID()};seed.seededFrom='live-final-dialogue6-mcp';
write(process.env.WAVE_SRC,seed);
const rev=read('live-final-dialogue6-revisions');
write(process.env.WAVE_REV,{kind:rev.kind,orgId:rev.orgId,baseReport:process.env.WAVE_SRC,covers:['recut revision reuses base analysis (analysisReuse)'],
  revisions:[{label:'R-recut-reuse',segmentsFrom:'base-split',input:{idempotencyKey:crypto.randomUUID(),aspectRatio:'9:16',captions:{enabled:true,style:'karaoke'},reviewBeforeRender:false},expect:{aspectRatio:'9:16'}}]});
console.log(JSON.stringify({seeded:[process.env.WAVE_SRC,process.env.WAVE_REV]}));
EOF

run_step() { # name report cmd...
  local name=$1 report=$2; shift 2
  local log=$R/$report.wave.log
  echo "== $(date +%T) step $name ($report)"
  if [ "$DRY" = 1 ]; then echo "DRY: flock /tmp/nan-live-job.lock <gate MemAvailable>=3.5GB> $*"; return 0; fi
  flock /tmp/nan-live-job.lock bash -c '
    until a=$(awk "/MemAvailable/{print int(\$2/1024)}" /proc/meminfo); [ "$a" -ge 3500 ]; do echo "$(date +%T) wait MemAvailable=${a}MB"; sleep 15; done
    echo "WAVE_START $(date +%s) MemAvailable=${a}MB"; "$@"; code=$?; echo "WAVE_END $(date +%s) exit=$code"; exit $code' _ "$@" 2>&1 | tee "$log"
}

# Offline validation of every seed / harness (no network, no dispatch).
echo "== dry-run validation"
node scripts/test-source-video-mcp-live.cjs "$WAVE_SRC" --dry-run || true
node scripts/test-source-video-revisions-live.cjs "$WAVE_REV" --dry-run || true
node scripts/test-source-video-mcp-live.cjs "$WAVE_NARR" --dry-run || true
node --check scripts/test-ai-video-mcp-live.cjs && echo '{"ideaHarness":"syntax ok"}'

run_step idea15 "$WAVE_IDEA15" env AI_VIDEO_ASPECT=9:16 AI_VIDEO_DURATION=15 AI_VIDEO_TOPIC="$IDEA15_TOPIC" node scripts/test-ai-video-mcp-live.cjs "$WAVE_IDEA15"
run_step source-clips "$WAVE_SRC" nice -n 5 node scripts/test-source-video-mcp-live.cjs "$WAVE_SRC"
run_step recut-revision "$WAVE_REV" nice -n 5 node scripts/test-source-video-revisions-live.cjs "$WAVE_REV"
run_step narration-rerun "$WAVE_NARR" nice -n 5 node scripts/test-source-video-mcp-live.cjs "$WAVE_NARR"
if [ "$WITH60" = 1 ]; then
  run_step idea60 "$WAVE_IDEA60" env AI_VIDEO_ASPECT=9:16 AI_VIDEO_DURATION=60 AI_VIDEO_TOPIC="$IDEA60_TOPIC" node scripts/test-ai-video-mcp-live.cjs "$WAVE_IDEA60"
fi

# Summary + demo copies.
node - <<'EOF'
require('dotenv').config({path:'.env',quiet:true});
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const R='reports/openshorts-integration',dry=process.env.WAVE_DRY==='1';
const read=n=>{try{return JSON.parse(fs.readFileSync(path.join(R,n+'.json'),'utf8'));}catch{return undefined;}};
const timing=n=>{try{const log=fs.readFileSync(path.join(R,n+'.wave.log'),'utf8');const s=+(log.match(/WAVE_START (\d+)/)||[])[1],e=log.match(/WAVE_END (\d+) exit=(\d+)/);
  return {totalSeconds:e&&s?+e[1]-s:null,exitCode:e?+e[2]:null};}catch{return {totalSeconds:null,exitCode:null};}};
const demo=path.join(os.homedir(),'Videos/NaN-demo-20260930');
const nextNumber=()=>Math.max(0,...fs.readdirSync(demo).map(f=>+(f.match(/^(\d+)-/)||[])[1]||0))+1;
const uploadFile=async mediaId=>{if(!mediaId)return;const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
  try{const m=await db.media.findUnique({where:{id:mediaId},select:{path:true}});const prefix=process.env.FRONTEND_URL+'/uploads/';
    if(m?.path?.startsWith(prefix))return path.join(process.env.UPLOAD_DIRECTORY,decodeURIComponent(m.path.slice(prefix.length)));}finally{await db.$disconnect();}};
const copy=(src,label)=>{if(dry||!src||!fs.existsSync(src))return null;const dst=path.join(demo,`${String(nextNumber()).padStart(2,'0')}-${label}.mp4`);fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);return dst;};
(async()=>{
  const steps=[];
  const idea=async(n,label)=>{const r=read(n),t=timing(n);const ok=r?.technicalPipelinePassed===true;
    steps.push({step:label,report:n,...t,technicalPipelinePassed:ok,passed:r?.passed??null,qualityGate:r?.quality??null,mediaId:r?.artifact?.mediaId??null,
      stageTimes:r?.stageTimes??null,error:r?.observationError??null,demo:ok?copy(path.join(R,n+'.mp4'),label):null});};
  const source=async(n,label,extra={})=>{const r=read(n),t=timing(n);const ok=r?.technicalPipelinePassed===true;const pr=r?.postRunReview;
    let narration;if(extra.expectCaption&&pr?.captions?.assFile){try{const ass=fs.readFileSync(pr.captions.assFile,'utf8').replace(/\{[^}]*\}/g,'').normalize('NFC').toUpperCase();
      narration={expected:extra.expectCaption,found:ass.includes(extra.expectCaption.normalize('NFC').toUpperCase())};}catch(e){narration={expected:extra.expectCaption,error:e.message};}}
    steps.push({step:label,report:n,...t,technicalPipelinePassed:ok,passed:r?.passed??null,jobId:r?.jobId??null,mediaId:r?.artifact?.mediaId??null,
      qualityGate:pr?{hookClearancePassed:pr.hookClearance?.passed??null,captionTimingMismatches:pr.captions?.timingMismatchCount??null,automatedReviewPassed:pr.passed}:null,
      narrationCaption:narration??undefined,demo:ok?copy(await uploadFile(r?.artifact?.mediaId),label):null});};
  await idea(process.env.WAVE_IDEA15,'final-y-tuong-15s-3-meo-ngu-ngon');
  await source(process.env.WAVE_SRC,'final-edit-8saigon-clips');
  {const n=process.env.WAVE_REV,r=read(n),t=timing(n),res=r?.results?.['R-recut-reuse'];let reuse=null;
    if(res?.jobId){const dir=path.join(process.env.SOURCE_VIDEO_JOB_DIRECTORY||path.join(os.homedir(),'.local/share/nan-team/source-video-jobs'),res.jobId);
      for(const a of fs.existsSync(dir)?fs.readdirSync(dir):[]){try{const c=JSON.parse(fs.readFileSync(path.join(dir,a,'analysis-checkpoint.json'),'utf8'));if(c?.data?.analysisReuse)reuse=c.data.analysisReuse;}catch{}}}
    const ok=res?.functionalPassed===true;
    steps.push({step:'recut-revision',report:n,...t,technicalPipelinePassed:r?.technicalPipelinePassed??null,functionalPassed:res?.functionalPassed??null,passed:r?.passed??null,
      jobId:res?.jobId??null,mediaId:res?.artifact?.mediaId??null,analysisReuse:reuse,
      qualityGate:res?.postRunReview?{hookClearancePassed:res.postRunReview.hookClearance?.passed??null,captionTimingMismatches:res.postRunReview.captions?.timingMismatchCount??null}:null,
      demo:ok?copy(await uploadFile(res?.artifact?.mediaId),'final-recut-reuse'):null});}
  await source(process.env.WAVE_NARR,'final-thuyet-minh-narration',{expectCaption:'XE TẢI TÔNG TRÚNG'});
  if(process.env.WAVE_WITH60==='1')await idea(process.env.WAVE_IDEA60,'final-y-tuong-60s-tiet-kiem-dien');
  const summary={wave:process.env.WAVE_TS,dryRun:dry,finishedAt:new Date().toISOString(),with60s:process.env.WAVE_WITH60==='1',steps};
  if(!dry)fs.writeFileSync(process.env.WAVE_SUMMARY,JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,1));
})().catch(e=>{console.error(e);process.exitCode=1;});
EOF

if [ "$DRY" = 1 ]; then rm -f "$R/$WAVE_SRC.json" "$R/$WAVE_REV.json"; echo "dry-run: seeds removed, no jobs started"; fi
