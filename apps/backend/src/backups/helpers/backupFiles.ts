import { promises as fs } from 'fs';
import { join, resolve } from 'path';

/**
 * Backup file names: gametracker-YYYYMMDD-HHMMSS.sql.gz (the app) or
 * gametracker-YYYYMMDD-HHMM.sql.gz (backup.sh run by hand). Only files with this
 * shape are listed, served or deleted — nothing else in the folder is touched.
 */
export const BACKUP_FILE = /^gametracker-\d{8}-\d{4}(\d{2})?\.sql\.gz$/;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

/**
 * The default folder: BACKUP_DIR (the installer sets /var/backups/gametracker) or, in
 * development, backups/ at the repository root (git-ignored).
 */
export function defaultBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  const repo = process.env.APP_DIR ?? resolve(process.cwd(), '..', '..');
  return join(repo, 'backups');
}

/** The backups in the folder, newest first. A missing folder is an empty list. */
export async function listBackups(dir: string): Promise<BackupFile[]> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const files: BackupFile[] = [];
  for (const name of names) {
    if (!BACKUP_FILE.test(name)) continue;
    const stat = await fs.stat(join(dir, name)).catch(() => null);
    if (!stat?.isFile()) continue;
    files.push({
      name,
      size: stat.size,
      createdAt: stat.mtime.toISOString(),
    });
  }
  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The file a request points at: a backup's name, or "latest" for the newest one.
 * null when the name has another shape or the file doesn't exist.
 */
export async function findBackup(
  dir: string,
  name: string,
): Promise<BackupFile | null> {
  const files = await listBackups(dir);
  if (name === 'latest') return files[0] ?? null;
  if (!BACKUP_FILE.test(name)) return null;
  return files.find((file) => file.name === name) ?? null;
}

/** Deletes the backups older than keepDays (0 = keeps them all); returns their names. */
export async function pruneBackups(
  dir: string,
  keepDays: number,
  now = new Date(),
): Promise<string[]> {
  if (keepDays <= 0) return [];
  const limit = now.getTime() - keepDays * DAY_MS;
  const removed: string[] = [];
  for (const file of await listBackups(dir)) {
    if (new Date(file.createdAt).getTime() >= limit) continue;
    await fs.unlink(join(dir, file.name)).catch(() => undefined);
    removed.push(file.name);
  }
  return removed;
}
