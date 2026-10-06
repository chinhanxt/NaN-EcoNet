const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');process.chdir(root);
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
process.env.TS_NODE_PROJECT=path.join(root,'tsconfig.base.json');
process.env.TS_NODE_TRANSPILE_ONLY='true';
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs'});
require('ts-node/register');require('tsconfig-paths/register');
const {SourceVideoMotionService}=require('../../libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
(async()=>{
 const directory=path.join(root,'reports/source-motion/live-caption-appearance');await fs.mkdir(directory,{recursive:true});
 const source=path.join(directory,'source.mp4');
 execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=blue:size=320x320:rate=30',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-threads','1','-c:a','aac',source]);
 const sourceHash=hash(await fs.readFile(source));
 const clip={path:source,cleanPath:source,durationSeconds:2,aspectRatio:'1:1',title:'Caption appearance fixture',
  transcript:{segments:[{words:[{word:'Xin',start:0,end:.4},{word:'chào',start:.6,end:1},
   {word:'Việt',start:1,end:1.4},{word:'Nam',start:1.4,end:2}]}]}};
 const service=new SourceVideoMotionService({analyzeJson:()=>{throw new Error('Deterministic smoke must not invoke AI');}});
 const renders=[];
 for(const [style,fontName,position,variant] of [['classic','Anton','top'],['pop','Montserrat ExtraBold','middle'],
  ['neon','Noto Serif Bold','bottom'],['box','Arial','top'],['classic','Anton','middle','phrase']]){
  const appearance={position,fontName,fontSize:24,fontColor:'#FFFF00',borderColor:'#000000',borderWidth:2,
   highlightColor:'#00FFFF',bgColor:'#112233',bgOpacity:.6,baseOpacity:.7,uppercase:true};
  const caseDirectory=path.join(directory,variant||style);await fs.mkdir(caseDirectory,{recursive:true});
  const caseSource=path.join(caseDirectory,'source.mp4');await fs.copyFile(source,caseSource);
  const caseClip={...clip,path:caseSource,cleanPath:caseSource};
  const inputClip=variant==='phrase'?{...caseClip,transcript:{segments:[{words:[{
   word:'Xin chào Việt Nam. Mỗi ngày chúng ta cùng tập luyện để khỏe hơn, giữ tinh thần vui vẻ và tận hưởng cuộc sống.',start:0,end:2}]}]}}:caseClip;
  const result=await service.render(inputClip,caseDirectory,{enabled:true,theme:'clean',transitions:'none',
   captions:{enabled:true,style,...appearance},hook:{enabled:false}},new AbortController().signal,()=>{});
  const motion=JSON.parse(await fs.readFile(path.join(path.dirname(result.path),'motion-receipt.json'),'utf8'));
  assert.deepEqual(motion.props.captionAppearance,appearance);
  const frame=path.join(directory,(variant||style)+'.png');
  execFileSync('ffmpeg',['-v','error','-y','-threads','1','-ss','0.7','-i',result.path,
   '-frames:v','1','-vf','scale=540:540',frame]);
  const pixels=time=>execFileSync('ffmpeg',['-v','error','-threads','1','-ss',String(time),'-i',result.path,
   '-vf','scale=320:320','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-']);
  const difference=(a,b)=>{assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;};
  // Classic stays static when active word changes; pop visibly changes.
  const temporalDifference=difference(pixels(.2),pixels(.7));
  if(style==='classic')assert.ok(temporalDifference<.2,`Classic unexpectedly animates: ${temporalDifference}`);
  if(style==='pop')assert.ok(temporalDifference>.1,'Pop highlight did not change');
  const gapDifference=style==='classic'?undefined:difference(pixels(.35),pixels(.5));
  if(style!=='classic')assert.ok(gapDifference<.3,`Active word disappeared in gap: ${gapDifference}`);
  renders.push({style,variant,appearance,path:result.path,frame,sha256:hash(await fs.readFile(result.path)),
   temporalDifference,gapDifference,rendererInputs:path.join(path.dirname(result.path),'renderer-inputs.json')});
 }
 assert.equal(hash(await fs.readFile(source)),sourceHash);
 assert.equal(new Set(renders.map(item=>item.path)).size,renders.length,'Render artifacts must be distinct');
 for(const item of renders)assert.equal(hash(await fs.readFile(item.path)),item.sha256,'Earlier artifact was overwritten');
 const receipt={checkedAt:new Date().toISOString(),sourceHash,kind:'real-source-remotion-caption-appearance',
  timingProvenance:'fixture words, not ASR',policyDecision:{authorization:'ongoing integration',concurrency:1,
   cpuAffinity:process.env.TASK_CAPTION_CPU||'inherited',network:'loopback asset server only'},
  renders,sourceHashes:{}};
 for(const file of ['libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service.ts',
  'packages/remotion-engine/src/components/SourceCaptions.tsx','packages/remotion-engine/src/components/source-caption-model.ts',
  'packages/remotion-engine/src/types/source-video.ts'])receipt.sourceHashes[file]=hash(await fs.readFile(path.join(root,file)));
 await fs.writeFile(path.join(directory,'live-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({receipt:path.join(directory,'live-receipt.json'),renders:renders.length}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
