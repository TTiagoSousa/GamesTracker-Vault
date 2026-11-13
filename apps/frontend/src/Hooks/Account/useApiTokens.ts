import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import i18n from '../../i18n';
import { apiMessage } from '../apiMessage';

export interface ApiToken {
  id: string;
  name: string;
  // "gtv_Ab12Cd" — the token itself is only returned once, when created
  prefix: string;
  readOnly: boolean;
  expiresAt: string | null;
  // Worked out by the server, so the list doesn't depend on the browser's clock
  expired: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface NewApiToken {
  name: string;
  readOnly: boolean;
  // null = never expires
  expiresInDays: number | null;
}

/** The signed-in user's API tokens (Settings → API). */
export const useApiTokens = () => {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [busy, setBusy] = useState<'create' | string | null>(null);
  const { setAlert } = useAlert();

  const fetchTokens = useCallback(
    () =>
      http
        .get<{ tokens: ApiToken[] }>(End_Points.Api_Tokens_Endpoint())
        .then(({ data }) => data.tokens),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetchTokens()
      .then((list) => {
        if (!cancelled) setTokens(list);
      })
      .catch((error) => {
        if (!cancelled) setAlert({ open: true, message: apiMessage(error), type: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchTokens, setAlert]);

  /** Returns the new token (shown once) or null when it failed. */
  const create = async (input: NewApiToken): Promise<string | null> => {
    setBusy('create');
    try {
      const { data } = await http.post<ApiToken & { token: string }>(End_Points.Api_Tokens_Endpoint(), {
        name: input.name.trim(),
        readOnly: input.readOnly,
        ...(input.expiresInDays ? { expiresInDays: input.expiresInDays } : {}),
      });
      setTokens(await fetchTokens());
      return data.token;
    } catch (error) {
      setAlert({ open: true, message: apiMessage(error), type: 'error' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await http.delete(End_Points.Api_Token_Endpoint(id));
      setTokens((current) => current?.filter((token) => token.id !== id) ?? null);
      setAlert({ open: true, message: i18n.t('settings:api.revoked'), type: 'success' });
    } catch (error) {
      setAlert({ open: true, message: apiMessage(error), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return { tokens, busy, create, revoke };
};
