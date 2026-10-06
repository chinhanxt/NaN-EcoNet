import { StreamableFile } from '@nestjs/common';
import { createReadStream, ReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Request, Response } from 'express';
import { SourceVideoService } from '@gitroom/nestjs-libraries/videos/openshorts/source-video.service';

export async function streamSourceVideoZip(videos:SourceVideoService,orgId:string,jobId:string,req:Request,response:Response){
  const abort=new AbortController();
  let file:string|undefined,stream:ReadStream|undefined,cleaned=false;
  const cleanup=()=>{
    if(cleaned||!file)return;cleaned=true;
    stream?.destroy();void unlink(file).catch(()=>undefined);
  };
  const disconnected=()=>{abort.abort(new Error('Source ZIP client disconnected'));cleanup();};
  req.once('aborted',disconnected);
  response.once('close',disconnected);
  response.once('finish',cleanup);
  try{
    if(req.aborted||response.destroyed)disconnected();
    abort.signal.throwIfAborted();
    file=await videos.downloadAll(orgId,jobId,abort.signal);
    if(abort.signal.aborted){cleanup();abort.signal.throwIfAborted();}
    response.setHeader('Cache-Control','private, no-store');
    stream=createReadStream(file);stream.once('error',cleanup);
    return new StreamableFile(stream,{type:'application/zip',disposition:`attachment; filename="clips-${jobId}.zip"`});
  }catch(error){cleanup();throw error;}
  finally{req.removeListener('aborted',disconnected);}
}
