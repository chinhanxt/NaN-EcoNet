import { BadRequestException } from '@nestjs/common';
import { copyFile, realpath, open } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Agent, fetch } from 'undici';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { isBlockedIp } from '../../dtos/webhooks/webhook.url.validator';
export function privatePath(root: string, path: string) {
  const resolved = resolve(path);
  if (!resolved.startsWith(resolve(root) + sep)) throw new Error('Worker path escaped private job directory');
  return resolved;
}
const dispatcher = new Agent({ connect: { lookup: (hostname, _options, callback) => {
  lookup(hostname, {family:4}, (error, address, family) => {
    if (error || isBlockedIp(address)) callback(error || new Error('Private source address rejected'), '', 4);
    else callback(null, address, family);
  });
} } });
export async function copyUploadedSource(url: string, destination: string) {
  const prefix = `${process.env.FRONTEND_URL}/uploads/`;
  if ((process.env.STORAGE_PROVIDER || 'local') !== 'local' || !url.startsWith(prefix)) return false;
  const root = await realpath(resolve(process.env.UPLOAD_DIRECTORY || '/uploads'));
  const suffix = decodeURIComponent(url.slice(prefix.length));
  if (suffix.includes('?') || suffix.includes('#') || suffix.includes('\0')) throw new BadRequestException('Invalid uploaded media path');
  const source = await realpath(privatePath(root, join(root,suffix)));
  privatePath(root,source);
  await copyFile(source,destination);
  return true;
}
export async function downloadSource(url: string, destination: string, signal: AbortSignal) {
  let current = url;
  for (let redirects=0; redirects<=5; redirects++) {
    signal.throwIfAborted();
    const parsed = new URL(current);
    const host = parsed.hostname.replace(/^\[|\]$/g,'');
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (isIP(host) && (isIP(host)!==4 || isBlockedIp(host)))) {
      throw new BadRequestException('Source must use a public HTTPS URL');
    }
    const response = await fetch(parsed, {dispatcher,signal,redirect:'manual'});
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects===5) throw new Error('Too many source redirects');
      current = new URL(location,parsed).href;
      continue;
    }
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('Source download failed'); }
    const maximum = 1024*1024*1024;
    if (Number(response.headers.get('content-length'))>maximum) { await response.body.cancel(); throw new Error('Source exceeds 1 GB'); }
    const file = await open(destination,'w',0o600);
    let bytes=0;
    try {
      for await (const chunk of response.body) {
        signal.throwIfAborted(); bytes+=chunk.length;
        if (bytes>maximum) throw new Error('Source exceeds 1 GB');
        await file.write(chunk);
      }
      if (!bytes) throw new Error('Source video is empty');
    } finally { await file.close(); await response.body.cancel().catch(() => undefined); }
    return;
  }
}
