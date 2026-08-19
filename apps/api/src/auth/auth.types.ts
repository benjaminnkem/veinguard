import type { UserRole } from '@repo/contracts';

export interface AuthUser {
  id: string;
  organizationId: string;
  emailNormalized: string;
  displayName: string;
  role: UserRole;
}

export interface RefreshRecord {
  id: string;
  organizationId: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  replacedByHash: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface AuthPrincipal {
  userId: string;
  organizationId: string;
  role: UserRole;
}
