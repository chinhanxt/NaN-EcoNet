import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
jest.mock('undici',()=>({Agent:class {},fetch:jest.fn()}));
import { fetch } from 'undici';
import { copyUploadedSource, downloadSource, privatePath } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.source';
describe('source media transport boundary',()=>{
 let directory:string;
 beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'source-transport-'));process.env.FRONTEND_URL='http://fixture.local';process.env.UPLOAD_DIRECTORY=join(directory,'uploads');process.env.STORAGE_PROVIDER='local';await mkdir(process.env.UPLOAD_DIRECTORY);jest.mocked(fetch).mockReset();});
 afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
 it('rejects local network, mapped IPv6 and URL credentials before opening a network request',async()=>{
  for(const url of ['https://127.0.0.1/video','https://10.0.0.1/video','https://169.254.169.254/video','https://[::ffff:7f00:1]/video','https://user:secret@public.example/video','file:///etc/passwd'])await expect(downloadSource(url,join(directory,'source'),new AbortController().signal)).rejects.toThrow('public HTTPS');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('validates redirect destinations instead of trusting the initial public URL',async()=>{
  const cancel=jest.fn().mockResolvedValue(undefined);
  jest.mocked(fetch).mockResolvedValue({status:302,headers:new Map([['location','https://127.0.0.1/private']]),body:{cancel}} as any);
  await expect(downloadSource('https://public.example/video',join(directory,'source'),new AbortController().signal)).rejects.toThrow('public HTTPS');
  expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:'manual',dispatcher:expect.any(Object)}));expect(cancel).toHaveBeenCalled();
 });
 it('prevents traversal and uploaded symlinks from escaping the configured storage directory',async()=>{
  const secret=join(directory,'secret.mp4');await writeFile(secret,'private-file');await symlink(secret,join(process.env.UPLOAD_DIRECTORY!,'link.mp4'));
  await expect(copyUploadedSource('http://fixture.local/uploads/link.mp4',join(directory,'copy'))).rejects.toThrow('escaped');
  await expect(copyUploadedSource('http://fixture.local/uploads/../secret.mp4',join(directory,'copy'))).rejects.toThrow('escaped');
  expect(()=>privatePath(directory,join(directory,'../sibling'))).toThrow('escaped');
 });
});
