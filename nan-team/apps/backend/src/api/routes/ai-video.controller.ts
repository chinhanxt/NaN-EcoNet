import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { RemotionService } from '@gitroom/nestjs-libraries/videos/remotion/remotion.service';
import { StoryboardService } from '@gitroom/nestjs-libraries/videos/remotion/storyboard.service';
import { GenerateAiVideoDto, GenerateStoryboardDto, PreviewVoiceDto, RegenerateImageDto, RenderVideoDto } from '@gitroom/nestjs-libraries/videos/remotion/dto/ai.video.dto';

@ApiTags('AI Video')
@Controller('/ai-video')
export class AiVideoController {
  constructor(private readonly remotion: RemotionService, private readonly storyboard: StoryboardService) {}

  @Post('/generate-storyboard')
  generateStoryboard(@GetOrgFromRequest() _org: Organization, @Body() input: GenerateStoryboardDto) {
    return this.storyboard.generate(input);
  }

  /** Same storyboard as a job: poll /status/:jobId for the script, each finished scene image and the final storyboard. */
  @Post('/generate-storyboard-job')
  generateStoryboardJob(@GetOrgFromRequest() org: Organization, @Body() input: GenerateAiVideoDto) {
    return this.remotion.startStoryboard(org, input);
  }

  @Post('/regenerate-image')
  regenerateImage(@GetOrgFromRequest() _org: Organization, @Body() input: RegenerateImageDto) {
    return this.storyboard.regenerateImage(input);
  }

  @Post('/preview-voice')
  previewVoice(@GetOrgFromRequest() _org: Organization, @Body() input: PreviewVoiceDto) {
    return this.remotion.previewVoice(input);
  }

  @Post('/render')
  render(@GetOrgFromRequest() org: Organization, @Body() input: RenderVideoDto) {
    return this.remotion.startRender(org, input);
  }

  /** One-shot idea→video job; resumeJobId continues a failed job from its saved script and images. */
  @Post('/generate')
  generate(@GetOrgFromRequest() org: Organization, @Body() input: GenerateAiVideoDto) {
    return this.remotion.startFromTopic(org, input);
  }

  @Get('/status/:jobId')
  @Throttle({ default: { limit: 1800, ttl: 3_600_000 } })
  status(@GetOrgFromRequest() org: Organization, @Param('jobId') jobId: string) {
    return this.remotion.getStudioStatus(org.id, jobId);
  }

  @Delete('/:jobId')
  cancel(@GetOrgFromRequest() org: Organization, @Param('jobId') jobId: string) {
    return this.remotion.cancel(org.id, jobId);
  }
}
