import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PriceAlert } from '../../../Hooks/Prices/types';
import { formatPrice } from '../../../Hooks/Prices/formatPrice';
import { dateLocale } from '../../../i18n';

const relative = (iso: string) => {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
};

interface Alert_List_Props {
  items: PriceAlert[];
  onClear: () => Promise<void>;
}

/** The latest price alerts — the same ones the phone shows as notifications. */
const Alert_List = ({ items, onClear }: Alert_List_Props) => {
  const { t } = useTranslation('prices');

  return (
    <div className='Alert_List'>
      <ol>
        {items.map((alert) => (
          <li key={alert.id} className={alert.read ? '' : 'new'}>
            <span className='Alert_List_Cover' aria-hidden='true'>
              {alert.coverUrl ? <img src={alert.coverUrl} alt='' loading='lazy' /> : alert.gameName.charAt(0)}
            </span>
            <p>
              {alert.gameId ? <Link to={`/Vault/Game/${alert.gameId}`}>{alert.gameName}</Link> : <strong>{alert.gameName}</strong>}{' '}
              {alert.shop
                ? t('alert.dropAt', { price: formatPrice(alert.price, alert.currency), shop: alert.shop })
                : t('alert.drop', { price: formatPrice(alert.price, alert.currency) })}
              {(alert.cut ?? 0) > 0 && <span className='Alert_List_Cut'> −{alert.cut}%</span>}
              {alert.isLowest && <span className='Alert_List_Low'>{t('alert.lowest')}</span>}
            </p>
            <span className='Alert_List_Meta'>
              <time dateTime={alert.createdAt}>{relative(alert.createdAt)}</time>
              {alert.url && (
                <a href={alert.url} target='_blank' rel='noreferrer'>
                  {t('alert.open')}
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
      <button type='button' className='Prices_Link' onClick={() => void onClear()}>
        {t('alert.clear')}
      </button>
    </div>
  );
};

export default Alert_List;
