import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { ok } from '../common/http';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './auth.dto';
import { Public } from './auth.guard';
import type { AuthPrincipal } from './auth.types';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    try {
      const session = await this.auth.login(
        body.email,
        body.password,
        correlationId,
      );
      await this.audit.record({
        organizationId: session.user.organizationId,
        actorUserId: session.user.id,
        action: 'auth.login',
        correlationId,
        ip: request.ip,
      });
      return ok(session, correlationId);
    } catch (error) {
      await this.audit.record({
        organizationId: null,
        actorUserId: null,
        action: 'auth.login_failed',
        correlationId,
        ip: request.ip,
        meta: { email: body.email },
      });
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const session = await this.auth.refresh(body.refreshToken, correlationId);
    return ok(session, correlationId);
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() body: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    await this.auth.logout(body.refreshToken);
    await this.audit.record({
      organizationId: null,
      actorUserId: null,
      action: 'auth.logout',
      correlationId,
      ip: request.ip,
    });
    return ok({ loggedOut: true }, correlationId);
  }

  @Get('me')
  async me(
    @Req() request: Request & { auth?: AuthPrincipal },
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const user = await this.auth.me(request.auth!, correlationId);
    return ok(user, correlationId);
  }
}
