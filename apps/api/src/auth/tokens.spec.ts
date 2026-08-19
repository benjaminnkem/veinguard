import { hashRefreshToken, signAccessToken, verifyAccessToken } from './tokens';

describe('access tokens', () => {
  const secret = 'test-access-secret-key';

  it('round-trips claims', () => {
    const token = signAccessToken(
      { sub: 'user-1', org: 'org-1', role: 'OPERATOR' },
      secret,
      60,
    );
    const claims = verifyAccessToken(token, secret);
    expect(claims.sub).toBe('user-1');
    expect(claims.org).toBe('org-1');
    expect(claims.role).toBe('OPERATOR');
    expect(claims.typ).toBe('access');
  });

  it('rejects a token signed with another secret', () => {
    const token = signAccessToken(
      { sub: 'user-1', org: 'org-1', role: 'VIEWER' },
      secret,
      60,
    );
    expect(() => verifyAccessToken(token, 'other-secret-value')).toThrow();
  });
});

describe('refresh token hashing', () => {
  it('is deterministic and not reversible by equality to plaintext', () => {
    const token = 'refresh-token-value';
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });
});
