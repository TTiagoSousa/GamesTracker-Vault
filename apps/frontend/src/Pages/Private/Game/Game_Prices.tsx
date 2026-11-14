import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGamePrices, usePriceStatus } from '../../../Hooks/Prices/usePrices';
import { formatPrice } from '../../../Hooks/Prices/formatPrice';
import { dateLocale } from '../../../i18n';
import Price_Tag from '../Prices/Price_Tag';
import Watch_Editor from '../Prices/Watch_Editor';
import Price_Source from '../Prices/Price_Source';
import '../Prices/Price_Shared.scss';

const SHOPS_SHOWN = 4;
const W = 280;
const H = 56;

/** The best price per day, as a line: the lowest point is marked. */
const History_Line = ({ points, currency }: { points: { day: string; price: number }[]; currency: string }) => {
  const { t } = useTranslation('prices');
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (price: number) => 4 + (1 - (price - min) / span) * (H - 8);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
  const lowIndex = prices.indexOf(min);
  const first = new Date(points[0].day).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

  return (
    <figure className='Game_Prices_History'>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio='none' role='img' aria-label={t('game.historyLabel', { min: formatPrice(min, currency), max: formatPrice(max, currency) })}>
        <polyline points={line} fill='none' vectorEffect='non-scaling-stroke' />
        <circle cx={x(lowIndex)} cy={y(min)} r='3.5' />
      </svg>
      <figcaption>
        <span>{t('game.since', { date: first })}</span>
        <span>{t('game.range', { min: formatPrice(min, currency), max: formatPrice(max, currency) })}</span>
      </figcaption>
    </figure>
  );
};

/**
 * The game's prices beside its details: the best one now and where, a few other
 * shops, the lowest ever, how it moved, and following the price with an alert.
 */
const Game_Prices = ({ gameId }: { gameId: number }) => {
  const { t } = useTranslation('prices');
  const status = usePriceStatus();
  const enabled = Boolean(status.data?.enabled && status.data.provider);
  const { data, error, loading, busy, follow, unfollow } = useGamePrices(gameId, enabled);
  const [editing, setEditing] = useState(false);
  const [allShops, setAllShops] = useState(false);

  if (!enabled) return null;

  const price = data?.price ?? null;
  const sold = price?.price !== null && price?.price !== undefined;
  const currency = price?.currency ?? status.data!.currency;
  const shops = price?.deals ?? [];
  const otherShops = shops.slice(1, allShops ? undefined : SHOPS_SHOWN + 1);
  const watch = data?.watch ?? null;

  return (
    <section className='Game_Prices'>
      <h2 className='Game_Section_Title'>{t('game.title')}</h2>

      {loading ? (
        <p className='Game_Muted'>{t('loading')}</p>
      ) : error ? (
        <p className='Game_Muted'>{error}</p>
      ) : !sold ? (
        <p className='Game_Muted'>{t('game.notSold')}</p>
      ) : (
        <>
          <div className='Game_Prices_Best'>
            <Price_Tag price={price.price!} regular={price.regular} cut={price.cut} currency={currency} isLowest={price.isLowest} size='large' />
            {price.url && price.shop && (
              <a className='Game_Prices_Shop' href={price.url} target='_blank' rel='noreferrer'>
                {t('atShop', { shop: price.shop })}
              </a>
            )}
          </div>

          {price.lowest !== null && !price.isLowest && (
            <p className='Game_Prices_Lowest'>{t('game.lowest', { price: formatPrice(price.lowest, currency) })}</p>
          )}

          {otherShops.length > 0 && (
            <ul className='Game_Prices_Shops'>
              {otherShops.map((deal) => (
                <li key={deal.shop}>
                  <a href={deal.url} target='_blank' rel='noreferrer'>{deal.shop}</a>
                  <span>
                    {(deal.cut ?? 0) > 0 && <span className='Game_Prices_Cut'>−{deal.cut}%</span>}
                    {formatPrice(deal.price, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {shops.length > SHOPS_SHOWN + 1 && (
            <button type='button' className='Prices_Link' onClick={() => setAllShops((v) => !v)}>
              {allShops ? t('game.fewerShops') : t('game.allShops', { count: shops.length })}
            </button>
          )}

          {(data?.history.length ?? 0) >= 2 && <History_Line points={data!.history} currency={currency} />}
        </>
      )}

      {data && (
        <div className='Game_Prices_Watch'>
          {editing ? (
            <>
              <Watch_Editor
                targetPrice={watch ? watch.targetPrice : undefined}
                currency={currency}
                suggestion={sold ? Math.floor(price.price! * 0.7) : null}
                busy={busy}
                onSave={follow}
                onCancel={() => setEditing(false)}
              />
              {watch && (
                <button type='button' className='Prices_Link danger' disabled={busy} onClick={() => void unfollow().then(() => setEditing(false))}>
                  {t('unfollow')}
                </button>
              )}
            </>
          ) : watch ? (
            <p className='Game_Prices_Following'>
              <span>
                {watch.targetPrice === null
                  ? t('game.followingSale')
                  : t('game.followingTarget', { price: formatPrice(watch.targetPrice, currency) })}
              </span>
              <button type='button' className='Prices_Link' onClick={() => setEditing(true)}>{t('game.change')}</button>
            </p>
          ) : (
            <button type='button' className='Prices_Solid' onClick={() => setEditing(true)}>{t('game.follow')}</button>
          )}
        </div>
      )}

      <p className='Game_Prices_Foot'>
        {status.data && <Price_Source status={status.data} />}
        <Link to='/Vault/Prices'>{t('game.allPrices')}</Link>
      </p>
    </section>
  );
};

export default Game_Prices;
