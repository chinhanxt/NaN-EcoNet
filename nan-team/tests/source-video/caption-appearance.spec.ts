import 'reflect-metadata';
jest.mock('../../libraries/nestjs-libraries/src/upload/upload.factory',()=>({UploadFactory:{}}));
import {plainToInstance} from 'class-transformer';
import {validateSync} from 'class-validator';
import {SourceCaptionsDto} from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.dto';
import {sourceVideoOptions} from '../../libraries/nestjs-libraries/src/chat/tools/process.source.video.tool';
import {captionAppearanceSchema} from '../../packages/remotion-engine/src/types/source-video';
import {captionFont,captionMetrics,dimCaptionColor,sourceCaptionPages} from '../../packages/remotion-engine/src/components/source-caption-model';

describe('caption appearance boundaries and source motion semantics',()=>{
 const appearance={position:'middle',fontName:'Anton',fontSize:40,fontColor:'#FFFFFF',
  borderColor:'#112233',borderWidth:3,highlightColor:'#00FFFF',bgColor:'#000000',
  bgOpacity:.6,effect:'pop',baseOpacity:.5,uppercase:true};
 it('keeps every field through public and motion schemas',()=>{
  expect(validateSync(plainToInstance(SourceCaptionsDto,appearance))).toEqual([]);
  expect(sourceVideoOptions.captions.parse({enabled:true,style:'pop',...appearance})).toEqual({enabled:true,style:'pop',...appearance});
  expect(captionAppearanceSchema.parse(appearance)).toEqual(appearance);
 });
 it('rejects unsafe font/color input and nonfinite values consistently',()=>{
  for(const bad of [{fontName:"Anton',Outline=0"},{fontName:' '},{fontColor:'#fff'},
   {borderWidth:11},{fontSize:true},{fontSize:NaN},{bgOpacity:Infinity},{uppercase:'true'}]){
   expect(validateSync(plainToInstance(SourceCaptionsDto,bad)).length).toBeGreaterThan(0);
   expect(sourceVideoOptions.captions.safeParse(bad).success).toBe(false);
   expect(captionAppearanceSchema.safeParse(bad).success).toBe(false);
  }
 });
 it('matches virtual resolution, safe margins and inactive RGB dimming',()=>{
  expect(captionMetrics({fontSize:40,borderWidth:0},576)).toEqual({fontSize:68,margin:86,border:2,scale:2});
  expect(dimCaptionColor('#FFFFFF',0)).toBe('#868686');
  expect(dimCaptionColor('#112233',.5)).toBe('#0d1a26');
 });
 it('groups twenty characters without splitting punctuation or short gaps',()=>{
  const words=[{text:'Xin',startMs:0,endMs:200},{text:'chào.',startMs:600,endMs:800},
   {text:'Việt',startMs:800,endMs:1200},{text:'Nam',startMs:1200,endMs:1600},
   {text:'mỗi ngày',startMs:1600,endMs:1900}];
  expect(sourceCaptionPages(words)).toEqual([words.slice(0,4),words.slice(4)]);
 });
 it('keeps the Vietnamese compound "xe tải" on one page like core/subtitles.py',()=>{
  const timed:Array<[string,number,number]>=[['LẠI',5220,5380],['LẦN',5380,5580],['BỊ',5580,5740],['XE',5740,5920],
   ['TẢI',5920,6100],['TÔNG',6100,6320],['TRÚNG',6320,6620],['KHI',6620,6800]];
  const words=timed.map(([text,startMs,endMs])=>({text,startMs,endMs}));
  const pages=sourceCaptionPages(words,16,1400).map((page)=>page.map((w)=>w.text).join(' '));
  expect(pages.slice(0,2)).toEqual(['LẠI LẦN BỊ','XE TẢI TÔNG']);
  expect(pages.join(' ')).toBe(timed.map(([text])=>text).join(' '));
 });
 it('resolves exact bundled fonts and upstream font aliases',()=>{
  expect(captionFont('Verdana').file).toBe('LiberationSans-Bold.ttf');
  expect(captionFont('Impact').file).toBe('Anton-Regular.ttf');
  expect(captionFont('Montserrat ExtraBold').file).toBe('Montserrat-ExtraBold.ttf');
  expect(captionFont('Noto Serif Bold').file).toBe('NotoSerif-Bold.ttf');
  expect(captionFont('Custom Font').file).toBeUndefined();
 });
});
