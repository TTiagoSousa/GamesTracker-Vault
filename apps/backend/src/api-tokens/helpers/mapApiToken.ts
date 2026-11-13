import { ApiToken } from 'src/generated/prisma/client/client';

/** What the API returns about a token — never its hash. */
export function mapApiToken(token: ApiToken) {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    readOnly: token.readOnly,
    expiresAt: token.expiresAt,
    expired:
      token.expiresAt !== null && token.expiresAt.getTime() <= Date.now(),
    lastUsedAt: token.lastUsedAt,
    createdAt: token.createdAt,
  };
}

export type ApiTokenView = ReturnType<typeof mapApiToken>;
