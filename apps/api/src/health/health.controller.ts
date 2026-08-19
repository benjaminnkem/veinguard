import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live(@Req() request: Request) {
    const correlationId = readCorrelationId(request);
    return ok(this.health.live(), correlationId);
  }

  @Get('ready')
  async ready(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const data = await this.health.ready();
    if (data.status !== 'ready') {
      response.status(503);
      return fail(
        'INTERNAL_DEPENDENCY_UNAVAILABLE',
        'API is not ready.',
        correlationId,
      );
    }
    return ok(data, correlationId);
  }
}
