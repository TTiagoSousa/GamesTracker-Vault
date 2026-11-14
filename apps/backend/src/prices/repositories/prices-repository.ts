import { Injectable } from '@nestjs/common';
import {
  Game,
  GamePrice,
  LibraryStatus,
  NotificationKind,
  Notification,
  PricePoint,
  PriceProvider,
  PriceSettings,
  PriceWatch,
  Prisma,
} from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PriceQuote } from '../providers/types';

export type WatchWithGame = PriceWatch & { game: Game };

export interface PriceIds {
  steamAppId?: number | null;
  itadId?: string | null;
  cheapSharkId?: string | null;
  priceIdsCheckedAt: Date;
}

export type PriceSettingsChanges = Partial<
  Pick<
    PriceSettings,
    'enabled' | 'country' | 'everyHours' | 'lastCheckAt' | 'lastError'
  >
>;

/** Prices, followed games and the alerts they produce. */
@Injectable()
export class PricesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- settings -------------------------------------------------------------------------

  settings(): Promise<PriceSettings> {
    return this.prisma.priceSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  updateSettings(changes: PriceSettingsChanges): Promise<PriceSettings> {
    return this.prisma.priceSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...changes },
      update: changes,
    });
  }

  // --- games and prices -----------------------------------------------------------------

  games(ids: number[]): Promise<Game[]> {
    return this.prisma.game.findMany({ where: { igdbId: { in: ids } } });
  }

  async saveIds(igdbId: number, ids: PriceIds): Promise<void> {
    await this.prisma.game.update({ where: { igdbId }, data: ids });
  }

  prices(gameIds: number[], country: string): Promise<GamePrice[]> {
    return this.prisma.gamePrice.findMany({
      where: { gameId: { in: gameIds }, country },
    });
  }

  /** Stores the latest prices and the day's best price for the chart. */
  async savePrice(
    gameId: number,
    country: string,
    provider: PriceProvider,
    quote: PriceQuote,
    at: Date,
  ): Promise<GamePrice> {
    const best = quote.deals[0] ?? null;
    const data = {
      provider,
      currency: quote.currency,
      price: best?.price ?? null,
      regular: best?.regular ?? null,
      cut: best?.cut ?? null,
      shop: best?.shop ?? null,
      url: best?.url ?? null,
      lowest: quote.lowest?.price ?? null,
      lowestShop: quote.lowest?.shop ?? null,
      lowestAt: quote.lowest?.at ? new Date(quote.lowest.at) : null,
      deals: quote.deals as unknown as Prisma.InputJsonValue,
      checkedAt: at,
    };
    const [saved] = await this.prisma.$transaction([
      this.prisma.gamePrice.upsert({
        where: { gameId_country: { gameId, country } },
        create: { gameId, country, ...data },
        update: data,
      }),
      ...(best
        ? [
            this.prisma.pricePoint.upsert({
              where: {
                gameId_country_day: {
                  gameId,
                  country,
                  day: new Date(`${at.toISOString().slice(0, 10)}T00:00:00Z`),
                },
              },
              create: {
                gameId,
                country,
                day: new Date(`${at.toISOString().slice(0, 10)}T00:00:00Z`),
                price: best.price,
                currency: quote.currency,
              },
              update: { price: best.price, currency: quote.currency },
            }),
          ]
        : []),
    ]);
    return saved;
  }

  points(gameId: number, country: string, since: Date): Promise<PricePoint[]> {
    return this.prisma.pricePoint.findMany({
      where: { gameId, country, day: { gte: since } },
      orderBy: { day: 'asc' },
    });
  }

  // --- followed games -------------------------------------------------------------------

  watches(userId: string): Promise<WatchWithGame[]> {
    return this.prisma.priceWatch.findMany({
      where: { userId },
      include: { game: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findWatch(userId: string, gameId: number): Promise<PriceWatch | null> {
    return this.prisma.priceWatch.findUnique({
      where: { userId_gameId: { userId, gameId } },
    });
  }

  /** Every followed game of every user (for the automatic check). */
  watchesOf(gameIds: number[]): Promise<WatchWithGame[]> {
    return this.prisma.priceWatch.findMany({
      where: { gameId: { in: gameIds } },
      include: { game: true },
    });
  }

  async watchedGameIds(): Promise<number[]> {
    const rows = await this.prisma.priceWatch.findMany({
      distinct: ['gameId'],
      select: { gameId: true },
    });
    return rows.map((r) => r.gameId);
  }

  saveWatch(
    userId: string,
    gameId: number,
    targetPrice: number | null,
    notifiedPrice: number | null,
  ): Promise<WatchWithGame> {
    return this.prisma.priceWatch.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, targetPrice, notifiedPrice },
      update: { targetPrice, notifiedPrice },
      include: { game: true },
    });
  }

  async setNotified(id: string, notifiedPrice: number | null): Promise<void> {
    await this.prisma.priceWatch.update({
      where: { id },
      data: { notifiedPrice },
    });
  }

  async removeWatch(userId: string, gameId: number): Promise<boolean> {
    const { count } = await this.prisma.priceWatch.deleteMany({
      where: { userId, gameId },
    });
    return count > 0;
  }

  // --- the "to play" shelf --------------------------------------------------------------

  backlog(userId: string): Promise<Game[]> {
    return this.prisma.libraryEntry
      .findMany({
        where: { userId, status: LibraryStatus.PLAN_TO_PLAY },
        include: { game: true },
        orderBy: { updatedAt: 'desc' },
      })
      .then((entries) => entries.map((e) => e.game));
  }

  async backlogGameIds(): Promise<number[]> {
    const rows = await this.prisma.libraryEntry.findMany({
      where: { status: LibraryStatus.PLAN_TO_PLAY },
      distinct: ['gameId'],
      select: { gameId: true },
    });
    return rows.map((r) => r.gameId);
  }

  // --- notifications --------------------------------------------------------------------

  async notify(
    userId: string,
    kind: NotificationKind,
    gameId: number | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        kind,
        gameId,
        data: data as Prisma.InputJsonValue,
      },
    });
  }

  notifications(
    userId: string,
    after: number,
    take: number,
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, id: { gt: after } },
      orderBy: { id: 'desc' },
      take,
    });
  }

  unread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async latestId(userId: string): Promise<number> {
    const last = await this.prisma.notification.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return last?.id ?? 0;
  }

  async markRead(userId: string, ids?: number[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
  }

  async clearNotifications(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { userId } });
  }
}
