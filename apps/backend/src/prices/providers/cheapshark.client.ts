import { byPrice, FeaturedDeal, fetchJson, PriceQuote } from './types';

const API_URL = 'https://www.cheapshark.com/api/1.0';
const REDIRECT_URL = 'https://www.cheapshark.com/redirect?dealID=';
// CheapShark asks every client to say who it is
const HEADERS = {
  'User-Agent':
    'GamesTrackerVault (+https://github.com/TTiagoSousa/GamesTracker-Vault)',
};
// Games per request in ?ids=
const BATCH = 25;
const STORES_TTL_MS = 24 * 60 * 60 * 1000;

interface CsDeal {
  storeID: string;
  dealID: string;
  price: string;
  retailPrice: string;
  savings: string;
}

interface CsGame {
  info: { title: string; steamAppID: string | null };
  cheapestPriceEver: { price: string; date: number } | null;
  deals: CsDeal[];
}

interface CsSearchResult {
  gameID: string;
  steamAppID: string | null;
  external: string;
}

interface CsListDeal {
  title: string;
  dealID: string;
  storeID: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  steamAppID: string | null;
  thumb: string | null;
}

const get = <T>(path: string, params: Record<string, string | number>) => {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  return fetchJson<T>(`${API_URL}${path}?${query.toString()}`, {
    headers: HEADERS,
  });
};

let stores: { names: Map<string, string>; at: number } | null = null;

async function storeNames(): Promise<Map<string, string>> {
  if (stores && Date.now() - stores.at < STORES_TTL_MS) return stores.names;
  const list = await fetchJson<{ storeID: string; storeName: string }[]>(
    `${API_URL}/stores`,
    { headers: HEADERS },
  );
  stores = {
    names: new Map(list.map((s) => [s.storeID, s.storeName])),
    at: Date.now(),
  };
  return stores.names;
}

const simple = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');

// Words that name an edition of the same game ("Grand Theft Auto V Enhanced",
// "Grand Theft Auto III - The Definitive Edition"). Shops often sell only a newer
// edition, under a longer name, once the original leaves the store.
const EDITION =
  /\s*[-:–]?\s*(the\s+)?((definitive|complete|enhanced|remastered|special|deluxe|standard|ultimate|gold|digital|anniversary|director'?s\s+cut|game\s+of\s+the\s+year|goty)\s*)+(edition)?\s*$/i;
// Bundles and add-ons that mention the game but are something else
const NOT_THE_GAME =
  /\b(bundle|pack|card|soundtrack|dlc|season\s+pass)\b|\s(and|\+)\s/i;

const baseName = (name: string) => simple(name.replace(EDITION, ''));

/** Searches for `query` and picks `name`: exact, or another edition of the same game. */
async function matchName(query: string, name: string): Promise<string | null> {
  const results = await get<CsSearchResult[]>('/games', {
    title: query,
    limit: 20,
  });
  const wanted = simple(name);
  const exact = results.find((r) => simple(r.external) === wanted);
  if (exact) return exact.gameID;
  // The same game under another edition's name, the one sold on Steam first
  const base = baseName(name);
  const editions = results.filter(
    (r) => !NOT_THE_GAME.test(r.external) && baseName(r.external) === base,
  );
  return (editions.find((r) => r.steamAppID) ?? editions[0])?.gameID ?? null;
}

/**
 * CheapShark: no key, PC shops only (Steam, GOG, Humble, Fanatical…), prices in US
 * dollars. The fallback when the installation has no IsThereAnyDeal key.
 */
export const cheapShark = {
  /**
   * CheapShark's id for a game: by its Steam appid when known, otherwise by its name,
   * exact or as another edition of the same game (a looser match could be another game).
   */
  async findId(
    name: string,
    steamAppId: number | null,
  ): Promise<string | null> {
    if (steamAppId) {
      const bySteam = await get<CsSearchResult[]>('/games', {
        steamAppID: steamAppId,
      });
      if (bySteam[0]) return bySteam[0].gameID;
    }
    const byName = await matchName(name, name);
    if (byName) return byName;
    // "Far Cry 5: Digital Gold Edition" finds nothing; "Far Cry 5" finds its editions
    const shorter = name.replace(EDITION, '').trim();
    return shorter && shorter !== name ? matchName(shorter, name) : null;
  },

  async prices(ids: string[]): Promise<Map<string, PriceQuote>> {
    const names = await storeNames();
    const quotes = new Map<string, PriceQuote>();
    for (let i = 0; i < ids.length; i += BATCH) {
      const games = await get<Record<string, CsGame>>('/games', {
        ids: ids.slice(i, i + BATCH).join(','),
      });
      for (const [id, game] of Object.entries(games)) {
        const deals = game.deals
          .map((deal) => ({
            shop: names.get(deal.storeID) ?? `#${deal.storeID}`,
            price: Number(deal.price),
            regular: Number(deal.retailPrice),
            cut: Math.round(Number(deal.savings)),
            url: REDIRECT_URL + deal.dealID,
            expiry: null,
          }))
          .sort(byPrice);
        const ever = game.cheapestPriceEver;
        quotes.set(id, {
          currency: 'USD',
          deals,
          lowest: ever
            ? {
                price: Number(ever.price),
                shop: null,
                at: new Date(ever.date * 1000).toISOString(),
              }
            : null,
        });
      }
    }
    return quotes;
  },

  async featured(limit: number): Promise<FeaturedDeal[]> {
    const names = await storeNames();
    const deals = await get<CsListDeal[]>('/deals', {
      pageSize: limit,
      onSale: 1,
      sortBy: 'Deal Rating',
    });
    return deals.map((deal) => ({
      title: deal.title,
      image: deal.thumb,
      steamAppId: deal.steamAppID ? Number(deal.steamAppID) : null,
      shop: names.get(deal.storeID) ?? `#${deal.storeID}`,
      price: Number(deal.salePrice),
      regular: Number(deal.normalPrice),
      cut: Math.round(Number(deal.savings)),
      currency: 'USD',
      url: REDIRECT_URL + deal.dealID,
      expiry: null,
      lowest: null,
    }));
  },
};
