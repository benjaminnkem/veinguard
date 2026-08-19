import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import type { UserRole } from '@repo/contracts';
import type { Request } from 'express';
import { readCorrelationId } from '../common/correlation';
import { authError } from './auth.errors';
import { AuthService } from './auth.service';
import type { AuthPrincipal } from './auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { auth?: AuthPrincipal }>();
    const handler = context.getHandler();
    const cls = context.getClass();
    const isPublic =
      Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
      Reflect.getMetadata(IS_PUBLIC_KEY, cls) === true;
    if (isPublic) {
      return true;
    }
    const correlationId = readCorrelationId(request);
    const token = readBearer(request) ?? readQueryToken(request);
    if (!token) {
      throw authError(
        'AUTH_INVALID_CREDENTIALS',
        'Missing bearer token.',
        correlationId,
      );
    }
    const principal = this.auth.authenticateAccess(token, correlationId);
    const roles = (Reflect.getMetadata(ROLES_KEY, handler) ??
      Reflect.getMetadata(ROLES_KEY, cls)) as UserRole[] | undefined;
    if (roles && roles.length > 0 && !roles.includes(principal.role)) {
      throw authError(
        'AUTH_FORBIDDEN',
        'Insufficient role for this action.',
        correlationId,
        403,
      );
    }
    request.auth = principal;
    return true;
  }
}

function readBearer(request: Request): string | undefined {
  const header = request.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }
  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

function readQueryToken(request: Request): string | undefined {
  const value = request.query.access_token;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
