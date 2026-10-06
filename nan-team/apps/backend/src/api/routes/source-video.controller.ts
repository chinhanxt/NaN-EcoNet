import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Organization } from '@prisma/client';
import { Request, Response } from 'express';
import { streamSourceVideoZip } from './source-video-zip.stream';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { SourceVideoService } from '@gitroom/nestjs-libraries/videos/openshorts/source-video.service';
import { ApproveSourceVideoDto, ReviseSourceVideoDto, SourceVideoDto } from '@gitroom/nestjs-libraries/videos/openshorts/source-video.dto';
@ApiTags('Source video')
@Controller('/ai-video/source-jobs')
export class SourceVideoController {
  constructor(private readonly videos:SourceVideoService) {}
  @Post('/') start(@GetOrgFromRequest() org:Organization,@Body() input:SourceVideoDto){return this.videos.start(org,input);}
  @Get('/') list(@GetOrgFromRequest() org:Organization){return this.videos.list(org.id);}
  @Get('/capabilities') capabilities(@GetOrgFromRequest() _org:Organization){return this.videos.capabilities();}
  @Get('/projects') projects(@GetOrgFromRequest() org:Organization){return this.videos.list(org.id);}
  @Get('/:jobId') @Throttle({default:{limit:1800,ttl:3_600_000}})
  status(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string,@Query('include') include?:string){return include==='transcript'?this.videos.status(org.id,jobId):this.videos.summary(org.id,jobId);}
  @Delete('/:jobId') cancel(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string){return this.videos.cancel(org.id,jobId);}
  @Post('/:jobId/approve') approve(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string,@Body() input:ApproveSourceVideoDto){return this.videos.approve(org,jobId,input);}
  @Post('/:jobId/retry') retry(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string){return this.videos.retry(org,jobId);}
  @Post('/:jobId/revisions') revise(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string,@Body() input:ReviseSourceVideoDto){return this.videos.revise(org,jobId,input);}
  @Get('/:jobId/transcript') transcript(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string){return this.videos.transcript(org.id,jobId);}
  @Get('/:jobId/download-all') download(@GetOrgFromRequest() org:Organization,@Param('jobId') jobId:string,@Req() req:Request,@Res({passthrough:true}) response:Response){
    return streamSourceVideoZip(this.videos,org.id,jobId,req,response);
  }
}
