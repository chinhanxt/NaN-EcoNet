const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');process.chdir(root);
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
process.env.TS_NODE_PROJECT=path.join(root,'tsconfig.base.json');
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({module:'commonjs'});
require('ts-node/register');require('tsconfig-paths/register');
const {SourceVideoMotionService}=require('../../libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service');
(async()=>{
 const directory=path.join(root,'reports/source-motion/live-hook-duration');await fs.mkdir(directory,{recursive:true});
 const source=path.join(directory,'source.mp4');
 execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=blue:size=320x180:rate=30',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-threads','1','-c:a','aac',source]);
 const clip={path:source,cleanPath:source,durationSeconds:2,aspectRatio:'16:9',title:'Thiết kế trên video thật',
  transcript:{segments:[{words:[{word:'Xin',start:0.2,end:0.6},{word:'chào',start:0.6,end:1.2}]}]}};
 const service=new SourceVideoMotionService({analyzeJson:()=>{throw new Error('This deterministic smoke must not invoke AI');}});
 const result=await service.render(clip,directory,{enabled:true,theme:'clean',transitions:'none',
  captions:{enabled:false,style:'neon'},hook:{enabled:true,text:'Thiết kế giữ tiếng gốc',durationSeconds:.75}},new AbortController().signal,()=>{});
 const assert=require('node:assert/strict');
 const motion=JSON.parse(await fs.readFile(path.join(path.dirname(result.path),'motion-receipt.json'),'utf8'));
 assert.equal(motion.props.hookDurationSeconds,.75);
 const frame=(file,time)=>execFileSync('ffmpeg',['-v','error','-threads','1','-ss',String(time),'-i',file,'-vf','scale=320:180','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-']);
 const difference=time=>{const a=frame(source,time),b=frame(result.path,time);assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;};
 const timing={durationSeconds:.75,duringDifference:difference(.25),afterDifference:difference(1.5)};
 assert.ok(timing.duringDifference>timing.afterDifference+1);assert.ok(timing.afterDifference<3);
 const receipt={hookTiming:timing,kind:'real-source-remotion-render',path:result.path,sha256:crypto.createHash('sha256').update(await fs.readFile(result.path)).digest('hex')};
 await fs.writeFile(path.join(directory,'live-receipt.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
