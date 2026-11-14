export type PriceProvider = 'ITAD' | 'CHEAPSHARK';

export interface ShopPrice {
  shop: string;
  price: number;
  regular: number;
  cut: number;
  url: string;
  expiry: string | null;
}

export interface GamePrice {
  provider: PriceProvider;
  currency: string;
  // null = no covered shop sells it
  price: number | null;
  regular: number | null;
  cut: number | null;
  shop: string | null;
  url: string | null;
  lowest: number | null;
  isLowest: boolean;
  deals: ShopPrice[];
  checkedAt: string;
}

export interface PriceGame {
  id: number;
  name: string;
  coverUrl: string | null;
  releaseYear: number | null;
}

export interface WatchItem {
  game: PriceGame;
  // null = any sale
  targetPrice: number | null;
  // At the target now (or on sale, without a target)
  reached: boolean;
  price: GamePrice | null;
  createdAt: string;
}

export interface BacklogItem {
  game: PriceGame;
  watched: boolean;
  price: GamePrice | null;
  // false = not looked for at the shops yet
  searched: boolean;
}

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
  lowest: number | null;
}

export interface PriceStatus {
  enabled: boolean;
  provider: PriceProvider | null;
  country: string;
  currency: string;
  everyHours: number;
  lastCheckAt: string | null;
  lastError: string | null;
  nextCheckAt: string | null;
  checking: boolean;
}

export interface PriceAlert {
  id: number;
  kind: 'PRICE_DROP';
  gameId: number | null;
  read: boolean;
  createdAt: string;
  gameName: string;
  coverUrl: string | null;
  price: number;
  regular: number | null;
  cut: number | null;
  currency: string;
  shop: string | null;
  url: string | null;
  lowest: number | null;
  isLowest: boolean;
  targetPrice: number | null;
}
