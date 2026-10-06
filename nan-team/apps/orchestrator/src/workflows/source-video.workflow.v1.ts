import { ActivityCancellationType, CancellationScope, condition, defineSignal, isCancellation, proxyActivities, setHandler, sleep } from '@temporalio/workflow';
import type { SourceVideoActivityV1 } from '../activities/source-video.activity.v1';
const approve=defineSignal('sourceVideoApproveV1');
const {sourceVideoStageV1}=proxyActivities<SourceVideoActivityV1>({
 taskQueue:'main',startToCloseTimeout:'35 minutes',scheduleToCloseTimeout:'3 hours',heartbeatTimeout:'30 seconds',
 cancellationType:ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
 retry:{nonRetryableErrorTypes:['SourceVideoCapacityError'],maximumAttempts:5,initialInterval:'15 seconds',maximumInterval:'60 seconds',backoffCoefficient:2},
});
const {sourceVideoReviewV1,sourceVideoFinishV1}=proxyActivities<SourceVideoActivityV1>({
 taskQueue:'main',startToCloseTimeout:'2 minutes',retry:{maximumAttempts:20,initialInterval:'5 seconds',maximumInterval:'60 seconds'},
 cancellationType:ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
});
export async function sourceVideoWorkflowV1({orgId,jobId}:{orgId:string;jobId:string}) {
 async function stage(name:'prepare'|'analyze'|'render'|'verify'|'publish') {
  const deadline=Date.now()+3*60*60*1000;
  for(;;)try{return await sourceVideoStageV1(orgId,jobId,name);}catch(error:any){
   if(error.cause?.type!=='SourceVideoCapacityError'||Date.now()>=deadline)throw error;
   await sleep('15 seconds');
  }
 }
 let approved=false;setHandler(approve,()=>{approved=true;});
 try{
  await stage('prepare');
  await stage('analyze');
  let review=await sourceVideoReviewV1(orgId,jobId);
  for(let poll=0;review.required&&!review.approved;poll++){
   if(poll>=5760)throw new Error('Source plan approval expired after 24 hours');
   await condition(()=>approved,'15 seconds');approved=false;
   review=await sourceVideoReviewV1(orgId,jobId);
  }
  await stage('render');
  await stage('verify');
  await stage('publish');
  await sourceVideoFinishV1(orgId,jobId,'completed');
 }catch(error:any){
  const cancelled=isCancellation(error),message=cancelled?'Source video cancelled':error.cause?.message||error.message||'Source video workflow failed';
  await CancellationScope.nonCancellable(()=>sourceVideoFinishV1(orgId,jobId,cancelled?'cancelled':'failed',message));
 }
}
