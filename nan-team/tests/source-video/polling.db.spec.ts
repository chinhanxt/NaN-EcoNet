import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
jest.mock('../../libraries/nestjs-libraries/src/upload/upload.factory',()=>({UploadFactory:{createStorage:jest.fn()}}));
jest.mock('../../libraries/nestjs-libraries/src/database/prisma/media/media.repository',()=>({MediaRepository:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/remotion/tts.service',()=>({TtsService:class {}}));
jest.mock('../../libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service',()=>({SourceVideoMotionService:class {}}));
import { PrismaService } from '../../libraries/nestjs-libraries/src/database/prisma/prisma.service';
import { SourceVideoRepository } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.repository';
import { SourceVideoService } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.service';
const databaseUrl=process.env.SOURCE_VIDEO_DB_TEST_URL;
const describeDatabase=databaseUrl?describe:describe.skip;
/** Measures per-poll SQL statements and payload bytes for source-video status/list polling on a realistic receipt. */
describeDatabase('source-video polling cost (PostgreSQL)',()=>{
 let prisma:PrismaService,repository:SourceVideoRepository,service:SourceVideoService,orgId:string,root:string,queries=0;
 const ids:string[]=[];
 const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value));
 const measure=async<T>(action:()=>Promise<T>)=>{queries=0;const started=performance.now(),value=await action();return {value,queries,bytes:bytes(value),ms:Math.round((performance.now()-started)*10)/10};};
 const avgMs=async(action:()=>Promise<unknown>,runs=20)=>{const started=performance.now();for(let i=0;i<runs;i++)await action();return Math.round((performance.now()-started)/runs*10)/10;};
 beforeAll(async()=>{
  process.env.DATABASE_URL=databaseUrl;root=await mkdtemp(join(tmpdir(),'source-poll-fixture-'));process.env.SOURCE_VIDEO_JOB_DIRECTORY=root;
  prisma=new PrismaService();await prisma.$connect();(prisma as any).$on('query',()=>{queries++;});
  repository=new SourceVideoRepository(prisma);service=new SourceVideoService(repository,{} as any,{} as any,{} as any,{client:{getRawClient:():undefined=>undefined}} as any,{} as any);
  orgId=(await prisma.organization.create({data:{name:`source-video-poll-fixture-${randomUUID()}`}})).id;
  // Real receipt when SOURCE_VIDEO_POLL_JOB_ID names one (read-only copy into the fixture org), else a synthetic one of production shape.
  const real=process.env.SOURCE_VIDEO_POLL_JOB_ID?await prisma.sourceVideoJob.findFirst({where:{id:process.env.SOURCE_VIDEO_POLL_JOB_ID},select:{receipt:true}}):undefined;
  const words=Array.from({length:1500},(_,i)=>({start:i*.4,end:i*.4+.3,word:`từ${i}`}));
  const synthetic={plan:{version:1,planVersion:1,clips:[{clipId:'c1',title:'Clip',segments:[{startSeconds:0,endSeconds:30}],aspectRatio:'9:16',layout:'wide'}],transcript:{language:'vi',segments:[{start:0,end:600,text:'x'.repeat(20000),words}]}},
   clips:[{clipId:'c1',title:'Clip',durationSeconds:30,aspectRatio:'9:16',segments:[{startSeconds:0,endSeconds:30}],transcript:{segments:[{start:0,end:30,words}]},media:{id:'m',path:'p'},sha256:'h'}]};
  for(let i=0;i<10;i++){
   const receipt=await repository.create(orgId,{mediaId:'fixture-source'}),id=receipt.state.jobId;ids.push(id);
   const source=(real?.receipt as any)||{...receipt,state:{...receipt.state,...synthetic}};
   const copy={...source,orgId,workflowId:receipt.workflowId,state:{...source.state,jobId:id,projectId:receipt.state.projectId,revision:receipt.state.revision}};
   await prisma.sourceVideoJob.update({where:{id},data:{receipt:copy,status:'completed',stage:'completed',progress:100}});
  }
 });
 afterAll(async()=>{if(prisma)await prisma.$disconnect();if(root)await rm(root,{recursive:true,force:true});});
 it('status poll: lean summary reads the receipt once, then one small probe per unchanged poll',async()=>{
  const id=ids[0];
  const before=await measure(()=>service.status(orgId,id));
  const miss=await measure(()=>service.summary(orgId,id));
  const hit=await measure(()=>service.summary(orgId,id));
  const include=await measure(()=>service.status(orgId,id));
  await prisma.sourceVideoJob.update({where:{id},data:{progress:99}});
  const changed=await measure(()=>service.summary(orgId,id));
  expect(hit.value).toEqual(miss.value);expect(changed.value.progress).toBe(99);
  expect(JSON.stringify(hit.value.plan?.transcript??null)).toBe('null');
  expect(hit.bytes).toBeLessThan(before.bytes);expect(hit.queries).toBeLessThanOrEqual(before.queries);
  expect(include.value.plan?.transcript).toEqual(before.value.plan?.transcript);
  const latency={beforeMs:await avgMs(()=>service.status(orgId,id)),summaryHitMs:await avgMs(()=>service.summary(orgId,id))};
  console.info(JSON.stringify({poll:'status',latency,before:{queries:before.queries,bytes:before.bytes},summaryMiss:{queries:miss.queries,bytes:miss.bytes},summaryHit:{queries:hit.queries,bytes:hit.bytes},afterRowChange:{queries:changed.queries,bytes:changed.bytes},includeTranscript:{queries:include.queries,bytes:include.bytes}}));
 },60_000);
 it('list poll: lean states, receipts re-read only for changed rows',async()=>{
  const before=await measure(async()=>(await repository.list(orgId)).map(r=>r.state));
  const cold=await measure(()=>new SourceVideoService(repository,{} as any,{} as any,{} as any,{client:{getRawClient:():undefined=>undefined}} as any,{} as any).list(orgId));
  await service.list(orgId);
  const warm=await measure(()=>service.list(orgId));
  await prisma.sourceVideoJob.update({where:{id:ids[3]},data:{progress:98}});
  const oneChanged=await measure(()=>service.list(orgId));
  expect(warm.value.map(j=>j.jobId)).toEqual(before.value.map(j=>j.jobId));expect(warm.bytes).toBeLessThan(before.bytes);
  expect(oneChanged.value.find(j=>j.jobId===ids[3])?.progress).toBe(98);
  const latency={beforeMs:await avgMs(async()=>(await repository.list(orgId)).map(r=>r.state),5),warmMs:await avgMs(()=>service.list(orgId),5)};
  console.info(JSON.stringify({poll:'list',latency,jobs:ids.length,before:{queries:before.queries,bytes:before.bytes},cold:{queries:cold.queries,bytes:cold.bytes},warm:{queries:warm.queries,bytes:warm.bytes},oneRowChanged:{queries:oneChanged.queries,bytes:oneChanged.bytes}}));
 },60_000);
});
