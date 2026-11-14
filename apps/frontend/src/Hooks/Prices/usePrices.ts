import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { apiMessage } from '../apiMessage';
import i18n from '../../i18n';
import type { BacklogItem, FeaturedDeal, GamePrice, PriceStatus, WatchItem } from './types';

/** Follow or stop following a game's price (shared by the Prices page and the game page). */
export const useWatchActions = () => {
  const { setAlert } = useAlert();

  const watch = useCallback(
    async (gameId: number, targetPrice: number | null): Promise<WatchItem | null> => {
      try {
        const { data } = await http.put<{ item: WatchItem }>(End_Points.Prices_Watch_Endpoint(gameId), { targetPrice });
        return data.item;
      } catch (err) {
        setAlert({ open: true, message: apiMessage(err), type: 'error' });
        return null;
      }
    },
    [setAlert],
  );

  const unwatch = useCallback(
    async (gameId: number) => {
      try {
        await http.delete(End_Points.Prices_Watch_Endpoint(gameId));
        return true;
      } catch (err) {
        setAlert({ open: true, message: apiMessage(err), type: 'error' });
        return false;
      }
    },
    [setAlert],
  );

  return { watch, unwatch };
};

type Load<T> = { data: T | null; error: string | null; loading: boolean };

const useGet = <T,>(url: string | null) => {
  const [state, setState] = useState<Load<T> & { url: string | null }>({ data: null, error: null, loading: true, url });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    http
      .get<T>(url)
      .then(({ data }) => {
        if (!cancelled) setState({ data, error: null, loading: false, url });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, error: apiMessage(err), loading: false, url });
      });
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const stale = state.url !== url;
  return {
    data: stale ? null : state.data,
    error: stale ? null : state.error,
    loading: stale || state.loading,
    reload: () => setAttempt((n) => n + 1),
    set: (data: T) => setState({ data, error: null, loading: false, url }),
  };
};

/** Where prices come from in this installation. */
export const usePriceStatus = () => useGet<PriceStatus>(End_Points.Prices_Status_Endpoint());

/** Everything on the Prices page: followed games, the "to play" shelf and featured deals. */
export const usePricesPage = (enabled: boolean) => {
  const watchlist = useGet<{ items: WatchItem[] }>(enabled ? End_Points.Prices_Watchlist_Endpoint() : null);
  const backlog = useGet<{ items: BacklogItem[] }>(enabled ? End_Points.Prices_Backlog_Endpoint() : null);
  const featured = useGet<{ deals: FeaturedDeal[] }>(enabled ? End_Points.Prices_Featured_Endpoint() : null);
  const { watch, unwatch } = useWatchActions();
  const { setAlert } = useAlert();

  const follow = async (gameId: number, targetPrice: number | null) => {
    const item = await watch(gameId, targetPrice);
    if (!item) return false;
    const items = watchlist.data?.items ?? [];
    const exists = items.some((i) => i.game.id === gameId);
    watchlist.set({ items: exists ? items.map((i) => (i.game.id === gameId ? item : i)) : [item, ...items] });
    if (backlog.data) {
      backlog.set({ items: backlog.data.items.map((i) => (i.game.id === gameId ? { ...i, watched: true } : i)) });
    }
    if (!exists) setAlert({ open: true, message: i18n.t('prices:followed', { name: item.game.name }), type: 'success' });
    return true;
  };

  const unfollow = async (gameId: number) => {
    if (!(await unwatch(gameId))) return;
    if (watchlist.data) watchlist.set({ items: watchlist.data.items.filter((i) => i.game.id !== gameId) });
    if (backlog.data) {
      backlog.set({ items: backlog.data.items.map((i) => (i.game.id === gameId ? { ...i, watched: false } : i)) });
    }
  };

  return { watchlist, backlog, featured, follow, unfollow };
};

export interface GamePrices {
  price: GamePrice | null;
  history: { day: string; price: number }[];
  watch: { targetPrice: number | null } | null;
}

/** A game's prices, its history and whether the user follows it (game page). */
export const useGamePrices = (gameId: number, enabled: boolean) => {
  const result = useGet<GamePrices>(enabled ? End_Points.Prices_Game_Endpoint(gameId) : null);
  const { watch, unwatch } = useWatchActions();
  const { setAlert } = useAlert();
  const [busy, setBusy] = useState(false);

  const follow = async (targetPrice: number | null) => {
    if (!result.data) return false;
    setBusy(true);
    const item = await watch(gameId, targetPrice);
    setBusy(false);
    if (!item) return false;
    const wasFollowing = Boolean(result.data.watch);
    result.set({ ...result.data, price: item.price ?? result.data.price, watch: { targetPrice: item.targetPrice } });
    setAlert({
      open: true,
      message: i18n.t(wasFollowing ? 'prices:alertSaved' : 'prices:followed', { name: item.game.name }),
      type: 'success',
    });
    return true;
  };

  const unfollow = async () => {
    if (!result.data) return;
    setBusy(true);
    const ok = await unwatch(gameId);
    setBusy(false);
    if (ok) result.set({ ...result.data, watch: null });
  };

  return { ...result, busy, follow, unfollow };
};
