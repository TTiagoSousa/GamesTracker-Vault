import { Module } from '@nestjs/common';
import { GamesModule } from 'src/games/games.module';
import { IntegrationsModule } from 'src/integrations/integrations.module';
import { LibraryModule } from 'src/library/library.module';
import { ApiTokensModule } from 'src/api-tokens/api-tokens.module';
import { NotificationsController, PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { NotificationsService } from './notifications.service';
import { PricesRepository } from './repositories/prices-repository';

@Module({
  imports: [GamesModule, IntegrationsModule, LibraryModule, ApiTokensModule],
  controllers: [PricesController, NotificationsController],
  providers: [PricesService, NotificationsService, PricesRepository],
})
export class PricesModule {}
