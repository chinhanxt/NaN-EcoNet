import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SourceVideoWebhookDelivery } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { decryptSourceWebhook, postSourceWebhook, sourceWebhookSignature, UnsafeSourceWebhookTarget } from './source-video.webhook';

@Injectable()
export class SourceVideoWebhookService implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  private active?:Promise<boolean>;
  private readonly shutdown=new AbortController();
  constructor(private readonly prisma:PrismaService){}
  onModuleInit() {
    const tick=()=>{if(!this.active&&!this.shutdown.signal.aborted){this.active=this.deliverNext().catch(()=>false).finally(()=>{this.active=undefined;});}};
    tick();this.timer=setInterval(tick,1000);this.timer.unref();
  }
  async onModuleDestroy() {
    if(this.timer)clearInterval(this.timer);
    this.shutdown.abort(new Error('Webhook dispatcher stopped'));
    await this.active;
  }
  async claim(now=new Date()):Promise<SourceVideoWebhookDelivery|undefined> {
    for(let attempt=0;attempt<5;attempt++)try {
      return await this.prisma.$transaction(async tx=>{
        const row=await tx.sourceVideoWebhookDelivery.findFirst({where:{OR:[{status:'pending',nextAttemptAt:{lte:now}},{status:'sending',leaseUntil:{lte:now}}]},orderBy:{nextAttemptAt:'asc'}});
        if(!row)return;
        if(row.attempts>=3){await tx.sourceVideoWebhookDelivery.update({where:{jobId:row.jobId},data:{status:'exhausted',leaseOwner:null,leaseUntil:null,lastError:'acknowledgement_missing'}});return;}
        const owner=randomUUID();
        return tx.sourceVideoWebhookDelivery.update({where:{jobId:row.jobId},data:{status:'sending',attempts:{increment:1},epoch:{increment:1},leaseOwner:owner,leaseUntil:new Date(now.getTime()+30_000)}});
      },{isolationLevel:'Serializable'});
    } catch(error:any){if(error.code!=='P2034'||attempt===4)throw error;}
  }
  async acknowledge(row:SourceVideoWebhookDelivery,httpStatus?:number,error?:string,now=new Date()) {
    const delivered=!!httpStatus&&httpStatus>=200&&httpStatus<300;
    const exhausted=row.attempts>=3||['unsafe_target','secret_unavailable'].includes(error||'');
    const result=await this.prisma.sourceVideoWebhookDelivery.updateMany({where:{jobId:row.jobId,orgId:row.orgId,epoch:row.epoch,leaseOwner:row.leaseOwner,status:'sending',leaseUntil:{gt:now}},data:{status:delivered?'delivered':exhausted?'exhausted':'pending',leaseOwner:null,leaseUntil:null,
      nextAttemptAt:new Date(now.getTime()+(row.attempts===1?5000:30000)),lastStatusCode:httpStatus||null,lastError:delivered?null:error||'http_error',...(delivered?{deliveredAt:now}:{})}});
    return result.count===1;
  }
  protected post(target:string,body:string,headers:Record<string,string>,signal:AbortSignal) {
    return postSourceWebhook(target,body,headers,signal);
  }
  async deliverNext() {
    if(this.shutdown.signal.aborted)return false;
    const row=await this.claim();if(!row)return false;
    let target:string,secret:string;
    try {target=decryptSourceWebhook(row.targetCiphertext);secret=decryptSourceWebhook(row.secretCiphertext);}
    catch {await this.acknowledge(row,undefined,'secret_unavailable');return true;}
    let status:number|undefined,error:string|undefined;
    try {
      if(!row.payload)throw new Error('Missing immutable webhook body');
      status=await this.post(target,row.payload,{'Content-Type':'application/json','User-Agent':'OpenShorts-Webhook/1.0','X-OpenShorts-Signature':sourceWebhookSignature(row.payload,secret),'X-OpenShorts-Event-Id':row.jobId},AbortSignal.any([this.shutdown.signal,AbortSignal.timeout(15_000)]));
    } catch(issue) {error=issue instanceof UnsafeSourceWebhookTarget?'unsafe_target':'network_error';}
    // During shutdown leave the persisted sending lease for another process.
    if(!this.shutdown.signal.aborted)await this.acknowledge(row,status,error);
    return true;
  }
}
