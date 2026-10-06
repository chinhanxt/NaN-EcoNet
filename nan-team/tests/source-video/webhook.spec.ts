jest.mock('undici',()=>({Agent:class {constructor(readonly options:any){}},fetch:jest.fn()}));
import { createHmac } from 'node:crypto';
import { fetch } from 'undici';
import { assertSourceWebhookTarget, decryptSourceWebhook, encryptSourceWebhook, postSourceWebhook, sourceWebhookBody, sourceWebhookSignature, UnsafeSourceWebhookTarget } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.webhook';
describe('source video webhook wire and credential boundaries',()=>{
 const previousKey=process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY;
 beforeEach(()=>{process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY='fixture-encryption-key-at-least-32-bytes';jest.clearAllMocks();});
 afterAll(()=>{if(previousKey===undefined)delete process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY;else process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY=previousKey;});
 it('matches the upstream raw hexadecimal HMAC contract on exact UTF-8 bytes',()=>{
  expect(sourceWebhookSignature('The quick brown fox jumps over the lazy dog','key')).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  const body=JSON.stringify({title:'Thuyết Minh — tiết kiệm nước'}),key='shared-fixture-signing-key';
  expect(sourceWebhookSignature(body,key)).toBe(createHmac('sha256',Buffer.from(key,'utf8')).update(Buffer.from(body,'utf8')).digest('hex'));
  expect(sourceWebhookSignature(body,key)).not.toBe(sourceWebhookSignature(body+'\n',key));
 });
 it('encrypts destination and signing key with random authenticated envelopes',()=>{
  const secret='private-signing-fixture-secret',one=encryptSourceWebhook(secret),two=encryptSourceWebhook(secret);
  expect(one).not.toBe(two);expect(one).not.toContain(secret);expect(decryptSourceWebhook(one)).toBe(secret);
  const bytes=Buffer.from(one.slice(3),'base64url');bytes[bytes.length-1]^=1;
  expect(()=>decryptSourceWebhook('v1.'+bytes.toString('base64url'))).toThrow('configuration is unavailable');
  process.env.SOURCE_VIDEO_WEBHOOK_ENCRYPTION_KEY='different-fixture-key-for-rotation';
  expect(()=>decryptSourceWebhook(one)).toThrow('configuration is unavailable');
 });
 it('emits saved Media clips and excludes source/private configuration from callback payloads',()=>{
  const receipt:any={input:{webhook:{url:'private-url',secret:'private-key'}},sourcePath:'/private/input.mp4',state:{jobId:'fixture-job',status:'completed',clips:[{title:'Bản dựng',media:{id:'media',path:'https://storage.example/output.mp4'},durationSeconds:4.8}]}};
  expect(JSON.parse(sourceWebhookBody(receipt))).toEqual({event:'job.completed',job_id:'fixture-job',status:'completed',clips:[{index:0,title:'Bản dựng',video_url:'https://storage.example/output.mp4',duration:4.8}]});
  receipt.state.status='failed';receipt.state.error='Bearer private-token /private/path';
  expect(sourceWebhookBody(receipt)).not.toMatch(/private|Bearer/);
  expect(JSON.parse(sourceWebhookBody(receipt))).toMatchObject({event:'job.failed',clips:[],error:'Source video processing failed'});
  receipt.state.status='cancelled';expect(JSON.parse(sourceWebhookBody(receipt))).toMatchObject({event:'job.failed',status:'cancelled',clips:[]});
 });
 it('rejects private targets, credentials and mapped IPv6 before sending',async()=>{
  for(const target of ['http://8.8.8.8/callback','https://user:secret@8.8.8.8/callback','https://8.8.8.8/callback#token','https://127.0.0.1/callback','https://10.1.2.3/callback','https://169.254.169.254/callback','https://[::1]/callback','https://[::ffff:127.0.0.1]/callback'])await expect(assertSourceWebhookTarget(target)).rejects.toThrow('Unsafe webhook target');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('uses the protected transport despite a global bypass and never follows redirects',async()=>{
  const bypass=process.env.DISABLE_SSRF_PROTECTION;process.env.DISABLE_SSRF_PROTECTION='true';
  try{
   const cancel=jest.fn().mockResolvedValue(undefined);jest.mocked(fetch).mockResolvedValue({status:302,body:{cancel}} as any);
   expect(await postSourceWebhook('https://8.8.8.8/callback','{}',{},new AbortController().signal)).toBe(302);
   expect(fetch).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({method:'POST',redirect:'manual',dispatcher:expect.any(Object)}));expect(cancel).toHaveBeenCalledTimes(1);
   await expect(postSourceWebhook('https://[::ffff:7f00:1]/callback','{}',{},new AbortController().signal)).rejects.toThrow('Unsafe webhook target');
  }finally{if(bypass===undefined)delete process.env.DISABLE_SSRF_PROTECTION;else process.env.DISABLE_SSRF_PROTECTION=bypass;}
 });
 it('checks new DNS answers at submission and connection time',async()=>{
  const resolving=jest.spyOn(require('node:dns/promises'),'lookup');
  const connecting=jest.spyOn(require('node:dns'),'lookup');
  try{
   resolving.mockResolvedValue([{address:'8.8.8.8',family:4}]);
   jest.mocked(fetch).mockResolvedValue({status:200,body:{cancel:jest.fn()}} as any);
   await postSourceWebhook('https://fixture.example/callback','{}',{},new AbortController().signal);
   const agent:any=jest.mocked(fetch).mock.calls.at(-1)![1]!.dispatcher;
   connecting.mockImplementation((_host:any,_options:any,callback:any)=>callback(null,'127.0.0.1',4));
   const result=await new Promise<any>(resolve=>agent.options.connect.lookup('fixture.example',{},(error:any,address:any)=>resolve({error,address})));
   expect(result.error).toBeInstanceOf(Error);expect(result.address).toBe('');
   resolving.mockResolvedValue([{address:'10.0.0.1',family:4}]);
   await expect(assertSourceWebhookTarget('https://fixture.example/callback')).rejects.toThrow('Unsafe webhook target');
  }finally{resolving.mockRestore();connecting.mockRestore();}
 });
 it('keeps a transient DNS outage retryable instead of classifying it as an unsafe target',async()=>{
  const resolving=jest.spyOn(require('node:dns/promises'),'lookup').mockRejectedValue(Object.assign(new Error('temporary failure'),{code:'EAI_AGAIN'}));
  try{
   await expect(assertSourceWebhookTarget('https://fixture.example/callback')).rejects.toThrow('Webhook DNS lookup failed');
   await assertSourceWebhookTarget('https://fixture.example/callback').catch(error=>expect(error).not.toBeInstanceOf(UnsafeSourceWebhookTarget));
   expect(fetch).not.toHaveBeenCalled();
  }finally{resolving.mockRestore();}
 });
});
