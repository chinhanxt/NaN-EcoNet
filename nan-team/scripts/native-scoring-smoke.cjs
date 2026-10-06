'use strict';
const path=require('node:path'),fs=require('node:fs/promises');
const root=path.resolve(__dirname,'..');process.chdir(root);
process.env.TS_NODE_PROJECT=path.join(root,'tsconfig.base.json');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs'});
require('ts-node/register');require('tsconfig-paths/register');
const {AgyMcpService}=require('../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service');
const schema={$defs:{ScoredWindowModel:{type:'object',properties:{id:{type:'string'},start:{type:'number'},end:{type:'number'},score:{type:'integer'},reason:{type:'string'}},required:['id','start','end','score','reason']}},type:'object',properties:{windows:{type:'array',items:{$ref:'#/$defs/ScoredWindowModel'}}},required:['windows']};
(async()=>{const errors=[];const request={role:'content-editor',schema,prompt:'Rank this single window. Return one item with exact id window_001, start 0, end 18, score integer 0–100, short reason. Transcript: Xin chào các bạn, hãy tiết kiệm nước. There are zero visual frames.'};
 const location=path.join(root,'reports/openshorts-integration/native-scoring-smoke.json');await fs.mkdir(path.dirname(location),{recursive:true});
 try{const result=await new AgyMcpService().analyzeJson(request,undefined,event=>{if(event.type==='mcp-error'||event.type==='failure')errors.push({type:event.type,name:event.name,message:event.message,errors:event.errors});});
  await fs.writeFile(location,JSON.stringify({result,errors},null,2));console.log(JSON.stringify({ok:true,result,errors}));
 }catch(error){await fs.writeFile(location,JSON.stringify({error:error.message,errors},null,2));console.error(JSON.stringify({ok:false,error:error.message,errors}));process.exitCode=1;}
})();
