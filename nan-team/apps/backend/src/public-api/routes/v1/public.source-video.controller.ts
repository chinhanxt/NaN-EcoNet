import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { Request, Response } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { SourceVideoService } from '@gitroom/nestjs-libraries/videos/openshorts/source-video.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { sourceVideoUploadOptions } from '@gitroom/nestjs-libraries/upload/multer.stream.engine';
import { FileInterceptor } from '@nestjs/platform-express';
import { streamSourceVideoZip } from '../../../api/routes/source-video-zip.stream';

@ApiTags('Source video MCP artifacts')
@Controller('/public/v1/source-video-jobs')
export class PublicSourceVideoController {
  constructor(private readonly videos:SourceVideoService,private readonly media:MediaService){}
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file',sourceVideoUploadOptions()))
  upload(@GetOrgFromRequest() org:Organization,@UploadedFile() file?:Express.Multer.File){
    if(!file)throw new BadRequestException('No file provided');
    return this.media.saveFile(org.id,file.filename,file.path,file.originalname);
  }
  @Get('/:jobId/download-all')
  download(@GetOrgFromRequest() org:Organization,@Param('jobId',new ParseUUIDPipe()) jobId:string,@Req() req:Request,@Res({passthrough:true}) response:Response){
    return streamSourceVideoZip(this.videos,org.id,jobId,req,response);
  }
}
