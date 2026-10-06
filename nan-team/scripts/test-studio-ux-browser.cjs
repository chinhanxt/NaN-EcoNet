'use strict';
// Usage (low memory: one headless Chrome, closed at the end):
//   systemd-run --user --scope -p MemoryMax=1500M -p MemorySwapMax=128M nice -n 10 \
//     node scripts/test-studio-ux-browser.cjs --receipt <name.json> [--dry] [--topic "..."] [--idea-timeout-min 20]
//  --quick source retry (create+cancel) + idea job sampled ≥2 min until the storyboard preview shows (max 10 min), then
//          cancelled via UI. Every job the test created is recorded in receipt.jobs; any still running at the end (test
//          failed/timed out) is cancelled in `finally` via DELETE /ai-video/:jobId or DELETE /ai-video/source-jobs/:jobId.
//          Every progress sample (percent/step/stage/ETA) is kept in receipt.checks.idea.samples for after-the-fact checks.
//  --dry   only checks that /agents/new loads for the fixture user and both studio tabs open (no job is created).
//  full    (after the frontend/backend rebuild) checks, with write-once receipt + screenshots in
//          reports/openshorts-integration/frontend-selftest/:
//   1. Idea studio: "⚡ Tạo video ngay" (15 s) starts a real job; stepper/progress/ETA only move forward; scene previews
//      appear as images finish; "Dữ kiện AI tự kiểm…" label; completion view ("Video đã sẵn sàng").
//   2. Source studio: a failed/cancelled job from history → "Thử lại với cùng cấu hình" creates a NEW job via
//      POST /ai-video/source-jobs/:id/retry; stepper/progress render; the new job is cancelled right away.
//   3. Warnings/errors shown to the user are Vietnamese (no raw English warning/stage ids).
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{sign}=require('jsonwebtoken');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const reports=path.join(root,'reports/openshorts-integration');
const option=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);if(i<0)return fallback;const v=process.argv[i+1];assert.ok(v&&!v.startsWith('--'),`--${name} needs a value`);return v;};
const flag=name=>process.argv.includes(`--${name}`);
const QUICK_SAMPLE_MS=2*60000,QUICK_MAX_MS=10*60000;
const BACKEND=(process.env.NEXT_PUBLIC_BACKEND_URL||'http://localhost:3000').replace(/\/$/,''),TERMINAL=new Set(['completed','failed','cancelled']);
const VIETNAMESE=/[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/** Samples must never decrease (percent) and the step index must never go back. */
const assertMonotonic=(samples,key,label)=>{for(let i=1;i<samples.length;i++)assert.ok(samples[i][key]>=samples[i-1][key],`${label} went back: ${samples[i-1][key]} → ${samples[i][key]} (sample ${i})`);};
const assertVietnamese=(lines,label)=>{for(const line of lines)assert.ok(VIETNAMESE.test(line),`${label} not Vietnamese: ${line}`);};

async function main(){
 const dry=flag('dry'),quick=flag('quick'),fixture=require(path.join(reports,'live-source-job.json'));
 const receiptName=option('receipt');assert.ok(receiptName&&receiptName.endsWith('.json')&&path.basename(receiptName)===receiptName,'--receipt <name.json>');
 const directory=path.join(reports,'frontend-selftest');await fs.mkdir(directory,{recursive:true});
 const prefix=receiptName.slice(0,-5),file=suffix=>path.join(directory,`${prefix}.${suffix}`);
 const shots=['loaded.png','idea-progress.png','idea-complete.png','idea-cancelled.png','source-retry.png','failure.png'];
 for(const name of [receiptName,...shots.map(s=>`${prefix}.${s}`)])
  await fs.access(path.join(directory,name)).then(()=>{throw new Error(`${name} exists; write-once`);},()=>{});
 const evidence={kind:'studio-ux-browser',mode:dry?'dry':quick?'quick':'full',checkedAt:new Date().toISOString(),orgId:fixture.orgId,pageErrors:[],apiResponses:[],jobs:[],checks:{},
  policy:{browsers:1,headless:true,sourceJobsCreatedAndCancelled:dry?0:1,ideaJobs:dry?0:1,publishPost:false}};
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--disable-gpu','--disable-dev-shm-usage','--renderer-process-limit=1']});
 let page,context;const pendingJobs=[];
 // Every job this test creates (idea start / source retry), captured from the network so cleanup works even if an assert fails early.
 const track=(kind,jobId)=>{if(jobId&&!evidence.jobs.some(j=>j.jobId===jobId))evidence.jobs.push({kind,jobId,cancelledBy:null});};
 const markCancelled=jobId=>{const job=evidence.jobs.find(j=>j.jobId===jobId);if(job)job.cancelledBy='ui';};
 try{
  context=await browser.newContext({baseURL:'http://localhost:4200',viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'auth',value:sign({id:fixture.userId},process.env.JWT_SECRET,{expiresIn:'60m'}),domain:'localhost',path:'/',httpOnly:true},
   {name:'showorg',value:fixture.orgId,domain:'localhost',path:'/'}]);
  page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>evidence.pageErrors.push(e.message));
  page.on('response',r=>{const p=new URL(r.url()).pathname;if(/\/ai-video\//.test(p)&&r.request().method()!=='GET')evidence.apiResponses.push({method:r.request().method(),path:p,status:r.status()});
   if(r.request().method()==='POST'&&r.ok()){const kind=p.endsWith('/ai-video/generate')?'idea':/\/ai-video\/source-jobs(\/[0-9a-f-]{36}\/(retry|revisions))?$/.test(p)?'source':null;
    if(kind)pendingJobs.push(r.json().then(b=>track(kind,b?.jobId),()=>{}));}});
  await page.goto('/agents/new',{waitUntil:'domcontentloaded',timeout:480000});
  await page.getByRole('button',{name:/Tạo Video AI/}).first().click({timeout:300000});
  const dialog=page.getByRole('dialog',{name:'AI Video Studio'});await dialog.waitFor();
  await page.getByRole('tab',{name:'Tạo từ ý tưởng',exact:true}).waitFor();
  await page.getByRole('button',{name:/Tạo video ngay/}).waitFor();
  await page.getByRole('tab',{name:'Chỉnh video có sẵn',exact:true}).click();
  await page.getByText('Lịch sử dự án',{exact:true}).waitFor();
  await page.screenshot({path:file('loaded.png'),fullPage:true});
  evidence.checks.loaded={ideaTab:true,sourceTab:true,ideaQuickButton:true,passed:true};
  if(dry){assert.deepEqual(evidence.pageErrors,[],'page errors');evidence.passed=true;console.log(JSON.stringify(evidence.checks,null,1));return;}

  // 2. Source studio retry (runs first: it is quick and cancels its job before the long idea run).
  const history=page.locator('details').filter({has:page.getByText('Lịch sử dự án',{exact:true})});
  await history.locator('summary').click();
  // History loads via SWR; "Chưa có dự án" is also shown while it is loading, so wait for the first row.
  await history.getByRole('button').first().waitFor({timeout:90000});
  const rows=history.getByRole('button',{name:/Xử lý thất bại|Đã hủy/});
  const candidates=Math.min(3,await rows.count());assert.ok(candidates>0,'no failed/cancelled source job in history');
  const source={attempts:[]};
  for(let i=0;i<candidates&&!source.newJobId;i++){
   await rows.nth(i).click();
   const retryButton=page.getByRole('button',{name:'Thử lại với cùng cấu hình'});await retryButton.waitFor();
   const [response]=await Promise.all([page.waitForResponse(r=>/\/ai-video\/source-jobs\/[0-9a-f-]{36}\/retry$/.test(new URL(r.url()).pathname)),retryButton.click()]);
   const body=await response.json().catch(()=>({}));const oldJobId=new URL(response.url()).pathname.split('/').at(-2);
   source.attempts.push({oldJobId,status:response.status(),message:body.message});
   if(response.ok()){source.oldJobId=oldJobId;source.newJobId=body.jobId;break;}
   // Media gone / queue full must surface as a readable Vietnamese error.
   const alert=await page.getByRole('alert').first().innerText();assertVietnamese([alert],'retry error');source.attempts.at(-1).shownError=alert;
   if(response.status()===429)break;
  }
  assert.ok(source.newJobId,`retry did not create a job: ${JSON.stringify(source.attempts)}`);
  assert.notEqual(source.newJobId,source.oldJobId);
  const steps=page.locator('ol[aria-label="Các bước xử lý"]').last();await steps.waitFor();
  source.steps=await steps.locator('li').allInnerTexts();
  assert.deepEqual(source.steps.map(s=>s.replace(/^\d+\.\s*/,'')),['Phân tích','Duyệt','Render','Lưu']);
  source.status=await page.locator('section[aria-live="polite"] p').first().innerText();
  assertVietnamese([source.status.split(' · ')[0]],'source stage label');
  await page.screenshot({path:file('source-retry.png'),fullPage:true});
  const cancel=page.getByRole('button',{name:'Hủy xử lý'});
  await cancel.waitFor({timeout:30000});
  await Promise.all([page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname.endsWith(`/ai-video/source-jobs/${source.newJobId}`)),cancel.click()]);
  markCancelled(source.newJobId);source.cancelled=true;source.passed=true;evidence.checks.source=source;

  // 1. Idea studio: quick one-shot job, 15 s.
  await page.getByRole('tab',{name:'Tạo từ ý tưởng',exact:true}).click();
  await page.locator('#studio-topic').fill(option('topic','3 mẹo uống đủ nước mỗi ngày cho dân văn phòng'));
  await page.getByRole('button',{name:'15s',exact:false}).first().click();
  const [started]=await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/ai-video/generate'),{timeout:120000}),
   page.getByRole('button',{name:/Tạo video ngay/}).click()]);
  const idea={startStatus:started.status(),startPath:new URL(started.url()).pathname,samples:[],maxPreviewImages:0,factsLabel:undefined};
  evidence.checks.idea=idea;// live reference: a failed run still keeps every sample in the receipt
  assert.ok(started.ok(),`idea start failed: ${started.status()}`);
  idea.jobId=(await started.json().catch(()=>({}))).jobId;track('idea',idea.jobId);
  const startedAt=Date.now(),deadline=startedAt+(quick?QUICK_MAX_MS:Number(option('idea-timeout-min','20'))*60000);let progressShot=false;
  while(Date.now()<deadline){
   // Quick: ~2 minutes of samples plus the storyboard preview (title + facts), then cancel.
   if(quick&&Date.now()-startedAt>=QUICK_SAMPLE_MS&&idea.factsLabel&&idea.title)break;
   if(await page.getByRole('heading',{name:'Video đã sẵn sàng'}).isVisible())break;
   const failure=page.locator('section[aria-live="polite"] [role="alert"]');
   if(await failure.isVisible()){idea.failure=await failure.innerText();assertVietnamese([idea.failure.split('\n')[0]],'idea failure');throw new Error(`idea job failed: ${idea.failure}`);}
   const bar=page.getByRole('progressbar',{name:'Tiến độ tạo video'});
   if(await bar.isVisible()){
    const percent=Number(await bar.getAttribute('aria-valuenow'));
    const stepItems=page.locator('ol[aria-label="Các bước xử lý"] li');
    const labels=await stepItems.allInnerTexts(),current=await stepItems.evaluateAll(items=>items.findIndex(li=>li.getAttribute('aria-current')==='step'));
    const done=await stepItems.evaluateAll(items=>items.filter(li=>li.textContent.includes('✓')).length);
    const eta=(await page.getByText(/^Đã chạy /).first().innerText().catch(()=>''))||'';
    const status=(await page.locator('section[aria-live="polite"] p').first().innerText().catch(()=>'')).split('\n')[0];
    idea.samples.push({at:new Date().toISOString(),elapsedMs:Date.now()-startedAt,percent,step:Math.max(current,done),stage:labels[current]?.replace(/^\d+\.\s*/,'')||'',status,eta,labels:labels.length});
    if(!progressShot&&percent>=10){await page.screenshot({path:file('idea-progress.png'),fullPage:true});progressShot=true;}
   }
   idea.maxPreviewImages=Math.max(idea.maxPreviewImages,await page.locator('[aria-label="Các cảnh video"] img').count());
   if(!idea.title){const title=dialog.locator('h2').filter({hasNotText:/Video đã sẵn sàng|AI Video Studio/}).last();const text=await title.innerText().catch(()=>'');if(text&&!/AI Video Studio/.test(text))idea.title=text;}
   if(!idea.hook){const hook=page.getByText(/^Hook mở đầu: /).first();if(await hook.isVisible().catch(()=>false))idea.hook=await hook.innerText();}
   if(!idea.factsLabel){const facts=page.getByText(/^Dữ kiện AI tự kiểm, chưa xác minh nguồn \(\d+\)$/).first();if(await facts.isVisible().catch(()=>false))idea.factsLabel=await facts.innerText();}
   await sleep(5000);
  }
  idea.sampleCount=idea.samples.length;
  assert.ok(idea.samples.length>=3,`too few progress samples${Date.now()>=deadline?' (timed out)':''}`);
  assertMonotonic(idea.samples,'percent','percent');assertMonotonic(idea.samples,'step','step');idea.monotonic=true;
  assert.ok(idea.samples.some(s=>/Còn khoảng|Sắp xong/.test(s.eta)),'ETA never shown');
  assert.ok(idea.factsLabel,'"Dữ kiện AI tự kiểm…" label not shown');
  if(quick){
   assert.ok(idea.title,'storyboard preview title not shown');
   assert.ok(idea.samples.at(-1).percent>idea.samples[0].percent,'progress did not increase');
   const cancel=page.getByRole('button',{name:'Hủy tác vụ'});await cancel.waitFor();
   await Promise.all([page.waitForResponse(r=>r.request().method()==='DELETE'&&/\/ai-video\/[0-9a-f-]{36}$/.test(new URL(r.url()).pathname)),cancel.click()]);
   markCancelled(idea.jobId);
   const cancelled=page.locator('section[aria-live="polite"] [role="alert"]');await cancelled.waitFor({timeout:180000});
   idea.cancelledText=await cancelled.innerText();assert.ok(/Tác vụ đã được hủy/.test(idea.cancelledText),`cancelled state: ${idea.cancelledText}`);
   await page.screenshot({path:file('idea-cancelled.png'),fullPage:true});
   idea.passed=true;
   assert.deepEqual(evidence.pageErrors,[],'page errors');
   evidence.passed=true;console.log(JSON.stringify(evidence.checks,null,1));return;
  }
  await page.getByRole('heading',{name:'Video đã sẵn sàng'}).waitFor({timeout:5000});
  assertMonotonic(idea.samples,'percent','percent');assertMonotonic(idea.samples,'step','step');
  assert.ok(idea.samples.some(s=>/Còn khoảng|Sắp xong/.test(s.eta)),'ETA never shown');
  assert.ok(idea.maxPreviewImages>=1,'no scene preview image appeared while drawing');
  assert.ok(idea.factsLabel,'"Dữ kiện AI tự kiểm…" label not shown');
  await page.locator('video[aria-label="Video AI đã hoàn tất"]').waitFor();
  // 3. Warnings: every warning rendered in the completion view is Vietnamese.
  idea.warnings=await page.locator('section p[role="status"]').allInnerTexts();assertVietnamese(idea.warnings,'warning');
  await page.screenshot({path:file('idea-complete.png'),fullPage:true});
  idea.sampleCount=idea.samples.length;idea.passed=true;
  evidence.checks.warningsVietnamese={idea:idea.warnings.length,passed:true};
  assert.deepEqual(evidence.pageErrors,[],'page errors');
  evidence.passed=true;console.log(JSON.stringify(evidence.checks,null,1));
 }catch(e){evidence.passed=false;evidence.error=e.message;if(page)await page.screenshot({path:file('failure.png'),fullPage:true}).catch(()=>{});throw e;}
 finally{
  // Cleanup: cancel every job created here that is still running (failure, timeout, UI cancel not reached).
  await Promise.allSettled(pendingJobs);
  for(const job of evidence.jobs){
   const url=job.kind==='idea'?`${BACKEND}/ai-video/${job.jobId}`:`${BACKEND}/ai-video/source-jobs/${job.jobId}`;
   const statusUrl=job.kind==='idea'?`${BACKEND}/ai-video/status/${job.jobId}`:url;
   try{
    const current=await context.request.get(statusUrl,{timeout:30000}).then(r=>r.ok()?r.json():{}).catch(()=>({}));
    job.statusAtCleanup=current.status;
    if(!TERMINAL.has(current.status)){const r=await context.request.delete(url,{timeout:60000});job.cleanupDelete=r.status();if(r.ok())job.cancelledBy=job.cancelledBy||'cleanup';}
   }catch(e){job.cleanupError=e.message;}
  }
  await fs.writeFile(path.join(directory,receiptName),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
