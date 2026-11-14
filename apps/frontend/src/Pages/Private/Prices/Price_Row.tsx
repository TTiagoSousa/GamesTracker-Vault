import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GamePrice, PriceGame } from '../../../Hooks/Prices/types';
import { formatPrice } from '../../../Hooks/Prices/formatPrice';
import Price_Tag from './Price_Tag';
import Watch_Editor from './Watch_Editor';

interface Price_Row_Props {
  game: PriceGame;
  price: GamePrice | null;
  currency: string;
  // Followed: its target (null = any sale); not followed: undefined
  targetPrice?: number | null;
  reached?: boolean;
  // false = not looked for at the shops yet (the next check does it)
  searched?: boolean;
  onFollow: (targetPrice: number | null) => Promise<boolean>;
  onUnfollow?: () => Promise<void>;
}

/**
 * One game in the ledger: the box, the best price and where, the lowest ever and the
 * alert. Opening "Alert" edits it in place.
 */
const Price_Row = ({ game, price, currency, targetPrice, reached = false, searched = true, onFollow, onUnfollow }: Price_Row_Props) => {
  const { t } = useTranslation('prices');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const following = targetPrice !== undefined;
  const sold = price?.price !== null && price?.price !== undefined;

  const save = async (target: number | null) => {
    setBusy(true);
    const ok = await onFollow(target);
    setBusy(false);
    return ok;
  };

  const suggestion = sold ? Math.floor(price.price! * 0.7) : null;

  return (
    <li className={`Price_Row${reached ? ' reached' : ''}${editing ? ' editing' : ''}`}>
      <Link to={`/Vault/Game/${game.id}`} className='Price_Row_Cover' tabIndex={-1} aria-hidden='true'>
        {game.coverUrl ? <img src={game.coverUrl} alt='' loading='lazy' /> : <span>{game.name.charAt(0)}</span>}
      </Link>

      <div className='Price_Row_Name'>
        <Link to={`/Vault/Game/${game.id}`}>{game.name}</Link>
        <span className='Price_Row_Where'>
          {sold && price.shop && price.url ? (
            <a href={price.url} target='_blank' rel='noreferrer'>
              {t('atShop', { shop: price.shop })}
            </a>
          ) : !searched ? (
            t('searching')
          ) : (
            t('notSold')
          )}
        </span>
      </div>

      <div className='Price_Row_Price'>
        {sold && <Price_Tag price={price.price!} regular={price.regular} cut={price.cut} currency={price.currency} isLowest={price.isLowest} />}
      </div>

      <div className='Price_Row_Low'>
        {price?.lowest !== null && price?.lowest !== undefined && (
          <>
            <span className='Price_Row_Label'>{t('lowest')}</span>
            <span>{formatPrice(price.lowest, price.currency)}</span>
          </>
        )}
      </div>

      <div className='Price_Row_Alert'>
        {following ? (
          <>
            <button type='button' className={`Price_Row_Target${reached ? ' on' : ''}`} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
              {targetPrice === null ? t('target.anySale') : t('target.below', { price: formatPrice(targetPrice, price?.currency ?? currency) })}
            </button>
            {reached && <span className='Price_Row_Reached'>{targetPrice === null ? t('target.onSale') : t('target.reached')}</span>}
          </>
        ) : (
          <button type='button' className='Prices_Ghost' onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {t('follow')}
          </button>
        )}
      </div>

      {editing && (
        <div className='Price_Row_Editor'>
          <Watch_Editor
            targetPrice={targetPrice}
            currency={price?.currency ?? currency}
            suggestion={suggestion}
            busy={busy}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
          {following && onUnfollow && (
            <button type='button' className='Prices_Link danger' disabled={busy} onClick={() => void onUnfollow()}>
              {t('unfollow')}
            </button>
          )}
        </div>
      )}
    </li>
  );
};

export default Price_Row;
