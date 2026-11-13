import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiTokens } from '../../../Hooks/Account/useApiTokens';
import { dateLocale } from '../../../i18n';
import './Api_Tokens_Section.scss';

export const API_DOCS_URL = 'https://github.com/TTiagoSousa/GamesTracker-Vault/blob/main/docs/API.md';

// Days until the token expires; 0 = never
const EXPIRY_OPTIONS = [0, 30, 90, 365] as const;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The user's API tokens: create one (name, expiry, read-only), see it once with a copy
 * button, and the list with when each one was last used and a revoke button.
 */
const Api_Tokens_Section = () => {
  const { t } = useTranslation('settings');
  const { tokens, busy, create, revoke } = useApiTokens();
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState<number>(0);
  const [readOnly, setReadOnly] = useState(false);
  // The token just created — shown until the user closes it, never again
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && busy === null;

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    const token = await create({ name, readOnly, expiresInDays: expiry || null });
    if (token) {
      setCreated(token);
      setCopied(false);
      setName('');
      setReadOnly(false);
      setExpiry(0);
    }
  };

  const onCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      // Without clipboard access (plain http on the network) the text stays selectable
    }
  };

  return (
    <section className='Settings_Card' id='api'>
      <header className='Settings_Card_Head'>
        <h2>{t('sections.api')}</h2>
        <p>
          {t('api.description')}{' '}
          <a href={API_DOCS_URL} target='_blank' rel='noreferrer'>{t('api.docs')}</a>
        </p>
      </header>

      {/* --- New token --- */}
      <form className='Settings_Block' onSubmit={(e) => void onCreate(e)}>
        <div className='Settings_Block_Text'>
          <h3>{t('api.newTitle')}</h3>
          <p>{t('api.newDescription')}</p>
        </div>

        <div className='Api_Form'>
          <label className='Settings_Field grow'>
            <span>{t('api.name')}</span>
            <input
              type='text'
              autoComplete='off'
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t('api.namePlaceholder')}
            />
          </label>
          <label className='Settings_Field'>
            <span>{t('api.expiry')}</span>
            <select value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days ? t('api.expiryDays', { count: days }) : t('api.expiryNever')}
                </option>
              ))}
            </select>
          </label>
          <button type='submit' className='Settings_Save' disabled={!canCreate}>
            {busy === 'create' ? t('api.creating') : t('api.create')}
          </button>
        </div>

        <label className='Api_Check'>
          <input type='checkbox' checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
          <span>
            <strong>{t('api.readOnly')}</strong> {t('api.readOnlyHint')}
          </span>
        </label>

        {created && (
          <div className='Api_Created' role='status'>
            <p className='Api_Created_Title'>{t('api.createdTitle')}</p>
            <div className='Api_Created_Row'>
              <code className='Api_Token'>{created}</code>
              <button type='button' className='Api_Copy' onClick={() => void onCopy()}>
                {copied ? t('api.copied') : t('api.copy')}
              </button>
            </div>
            <p className='Api_Created_Hint'>{t('api.createdHint')}</p>
            <button type='button' className='Api_Link' onClick={() => setCreated(null)}>
              {t('api.createdDone')}
            </button>
          </div>
        )}
      </form>

      {/* --- Existing tokens --- */}
      <div className='Settings_Block'>
        <div className='Settings_Block_Text'>
          <h3>{t('api.listTitle')}</h3>
        </div>

        {tokens && tokens.length === 0 && <p className='Api_Empty'>{t('api.empty')}</p>}

        {tokens && tokens.length > 0 && (
          <ul className='Api_List'>
            {tokens.map((token) => {
              const { expired } = token;
              return (
                <li key={token.id} className='Api_Row'>
                  <div className='Api_Row_Main'>
                    <span className='Api_Row_Name'>{token.name}</span>
                    <span className='Api_Row_Meta'>
                      <code>{token.prefix}…</code>
                      <span className={`Api_Badge${token.readOnly ? '' : ' full'}`}>
                        {token.readOnly ? t('api.badgeReadOnly') : t('api.badgeFull')}
                      </span>
                      {expired && <span className='Api_Badge expired'>{t('api.badgeExpired')}</span>}
                    </span>
                    <span className='Api_Row_Dates'>
                      {t('api.createdAt', { date: formatDate(token.createdAt) })}
                      {'. '}
                      {token.lastUsedAt ? t('api.lastUsed', { date: formatDate(token.lastUsedAt) }) : t('api.neverUsed')}
                      {'. '}
                      {token.expiresAt
                        ? t(expired ? 'api.expiredAt' : 'api.expiresAt', { date: formatDate(token.expiresAt) })
                        : t('api.noExpiry')}
                    </span>
                  </div>

                  <span className='Api_Row_Actions'>
                    {confirmRevoke === token.id ? (
                      <>
                        <button
                          type='button'
                          className='Api_Danger'
                          disabled={busy !== null}
                          onClick={() => {
                            setConfirmRevoke(null);
                            void revoke(token.id);
                          }}
                        >
                          {t('api.confirmRevoke')}
                        </button>
                        <button type='button' className='Api_Link' onClick={() => setConfirmRevoke(null)}>
                          {t('common:actions.cancel')}
                        </button>
                      </>
                    ) : (
                      <button type='button' className='Api_Link danger' disabled={busy !== null} onClick={() => setConfirmRevoke(token.id)}>
                        {t('api.revoke')}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default Api_Tokens_Section;
