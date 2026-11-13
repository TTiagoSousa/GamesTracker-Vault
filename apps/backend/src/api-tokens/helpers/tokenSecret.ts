import { createHash, randomBytes } from 'crypto';

/** Every token starts with this, so it is easy to recognise (and to scan for in leaks). */
export const TOKEN_PREFIX = 'gtv_';

/** SHA-256 of the token, the only form stored in the database. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A new token: "gtv_" + 40 random URL-safe characters (240 bits), its hash and the
 * prefix shown in the list ("gtv_" + the first 6 characters).
 */
export function generateToken(): {
  token: string;
  tokenHash: string;
  prefix: string;
} {
  const token = TOKEN_PREFIX + randomBytes(30).toString('base64url');
  return {
    token,
    tokenHash: hashToken(token),
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
  };
}
