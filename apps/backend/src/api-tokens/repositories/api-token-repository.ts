import { ApiToken } from 'src/generated/prisma/client/client';

export interface ApiTokenRepository {
  create(data: {
    userId: string;
    name: string;
    tokenHash: string;
    prefix: string;
    readOnly: boolean;
    expiresAt: Date | null;
  }): Promise<ApiToken>;
  listByUser(userId: string): Promise<ApiToken[]>;
  findByHash(tokenHash: string): Promise<ApiToken | null>;
  touch(id: string, at: Date): Promise<void>;
  delete(userId: string, id: string): Promise<boolean>;
}
