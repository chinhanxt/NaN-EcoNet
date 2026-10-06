import { BadRequestException } from '@nestjs/common';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/** Video assets belong to configured NaN-Team upload storage, never a model endpoint. */
export function assertAiVideoAssetUrl(value: string): string {
  try {
    if (typeof value !== 'string' || value.length > 2048 || /[\\\s]/.test(value)) throw new Error();
    const rawPath = value.replace(/^[a-z]+:\/\/[^/]+/i, '');
    const decoded = decodeURIComponent(rawPath);
    if (decoded.split('/').some((part) => part === '.' || part === '..') || /[\\%\x00-\x1f]/.test(decoded)) throw new Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    const roots: URL[] = [];
    if (process.env.FRONTEND_URL) roots.push(new URL('/uploads/', process.env.FRONTEND_URL));
    if (process.env.CLOUDFLARE_BUCKET_URL) {
      const bucket = new URL(process.env.CLOUDFLARE_BUCKET_URL);
      bucket.pathname = `${bucket.pathname.replace(/\/$/, '')}/`; roots.push(bucket);
    }
    if (!roots.some((root) => root.origin === url.origin && url.pathname.startsWith(root.pathname)
      && url.pathname.length > root.pathname.length)) throw new Error();
    return url.href;
  } catch { throw new BadRequestException('Video asset must belong to configured NaN-Team upload storage'); }
}

/** Read configured local storage without booting the frontend asset route. */
export async function readLocalVideoAsset(value:string,maxBytes:number,signal?:AbortSignal):Promise<Buffer|undefined> {
  signal?.throwIfAborted();
  const url=new URL(assertAiVideoAssetUrl(value));
  if((process.env.STORAGE_PROVIDER||'local')!=='local'||!process.env.FRONTEND_URL)return undefined;
  const prefix=new URL('/uploads/',process.env.FRONTEND_URL);
  if(url.origin!==prefix.origin||!url.pathname.startsWith(prefix.pathname))return undefined;
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new Error('Invalid asset byte limit');
  const root=await realpath(resolve(process.env.UPLOAD_DIRECTORY||'/uploads'));
  const source=await realpath(join(root,decodeURIComponent(url.pathname.slice(prefix.pathname.length))));
  const suffix=relative(root,source);
  if(!suffix||suffix==='..'||suffix.startsWith('../'))throw new BadRequestException('Local video asset escaped configured storage');
  const file=await open(source,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const info=await file.stat();
    if(!info.isFile())throw new BadRequestException('Local video asset must be a regular file');
    if(info.size>maxBytes)throw new BadRequestException('Asset exceeds size limit');
    const chunks:Buffer[]=[];let size=0;
    for(;;){
      signal?.throwIfAborted();
      const block=Buffer.alloc(Math.min(64*1024,maxBytes-size+1));
      const {bytesRead}=await file.read(block,0,block.length,null);
      signal?.throwIfAborted();if(!bytesRead)break;
      size+=bytesRead;if(size>maxBytes)throw new BadRequestException('Asset exceeds size limit');
      chunks.push(block.subarray(0,bytesRead));
    }
    return Buffer.concat(chunks);
  } finally {await file.close();}
}
