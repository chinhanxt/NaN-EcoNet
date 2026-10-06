import { Module } from '@nestjs/common';
import { CommandModule as ExternalCommandModule } from 'nestjs-command';
import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';
import { RefreshTokens } from './tasks/refresh.tokens';
import { ConfigurationTask } from './tasks/configuration';
import { AgentRun } from './tasks/agent.run';
import { AgentModule } from '@gitroom/nestjs-libraries/agent/agent.module';
import { VideoModule } from '@gitroom/nestjs-libraries/videos/video.module';

@Module({
  imports: [ExternalCommandModule, DatabaseModule, AgentModule, VideoModule],
  controllers: [],
  providers: [RefreshTokens, ConfigurationTask, AgentRun],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class CommandModule {}
