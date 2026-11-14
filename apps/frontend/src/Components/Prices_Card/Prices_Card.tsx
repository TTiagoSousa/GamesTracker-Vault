import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePriceAdmin } from '../../Hooks/Admin/usePriceAdmin';
import { dateLocale } from '../../i18n';
import '../Igdb_Card/Igdb_Card.scss';
import './Prices_Card.scss';

const ITAD_APPS = 'https://isthereanydeal.com/apps/my/';
const COUNTRIES = ['PT', 'BR', 'ES', 'FR', 'DE', 'IT', 'NL', 'BE', 'IE', 'AT', 'CH', 'GB', 'PL', 'SE', 'NO', 'DK', 'FI', 'US', 'CA', 'MX', 'AU', 'JP'];
const INTERVALS = [1, 3, 6, 12, 24];

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames([dateLocale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' });

/**
 * Admin → Prices: the IsThereAnyDeal key (without it, CheapShark: PC shops in US
 * dollars), the country, how often the followed games are checked, and checking now.
 */
const Prices_Card = () => {
  const { t } = useTranslation('admin');
  const { itad, status, busy, saveKey, testKey, removeKey, saveSettings, checkNow } = usePriceAdmin();
  const [key, setKey] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!itad || !status) return null;

  const provider = !status.enabled ? 'off' : status.provider === 'ITAD' ? 'itad' : 'cheapshark';
  const canSaveKey = key.trim().length >= 16 && !busy;

  const onSaveKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSaveKey) return;
    if (await saveKey(key)) setKey('');
  };

  return (
    <section className='Igdb_Card Prices_Card' id='prices'>
      <div className='Igdb_Card_Head'>
        <div>
          <h2 className='Igdb_Card_Title'>{t('prices.title')}</h2>
          <p className='Igdb_Card_Description'>{t('prices.description')}</p>
        </div>
        <span className={`Igdb_Card_Status${provider !== 'off' ? ' on' : ''}`}>{t(`prices.provider.${provider}`)}</span>
      </div>

      <label className='Prices_Card_Check'>
        <input
          type='checkbox'
          checked={status.enabled}
          disabled={busy === 'settings'}
          onChange={(e) => void saveSettings({ enabled: e.target.checked })}
        />
        <span>{t('prices.enabled')}</span>
      </label>

      {status.enabled && (
        <>
          <div className='Prices_Card_Settings'>
            <label>
              <span>{t('prices.country')}</span>
              <select value={status.country} disabled={busy === 'settings'} onChange={(e) => void saveSettings({ country: e.target.value })}>
                {(COUNTRIES.includes(status.country) ? COUNTRIES : [status.country, ...COUNTRIES]).map((code) => (
                  <option key={code} value={code}>{countryName(code)}</option>
                ))}
              </select>
              <small>{status.provider === 'ITAD' ? t('prices.countryHint', { currency: status.currency }) : t('prices.countryCheapShark')}</small>
            </label>

            <label>
              <span>{t('prices.every')}</span>
              <select
                value={status.everyHours}
                disabled={busy === 'settings'}
                onChange={(e) => void saveSettings({ everyHours: Number(e.target.value) })}
              >
                {INTERVALS.map((hours) => (
                  <option key={hours} value={hours}>{t('prices.hours', { count: hours })}</option>
                ))}
              </select>
              <small>{t('prices.everyHint')}</small>
            </label>
          </div>

          <div className='Prices_Card_Now'>
            <button type='button' className='Igdb_Card_Button' disabled={Boolean(busy) || status.checking} onClick={() => void checkNow()}>
              {busy === 'check' || status.checking ? t('prices.checking') : t('prices.checkNow')}
            </button>
            <p className='Igdb_Card_Help'>
              {status.lastCheckAt ? t('prices.lastCheck', { date: formatDateTime(status.lastCheckAt) }) : t('prices.neverChecked')}
              {status.nextCheckAt && <span className='Igdb_Card_Updated'>{t('prices.next', { date: formatDateTime(status.nextCheckAt) })}</span>}
            </p>
          </div>
          {status.lastError && <p className='Igdb_Card_Warning'>{t('prices.lastError', { error: status.lastError })}</p>}

          <h3 className='Prices_Card_Subtitle'>{t('prices.itadTitle')}</h3>
          {itad.unreadable && <p className='Igdb_Card_Warning'>{t('prices.unreadable')}</p>}
          <form className='Igdb_Card_Form' onSubmit={(e) => void onSaveKey(e)}>
            <label>
              <span>{t('prices.key')}</span>
              <input
                type='password'
                autoComplete='new-password'
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={itad.configured && itad.keyHint ? t('prices.keyKept', { hint: itad.keyHint }) : ''}
              />
            </label>
            <div className='Igdb_Card_Actions'>
              <button type='submit' className='Igdb_Card_Save' disabled={!canSaveKey}>
                {busy === 'key' ? t('prices.saving') : t('prices.saveKey')}
              </button>
              {itad.configured && (
                <button type='button' className='Igdb_Card_Button' disabled={Boolean(busy)} onClick={() => void testKey()}>
                  {busy === 'test' ? t('prices.testing') : t('prices.test')}
                </button>
              )}
              {itad.configured &&
                (confirmRemove ? (
                  <span className='Igdb_Card_Confirm'>
                    <button type='button' className='Igdb_Card_Danger' disabled={Boolean(busy)} onClick={() => { setConfirmRemove(false); void removeKey(); }}>
                      {t('prices.confirmRemove')}
                    </button>
                    <button type='button' className='Igdb_Card_Link' onClick={() => setConfirmRemove(false)}>
                      {t('prices.cancel')}
                    </button>
                  </span>
                ) : (
                  <button type='button' className='Igdb_Card_Link danger' disabled={Boolean(busy)} onClick={() => setConfirmRemove(true)}>
                    {t('prices.removeKey')}
                  </button>
                ))}
            </div>
          </form>
          <p className='Igdb_Card_Help'>
            {t('prices.keyHelp')}{' '}
            <a href={ITAD_APPS} target='_blank' rel='noreferrer'>{t('prices.keyHelpLink')}</a>
          </p>
        </>
      )}
    </section>
  );
};

export default Prices_Card;
