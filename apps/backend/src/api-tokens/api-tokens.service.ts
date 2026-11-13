import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaApiTokenRepository } from './repositories/prisma/prisma-api-token-repository';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { createApiToken } from './helpers/createApiToken';
import { mapApiToken } from './helpers/mapApiToken';

@Injectable()
export class ApiTokensService {
  constructor(private readonly repository: PrismaApiTokenRepository) {}

  async list(userId: string) {
    const tokens = await this.repository.listByUser(userId);
    return { tokens: tokens.map(mapApiToken) };
  }

  create(userId: string, dto: CreateApiTokenDto) {
    return createApiToken(userId, dto, this.repository);
  }

  async revoke(userId: string, id: string) {
    if (!(await this.repository.delete(userId, id))) {
      throw new NotFoundException('Token não encontrado.');
    }
    return { message: 'Token revogado' };
  }
}
