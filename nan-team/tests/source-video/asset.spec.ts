import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readLocalVideoAsset } from '../../libraries/nestjs-libraries/src/videos/video.asset';
describe('API-only configured local video assets',()=>{
 let directory:string;const saved={...process.env};
 beforeEach(async()=>{
  directory=await mkdtemp(join(tmpdir(),'nan-local-assets-'));process.env.UPLOAD_DIRECTORY=join(directory,'uploads');
  process.env.FRONTEND_URL='http://frontend.invalid';process.env.STORAGE_PROVIDER='local';await mkdir(process.env.UPLOAD_DIRECTORY);
 });
 afterEach(async()=>{await rm(directory,{recursive:true,force:true});for(const name of ['UPLOAD_DIRECTORY','FRONTEND_URL','STORAGE_PROVIDER','CLOUDFLARE_BUCKET_URL']){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}});
 it('reads bounded bytes from storage without a frontend HTTP request',async()=>{
  await writeFile(join(process.env.UPLOAD_DIRECTORY!,'scene.png'),'local image');
  expect(await readLocalVideoAsset('http://frontend.invalid/uploads/scene.png',30)).toEqual(Buffer.from('local image'));
 });
 it('does not treat configured cloud storage as local disk',async()=>{
  process.env.CLOUDFLARE_BUCKET_URL='https://bucket.example/media';
  expect(await readLocalVideoAsset('https://bucket.example/media/scene.png',30)).toBeUndefined();
 });
 it('rejects symlinks out of storage and encoded traversal before reading',async()=>{
  const secret=join(directory,'secret.png');await writeFile(secret,'private');await symlink(secret,join(process.env.UPLOAD_DIRECTORY!,'link.png'));
  await expect(readLocalVideoAsset('http://frontend.invalid/uploads/link.png',30)).rejects.toThrow('escaped');
  for(const url of ['http://frontend.invalid/uploads/%2e%2e/secret.png','http://frontend.invalid/uploads/%252e%252e/secret.png','http://user:pass@frontend.invalid/uploads/scene.png'])await expect(readLocalVideoAsset(url,30)).rejects.toThrow('configured NaN-Team');
 });
 it('rejects directories, oversized files and caller cancellation',async()=>{
  await mkdir(join(process.env.UPLOAD_DIRECTORY!,'folder'));await writeFile(join(process.env.UPLOAD_DIRECTORY!,'large.png'),Buffer.alloc(40));
  await expect(readLocalVideoAsset('http://frontend.invalid/uploads/folder',30)).rejects.toThrow('regular file');
  await expect(readLocalVideoAsset('http://frontend.invalid/uploads/large.png',30)).rejects.toThrow('size limit');
  const cancel=new AbortController();cancel.abort(new Error('disconnected'));
  await expect(readLocalVideoAsset('http://frontend.invalid/uploads/large.png',30,cancel.signal)).rejects.toThrow('disconnected');
 });
});
