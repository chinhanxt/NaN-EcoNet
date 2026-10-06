import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { ApplicationFailure } from '@temporalio/common';
import { Context, heartbeat } from '@temporalio/activity';
import { SourceVideoService, SourceVideoStage } from '@gitroom/nestjs-libraries/videos/openshorts/source-video.service';
@Injectable()
@Activity()
export class SourceVideoActivityV1 {
 constructor(private readonly videos:SourceVideoService){}
 @ActivityMethod()
 async sourceVideoStageV1(orgId:string,jobId:string,stage:SourceVideoStage) {
  const context=Context.current(),info=context.info;
  try{return await this.videos.executeStage(orgId,jobId,stage,`${info.workflowExecution.runId}:${info.activityId}:${info.attempt}`,context.cancellationSignal,()=>heartbeat({jobId,stage}));}
  catch(error:any){
   if(error?.name==='SourceVideoCapacityError')throw ApplicationFailure.create({message:error.message,type:'SourceVideoCapacityError',nonRetryable:true});
   if(error?.name==='SourceVideoNativeAuthError')throw ApplicationFailure.create({message:error.message,type:'SourceVideoNativeAuthError',nonRetryable:true});
   if(error?.name==='SourceVideoStorageError')throw ApplicationFailure.create({message:error.message,type:'SourceVideoStorageError',nonRetryable:true});
   if(error?.name==='SourceVideoInputError')throw ApplicationFailure.create({message:error.message,type:'SourceVideoInputError',nonRetryable:true});
   throw error;
  }
 }
 @ActivityMethod()
 async sourceVideoReviewV1(orgId:string,jobId:string){return this.videos.reviewState(orgId,jobId);}
 @ActivityMethod()
 async sourceVideoFinishV1(orgId:string,jobId:string,status:'completed'|'failed'|'cancelled',message?:string){return this.videos.finish(orgId,jobId,status,message);}
}
