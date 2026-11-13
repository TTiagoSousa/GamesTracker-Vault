import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGameDetail } from '../../../Hooks/Games/useGameDetail';
import type { LibraryEntry } from '../../../Hooks/Games/detailTypes';
import * as Icon from '../../../Imports/icons';

const MAX_SLIDES = 5;
const AUTO_MS = 9000;

// IGDB serves the same image in several sizes: the page wants the big one
const bigArt = (url: string) => url.replace('t_screenshot_big', 't_1080p');

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The top of Home: one game at a time, over its own artwork. What you are
 * playing comes first, then what you touched last. Arrows, the covers on the
 * right and the arrow keys change game; it also moves on by itself, and stops
 * while the pointer or the keyboard focus is on it.
 */
const Home_Spotlight = ({ entries }: { entries: LibraryEntry[] }) => {
  const { t } = useTranslation('home');
  const { t: tl } = useTranslation('library');

  const slides = useMemo(() => {
    const active = (e: LibraryEntry) => (e.status === 'PLAYING' || e.status === 'PAUSED' ? 0 : 1);
    return [...entries]
      .sort((a, b) => active(a) - active(b) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SLIDES);
  }, [entries]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[Math.min(index, slides.length - 1)];
  const { game } = useGameDetail(current?.gameId ?? 0);

  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length);

  // Moves on by itself, unless the user is looking at it or asked for less motion
  useEffect(() => {
    if (paused || slides.length < 2 || reducedMotion()) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), AUTO_MS);
    return () => clearTimeout(timer);
  }, [index, paused, slides.length]);

  if (!current) return null;

  const art = game?.screenshots[0] ? bigArt(game.screenshots[0]) : null;
  const summary = game?.summary ?? null;

  return (
    <section
      className='Home_Spotlight'
      aria-roledescription='carousel'
      aria-label={t('spotlight.label')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      {/* key: the new art fades in instead of swapping in place */}
      <div key={current.gameId} className={`Home_Spotlight_Art${art ? '' : ' cover'}`} aria-hidden='true'>
        {art ? <img src={art} alt='' /> : current.game.coverUrl && <img src={current.game.coverUrl} alt='' />}
      </div>

      <div className='Home_Spotlight_Body' aria-live='polite'>
        <span className={`Home_Spotlight_Status status-${current.status}`}>{tl(`status.${current.status}`)}</span>
        <h2 className='Home_Spotlight_Title'>{current.game.name}</h2>
        <p className='Home_Spotlight_Meta'>
          {current.game.year && <span>{current.game.year}</span>}
          {current.hoursPlayed != null && <span>{t('hours', { hours: current.hoursPlayed })}</span>}
          {current.platform && <span>{current.platform}</span>}
          {current.rating != null && <span>{t('spotlight.rating', { rating: current.rating })}</span>}
        </p>
        {summary && <p className='Home_Spotlight_Summary'>{summary}</p>}
        <Link to={`/Vault/Game/${current.gameId}`} className='Home_Spotlight_Open'>
          {t('spotlight.open')}
        </Link>
      </div>

      {slides.length > 1 && (
        <>
          <div className='Home_Spotlight_Thumbs'>
            {slides.map((entry, i) => (
              <button
                key={entry.gameId}
                type='button'
                className={`Home_Spotlight_Thumb${i === index ? ' active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={t('spotlight.goTo', { name: entry.game.name })}
                aria-current={i === index}
              >
                {entry.game.coverUrl ? <img src={entry.game.coverUrl} alt='' /> : <span>{entry.game.name}</span>}
              </button>
            ))}
          </div>
          <div className='Home_Spotlight_Arrows'>
            <button type='button' className='prev' onClick={() => go(-1)} aria-label={t('spotlight.prev')}><Icon.Chevron /></button>
            <button type='button' className='next' onClick={() => go(1)} aria-label={t('spotlight.next')}><Icon.Chevron /></button>
          </div>
          {/* How long until it moves on: restarts with every game, frozen while paused */}
          <span key={`${current.gameId}-${paused}`} className={`Home_Spotlight_Timer${paused ? ' paused' : ''}`} aria-hidden='true' />
        </>
      )}
    </section>
  );
};

export default Home_Spotlight;
