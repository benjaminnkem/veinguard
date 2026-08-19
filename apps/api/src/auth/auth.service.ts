import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@repo/config';
import { MODEL_NAMES, newId, normalizeEmail } from '@repo/persistence';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { API_ENV } from '../config/env.module';
import { authError } from './auth.errors';
import { hashPassword, verifyPassword } from './password';
import {
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens';
import type { AuthPrincipal, AuthUser } from './auth.types';

interface OrgDoc {
  _id: string;
  name: string;
  slug: string;
}
interface UserDoc {
  _id: string;
  organizationId: string;
  emailNormalized: string;
  passwordHash: string;
  displayName: string;
  role: AuthUser['role'];
}
interface RefreshDoc {
  _id: string;
  organizationId: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  replacedByHash: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @InjectModel(MODEL_NAMES.Organization)
    private readonly orgs: Model<OrgDoc>,
    @InjectModel(MODEL_NAMES.User) private readonly users: Model<UserDoc>,
    @InjectModel(MODEL_NAMES.RefreshToken)
    private readonly refreshTokens: Model<RefreshDoc>,
  ) {}

  async login(
    email: string,
    password: string,
    correlationId: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.users.findOne({ emailNormalized }).lean();
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'Email or password is incorrect.',
        correlationId,
      );
    }
    return this.issueSession(user);
  }

  async refresh(
    refreshToken: string,
    correlationId: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const presentedHash = hashRefreshToken(refreshToken);
    const existing = await this.refreshTokens.findOne({
      tokenHash: presentedHash,
    });
    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt.getTime() < Date.now()
    ) {
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'Refresh token is invalid.',
        correlationId,
      );
    }
    if (existing.replacedByHash) {
      await this.refreshTokens.updateMany(
        { familyId: existing.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'Refresh token reuse detected.',
        correlationId,
      );
    }
    const user = await this.users.findById(existing.userId).lean();
    if (!user) {
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'Refresh token is invalid.',
        correlationId,
      );
    }
    const nextToken = newRefreshToken();
    const nextHash = hashRefreshToken(nextToken);
    existing.replacedByHash = nextHash;
    existing.revokedAt = new Date();
    await existing.save();
    await this.refreshTokens.create({
      _id: newId(),
      organizationId: user.organizationId,
      userId: user._id,
      familyId: existing.familyId,
      tokenHash: nextHash,
      replacedByHash: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + this.env.JWT_REFRESH_TTL_SECONDS * 1000),
    });
    return {
      accessToken: signAccessToken(
        { sub: user._id, org: user.organizationId, role: user.role },
        this.env.JWT_ACCESS_SECRET,
        this.env.JWT_ACCESS_TTL_SECONDS,
      ),
      refreshToken: nextToken,
      user: toPublic(user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const presentedHash = hashRefreshToken(refreshToken);
    const existing = await this.refreshTokens.findOne({
      tokenHash: presentedHash,
    });
    if (!existing) {
      return;
    }
    await this.refreshTokens.updateMany(
      { familyId: existing.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  authenticateAccess(token: string, correlationId: string): AuthPrincipal {
    try {
      const claims = verifyAccessToken(token, this.env.JWT_ACCESS_SECRET);
      return {
        userId: claims.sub,
        organizationId: claims.org,
        role: claims.role,
      };
    } catch {
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'Access token is invalid.',
        correlationId,
      );
    }
  }

  async me(principal: AuthPrincipal, correlationId: string): Promise<AuthUser> {
    const user = await this.users
      .findOne({
        _id: principal.userId,
        organizationId: principal.organizationId,
      })
      .lean();
    if (!user) {
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'User not found.',
        correlationId,
      );
    }
    return toPublic(user);
  }

  private async issueSession(user: UserDoc) {
    const refreshToken = newRefreshToken();
    await this.refreshTokens.create({
      _id: newId(),
      organizationId: user.organizationId,
      userId: user._id,
      familyId: newId(),
      tokenHash: hashRefreshToken(refreshToken),
      replacedByHash: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + this.env.JWT_REFRESH_TTL_SECONDS * 1000),
    });
    return {
      accessToken: signAccessToken(
        { sub: user._id, org: user.organizationId, role: user.role },
        this.env.JWT_ACCESS_SECRET,
        this.env.JWT_ACCESS_TTL_SECONDS,
      ),
      refreshToken,
      user: toPublic(user),
    };
  }
}

function toPublic(user: UserDoc): AuthUser {
  return {
    id: user._id,
    organizationId: user.organizationId,
    emailNormalized: user.emailNormalized,
    displayName: user.displayName,
    role: user.role,
  };
}

export { hashPassword };
