import { z } from 'zod';
export const MAX_STATUS_WAIT_SECONDS=25;
export const statusWaitSeconds=z.number().min(0).optional().describe(`Optional bounded server-side wait, capped at ${MAX_STATUS_WAIT_SECONDS} seconds. Returns as soon as status or stage changes or the job settles, so one waiting call replaces repeated polling. Omit for an immediate snapshot.`);
/** Bounded long-poll: re-reads a job until its status/stage changes, it settles, the wait expires or the turn aborts.
 * Re-read interval is adaptive: starts at intervalMs (fast pickup of quick transitions) and backs off x1.5 up to maxIntervalMs. */
export async function waitForJobChange<T extends {status?:string;stage?:string}>(read:()=>Promise<T>,waitSeconds:number|undefined,settled:(job:T)=>boolean,signal?:AbortSignal,intervalMs=1000,maxIntervalMs=3000){
  const started=Date.now(),first=await read();
  const deadline=started+Math.min(Math.max(Number(waitSeconds)||0,0),MAX_STATUS_WAIT_SECONDS)*1000;
  let job=first,delay=intervalMs;
  while(!settled(job)&&job.status===first.status&&job.stage===first.stage&&Date.now()<deadline&&!signal?.aborted){
    await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};
      const timer=setTimeout(done,Math.min(delay,deadline-Date.now()));signal?.addEventListener('abort',done,{once:true});});
    if(signal?.aborted)break;
    delay=Math.min(maxIntervalMs,Math.round(delay*1.5));
    job=await read();
  }
  return {job,waitedSeconds:Math.round((Date.now()-started)/100)/10};
}
