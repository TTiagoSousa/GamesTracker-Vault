import { useTranslation } from 'react-i18next';
import type { PriceStatus } from '../../../Hooks/Prices/types';

const SOURCES = {
  ITAD: { name: 'IsThereAnyDeal', url: 'https://isthereanydeal.com/' },
  CHEAPSHARK: { name: 'CheapShark', url: 'https://www.cheapshark.com/' },
} as const;

/** Where the prices come from, linked: both services ask to be credited. */
const Price_Source = ({ status }: { status: PriceStatus }) => {
  const { t } = useTranslation('prices');
  if (!status.provider) return null;
  const source = SOURCES[status.provider];
  return (
    <span className='Price_Source'>
      {t('source.from')} <a href={source.url} target='_blank' rel='noreferrer'>{source.name}</a>
      {status.provider === 'CHEAPSHARK' ? t('source.cheapshark') : t('source.itad', { currency: status.currency })}
    </span>
  );
};

export default Price_Source;
