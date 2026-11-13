import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiToken } from 'src/generated/prisma/client/client';
import { ApiTokenRepository } from '../api-token-repository';

// Only the token's hash arrives here — the token itself never reaches the database
@Injectable()
export class PrismaApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    name: string;
    tokenHash: string;
    prefix: string;
    readOnly: boolean;
    expiresAt: Date | null;
  }): Promise<ApiToken> {
    return this.prisma.apiToken.create({ data });
  }

  listByUser(userId: string): Promise<ApiToken[]> {
    return this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByHash(tokenHash: string): Promise<ApiToken | null> {
    return this.prisma.apiToken.findUnique({ where: { tokenHash } });
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.prisma.apiToken.update({
      where: { id },
      data: { lastUsedAt: at },
    });
  }

  // Scoped to the owner: a user can only revoke their own tokens
  async delete(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.apiToken.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  }
}
