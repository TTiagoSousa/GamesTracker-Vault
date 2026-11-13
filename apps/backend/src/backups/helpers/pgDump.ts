import { execFile, spawn } from 'child_process';
import { createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

/** pg_dump to use: PG_DUMP_PATH or the one on the PATH (the CT has PostgreSQL's). */
function pgDumpCommand(): string {
  return process.env.PG_DUMP_PATH || 'pg_dump';
}

/**
 * The connection for pg_dump, from DATABASE_URL, in the PG* variables — so the password
 * never shows up in the process list (as it would on the command line).
 */
export function pgEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl);
  const env: Record<string, string> = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

/** pg_dump's version ("pg_dump (PostgreSQL) 17.6"), or null when it isn't installed. */
export function pgDumpVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      pgDumpCommand(),
      ['--version'],
      { timeout: 10_000 },
      (error, stdout) => resolve(error ? null : stdout.trim() || null),
    );
  });
}

/**
 * Dumps the database, compressed, to `target`. Writes to a .tmp file and renames it at
 * the end, so a half-made backup never shows up in the list. Restores the same way as
 * backup.sh's: gunzip -c <file> | psql -d <database>.
 */
export async function dumpDatabase(target: string): Promise<void> {
  const tmp = `${target}.tmp`;
  const child = spawn(
    pgDumpCommand(),
    ['--clean', '--if-exists', '--no-password'],
    {
      env: { ...process.env, ...pgEnv(process.env.DATABASE_URL ?? '') },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  const exited = new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });

  try {
    await pipeline(
      child.stdout,
      createGzip(),
      createWriteStream(tmp, { mode: 0o600 }),
    );
    const code = await exited;
    if (code !== 0) {
      throw new Error(stderr.trim() || `pg_dump terminou com o código ${code}`);
    }
    await fs.rename(tmp, target);
  } catch (error) {
    child.kill();
    await fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
}
