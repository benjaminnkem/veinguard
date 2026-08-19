import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { FortyGuardError } from '@repo/fortyguard';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/auth.types';
import { Roles } from '../auth/auth.guard';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { IdempotencyService } from '../jobs/idempotency.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateThermalAcquisitionDto } from './thermal.dto';
import { presentAcquisition } from './thermal.presenter';
import { ThermalService } from './thermal.service';

@Controller('v1/thermal/acquisitions')
export class ThermalController {
  constructor(
    private readonly thermal: ThermalService,
    private readonly jobs: JobsService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  async create(
    @Body() body: CreateThermalAcquisitionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request & { auth?: AuthPrincipal },
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const principal = request.auth!;
    const requestHash = this.idempotency.requestHash(body);
    if (idempotencyKey) {
      const existing = await this.idempotency.find(
        principal.organizationId,
        idempotencyKey,
        'POST',
        '/v1/thermal/acquisitions',
      );
      if (existing) {
        this.idempotency.assertSameRequest(
          existing,
          requestHash,
          correlationId,
        );
        const acquisition = await this.thermal.get(
          existing.resourceId,
          principal.organizationId,
        );
        if (acquisition) {
          response.status(existing.statusCode);
          return ok(
            { ...presentAcquisition(acquisition), replayed: true },
            correlationId,
          );
        }
      }
    }
    try {
      const { acquisition, queued } = await this.thermal.create(
        body,
        correlationId,
        principal.organizationId,
      );
      const job = await this.jobs.create({
        organizationId: principal.organizationId,
        type: 'fortyguard.acquire',
        resourceType: 'thermalAcquisition',
        resourceId: acquisition.id,
        correlationId,
        idempotencyKey: idempotencyKey ?? null,
        status: queued ? 'QUEUED' : 'SUCCEEDED',
      });
      if (idempotencyKey) {
        await this.idempotency.remember({
          organizationId: principal.organizationId,
          key: idempotencyKey,
          method: 'POST',
          path: '/v1/thermal/acquisitions',
          requestHash,
          resourceType: 'thermalAcquisition',
          resourceId: acquisition.id,
          statusCode: queued ? 202 : 200,
        });
      }
      await this.audit.record({
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        action: 'thermal.acquisition.create',
        resourceType: 'thermalAcquisition',
        resourceId: acquisition.id,
        correlationId,
        ip: request.ip,
      });
      response.status(queued ? 202 : 200);
      return ok(
        { ...presentAcquisition(acquisition), jobId: job.id },
        correlationId,
      );
    } catch (error) {
      throw toHttp(error, correlationId);
    }
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() request: Request & { auth?: AuthPrincipal },
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const acquisition = await this.thermal.get(
      id,
      request.auth!.organizationId,
    );
    if (!acquisition) {
      response.status(404);
      return fail(
        'THERMAL_ACTIVITY_FAILED',
        'Thermal acquisition not found.',
        correlationId,
      );
    }
    return ok(presentAcquisition(acquisition), correlationId);
  }
}

function toHttp(error: unknown, correlationId: string): HttpException {
  if (error instanceof FortyGuardError) {
    const status =
      error.errorCode === 'THERMAL_REQUEST_INVALID'
        ? 400
        : error.errorCode === 'THERMAL_PROVIDER_UNAVAILABLE'
          ? 503
          : 502;
    return new HttpException(
      fail(error.errorCode, error.message, correlationId),
      status,
    );
  }
  return new HttpException(
    fail(
      'THERMAL_ACTIVITY_FAILED',
      'Thermal acquisition failed.',
      correlationId,
    ),
    500,
  );
}
