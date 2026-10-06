'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright'),{sign}=require('jsonwebtoken');
(async()=>{
 const root=path.resolve(__dirname,'..');const fixture=JSON.parse(await fs.readFile(path.join(root,'reports/openshorts-integration/live-source-job.json'),'utf8'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY||'/usr/bin/google-chrome'});
 try{
  const context=await browser.newContext({baseURL:process.env.FRONTEND_URL||'http://localhost:4200'});
  await context.addCookies([{name:'auth',value:sign({id:fixture.userId},process.env.JWT_SECRET),domain:'localhost',path:'/',httpOnly:true},
   {name:'showorg',value:fixture.orgId,domain:'localhost',path:'/'}]);
  const page=await context.newPage(),errors=[],responses=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.url().includes('/ai-video/source-jobs'))responses.push({path:new URL(response.url()).pathname,status:response.status()});});
  await page.goto('/agents/new',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button',{name:/Tạo Video AI/}).click();
  await page.getByRole('tab',{name:/Chỉnh video có sẵn/}).click();
  await page.getByText('Biến video của bạn thành nội dung mới').waitFor();
  await page.waitForTimeout(1500);
  const body=await page.locator('body').innerText();
  if(!body.includes('Tải video')||!body.includes('Kho media')||!body.includes('Dán URL')||!body.includes('Lịch sử'))throw Error('Source Studio controls or persisted history are missing');
  if(errors.length)throw Error(`Browser errors: ${errors.slice(0,3).join('; ')}`);
  const directory=path.join(root,'reports/openshorts-integration/browser');await fs.mkdir(directory,{recursive:true});
  await page.screenshot({path:path.join(directory,'source-studio.png'),fullPage:true});
  await page.getByText('Lịch sử dự án').click();
  await page.getByRole('button',{name:/Đã hoàn tất/}).click();
  await page.getByText('Clip đã lưu vào kho media').waitFor();
  const clip=page.locator('article').filter({has:page.locator('video[src*="/uploads/source-video/"]')}).first();
  const videoPath=await clip.locator('video').getAttribute('src');
  await clip.locator('input[type="checkbox"]').check();
  await page.getByRole('button',{name:'Đính kèm 1 clip vào Agent'}).click();
  await page.getByRole('dialog',{name:'Studio video nguồn'}).waitFor({state:'detached'});
  await page.waitForTimeout(500);
  const attached=await page.locator(`video[src^="${videoPath}"]`).count()>0 || (await page.locator('body').innerText()).includes(videoPath);
  if(!attached)throw Error('Saved clip did not appear in the Agent composer');
  await page.screenshot({path:path.join(directory,'source-attached.png'),fullPage:true});
  const receipt={kind:'authenticated-source-studio-browser',url:page.url(),sourceTabVisible:true,uploadMediaAndUrlVisible:true,historyVisible:true,completedClipVisible:true,composerAttachmentVisible:attached,videoPath,responses,errors};
  await fs.writeFile(path.join(directory,'browser-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
