import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { apiMessage } from '../apiMessage';
import type { PriceAlert } from './types';

// The badge in the menu: checked every few minutes and on every page change
const UNREAD_EVERY_MS = 3 * 60_000;
const UNREAD_EVENT = 'gametracker:unread';

/** How many alerts the user hasn't seen, for the badge on the Prices tab. */
export const useUnreadAlerts = () => {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      http
        .get<{ unread: number }>(End_Points.Notifications_Unread_Endpoint())
        .then(({ data }) => {
          if (!cancelled) setUnread(data.unread);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), UNREAD_EVERY_MS);
    // The Prices page marks them read: the badge follows at once
    const onChange = (event: Event) => setUnread((event as CustomEvent<number>).detail);
    window.addEventListener(UNREAD_EVENT, onChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(UNREAD_EVENT, onChange);
    };
  }, [pathname]);

  return unread;
};

const announce = (unread: number) => window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: unread }));

/** The alerts on the Prices page. Opening the page marks them as read. */
export const useNotifications = () => {
  const [items, setItems] = useState<PriceAlert[] | null>(null);
  const { setAlert } = useAlert();

  useEffect(() => {
    let cancelled = false;
    http
      .get<{ items: PriceAlert[]; unread: number }>(End_Points.Notifications_Endpoint(), { params: { limit: 20 } })
      .then(({ data }) => {
        if (cancelled) return;
        // Stay highlighted while the page is open
        setItems(data.items);
        if (data.unread > 0) {
          void http
            .post<{ unread: number }>(End_Points.Notifications_Read_Endpoint(), {})
            .then(({ data: read }) => announce(read.unread))
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clear = useCallback(async () => {
    try {
      await http.delete(End_Points.Notifications_Endpoint());
      setItems([]);
      announce(0);
    } catch (err) {
      setAlert({ open: true, message: apiMessage(err), type: 'error' });
    }
  }, [setAlert]);

  return { items, clear };
};
