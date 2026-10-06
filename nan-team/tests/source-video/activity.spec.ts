jest.mock('@gitroom/nestjs-libraries/videos/openshorts/source-video.service',()=>({SourceVideoService:class {}}));
import { SourceVideoActivityV1 } from '../../apps/orchestrator/src/activities/source-video.activity.v1';
import { Context } from '@temporalio/activity';

describe('Temporal source video activity failure classification',()=>{
 const current=jest.spyOn(Context,'current');
 beforeEach(()=>current.mockReturnValue({info:{workflowExecution:{runId:'run'},activityId:'activity',attempt:1},cancellationSignal:new AbortController().signal} as any));
 afterAll(()=>current.mockRestore());
 it.each(['SourceVideoCapacityError','SourceVideoNativeAuthError','SourceVideoInputError','SourceVideoStorageError'])('marks %s non-retryable for the workflow decision',async name=>{
  const error=Object.assign(new Error('specific cause'),{name});
  const activity=new SourceVideoActivityV1({executeStage:jest.fn().mockRejectedValue(error)} as any);
  await expect(activity.sourceVideoStageV1('org','job','analyze')).rejects.toMatchObject({type:name,nonRetryable:true,message:'specific cause'});
 });
});
