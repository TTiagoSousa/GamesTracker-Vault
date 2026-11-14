import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePhoneAlerts } from '../../../Hooks/Prices/usePhoneAlerts';
import { androidBridge } from '../../../Service/androidApp';
import * as Icon from '../../../Imports/icons';

/**
 * Turning price alerts into phone notifications. In the Android app it's a switch; in
 * the browser it says where to get the app; in an older app, that it needs updating.
 */
const Phone_Alerts = () => {
  const { t } = useTranslation('prices');
  const { mode, status, busy, enable, disable, openSettings } = usePhoneAlerts();
  const on = Boolean(status?.enabled);

  return (
    <aside className={`Phone_Alerts${on ? ' on' : ''}`}>
      <span className='Phone_Alerts_Icon' aria-hidden='true'><Icon.Bell /></span>
      <div className='Phone_Alerts_Text'>
        <h3>{t('phone.title')}</h3>
        {mode === 'browser' && (
          <p>
            {t('phone.browser')} <Link to='/Vault/Help#android'>{t('phone.getApp')}</Link>
          </p>
        )}
        {mode === 'old-app' && (
          <p>
            {t('phone.oldApp')}{' '}
            <button type='button' className='Prices_Link' onClick={() => androidBridge()?.checkUpdate?.()}>
              {t('phone.update')}
            </button>
          </p>
        )}
        {mode === 'app' && (
          <>
            <p>{on ? t('phone.on') : t('phone.off')}</p>
            {on && status && !status.allowed && (
              <p className='Phone_Alerts_Warning'>
                {t('phone.blocked')}{' '}
                <button type='button' className='Prices_Link' onClick={openSettings}>
                  {t('phone.openSettings')}
                </button>
              </p>
            )}
          </>
        )}
      </div>
      {mode === 'app' && (
        <button
          type='button'
          role='switch'
          aria-checked={on}
          className='Phone_Alerts_Switch'
          disabled={busy}
          onClick={() => void (on ? disable() : enable())}
        >
          <span className='sr-only'>{t('phone.title')}</span>
        </button>
      )}
    </aside>
  );
};

export default Phone_Alerts;
