import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShelfAction, ShelfFields } from '../../../Hooks/Ai/useAssistantChat';

interface Shelf_Action_CardProps {
  action: ShelfAction;
  onDecide: (actionId: string, decision: 'confirm' | 'dismiss') => Promise<void>;
}

const FIELDS: (keyof ShelfFields)[] = ['status', 'rating', 'hoursPlayed', 'platform'];

/**
 * A shelf change the assistant proposed, like a slip tucked into the game's box:
 * the cover, what changes (before → after) and Confirm / Dismiss. Once decided it
 * stays in the conversation with the outcome.
 */
const Shelf_Action_Card = ({ action, onDecide }: Shelf_Action_CardProps) => {
  const { t } = useTranslation(['assistant', 'library']);
  const [busy, setBusy] = useState<'confirm' | 'dismiss' | null>(null);

  const show = (field: keyof ShelfFields, value: ShelfFields[keyof ShelfFields] | undefined) => {
    if (value === null || value === undefined || value === '') return t('assistant:actions.empty');
    if (field === 'status') return t(`library:status.${value}`);
    if (field === 'rating') return t('assistant:actions.ratingValue', { value });
    if (field === 'hoursPlayed') return t('assistant:actions.hoursValue', { value });
    return String(value);
  };

  const heading =
    action.kind === 'remove' ? t('assistant:actions.remove') : action.before ? t('assistant:actions.change') : t('assistant:actions.add');

  const decide = async (decision: 'confirm' | 'dismiss') => {
    setBusy(decision);
    await onDecide(action.id, decision);
    setBusy(null);
  };

  const rows = action.kind === 'set' ? FIELDS.filter((field) => field in action.change) : [];

  return (
    <div className={`Shelf_Action ${action.state}${action.kind === 'remove' ? ' remove' : ''}`}>
      <span className='Shelf_Action_Cover' aria-hidden='true'>
        {action.coverUrl ? <img src={action.coverUrl} alt='' loading='lazy' /> : action.gameName.charAt(0)}
      </span>

      <div className='Shelf_Action_Body'>
        <span className='Shelf_Action_Kind'>{heading}</span>
        <Link className='Shelf_Action_Game' to={`/Vault/Game/${action.gameId}`}>{action.gameName}</Link>

        {rows.length > 0 && (
          <dl className='Shelf_Action_Changes'>
            {rows.map((field) => (
              <div key={field}>
                <dt>{t(`assistant:actions.fields.${field}`)}</dt>
                <dd>
                  {action.before && <><s>{show(field, action.before[field])}</s><span aria-hidden='true'> → </span></>}
                  <strong>{show(field, action.change[field])}</strong>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {action.state === 'pending' ? (
          <div className='Shelf_Action_Buttons'>
            <button type='button' className='confirm' onClick={() => void decide('confirm')} disabled={busy !== null}>
              {busy === 'confirm' ? t('assistant:actions.confirming') : t('assistant:actions.confirm')}
            </button>
            <button type='button' onClick={() => void decide('dismiss')} disabled={busy !== null}>
              {t('assistant:actions.dismiss')}
            </button>
          </div>
        ) : (
          <p className='Shelf_Action_State' role='status'>
            {action.state === 'done' && (action.kind === 'remove' ? t('assistant:actions.removed') : t('assistant:actions.done'))}
            {action.state === 'dismissed' && t('assistant:actions.dismissed')}
            {action.state === 'failed' && (action.error ?? t('assistant:actions.failed'))}
          </p>
        )}
      </div>
    </div>
  );
};

export default Shelf_Action_Card;
