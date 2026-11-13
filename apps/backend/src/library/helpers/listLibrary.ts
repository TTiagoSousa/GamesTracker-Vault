import { LibraryStatus } from 'src/generated/prisma/client/client';
import { PrismaLibraryRepository } from '../repositories/prisma/prisma-library-repository';
import { ListLibraryQueryDto, SHELVES } from '../dto/list-library-query.dto';
import { mapEntry } from './mapEntry';

/**
 * A user's shelf (newest first) and how many games there are in each status — Home uses
 * both. `shelf` and `status` narrow `items` (both together: the games in both);
 * `counts` and `total` always describe the whole shelf.
 */
export async function listLibrary(
  userId: string,
  repository: PrismaLibraryRepository,
  query: ListLibraryQueryDto = {},
) {
  const entries = await repository.listEntries(userId);
  const counts = Object.fromEntries(
    Object.values(LibraryStatus).map((status) => [status, 0]),
  ) as Record<LibraryStatus, number>;
  for (const entry of entries) counts[entry.status] += 1;

  const shelf: readonly LibraryStatus[] | null = query.shelf
    ? SHELVES[query.shelf]
    : null;
  const status = query.status?.length ? query.status : null;
  const items = entries.filter(
    (entry) =>
      (!shelf || shelf.includes(entry.status)) &&
      (!status || status.includes(entry.status)),
  );

  return { items: items.map(mapEntry), counts, total: entries.length };
}
