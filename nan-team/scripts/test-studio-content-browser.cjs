'use strict';
// Usage: node scripts/test-studio-content-browser.cjs --receipt <name.json> [--source-report live-final-dialogue6-mcp.json] [--idea-job <jobId>]
// Checks (write-once receipt + screenshots in reports/openshorts-integration/browser-final/):
//  1. Source studio approval view renders the AGY content of a real job (title, hook, 3 hook candidates with scores,
//     caption copy button, rationale) and Vietnamese stage labels. The job's real GET response is served with
//     status/stage switched to awaiting_approval (UI-only; approve/revision POSTs are blocked, no job is created).
//  2. Idea studio shows "Dữ kiện đã kiểm" facts + hook for the recorded storyboard of a real idea job
//     (/tmp/nan-ai-video-jobs/<id>.storyboard.json replayed as the generate-storyboard response; no AGY call).
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{sign}=require('jsonwebtoken');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const reports=path.join(root,'reports/openshorts-integration');
const option=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];};
async function main(){
 const fixture=require(path.join(reports,'live-source-job.json'));
 const source=require(path.join(reports,option('source-report','live-final-dialogue6-mcp.json')));
 const ideaJob=option('idea-job','e213a0f1-ae79-4c32-8ea0-eb8e59ad3a2b');
 const recorded=JSON.parse(await fs.readFile(`/tmp/nan-ai-video-jobs/${ideaJob}.storyboard.json`,'utf8'));
 const receiptName=option('receipt');assert.ok(receiptName&&receiptName.endsWith('.json')&&path.basename(receiptName)===receiptName,'--receipt <name.json>');
 const directory=path.join(reports,'browser-final');await fs.mkdir(directory,{recursive:true});
 const prefix=receiptName.slice(0,-5),file=s=>path.join(directory,`${prefix}.${s}`);
 for(const n of [receiptName,...['approval.png','approval-mobile.png','idea.png','failure.png'].map(s=>`${prefix}.${s}`)])
  await fs.access(path.join(directory,n)).then(()=>{throw new Error(`${n} exists; write-once`);},()=>{});
 const evidence={kind:'studio-content-ui',checkedAt:new Date().toISOString(),sourceJobId:source.jobId,ideaJobId:ideaJob,pageErrors:[],checks:{},
  method:{approval:'real GET body served with status=awaiting_approval (UI only, POSTs blocked)',idea:'recorded storyboard replayed as generate-storyboard response'}};
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--disable-gpu']});let page;
 try{
  const context=await browser.newContext({baseURL:'http://localhost:4200',viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  await context.addCookies([{name:'auth',value:sign({id:fixture.userId},process.env.JWT_SECRET,{expiresIn:'15m'}),domain:'localhost',path:'/',httpOnly:true},
   {name:'showorg',value:fixture.orgId,domain:'localhost',path:'/'}]);
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>evidence.pageErrors.push(e.message));
  let realJob;
  await page.route(/\/ai-video\/source-jobs(\/|$|\?)/,async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET')return route.abort();
   if(url.pathname.endsWith('/ai-video/source-jobs')){const r=await route.fetch();const list=await r.json();
    return route.fulfill({response:r,json:list.map(j=>j.jobId===source.jobId?{...j,status:'awaiting_approval',stage:'awaiting_approval',progress:60}:j)});}
   if(url.pathname.endsWith(`/ai-video/source-jobs/${source.jobId}`)){const r=await route.fetch();realJob=await r.json();
    return route.fulfill({response:r,json:{...realJob,status:'awaiting_approval',stage:'awaiting_approval',progress:60,clips:[]}});}
   return route.continue();
  });
  await page.route('**/ai-video/generate-storyboard',route=>{const {title,visualDna,theme,scenes,hook,grounding}=recorded;
   return route.fulfill({json:{title,visualDna,theme,scenes,hook,grounding}});});
  await page.goto('/agents/new',{waitUntil:'domcontentloaded',timeout:480000});
  await page.getByRole('button',{name:/Tạo Video AI/}).first().click({timeout:300000});
  await page.getByRole('tab',{name:'Chỉnh video có sẵn',exact:true}).click();
  const history=page.locator('details').filter({has:page.getByText('Lịch sử dự án',{exact:true})});
  await history.locator('summary').click();
  const row=history.getByRole('button',{name:/Chờ bạn duyệt các đoạn/});await row.first().waitFor();await row.first().click();
  const approval=page.locator('section').filter({has:page.getByRole('heading',{name:'Duyệt kế hoạch cắt video'})});
  await approval.waitFor();
  const plan=realJob.plan.clips[0].content;assert.ok(plan,'plan clip has no content');
  const decision=plan.grounding.hookDecision;
  await approval.getByText(plan.title,{exact:true}).first().waitFor();
  await approval.getByText(`Hook: ${plan.hook}`,{exact:true}).first().waitFor();
  const summary=approval.locator('summary').filter({hasText:'3 phương án hook'});await summary.click();
  const items=approval.locator('details li');assert.equal(await items.count(),decision.candidates.length);
  assert.equal(decision.candidates.length,3,'expected 3 hook candidates');
  const candidates=await items.allInnerTexts();
  for(const [i,c] of decision.candidates.entries()){assert.ok(candidates[i].includes(c.text),`candidate ${i} text`);
   assert.ok(!candidates[i].includes('Tò mò –'),`candidate ${i} scores not shown`);}
  assert.ok(candidates.some(t=>t.includes('✓ Đã chọn')),'chosen hook not marked');
  await approval.getByText('Caption đăng bài',{exact:true}).waitFor();
  await approval.getByRole('button',{name:'Sao chép',exact:true}).click();
  await approval.getByRole('button',{name:'Đã sao chép',exact:true}).waitFor();
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
  assert.ok(clipboard.includes(plan.postText.split('\n')[0]),'clipboard lacks caption');
  await approval.getByText(`Lý do chọn: ${plan.selectionRationale}`,{exact:true}).waitFor();
  const status=await page.locator('section[aria-live="polite"] p').first().innerText();
  assert.ok(status.startsWith('Chờ bạn duyệt các đoạn'),`stage label: ${status}`);
  const rows=await history.getByRole('button').allInnerTexts();
  const rawStages=rows.map(r=>r.split(' · ').pop()).filter(l=>/^[a-z_-]+$/.test(l));
  assert.deepEqual(rawStages,[],'history shows untranslated stage ids');
  await page.screenshot({path:file('approval.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const box=await page.getByRole('dialog').first().boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=391,'approval overflows phone');
  await page.screenshot({path:file('approval-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  evidence.checks.approval={title:plan.title,hook:plan.hook,candidates,clipboardChars:clipboard.length,rationale:plan.selectionRationale,
   stageLabel:status,historyLabels:[...new Set(rows.map(r=>r.split(' · ').pop()))],mobileFits:true,passed:true};
  // Idea studio
  await page.getByRole('tab',{name:'Tạo từ ý tưởng',exact:true}).click();
  await page.locator('#studio-topic').fill(recorded.request?.topic||recorded.title);
  await page.getByRole('button',{name:/Tạo kịch bản & sinh ảnh/}).click();
  await page.getByRole('heading',{name:recorded.title}).waitFor();
  const facts=page.locator('details').filter({has:page.locator('summary',{hasText:'Dữ kiện đã kiểm'})});
  await facts.locator('summary').click();
  const summaryText=await facts.locator('summary').innerText();
  assert.equal(summaryText,`Dữ kiện đã kiểm (${recorded.grounding.facts.length})`);
  for(const f of recorded.grounding.facts){await facts.getByText(f.claim,{exact:true}).waitFor();await facts.getByText(`Nguồn: ${f.basis}`,{exact:true}).waitFor();}
  await page.getByText(`Hook mở đầu: ${recorded.hook.chosen}`,{exact:true}).first().waitFor();
  const hookBox=page.locator('div').filter({has:page.getByText('Hook mở đầu:')}).last();
  await hookBox.locator('summary').click();
  const ideaCandidates=await hookBox.locator('li').allInnerTexts();
  assert.equal(ideaCandidates.length,recorded.hook.candidates.length);
  await page.waitForTimeout(1500);
  await page.screenshot({path:file('idea.png'),fullPage:true});
  evidence.checks.idea={title:recorded.title,facts:recorded.grounding.facts.length,hook:recorded.hook.chosen,candidates:ideaCandidates,passed:true};
  assert.deepEqual(evidence.pageErrors,[],'page errors');
  evidence.passed=true;console.log(JSON.stringify(evidence.checks,null,1));
 }catch(e){evidence.passed=false;evidence.error=e.message;if(page)await page.screenshot({path:file('failure.png'),fullPage:true}).catch(()=>{});throw e;}
 finally{await fs.writeFile(path.join(directory,receiptName),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
