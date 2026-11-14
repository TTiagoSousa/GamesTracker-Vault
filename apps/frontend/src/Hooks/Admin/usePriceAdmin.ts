import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { apiMessage } from '../apiMessage';
import i18n from '../../i18n';
import type { PriceStatus } from '../Prices/types';

export interface ItadStatus {
  configured: boolean;
  unreadable: boolean;
  // The last 4 characters only
  keyHint: string | null;
  updatedAt: string | null;
}

type TestResult = { ok: true } | { ok: false; reason: 'not-configured' | 'unreadable' | 'rejected' | 'unreachable' };

export type PriceSettingsInput = Partial<Pick<PriceStatus, 'enabled' | 'country' | 'everyHours'>>;

/** Admin → Prices: the IsThereAnyDeal key and the installation's price settings. */
export const usePriceAdmin = () => {
  const [itad, setItad] = useState<ItadStatus | null>(null);
  const [status, setStatus] = useState<PriceStatus | null>(null);
  const [busy, setBusy] = useState<'key' | 'test' | 'remove' | 'settings' | 'check' | null>(null);
  const { setAlert } = useAlert();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<ItadStatus>(End_Points.Integration_Itad_Endpoint()),
      http.get<PriceStatus>(End_Points.Prices_Status_Endpoint()),
    ])
      .then(([key, prices]) => {
        if (cancelled) return;
        setItad(key.data);
        setStatus(prices.data);
      })
      .catch((err) => {
        if (!cancelled) setAlert({ open: true, message: apiMessage(err), type: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [setAlert]);

  const refreshStatus = async () => {
    const { data } = await http.get<PriceStatus>(End_Points.Prices_Status_Endpoint());
    setStatus(data);
  };

  const run = async <T,>(kind: NonNullable<typeof busy>, action: () => Promise<T>, success?: string) => {
    setBusy(kind);
    try {
      const result = await action();
      if (success) setAlert({ open: true, message: i18n.t(success), type: 'success' });
      return result;
    } catch (err) {
      setAlert({ open: true, message: apiMessage(err), type: 'error' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveKey = (key: string) =>
    run(
      'key',
      async () => {
        const { data } = await http.put<ItadStatus>(End_Points.Integration_Itad_Endpoint(), { key: key.trim() });
        setItad(data);
        await refreshStatus();
        return true;
      },
      'admin:prices.keySaved',
    );

  const testKey = () =>
    run('test', async () => {
      const { data } = await http.post<TestResult>(End_Points.Integration_Itad_Test_Endpoint());
      setAlert({
        open: true,
        message: data.ok ? i18n.t('admin:prices.testOk') : i18n.t(`admin:prices.testFail.${data.reason}`),
        type: data.ok ? 'success' : 'error',
      });
    });

  const removeKey = () =>
    run(
      'remove',
      async () => {
        const { data } = await http.delete<ItadStatus>(End_Points.Integration_Itad_Endpoint());
        setItad(data);
        await refreshStatus();
      },
      'admin:prices.keyRemoved',
    );

  const saveSettings = (settings: PriceSettingsInput) =>
    run(
      'settings',
      async () => {
        const { data } = await http.put<PriceStatus>(End_Points.Prices_Settings_Endpoint(), settings);
        setStatus(data);
        return true;
      },
      'admin:prices.settingsSaved',
    );

  const checkNow = () =>
    run('check', async () => {
      const { data } = await http.post<PriceStatus>(End_Points.Prices_Check_Endpoint());
      setStatus(data);
      setAlert({
        open: true,
        message: data.lastError ? data.lastError : i18n.t('admin:prices.checked'),
        type: data.lastError ? 'error' : 'success',
      });
    });

  return { itad, status, busy, saveKey, testKey, removeKey, saveSettings, checkNow };
};
