import { BackupSettings } from 'src/generated/prisma/client/client';

export type BackupSettingsChanges = Partial<
  Omit<BackupSettings, 'id' | 'updatedAt'>
>;

export interface BackupSettingsRepository {
  get(): Promise<BackupSettings>;
  update(data: BackupSettingsChanges): Promise<BackupSettings>;
}
