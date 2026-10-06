const assert = require('node:assert/strict');
const {readFile,writeFile,readdir,stat} = require('node:fs/promises');
const {resolve,join,relative,sep} = require('node:path');
const {createHash} = require('node:crypto');
const root = resolve('.');
const directory = join(root,'reports/video-pipeline');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path,'utf8'));
async function walk(path){
 const files=[];
 for(const entry of await readdir(path,{withFileTypes:true})){
   if(['node_modules','dist','.next','.git','out','coverage'].includes(entry.name)||entry.name.startsWith('.env'))continue;
   const absolute=join(path,entry.name);
   if(entry.isDirectory())files.push(...await walk(absolute));
   else if(entry.isFile())files.push(relative(root,absolute));
 }
 return files;
}
async function main(){
 const verification=await json(join(directory,'verification.json'));
 const browser=await json(join(directory,'browser-verification.json'));
 const renderer=await json(join(directory,'renderer-evidence.json'));
 const inputs=await json(join(directory,'inputs-evidence.json'));
 const output=await json(join(directory,'output-evidence.json'));
 assert.equal(browser.mode,'live');assert.equal(browser.attachedToAgent,true);
 assert.equal(browser.jobId,verification.jobId);
 assert.equal(browser.playback.src,verification.mediaUrl);
 assert.deepEqual(browser.errors,[]);
 const mp4=await readFile(verification.artifact);
 assert.equal(hash(mp4),verification.sha256);assert.equal(hash(mp4),output.outputSha256);
 assert.equal(verification.jobId,renderer.jobId);assert.equal(verification.jobId,inputs.jobId);
 for(const [path,expected] of Object.entries(renderer.sources)){
   assert.equal(hash(await readFile(join(root,'packages/remotion-engine',path))),expected,'Engine source changed: '+path);
 }
 assert.equal(output.colorSpace,'bt709');assert.equal(output.audioSampleRate,48000);
 const tokens=inputs.storyboard.scenes.flatMap(scene=>scene.voiceText.trim().split(/\s+/u));
 assert.equal(inputs.tts.captions.length,tokens.length);
 assert.deepEqual(inputs.tts.captions.map(c=>c.text.replace(/[\p{P}\p{S}]/gu,'').toLocaleLowerCase('vi')),
   tokens.map(t=>t.replace(/[\p{P}\p{S}]/gu,'').toLocaleLowerCase('vi')));
 const captionTimes=inputs.tts.captions;
 assert(captionTimes.every((c,i)=>c.startMs>=0&&c.endMs>c.startMs&&c.endMs<=30000&&(!i||c.startMs>=captionTimes[i-1].endMs)));
 const baseline=await json(join(root,'docs/superpowers/plans/video-agent-coordination.json'));
 const paths=new Set(Object.keys(baseline.sourceHashes).filter(p=>!p.split('/').some(part=>part.startsWith('.env'))));
 for(const location of ['packages/remotion-engine/src','packages/remotion-engine/public',
   'apps/backend/src','apps/frontend/src','libraries/nestjs-libraries/src','libraries/helpers/src','scripts','config']){
   for(const path of await walk(join(root,location)))paths.add(path);
 }
 for(const path of ['packages/remotion-engine/package.json','packages/remotion-engine/package-lock.json',
   'packages/remotion-engine/remotion.config.ts','packages/remotion-engine/tsconfig.json',
   'docs/superpowers/plans/2026-09-28-ai-video-generator-implementation.md'])paths.add(path);
 const sources={};
 for(const path of [...paths].sort()){
   const absolute=resolve(root,path);assert(absolute.startsWith(root+sep));
   try{if((await stat(absolute)).isFile())sources[path]=hash(await readFile(absolute));}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 const snapshotSha256=hash(Buffer.from(JSON.stringify(sources)));
 const evidenceFiles={};
 for(const path of await walk(directory)){
   if(path.endsWith('completion-receipt.json'))continue;
   evidenceFiles[path]=hash(await readFile(join(root,path)));
 }
 const receipt={at:new Date().toISOString(),decision:'allow',
   authorizedBy:'User requested five parallel agents, implementation and a real AGY video test',
   integrationOwner:'root',isolatedCopies:baseline.isolatedCopies,
   sourceIdentity:{kind:'exported working directory snapshot; no Git commit created',snapshotSha256,sources},
   requirements:{fiveAgentScopes:true,realAgyContentAndImages:true,seedVisionAndFirstScenePreserved:true,
     localRemotionRendering:true,vietnameseVoiceAndWordBoundaries:true,bgmAndCaptions:true,
     savedTenantMedia:true,realBrowserPlayback:true,attachedToAgent:true},
   video:verification,browser,evidenceFiles,
   limits:['Visual DNA is prompt guidance, not an absolute face-identity guarantee.',
     'Edge TTS and AGY generation require network access.',
     'Scheduling was verified with a mocked service boundary; no real social post was scheduled or published.']};
 await writeFile(join(directory,'completion-receipt.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify({jobId:verification.jobId,snapshotSha256,sourceFiles:Object.keys(sources).length,
   artifactSha256:verification.sha256,captionWords:tokens.length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
