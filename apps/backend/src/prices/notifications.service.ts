import { Injectable } from '@nestjs/common';
import { Notification } from 'src/generated/prisma/client/client';
import { PrismaApiTokenRepository } from 'src/api-tokens/repositories/prisma/prisma-api-token-repository';
import { createApiToken } from 'src/api-tokens/helpers/createApiToken';
import { PricesRepository } from './repositories/prices-repository';

const mapNotification = (n: Notification) => ({
  id: n.id,
  kind: n.kind,
  gameId: n.gameId,
  read: n.readAt !== null,
  createdAt: n.createdAt,
  ...(n.data as Record<string, unknown>),
});

/** The user's notifications (price alerts), for the site and the Android app. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: PricesRepository,
    private readonly tokens: PrismaApiTokenRepository,
  ) {}

  async list(userId: string, after = 0, limit = 30) {
    const [items, unread, latestId] = await Promise.all([
      this.repository.notifications(userId, after, limit),
      this.repository.unread(userId),
      this.repository.latestId(userId),
    ]);
    return { items: items.map(mapNotification), unread, latestId };
  }

  async unread(userId: string) {
    return { unread: await this.repository.unread(userId) };
  }

  async markRead(userId: string, ids?: number[]) {
    await this.repository.markRead(userId, ids);
    return this.unread(userId);
  }

  async clear(userId: string) {
    await this.repository.clearNotifications(userId);
    return { unread: 0 };
  }

  /**
   * A phone that wants alerts: a read-only token only it keeps, to ask for new
   * notifications in the background. It shows in Settings → API like any other token,
   * where it can be revoked. Starts after the latest notification, so the phone doesn't
   * get the old ones all at once.
   */
  async addDevice(userId: string) {
    const created = await createApiToken(
      userId,
      { name: 'Android — avisos de preço', readOnly: true },
      this.tokens,
    );
    return {
      token: created.token,
      tokenId: created.id,
      latestId: await this.repository.latestId(userId),
    };
  }
}
