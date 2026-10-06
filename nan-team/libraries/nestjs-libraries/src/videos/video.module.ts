import { Global, Module } from '@nestjs/common';
import { ImagesSlides } from '@gitroom/nestjs-libraries/videos/images-slides/images.slides';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { Seedance } from '@gitroom/nestjs-libraries/videos/seedance/seedance';
import { AgyMcpService } from './agy-mcp/agy.mcp.service';
import { SourceVideoMotionService } from './source-motion/source-video-motion.service';
import { SourceVideoService } from './openshorts/source-video.service';
import { SourceVideoWorker } from './openshorts/source-video.worker';
import { SourceVideoRepository } from './openshorts/source-video.repository';
import { SourceVideoWebhookService } from './openshorts/source-video.webhook.service';
import { StoryboardService } from './remotion/storyboard.service';
import { TtsService } from './remotion/tts.service';
import { RemotionService } from './remotion/remotion.service';

@Global()
@Module({
  providers: [ImagesSlides, Seedance, VideoManager, AgyMcpService, SourceVideoMotionService, SourceVideoRepository, SourceVideoWorker, SourceVideoService, SourceVideoWebhookService, StoryboardService, TtsService, RemotionService],
  get exports() {
    return this.providers;
  },
})
export class VideoModule {}
