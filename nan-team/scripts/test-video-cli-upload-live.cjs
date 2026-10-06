'use strict';
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {endpoint,uploadUrl,uploadSourceFile}=require('../packages/openshorts-engine/bin/nan-video.cjs');

async function main(){
 const db=new PrismaClient();
 const source='/home/chinhan/Downloads/2aOboR247mJdjEToi8Xx83vhSbjxn8gUlENON4T2.mp4';
 const orgId=require('../reports/openshorts-integration/live-user-source-video.json').orgId;
 const url=endpoint('http://127.0.0.1:3000/mcp');
 let temporaryKey;
 try{
  const org=await db.organization.findUnique({where:{id:orgId},select:{apiKey:true}});
  assert.ok(org);
  temporaryKey=org.apiKey?undefined:crypto.randomBytes(32).toString('hex');
  if(temporaryKey)assert.equal((await db.organization.updateMany({where:{id:orgId,apiKey:null},data:{apiKey:temporaryKey}})).count,1);
  const token=temporaryKey||org.apiKey;
  const anonymous=await fetch(uploadUrl(url),{method:'POST',redirect:'error'});
  assert.equal(anonymous.status,401);
  const invalid=await fetch(uploadUrl(url),{method:'POST',headers:{Authorization:'Bearer invalid-token'},redirect:'error'});
  assert.equal(invalid.status,401);
  const before=await db.media.count({where:{organizationId:orgId}});
  const invalidPath=path.join('/tmp',`nan-video-reject-${crypto.randomUUID()}.png`);
  await fs.writeFile(invalidPath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlkZqQAAAAASUVORK5CYII=','base64'));
  let rejected=false;
  try{await uploadSourceFile(invalidPath,url,token);}catch(error){rejected=/400/.test(String(error));}finally{await fs.unlink(invalidPath);}
  assert.ok(rejected,'PNG disguised as video should be rejected');
  assert.equal(await db.media.count({where:{organizationId:orgId}}),before);
  const uploaded=await uploadSourceFile(source,url,token);
  const media=await db.media.findFirst({where:{id:uploaded.mediaId,organizationId:orgId}});
  assert.ok(media);
  const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const storage=path.resolve(process.env.UPLOAD_DIRECTORY);
  const relative=decodeURIComponent(new URL(media.path).pathname).replace(/^\/uploads\//,'');
  const stored=path.resolve(storage,relative);
  assert.ok(stored.startsWith(storage+path.sep));
  const storedHash=sha(await fs.readFile(stored));
  assert.equal(storedHash,sha(await fs.readFile(source)));
  const sourceFiles={};
  for(const filename of ['apps/backend/src/public-api/routes/v1/public.source-video.controller.ts','packages/openshorts-engine/bin/nan-video.cjs'])sourceFiles[filename]=sha(await fs.readFile(path.resolve(__dirname,'..',filename)));
  const report={kind:'authenticated-local-source-video-cli-upload',observedAt:new Date().toISOString(),orgId,mediaId:media.id,bytes:uploaded.bytes,sha256:storedHash,anonymousStatus:anonymous.status,invalidTokenStatus:invalid.status,disguisedPngRejected:rejected,failedUploadCreatedMedia:false,serverContentHashMatchesSource:true,sourceFiles};
  await fs.writeFile(path.resolve(__dirname,'../reports/openshorts-integration/live-cli-local-upload.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{
  if(temporaryKey)await db.organization.updateMany({where:{id:orgId,apiKey:temporaryKey},data:{apiKey:null}});
  await db.$disconnect();
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
