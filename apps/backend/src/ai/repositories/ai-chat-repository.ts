import { Injectable } from '@nestjs/common';
import {
  AiConversation,
  AiMessage,
  AiMessageRole,
  Prisma,
} from 'src/generated/prisma/client/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShelfAction } from '../helpers/shelfActions';

export interface ChatTool {
  name: string;
  query: string;
}

// A list as a Json column: empty lists are stored as NULL
const json = (list: unknown[]) =>
  list.length ? (list as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

/** Each user's conversations with the assistant and their messages. */
@Injectable()
export class AiChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  listConversations(userId: string, take: number): Promise<AiConversation[]> {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  findConversation(
    userId: string,
    id: string,
  ): Promise<(AiConversation & { messages: AiMessage[] }) | null> {
    return this.prisma.aiConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { id: 'asc' } } },
    });
  }

  createConversation(userId: string, title: string): Promise<AiConversation> {
    return this.prisma.aiConversation.create({ data: { userId, title } });
  }

  /** The question and the (empty, pending) answer, and the conversation moves to the top. */
  async addTurn(
    conversationId: string,
    question: string,
  ): Promise<{ question: AiMessage; answer: AiMessage }> {
    return this.prisma.$transaction(async (tx) => {
      const userMessage = await tx.aiMessage.create({
        data: { conversationId, role: AiMessageRole.USER, content: question },
      });
      const answer = await tx.aiMessage.create({
        data: {
          conversationId,
          role: AiMessageRole.ASSISTANT,
          pending: true,
        },
      });
      await tx.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return { question: userMessage, answer };
    });
  }

  finishAnswer(
    id: number,
    data: {
      content: string;
      tools: ChatTool[];
      actions: ShelfAction[];
      error: string | null;
    },
  ): Promise<AiMessage> {
    return this.prisma.aiMessage.update({
      where: { id },
      data: {
        content: data.content,
        tools: json(data.tools),
        actions: json(data.actions),
        error: data.error,
        pending: false,
      },
    });
  }

  /** What's written so far, so a restart doesn't lose it (the answer stays pending). */
  async saveProgress(
    id: number,
    content: string,
    actions: ShelfAction[],
  ): Promise<void> {
    await this.prisma.aiMessage.updateMany({
      where: { id, pending: true },
      data: { content, actions: json(actions) },
    });
  }

  /** The proposed shelf changes of a message, after the user decided one. */
  async saveActions(id: number, actions: ShelfAction[]): Promise<void> {
    await this.prisma.aiMessage.update({
      where: { id },
      data: { actions: json(actions) },
    });
  }

  /** Answers left half-written when the server stopped (after a restart). */
  async interruptPending(): Promise<void> {
    await this.prisma.aiMessage.updateMany({
      where: { pending: true },
      data: { pending: false, error: 'interrupted' },
    });
  }

  async deleteConversation(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.aiConversation.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }

  /** Deletes several at once; returns how many were this user's. */
  async deleteConversations(userId: string, ids: string[]): Promise<number> {
    const { count } = await this.prisma.aiConversation.deleteMany({
      where: { id: { in: ids }, userId },
    });
    return count;
  }
}
