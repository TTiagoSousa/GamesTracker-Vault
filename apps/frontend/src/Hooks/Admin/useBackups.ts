import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import i18n from '../../i18n';
import { apiMessage } from '../apiMessage';

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export interface BackupSettings {
  automatic: boolean;
  // "HH:MM", server time
  time: string;
  // 0 = forever
  keepDays: number;
  // null = the default folder
  directory: string | null;
}

export interface BackupsOverview {
  // false without pg_dump (development)
  available: boolean;
  tool: string | null;
  directory: string;
  defaultDirectory: string;
  settings: BackupSettings;
  nextAutomatic: string | null;
  running: boolean;
  lastRun: { at: string; ok: boolean | null; error: string | null; file: string | null } | null;
  totalSize: number;
  backups: BackupFile[];
}

/** The installation's backups (Admin → Backups). */
export const useBackups = () => {
  const [overview, setOverview] = useState<BackupsOverview | null>(null);
  // 'create' | 'settings' | a backup's name while deleting it
  const [busy, setBusy] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const load = useCallback(
    () => http.get<BackupsOverview>(End_Points.Backups_Endpoint()).then(({ data }) => data),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((error) => {
        if (!cancelled) setAlert({ open: true, message: apiMessage(error), type: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [load, setAlert]);

  // After an action: the list, the last run and the settings come back from the server
  const refresh = async () => {
    try {
      setOverview(await load());
    } catch {
      // the action's own alert already said what went wrong
    }
  };

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      setAlert({ open: true, message: i18n.t(success), type: 'success' });
      await refresh();
      return true;
    } catch (error) {
      setAlert({ open: true, message: apiMessage(error), type: 'error' });
      await refresh();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const createBackup = () =>
    run('create', () => http.post(End_Points.Backups_Endpoint(), undefined, { timeout: 15 * 60_000 }), 'admin:backups.created');

  const saveSettings = (settings: Partial<BackupSettings>) =>
    run('settings', () => http.put(End_Points.Backup_Settings_Endpoint(), settings), 'admin:backups.settingsSaved');

  const remove = (name: string) =>
    run(name, () => http.delete(End_Points.Backup_Endpoint(name)), 'admin:backups.deleted');

  return { overview, busy, createBackup, saveSettings, remove };
};
