'use strict';
require('dotenv').config({quiet:true});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{PrismaClient}=require('@prisma/client');
const root=path.resolve(__dirname,'..');
// Usage: node scripts/test-video-cli-live.cjs [job-report] [output-report]
//   job-report: a completed report with orgId+jobId (default live-mcp-controls)
//   output-report: receipt name (default live-video-cli); an existing receipt is never overwritten.
const [jobReport='live-mcp-controls',outputReport='live-video-cli']=process.argv.slice(2);
for(const name of [jobReport,outputReport])assert.match(name,/^[a-z0-9-]+$/,'Report names must be safe local filenames');
(async()=>{
 const outputPath=path.join(root,`reports/openshorts-integration/${outputReport}.json`);
 if(outputReport!=='live-video-cli'&&await fs.access(outputPath).then(()=>true,()=>false))throw new Error(`${outputPath} exists; choose a new output report name`);
 const fixture=JSON.parse(await fs.readFile(path.join(root,`reports/openshorts-integration/${jobReport}.json`),'utf8'));
 const expectedSha=(fixture.base||fixture.final)?.clips?.[0]?.sha256;assert.ok(fixture.orgId&&fixture.jobId&&expectedSha,'Job report lacks orgId/jobId/completed clip');
 const db=new PrismaClient(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'nan-video-cli-'));let key;
 try{
  const org=await db.organization.findUnique({where:{id:fixture.orgId},select:{apiKey:true}});assert.ok(org);
  if(!org.apiKey){key=crypto.randomBytes(32).toString('hex');assert.equal((await db.organization.updateMany({where:{id:fixture.orgId,apiKey:null},data:{apiKey:key}})).count,1);}
  const cli=path.join(root,'packages/openshorts-engine/bin/nan-video.cjs');
  const env={PATH:process.env.PATH,HOME:os.homedir(),LANG:process.env.LANG,NAN_MCP_URL:new URL('/mcp',process.env.NEXT_PUBLIC_BACKEND_URL).toString(),NAN_MCP_TOKEN:key||org.apiKey};
  const call=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{cwd:root,env,encoding:'utf8',timeout:30000,maxBuffer:256*1024}));
  const status=call(['status',fixture.jobId]);assert.equal(status.status,'completed');assert.equal(status.clips[0].sha256,expectedSha);
  const input=path.join(directory,'evidence.json');await fs.writeFile(input,JSON.stringify({kind:'crop-scenes',clipId:status.clips[0].clipId,limit:2}));
  const evidence=call(['evidence',fixture.jobId,'--input',input]);assert.equal(evidence.timestampBasis,'clip');assert.equal(evidence.items[0].sceneIndex,0);
  const zip=path.join(directory,'clips.zip'),download=call(['zip',fixture.jobId,'--output',zip]);assert.equal(download.savedTo,zip);
  const entries=JSON.parse(execFileSync('python3',['-c','import sys,zipfile,json,hashlib; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([{ "name":n,"sha256":hashlib.sha256(z.read(n)).hexdigest()} for n in z.namelist()]))',zip],{encoding:'utf8'}));
  assert.equal(entries[0].sha256,status.clips[0].sha256);
  const report={kind:'authenticated-video-CLI-over-MCP',jobReport,jobId:fixture.jobId,completedStatus:true,cropManifestRead:true,zipEntries:entries,cliSha256:crypto.createHash('sha256').update(await fs.readFile(cli)).digest('hex'),credentialNotInArguments:true,passed:true};
  await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n',{flag:outputReport==='live-video-cli'?'w':'wx'});console.log(JSON.stringify(report));
 }finally{if(key)await db.organization.updateMany({where:{id:fixture.orgId,apiKey:key},data:{apiKey:null}});await db.$disconnect();await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
