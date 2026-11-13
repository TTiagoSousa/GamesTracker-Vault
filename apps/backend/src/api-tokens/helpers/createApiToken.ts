import { PrismaApiTokenRepository } from '../repositories/prisma/prisma-api-token-repository';
import { CreateApiTokenDto } from '../dto/create-api-token.dto';
import { generateToken } from './tokenSecret';
import { mapApiToken } from './mapApiToken';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a token for the user. The response is the only time the token itself is
 * returned: afterwards only its prefix is known.
 */
export async function createApiToken(
  userId: string,
  dto: CreateApiTokenDto,
  repository: PrismaApiTokenRepository,
) {
  const { token, tokenHash, prefix } = generateToken();
  const expiresAt = dto.expiresInDays
    ? new Date(Date.now() + dto.expiresInDays * DAY_MS)
    : null;
  const saved = await repository.create({
    userId,
    name: dto.name.trim(),
    tokenHash,
    prefix,
    readOnly: dto.readOnly ?? false,
    expiresAt,
  });
  return { ...mapApiToken(saved), token };
}
