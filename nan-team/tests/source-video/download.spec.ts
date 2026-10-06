import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
jest.mock('../../libraries/nestjs-libraries/src/database/prisma/organizations/organization.service',()=>({OrganizationService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service',()=>({OAuthService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/openshorts/source-video.service',()=>({SourceVideoService:class {}}));
import { SourceVideoPublicAuthMiddleware } from '../../apps/backend/src/services/auth/source.video.public.auth.middleware';
import { streamSourceVideoZip } from '../../apps/backend/src/api/routes/source-video-zip.stream';

describe('MCP source ZIP authentication',()=>{
 const response=()=>{const res={status:jest.fn(),json:jest.fn()};res.status.mockReturnValue(res);return res;};
 it('accepts MCP Bearer API keys and derives only their organization',async()=>{
  const organizations={getOrgByApiKey:jest.fn().mockResolvedValue({id:'tenant'})},oauth={getOrgByOAuthToken:jest.fn()};
  const middleware=new SourceVideoPublicAuthMiddleware(organizations as any,oauth as any);
  const req={headers:{authorization:'Bearer fixture-key','x-postiz-org':'victim'},query:{orgId:'victim'}} as any,next=jest.fn();
  await middleware.use(req,response() as any,next);
  expect(organizations.getOrgByApiKey).toHaveBeenCalledWith('fixture-key');expect(req.org.id).toBe('tenant');expect(next).toHaveBeenCalledTimes(1);expect(oauth.getOrgByOAuthToken).not.toHaveBeenCalled();
 });
 it('accepts OAuth Bearer tokens and rejects missing, empty or revoked credentials',async()=>{
  const organizations={getOrgByApiKey:jest.fn().mockResolvedValue(null)},oauth={getOrgByOAuthToken:jest.fn().mockResolvedValue({organization:{id:'oauth-tenant'}})};
  const middleware=new SourceVideoPublicAuthMiddleware(organizations as any,oauth as any);
  const req={headers:{authorization:'bEaReR pos_fixture'}} as any,next=jest.fn();
  await middleware.use(req,response() as any,next);expect(req.org.id).toBe('oauth-tenant');expect(oauth.getOrgByOAuthToken).toHaveBeenCalledWith('pos_fixture');
  oauth.getOrgByOAuthToken.mockResolvedValue(null as any);
  for(const authorization of [undefined,'','Bearer ','Bearer invalid','Bearer pos_revoked']){
   const res=response(),denied=jest.fn();await middleware.use({headers:{authorization}} as any,res as any,denied);
   expect(res.status).toHaveBeenCalledWith(401);expect(denied).not.toHaveBeenCalled();
  }
 });
 it('rejects deleted organizations for both API keys and OAuth tokens',async()=>{
  const deleted={id:'deleted',deletedAt:new Date()};
  const middleware=new SourceVideoPublicAuthMiddleware({getOrgByApiKey:jest.fn().mockResolvedValue(deleted)} as any,{getOrgByOAuthToken:jest.fn().mockResolvedValue({organization:deleted})} as any);
  for(const token of ['fixture-key','pos_fixture']){
   const res=response(),next=jest.fn();await middleware.use({headers:{authorization:`Bearer ${token}`}} as any,res as any,next);
   expect(res.status).toHaveBeenCalledWith(401);expect(next).not.toHaveBeenCalled();
  }
 });
});

describe('temporary source ZIP streaming',()=>{
 let directory:string;
 const request=()=>Object.assign(new EventEmitter(),{aborted:false});
 const response=()=>Object.assign(new EventEmitter(),{destroyed:false,setHeader:jest.fn()});
 beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'source-zip-stream-'));});
 afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
 it('streams only the organization-owned archive and cleans it after transfer',async()=>{
  const file=join(directory,'clips.zip');await writeFile(file,'fixture zip');
  const service={downloadAll:jest.fn().mockResolvedValue(file)},req=request(),res=response();
  const result=await streamSourceVideoZip(service as any,'tenant','job',req as any,res as any);
  expect(service.downloadAll).toHaveBeenCalledWith('tenant','job',expect.any(AbortSignal));
  const chunks:Buffer[]=[];for await(const chunk of result.getStream())chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe('fixture zip');expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','private, no-store');
  res.emit('finish');await new Promise(resolve=>setTimeout(resolve,20));await expect(stat(file)).rejects.toMatchObject({code:'ENOENT'});
 });
 it('aborts generation on disconnect and removes even a late-returned archive',async()=>{
  const file=join(directory,'late.zip');await writeFile(file,'fixture zip');let finish!:(file:string)=>void;
  const service={downloadAll:jest.fn().mockImplementation(()=>new Promise<string>(resolve=>{finish=resolve;}))},req=request(),res=response();
  const transfer=streamSourceVideoZip(service as any,'tenant','job',req as any,res as any);
  const rejected=expect(transfer).rejects.toThrow('disconnected');
  req.emit('aborted');expect(service.downloadAll.mock.calls[0][2].aborted).toBe(true);finish(file);await rejected;
  await new Promise(resolve=>setTimeout(resolve,20));await expect(stat(file)).rejects.toMatchObject({code:'ENOENT'});
 });
});
