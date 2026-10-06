jest.mock('@mastra/core/tools',()=>({createTool:(options:any)=>options}));
jest.mock('../../libraries/nestjs-libraries/src/chat/auth.context',()=>({...jest.requireActual('../../libraries/nestjs-libraries/src/chat/auth.context'),checkAuth:jest.fn()}));
jest.mock('../../libraries/nestjs-libraries/src/videos/openshorts/source-video.service',()=>({SourceVideoService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/remotion/remotion.service',()=>({RemotionService:class {}}));
import { SourceVideoStatusTool, waitForJobChange, MAX_STATUS_WAIT_SECONDS } from '../../libraries/nestjs-libraries/src/chat/tools/source.video.status.tool';
import { AiVideoStatusTool } from '../../libraries/nestjs-libraries/src/chat/tools/ai.video.status.tool';
const context=(id:string,abortSignal?:AbortSignal)=>({requestContext:{get:(key:string)=>key==='organization'?JSON.stringify({id}):undefined},abortSignal});
const job='00000000-0000-4000-8000-000000000001';
describe('bounded MCP status waits',()=>{
 afterEach(()=>jest.useRealTimers());
 it('keeps immediate snapshots as one read when waitSeconds is omitted',async()=>{
  const service={summary:jest.fn().mockResolvedValue({jobId:job,status:'running',stage:'analysis',progress:10,clips:[]})};
  const result=await new SourceVideoStatusTool(service as any).run().execute!({jobId:job} as any,context('tenant') as any);
  expect(service.summary).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'running'});expect(result).not.toHaveProperty('waitedSeconds');
 });
 it('returns as soon as the stage changes instead of consuming the whole wait',async()=>{
  jest.useFakeTimers();
  const service={summary:jest.fn()
   .mockResolvedValueOnce({jobId:job,status:'running',stage:'analysis',progress:10,clips:[]})
   .mockResolvedValueOnce({jobId:job,status:'running',stage:'analysis',progress:30,clips:[]})
   .mockResolvedValueOnce({jobId:job,status:'awaiting_approval',stage:'review',progress:50,plan:{planVersion:2,clips:[]},clips:[]})};
  const pending=new SourceVideoStatusTool(service as any).run().execute!({jobId:job,waitSeconds:20} as any,context('tenant') as any);
  await jest.advanceTimersByTimeAsync(4000);
  const result=await pending;
  expect(service.summary).toHaveBeenCalledTimes(3);expect(service.summary).toHaveBeenCalledWith('tenant',job);
  // Adaptive re-read: 1s, then 1.5s -> the change is seen at 2.5s instead of 4s.
  expect(result).toMatchObject({status:'awaiting_approval',plan:{planVersion:2},waitedSeconds:2.5});
 });
 it('keeps waiting after approval (stage=approved) and never re-offers the plan',async()=>{
  jest.useFakeTimers();
  const approved:any={jobId:job,status:'awaiting_approval',stage:'approved',progress:50,plan:{planVersion:2,clips:[]},clips:[]};
  const service={summary:jest.fn().mockResolvedValueOnce(approved).mockResolvedValueOnce(approved)
   .mockResolvedValueOnce({jobId:job,status:'running',stage:'render',progress:60,plan:{planVersion:2,clips:[]},clips:[]})};
  const pending=new SourceVideoStatusTool(service as any).run().execute!({jobId:job,waitSeconds:20} as any,context('tenant') as any);
  await jest.advanceTimersByTimeAsync(4000);
  const result:any=await pending;
  expect(service.summary).toHaveBeenCalledTimes(3);
  expect(result).toMatchObject({status:'running',stage:'render',waitedSeconds:2.5});expect(result.plan).toBeUndefined();
  service.summary.mockReset().mockResolvedValue(approved);
  const snapshot:any=await new SourceVideoStatusTool(service as any).run().execute!({jobId:job} as any,context('tenant') as any);
  expect(snapshot).toMatchObject({status:'awaiting_approval',stage:'approved'});expect(snapshot.plan).toBeUndefined();
 });
 it('caps oversized waits and stops on turn abort',async()=>{
  jest.useFakeTimers();
  const read=jest.fn().mockResolvedValue({status:'running',stage:'render'});
  const capped=waitForJobChange(read,3600,()=>false);
  await jest.advanceTimersByTimeAsync(MAX_STATUS_WAIT_SECONDS*1000+5000);
  expect((await capped).waitedSeconds).toBe(MAX_STATUS_WAIT_SECONDS);
  expect(read.mock.calls.length).toBeLessThanOrEqual(MAX_STATUS_WAIT_SECONDS/2+2);
  const abort=new AbortController();read.mockClear();
  const aborted=waitForJobChange(read,20,()=>false,abort.signal);
  await jest.advanceTimersByTimeAsync(2000);abort.abort();
  expect((await aborted).job).toMatchObject({status:'running'});expect(read).toHaveBeenCalledTimes(2);
 });
 it('backs off re-reads 1s -> 1.5s -> 2.25s -> 3s (capped) during a long wait',async()=>{
  jest.useFakeTimers();
  const times:number[]=[],started=Date.now(),read=jest.fn(async()=>{times.push(Date.now()-started);return {status:'running',stage:'render'};});
  const pending=waitForJobChange(read,MAX_STATUS_WAIT_SECONDS,()=>false);
  await jest.advanceTimersByTimeAsync(MAX_STATUS_WAIT_SECONDS*1000+1000);await pending;
  expect(times.slice(0,6)).toEqual([0,1000,2500,4750,7750,10750]);
  expect(read.mock.calls.length).toBe(11);
 });
 it('does not wait on settled jobs and keeps tenant errors actionable',async()=>{
  const read=jest.fn().mockResolvedValue({status:'completed'});
  expect(await waitForJobChange(read,20,job=>job.status==='completed')).toMatchObject({waitedSeconds:0});expect(read).toHaveBeenCalledTimes(1);
  const service={summary:jest.fn().mockRejectedValue(new Error('Video job not found'))};
  expect(await new SourceVideoStatusTool(service as any).run().execute!({jobId:job,waitSeconds:10} as any,context('tenant') as any)).toEqual({error:'Video job not found'});
 });
 it('AI video status waits for a real media result with the authenticated organization',async()=>{
  jest.useFakeTimers();
  const media={id:'media',path:'https://example.invalid/video.mp4'};
  const videos={getStatus:jest.fn().mockResolvedValueOnce({jobId:job,status:'rendering',progress:40,stage:'rendering'}).mockResolvedValueOnce({jobId:job,status:'completed',progress:100,stage:'completed',media})};
  const tool=new AiVideoStatusTool(videos as any).run();
  expect(tool.inputSchema.parse({jobId:job,waitSeconds:600}).waitSeconds).toBe(600);
  const pending=tool.execute!({jobId:job,waitSeconds:600} as any,context('org') as any);
  await jest.advanceTimersByTimeAsync(2000);
  expect(await pending).toMatchObject({status:'completed',media,waitedSeconds:1});
  expect(videos.getStatus).toHaveBeenCalledWith('org',job);
  expect(tool.description).toContain('waitSeconds');
 });
});
