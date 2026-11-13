import { Module } from '@nestjs/common';
import { ApiTokensController } from './api-tokens.controller';
import { ApiTokensService } from './api-tokens.service';
import { PrismaApiTokenRepository } from './repositories/prisma/prisma-api-token-repository';

@Module({
  controllers: [ApiTokensController],
  providers: [ApiTokensService, PrismaApiTokenRepository],
  // ApiTokenStrategy (auth module) looks the tokens up through here
  exports: [PrismaApiTokenRepository],
})
export class ApiTokensModule {}
