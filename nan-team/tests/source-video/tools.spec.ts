jest.mock('@mastra/core/tools',()=>({createTool:(options:any)=>options}));
jest.mock('../../libraries/nestjs-libraries/src/chat/auth.context',()=>({...jest.requireActual('../../libraries/nestjs-libraries/src/chat/auth.context'),checkAuth:jest.fn()}));
jest.mock('../../libraries/nestjs-libraries/src/videos/openshorts/source-video.service',()=>({SourceVideoService:class {}}));
import { ProcessSourceVideoTool } from '../../libraries/nestjs-libraries/src/chat/tools/process.source.video.tool';
import { SourceVideoStatusTool } from '../../libraries/nestjs-libraries/src/chat/tools/source.video.status.tool';
import { CancelSourceVideoTool } from '../../libraries/nestjs-libraries/src/chat/tools/cancel.source.video.tool';
import { EditVideoClipTool } from '../../libraries/nestjs-libraries/src/chat/tools/edit.video.clip.tool';
import { SourceVideoProjectsTool } from '../../libraries/nestjs-libraries/src/chat/tools/source.video.projects.tool';
import { ApproveSourceVideoTool } from '../../libraries/nestjs-libraries/src/chat/tools/approve.source.video.tool';
import { SourceVideoCapabilitiesTool } from '../../libraries/nestjs-libraries/src/chat/tools/source.video.capabilities.tool';
import { SourceVideoEvidenceTool } from '../../libraries/nestjs-libraries/src/chat/tools/source.video.evidence.tool';
import { SourceVideoDownloadTool } from '../../libraries/nestjs-libraries/src/chat/tools/source.video.download.tool';
import { ConflictException } from '@nestjs/common';
const context=(id?:string)=>({requestContext:new Map([['organization',JSON.stringify({id})]])});
describe('source video agent tools',()=>{
 it('requires organization auth for all source operations',async()=>{
  const service={start:jest.fn(),status:jest.fn(),cancel:jest.fn(),revise:jest.fn(),list:jest.fn(),approve:jest.fn(),capabilities:jest.fn()};
  for(const tool of [new ProcessSourceVideoTool(service as any),new SourceVideoStatusTool(service as any),new CancelSourceVideoTool(service as any),new EditVideoClipTool(service as any),new SourceVideoProjectsTool(service as any),new ApproveSourceVideoTool(service as any),new SourceVideoCapabilitiesTool(service as any),new SourceVideoEvidenceTool(service as any),new SourceVideoDownloadTool(service as any)]){
   expect(await tool.run().execute!({jobId:'job',clipId:'clip'} as any,context() as any)).toMatchObject({error:expect.stringContaining('organization')});
  }
  for(const method of Object.values(service))expect(method).not.toHaveBeenCalled();
 });
 it('preserves canonical editing controls and accepts square/landscape output independent of clippingEnabled',async()=>{
  const service={start:jest.fn().mockResolvedValue({jobId:'real-job'})};const tool=new ProcessSourceVideoTool(service as any).run();
  const input=tool.inputSchema.parse({mediaId:'source',operation:'edit',aspectRatio:'16:9',segments:[{startSeconds:4,endSeconds:22}],captions:{enabled:true,style:'neon'},audio:{mode:'keep'},effects:[{type:'punch_in',start:2,end:5,strength:0.1}],cropOverrides:{'0':0.4}});
  expect(await tool.execute!(input,context('tenant') as any)).toEqual({jobId:'real-job'});
  expect(service.start).toHaveBeenCalledWith({id:'tenant'},expect.objectContaining(input));
  expect(tool.inputSchema.safeParse({mediaId:'source',selection:{count:1.5}}).success).toBe(false);
 });
 it('only derives tenant identity from auth context and never accepts caller organization overrides',async()=>{
  const service={summary:jest.fn().mockRejectedValue(new Error('Video job not found'))};const tool=new SourceVideoStatusTool(service as any).run();
  expect(await tool.execute!({jobId:'foreign',organizationId:'victim'} as any,context('tenant') as any)).toEqual({error:'Video job not found'});
  expect(service.summary).toHaveBeenCalledWith('tenant','foreign');
 });
 it('returns a bounded Agent status without the full ASR transcript',async()=>{
  const media={id:'saved-media',path:'https://example.invalid/clip.mp4'};
  const service={summary:jest.fn().mockResolvedValue({jobId:'job',projectId:'project',revision:1,status:'completed',stage:'completed',progress:100,warnings:[],plan:{transcript:{text:'very large transcript'},clips:[]},clips:[{clipId:'clip',title:'Clip',durationSeconds:18,aspectRatio:'16:9',segments:[{startSeconds:0,endSeconds:18}],transcript:{text:'private transcript'},media,sha256:'hash'}]})};
  const result=await new SourceVideoStatusTool(service as any).run().execute!({jobId:'job'} as any,context('tenant') as any);
  expect(result).toMatchObject({status:'completed',clips:[{media}]});
  expect(JSON.stringify(result)).not.toContain('transcript');
 });
 it('approves only the authenticated job and exact plan version with requested edits',async()=>{
  const service={approve:jest.fn().mockResolvedValue({jobId:'job',projectId:'project',revision:1,status:'running',stage:'approved'})};
  const tool=new ApproveSourceVideoTool(service as any).run();
  const input=tool.inputSchema.parse({jobId:'0775dad6-6d50-4346-9551-fa5b5dd30d26',expectedPlanVersion:2,organizationId:'victim',clips:[{clipId:'clip',title:'Requested title',segments:[{startSeconds:2,endSeconds:12}]}]});
  expect(await tool.execute!(input,context('tenant') as any)).toMatchObject({status:'running',stage:'approved'});
  const {jobId,...approval}=input;
  expect(service.approve).toHaveBeenCalledWith({id:'tenant'},jobId,approval);
  expect(tool.inputSchema.safeParse({...input,expectedPlanVersion:0}).success).toBe(false);
 });
 it('reports stale plan conflicts without retrying or replacing the user approval',async()=>{
  const service={approve:jest.fn().mockRejectedValue(new ConflictException('Plan version changed'))};
  const result=await new ApproveSourceVideoTool(service as any).run().execute!({jobId:'job',expectedPlanVersion:1} as any,context('tenant') as any);
  expect(result).toEqual({error:'Plan version changed',statusCode:409});
  expect(service.approve).toHaveBeenCalledTimes(1);
 });
 it('shows concrete review controls without full transcript in the status tool',async()=>{
  const clip={clipId:'clip',title:'Review me',segments:[{startSeconds:2,endSeconds:12}],aspectRatio:'1:1',layout:'general',hook:'Save water',effects:[{type:'punch_in',start:1,end:2,strength:0.1}]};
  const service={summary:jest.fn().mockResolvedValue({jobId:'job',status:'awaiting_approval',plan:{planVersion:3,clips:[clip],transcript:{text:'large transcript'}},clips:[]})};
  const result=await new SourceVideoStatusTool(service as any).run().execute!({jobId:'job'} as any,context('tenant') as any);
  expect(result).toMatchObject({plan:{planVersion:3,clips:[clip]}});
  expect(JSON.stringify(result)).not.toContain('transcript');
 });
 it('does not claim model auth is proven by installed engine assets',async()=>{
  const state={prerequisitesPresent:true,nativeModel:'unverified: requires an authenticated live AGY MCP task'};
  const service={capabilities:jest.fn().mockResolvedValue(state)};
  expect(await new SourceVideoCapabilitiesTool(service as any).run().execute!({},context('tenant') as any)).toEqual(state);
 });
 it('keeps omitted revision options absent and requires the reviewed revision',()=>{
  const tool=new EditVideoClipTool({} as any).run();
  const request={jobId:'0775dad6-6d50-4346-9551-fa5b5dd30d26',clipId:'clip',expectedRevision:2,captions:{style:'neon'},audio:{bgmMediaId:'new-bgm'}};
  const input=tool.inputSchema.parse(request);
  expect(input).toEqual(request);
  expect(input.aspectRatio).toBeUndefined();expect(input.layout).toBeUndefined();expect(input.audio?.mode).toBeUndefined();
  const {expectedRevision,...unversioned}=request;
  expect(tool.inputSchema.safeParse(unversioned).success).toBe(false);
  expect(tool.inputSchema.parse({...request,hook:{enabled:true,durationSeconds:1.5}}).hook?.durationSeconds).toBe(1.5);
  expect(tool.inputSchema.safeParse({...request,hook:{durationSeconds:0}}).success).toBe(false);
 });
 it('paginates source evidence and marks clip timestamps without exposing private metadata',async()=>{
  const service={sourceScenes:jest.fn().mockResolvedValue([{startSeconds:0,endSeconds:6,privatePath:'/private/scene'}]),status:jest.fn().mockResolvedValue({jobId:'job',plan:{transcript:{language:'vi',segments:[{start:4,end:6,text:'Source text',words:[{start:4,end:5,word:'Source'},{start:5,end:6,word:'text'}]}]}},clips:[{clipId:'clip',segments:[{startSeconds:4,endSeconds:6}],transcript:{language:'vi',segments:[{start:0,end:2,text:'Clip text',words:[{start:0,end:1,word:'Clip'}]}]}}]})};
  const tool=new SourceVideoEvidenceTool(service as any).run();
  const base={jobId:'0775dad6-6d50-4346-9551-fa5b5dd30d26',kind:'words',limit:1};
  const first=await tool.execute!(tool.inputSchema.parse(base),context('tenant') as any);
  expect(first).toMatchObject({timestampBasis:'source',items:[{startSeconds:4,endSeconds:5,text:'Source'}],total:2,nextOffset:1});
  const next=await tool.execute!(tool.inputSchema.parse({...base,offset:1}),context('tenant') as any);
  expect(next).toMatchObject({items:[{text:'text'}],nextOffset:null});
  const clip=await tool.execute!(tool.inputSchema.parse({...base,clipId:'clip'}),context('tenant') as any);
  expect(clip).toMatchObject({timestampBasis:'clip',sourceSegments:[{startSeconds:4,endSeconds:6}],items:[{startSeconds:0,text:'Clip'}]});
  const scenes=await tool.execute!(tool.inputSchema.parse({...base,kind:'scenes'}),context('tenant') as any);
  expect(scenes).toMatchObject({items:[{startSeconds:0,endSeconds:6}]});expect(JSON.stringify(scenes)).not.toContain('private');
  expect(await tool.execute!(tool.inputSchema.parse({...base,clipId:'foreign'}),context('tenant') as any)).toEqual({error:'Completed clip not found'});
  expect(service.status).toHaveBeenCalledWith('tenant',base.jobId);
 });
 it('keeps recent project history bounded and omits transcripts and full plans',async()=>{
  const service={list:jest.fn().mockResolvedValue(Array.from({length:30},(_,index)=>({jobId:`job-${index}`,revision:index+1,status:'completed',stage:'completed',progress:100,plan:{transcript:'secret transcript'},clips:[{clipId:'clip',title:'Clip',transcript:'secret transcript',media:{id:'saved',path:'https://example.invalid/clip'}}]})))};
  const tool=new SourceVideoProjectsTool(service as any).run();
  const result=await tool.execute!(tool.inputSchema.parse({offset:10,limit:5}),context('tenant') as any);
  expect(result).toMatchObject({recentWindowTotal:30,nextOffset:15,projects:[{jobId:'job-10'},{jobId:'job-11'},{jobId:'job-12'},{jobId:'job-13'},{jobId:'job-14'}]});
  expect(JSON.stringify(result)).not.toContain('transcript');expect(JSON.stringify(result)).not.toContain('plan');
  expect(service.list).toHaveBeenCalledWith('tenant');expect(tool.inputSchema.safeParse({limit:100}).success).toBe(false);
 });
 it('returns credential-free protected ZIP links only for completed authenticated jobs',async()=>{
  const previous=process.env.NEXT_PUBLIC_BACKEND_URL;process.env.NEXT_PUBLIC_BACKEND_URL='https://backend.example';
  try{
   const service={status:jest.fn().mockResolvedValue({jobId:'job',status:'completed',clips:[{media:{id:'saved'}}]})};
   const tool=new SourceVideoDownloadTool(service as any).run();
   const result=await tool.execute!({jobId:'job'} as any,context('tenant') as any);
   expect(result).toMatchObject({downloadUrl:'https://backend.example/public/v1/source-video-jobs/job/download-all',browserDownloadUrl:'https://backend.example/ai-video/source-jobs/job/download-all',clipCount:1,contentType:'application/zip'});
   expect(JSON.stringify(result)).not.toContain('/private');expect(service.status).toHaveBeenCalledWith('tenant','job');
   service.status.mockResolvedValue({jobId:'job',status:'running',clips:[]} as any);
   expect(await tool.execute!({jobId:'job'} as any,context('tenant') as any)).toEqual({error:'Clips are not ready'});
  }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_BACKEND_URL;else process.env.NEXT_PUBLIC_BACKEND_URL=previous;}
 });
 it('keeps a backend path prefix and omits unavailable browser routes in MCP-only mode',async()=>{
  const previous={base:process.env.NEXT_PUBLIC_BACKEND_URL,override:process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL,mcp:process.env.MCP_ONLY};
  process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL='https://backend.example/api';process.env.MCP_ONLY='true';
  try{
   const tool=new SourceVideoDownloadTool({status:jest.fn().mockResolvedValue({jobId:'job',status:'completed',clips:[{}]})} as any).run();
   const result=await tool.execute!({jobId:'job'} as any,context('tenant') as any);
   expect(result).toMatchObject({downloadUrl:'https://backend.example/api/public/v1/source-video-jobs/job/download-all'});
   expect(result).not.toHaveProperty('browserDownloadUrl');
  }finally{
   for(const [key,value] of Object.entries({NEXT_PUBLIC_BACKEND_URL:previous.base,NEXT_PUBLIC_OVERRIDE_BACKEND_URL:previous.override,MCP_ONLY:previous.mcp})){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
   }
  }
 });
 it('reads actual crop scene indices separately from source-global scene positions',async()=>{
  const service={status:jest.fn().mockResolvedValue({jobId:'job',plan:{},clips:[{clipId:'clip',segments:[{startSeconds:4,endSeconds:12}]}]}),cropScenes:jest.fn().mockResolvedValue([{sceneIndex:3,startSeconds:0,endSeconds:8,strategy:'TRACK',privatePath:'/private/clip'}])};
  const tool=new SourceVideoEvidenceTool(service as any).run();
  const input=tool.inputSchema.parse({jobId:'0775dad6-6d50-4346-9551-fa5b5dd30d26',kind:'crop-scenes',clipId:'clip'});
  const result=await tool.execute!(input,context('tenant') as any);
  expect(result).toMatchObject({timestampBasis:'clip',sourceSegments:[{startSeconds:4,endSeconds:12}],items:[{sceneIndex:3,startSeconds:0,endSeconds:8,strategy:'TRACK'}]});
  expect(JSON.stringify(result)).not.toContain('privatePath');expect(service.cropScenes).toHaveBeenCalledWith('tenant',input.jobId,'clip');
  expect(await tool.execute!(tool.inputSchema.parse({...input,clipId:undefined}),context('tenant') as any)).toEqual({error:'crop-scenes requires a completed clipId'});
 });
});
