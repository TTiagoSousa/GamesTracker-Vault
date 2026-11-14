import { IgdbClient } from '../igdb/igdb.client';

interface IgdbExternalGame {
  game: number;
  uid?: string;
  url?: string;
  // Steam is 1 in both: `category` is the old field, `external_game_source` the new one
  category?: number;
  external_game_source?: number;
}

const STEAM = 1;
const STEAM_URL = /store\.steampowered\.com\/app\/(\d+)/;

/**
 * The Steam appid of each game, from IGDB's links to other stores (external_games).
 * Games that aren't on Steam are left out of the map.
 */
export async function getSteamAppIds(
  ids: number[],
  igdb: IgdbClient,
): Promise<Map<number, number>> {
  const appIds = new Map<number, number>();
  if (!ids.length) return appIds;

  // 500 is IGDB's limit per request; a game has a handful of links at most
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const rows = await igdb.query<IgdbExternalGame[]>(
      'external_games',
      `fields game,uid,url,category,external_game_source; where game = (${chunk.join(',')}); limit 500;`,
    );
    for (const row of rows) {
      if (appIds.has(row.game)) continue;
      const fromUrl = row.url ? STEAM_URL.exec(row.url)?.[1] : undefined;
      const isSteam =
        row.external_game_source === STEAM || row.category === STEAM;
      const value = Number(fromUrl ?? (isSteam ? row.uid : undefined));
      if (Number.isInteger(value) && value > 0) appIds.set(row.game, value);
    }
  }
  return appIds;
}
