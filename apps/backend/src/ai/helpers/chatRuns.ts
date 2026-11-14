import { Injectable } from '@nestjs/common';
import { ChatTool } from '../repositories/ai-chat-repository';
import { ChatEvent } from './streamChat';
import { ShelfAction } from './shelfActions';

/** What a browser following an answer receives, one JSON line at a time. */
export type RunEvent =
  | ChatEvent
  // The answer so far, sent first so a page that comes back catches up
  | {
      type: 'snapshot';
      content: string;
      tools: ChatTool[];
      actions: ShelfAction[];
      error: string | null;
    }
  | { type: 'done' };

/**
 * An answer being written. It runs on the server on its own, so leaving the page
 * (or losing the connection) doesn't stop it; any number of pages can follow it.
 */
export class ChatRun {
  content = '';
  tools: ChatTool[] = [];
  actions: ShelfAction[] = [];
  error: string | null = null;
  // The error already went out as an event (it isn't sent again at the end)
  private errorSent = false;
  readonly controller = new AbortController();
  private readonly listeners = new Set<(event: RunEvent) => void>();

  constructor(
    readonly conversationId: string,
    readonly userId: string,
    readonly messageId: number,
  ) {}

  push(event: ChatEvent) {
    if (event.type === 'text') this.content += event.text;
    else if (event.type === 'tool') {
      this.tools.push({ name: event.name, query: event.query });
    } else if (event.type === 'action') {
      this.actions.push(event.action);
    } else if (event.type === 'error') {
      this.error = event.message;
      this.errorSent = true;
    }
    this.send(event);
  }

  get sentError() {
    return this.errorSent;
  }

  snapshot(): RunEvent {
    return {
      type: 'snapshot',
      content: this.content,
      tools: this.tools,
      actions: this.actions,
      error: this.error,
    };
  }

  /** Follows the answer; returns the function that stops following. */
  subscribe(listener: (event: RunEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(event: RunEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

/** The answers being written right now, one per conversation at most. */
@Injectable()
export class ChatRuns {
  private readonly runs = new Map<string, ChatRun>();

  get(userId: string, conversationId: string): ChatRun | undefined {
    const run = this.runs.get(conversationId);
    return run && run.userId === userId ? run : undefined;
  }

  start(userId: string, conversationId: string, messageId: number) {
    const run = new ChatRun(conversationId, userId, messageId);
    this.runs.set(conversationId, run);
    return run;
  }

  /** Lets the followers know it ended, after the answer is saved. */
  end(run: ChatRun) {
    if (this.runs.get(run.conversationId) === run) {
      this.runs.delete(run.conversationId);
    }
    if (run.error && !run.sentError) {
      run.send({ type: 'error', message: run.error });
    }
    run.send({ type: 'done' });
  }
}
