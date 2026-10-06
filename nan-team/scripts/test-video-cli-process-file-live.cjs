'use strict';
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');

async function main(){
 const db=new PrismaClient();
 const orgId=require('../reports/openshorts-integration/live-user-source-video.json').orgId;
 const source='/home/chinhan/Downloads/2aOboR247mJdjEToi8Xx83vhSbjxn8gUlENON4T2.mp4';
 const inputPath=path.resolve(__dirname,'../reports/openshorts-integration/cli-file-rejected-request.json');
 let temporaryKey;
 try{
  await fs.writeFile(inputPath,JSON.stringify({operation:'edit',aspectRatio:'16:9',segments:[{startSeconds:4,endSeconds:2}]})+'\n');
  const org=await db.organization.findUnique({where:{id:orgId},select:{apiKey:true}});assert.ok(org);
  temporaryKey=org.apiKey?undefined:crypto.randomBytes(32).toString('hex');
  if(temporaryKey)assert.equal((await db.organization.updateMany({where:{id:orgId,apiKey:null},data:{apiKey:temporaryKey}})).count,1);
  const token=temporaryKey||org.apiKey;
  const jobsBefore=await db.sourceVideoJob.count({where:{orgId}});
  const child=spawn(process.execPath,['packages/openshorts-engine/bin/nan-video.cjs','process','--file',source,'--input',inputPath],{cwd:path.resolve(__dirname,'..'),env:{...process.env,NAN_MCP_URL:'http://127.0.0.1:3000/mcp',NAN_MCP_TOKEN:token},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
  assert.equal(code,1);
  const uploaded=JSON.parse(stdout.trim().split('\n')[0]);assert.equal(uploaded.event,'uploaded');assert.ok(uploaded.mediaId);
  assert.match(stderr,/Invalid source segment|MCP tool execution failed/);
  assert.ok(!stdout.includes(token)&&!stderr.includes(token));
  assert.equal(await db.sourceVideoJob.count({where:{orgId}}),jobsBefore);
  assert.ok(await db.media.findFirst({where:{id:uploaded.mediaId,organizationId:orgId}}));
  const report={kind:'cli-process-file-to-mcp-negative-boundary',observedAt:new Date().toISOString(),uploadedMediaId:uploaded.mediaId,uploadBytes:uploaded.bytes,cliExitCode:code,invalidRequestRejected:true,sourceJobsCreated:0,credentialLeaked:false};
  await fs.writeFile(path.resolve(__dirname,'../reports/openshorts-integration/live-cli-process-file-dispatch.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{if(temporaryKey)await db.organization.updateMany({where:{id:orgId,apiKey:temporaryKey},data:{apiKey:null}});await db.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
