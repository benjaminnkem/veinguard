import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { FortyGuardError } from '@repo/fortyguard';
import type { Request, Response } from 'express';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { CreateThermalAcquisitionDto } from './thermal.dto';
import { presentAcquisition } from './thermal.presenter';
import { ThermalService } from './thermal.service';

@Controller('v1/thermal/acquisitions')
export class ThermalController {
  constructor(private readonly thermal: ThermalService) {}

  @Post()
  async create(
    @Body() body: CreateThermalAcquisitionDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    try {
      const { acquisition, queued } = await this.thermal.create(
        body,
        correlationId,
      );
      response.status(queued ? 202 : 200);
      return ok(presentAcquisition(acquisition), correlationId);
    } catch (error) {
      throw toHttp(error, correlationId);
    }
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const acquisition = await this.thermal.get(id);
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
