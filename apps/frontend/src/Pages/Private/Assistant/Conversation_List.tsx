import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLanguage } from '../../../i18n';
import type { ConversationSummary } from '../../../Hooks/Ai/useAssistantChat';
import * as Icon from '../../../Imports/icons';

interface Conversation_ListProps {
  conversations: ConversationSummary[] | null;
  activeId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => Promise<boolean>;
}

// "5 min ago", "yesterday"; after a week, the date
const useWhen = () => {
  const { t } = useTranslation('assistant');
  return (iso: string) => {
    const language = currentLanguage();
    const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
    if (seconds < 60) return t('history.now');
    const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
    if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
    if (seconds < 7 * 86400) return rtf.format(-Math.floor(seconds / 86400), 'day');
    return new Date(iso).toLocaleDateString(language, { day: 'numeric', month: 'short' });
  };
};

/**
 * The saved conversations, the latest first. A dot marks the ones the assistant is
 * still answering. Deleting asks once more in the row itself.
 */
const Conversation_List = ({ conversations, activeId, onOpen, onRemove }: Conversation_ListProps) => {
  const { t } = useTranslation('assistant');
  const when = useWhen();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (conversations === null) return <p className='Conversation_List_Empty'>{t('history.loading')}</p>;
  if (!conversations.length) return <p className='Conversation_List_Empty'>{t('history.empty')}</p>;

  return (
    <ul className='Conversation_List'>
      {conversations.map((c) => (
        <li key={c.id} className={c.id === activeId ? 'active' : undefined}>
          {confirmId === c.id ? (
            <div className='Conversation_List_Confirm'>
              <span>{t('history.confirm')}</span>
              <button type='button' className='danger' onClick={() => void onRemove(c.id).then(() => setConfirmId(null))}>
                {t('history.delete')}
              </button>
              <button type='button' onClick={() => setConfirmId(null)}>{t('settings.cancel')}</button>
            </div>
          ) : (
            <>
              <button
                type='button'
                className='Conversation_List_Open'
                onClick={() => onOpen(c.id)}
                aria-current={c.id === activeId ? 'true' : undefined}
              >
                <span className='Conversation_List_Title'>{c.title}</span>
                <span className='Conversation_List_Meta'>
                  {c.running && <span className='Conversation_List_Live' title={t('history.running')} />}
                  {c.running ? t('history.running') : when(c.updatedAt)}
                </span>
              </button>
              <button
                type='button'
                className='Conversation_List_Remove'
                onClick={() => setConfirmId(c.id)}
                aria-label={t('history.deleteLabel', { title: c.title })}
                title={t('history.delete')}
              >
                <Icon.Trash />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
};

export default Conversation_List;
