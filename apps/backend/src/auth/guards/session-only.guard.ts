import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';

/**
 * Only with the browser session, never with an API token — for managing the tokens
 * themselves, so a leaked token can't create others or revoke the rest. Goes after
 * JwtAuthGuard.
 */
@Injectable()
export class SessionOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    if (request.user?.authMethod === 'token') {
      throw new ForbiddenException(
        'Esta operação só está disponível com sessão iniciada no browser.',
      );
    }
    return true;
  }
}
