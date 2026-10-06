'use strict';
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const {resultValue}=require('../packages/openshorts-engine/bin/nan-video.cjs');
async function main(){
 const db=new PrismaClient(),client=new Client({name:'source-webhook-mcp-boundaries',version:'1.0.0'});
 const prior=require('../reports/openshorts-integration/live-webhook-process-restart.json');
 let temporaryKey;
 try{
  const org=await db.organization.findUniqueOrThrow({where:{id:prior.orgId},select:{apiKey:true}});
  if(!org.apiKey){temporaryKey=crypto.randomBytes(32).toString('hex');assert.equal((await db.organization.updateMany({where:{id:prior.orgId,apiKey:null},data:{apiKey:temporaryKey}})).count,1);}
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp'),{requestInit:{headers:{Authorization:`Bearer ${temporaryKey||org.apiKey}`},redirect:'error'}}));
  const registry=await client.listTools();
  assert.ok(registry.tools.find(tool=>tool.name==='processSourceVideoTool')?.inputSchema?.properties?.webhook);
  const call=async(name,args)=>resultValue(await client.callTool({name,arguments:args}));
  const state=await call('sourceVideoStatusTool',{jobId:prior.jobId});
  assert.equal(state.webhook.status,'delivered');assert.equal(state.webhook.attempts,3);assert.equal(state.webhook.lastStatusCode,204);
  assert.ok(!JSON.stringify(state).includes('Ciphertext')&&!JSON.stringify(state).includes('8.8.8.8')&&!JSON.stringify(state).includes('private-target'));
  const source=await db.media.create({data:{organizationId:prior.orgId,name:'webhook-mcp-negative-fixture.mp4',path:'https://storage.example/never-downloaded-fixture.mp4',status:'ready',type:'video'}});
  const before=await db.sourceVideoJob.count({where:{orgId:prior.orgId}});
  const blocked=await client.callTool({name:'processSourceVideoTool',arguments:{mediaId:source.id,operation:'edit',idempotencyKey:crypto.randomUUID(),webhook:{url:'https://127.0.0.1/callback',secret:crypto.randomBytes(32).toString('hex')}}});
  assert.notEqual(blocked.isError,true);const rejected=JSON.parse(blocked.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));
  assert.match(rejected.error,/public HTTPS target/);assert.equal(await db.sourceVideoJob.count({where:{orgId:prior.orgId}}),before);
  const foreign=require('../reports/openshorts-integration/live-user-source-video.json').jobId;
  const foreignResult=await client.callTool({name:'sourceVideoStatusTool',arguments:{jobId:foreign}});
  const denied=JSON.parse(foreignResult.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));assert.match(denied.error,/not found/);assert.ok(!denied.webhook);
  const report={kind:'authenticated-source-video-webhook-mcp-boundaries',observedAt:new Date().toISOString(),orgId:prior.orgId,jobId:prior.jobId,webhookSchemaDiscovered:true,publicDeliveryStatus:state.webhook,callbackCredentialsExposed:false,privateCallbackRejected:true,newJobsCreated:0,foreignJobDenied:true,renderStarted:false,policyDecision:{decision:'allow',authority:'user authorized local AGY MCP/video integration',scope:'local authenticated status/schema/negative request only'}};
  await fs.writeFile(path.resolve(__dirname,'../reports/openshorts-integration/live-webhook-mcp-boundaries.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await client.close().catch(()=>{});if(temporaryKey)await db.organization.updateMany({where:{id:prior.orgId,apiKey:temporaryKey},data:{apiKey:null}});await db.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
