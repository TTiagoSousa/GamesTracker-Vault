import { useCallback, useEffect, useRef, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { BASE_URL } from '../../config/urls';
import { androidBridge, type AndroidAlertsStatus } from '../../Service/androidApp';
import { useAlert } from '../../Contexts/Alert_Context';
import { apiMessage } from '../apiMessage';
import i18n from '../../i18n';

const readStatus = (): AndroidAlertsStatus | null => {
  const bridge = androidBridge();
  if (!bridge?.alertsStatus) return null;
  try {
    return JSON.parse(bridge.alertsStatus()) as AndroidAlertsStatus;
  } catch {
    return null;
  }
};

// The API's full address for the app, which calls it outside the page ("/api" → https://host/api)
const apiUrl = () => new URL(BASE_URL || '/', window.location.href).href.replace(/\/+$/, '');

/**
 * Price alerts as notifications on this phone (Android app only). Turning them on
 * creates a read-only token that only the app keeps; turning them off revokes it.
 *
 * - mode "browser": not in the app (show where to get it)
 * - mode "old-app": an app without alerts (needs updating)
 * - mode "app": can be turned on and off
 */
export const usePhoneAlerts = () => {
  const bridge = androidBridge();
  const mode = !bridge ? 'browser' : bridge.enableAlerts ? 'app' : 'old-app';
  const [status, setStatus] = useState<AndroidAlertsStatus | null>(readStatus);
  const [busy, setBusy] = useState(false);
  // Whether the app has answered since alerts were turned on
  const answered = useRef(true);
  const { setAlert } = useAlert();

  // The app answers after the permission prompt
  useEffect(() => {
    if (mode !== 'app') return;
    window.onAlertsChanged = (json: string) => {
      try {
        answered.current = true;
        const next = JSON.parse(json) as AndroidAlertsStatus;
        setStatus(next);
        setBusy(false);
        if (next.enabled && !next.allowed) {
          setAlert({ open: true, message: i18n.t('prices:phone.blocked'), type: 'warning' });
        }
      } catch {
        setBusy(false);
      }
    };
    return () => {
      window.onAlertsChanged = undefined;
    };
  }, [mode, setAlert]);

  const enable = useCallback(async () => {
    const app = androidBridge();
    if (!app?.enableAlerts) return;
    setBusy(true);
    try {
      const { data } = await http.post<{ token: string; tokenId: string; latestId: number }>(
        End_Points.Notifications_Devices_Endpoint(),
      );
      // The app answers through window.onAlertsChanged (at once, or after the permission
      // prompt). Only if that never comes, read the state by hand.
      answered.current = false;
      app.enableAlerts(apiUrl(), data.token, data.tokenId, data.latestId);
      setTimeout(() => {
        if (answered.current) return;
        setStatus(readStatus());
        setBusy(false);
      }, 60_000);
    } catch (err) {
      setBusy(false);
      setAlert({ open: true, message: apiMessage(err), type: 'error' });
    }
  }, [setAlert]);

  const disable = useCallback(async () => {
    const app = androidBridge();
    if (!app?.disableAlerts) return;
    setBusy(true);
    const tokenId = readStatus()?.tokenId;
    app.disableAlerts();
    // The token is useless without the app: revoke it (gone already is fine)
    if (tokenId) await http.delete(End_Points.Api_Token_Endpoint(tokenId)).catch(() => undefined);
    setStatus(readStatus());
    setBusy(false);
  }, []);

  const openSettings = () => androidBridge()?.openNotificationSettings?.();

  return { mode, status, busy, enable, disable, openSettings };
};
