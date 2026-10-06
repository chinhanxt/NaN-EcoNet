const {chromium}=require('playwright');
const {PrismaClient}=require('@prisma/client');
const {sign}=require('jsonwebtoken');
const {writeFile,mkdir,readFile}=require('node:fs/promises');
const {resolve,join}=require('node:path');
const assert=require('node:assert/strict');
require('dotenv').config();
let activeBrowser;
let activePage;
async function main(){
 const p=new PrismaClient();
 const user=await p.user.findFirst({where:{activated:true,organizations:{some:{disabled:false}}},select:{id:true,organizations:{where:{disabled:false},select:{organizationId:true},take:1}}});
 await p.$disconnect();
 assert(user);
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 activeBrowser=browser;
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.addCookies([{name:'auth',value:sign({id:user.id},process.env.JWT_SECRET,{expiresIn:'1h'}),domain:'localhost',path:'/'},{name:'showorg',value:user.organizations[0].organizationId,domain:'localhost',path:'/'}]);
 const page=await context.newPage();
 activePage=page;
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const apiCalls=[];page.on('response',response=>{if(response.url().includes('/ai-video/'))apiCalls.push({url:response.url(),status:response.status()});});
 page.on('requestfailed',request=>console.log('Browser request failed:',request.url().split('?')[0],request.failure()?.errorText));
 page.setDefaultTimeout(120000);
 await page.goto('http://localhost:4200/agents/new',{waitUntil:'domcontentloaded',timeout:180000});
 await page.getByRole('button',{name:'Tạo Video AI',exact:false}).first().click();
 const dialog=page.getByRole('dialog',{name:'AI Video Studio'});
 await dialog.waitFor();
 await mkdir(resolve('reports/video-pipeline'),{recursive:true});
 await page.screenshot({path:resolve('reports/video-pipeline/studio-setup.png'),fullPage:true});
 assert(await dialog.getByText('1080 × 1920 · 30 FPS · Giọng Việt').isVisible());
 const evidence={at:new Date().toISOString(),url:page.url(),dialogVisible:true,errors,apiCalls,mode:'setup'};
 if(process.argv.includes('--live')){
   const directory=resolve('reports/video-pipeline');
   const original=JSON.parse(await readFile(join(directory,'storyboard.json'),'utf8'));
   await page.setViewportSize({width:390,height:844});
   const box=await dialog.boundingBox();
   assert(box && box.x>=0 && box.x+box.width<=391,'Studio must fit a phone viewport');
   await page.screenshot({path:join(directory,'studio-mobile.png'),fullPage:true});
   await page.setViewportSize({width:1440,height:1100});
   await dialog.locator('#studio-topic').fill('Một buổi sáng xanh ở Sài Gòn: cô gái Việt Nam trong ảnh mồi đón nắng bên cửa sổ, đi bộ trong công viên, uống cà phê bằng bình cá nhân, đạp xe và bắt đầu ngày mới tích cực. Giữ nguyên áo linen kem, nhân vật, màu vàng bình minh và teal, phong cách điện ảnh.');
   await dialog.getByLabel('Để AI tự vẽ toàn bộ ảnh').uncheck();
   const imageResponse=await fetch(original.scenes[0].imageUrl);
   assert(imageResponse.ok);
   const uploadResponsePromise=page.waitForResponse(r=>r.url().includes('/media/upload-simple')&&r.request().method()==='POST');
   await dialog.locator('#studio-seed').setInputFiles({name:'morning-anchor.jpg',mimeType:'image/jpeg',buffer:Buffer.from(await imageResponse.arrayBuffer())});
   const uploadResponse=await uploadResponsePromise;
   const uploaded=await uploadResponse.json();
   assert(uploadResponse.ok(),JSON.stringify(uploaded));
   await dialog.getByAltText('Ảnh mồi đã tải lên').waitFor();
   console.log('Uploaded a real AGY seed image through the Studio');
   let boardResponse,board;
   const storyboardAttempts=[];
   for(let attempt=0;attempt<3;attempt++){
     const boardResponsePromise=page.waitForResponse(r=>r.url().includes('/ai-video/generate-storyboard')&&r.request().method()==='POST',{timeout:600000});
     await dialog.getByRole('button',{name:'✦ Tạo kịch bản & sinh ảnh',exact:true}).click();
     boardResponse=await boardResponsePromise;board=await boardResponse.json();
     storyboardAttempts.push(boardResponse.status());
     if(boardResponse.ok())break;
     console.log('Gateway returned a terminal error; retrying storyboard from the same Studio:',boardResponse.status());
     await new Promise(done=>setTimeout(done,5000));
   }
   assert(boardResponse.ok(),JSON.stringify(board));assert.equal(board.scenes.length,5);
   const seedUrl=JSON.parse(boardResponse.request().postData()).seedImageUrl;
   assert.equal(board.scenes[0].imageUrl,seedUrl,'First scene must preserve the uploaded visual anchor');
   await writeFile(join(directory,'storyboard.json'),JSON.stringify({...board,targetDuration:30,voice:'vi-VN-HoaiMyNeural'},null,2));
   console.log('Real Studio storyboard received, five scenes with visual anchor');
   await dialog.locator('#studio-keyword-0').fill(board.scenes[0].keywordHighlight);
   await dialog.locator('#studio-narration-0').fill(board.scenes[0].voiceText);
   assert.equal(await dialog.getByAltText('Ảnh minh họa cảnh 1').getAttribute('src'),seedUrl);
   await page.screenshot({path:join(directory,'studio-storyboard.png'),fullPage:true});
   let preview;
   const previewAttempts=[];
   for(let attempt=0;attempt<3;attempt++){
     const previewResponsePromise=page.waitForResponse(r=>r.url().includes('/ai-video/preview-voice')&&r.request().method()==='POST');
     await dialog.getByRole('button',{name:'▷ Nghe thử giọng đọc',exact:true}).first().click();
     const previewResponse=await previewResponsePromise;
     preview=await previewResponse.json();previewAttempts.push(previewResponse.status());
     if(previewResponse.ok())break;
     console.log('Voice service returned a terminal error; retrying voice preview:',previewResponse.status());
     await new Promise(done=>setTimeout(done,5000));
   }
   assert(preview.durationInSeconds>0,JSON.stringify(preview));
   const narration=dialog.getByLabel('Nghe lời thoại cảnh 1');
   await narration.waitFor();await narration.evaluate(audio=>audio.pause());
   let renderJob;
   const renderAttempts=[];
   for(let attempt=0;attempt<3;attempt++){
     const renderResponsePromise=page.waitForResponse(r=>r.url().includes('/ai-video/render')&&r.request().method()==='POST');
     await dialog.getByRole('button',{name:'Xuất video MP4',exact:true}).click();
     const renderResponse=await renderResponsePromise;renderJob=await renderResponse.json();
     assert(renderResponse.ok(),JSON.stringify(renderJob));assert(renderJob.jobId);
     await writeFile(join(directory,'active-job.json'),JSON.stringify(renderJob,null,2));
     console.log('Real Studio render started:',renderJob.jobId);
     const terminalResponse=await page.waitForResponse(async r=>{
       if(!r.url().includes('/ai-video/status/'+renderJob.jobId)||!r.ok())return false;
       const state=await r.json();return ['completed','failed'].includes(state.status);
     },{timeout:1200000});
     const terminal=await terminalResponse.json();
     renderAttempts.push({jobId:renderJob.jobId,status:terminal.status});
     console.log('Real Studio render ended:',terminal.status);
     if(terminal.status==='completed')break;
     assert(terminal.error?.includes('NoAudioReceived'),'Render failure requires investigation: '+terminal.error);
     console.log('Speech returned a terminal provider error; retrying render with the existing storyboard');
     await new Promise(done=>setTimeout(done,10000));
   }
   assert.equal(renderAttempts.at(-1).status,'completed','Real render attempts failed');
   await dialog.getByRole('heading',{name:'Video đã sẵn sàng',exact:true}).waitFor();
   const video=dialog.getByLabel('Video AI đã hoàn tất');
   await video.evaluate(async element=>{
     if(element.readyState<1)await new Promise((done,reject)=>{element.addEventListener('loadedmetadata',done,{once:true});element.addEventListener('error',reject,{once:true});});
   });
   const playback=await video.evaluate(async element=>{
     element.muted=true;await element.play();
     await new Promise(done=>setTimeout(done,1000));
     element.pause();return {duration:element.duration,width:element.videoWidth,height:element.videoHeight,currentTime:element.currentTime,error:element.error?.message||null,src:element.currentSrc};
   });
   assert(playback.currentTime>0 && !playback.error);assert.equal(playback.width,1080);assert.equal(playback.height,1920);
   assert(Math.abs(playback.duration-30)<0.1);
   await page.screenshot({path:join(directory,'studio-completed.png'),fullPage:true});
   await dialog.getByRole('button',{name:'Đính kèm vào bài đăng Agent',exact:true}).click();
   await dialog.waitFor({state:'hidden'});
   await page.locator('.sortable-container video').first().waitFor();
   await page.screenshot({path:join(directory,'studio-attached.png'),fullPage:true});
   Object.assign(evidence,{mode:'live',mobileFits:true,seedUrl,scenes:5,storyboardAttempts,previewAttempts,renderAttempts,previewSeconds:preview.durationInSeconds,jobId:renderJob.jobId,playback,attachedToAgent:true});
   console.log('Verified real playback and attachment in Agent composer');
 }
 assert.deepEqual(errors,[],'Browser must not report runtime errors');
 await writeFile(resolve('reports/video-pipeline/browser-verification.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));
 await browser.close();
}
main().catch(async error=>{
 console.error(error);
 if(activePage){
   await activePage.screenshot({path:resolve('reports/video-pipeline/studio-failure.png'),fullPage:true}).catch(()=>{});
   console.error('Studio alert:',await activePage.getByRole('alert').allTextContents().catch(()=>[]));
 }
 process.exitCode=1;
}).finally(()=>activeBrowser?.close());
