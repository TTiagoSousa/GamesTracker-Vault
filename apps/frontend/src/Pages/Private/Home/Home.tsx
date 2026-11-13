import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../Contexts/Auth_Context';
import { useLibrary } from '../../../Hooks/Games/useLibrary';
import { SHELF_OF, SHELVES, type LibraryEntry, type LibraryStatus, type Shelf } from '../../../Hooks/Games/detailTypes';
import * as Icon from '../../../Imports/icons';
import Random_Pick from './Random_Pick';
import Home_Spotlight from './Home_Spotlight';
import './Home.scss';

// Label under the name: only when the shelf combines different statuses
const TAGGED: Partial<Record<LibraryStatus, true>> = {
  PAUSED: true,
  FINISHED_MAIN: true,
  FINISHED_EXTRAS: true,
  COMPLETED_100: true,
};

/**
 * A row of covers that scrolls sideways. The arrows only show when there is
 * more to see in that direction; on touch screens the row just swipes.
 */
const Shelf_Row = ({ entries }: { entries: LibraryEntry[] }) => {
  const { t } = useTranslation('home');
  const { t: tl } = useTranslation('library');
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    // The observer also reports the first size, so the arrows start right
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [entries.length]);

  const page = (direction: number) =>
    row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <div className='Home_Shelf_Track'>
      <div className='Home_Shelf_Row' ref={row}>
        {entries.map((entry) => (
          <Link key={entry.gameId} to={`/Vault/Game/${entry.gameId}`} className={`Home_Game status-${entry.status}`}>
            <span className='Home_Game_Case'>
              {entry.game.coverUrl
                ? <img src={entry.game.coverUrl} alt='' loading='lazy' />
                : <span className='Home_Game_NoCover'>{entry.game.name}</span>}
              {/* On hover: what you logged for this game */}
              <span className='Home_Game_Peek' aria-hidden='true'>
                <b>{tl(`statusShort.${entry.status}`)}</b>
                {entry.rating != null && <span>{t('spotlight.rating', { rating: entry.rating })}</span>}
                {entry.hoursPlayed != null && <span>{t('hours', { hours: entry.hoursPlayed })}</span>}
                {entry.platform && <span>{entry.platform}</span>}
              </span>
            </span>
            <span className='Home_Game_Name' title={entry.game.name}>{entry.game.name}</span>
            <span className='Home_Game_Meta'>
              {TAGGED[entry.status] && <span className='Home_Game_Tag'>{tl(`statusShort.${entry.status}`)}</span>}
              {entry.hoursPlayed != null && <span>{t('hours', { hours: entry.hoursPlayed })}</span>}
            </span>
          </Link>
        ))}
      </div>
      {!edges.start && (
        <button type='button' className='Home_Shelf_Arrow prev' onClick={() => page(-1)} aria-label={t('spotlight.prev')}>
          <Icon.Chevron />
        </button>
      )}
      {!edges.end && (
        <button type='button' className='Home_Shelf_Arrow next' onClick={() => page(1)} aria-label={t('spotlight.next')}>
          <Icon.Chevron />
        </button>
      )}
    </div>
  );
};

// Home: the spotlight, then one shelf per status group with the covers facing out.
const Home = () => {
  const { t } = useTranslation('home');
  const { username } = useAuth();
  const { library, error } = useLibrary();

  // Most recent first
  const byShelf = useMemo(() => {
    const groups: Record<Shelf, LibraryEntry[]> = { playing: [], done: [], later: [], dropped: [] };
    const items = [...(library?.items ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const entry of items) groups[SHELF_OF[entry.status]].push(entry);
    return groups;
  }, [library]);

  return (
    <div className='Home'>
      <header className='Home_Hero'>
        <h1>{username ? t('greeting', { name: username }) : t('title')}</h1>
        {library && library.total === 0 && <p>{t('empty.description')}</p>}
      </header>

      {error && <p className='Home_Error'>{t('loadFailed')}</p>}

      {library && library.items.length > 0 && <Home_Spotlight entries={library.items} />}

      {library && (
      <div className='Home_Shelves'>
        {SHELVES.map((shelf) => {
          const entries = byShelf[shelf];
          return (
            <section key={shelf} className={`Home_Shelf ${shelf}${entries.length ? '' : ' empty'}`} aria-labelledby={`shelf-${shelf}`}>
              {/* Shelf divider: a coloured spine with the shelf's name and how many games it holds */}
              <div className='Home_Shelf_Divider'>
                <span className='Home_Shelf_Count' aria-label={t('count', { count: entries.length })}>{entries.length}</span>
                {entries.length > 0 && <h2 id={`shelf-${shelf}`}>{t(`shelves.${shelf}`)}</h2>}
              </div>

              {entries.length === 0
                ? (
                  <div className='Home_Shelf_Empty'>
                    <h2 id={`shelf-${shelf}`}>{t(`shelves.${shelf}`)}</h2>
                    <p>{t(`emptyShelf.${shelf}`)}</p>
                  </div>
                )
                : <Shelf_Row entries={entries} />}
            </section>
          );
        })}
      </div>
      )}

      {/* Everything renders at once when the shelf arrives: nothing grows or shrinks afterwards */}
      {library && <Random_Pick entries={library.items} />}
    </div>
  );
};

export default Home;
