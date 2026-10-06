import { Global, Module } from '@nestjs/common';
import { LoadToolsService } from '@gitroom/nestjs-libraries/chat/load.tools.service';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { toolList } from '@gitroom/nestjs-libraries/chat/tools/tool.list';
import { AgyMcpModelFactory } from './agy.mcp.model';

@Global()
@Module({
  providers: [MastraService, LoadToolsService, AgyMcpModelFactory, ...toolList],
  get exports() {
    return this.providers;
  },
})
export class ChatModule {}
