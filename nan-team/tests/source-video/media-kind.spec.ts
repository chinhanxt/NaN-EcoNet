import { isVideoPath, mediaPathname } from '../../libraries/helpers/src/utils/media.kind';

describe('agent media kind',()=>{
 it('recognises video pathnames, ignoring query strings and fragments',()=>{
  for(const path of ['https://cdn.test/a/clip.mp4','https://cdn.test/clip.MOV?token=x.png','/uploads/2026/clip.webm#t=3','clip.m4v','https://cdn.test/clip.mp4?','  /uploads/clip.mp4  '])
   expect(isVideoPath(path)).toBe(true);
 });
 it('rejects images and substring look-alikes',()=>{
  for(const path of ['https://cdn.test/x.mp4.png','https://cdn.test/video.mp4/thumb.jpg','https://cdn.test/image.png?name=a.mp4','https://cdn.test/photo.jpg#clip.webm','https://cdn.test/mp4','/uploads/file.mp4x','',null,undefined])
   expect(isVideoPath(path)).toBe(false);
 });
 it('extracts the pathname from absolute and relative paths',()=>{
  expect(mediaPathname('https://cdn.test/a/b.mov?x=1#y')).toBe('/a/b.mov');
  expect(mediaPathname('/uploads/b.webm?x=1')).toBe('/uploads/b.webm');
  expect(mediaPathname(null)).toBe('');
 });
});
