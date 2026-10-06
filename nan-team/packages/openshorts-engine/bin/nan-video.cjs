#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createReadStream,createWriteStream}=require('node:fs');
const {Readable,Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {randomUUID}=require('node:crypto');
const COMMANDS={process:'processSourceVideoTool',generate:'generateAiVideoTool',status:'sourceVideoStatusTool','idea-status':'aiVideoStatusTool',projects:'sourceVideoProjectsTool',capabilities:'sourceVideoCapabilitiesTool',evidence:'sourceVideoEvidenceTool',approve:'approveSourceVideoTool',revise:'editVideoClipTool',cancel:'cancelSourceVideoTool',zip:'sourceVideoDownloadTool'};
const CAPTION_FLAGS={'--style':'style','--position':'position','--font-size':'fontSize','--font-name':'fontName',
 '--font-color':'fontColor','--highlight-color':'highlightColor','--border-color':'borderColor',
 '--border-width':'borderWidth','--bg-color':'bgColor','--bg-opacity':'bgOpacity','--effect':'effect','--base-opacity':'baseOpacity'};
function captionFlag(flag,value){
 const field=CAPTION_FLAGS[flag];if(!field||typeof value!=='string'||!value||value.startsWith('--'))throw new Error('Caption option requires a value');
 const bounds={fontSize:[10,200],borderWidth:[0,10],bgOpacity:[0,1],baseOpacity:[0,1]};
 if(bounds[field]){const number=Number(value),[low,high]=bounds[field];if(!Number.isFinite(number)||number<low||number>high)throw new Error('Caption number outside permitted bounds');return [field,number];}
 const choices={style:['karaoke','classic','neon','pop','box'],position:['top','middle','bottom'],effect:['none','glow','pop','box']};
 if(choices[field]&&!choices[field].includes(value))throw new Error('Unsupported caption option');
 if(field.endsWith('Color')&&!/^#[a-fA-F0-9]{6}$/.test(value))throw new Error('Caption color must use #RRGGBB');
 if(field==='fontName'&&!/^(?=.*\S)[A-Za-z0-9 _-]{1,80}$/.test(value))throw new Error('Invalid caption font name');
 return [field,value];
}
function withCaptionFlags(input,flags){
 if(!Object.keys(flags).length)return input;
 if(input.captions&&(typeof input.captions!=='object'||Array.isArray(input.captions)))throw new Error('captions must be an object');
 return {...input,captions:{enabled:true,...input.captions,...flags}};
}
function endpoint(value){
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('MCP endpoint requires HTTPS or local HTTP and no embedded credential');
 return url;
}
function resultValue(result){
 if(result.isError)throw new Error('MCP tool execution failed');
 const value=JSON.parse(result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));
 if(value.error&&!['failed','cancelled'].includes(value.status))throw new Error(value.error);
 return value;
}
async function payload(filename){
 if(!filename)return {};
 const chunks=[];let size=0;const input=filename==='-'?process.stdin:createReadStream(path.resolve(filename));
 for await(const chunk of input){size+=chunk.length;if(size>128*1024)throw new Error('Input JSON exceeds 128 KiB');chunks.push(Buffer.from(chunk));}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Input must be a JSON object');return value;
}
function uploadUrl(mcpUrl){
 const url=new URL(mcpUrl);
 if(!/\/mcp\/?$/.test(url.pathname))throw new Error('MCP endpoint must end in /mcp for local file upload');
 url.pathname=url.pathname.replace(/\/mcp\/?$/,'/public/v1/source-video-jobs/upload');
 return url;
}
async function uploadSourceFile(filename,mcpUrl,token,signal,request=fetch){
 const source=await fs.realpath(path.resolve(filename));
 const handle=await fs.open(source,'r');
 try{
  const info=await handle.stat();
  if(!info.isFile()||info.size<1||info.size>1024*1024*1024)throw new Error('Source video must be a regular file of 1 byte to 1 GiB');
  const boundary='nan-video-'+randomUUID();
  const safeName=path.basename(source).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)||'source.mp4';
  const start=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: video/mp4\r\n\r\n`);
  const end=Buffer.from(`\r\n--${boundary}--\r\n`);
  const body=Readable.from((async function*(){yield start;for await(const chunk of handle.createReadStream({autoClose:false}))yield chunk;yield end;})());
  const response=await request(uploadUrl(mcpUrl),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/form-data; boundary=${boundary}`,'Content-Length':String(start.length+info.size+end.length)},body,duplex:'half',redirect:'error',signal});
  if(!response.ok){const message=(await response.text()).slice(0,500);throw new Error(`Source upload failed (${response.status}): ${message}`);}
  const value=await response.json();
  if(!value||typeof value.id!=='string'||!value.id)throw new Error('Source upload response lacked a Media ID');
  return {mediaId:value.id,bytes:info.size};
 }finally{await handle.close();}
}
async function main(argv=process.argv.slice(2)){
 const command=argv.shift();
 if(!command||['help','--help','-h'].includes(command)){
  console.log('nan-video <process|generate|status|idea-status|projects|capabilities|evidence|approve|revise|cancel|zip> [jobId] [--input JSON-file|-] [--file local.mp4] [--watch] [--output ZIP-file]\nCaption flags for process/revise: --style, --position, --font-size, --font-name, --font-color, --highlight-color, --uppercase; appearance extras --border-color, --border-width, --bg-color, --bg-opacity, --effect, --base-opacity.\nSet NAN_MCP_URL and NAN_MCP_TOKEN privately in the environment. JSON options match the authenticated MCP tool schema. Watching pauses at approval; approve explicitly with expectedPlanVersion.');return;
 }
 if(!COMMANDS[command])throw new Error('Unknown video command');
 let inputFile,outputFile,sourceFile,jobId,watch=false;const captionFlags={};
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(arg==='--input')inputFile=argv[++i];else if(arg==='--output')outputFile=argv[++i];else if(arg==='--file')sourceFile=argv[++i];else if(arg==='--watch')watch=true;
  else if(arg==='--uppercase')captionFlags.uppercase=true;
  else if(CAPTION_FLAGS[arg]){const [field,value]=captionFlag(arg,argv[++i]);captionFlags[field]=value;}
  else if(!arg.startsWith('-')&&!jobId)jobId=arg;else throw new Error('Unknown or incomplete command option');
 }
 if((argv.includes('--input')&&!inputFile)||(argv.includes('--output')&&!outputFile)||(argv.includes('--file')&&!sourceFile))throw new Error('Option requires a value');
 if(sourceFile&&command!=='process')throw new Error('--file is only available for process');
 if(Object.keys(captionFlags).length&&!['process','revise'].includes(command))throw new Error('Caption flags are only available for process/revise');
 const url=endpoint(process.env.NAN_MCP_URL||'http://127.0.0.1:3000/mcp'),token=process.env.NAN_MCP_TOKEN;
 if(!token||/[\r\n]/.test(token))throw new Error('Set NAN_MCP_TOKEN to an authorized MCP credential');
 const input=withCaptionFlags(await payload(inputFile),captionFlags);if(jobId)input.jobId=jobId;
 if(sourceFile&&(input.mediaId||input.sourceUrl))throw new Error('--file cannot be combined with mediaId or sourceUrl');
 if(['process','generate','approve','revise'].includes(command)&&!inputFile)throw new Error('This command requires --input with explicit request JSON');
 const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
 const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
 const client=new Client({name:'nan-video-cli',version:'1.0.0'}),abort=new AbortController();
 const interrupt=()=>abort.abort(new Error('Observation interrupted; the video job remains unchanged'));
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{
  await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:`Bearer ${token}`},redirect:'error'}}));
  const call=async(name,args)=>{abort.signal.throwIfAborted();return resultValue(await client.callTool({name,arguments:args}));};
  if(sourceFile){const uploaded=await uploadSourceFile(sourceFile,url,token,abort.signal);input.mediaId=uploaded.mediaId;console.log(JSON.stringify({event:'uploaded',...uploaded}));}
  let value=await call(COMMANDS[command],input);
  if(command==='zip'&&outputFile){
   const download=new URL(value.downloadUrl);if(download.origin!==url.origin||download.username||download.password||download.search||download.hash)throw new Error('ZIP download escaped the authenticated MCP host');
   const target=path.resolve(outputFile),temporary=target+'.'+randomUUID()+'.tmp';
   try{
    const response=await fetch(download,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:abort.signal});
    if(!response.ok||!response.body||!/^application\/zip\b/.test(response.headers.get('content-type')||''))throw new Error('Authenticated ZIP download failed');
    let size=0;const cap=new Transform({transform(chunk,_encoding,done){size+=chunk.length;done(size>1024*1024*1024?new Error('ZIP exceeds CLI 1 GiB download budget'):null,chunk);}});
    await pipeline(Readable.fromWeb(response.body),cap,createWriteStream(temporary,{flags:'wx',mode:0o600}),{signal:abort.signal});
    // Exclusive copy prevents accidental replacement of an existing user file.
    await fs.copyFile(temporary,target,require('node:fs').constants.COPYFILE_EXCL);value={...value,savedTo:target,bytes:size};
   }finally{await fs.unlink(temporary).catch(()=>{});}
  }
  console.log(JSON.stringify(value));
  if(watch&&value.jobId&&['process','generate','revise','status','idea-status'].includes(command)){
   const statusTool=['generate','idea-status'].includes(command)?COMMANDS['idea-status']:COMMANDS.status;let last='';
   while(!['completed','failed','cancelled','awaiting_approval'].includes(value.status)){
    await new Promise(resolve=>setTimeout(resolve,2000));value=await call(statusTool,{jobId:value.jobId});
    const marker=`${value.status}:${value.stage}:${value.progress}`;if(marker!==last){console.log(JSON.stringify(value));last=marker;}
   }
  }
  if(['failed','cancelled'].includes(value.status))process.exitCode=1;
 }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await client.close().catch(()=>{});}
}
module.exports={endpoint,resultValue,uploadUrl,uploadSourceFile,main,COMMANDS,captionFlag,withCaptionFlags};
if(require.main===module)main().catch(error=>{console.error(String(error.message).replace(/Bearer\s+[^\s]+/gi,'Bearer [redacted]'));process.exitCode=1;});
