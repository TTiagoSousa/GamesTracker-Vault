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
  onRemoveMany: (ids: string[]) => Promise<boolean>;
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
 * still answering. Each row deletes its conversation (asking once more in the row);
 * "Select" turns the rows into checkboxes to delete one or several together.
 */
const Conversation_List = ({ conversations, activeId, onOpen, onRemove, onRemoveMany }: Conversation_ListProps) => {
  const { t } = useTranslation('assistant');
  const when = useWhen();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // null = not selecting
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [confirmMany, setConfirmMany] = useState(false);
  const [busy, setBusy] = useState(false);

  const selecting = selected !== null;
  const list = conversations ?? [];

  const startSelecting = () => {
    setConfirmId(null);
    setConfirmMany(false);
    setSelected(new Set());
  };

  const stopSelecting = () => {
    setSelected(null);
    setConfirmMany(false);
  };

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = selecting && list.length > 0 && selected.size === list.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(list.map((c) => c.id)));

  const removeSelected = async () => {
    if (!selected?.size) return;
    setBusy(true);
    const ok = await onRemoveMany([...selected]);
    setBusy(false);
    if (ok) stopSelecting();
  };

  return (
    <div className={`Conversation_List_Wrap${selecting ? ' selecting' : ''}`}>
      <div className='Conversation_List_Head'>
        <h2>{t('history.title')}</h2>
        {list.length > 0 && (
          <button type='button' className='Conversation_List_Mode' onClick={selecting ? stopSelecting : startSelecting}>
            {selecting ? t('settings.cancel') : t('history.select')}
          </button>
        )}
      </div>

      {conversations === null ? (
        <p className='Conversation_List_Empty'>{t('history.loading')}</p>
      ) : !list.length ? (
        <p className='Conversation_List_Empty'>{t('history.empty')}</p>
      ) : (
        <ul className='Conversation_List'>
          {list.map((c) => {
            const meta = (
              <span className='Conversation_List_Meta'>
                {c.running && <span className='Conversation_List_Live' title={t('history.running')} />}
                {c.running ? t('history.running') : when(c.updatedAt)}
              </span>
            );

            if (selecting) {
              const checked = selected.has(c.id);
              return (
                <li key={c.id} className={checked ? 'checked' : undefined}>
                  <label className='Conversation_List_Open Conversation_List_Check'>
                    <input type='checkbox' checked={checked} onChange={() => toggle(c.id)} />
                    <span className='Conversation_List_Box' aria-hidden='true' />
                    <span className='Conversation_List_Text'>
                      <span className='Conversation_List_Title'>{c.title}</span>
                      {meta}
                    </span>
                  </label>
                </li>
              );
            }

            return (
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
                      {meta}
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
            );
          })}
        </ul>
      )}

      {/* Selecting: how many, all/none and delete, asking once more */}
      {selecting && list.length > 0 && (
        <div className='Conversation_List_Bar'>
          {confirmMany ? (
            <>
              <span>{t('history.confirmMany', { count: selected.size })}</span>
              <button type='button' className='danger' onClick={() => void removeSelected()} disabled={busy}>
                {t('history.delete')}
              </button>
              <button type='button' onClick={() => setConfirmMany(false)} disabled={busy}>{t('settings.cancel')}</button>
            </>
          ) : (
            <>
              <span>{t('history.selected', { count: selected.size })}</span>
              <button type='button' onClick={toggleAll}>
                {allSelected ? t('history.selectNone') : t('history.selectAll')}
              </button>
              <button type='button' className='danger' onClick={() => setConfirmMany(true)} disabled={!selected.size}>
                {t('history.delete')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Conversation_List;
