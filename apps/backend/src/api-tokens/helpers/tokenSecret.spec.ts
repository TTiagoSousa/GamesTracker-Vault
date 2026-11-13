import { generateToken, hashToken, TOKEN_PREFIX } from './tokenSecret';

describe('API token secrets', () => {
  it('generates a gtv_ token with its hash and display prefix', () => {
    const { token, tokenHash, prefix } = generateToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(token).toHaveLength(TOKEN_PREFIX.length + 40);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength(TOKEN_PREFIX.length + 6);
  });

  it('never repeats a token', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => generateToken().token),
    );
    expect(tokens.size).toBe(50);
  });
});
