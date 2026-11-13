import { Module } from '@nestjs/common';
import { GamesModule } from 'src/games/games.module';
import { LibraryModule } from 'src/library/library.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiSettingsRepository } from './repositories/ai-settings-repository';
import { AiChatRepository } from './repositories/ai-chat-repository';
import { ChatRuns } from './helpers/chatRuns';

@Module({
  imports: [GamesModule, LibraryModule],
  controllers: [AiController],
  providers: [AiService, AiSettingsRepository, AiChatRepository, ChatRuns],
})
export class AiModule {}
