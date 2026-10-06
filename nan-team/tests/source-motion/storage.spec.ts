jest.mock('file-type',()=>({fileTypeFromBuffer:jest.fn()}));
import { mkdtemp, readFile, readdir, rm, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { LocalStorage } from '../../libraries/nestjs-libraries/src/upload/local.storage';
describe('deterministic source video storage',()=>{
  let root:string,storage:LocalStorage;
  const key='source-video/tenant/job/clip.mp4';
  beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'source-storage-'));storage=new LocalStorage(root);});
  afterEach(async()=>{await rm(root,{recursive:true,force:true});});
  it('retries an exact key without creating another published artifact',async()=>{
    await storage.uploadStreamAtKey(Readable.from(['verified-first']),'video/mp4',key);
    await storage.uploadStreamAtKey(Readable.from(['verified-retry']),'video/mp4',key);
    expect((await readFile(join(root,key))).toString()).toBe('verified-retry');
    expect(await readdir(join(root,'source-video/tenant/job'))).toEqual(['clip.mp4']);
  });
  it('rejects traversal, incompatible mime and symlink escapes',async()=>{
    await expect(storage.uploadStreamAtKey(Readable.from(['x']),'video/mp4','source-video/../job/clip.mp4')).rejects.toThrow('key');
    await expect(storage.uploadStreamAtKey(Readable.from(['x']),'text/html',key)).rejects.toThrow('key');
    const outside=await mkdtemp(join(tmpdir(),'source-storage-outside-'));
    try {await mkdir(join(root,'source-video'));await symlink(outside,join(root,'source-video/tenant'));
      await expect(storage.uploadStreamAtKey(Readable.from(['x']),'video/mp4',key)).rejects.toThrow('escaped');
    } finally {await rm(outside,{recursive:true,force:true});}
  });
  it('cancellation never replaces a prior completed object with a truncated stream',async()=>{
    await storage.uploadStreamAtKey(Readable.from(['complete']),'video/mp4',key);
    let wrote=false;
    const stream=new Readable({read(){if(!wrote){wrote=true;this.push('partial');}}});
    const controller=new AbortController();
    const upload=storage.uploadStreamAtKey(stream,'video/mp4',key,controller.signal);
    setTimeout(()=>controller.abort(),20);
    await expect(upload).rejects.toThrow();
    expect((await readFile(join(root,key))).toString()).toBe('complete');
    expect(await readdir(join(root,'source-video/tenant/job'))).toEqual(['clip.mp4']);
  });
});
