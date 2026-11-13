import { mkdtempSync, promises as fs, rmSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BACKUP_FILE,
  findBackup,
  listBackups,
  pruneBackups,
} from './backupFiles';

describe('backup files', () => {
  let dir: string;
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-11-11T12:00:00Z');

  const make = async (name: string, ageDays: number) => {
    const path = join(dir, name);
    await fs.writeFile(path, 'x');
    const time = new Date(now.getTime() - ageDays * day);
    utimesSync(path, time, time);
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'gtv-backups-'));
    await make('gametracker-20261111-110000.sql.gz', 0);
    await make('gametracker-20261101-0330.sql.gz', 10);
    await make('gametracker-20261020-033000.sql.gz', 22);
    await make('notes.txt', 30);
    await make('gametracker-20261020-033000.sql.gz.tmp', 30);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('only accepts backup file names', () => {
    expect(BACKUP_FILE.test('gametracker-20261111-110000.sql.gz')).toBe(true);
    expect(BACKUP_FILE.test('gametracker-20261111-1100.sql.gz')).toBe(true);
    expect(BACKUP_FILE.test('../etc/passwd')).toBe(false);
    expect(BACKUP_FILE.test('gametracker-x.sql.gz')).toBe(false);
  });

  it('lists only backups, newest first', async () => {
    const names = (await listBackups(dir)).map((file) => file.name);
    expect(names).toEqual([
      'gametracker-20261111-110000.sql.gz',
      'gametracker-20261101-0330.sql.gz',
      'gametracker-20261020-033000.sql.gz',
    ]);
  });

  it('treats a missing folder as empty', async () => {
    expect(await listBackups(join(dir, 'nope'))).toEqual([]);
  });

  it('finds a backup by name or "latest", and nothing else', async () => {
    expect((await findBackup(dir, 'latest'))?.name).toBe(
      'gametracker-20261111-110000.sql.gz',
    );
    expect(
      (await findBackup(dir, 'gametracker-20261101-0330.sql.gz'))?.size,
    ).toBe(1);
    expect(await findBackup(dir, 'notes.txt')).toBeNull();
    expect(
      await findBackup(dir, 'gametracker-20200101-0000.sql.gz'),
    ).toBeNull();
  });

  it('deletes only backups older than the days to keep', async () => {
    const removed = await pruneBackups(dir, 14, now);
    expect(removed).toEqual(['gametracker-20261020-033000.sql.gz']);
    const left = await fs.readdir(dir);
    expect(left).toContain('notes.txt');
    expect(left).toContain('gametracker-20261101-0330.sql.gz');
  });

  it('keeps everything with 0 days', async () => {
    expect(await pruneBackups(dir, 0, now)).toEqual([]);
  });
});
