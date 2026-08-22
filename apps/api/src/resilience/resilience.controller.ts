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
import type { Request, Response } from 'express';
import { Public } from '../auth/auth.guard';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { CreateResilienceStudyDto } from './resilience.dto';
import { ResilienceService } from './resilience.service';

@Public()
@Controller('v1/resilience')
export class ResilienceController {
  constructor(private readonly studies: ResilienceService) {}

  @Get('demo')
  demo(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(this.studies.context(), correlationId);
  }

  @Get('studies')
  async list(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(await this.studies.list(), correlationId);
  }

  @Post('studies')
  async create(
    @Body() body: CreateResilienceStudyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    try {
      const study = await this.studies.create(body, correlationId);
      response.status(202);
      return ok(study, correlationId);
    } catch (error) {
      throw toHttp(error, correlationId);
    }
  }

  @Get('studies/:id')
  async get(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const study = await this.studies.get(id);
    if (!study) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Study not found.', correlationId);
    }
    return ok(study, correlationId);
  }
}

function toHttp(error: unknown, correlationId: string): HttpException {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code);
    const message = error instanceof Error ? error.message : 'Request failed.';
    if (code === 'THERMAL_REQUEST_INVALID') {
      return new HttpException(
        fail('THERMAL_REQUEST_INVALID', message, correlationId),
        400,
      );
    }
  }
  if (error instanceof Error) {
    return new HttpException(
      fail('VALIDATION_FAILED', error.message, correlationId),
      400,
    );
  }
  return new HttpException(
    fail(
      'INTERNAL_DEPENDENCY_UNAVAILABLE',
      'Resilience request failed.',
      correlationId,
    ),
    500,
  );
}
