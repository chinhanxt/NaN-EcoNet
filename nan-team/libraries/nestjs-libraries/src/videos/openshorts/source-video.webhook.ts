import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns';
import { lookup as resolveHost } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, fetch } from 'undici';
import { isBlockedIp } from '../../dtos/webhooks/webhook.url.validator';
import { SourceReceipt } from './source-video.dto';

export class UnsafeSourceWebhookTarget extends Error {}
function parsedTarget(value:string) {
  let target:URL;
  try { target=new URL(value); } catch { throw new UnsafeSourceWebhookTarget('Unsafe webhook target'); }
  const host=target.hostname.replace(/^\[|\]$/g,'');
  if(target.protocol!=='https:'||target.username||target.password||target.hash||isIP(host)===6||(isIP(host)===4&&isBlockedIp(host)))throw new UnsafeSourceWebhookTarget('Unsafe webhook target');
  return target;
}
export async function assertSourceWebhookTarget(value:string,signal=AbortSignal.timeout(5000)) {
  const target=parsedTarget(value);
  signal.throwIfAborted();
  let stop:(()=>void)|undefined;
  try {
    const cancelled=new Promise<never>((_resolve,reject)=>{stop=()=>reject(signal.reason);signal.addEventListener('abort',stop,{once:true});});
    const addresses=await Promise.race([resolveHost(target.hostname,{family:4,all:true}),cancelled]);
    if(!addresses.length)throw new Error('No webhook DNS answers');
    if(addresses.some(item=>isBlockedIp(item.address)))throw new UnsafeSourceWebhookTarget('Unsafe webhook target');
  } catch(error) {
    signal.throwIfAborted();
    if(error instanceof UnsafeSourceWebhookTarget)throw error;
    throw new Error('Webhook DNS lookup failed');
  }
  finally {if(stop)signal.removeEventListener('abort',stop);}
  return target;
}
// Resolve/check again at connection time and connect to those exact public IPv4
// bytes. No deployment-wide SSRF bypass applies to callbacks.
const dispatcher=new Agent({connect:{lookup:(hostname,_options,callback)=>{
  lookup(hostname,{family:4},(error,address,family)=>{
    if(error||isBlockedIp(address))callback(error||new UnsafeSourceWebhookTarget('Unsafe webhook target'),'',4);
    else callback(null,address,family);
  });
}}});
export async function postSourceWebhook(target:string,body:string,headers:Record<string,string>,signal:AbortSignal) {
  const url=await assertSourceWebhookTarget(target,signal);
  signal.throwIfAborted();
  const response=await fetch(url,{method:'POST',body,headers,dispatcher,redirect:'manual',signal});
  await response.body?.cancel();
  return response.status;
}
function encryptionKey() {
  const configured=process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY||process.env.JWT_SECRET;
  if(!configured||configured.length<16)throw new BadRequestException('Webhook encryption key is not configured');
  return createHash('sha256').update('NaN-Team/source-video-webhook/v1\0').update(configured).digest();
}
export function encryptSourceWebhook(value:string) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from('source-video-webhook/v1'));
  const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return 'v1.'+Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');
}
export function decryptSourceWebhook(value:string) {
  try {
    if(!value.startsWith('v1.'))throw new Error('Invalid envelope');
    const bytes=Buffer.from(value.slice(3),'base64url');
    if(bytes.length<29)throw new Error('Invalid envelope');
    const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),bytes.subarray(0,12));
    decipher.setAAD(Buffer.from('source-video-webhook/v1'));decipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
  } catch { throw new Error('Webhook signing configuration is unavailable'); }
}
export function sourceWebhookSignature(body:string,secret:string) {
  return createHmac('sha256',secret).update(body,'utf8').digest('hex');
}
export function sourceWebhookBody(receipt:SourceReceipt) {
  const completed=receipt.state.status==='completed';
  return JSON.stringify({event:completed?'job.completed':'job.failed',job_id:receipt.state.jobId,status:receipt.state.status,
    clips:completed?receipt.state.clips.map((clip,index)=>({index,title:clip.title,video_url:clip.media.path,duration:clip.durationSeconds})):[],
    // Internal worker errors can contain file paths or upstream credentials.
    ...(!completed?{error:receipt.state.status==='cancelled'?'Source video cancelled':'Source video processing failed'}:{})});
}
