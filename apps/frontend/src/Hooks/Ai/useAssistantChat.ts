import { useCallback, useEffect, useRef, useState } from 'react';
import http from '../../Service/httpService';
import { BASE_URL } from '../../config/urls';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { currentLanguage } from '../../i18n';
import { apiMessage } from '../apiMessage';

export interface ChatTool {
  name: string;
  query: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  // IGDB searches the assistant made for this answer
  tools: ChatTool[];
  // The server's message, or a code: "stopped", "interrupted", "network"
  error: string | null;
  // Still being written
  pending: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  running: boolean;
}

interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

type StreamEvent =
  | { type: 'snapshot'; content: string; tools: ChatTool[]; error: string | null }
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; query: string }
  | { type: 'error'; message: string }
  | { type: 'ping' }
  | { type: 'done' };

// If the connection drops while following an answer, tries again this many times
const RETRIES = 3;
const RETRY_MS = 1500;
// While another conversation is still being answered, the list refreshes this often
const LIST_REFRESH_MS = 4000;

const activeKey = (username: string | null) => `assistant-active:${username ?? 'anon'}`;

const readActive = (username: string | null) => {
  try {
    return localStorage.getItem(activeKey(username));
  } catch {
    return null;
  }
};

const writeActive = (username: string | null, id: string | null) => {
  try {
    if (id) localStorage.setItem(activeKey(username), id);
    else localStorage.removeItem(activeKey(username));
  } catch {
    // without localStorage, the page opens on a new conversation
  }
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

/**
 * The conversations with the assistant, kept on the server. The answer is written
 * on the server too: leaving the page doesn't stop it, and coming back picks it
 * up where it is (the stream first sends what's already written).
 */
export const useAssistantChat = (username: string | null) => {
  const { setAlert } = useAlert();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [opening, setOpening] = useState(false);
  const activeRef = useRef<string | null>(null);
  const followRef = useRef<AbortController | null>(null);

  const select = (id: string | null) => {
    activeRef.current = id;
    setActiveId(id);
    writeActive(username, id);
  };

  const refreshList = useCallback(async () => {
    try {
      const { data } = await http.get<ConversationSummary[]>(End_Points.Ai_Conversations_Endpoint());
      setConversations(data);
      return data;
    } catch {
      setConversations((previous) => previous ?? []);
      return null;
    }
  }, []);

  // Updates the last answer, only while its conversation is the one open
  const patchLast = (id: string, patch: (message: ChatMessage) => ChatMessage) => {
    if (activeRef.current !== id) return;
    setMessages((previous) => {
      const index = previous.map((m) => m.role).lastIndexOf('assistant');
      if (index < 0) return previous;
      const next = [...previous];
      next[index] = patch(next[index]);
      return next;
    });
  };

  /** Follows the answer being written in a conversation until it ends. */
  const follow = useCallback(async (id: string) => {
    followRef.current?.abort();
    const controller = new AbortController();
    followRef.current = controller;
    setStreaming(true);

    let attempt = 0;
    let finished = false;
    while (!finished && !controller.signal.aborted) {
      try {
        const response = await fetch(`${BASE_URL}${End_Points.Ai_Conversation_Stream_Endpoint(id)}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(String(response.status));
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line) continue;
            const event = JSON.parse(line) as StreamEvent;
            attempt = 0;
            if (event.type === 'snapshot') {
              patchLast(id, (m) => ({ ...m, content: event.content, tools: event.tools, error: event.error }));
            } else if (event.type === 'text') {
              patchLast(id, (m) => ({ ...m, content: m.content + event.text }));
            } else if (event.type === 'tool') {
              patchLast(id, (m) => ({ ...m, tools: [...m.tools, { name: event.name, query: event.query }] }));
            } else if (event.type === 'error') {
              patchLast(id, (m) => ({ ...m, error: event.message }));
            } else if (event.type === 'done') {
              finished = true;
            }
          }
        }
        if (!finished) throw new Error('closed');
      } catch {
        if (controller.signal.aborted) return;
        if (++attempt > RETRIES) {
          patchLast(id, (m) => ({ ...m, error: m.error ?? 'network' }));
          break;
        }
        await wait(RETRY_MS, controller.signal);
      }
    }

    if (controller.signal.aborted) return;
    followRef.current = null;
    patchLast(id, (m) => ({ ...m, pending: false }));
    setStreaming(false);
    void refreshList();
  }, [refreshList]);

  /** Opens a saved conversation and, if it's still being answered, follows it. */
  const open = useCallback(async (id: string) => {
    followRef.current?.abort();
    followRef.current = null;
    setStreaming(false);
    select(id);
    setOpening(true);
    try {
      const { data } = await http.get<Conversation>(End_Points.Ai_Conversation_Endpoint(id));
      if (activeRef.current !== id) return;
      setMessages(data.messages);
      if (data.running) void follow(id);
    } catch {
      if (activeRef.current === id) {
        select(null);
        setMessages([]);
      }
    } finally {
      setOpening(false);
    }
    // select only writes refs, state and localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow]);

  // On arriving: the list, and the conversation that was open last time
  useEffect(() => {
    let cancelled = false;
    http
      .get<ConversationSummary[]>(End_Points.Ai_Conversations_Endpoint())
      .then(({ data }) => {
        if (cancelled) return;
        setConversations(data);
        const last = readActive(username);
        if (last && data.some((c) => c.id === last)) void open(last);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
      // Leaving the page only stops following; the answer keeps going on the server
      followRef.current?.abort();
    };
  }, [username, open]);

  // Another conversation is still being answered: keep its mark in the list current
  const othersRunning = Boolean(conversations?.some((c) => c.running && c.id !== activeId));
  useEffect(() => {
    if (!othersRunning) return;
    const timer = setInterval(() => void refreshList(), LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [othersRunning, refreshList]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || streaming) return false;
    // Shown right away; replaced by the saved messages when the server answers
    const before = messages;
    setMessages([
      ...before,
      { id: -2, role: 'user', content: question, tools: [], error: null, pending: false },
      { id: -1, role: 'assistant', content: '', tools: [], error: null, pending: true },
    ]);
    setStreaming(true);
    try {
      const { data } = await http.post<{ conversation: Conversation; question: ChatMessage; answer: ChatMessage }>(
        End_Points.Ai_Chat_Endpoint(),
        { conversationId: activeRef.current ?? undefined, content: question, language: currentLanguage() },
      );
      select(data.conversation.id);
      setMessages(data.conversation.messages);
      setConversations((previous) => [
        { id: data.conversation.id, title: data.conversation.title, updatedAt: data.conversation.updatedAt, running: true },
        ...(previous ?? []).filter((c) => c.id !== data.conversation.id),
      ]);
      void follow(data.conversation.id);
      return true;
    } catch (error) {
      setMessages(before);
      setStreaming(false);
      setAlert({ open: true, message: apiMessage(error), type: 'error' });
      return false;
    }
  };

  const stop = () => {
    const id = activeRef.current;
    if (id) void http.post(End_Points.Ai_Conversation_Stop_Endpoint(id)).catch(() => undefined);
  };

  /** A new, empty conversation (it's only saved with the first question). */
  const reset = () => {
    followRef.current?.abort();
    followRef.current = null;
    setStreaming(false);
    select(null);
    setMessages([]);
  };

  const remove = async (id: string) => {
    try {
      await http.delete(End_Points.Ai_Conversation_Endpoint(id));
      setConversations((previous) => (previous ?? []).filter((c) => c.id !== id));
      if (activeRef.current === id) reset();
      return true;
    } catch (error) {
      setAlert({ open: true, message: apiMessage(error), type: 'error' });
      return false;
    }
  };

  return { conversations, activeId, messages, streaming, opening, send, stop, reset, open, remove };
};
