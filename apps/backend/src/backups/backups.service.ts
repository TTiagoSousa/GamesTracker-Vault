import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { BackupSettings } from 'src/generated/prisma/client/client';
import { PrismaBackupSettingsRepository } from './repositories/prisma/prisma-backup-settings-repository';
import { BackupSettingsChanges } from './repositories/backup-settings-repository';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';
import {
  defaultBackupDir,
  findBackup,
  listBackups,
  pruneBackups,
} from './helpers/backupFiles';
import { dumpDatabase, pgDumpVersion } from './helpers/pgDump';
import { prepareDirectory } from './helpers/prepareDirectory';
import { isBackupDue, localDate, nextBackupAt } from './helpers/schedule';

// How often the timetable is checked
const TICK_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** gametracker-YYYYMMDD-HHMMSS.sql.gz, in local time. */
function backupName(now: Date): string {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `gametracker-${day}-${time}.sql.gz`;
}

/**
 * Database backups: made by the backend itself with pg_dump, on demand (Admin or the API)
 * and every day at the configured time. They live in one folder (BACKUP_DIR or the one
 * chosen in Admin) and the old ones are deleted after each backup.
 */
@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Backups');
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<unknown> | null = null;
  // pg_dump's version, read once at startup; null = backups unavailable
  private tool: string | null = null;

  constructor(private readonly repository: PrismaBackupSettingsRepository) {}

  async onModuleInit() {
    this.tool = await pgDumpVersion();
    if (!this.tool) {
      this.logger.warn('pg_dump not found: backups are disabled.');
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    // Doesn't keep the process alive by itself (shutdown, tests)
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private directoryOf(settings: BackupSettings): string {
    return settings.directory || defaultBackupDir();
  }

  private settingsView(settings: BackupSettings) {
    return {
      automatic: settings.automatic,
      time: settings.time,
      keepDays: settings.keepDays,
      // null = the default folder
      directory: settings.directory,
    };
  }

  async overview() {
    const settings = await this.repository.get();
    const directory = this.directoryOf(settings);
    const backups = await listBackups(directory);
    return {
      available: Boolean(this.tool),
      tool: this.tool,
      directory,
      defaultDirectory: defaultBackupDir(),
      settings: this.settingsView(settings),
      nextAutomatic: this.tool
        ? (nextBackupAt(settings, new Date())?.toISOString() ?? null)
        : null,
      running: Boolean(this.running),
      lastRun: settings.lastRunAt
        ? {
            at: settings.lastRunAt,
            ok: settings.lastOk,
            error: settings.lastError,
            file: settings.lastFile,
          }
        : null,
      totalSize: backups.reduce((sum, file) => sum + file.size, 0),
      backups,
    };
  }

  async settings() {
    return this.settingsView(await this.repository.get());
  }

  async updateSettings(dto: UpdateBackupSettingsDto) {
    const changes: BackupSettingsChanges = {};
    if (dto.automatic !== undefined) changes.automatic = dto.automatic;
    if (dto.time !== undefined) changes.time = dto.time;
    if (dto.keepDays !== undefined) changes.keepDays = dto.keepDays;
    if (dto.directory !== undefined) {
      changes.directory = dto.directory?.trim()
        ? await prepareDirectory(dto.directory)
        : null;
    }
    // A new time: today's automatic backup can still run at it
    if (changes.time !== undefined) changes.lastAutoDate = null;
    return this.settingsView(await this.repository.update(changes));
  }

  /** A backup now. 409 while another is being made. */
  async create() {
    if (!this.tool) {
      throw new ServiceUnavailableException(
        'Os backups precisam do pg_dump (PostgreSQL) no servidor.',
      );
    }
    if (this.running) {
      throw new ConflictException('Já há um backup em curso.');
    }
    const job = this.run();
    this.running = job;
    try {
      return await job;
    } finally {
      this.running = null;
    }
  }

  private async run() {
    const settings = await this.repository.get();
    const now = new Date();
    const name = backupName(now);
    try {
      const directory = await prepareDirectory(this.directoryOf(settings));
      await dumpDatabase(join(directory, name));
      const removed = await pruneBackups(directory, settings.keepDays, now);
      await this.repository.update({
        lastRunAt: now,
        lastOk: true,
        lastError: null,
        lastFile: name,
      });
      const backup = await findBackup(directory, name);
      this.logger.log(
        `Backup ${name}${removed.length ? ` (${removed.length} old removed)` : ''}`,
      );
      return { backup, removed };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      await this.repository.update({
        lastRunAt: now,
        lastOk: false,
        lastError: message.slice(0, 1000),
        lastFile: null,
      });
      this.logger.error(`Backup failed: ${message}`);
      throw error;
    }
  }

  /** Checks the timetable; at most one automatic backup per day, even if it fails. */
  private async tick() {
    if (this.running) return;
    try {
      const settings = await this.repository.get();
      const now = new Date();
      if (!isBackupDue(settings, now)) return;
      await this.repository.update({ lastAutoDate: localDate(now) });
      await this.create();
    } catch {
      // already recorded in lastError by run(); the next try is tomorrow
    }
  }

  /** The file to download: a backup's name, or "latest". */
  async file(name: string) {
    const settings = await this.repository.get();
    const directory = this.directoryOf(settings);
    const backup = await findBackup(directory, name);
    if (!backup) throw new NotFoundException('Backup não encontrado.');
    return { ...backup, path: join(directory, backup.name) };
  }

  async remove(name: string) {
    const { path, name: file } = await this.file(name);
    await fs.unlink(path);
    return { message: 'Backup apagado', name: file };
  }
}
