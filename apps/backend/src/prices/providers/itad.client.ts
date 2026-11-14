import {
  byPrice,
  FeaturedDeal,
  fetchJson,
  PriceQuote,
  PriceServiceError,
  ShopPrice,
} from './types';

const API_URL = 'https://api.isthereanydeal.com';
// Steam's id at IsThereAnyDeal, whose games are "app/<appid>"
const STEAM_SHOP = 61;
// Games per request in the batch endpoints
const BATCH = 200;

interface ItadPrice {
  amount: number;
  currency: string;
}

interface ItadDeal {
  shop: { id: number; name: string };
  price: ItadPrice;
  regular: ItadPrice;
  cut: number;
  url: string;
  expiry: string | null;
}

interface ItadGamePrices {
  id: string;
  historyLow: { all: ItadPrice | null } | null;
  deals: ItadDeal[];
}

interface ItadListDeal extends ItadDeal {
  historyLow: ItadPrice | null;
}

interface ItadDealsPage {
  list: {
    id: string;
    title: string;
    assets?: { banner300?: string; boxart?: string };
    deal: ItadListDeal;
  }[];
}

const url = (path: string, params: Record<string, string | number>) => {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  return `${API_URL}${path}?${query.toString()}`;
};

const post = <T>(address: string, body: unknown) =>
  fetchJson<T>(address, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const shopPrice = (deal: ItadDeal): ShopPrice => ({
  shop: deal.shop.name,
  price: deal.price.amount,
  regular: deal.regular.amount,
  cut: deal.cut,
  url: deal.url,
  expiry: deal.expiry,
});

/**
 * IsThereAnyDeal (API v2): dozens of shops, prices in the country's currency and the
 * lowest price ever. Every call takes the installation's API key.
 */
export const itad = {
  /** Whether the key is accepted: a lookup of Half-Life (Steam 220). */
  async testKey(key: string): Promise<'ok' | 'rejected' | 'unreachable'> {
    try {
      await fetchJson(url('/games/lookup/v1', { key, appid: 220 }));
      return 'ok';
    } catch (error) {
      if (error instanceof PriceServiceError && error.status) {
        return error.status === 401 || error.status === 403
          ? 'rejected'
          : 'unreachable';
      }
      return 'unreachable';
    }
  },

  /** IsThereAnyDeal's id of each Steam game (null when it doesn't know it). */
  async idsBySteam(
    key: string,
    appIds: number[],
  ): Promise<Map<number, string | null>> {
    const found = new Map<number, string | null>();
    for (let i = 0; i < appIds.length; i += BATCH) {
      const chunk = appIds.slice(i, i + BATCH);
      const result = await post<Record<string, string | null>>(
        url(`/lookup/id/shop/${STEAM_SHOP}/v1`, { key }),
        chunk.map((id) => `app/${id}`),
      );
      for (const id of chunk) found.set(id, result[`app/${id}`] ?? null);
    }
    return found;
  },

  /** The id of a game by its name (IsThereAnyDeal's own matching). */
  async idByTitle(key: string, title: string): Promise<string | null> {
    const result = await fetchJson<{ found: boolean; game?: { id: string } }>(
      url('/games/lookup/v1', { key, title }),
    );
    return result.found && result.game ? result.game.id : null;
  },

  /** Current prices in every shop and the lowest ever, per id. */
  async prices(
    key: string,
    ids: string[],
    country: string,
  ): Promise<Map<string, PriceQuote>> {
    const quotes = new Map<string, PriceQuote>();
    for (let i = 0; i < ids.length; i += BATCH) {
      const games = await post<ItadGamePrices[]>(
        url('/games/prices/v3', { key, country }),
        ids.slice(i, i + BATCH),
      );
      for (const game of games) {
        const deals = game.deals.map(shopPrice).sort(byPrice);
        const low = game.historyLow?.all ?? null;
        quotes.set(game.id, {
          currency:
            game.deals[0]?.price.currency ??
            low?.currency ??
            currencyOf(country),
          deals,
          lowest: low ? { price: low.amount, shop: null, at: null } : null,
        });
      }
    }
    return quotes;
  },

  /** The deals IsThereAnyDeal features right now in the country. */
  async featured(
    key: string,
    country: string,
    limit: number,
  ): Promise<FeaturedDeal[]> {
    const page = await fetchJson<ItadDealsPage>(
      url('/deals/v2', { key, country, limit, mature: 'false' }),
    );
    return page.list.map((item) => ({
      title: item.title,
      image: item.assets?.banner300 ?? item.assets?.boxart ?? null,
      steamAppId: null,
      shop: item.deal.shop.name,
      price: item.deal.price.amount,
      regular: item.deal.regular.amount,
      cut: item.deal.cut,
      currency: item.deal.price.currency,
      url: item.deal.url,
      expiry: item.deal.expiry,
      lowest: item.deal.historyLow?.amount ?? null,
    }));
  },
};

// Only for a game no shop sells: the currency isn't in the answer then
const EURO = new Set(
  'PT ES FR DE IT NL BE AT IE FI GR LU SK SI EE LV LT MT CY HR'.split(' '),
);
const OTHER: Record<string, string> = Object.fromEntries(
  'US:USD GB:GBP BR:BRL CA:CAD AU:AUD CH:CHF PL:PLN SE:SEK NO:NOK DK:DKK MX:MXN JP:JPY'
    .split(' ')
    .map((pair) => pair.split(':') as [string, string]),
);
export const currencyOf = (country: string) =>
  EURO.has(country) ? 'EUR' : (OTHER[country] ?? 'USD');
