import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { LibraryStatus } from 'src/generated/prisma/client/client';
import { GamesService } from 'src/games/games.service';
import { LibraryRepository } from 'src/library/repositories/library-repository';
import { PrismaLibraryRepository } from 'src/library/repositories/prisma/prisma-library-repository';
import { saveLibraryEntry } from 'src/library/helpers/saveLibraryEntry';
import { removeLibraryEntry } from 'src/library/helpers/removeLibraryEntry';
import { ToolDefinition } from '../anthropic/anthropic.client';

export const SHELF_TOOL_NAME = 'propose_shelf_change';

const STATUSES = Object.values(LibraryStatus);

/** The fields the assistant may change on an entry. */
export interface ShelfFields {
  status: LibraryStatus | null;
  rating: number | null;
  hoursPlayed: number | null;
  platform: string | null;
}

/**
 * A change to the shelf the assistant proposed. Nothing happens until the user
 * confirms it in the chat; then the server applies it as if it was made on the
 * game's page.
 */
export interface ShelfAction {
  id: string;
  kind: 'set' | 'remove';
  gameId: number;
  gameName: string;
  coverUrl: string | null;
  // Only the fields being changed (for "set")
  change: Partial<ShelfFields>;
  // The entry when it was proposed (null = not on the shelf)
  before: ShelfFields | null;
  state: 'pending' | 'done' | 'dismissed' | 'failed';
  error?: string;
}

export const SHELF_TOOL: ToolDefinition = {
  name: SHELF_TOOL_NAME,
  description:
    "Propose a change to the user's shelf: add a game, change its status, rating (1–10), hours played or platform, or remove it. The change is NOT made by this call: the user sees a card in the chat and confirms or dismisses it. Use one call per game, only when the user asked for the change or agreed to it. Get the IGDB id from the shelf or from search_games first.",
  input_schema: {
    type: 'object',
    properties: {
      igdbId: { type: 'integer', description: 'IGDB game id' },
      action: {
        type: 'string',
        enum: ['set', 'remove'],
        description:
          '"set" adds the game or changes the given fields; "remove" takes it off the shelf',
      },
      status: {
        type: 'string',
        enum: STATUSES,
        description:
          'PLAYING, PAUSED, PLAN_TO_PLAY (backlog), FINISHED_MAIN, FINISHED_EXTRAS, COMPLETED_100 or DROPPED. Required when adding a game that is not on the shelf.',
      },
      rating: {
        type: ['integer', 'null'],
        description: 'Personal rating 1–10, or null to clear it',
      },
      hoursPlayed: {
        type: ['number', 'null'],
        description: 'Total hours played, or null to clear them',
      },
      platform: {
        type: ['string', 'null'],
        description: 'Where it was played, e.g. "PS5" or "Steam Deck"',
      },
    },
    required: ['igdbId', 'action'],
  },
};

const cover = (imageId: string | null) =>
  imageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${imageId}.jpg`
    : null;

/** Reads what the model sent; returns the change or why it can't be used. */
function readChange(
  input: Record<string, unknown>,
): Partial<ShelfFields> | string {
  const change: Partial<ShelfFields> = {};
  if (input.status !== undefined && input.status !== null) {
    if (!STATUSES.includes(input.status as LibraryStatus)) {
      return `invalid status, use one of ${STATUSES.join(', ')}`;
    }
    change.status = input.status as LibraryStatus;
  }
  if (input.rating !== undefined) {
    const rating = input.rating === null ? null : Number(input.rating);
    if (
      rating !== null &&
      (!Number.isInteger(rating) || rating < 1 || rating > 10)
    ) {
      return 'rating must be an integer from 1 to 10, or null';
    }
    change.rating = rating;
  }
  if (input.hoursPlayed !== undefined) {
    const hours = input.hoursPlayed === null ? null : Number(input.hoursPlayed);
    if (
      hours !== null &&
      (!Number.isFinite(hours) || hours < 0 || hours > 100000)
    ) {
      return 'hoursPlayed must be a number from 0 to 100000, or null';
    }
    change.hoursPlayed = hours === null ? null : Math.round(hours * 100) / 100;
  }
  if (input.platform !== undefined) {
    const platform =
      typeof input.platform === 'string' ? input.platform.trim() : null;
    if (platform && platform.length > 60) {
      return 'platform has at most 60 characters';
    }
    change.platform = platform || null;
  }
  return change;
}

/**
 * The model asked for a change: checks it against the shelf and IGDB and turns it
 * into an action for the user to confirm. `result` is what the model reads back.
 */
export async function proposeShelfChange(
  userId: string,
  input: Record<string, unknown>,
  library: LibraryRepository,
  games: GamesService,
): Promise<{ action?: ShelfAction; result: string }> {
  const fail = (error: string) => ({ result: JSON.stringify({ error }) });

  const gameId = Number(input.igdbId);
  if (!Number.isInteger(gameId) || gameId <= 0) return fail('invalid igdbId');
  const kind = input.action === 'remove' ? 'remove' : 'set';
  if (input.action !== 'set' && input.action !== 'remove') {
    return fail('action must be "set" or "remove"');
  }

  const entry = await library.findEntry(userId, gameId);
  const before: ShelfFields | null = entry
    ? {
        status: entry.status,
        rating: entry.rating,
        hoursPlayed: entry.hoursPlayed,
        platform: entry.platform,
      }
    : null;

  let gameName: string;
  let coverImageId: string | null;
  if (entry) {
    gameName = entry.game.name;
    coverImageId = entry.game.coverImageId;
  } else {
    if (kind === 'remove') return fail('this game is not on the shelf');
    try {
      const summary = await games.summary(gameId);
      gameName = summary.name;
      coverImageId = summary.coverImageId;
    } catch {
      return fail('game not found on IGDB');
    }
  }

  let change: Partial<ShelfFields> = {};
  if (kind === 'set') {
    const read = readChange(input);
    if (typeof read === 'string') return fail(read);
    if (!entry && !read.status) {
      return fail('status is required to add a game that is not on the shelf');
    }
    // Only what really changes
    change = Object.fromEntries(
      Object.entries(read).filter(
        ([key, value]) => !before || before[key as keyof ShelfFields] !== value,
      ),
    );
    if (!Object.keys(change).length) {
      return fail('nothing would change: the shelf already has these values');
    }
  }

  const action: ShelfAction = {
    id: randomUUID(),
    kind,
    gameId,
    gameName,
    coverUrl: cover(coverImageId),
    change,
    before,
    state: 'pending',
  };
  return {
    action,
    result: JSON.stringify({
      proposed: true,
      game: gameName,
      note: 'A card with this change is shown to the user, who confirms or dismisses it. It has NOT been applied: do not say it is done; tell the user to confirm it in the card.',
    }),
  };
}

const day = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;

/**
 * The user confirmed: applies the change to the entry as it is now (other fields
 * stay as they are). Throws with the reason if it can't be done.
 */
export async function applyShelfAction(
  userId: string,
  action: ShelfAction,
  library: PrismaLibraryRepository,
  games: GamesService,
) {
  if (action.kind === 'remove') {
    await removeLibraryEntry(userId, action.gameId, library);
    return;
  }
  const entry = await library.findEntry(userId, action.gameId);
  const status = action.change.status ?? entry?.status;
  if (!status) throw new Error('O jogo já não está na estante.');
  const value = <K extends keyof ShelfFields>(key: K) =>
    key in action.change ? action.change[key] : entry ? entry[key] : null;
  await saveLibraryEntry(
    userId,
    action.gameId,
    {
      status,
      rating: value('rating'),
      hoursPlayed: value('hoursPlayed'),
      platform: value('platform'),
      startedAt: day(entry?.startedAt ?? null),
      finishedAt: day(entry?.finishedAt ?? null),
      notes: entry?.notes ?? null,
    },
    library,
    games,
  );
}

/** Why applying failed, in the words the user sees. */
export const applyError = (error: unknown) =>
  error instanceof HttpException
    ? String(
        (error.getResponse() as { message?: string }).message ?? error.message,
      )
    : error instanceof Error && error.message
      ? error.message
      : 'Não foi possível mudar a estante.';
