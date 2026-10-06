'use strict';
// Live benchmark: N scene images sequential vs parallel through AgyMcpService.
// Usage: node tests/agy-mcp-runtime/bench-parallel-images.cjs [count] [mode=both|seq|par]
const path=require('node:path'),fs=require('node:fs/promises'),{execSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');process.chdir(root);
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
process.env.TS_NODE_PROJECT=path.join(root,'tsconfig.base.json');process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs'});process.env.TS_NODE_TRANSPILE_ONLY='1';
require('ts-node/register');require('tsconfig-paths/register');
const {AgyMcpService,agyLimits,agyProviderUrls}=require('../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service');
const count=Number(process.argv[2]||4),mode=process.argv[3]||'both';
const dna='\nVisual DNA: Subject: a young Vietnamese barista in a teal apron. Environment: small sunlit Saigon cafe. Color Palette: warm amber and teal. Art Style: cinematic photo. 9:16 vertical, no captions, no text, no watermark.';
const prompts=['grinding coffee beans at dawn','pouring a phin filter drip close-up','serving iced milk coffee to a customer','wiping the counter at sunset'].map(p=>`Barista ${p}.${dna}`);
function agyRssMb(){try{return Number(execSync("ps -C agy -o rss= | awk '{s+=$1} END {print s+0}'").toString())/1024;}catch{return 0;}}
function memAvailMb(){const m=/MemAvailable:\s+(\d+)/.exec(require('node:fs').readFileSync('/proc/meminfo','utf8'));return Number(m[1])/1024;}
async function phase(name,parallel){
  const service=new AgyMcpService(),receipts=[],run=service.run.bind(service);
  service.run=(request,signal)=>run({...request,onEvent:e=>{if(e.type==='receipt')receipts.push({status:e.receipt.status,providerHash:String(e.receipt.providerHash).slice(0,8),failureCategory:e.receipt.failureCategory,nativeToolErrors:(e.receipt.nativeToolErrors||[]).map(x=>x.category)});}},signal);
  process.env.AGY_MCP_IMAGE_CONCURRENCY=parallel?String(count):'1';
  let peakRss=0,minAvail=Infinity;const sampler=setInterval(()=>{peakRss=Math.max(peakRss,agyRssMb());minAvail=Math.min(minAvail,memAvailMb());},1000);
  const t0=Date.now(),perImage=[];
  const one=async(i)=>{const s=Date.now();try{const url=await service.image(prompts[i%prompts.length]);perImage[i]={ok:true,seconds:(Date.now()-s)/1000,url};}catch(e){perImage[i]={ok:false,seconds:(Date.now()-s)/1000,error:String(e.message).slice(0,300)};}};
  if(parallel)await Promise.all(Array.from({length:count},(_,i)=>one(i)));else for(let i=0;i<count;i++)await one(i);
  clearInterval(sampler);await service.onModuleDestroy();
  const out={name,parallel,images:count,wallSeconds:(Date.now()-t0)/1000,succeeded:perImage.filter(x=>x.ok).length,perImage,peakAgyRssMb:Math.round(peakRss),minMemAvailableMb:Math.round(minAvail),receipts};
  console.log(JSON.stringify({name,wall:out.wallSeconds,ok:out.succeeded,peakAgyRssMb:out.peakAgyRssMb,minAvail:out.minMemAvailableMb}));
  return out;
}
(async()=>{
  const report={startedAt:new Date().toISOString(),providers:agyProviderUrls().length,limits:agyLimits(),phases:[]};
  if(mode!=='par')report.phases.push(await phase('sequential',false));
  if(mode!=='seq')report.phases.push(await phase('parallel',true));
  const file=process.env.BENCH_OUT||path.join(root,'reports/openshorts-integration/speed-agy-parallel.json');
  let prior={};try{prior=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  (prior.runs||=[]).push(report);await fs.writeFile(file,JSON.stringify(prior,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
