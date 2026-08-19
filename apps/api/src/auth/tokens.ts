import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@repo/contracts';

export interface AccessClaims {
  sub: string;
  org: string;
  role: UserRole;
  typ: 'access';
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function signAccessToken(
  claims: Omit<AccessClaims, 'typ'>,
  secret: string,
  ttlSeconds: number,
): string {
  return jwt.sign({ ...claims, typ: 'access' }, secret, {
    expiresIn: ttlSeconds,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid access token.');
  }
  const record = decoded as Partial<AccessClaims>;
  if (
    record.typ !== 'access' ||
    typeof record.sub !== 'string' ||
    typeof record.org !== 'string' ||
    (record.role !== 'ADMIN' &&
      record.role !== 'OPERATOR' &&
      record.role !== 'VIEWER')
  ) {
    throw new Error('Invalid access token.');
  }
  return {
    sub: record.sub,
    org: record.org,
    role: record.role,
    typ: 'access',
  };
}
