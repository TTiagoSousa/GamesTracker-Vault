import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { PrismaBackupSettingsRepository } from './repositories/prisma/prisma-backup-settings-repository';

@Module({
  controllers: [BackupsController],
  providers: [BackupsService, PrismaBackupSettingsRepository],
})
export class BackupsModule {}
