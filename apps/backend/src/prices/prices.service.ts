import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Game,
  GamePrice,
  IntegrationProvider,
  NotificationKind,
  PriceProvider,
  PriceSettings,
} from 'src/generated/prisma/client/client';
import { GamesService } from 'src/games/games.service';
import { IntegrationCredentialsService } from 'src/integrations/integration-credentials.service';
import { PrismaLibraryRepository } from 'src/library/repositories/prisma/prisma-library-repository';
import { cheapShark } from './providers/cheapshark.client';
import { currencyOf, itad } from './providers/itad.client';
import { FeaturedDeal, PriceQuote, ShopPrice } from './providers/types';
import {
  PricesRepository,
  WatchWithGame,
} from './repositories/prices-repository';
import { UpdatePriceSettingsDto } from './dto/prices.dto';

// How often the timetable is checked
const TICK_MS = 5 * 60_000;
// A price seen on a game's page is fetched again after this
const PAGE_MAX_AGE_MS = 3 * 60 * 60_000;
// A game not found at a service is looked for again after this
const RETRY_IDS_MS = 7 * 24 * 60 * 60_000;
// Name lookups are one request each: at most this many per refresh
const NAME_LOOKUPS = 25;
const FEATURED_TTL_MS = 60 * 60_000;
const HISTORY_DAYS = 180;
// '' = looked for and not found (null = never looked)
const NOT_FOUND = '';

type Source =
  | { provider: typeof PriceProvider.ITAD; key: string }
  | { provider: typeof PriceProvider.CHEAPSHARK };

const cover = (imageId: string | null) =>
  imageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
    : null;

/** A game's price as the site and the app see it. */
function priceView(row: GamePrice | undefined) {
  if (!row) return null;
  return {
    provider: row.provider,
    currency: row.currency,
    price: row.price,
    regular: row.regular,
    cut: row.cut,
    shop: row.shop,
    url: row.url,
    lowest: row.lowest,
    // At (or below) the lowest price ever recorded
    isLowest:
      row.price !== null && row.lowest !== null && row.price <= row.lowest,
    deals: row.deals as unknown as ShopPrice[],
    checkedAt: row.checkedAt,
  };
}

const gameView = (game: Game) => ({
  id: game.igdbId,
  name: game.name,
  coverUrl: cover(game.coverImageId),
  releaseYear: game.releaseYear,
});

/** Whether a followed game's price deserves an alert. */
function alertWorthy(watch: { targetPrice: number | null }, row?: GamePrice) {
  if (!row || row.price === null) return false;
  return watch.targetPrice !== null
    ? row.price <= watch.targetPrice
    : (row.cut ?? 0) > 0;
}

/**
 * Game prices: from IsThereAnyDeal when the installation has a key, otherwise from
 * CheapShark. Prices are kept per game and country, refreshed when a page needs them
 * and, for followed games and the "to play" shelf, every few hours (Admin → Prices).
 * After every refresh the followed games are checked and, when one went on sale or
 * reached its target, its owner gets a notification (site and Android app).
 */
@Injectable()
export class PricesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prices');
  private timer: NodeJS.Timeout | null = null;
  private checking: Promise<void> | null = null;
  private featuredCache = new Map<
    string,
    { at: number; deals: FeaturedDeal[] }
  >();

  constructor(
    private readonly repository: PricesRepository,
    private readonly credentials: IntegrationCredentialsService,
    private readonly library: PrismaLibraryRepository,
    private readonly games: GamesService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // --- where prices come from -----------------------------------------------------------

  private async source(settings: PriceSettings): Promise<Source | null> {
    if (!settings.enabled) return null;
    try {
      const saved = await this.credentials.get(IntegrationProvider.ITAD);
      if (saved?.clientSecret) {
        return { provider: PriceProvider.ITAD, key: saved.clientSecret };
      }
    } catch {
      // Unreadable key (TOKEN_ENCRYPTION_KEY changed): CheapShark until it's entered again
    }
    return { provider: PriceProvider.CHEAPSHARK };
  }

  private async requireSource() {
    const settings = await this.repository.settings();
    const source = await this.source(settings);
    if (!source) {
      throw new ServiceUnavailableException(
        'Os preços estão desligados nesta instalação (Admin → Preços).',
      );
    }
    return { settings, source };
  }

  async status() {
    const settings = await this.repository.settings();
    const source = await this.source(settings);
    const next =
      source && settings.lastCheckAt
        ? new Date(
            settings.lastCheckAt.getTime() + settings.everyHours * 3_600_000,
          )
        : null;
    return {
      enabled: settings.enabled,
      provider: source?.provider ?? null,
      country: settings.country,
      currency:
        source?.provider === PriceProvider.CHEAPSHARK
          ? 'USD'
          : currencyOf(settings.country),
      everyHours: settings.everyHours,
      lastCheckAt: settings.lastCheckAt,
      lastError: settings.lastError,
      nextCheckAt: next,
      checking: Boolean(this.checking),
    };
  }

  async updateSettings(dto: UpdatePriceSettingsDto) {
    await this.repository.updateSettings({
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.everyHours !== undefined ? { everyHours: dto.everyHours } : {}),
    });
    this.featuredCache.clear();
    return this.status();
  }

  // --- finding each game at the service --------------------------------------------------

  /** The service's id of each game, looking up the ones never looked for. */
  private async ids(
    games: Game[],
    source: Source,
  ): Promise<Map<number, string>> {
    const field =
      source.provider === PriceProvider.ITAD ? 'itadId' : 'cheapSharkId';
    const now = Date.now();
    const pending = games.filter((game) => {
      const id = game[field];
      if (id === null) return true;
      return (
        id === NOT_FOUND &&
        (!game.priceIdsCheckedAt ||
          now - game.priceIdsCheckedAt.getTime() > RETRY_IDS_MS)
      );
    });

    if (pending.length) {
      // The Steam appid, from IGDB, finds most games exactly
      const withoutSteam = pending.filter(
        (g) => g.steamAppId === null && !g.priceIdsCheckedAt,
      );
      if (withoutSteam.length) {
        try {
          const appIds = await this.games.steamAppIds(
            withoutSteam.map((g) => g.igdbId),
          );
          for (const game of withoutSteam)
            game.steamAppId = appIds.get(game.igdbId) ?? null;
        } catch {
          // No IGDB: the names will do
        }
      }

      const found = new Map<number, string | null>();
      if (source.provider === PriceProvider.ITAD) {
        const steam = pending.filter((g) => g.steamAppId);
        if (steam.length) {
          const bySteam = await itad.idsBySteam(
            source.key,
            steam.map((g) => g.steamAppId!),
          );
          for (const game of steam)
            found.set(game.igdbId, bySteam.get(game.steamAppId!) ?? null);
        }
        let lookups = 0;
        for (const game of pending) {
          if (found.get(game.igdbId) || lookups >= NAME_LOOKUPS) continue;
          lookups++;
          found.set(
            game.igdbId,
            await itad.idByTitle(source.key, game.name).catch(() => null),
          );
        }
      } else {
        let lookups = 0;
        for (const game of pending) {
          if (lookups >= NAME_LOOKUPS) break;
          lookups++;
          found.set(
            game.igdbId,
            await cheapShark
              .findId(game.name, game.steamAppId)
              .catch(() => null),
          );
        }
      }

      const checkedAt = new Date();
      for (const game of pending) {
        if (!found.has(game.igdbId)) continue;
        const id = found.get(game.igdbId) ?? NOT_FOUND;
        game[field] = id;
        game.priceIdsCheckedAt = checkedAt;
        await this.repository.saveIds(game.igdbId, {
          steamAppId: game.steamAppId,
          [field]: id,
          priceIdsCheckedAt: checkedAt,
        });
      }
    }

    const ids = new Map<number, string>();
    for (const game of games) {
      const id = game[field];
      if (id) ids.set(game.igdbId, id);
    }
    return ids;
  }

  // --- refreshing -----------------------------------------------------------------------

  /**
   * The prices of these games, fetching again the ones older than maxAgeMs (or from
   * another service or country). Then checks the alerts of whoever follows them.
   */
  private async refresh(
    gameIds: number[],
    maxAgeMs: number,
    settings: PriceSettings,
    source: Source,
  ): Promise<Map<number, GamePrice>> {
    const unique = [...new Set(gameIds)];
    const country = settings.country;
    const rows = new Map(
      (await this.repository.prices(unique, country)).map((r) => [r.gameId, r]),
    );
    const now = Date.now();
    const stale = unique.filter((id) => {
      const row = rows.get(id);
      return (
        !row ||
        row.provider !== source.provider ||
        now - row.checkedAt.getTime() > maxAgeMs
      );
    });
    if (!stale.length) return rows;

    const games = await this.repository.games(stale);
    const ids = await this.ids(games, source);
    if (!ids.size) return rows;

    const serviceIds = [...ids.values()];
    const quotes: Map<string, PriceQuote> =
      source.provider === PriceProvider.ITAD
        ? await itad.prices(source.key, serviceIds, country)
        : await cheapShark.prices(serviceIds);

    const at = new Date();
    const changed: number[] = [];
    for (const [gameId, serviceId] of ids) {
      const quote = quotes.get(serviceId);
      if (!quote) continue;
      rows.set(
        gameId,
        await this.repository.savePrice(
          gameId,
          country,
          source.provider,
          quote,
          at,
        ),
      );
      changed.push(gameId);
    }
    if (changed.length) await this.checkAlerts(changed, rows);
    return rows;
  }

  /** Alerts for the followed games whose new price deserves one. */
  private async checkAlerts(gameIds: number[], rows: Map<number, GamePrice>) {
    const watches = await this.repository.watchesOf(gameIds);
    for (const watch of watches) {
      const row = rows.get(watch.gameId);
      if (!row) continue;
      if (!alertWorthy(watch, row)) {
        // The deal is over: the next one is announced again
        if (watch.notifiedPrice !== null)
          await this.repository.setNotified(watch.id, null);
        continue;
      }
      // Already announced at this price (or lower)
      if (
        watch.notifiedPrice !== null &&
        row.price! >= watch.notifiedPrice - 0.005
      )
        continue;

      await this.repository.notify(
        watch.userId,
        NotificationKind.PRICE_DROP,
        watch.gameId,
        {
          gameName: watch.game.name,
          coverUrl: cover(watch.game.coverImageId),
          price: row.price,
          regular: row.regular,
          cut: row.cut,
          currency: row.currency,
          shop: row.shop,
          url: row.url,
          lowest: row.lowest,
          isLowest: row.lowest !== null && row.price! <= row.lowest,
          targetPrice: watch.targetPrice,
        },
      );
      await this.repository.setNotified(watch.id, row.price);
    }
  }

  // --- the automatic check --------------------------------------------------------------

  private async tick() {
    if (this.checking) return;
    const settings = await this.repository.settings().catch(() => null);
    if (!settings?.enabled) return;
    const due =
      !settings.lastCheckAt ||
      Date.now() - settings.lastCheckAt.getTime() >=
        settings.everyHours * 3_600_000;
    if (due) await this.check().catch(() => undefined);
  }

  /** Followed games and every "to play" shelf, for everyone. */
  check(): Promise<void> {
    if (this.checking) return this.checking;
    this.checking = (async () => {
      const settings = await this.repository.settings();
      const source = await this.source(settings);
      if (!source) return;
      try {
        const ids = [
          ...(await this.repository.watchedGameIds()),
          ...(await this.repository.backlogGameIds()),
        ];
        // Half the interval: whatever was fetched by a page meanwhile isn't fetched again
        await this.refresh(
          ids,
          (settings.everyHours * 3_600_000) / 2,
          settings,
          source,
        );
        await this.repository.updateSettings({
          lastCheckAt: new Date(),
          lastError: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Price check failed: ${message}`);
        await this.repository.updateSettings({
          lastCheckAt: new Date(),
          lastError: message,
        });
        throw error;
      }
    })().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  async checkNow() {
    await this.check().catch(() => undefined);
    return this.status();
  }

  // --- what the pages ask for -----------------------------------------------------------

  /** Makes sure the game has its copy in the Game table (followed games may not be on the shelf). */
  private async ensureGame(gameId: number) {
    if (!(await this.library.findGame(gameId))) {
      await this.library.saveGame(await this.games.summary(gameId));
    }
  }

  async game(userId: string, gameId: number) {
    const { settings, source } = await this.requireSource();
    await this.ensureGame(gameId);
    const rows = await this.refresh(
      [gameId],
      PAGE_MAX_AGE_MS,
      settings,
      source,
    );
    const since = new Date(Date.now() - HISTORY_DAYS * 24 * 3_600_000);
    const [points, watch] = await Promise.all([
      this.repository.points(gameId, settings.country, since),
      this.repository.findWatch(userId, gameId),
    ]);
    const price = priceView(rows.get(gameId));
    return {
      price,
      history: points
        .filter((p) => !price || p.currency === price.currency)
        .map((p) => ({
          day: p.day.toISOString().slice(0, 10),
          price: p.price,
        })),
      watch: watch ? { targetPrice: watch.targetPrice } : null,
    };
  }

  private itemsOf(watches: WatchWithGame[], rows: Map<number, GamePrice>) {
    return watches.map((watch) => ({
      game: gameView(watch.game),
      targetPrice: watch.targetPrice,
      reached: alertWorthy(watch, rows.get(watch.gameId)),
      price: priceView(rows.get(watch.gameId)),
      createdAt: watch.createdAt,
    }));
  }

  async watchlist(userId: string) {
    const { settings, source } = await this.requireSource();
    const watches = await this.repository.watches(userId);
    const rows = await this.refresh(
      watches.map((w) => w.gameId),
      settings.everyHours * 3_600_000,
      settings,
      source,
    );
    return { items: this.itemsOf(watches, rows) };
  }

  /** Follows a game (or changes its target). A deal already on doesn't send an alert. */
  async watch(userId: string, gameId: number, targetPrice: number | null) {
    const { settings, source } = await this.requireSource();
    await this.ensureGame(gameId);
    const rows = await this.refresh(
      [gameId],
      PAGE_MAX_AGE_MS,
      settings,
      source,
    );
    const row = rows.get(gameId);
    const watch = await this.repository.saveWatch(
      userId,
      gameId,
      targetPrice,
      alertWorthy({ targetPrice }, row) ? row!.price : null,
    );
    return { item: this.itemsOf([watch], rows)[0] };
  }

  async unwatch(userId: string, gameId: number) {
    if (!(await this.repository.removeWatch(userId, gameId))) {
      throw new NotFoundException('Não estás a seguir o preço deste jogo.');
    }
    return { message: 'Deixaste de seguir o preço' };
  }

  async backlog(userId: string) {
    const { settings, source } = await this.requireSource();
    const [games, watches] = await Promise.all([
      this.repository.backlog(userId),
      this.repository.watches(userId),
    ]);
    const watched = new Set(watches.map((w) => w.gameId));
    const rows = await this.refresh(
      games.map((g) => g.igdbId),
      settings.everyHours * 3_600_000,
      settings,
      source,
    );
    return {
      items: games.map((game) => ({
        game: gameView(game),
        watched: watched.has(game.igdbId),
        price: priceView(rows.get(game.igdbId)),
        // Not found at the service (yet): looked for in the next refreshes
        searched:
          (source.provider === PriceProvider.ITAD
            ? game.itadId
            : game.cheapSharkId) !== null,
      })),
    };
  }

  async featured() {
    const { settings, source } = await this.requireSource();
    const cacheKey = `${source.provider}:${settings.country}`;
    const cached = this.featuredCache.get(cacheKey);
    if (cached && Date.now() - cached.at < FEATURED_TTL_MS)
      return { deals: cached.deals };
    const list =
      source.provider === PriceProvider.ITAD
        ? await itad.featured(source.key, settings.country, 40)
        : await cheapShark.featured(40);
    // The same game in several shops: only the cheapest
    const best = new Map<string, FeaturedDeal>();
    for (const deal of list) {
      const key = deal.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const seen = best.get(key);
      if (!seen || deal.price < seen.price) best.set(key, deal);
    }
    const deals = [...best.values()].slice(0, 24);
    this.featuredCache.set(cacheKey, { at: Date.now(), deals });
    return { deals };
  }
}
