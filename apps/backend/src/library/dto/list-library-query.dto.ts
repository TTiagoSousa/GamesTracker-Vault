import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional } from 'class-validator';
import { LibraryStatus } from 'src/generated/prisma/client/client';

/** The four shelves on Home, by the statuses each one groups. */
export const SHELVES = {
  playing: [LibraryStatus.PLAYING, LibraryStatus.PAUSED],
  finished: [
    LibraryStatus.FINISHED_MAIN,
    LibraryStatus.FINISHED_EXTRAS,
    LibraryStatus.COMPLETED_100,
  ],
  planned: [LibraryStatus.PLAN_TO_PLAY],
  dropped: [LibraryStatus.DROPPED],
} as const;

export type Shelf = keyof typeof SHELVES;

/** GET /library?shelf=finished or ?status=FINISHED_MAIN,COMPLETED_100 — both optional. */
export class ListLibraryQueryDto {
  @IsOptional()
  @IsIn(Object.keys(SHELVES), {
    message: 'shelf tem de ser playing, finished, planned ou dropped.',
  })
  shelf?: Shelf;

  // Comma-separated
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsEnum(LibraryStatus, { each: true, message: 'Estado desconhecido.' })
  status?: LibraryStatus[];
}
