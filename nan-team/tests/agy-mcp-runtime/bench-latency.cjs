'use strict';
// Live benchmark: per-call AGY latency for source-video style analysis jobs (content 8 frames, ASR repair 4 frames).
// Usage: node tests/agy-mcp-runtime/bench-latency.cjs <input.json> <label> [cases=content,asr] [runs=1]
// input.json: {"content": {role,prompt,schema,frames}, "asr": {...}} (built from engine prompt builders).
const path=require('node:path'),fs=require('node:fs/promises');
const root=path.resolve(__dirname,'../..');process.chdir(root);
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
process.env.TS_NODE_PROJECT=path.join(root,'tsconfig.base.json');process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs'});process.env.TS_NODE_TRANSPILE_ONLY='1';
require('ts-node/register');require('tsconfig-paths/register');
const {AgyMcpService}=require('../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service');
const [input,label='run',cases='content,asr',runs='1']=process.argv.slice(2);
function turns(receipt){
  const pre=(receipt.policyDecisions||[]).filter((e)=>e.phase==='pre');
  const count={};for(const e of pre){const k=(e.tool==='call_mcp_tool'?e.target:e.tool)+(e.allowed?'':'!deny')+(e.skill?':skill':'')+(e.frameFileIndex!==undefined?':frame':'');count[k]=(count[k]||0)+1;}
  const at=pre.map((e)=>Date.parse(e.at)),submit=pre.filter((e)=>e.target==='video-job/submit_result').map((e)=>Date.parse(e.at));
  return {toolCalls:pre.length,count,toolPhaseSeconds:at.length?(Math.max(...(submit.length?[submit[0]]:at))-at[0])/1000:0};
}
(async()=>{
  const data=JSON.parse(await fs.readFile(input,'utf8')),results=[];
  for(let run=0;run<Number(runs);run++)for(const name of cases.split(',')){
    const service=new AgyMcpService();let receipt;const t0=Date.now();
    try{
      const value=await service.analyzeJson({...data[name],onEvent:(e)=>{if(e.type==='receipt')receipt=e.receipt;}});
      results.push({case:name,run,ok:true,seconds:(Date.now()-t0)/1000,resultBytes:JSON.stringify(value).length,result:value,...(receipt?turns(receipt):{}),jobId:receipt?.jobId});
    }catch(error){results.push({case:name,run,ok:false,seconds:(Date.now()-t0)/1000,error:String(error.message).slice(0,300),...(receipt?turns(receipt):{}),jobId:receipt?.jobId});}
    await service.onModuleDestroy?.();
    const last=results[results.length-1];console.log(JSON.stringify({label,case:last.case,ok:last.ok,seconds:last.seconds,toolCalls:last.toolCalls,count:last.count}));
  }
  const file=process.env.BENCH_OUT||path.join(root,'reports/openshorts-integration/speed-agy-latency.json');
  let prior={};try{prior=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  (prior.runs||=[]).push({label,startedAt:new Date(Date.now()).toISOString(),results});
  await fs.writeFile(file,JSON.stringify(prior,null,2)+'\n');
})().catch((e)=>{console.error(e);process.exitCode=1;});
