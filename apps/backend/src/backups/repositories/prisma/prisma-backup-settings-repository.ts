import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BackupSettings } from 'src/generated/prisma/client/client';
import {
  BackupSettingsChanges,
  BackupSettingsRepository,
} from '../backup-settings-repository';

// A single row (id 1), created with the schema's defaults the first time it is read
const ID = 1;

@Injectable()
export class PrismaBackupSettingsRepository implements BackupSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get(): Promise<BackupSettings> {
    return this.prisma.backupSettings.upsert({
      where: { id: ID },
      create: { id: ID },
      update: {},
    });
  }

  update(data: BackupSettingsChanges): Promise<BackupSettings> {
    return this.prisma.backupSettings.upsert({
      where: { id: ID },
      create: { id: ID, ...data },
      update: data,
    });
  }
}
