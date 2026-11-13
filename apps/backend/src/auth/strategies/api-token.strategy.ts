import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { PrismaApiTokenRepository } from 'src/api-tokens/repositories/prisma/prisma-api-token-repository';
import { TOKEN_PREFIX, hashToken } from 'src/api-tokens/helpers/tokenSecret';

// lastUsedAt is written at most once a minute per token, not on every request
const TOUCH_EVERY_MS = 60_000;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * API tokens (Authorization: Bearer gtv_…), for other programs. The request acts as
 * the token's owner, with the role they have now in the database — like the session,
 * a role change or a deleted account takes effect at once.
 */
@Injectable()
export class ApiTokenStrategy extends PassportStrategy(Strategy, 'api-token') {
  constructor(
    private readonly tokens: PrismaApiTokenRepository,
    private readonly users: PrismaUserRepository,
  ) {
    super({ passReqToCallback: true });
  }

  async validate(req: Request, token: string): Promise<JwtPayload | false> {
    // Only from the header: passport-http-bearer also reads ?access_token=, which would
    // leave the token in proxy and server logs.
    if (!req.headers.authorization?.startsWith('Bearer ')) return false;
    if (!token.startsWith(TOKEN_PREFIX)) return false;

    const saved = await this.tokens.findByHash(hashToken(token));
    if (!saved) throw new UnauthorizedException('Token inválido');
    if (saved.expiresAt && saved.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Token expirado');
    }
    if (saved.readOnly && !READ_METHODS.has(req.method)) {
      throw new ForbiddenException('Este token só permite leitura.');
    }

    const user = await this.users.findById(saved.userId);
    if (!user) throw new UnauthorizedException('Token inválido');

    const now = new Date();
    if (
      !saved.lastUsedAt ||
      now.getTime() - saved.lastUsedAt.getTime() > TOUCH_EVERY_MS
    ) {
      void this.tokens.touch(saved.id, now).catch(() => undefined);
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      authMethod: 'token',
    };
  }
}
