import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GameSummary } from '../../../Hooks/Games/types';

// The score's colour, like review sites: great, good, the rest
const scoreTier = (rating: number) => (rating >= 85 ? 'great' : rating >= 70 ? 'good' : 'meh');

// A result is the cover, the name, year and platforms below it; on hover the
// cover lifts and shows the genres. Opens the game page.
const Game_Result = ({ game }: { game: GameSummary }) => {
  const { t } = useTranslation('search');

  return (
    <Link to={`/Vault/Game/${game.id}`} className='Game_Result'>
      <div className='Game_Result_Case'>
        {game.coverUrl ? (
          <img src={game.coverUrl} alt='' loading='lazy' />
        ) : (
          <span className='Game_Result_NoCover'>{t('noCover')}</span>
        )}
        {game.rating !== null && (
          <span className={`Game_Result_Rating ${scoreTier(game.rating)}`} title={t('rating', { value: game.rating })}>
            {game.rating}
          </span>
        )}
        {game.genres.length > 0 && (
          <span className='Game_Result_Peek' aria-hidden='true'>{game.genres.slice(0, 3).join(', ')}</span>
        )}
      </div>

      <h3 className='Game_Result_Name'>{game.name}</h3>
      <p className='Game_Result_Meta'>
        {game.year && <span>{game.year}</span>}
        {game.platforms.length > 0 && <span>{game.platforms.slice(0, 3).join(', ')}{game.platforms.length > 3 ? '…' : ''}</span>}
      </p>
    </Link>
  );
};

export default Game_Result;
