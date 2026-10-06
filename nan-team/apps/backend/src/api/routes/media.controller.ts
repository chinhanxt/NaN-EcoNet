import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ApiTags } from '@nestjs/swagger';
import handleR2Upload from '@gitroom/nestjs-libraries/upload/r2.uploader';
import { FileInterceptor } from '@nestjs/platform-express';
import { streamUploadOptions } from '@gitroom/nestjs-libraries/upload/multer.stream.engine';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { VideoFunctionDto } from '@gitroom/nestjs-libraries/dtos/videos/video.function.dto';
import { AiDesignEditDto } from '@gitroom/nestjs-libraries/dtos/media/ai.design.edit.dto';
import { RemoveBackgroundDto } from '@gitroom/nestjs-libraries/dtos/media/remove.background.dto';

@ApiTags('Media')
@Controller('/media')
export class MediaController {
  private storage = UploadFactory.createStorage();
  constructor(
    private _mediaService: MediaService,
    private _subscriptionService: SubscriptionService
  ) {}

  @Delete('/:id')
  deleteMedia(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._mediaService.deleteMedia(org.id, id);
  }

  @Post('/generate-video')
  generateVideo(
    @GetOrgFromRequest() org: Organization,
    @Body() body: VideoDto
  ) {
    console.log('hello');
    return this._mediaService.generateVideo(org, body);
  }

  @Post('/generate-image')
  async generateImage(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Body('prompt') prompt: string,
    isPicturePrompt = false,
    @Body('aspect_ratio') aspectRatio?: string,
    referenceImageUrls?: string[]
  ) {
    const total = await this._subscriptionService.checkCredits(org);
    if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
      return false;
    }

    return {
      output: await this._mediaService.generateImage(
          prompt,
          org,
          isPicturePrompt,
          aspectRatio,
          undefined,
          referenceImageUrls
        ),
    };
  }

  @Post('/generate-image-with-prompt')
  async generateImageFromText(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Body('prompt') prompt: string,
    @Body('aspect_ratio') aspectRatio?: string,
    @Body('count') count?: number,
    // Sample images to follow (AI design chat generateImage ops), at most 4 upload URLs.
    @Body('referenceImageUrls') referenceImageUrls?: string[]
  ) {
    // count > 1: parallel fan-out (one AGY job per image); the response keeps the first image's
    // fields for existing clients and adds `images` + `failed`.
    if (Number(count) > 1) {
      const total = await this._subscriptionService.checkCredits(org);
      if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
        return false;
      }
      return this._mediaService.generateImageBatch(prompt, org, Number(count), aspectRatio, referenceImageUrls);
    }
    const image = await this.generateImage(
      org,
      req,
      prompt,
      true,
      aspectRatio,
      referenceImageUrls
    );
    if (!image) {
      return false;
    }

    const file = image.output;

    return this._mediaService.saveFile(org.id, file.split('/').pop(), file);
  }

  /**
   * Same generation as /generate-image-with-prompt, streamed as NDJSON lines: {type:'start',count},
   * {type:'image',index,media} per saved image as it finishes, {type:'error',index?,message}, {type:'done'}.
   * Generation is aborted when the client disconnects.
   */
  @Post('/generate-image-with-prompt/stream')
  async generateImageFromTextStream(
    @GetOrgFromRequest() org: Organization,
    @Body('prompt') prompt: string,
    @Res({ passthrough: false }) res: Response,
    @Body('aspect_ratio') aspectRatio?: string,
    @Body('count') count?: number,
    @Body('referenceImageUrls') referenceImageUrls?: string[]
  ) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Keep global compression from buffering images until the whole batch ends.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    const cancellation = new AbortController();
    const disconnected = () => { if (!res.writableEnded) cancellation.abort(new Error('Image client disconnected')); };
    res.once('close', disconnected);
    const write = (event: object) => { if (!res.destroyed && !cancellation.signal.aborted) res.write(JSON.stringify(event) + '\n'); };
    try {
      const total = await this._subscriptionService.checkCredits(org);
      if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
        write({ type: 'error', message: 'You have no AI image credits left.' });
      } else {
        await this._mediaService.generateImageStream(prompt, org, Number(count) || 1, write, aspectRatio, referenceImageUrls, cancellation.signal);
      }
    } catch (err) {
      write({ type: 'error', message: err instanceof HttpException ? err.message : 'Something went wrong while generating your image, please try again.' });
    } finally { res.off('close', disconnected); }
    write({ type: 'done' });
    if (!res.destroyed) res.end();
  }

  /** "AI thiết kế" chat: the model views the page screenshot and returns a reply plus Polotno operations (no credit). */
  @Post('/ai-design-edit')
  async aiDesignEdit(
    @GetOrgFromRequest() org: Organization,
    @Body() body: AiDesignEditDto,
    @Res({ passthrough: true }) res: Response
  ) {
    // Free: chat-style design editing uses no AI credit.
    // The AGY job stops when the editor closes or the user cancels the request.
    const cancellation = new AbortController();
    const disconnected = () => { if (!res.writableEnded) cancellation.abort(new Error('AI design client disconnected')); };
    res.once('close', disconnected);
    try {
      return await this._mediaService.aiDesignEdit(org, body, cancellation.signal);
    } finally {
      res.off('close', disconnected);
    }
  }

  /** Transparent PNG of an uploaded image (rembg on this server, no credit); saved as new media. */
  @Post('/remove-background')
  removeBackground(
    @GetOrgFromRequest() org: Organization,
    @Body() body: RemoveBackgroundDto
  ) {
    return this._mediaService.removeBackground(org, body.path);
  }

  @Post('/upload-server')
  @UseInterceptors(FileInterceptor('file', streamUploadOptions()))
  async uploadServer(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this._mediaService.saveFile(
      org.id,
      file.filename,
      file.path,
      file.originalname
    );
  }

  @Post('/save-media')
  async saveMedia(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Body('name') name: string,
    @Body('originalName') originalName: string
  ) {
    if (!name) {
      return false;
    }
    return this._mediaService.saveFile(
      org.id,
      name,
      process.env.CLOUDFLARE_BUCKET_URL + '/' + name,
      originalName || undefined
    );
  }

  @Post('/information')
  saveMediaInformation(
    @GetOrgFromRequest() org: Organization,
    @Body() body: SaveMediaInformationDto
  ) {
    return this._mediaService.saveMediaInformation(org.id, body);
  }

  @Post('/upload-simple')
  @UseInterceptors(FileInterceptor('file', streamUploadOptions()))
  async uploadSimple(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile('file') file: Express.Multer.File,
    @Body('preventSave') preventSave: string = 'false'
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (preventSave === 'true') {
      return { path: file.path };
    }

    return this._mediaService.saveFile(
      org.id,
      file.filename,
      file.path,
      file.originalname
    );
  }

  @Post('/:endpoint')
  async uploadFile(
    @GetOrgFromRequest() org: Organization,
    @Req() req: Request,
    @Res() res: Response,
    @Param('endpoint') endpoint: string
  ) {
    const upload = await handleR2Upload(endpoint, req, res);
    // a rejected or failed completion has already answered with its own status
    if (endpoint !== 'complete-multipart-upload' || res.headersSent) {
      return upload;
    }

    // @ts-ignore
    const name = upload.Location.split('/').pop();
    const originalName = req.body?.file?.name;

    const saveFile = await this._mediaService.saveUploadedFile(
      org.id,
      name,
      // @ts-ignore
      upload.Location,
      originalName || undefined
    );

    res.status(200).json({ ...upload, saved: saveFile });
  }

  @Get('/:id/status')
  getMediaStatus(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._mediaService.getMediaStatus(org.id, id);
  }

  @Get('/')
  getMedia(
    @GetOrgFromRequest() org: Organization,
    @Query('page') page: number,
    @Query('search') search?: string
  ) {
    return this._mediaService.getMedia(org.id, page, search);
  }

  @Get('/video-options')
  getVideos() {
    return this._mediaService.getVideoOptions();
  }

  @Post('/video/function')
  videoFunction(
    @Body() body: VideoFunctionDto
  ) {
    return this._mediaService.videoFunction(body.identifier, body.functionName, body.params);
  }

  @Get('/generate-video/:type/allowed')
  generateVideoAllowed(
    @GetOrgFromRequest() org: Organization,
    @Param('type') type: string
  ) {
    return this._mediaService.generateVideoAllowed(org, type);
  }
}
