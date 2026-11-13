import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackups, type BackupSettings, type BackupsOverview } from '../../Hooks/Admin/useBackups';
import { End_Points } from '../../Service/endPoints';
import { BASE_URL } from '../../config/urls';
import { dateLocale } from '../../i18n';
import './Backups_Card.scss';

const formatSize = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: unit ? 1 : 0 }).format(value)} ${units[unit]}`;
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * The settings form: automatic on/off, time, days to keep and folder. Starts from the
 * saved settings; the parent remounts it (key) after each save.
 */
const Backup_Settings_Form = ({
  overview,
  busy,
  onSave,
}: {
  overview: BackupsOverview;
  busy: boolean;
  onSave: (settings: Partial<BackupSettings>) => Promise<boolean>;
}) => {
  const { t } = useTranslation('admin');
  const saved = overview.settings;
  const [automatic, setAutomatic] = useState(saved.automatic);
  const [time, setTime] = useState(saved.time);
  const [keepDays, setKeepDays] = useState(String(saved.keepDays));
  const [directory, setDirectory] = useState(saved.directory ?? '');

  const keep = Number(keepDays);
  const validKeep = keepDays.trim() !== '' && Number.isInteger(keep) && keep >= 0 && keep <= 3650;
  const changed =
    automatic !== saved.automatic ||
    time !== saved.time ||
    keep !== saved.keepDays ||
    directory.trim() !== (saved.directory ?? '');
  const canSave = changed && validKeep && /^\d{2}:\d{2}$/.test(time) && !busy;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    void onSave({ automatic, time, keepDays: keep, directory: directory.trim() || null });
  };

  return (
    <form className='Backups_Card_Form' onSubmit={onSubmit}>
      <label className='Backups_Card_Check'>
        <input type='checkbox' checked={automatic} onChange={(e) => setAutomatic(e.target.checked)} />
        <span>{t('backups.automatic')}</span>
      </label>

      <label>
        <span>{t('backups.time')}</span>
        <input type='time' value={time} onChange={(e) => setTime(e.target.value)} disabled={!automatic} required />
      </label>

      <label>
        <span>{t('backups.keepDays')}</span>
        <input
          type='number'
          inputMode='numeric'
          min={0}
          max={3650}
          value={keepDays}
          onChange={(e) => setKeepDays(e.target.value)}
          aria-invalid={!validKeep}
        />
        <small>{t('backups.keepDaysHint')}</small>
      </label>

      <label className='wide'>
        <span>{t('backups.directory')}</span>
        <input
          type='text'
          autoComplete='off'
          spellCheck={false}
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
          placeholder={overview.defaultDirectory}
        />
        <small>{t('backups.directoryHint', { folder: overview.defaultDirectory })}</small>
      </label>

      <div className='Backups_Card_Actions'>
        <button type='submit' className='Backups_Card_Save' disabled={!canSave}>
          {busy ? t('backups.saving') : t('backups.save')}
        </button>
      </div>
    </form>
  );
};

/**
 * The installation's database backups, on the Admin page: back up now, the automatic
 * schedule and the list with download and delete. Also available through the API.
 */
const Backups_Card = () => {
  const { t } = useTranslation('admin');
  const { overview, busy, createBackup, saveSettings, remove } = useBackups();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Remounts the settings form after a save, so it starts from what was saved
  const [formKey, setFormKey] = useState(0);

  if (!overview) return null;

  const running = overview.running || busy === 'create';
  const last = overview.lastRun;

  const onSave = async (settings: Partial<BackupSettings>) => {
    const ok = await saveSettings(settings);
    if (ok) setFormKey((key) => key + 1);
    return ok;
  };

  return (
    <section className='Backups_Card'>
      <div className='Backups_Card_Head'>
        <div>
          <h2 className='Backups_Card_Title'>{t('backups.title')}</h2>
          <p className='Backups_Card_Description'>{t('backups.description')}</p>
        </div>
        <span className={`Backups_Card_Status${overview.available && overview.settings.automatic ? ' on' : ''}`}>
          {!overview.available
            ? t('backups.unavailable')
            : overview.settings.automatic
              ? t('backups.dailyAt', { time: overview.settings.time })
              : t('backups.off')}
        </span>
      </div>

      {!overview.available && <p className='Backups_Card_Warning'>{t('backups.noTool')}</p>}

      <div className='Backups_Card_Now'>
        <button
          type='button'
          className='Backups_Card_Save'
          disabled={!overview.available || running}
          onClick={() => void createBackup()}
        >
          {running ? t('backups.running') : t('backups.create')}
        </button>
        <p className='Backups_Card_Meta'>
          {last &&
            (last.ok
              ? t('backups.lastOk', { date: formatDateTime(last.at) })
              : t('backups.lastFailed', { date: formatDateTime(last.at) }))}
          {overview.nextAutomatic && (
            <span>{t('backups.next', { date: formatDateTime(overview.nextAutomatic) })}</span>
          )}
        </p>
      </div>

      {last && last.ok === false && last.error && <p className='Backups_Card_Warning'>{last.error}</p>}

      <Backup_Settings_Form key={formKey} overview={overview} busy={busy === 'settings'} onSave={onSave} />

      <div className='Backups_Card_List_Head'>
        <h3>{t('backups.listTitle', { count: overview.backups.length })}</h3>
        <span>
          {overview.directory}
          {overview.backups.length > 0 && ` (${formatSize(overview.totalSize)})`}
        </span>
      </div>

      {overview.backups.length === 0 ? (
        <p className='Backups_Card_Empty'>{t('backups.empty')}</p>
      ) : (
        <ul className='Backups_Card_List'>
          {overview.backups.map((backup) => (
            <li key={backup.name} className='Backups_Card_Row'>
              <span className='Backups_Card_Name'>{backup.name}</span>
              <span className='Backups_Card_Date'>{formatDateTime(backup.createdAt)}</span>
              <span className='Backups_Card_Size'>{formatSize(backup.size)}</span>
              <span className='Backups_Card_Row_Actions'>
                {confirmDelete === backup.name ? (
                  <>
                    <button
                      type='button'
                      className='Backups_Card_Danger'
                      disabled={busy !== null}
                      onClick={() => {
                        setConfirmDelete(null);
                        void remove(backup.name);
                      }}
                    >
                      {t('backups.confirmDelete')}
                    </button>
                    <button type='button' className='Backups_Card_Link' onClick={() => setConfirmDelete(null)}>
                      {t('common:actions.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <a className='Backups_Card_Link' href={`${BASE_URL}${End_Points.Backup_Download_Endpoint(backup.name)}`} download>
                      {t('backups.download')}
                    </a>
                    <button
                      type='button'
                      className='Backups_Card_Link danger'
                      disabled={busy !== null}
                      onClick={() => setConfirmDelete(backup.name)}
                    >
                      {t('backups.delete')}
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default Backups_Card;
