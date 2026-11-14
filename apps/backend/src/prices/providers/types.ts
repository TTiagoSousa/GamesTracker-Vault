/** One shop's price for a game. */
export interface ShopPrice {
  shop: string;
  price: number;
  regular: number;
  // Discount, 0–100
  cut: number;
  url: string;
  // When the deal ends, if the shop says
  expiry: string | null;
}

/** A game's prices from a service: every shop (cheapest first) and the lowest ever. */
export interface PriceQuote {
  currency: string;
  deals: ShopPrice[];
  lowest: { price: number; shop: string | null; at: string | null } | null;
}

/** A deal from a service's own list (not necessarily a game on IGDB). */
export interface FeaturedDeal {
  title: string;
  image: string | null;
  steamAppId: number | null;
  shop: string;
  price: number;
  regular: number;
  cut: number;
  currency: string;
  url: string;
  expiry: string | null;
  // The lowest price ever, when the service says
  lowest: number | null;
}

/** Someone who can't be reached or refused: the reason is for the admin. */
export class PriceServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

/** fetch with a time limit; non-2xx answers become a PriceServiceError. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new PriceServiceError('unreachable');
  }
  if (!response.ok) {
    throw new PriceServiceError(`HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export const byPrice = (a: ShopPrice, b: ShopPrice) =>
  a.price - b.price || b.cut - a.cut;
