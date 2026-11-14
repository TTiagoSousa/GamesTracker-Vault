import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../Contexts/Auth_Context';
import { useAiSettings } from '../../../Hooks/Ai/useAiSettings';
import { useAssistantChat } from '../../../Hooks/Ai/useAssistantChat';
import Ai_Card from '../../../Components/Ai_Card/Ai_Card';
import Markdown from '../../../Components/Markdown/Markdown';
import Conversation_List from './Conversation_List';
import Shelf_Action_Card from './Shelf_Action_Card';
import * as Icon from '../../../Imports/icons';
import './Assistant.scss';

// Starter questions (keys in assistant:suggestions)
const SUGGESTIONS = ['next', 'similar', 'backlog', 'short', 'hidden'] as const;
// Error codes the server or the page store instead of a sentence
const ERROR_CODES = ['stopped', 'interrupted', 'network'];

/**
 * The assistant (Claude), sized exactly to the screen — the page never scrolls. On the
 * left the conversation (header with the model and "New conversation", messages with
 * their own scroll, input box at the bottom); on the right the saved conversations,
 * suggested questions and what the assistant reads. On narrow screens the saved
 * conversations open from the header, over the messages. With no saved key, the card
 * to add one takes the place of the conversation.
 *
 * Answers are written on the server: leaving the page and coming back shows the
 * answer still being written, or finished.
 */
const Assistant = () => {
  const { t } = useTranslation('assistant');
  const { username } = useAuth();
  const ai = useAiSettings();
  const chat = useAssistantChat(username);
  const { messages, streaming, send, stop } = chat;
  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Only follows the reply down if the user was already at the bottom
  const stickRef = useRef(true);
  // The scroll the page makes itself; its event arrives later and isn't the user's
  const autoScrollRef = useRef(false);

  useEffect(() => {
    const list = listRef.current;
    if (list && stickRef.current && list.scrollHeight - list.scrollTop - list.clientHeight > 1) {
      autoScrollRef.current = true;
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    if (autoScrollRef.current) {
      autoScrollRef.current = false;
      return;
    }
    stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  };

  const ask = (text: string) => {
    if (!text.trim() || streaming) return;
    stickRef.current = true;
    // If it couldn't be sent, the question goes back to the box
    void send(text).then((sent) => { if (!sent) setDraft(text); });
    setDraft('');
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a new line
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      ask(draft);
    }
  };

  const configured = Boolean(ai.settings?.configured);

  const openConversation = (id: string) => {
    stickRef.current = true;
    setHistoryOpen(false);
    void chat.open(id);
  };

  const newConversation = () => {
    setHistoryOpen(false);
    chat.reset();
    inputRef.current?.focus();
  };

  const errorText = (error: string) => (ERROR_CODES.includes(error) ? t(`errors.${error}`) : error);

  const list = (
    <Conversation_List
      conversations={chat.conversations}
      activeId={chat.activeId}
      onOpen={openConversation}
      onRemove={chat.remove}
      onRemoveMany={chat.removeMany}
    />
  );

  return (
    <div className='Assistant'>
      <section className='Assistant_Chat'>
        <header className='Assistant_Head'>
          <span className='Assistant_Head_Icon' aria-hidden='true'><Icon.Sparkle /></span>
          <div className='Assistant_Head_Text'>
            <h1>{t('title')}</h1>
            <span>{configured ? ai.settings?.model : t('side.noKey')}</span>
          </div>
          {configured && (
            <button
              type='button'
              className={`Assistant_History_Toggle${historyOpen ? ' open' : ''}`}
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              aria-label={t('history.title')}
              title={t('history.title')}
            >
              <Icon.History />
            </button>
          )}
          <button type='button' className='Assistant_New' onClick={newConversation} disabled={!messages.length || !configured}>
            <Icon.Plus />
            {t('side.newChat')}
          </button>
        </header>

        {ai.failed && <p className='Assistant_Error'>{t('errors.settings')}</p>}

        {/* No key: the card to add one, in place of the conversation */}
        {ai.settings && !configured && (
          <div className='Assistant_Setup'>
            <Ai_Card {...ai} title={t('setup.title')} />
          </div>
        )}

        {configured && historyOpen && (
          <div className='Assistant_History_Panel'>
            {list}
          </div>
        )}

        {configured && (
          <>
            <div className='Assistant_Messages' ref={listRef} onScroll={onScroll} aria-live='polite'>
              {chat.opening && messages.length === 0 ? (
                <p className='Assistant_Thinking Assistant_Opening'>{t('history.opening')}</p>
              ) : messages.length === 0 ? (
                <div className='Assistant_Intro'>
                  <span className='Assistant_Intro_Mark' aria-hidden='true'><Icon.Logo /></span>
                  <p>{t('intro')}</p>
                  <div className='Assistant_Intro_Suggestions'>
                    {SUGGESTIONS.map((key) => (
                      <button key={key} type='button' onClick={() => ask(t(`suggestions.${key}`))}>
                        {t(`suggestions.${key}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <article key={message.id} className={`Assistant_Message ${message.role}${message.pending ? ' pending' : ''}`}>
                    <span className='Assistant_Avatar' aria-hidden='true'>
                      {message.role === 'user' ? (username ?? '?').charAt(0).toUpperCase() : <Icon.Logo />}
                    </span>
                    <div className='Assistant_Bubble'>
                      {message.tools && message.tools.length > 0 && (
                        <ul className='Assistant_Tools'>
                          {message.tools.map((tool, j) => (
                            <li key={j}>
                              <Icon.Search />
                              {t(`tools.${tool.name === 'get_game' ? 'get_game' : 'search_games'}`, { query: tool.query })}
                            </li>
                          ))}
                        </ul>
                      )}
                      {message.role === 'assistant' ? (
                        message.content ? <Markdown text={message.content} /> : !message.error && <p className='Assistant_Thinking'>{t('thinking')}</p>
                      ) : (
                        <p className='Assistant_User_Text'>{message.content}</p>
                      )}
                      {message.actions.length > 0 && (
                        <div className='Assistant_Actions'>
                          {message.actions.map((action) => (
                            <Shelf_Action_Card key={action.id} action={action} onDecide={chat.decide} />
                          ))}
                        </div>
                      )}
                      {message.error && <p className='Assistant_Message_Error'>{errorText(message.error)}</p>}
                    </div>
                  </article>
                ))
              )}
            </div>

            <form className='Assistant_Composer' onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                maxLength={12000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('placeholder')}
                aria-label={t('placeholder')}
              />
              {streaming ? (
                <button type='button' className='Assistant_Stop' onClick={stop}>{t('stop')}</button>
              ) : (
                <button type='submit' className='Assistant_Send' disabled={!draft.trim()} aria-label={t('send')} title={t('send')}>
                  <Icon.Send />
                </button>
              )}
            </form>
          </>
        )}
      </section>

      {/* Right column: saved conversations, starter questions and what the assistant reads */}
      <aside className='Assistant_Side'>
        {configured && (
          <div className='Assistant_Side_Block Assistant_Side_History'>
            {list}
          </div>
        )}

        <div className='Assistant_Side_Block'>
          <h2>{t('side.suggestions')}</h2>
          <div className='Assistant_Suggestions'>
            {SUGGESTIONS.map((key) => (
              <button key={key} type='button' onClick={() => ask(t(`suggestions.${key}`))} disabled={!configured || streaming}>
                {t(`suggestions.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className='Assistant_Side_Block'>
          <h2>{t('side.privacyTitle')}</h2>
          <p>{t('side.privacy')}</p>
          <div className='Assistant_Side_Links'>
            <Link to='/Vault/Settings#assistant'>{t('side.change')}</Link>
            <Link to='/Vault/Help#claude'>{t('side.help')}</Link>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Assistant;
