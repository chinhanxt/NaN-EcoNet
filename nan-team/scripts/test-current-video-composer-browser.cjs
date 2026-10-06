'use strict';
// Usage: node scripts/test-current-video-composer-browser.cjs [--report <name>] [--second-report <name>] [--receipt <name>]
//  --report         primary job report in reports/openshorts-integration (default live-caption-appearance-mcp.json)
//  --second-report  another completed job of the same org for the multi-clip check (default live-phowhisper-dialogue-mcp.json)
//  --receipt        receipt file name in reports/openshorts-integration/browser-current (default browser-receipt-<time>.json).
//                   Receipts and their screenshots/ZIP are write-once: an existing name aborts the run.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{sign}=require('jsonwebtoken');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const reports=path.join(root,'reports/openshorts-integration');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const option=(name,fallback)=>{const index=process.argv.indexOf(`--${name}`);if(index<0)return fallback;
 const value=process.argv[index+1];assert.ok(value&&!value.startsWith('--'),`--${name} needs a value`);return value;};
const report=name=>{assert.equal(path.basename(name),name,`Report must be a file name in ${reports}`);return require(path.join(reports,name));};
async function main(){
 const fixture=report('live-source-job.json');
 const reportName=option('report','live-caption-appearance-mcp.json'),secondName=option('second-report','live-phowhisper-dialogue-mcp.json');
 const live=report(reportName),second=report(secondName);
 for(const [name,job] of [[reportName,live],[secondName,second]]){
  assert.equal(job.orgId,fixture.orgId,`${name} belongs to another organization`);
  assert.ok(job.jobId&&job.artifact?.mediaId&&job.artifact?.sha256,`${name} has no completed job artifact`);
  assert.ok(job.passed===true||job.technicalPipelinePassed===true,`${name} did not pass its pipeline`);
 }
 assert.notEqual(second.jobId,live.jobId,'Second report must be another job');
 const directory=path.join(reports,'browser-current');await fs.mkdir(directory,{recursive:true});
 const checkedAt=new Date().toISOString();
 const receiptName=option('receipt',`browser-receipt-${checkedAt.replace(/[:.]/g,'-')}.json`);
 assert.ok(path.basename(receiptName)===receiptName&&receiptName.endsWith('.json'),'--receipt must be a .json file name');
 const prefix=receiptName.slice(0,-5),file=suffix=>path.join(directory,`${prefix}.${suffix}`);
 for(const name of [receiptName,...['zip','preview.png','mobile.png','attached.png','message.png','failure.png'].map(suffix=>`${prefix}.${suffix}`)])
  await fs.access(path.join(directory,name)).then(()=>{throw new Error(`${name} already exists; receipts are write-once`);},()=>{});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--disable-gpu']});
 const evidence={kind:'current-candidate-authenticated-source-preview-composer',checkedAt,reports:{primary:reportName,second:secondName},
  orgId:fixture.orgId,jobId:live.jobId,mediaId:live.artifact.mediaId,manualQualityPassed:{primary:live.passed===true,second:second.passed===true},
  pageErrors:[],apiResponses:[],sourceHashes:{},
  policyDecision:{authorization:'ongoing integration preview/composer acceptance',sourceJobsCreated:0,
   publishPost:false,frontendMemoryMaxGiB:4,frontendSwapMaxMiB:256,cpuQuota:1}};
 const jobs=new Map();let page;
 try{
  const context=await browser.newContext({baseURL:'http://localhost:4200',viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.addCookies([{name:'auth',value:sign({id:fixture.userId},process.env.JWT_SECRET,{expiresIn:'15m'}),domain:'localhost',path:'/',httpOnly:true},
   {name:'showorg',value:fixture.orgId,domain:'localhost',path:'/'}]);
  page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())console.log('NAV',frame.url());});
  page.on('response',response=>{const h=response.headers();if(h.reload||h.onboarding||h.logout)console.log('SESSION_HEADER',new URL(response.url()).pathname,JSON.stringify({reload:h.reload,onboarding:h.onboarding,logout:h.logout}));});
  page.on('pageerror',error=>evidence.pageErrors.push(error.message));
  page.on('response',response=>{const pathname=new URL(response.url()).pathname;if(!pathname.includes('/ai-video/source-jobs'))return;
   evidence.apiResponses.push({path:pathname,status:response.status()});
   const job=pathname.match(/\/ai-video\/source-jobs\/([0-9a-f-]{36})$/);
   if(job&&response.request().method()==='GET'&&response.status()===200)response.json().then(body=>jobs.set(job[1],body),()=>{});});
  const composer=page.locator('.copilotKitInput textarea');
  // Open the source studio and load a history job; returns the saved clip that holds the report's Media.
  const openJob=async job=>{
   await page.getByRole('button',{name:/Tạo Video AI/}).first().click({timeout:300000});
   await page.getByRole('tab',{name:'Tạo từ ý tưởng',exact:true}).waitFor();
   await page.getByRole('tab',{name:'Chỉnh video có sẵn',exact:true}).click();
   await page.getByText('Biến video của bạn thành nội dung mới',{exact:true}).waitFor();
   const history=page.locator('details').filter({has:page.getByText('Lịch sử dự án',{exact:true})});
   await history.locator('summary').click();
   const loaded=page.locator(`article video[src*="/${job.jobId}/"]`).first();
   const rows=history.getByRole('button',{name:/Đã hoàn tất/});await rows.first().waitFor();
   for(let index=0,count=await rows.count();index<count;index++){
    await rows.nth(index).click();
    if(await loaded.waitFor({timeout:8000}).then(()=>true,()=>false))break;
   }
   await loaded.waitFor();
   for(let waited=0;!jobs.has(job.jobId)&&waited<30000;waited+=250)await page.waitForTimeout(250);
   const clip=jobs.get(job.jobId)?.clips?.find(item=>item.media?.id===job.artifact.mediaId);
   assert.ok(clip,`Job ${job.jobId} status has no clip with Media ${job.artifact.mediaId}`);
   const selector=`video[src="${clip.media.path}"]`;
   const article=page.locator('article').filter({has:page.locator(selector)});
   return {clip,video:page.locator(`article ${selector}`).first(),article};
  };
  const attach=async article=>{
   await article.locator('input[type="checkbox"]').check();
   await page.getByRole('button',{name:'Đính kèm 1 clip vào Agent',exact:true}).click();
   await page.getByRole('dialog',{name:'Studio video nguồn',exact:true}).waitFor({state:'detached'});
  };
  const cardCopy=async(article,clip)=>{
   const shown={title:null,selectionRationale:null};
   if(clip.content?.title){await article.getByText(clip.content.title,{exact:true}).waitFor();shown.title=clip.content.title;}
   if(clip.content?.selectionRationale){await article.getByText(`Lý do chọn: ${clip.content.selectionRationale}`,{exact:true}).waitFor();shown.selectionRationale=clip.content.selectionRationale;}
   return shown;
  };
  console.log('Opening authenticated Agent page');
  await page.goto('/agents/new',{waitUntil:'domcontentloaded',timeout:480000});
  const first=await openJob(live);
  console.log('Loaded source history clip');
  const videoPath=first.clip.media.path;
  await page.waitForFunction(element=>element.readyState>=2,await first.video.elementHandle(),{timeout:60000});
  console.log('Preview metadata ready');
  const metadata=await first.video.evaluate(element=>({width:element.videoWidth,height:element.videoHeight,duration:element.duration,error:element.error?.message}));
  if(live.artifact.width)assert.equal(metadata.width,live.artifact.width);
  if(live.artifact.height)assert.equal(metadata.height,live.artifact.height);
  if(live.artifact.durationSeconds)assert.ok(Math.abs(metadata.duration-live.artifact.durationSeconds)<.2,'Preview duration differs from report');
  assert.ok(metadata.width>0&&metadata.height>0&&!metadata.error);
  await first.video.evaluate(async element=>{element.muted=true;await element.play();});
  await page.waitForFunction(element=>element.currentTime>.25,await first.video.elementHandle());
  const playback=await first.video.evaluate(element=>{element.pause();return {currentTime:element.currentTime,readyState:element.readyState};});
  const firstCard=await cardCopy(first.article,first.clip);
  await page.screenshot({path:file('preview.png'),fullPage:true});
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Tải tất cả ZIP',exact:true}).click()]);
  const zip=file('zip');await download.saveAs(zip);
  console.log('ZIP downloaded');
  const entries=execFileSync('unzip',['-Z1',zip]).toString().split('\n').filter(name=>name.endsWith('.mp4'));
  assert.equal(entries.length,jobs.get(live.jobId).clips.length,'ZIP clip count differs from the job');
  const zipHashes=entries.map(entry=>hash(execFileSync('unzip',['-p',zip,entry],{maxBuffer:256*1024*1024})));
  assert.ok(zipHashes.includes(live.artifact.sha256),'Browser ZIP does not contain the report video');
  await page.setViewportSize({width:390,height:844});
  const modal=page.getByRole('dialog',{name:'Studio video nguồn',exact:true});const box=await modal.boundingBox();
  assert.ok(box&&box.x>=0&&box.x+box.width<=391,'Studio overflows phone viewport');
  await page.screenshot({path:file('mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  console.log('Returned to desktop viewport');
  assert.equal(await composer.inputValue(),'','Composer must start empty');
  await attach(first.article);
  await page.locator(`video[src^="${videoPath}"]`).first().waitFor();
  // An empty composer takes the clip's grounded post text.
  const firstPostText=first.clip.content?.postText?.trim()?first.clip.content.postText:'';
  await page.waitForFunction(([selector,expected])=>document.querySelector(selector)?.value===expected,['.copilotKitInput textarea',firstPostText]);
  console.log('First clip attached',firstPostText?'with post text':'(clip has no post text)');
  // Text already in the composer is never replaced by a later clip.
  if(!firstPostText)await composer.fill('Bản nháp của tôi');
  const draft=await composer.inputValue();
  const next=await openJob(second);
  const secondPath=next.clip.media.path,secondCard=await cardCopy(next.article,next.clip);
  await attach(next.article);
  await page.locator(`video[src^="${secondPath}"]`).first().waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await composer.inputValue(),draft,'Second clip overwrote the composer text');
  assert.equal(await page.locator(`video[src^="${videoPath}"]`).count(),1,'First clip was dropped from the composer');
  assert.equal(await page.locator(`video[src^="${secondPath}"]`).count(),1,'Second clip missing from the composer');
  console.log('Second clip attached next to the first');
  await page.screenshot({path:file('attached.png'),fullPage:true});
  // Send a message with markup. The agent request is held open, so no agent run happens;
  // the user message still renders and its request body is inspected.
  const held=[];await page.route('**/copilot/agent**',route=>{if(route.request().method()==='POST')held.push(route);else route.continue();});
  const typed='Kiểm tra <b>đậm</b> <img src=x onerror="window.__agentXss=1"> & "quote"';
  await composer.fill(typed);
  await composer.press('Enter');
  const userMessage=page.locator('.copilotKitUserMessage').last();await userMessage.waitFor();
  await page.waitForFunction(count=>document.querySelectorAll('.copilotKitUserMessage video').length>=count,2);
  const rendered=await userMessage.evaluate(element=>({text:element.innerText,markup:element.querySelectorAll('b,img,script').length,
   videos:[...element.querySelectorAll('video')].map(video=>video.getAttribute('src')),xss:window.__agentXss===1}));
  assert.ok(rendered.text.includes('<b>đậm</b>')&&rendered.text.includes('onerror="window.__agentXss=1"'),'Typed markup not shown literally');
  assert.equal(rendered.markup,0,'Typed markup became HTML');assert.equal(rendered.xss,false,'Typed handler executed');
  assert.deepEqual(rendered.videos,[videoPath,secondPath],'User message clips differ from attachments');
  assert.ok(!/MediaId|\[--Media--\]|\[--integrations--\]/.test(rendered.text),'Agent context leaked into the message');
  const hasBody=()=>held.some(route=>(route.request().postData()||'').includes(`MediaId: ${second.artifact.mediaId}`));
  for(let waited=0;!hasBody()&&waited<30000;waited+=250)await page.waitForTimeout(250);
  const body=held.map(route=>route.request().postData()||'').find(data=>data.includes('MediaId: '))||'';
  assert.ok(body.includes(`MediaId: ${live.artifact.mediaId}`)&&body.includes(`MediaId: ${second.artifact.mediaId}`),'Agent request lacks both MediaIds');
  console.log('User message escaped with both clips');
  await page.screenshot({path:file('message.png'),fullPage:true});
  assert.deepEqual(evidence.pageErrors,[],'Browser reported runtime errors');
  assert.ok(evidence.apiResponses.some(response=>response.path.includes(live.jobId)&&response.status===200));
  evidence.passed=true;evidence.url=page.url();evidence.preview={...metadata,...playback};evidence.mobileFits=true;
  evidence.composerAttachment={visible:true,mediaId:live.artifact.mediaId,videoPath,
   second:{jobId:second.jobId,mediaId:second.artifact.mediaId,videoPath:secondPath}};
  evidence.clipContent={primary:{card:firstCard,prefilledPostText:firstPostText||null},second:{card:secondCard},textKeptOnSecondAttach:draft};
  evidence.userMessage={typed,rendered,agentRunStarted:false};
  evidence.zip={file:path.basename(zip),sha256:hash(await fs.readFile(zip)),videoSha256:zipHashes};
  for(const name of ['apps/frontend/src/components/agents/source-video-studio.modal.tsx',
   'apps/frontend/src/components/agents/source-video.state.ts','apps/frontend/src/components/agents/ai-video-studio.modal.tsx',
   'apps/frontend/src/components/agents/ai-video-studio.state.ts','apps/frontend/src/components/agents/agent.chat.tsx',
   'apps/frontend/src/components/agents/agent.input.tsx','apps/frontend/src/components/agents/agent.tsx',
   'apps/frontend/src/components/media/media.component.tsx','libraries/helpers/src/utils/agent.message.html.ts','apps/frontend/next.config.js'])
   evidence.sourceHashes[name]=hash(await fs.readFile(path.join(root,name)));
  console.log(JSON.stringify({passed:true,receipt:receiptName,preview:evidence.preview,composer:evidence.composerAttachment,clipContent:evidence.clipContent,userMessage:evidence.userMessage,mobileFits:true}));
 }catch(error){evidence.passed=false;evidence.error=error.message;if(page)await page.screenshot({path:file('failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{
  if(process.env.FRONTEND_CGROUP)try{evidence.frontendCgroup={
   peakBytes:Number(await fs.readFile(path.join(process.env.FRONTEND_CGROUP,'memory.peak'),'utf8')),
   events:await fs.readFile(path.join(process.env.FRONTEND_CGROUP,'memory.events'),'utf8')};}catch(error){evidence.frontendCgroup={error:error.message};}
  await fs.writeFile(path.join(directory,receiptName),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
