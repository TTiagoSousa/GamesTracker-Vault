import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AiMessage, AiMessageRole } from 'src/generated/prisma/client/client';
import { GamesService } from 'src/games/games.service';
import { PrismaLibraryRepository } from 'src/library/repositories/prisma/prisma-library-repository';
import { AiSettingsRepository } from './repositories/ai-settings-repository';
import { AiChatRepository, ChatTool } from './repositories/ai-chat-repository';
import { ChatDto, SaveAiSettingsDto } from './dto/ai.dto';
import {
  getAiSettings,
  listAiModels,
  saveAiSettings,
  savedApiKey,
} from './helpers/aiSettings';
import { streamChat } from './helpers/streamChat';
import { ChatRun, ChatRuns } from './helpers/chatRuns';
import {
  applyError,
  applyShelfAction,
  ShelfAction,
} from './helpers/shelfActions';

// How many previous messages go with each question
const HISTORY = 40;
// Conversations shown in the list
const CONVERSATIONS = 100;
const TITLE_LENGTH = 80;
// While an answer is written, what's new is saved this often
const SAVE_EVERY_MS = 3000;

const titleFrom = (question: string) => {
  const line = question.replace(/\s+/g, ' ').trim();
  return line.length > TITLE_LENGTH
    ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
    : line;
};

// What the model reads about the shelf changes it proposed in an earlier answer
const STATE_NOTE: Record<ShelfAction['state'], string> = {
  pending: 'not decided yet',
  done: 'confirmed and applied',
  dismissed: 'dismissed by the user',
  failed: 'failed',
};

const describeActions = (actions: ShelfAction[]) =>
  actions.length
    ? `

[Shelf changes proposed in this answer: ${actions
        .map(
          (a) =>
            `${a.gameName} (id ${a.gameId}) ${a.kind === 'remove' ? 'remove' : JSON.stringify(a.change)} — ${STATE_NOTE[a.state]}`,
        )
        .join('; ')}]`
    : '';

const actionsOf = (m: AiMessage) => (m.actions as ShelfAction[] | null) ?? [];

const errorMessage = (error: unknown) =>
  error instanceof HttpException
    ? String(
        (error.getResponse() as { message?: string }).message ?? error.message,
      )
    : 'O assistente falhou a responder. Tenta outra vez.';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly settings: AiSettingsRepository,
    private readonly chats: AiChatRepository,
    private readonly runs: ChatRuns,
    private readonly library: PrismaLibraryRepository,
    private readonly games: GamesService,
  ) {}

  // Answers that were being written when the server stopped won't finish
  async onModuleInit() {
    // Not a reason to keep the app from starting (the database may still be coming up)
    await this.chats
      .interruptPending()
      .catch((error) =>
        this.logger.warn(`Could not mark unfinished answers: ${String(error)}`),
      );
  }

  getSettings(userId: string) {
    return getAiSettings(userId, this.settings);
  }

  saveSettings(userId: string, dto: SaveAiSettingsDto) {
    return saveAiSettings(userId, dto, this.settings);
  }

  async removeSettings(userId: string) {
    await this.settings.remove(userId);
    return getAiSettings(userId, this.settings);
  }

  models(userId: string, apiKey?: string) {
    return listAiModels(userId, apiKey, this.settings);
  }

  // --- Conversations ----------------------------------------------------------------

  async conversations(userId: string) {
    const list = await this.chats.listConversations(userId, CONVERSATIONS);
    return list.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      running: Boolean(this.runs.get(userId, c.id)),
    }));
  }

  async conversation(userId: string, id: string) {
    const found = await this.chats.findConversation(userId, id);
    if (!found) throw new NotFoundException('Conversa não encontrada');
    const run = this.runs.get(userId, id);
    return {
      id: found.id,
      title: found.title,
      updatedAt: found.updatedAt,
      running: Boolean(run),
      messages: found.messages.map((m) => this.mapMessage(m, run)),
    };
  }

  async removeConversation(userId: string, id: string) {
    this.runs.get(userId, id)?.controller.abort();
    if (!(await this.chats.deleteConversation(userId, id))) {
      throw new NotFoundException('Conversa não encontrada');
    }
    return { message: 'Conversa apagada' };
  }

  async removeConversations(userId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    for (const id of unique) this.runs.get(userId, id)?.controller.abort();
    const deleted = await this.chats.deleteConversations(userId, unique);
    return { deleted };
  }

  /**
   * The user's answer to a proposed shelf change: "confirm" applies it, "dismiss"
   * only records it. Works while the answer is still being written, too.
   */
  async decide(
    userId: string,
    conversationId: string,
    actionId: string,
    decision: 'confirm' | 'dismiss',
  ) {
    let messageId: number;
    let actions: ShelfAction[];
    const run = this.runs.get(userId, conversationId);
    if (run?.actions.some((a) => a.id === actionId)) {
      messageId = run.messageId;
      actions = run.actions;
    } else {
      const found = await this.chats.findConversation(userId, conversationId);
      if (!found) throw new NotFoundException('Conversa não encontrada');
      const message = found.messages.find((m) =>
        actionsOf(m).some((a) => a.id === actionId),
      );
      if (!message) throw new NotFoundException('Proposta não encontrada');
      messageId = message.id;
      actions = actionsOf(message);
    }

    const action = actions.find((a) => a.id === actionId)!;
    if (action.state !== 'pending') {
      throw new ConflictException('Esta proposta já foi decidida.');
    }
    // Marked at once so a second click doesn't apply it twice
    action.state = decision === 'confirm' ? 'done' : 'dismissed';
    if (decision === 'confirm') {
      try {
        await applyShelfAction(userId, action, this.library, this.games);
      } catch (error) {
        action.state = 'failed';
        action.error = applyError(error);
      }
    }
    await this.chats.saveActions(messageId, actions).catch((error) => {
      this.logger.debug(`Decision not saved: ${String(error)}`);
    });
    return { action };
  }

  stop(userId: string, id: string) {
    this.runs.get(userId, id)?.controller.abort();
    return { message: 'Resposta parada' };
  }

  /**
   * A question: saves it with an empty answer and starts writing the answer on the
   * server, without waiting. The page follows it with `follow`.
   */
  async ask(user: { id: string; username: string }, dto: ChatDto) {
    // No key (or no conversation) is an error right away, before anything is saved
    const { apiKey, model } = await savedApiKey(user.id, this.settings);

    let previous: AiMessage[] = [];
    let conversationId: string;
    if (dto.conversationId) {
      const found = await this.chats.findConversation(
        user.id,
        dto.conversationId,
      );
      if (!found) throw new NotFoundException('Conversa não encontrada');
      if (this.runs.get(user.id, found.id)) {
        throw new ConflictException(
          'O assistente ainda está a responder nesta conversa.',
        );
      }
      previous = found.messages;
      conversationId = found.id;
    } else {
      const created = await this.chats.createConversation(
        user.id,
        titleFrom(dto.content),
      );
      conversationId = created.id;
    }

    const question = dto.content.trim();
    // Only messages with text and no error go to the model
    const history = [
      ...previous
        .filter((m) => m.content.trim() && !m.error && !m.pending)
        .map((m) => ({
          role:
            m.role === AiMessageRole.USER
              ? ('user' as const)
              : ('assistant' as const),
          content: m.content + describeActions(actionsOf(m)),
        })),
      { role: 'user' as const, content: question },
    ].slice(-HISTORY);
    // The history has to start with a question
    while (history.length && history[0].role !== 'user') history.shift();

    const turn = await this.chats.addTurn(conversationId, question);
    const run = this.runs.start(user.id, conversationId, turn.answer.id);

    void this.write(run, {
      apiKey,
      model,
      userId: user.id,
      username: user.username,
      language: dto.language ?? 'pt-PT',
      history,
    });

    return {
      conversation: await this.conversation(user.id, conversationId),
      question: this.mapMessage(turn.question),
      answer: this.mapMessage(turn.answer, run),
    };
  }

  /**
   * Follows an answer: first what's written so far, then each new chunk, until it
   * ends. If nothing is being written, sends the last answer as it was saved.
   */
  async follow(
    userId: string,
    id: string,
    emit: Parameters<ChatRun['subscribe']>[0],
  ): Promise<(() => void) | null> {
    const run = this.runs.get(userId, id);
    if (run) {
      emit(run.snapshot());
      const off = run.subscribe(emit);
      return () => {
        off();
      };
    }
    const found = await this.chats.findConversation(userId, id);
    if (!found) throw new NotFoundException('Conversa não encontrada');
    const last = [...found.messages]
      .reverse()
      .find((m) => m.role === AiMessageRole.ASSISTANT);
    if (last) {
      const message = this.mapMessage(last);
      emit({
        type: 'snapshot',
        content: message.content,
        tools: message.tools,
        actions: message.actions,
        error: message.error,
      });
    }
    emit({ type: 'done' });
    return null;
  }

  private async write(
    run: ChatRun,
    args: Omit<
      Parameters<typeof streamChat>[0],
      'signal' | 'emit' | 'library' | 'games'
    >,
  ) {
    let saved = '';
    let savedActions = 0;
    const progress = setInterval(() => {
      if (run.content === saved && run.actions.length === savedActions) return;
      saved = run.content;
      savedActions = run.actions.length;
      this.chats
        .saveProgress(run.messageId, saved, run.actions)
        .catch(() => undefined);
    }, SAVE_EVERY_MS);
    try {
      await streamChat({
        ...args,
        signal: run.controller.signal,
        emit: (event) => run.push(event),
        library: this.library,
        games: this.games,
      });
    } catch (error) {
      if (run.controller.signal.aborted) {
        // Stopped: what was already written stays
        if (!run.content) run.error = 'stopped';
      } else {
        run.error = errorMessage(error);
      }
    }
    clearInterval(progress);
    try {
      await this.chats.finishAnswer(run.messageId, {
        content: run.content,
        tools: run.tools,
        actions: run.actions,
        error: run.error,
      });
    } catch (error) {
      // The conversation was deleted meanwhile
      this.logger.debug(`Answer not saved: ${String(error)}`);
    }
    this.runs.end(run);
  }

  private mapMessage(m: AiMessage, run?: ChatRun) {
    const live = run && run.messageId === m.id ? run : undefined;
    return {
      id: m.id,
      role: m.role === AiMessageRole.USER ? 'user' : 'assistant',
      content: live ? live.content : m.content,
      tools: live ? live.tools : ((m.tools as ChatTool[] | null) ?? []),
      actions: live ? live.actions : actionsOf(m),
      error: live ? live.error : m.error,
      pending: Boolean(live),
    };
  }
}
