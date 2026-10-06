'use strict';
const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');process.chdir(root);
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
process.env.AGY_MCP_PROVIDER_URL ||= process.env.CLOUD_CODE_URL||'http://127.0.0.1:8901';
process.env.TS_NODE_PROJECT=path.join(root,'tsconfig.base.json');process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs'});
require('ts-node/register');require('tsconfig-paths/register');
const {AgyMcpService}=require('../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service');
const reportName=process.argv[2]||'live-image-low-load';assert.match(reportName,/^[a-z0-9-]+$/);
(async()=>{
 const report={kind:'native-AGY-image-publication',startedAt:new Date().toISOString(),nativeReceipts:[],toolErrors:[]};
 const directory=path.join(root,'reports/agy-mcp'),file=path.join(directory,reportName+'.json');await fs.mkdir(directory,{recursive:true});
 const service=new AgyMcpService(),run=service.run.bind(service);
 service.run=(request,signal)=>run({...request,onEvent:event=>{
  if(event.type==='receipt')report.nativeReceipts.push(event.receipt);
  if(event.type==='mcp-error')report.toolErrors.push({name:event.name,category:event.message});
 }},signal);
 try{
  const url=await service.image('A clean cinematic emerald forest illustration with sunlight through leaves, no letters or watermark. One static background image for a video scene.',undefined,'9:16');
  const prefix=process.env.FRONTEND_URL+'/uploads/';assert.ok(url.startsWith(prefix));
  const uploads=await fs.realpath(process.env.UPLOAD_DIRECTORY),filename=await fs.realpath(path.join(uploads,decodeURIComponent(url.slice(prefix.length))));assert.ok(filename.startsWith(uploads+path.sep));
  const bytes=await fs.readFile(filename);assert.ok(bytes.length>10000);
  assert.ok(report.nativeReceipts.some(receipt=>receipt.kind==='image'&&receipt.mcpCalls.some(call=>call.tool==='publish_image')&&receipt.mcpCalls.some(call=>call.tool==='submit_result')));
  Object.assign(report,{passed:true,url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }catch(error){report.passed=false;report.error=error.message;process.exitCode=1;}
 finally{await service.onModuleDestroy();report.observedAt=new Date().toISOString();await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,bytes:report.bytes,error:report.error,toolErrors:report.toolErrors}));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
