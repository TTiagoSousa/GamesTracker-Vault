import { BadRequestException } from '@nestjs/common';
import { IntegrationProvider } from 'src/generated/prisma/client/client';
import { decryptToken, encryptToken } from 'src/utils/crypto/token-cipher';
import { itad } from 'src/prices/providers/itad.client';
import { PrismaIntegrationRepository } from '../repositories/prisma/prisma-integration-repository';

/**
 * The IsThereAnyDeal key for Admin: whether there is one and its last 4 characters —
 * like the IGDB secret, the key itself never goes back to the browser.
 */
export async function getItadStatus(repository: PrismaIntegrationRepository) {
  const row = await repository.find(IntegrationProvider.ITAD);
  if (!row) {
    return {
      configured: false,
      unreadable: false,
      keyHint: null,
      updatedAt: null,
    };
  }
  let keyHint: string | null = null;
  try {
    keyHint = decryptToken(row.secret).slice(-4);
  } catch {
    keyHint = null;
  }
  return {
    configured: true,
    unreadable: keyHint === null,
    keyHint,
    updatedAt: row.updatedAt,
  };
}

/** Saves the key once IsThereAnyDeal accepts it — a wrong key never replaces a good one. */
export async function saveItadKey(
  key: string,
  repository: PrismaIntegrationRepository,
) {
  const result = await itad.testKey(key);
  if (result === 'unreachable') {
    throw new BadRequestException(
      'Não foi possível contactar a IsThereAnyDeal para validar a chave.',
    );
  }
  if (result === 'rejected') {
    throw new BadRequestException(
      'A IsThereAnyDeal rejeitou a chave — confirma que copiaste a API key da tua app.',
    );
  }
  await repository.save({
    provider: IntegrationProvider.ITAD,
    clientId: '',
    secret: encryptToken(key),
  });
  return getItadStatus(repository);
}

export async function testItadKey(repository: PrismaIntegrationRepository) {
  const row = await repository.find(IntegrationProvider.ITAD);
  if (!row) return { ok: false, reason: 'not-configured' as const };
  let key: string;
  try {
    key = decryptToken(row.secret);
  } catch {
    return { ok: false, reason: 'unreadable' as const };
  }
  const result = await itad.testKey(key);
  return result === 'ok' ? { ok: true } : { ok: false, reason: result };
}
