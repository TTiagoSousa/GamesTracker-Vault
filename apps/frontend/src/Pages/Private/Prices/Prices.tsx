import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePriceStatus, usePricesPage } from '../../../Hooks/Prices/usePrices';
import { useNotifications } from '../../../Hooks/Prices/useNotifications';
import { formatPrice } from '../../../Hooks/Prices/formatPrice';
import { useAuth } from '../../../Contexts/Auth_Context';
import { dateLocale } from '../../../i18n';
import Price_Row from './Price_Row';
import Price_Tag from './Price_Tag';
import Alert_List from './Alert_List';
import Phone_Alerts from './Phone_Alerts';
import Price_Source from './Price_Source';
import './Price_Shared.scss';
import './Prices.scss';

/**
 * The Prices page: the latest alerts (and turning them on for the phone), the games
 * the user follows with their targets, the "to play" shelf at today's prices and the
 * deals the price service features.
 */
const Prices = () => {
  const { t } = useTranslation('prices');
  const { role } = useAuth();
  const status = usePriceStatus();
  const enabled = Boolean(status.data?.enabled && status.data.provider);
  const { watchlist, backlog, featured, follow, unfollow } = usePricesPage(enabled);
  const alerts = useNotifications();
  const currency = status.data?.currency ?? 'EUR';

  const watched = watchlist.data?.items ?? [];
  const toPlay = (backlog.data?.items ?? []).filter((item) => !item.watched);

  const lastCheck = status.data?.lastCheckAt
    ? new Date(status.data.lastCheckAt).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div className='Prices'>
      <header className='Prices_Hero'>
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
        {status.data && (
          <p className='Prices_Meta'>
            <Price_Source status={status.data} />
            {enabled && (
              <span>{t('checkedEvery', { count: status.data.everyHours })}</span>
            )}
            {enabled && lastCheck && <span>{t('lastCheck', { date: lastCheck })}</span>}
          </p>
        )}
      </header>

      {status.error && <p className='Prices_Error'>{status.error}</p>}

      {status.data && !enabled && (
        <section className='Prices_Off'>
          <p>{t('off')}</p>
          {role === 'ADMIN' && <Link to='/Vault/Admin#prices' className='Prices_Ghost'>{t('offAdmin')}</Link>}
        </section>
      )}

      {enabled && (
        <>
          <section className='Prices_Section Prices_Alerts'>
            <h2>{t('alerts.title')}</h2>
            <div className='Prices_Alerts_Grid'>
              {alerts.items === null ? (
                <p className='Prices_Muted'>{t('loading')}</p>
              ) : alerts.items.length ? (
                <Alert_List items={alerts.items} onClear={alerts.clear} />
              ) : (
                <p className='Prices_Muted'>{t('alerts.empty')}</p>
              )}
              <Phone_Alerts />
            </div>
          </section>

          <section className='Prices_Section'>
            <div className='Prices_Section_Head'>
              <h2>{t('watching.title')}</h2>
              {watched.length > 0 && <span className='Prices_Count'>{watched.length}</span>}
            </div>
            {watchlist.error && <p className='Prices_Error'>{watchlist.error}</p>}
            {watchlist.loading ? (
              <p className='Prices_Muted'>{t('loading')}</p>
            ) : watched.length === 0 ? (
              <p className='Prices_Empty'>{t('watching.empty')}</p>
            ) : (
              <ul className='Price_Ledger'>
                {watched.map((item) => (
                  <Price_Row
                    key={item.game.id}
                    game={item.game}
                    price={item.price}
                    currency={currency}
                    targetPrice={item.targetPrice}
                    reached={item.reached}
                    onFollow={(target) => follow(item.game.id, target)}
                    onUnfollow={() => unfollow(item.game.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className='Prices_Section'>
            <div className='Prices_Section_Head'>
              <h2>{t('backlog.title')}</h2>
              {toPlay.length > 0 && <span className='Prices_Count'>{toPlay.length}</span>}
            </div>
            <p className='Prices_Muted'>{t('backlog.intro')}</p>
            {backlog.error && <p className='Prices_Error'>{backlog.error}</p>}
            {backlog.loading ? (
              <p className='Prices_Muted'>{t('loading')}</p>
            ) : toPlay.length === 0 ? (
              <p className='Prices_Empty'>{(backlog.data?.items.length ?? 0) > 0 ? t('backlog.allFollowed') : t('backlog.empty')}</p>
            ) : (
              <ul className='Price_Ledger'>
                {toPlay.map((item) => (
                  <Price_Row
                    key={item.game.id}
                    game={item.game}
                    price={item.price}
                    currency={currency}
                    searched={item.searched}
                    onFollow={(target) => follow(item.game.id, target)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className='Prices_Section'>
            <h2>{t('featured.title')}</h2>
            {featured.error && <p className='Prices_Error'>{featured.error}</p>}
            {featured.loading ? (
              <p className='Prices_Muted'>{t('loading')}</p>
            ) : (
              <ul className='Deal_Grid'>
                {(featured.data?.deals ?? []).map((deal) => (
                  <li key={`${deal.title}-${deal.shop}`}>
                    <a href={deal.url} target='_blank' rel='noreferrer' className='Deal_Card'>
                      <span className='Deal_Card_Art' aria-hidden='true'>
                        {deal.image ? <img src={deal.image} alt='' loading='lazy' /> : null}
                      </span>
                      <span className='Deal_Card_Title'>{deal.title}</span>
                      <span className='Deal_Card_Shop'>{deal.shop}</span>
                      <Price_Tag price={deal.price} regular={deal.regular} cut={deal.cut} currency={deal.currency} />
                      {deal.lowest !== null && (
                        <span className='Deal_Card_Low'>
                          {deal.price <= deal.lowest ? t('lowestNow') : t('lowestWas', { price: formatPrice(deal.lowest, deal.currency) })}
                        </span>
                      )}
                    </a>
                    <Link className='Deal_Card_Find' to={`/Vault/Search?q=${encodeURIComponent(deal.title)}`}>
                      {t('featured.find')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Prices;
