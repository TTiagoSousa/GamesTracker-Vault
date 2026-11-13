import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { isAbsolute, join, normalize } from 'path';

/**
 * Checks that the backup folder can be used: an absolute path, created if it doesn't
 * exist, where the backend can write. On the server the backend runs as the gametracker
 * user, so a folder of your own (a NAS share mounted at /mnt/…) must be writable by it.
 * Returns the normalised path.
 */
export async function prepareDirectory(directory: string): Promise<string> {
  const dir = normalize(directory.trim());
  if (!isAbsolute(dir)) {
    throw new BadRequestException(
      'A pasta tem de ser um caminho absoluto (por exemplo /mnt/backups/gametracker).',
    );
  }
  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o750 });
    const probe = join(dir, `.write-test-${process.pid}`);
    await fs.writeFile(probe, '');
    await fs.unlink(probe);
  } catch {
    throw new BadRequestException(
      `Não é possível escrever em ${dir}. Confirma que a pasta existe e que o utilizador gametracker tem permissão de escrita.`,
    );
  }
  return dir;
}
