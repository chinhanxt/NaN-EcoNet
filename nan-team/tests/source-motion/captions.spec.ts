jest.mock('../../libraries/nestjs-libraries/src/upload/upload.factory',()=>({UploadFactory:{}}));
import {sourceMotionCaptions,sourceMotionHookDuration} from '../../libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service';
describe('source motion caption evidence',()=>{
 it('preserves requested hook timing and bounds it to the actual clip',()=>{
  expect(sourceMotionHookDuration(12,.75)).toBe(.75);expect(sourceMotionHookDuration(2,10)).toBe(2);expect(sourceMotionHookDuration(12)).toBe(5);
  for(const duration of [0,-1,NaN,Infinity,14401])expect(()=>sourceMotionHookDuration(12,duration)).toThrow('hook durationSeconds');
 });
 it('keeps original Vietnamese word timestamps without fabricating timing',()=>{
  expect(sourceMotionCaptions({segments:[{words:[{word:'Việt',start:0.2,end:0.5},{word:'Nam',start:0.5,end:0.9}]}]},2))
   .toEqual([{text:'Việt',startMs:200,endMs:500},{text:'Nam',startMs:500,endMs:900}]);
 });
 it('rejects overlapping or source-local timestamps outside the recut',()=>{
  expect(()=>sourceMotionCaptions({segments:[{words:[{word:'A',start:0,end:1},{word:'B',start:0.9,end:2}]}]},2)).toThrow(expect.objectContaining({name:'SourceVideoInputError',message:expect.stringContaining('ASR timings')}));
  expect(()=>sourceMotionCaptions({segments:[{words:[{word:'A',start:20,end:21}]}]},2)).toThrow('ASR timings');
 });
});
