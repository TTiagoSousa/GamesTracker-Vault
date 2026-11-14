import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../../Hooks/Prices/formatPrice';

interface Price_Tag_Props {
  price: number;
  regular: number | null;
  cut: number | null;
  currency: string;
  // At the lowest price ever recorded
  isLowest?: boolean;
  size?: 'small' | 'large';
}

/**
 * A price as a shop sticker: the price, the old one struck through when on sale and
 * the discount on a die-cut tag.
 */
const Price_Tag = ({ price, regular, cut, currency, isLowest = false, size = 'small' }: Price_Tag_Props) => {
  const { t } = useTranslation('prices');
  const onSale = (cut ?? 0) > 0 && regular !== null && regular > price;

  return (
    <span className={`Price_Tag ${size}${onSale ? ' sale' : ''}`}>
      {onSale && <span className='Price_Tag_Cut'>−{cut}%</span>}
      <span className='Price_Tag_Now'>{price === 0 ? t('free') : formatPrice(price, currency)}</span>
      {onSale && <s className='Price_Tag_Was'>{formatPrice(regular, currency)}</s>}
      {isLowest && <span className='Price_Tag_Low'>{t('lowestNow')}</span>}
    </span>
  );
};

export default Price_Tag;
