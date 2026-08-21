import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/auth.guard';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { OperationsService } from './operations.service';
import { LAYER_IDS } from './operations.layers';
import type { TraceDirection } from './operations.twin';
import type { ChemistryId, OperationsLayer } from './operations.types';

@Public()
@Controller('v1/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('demo')
  demo(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(this.operations.context(), correlationId);
  }

  @Get('demo/layers/:layer')
  layer(
    @Param('layer') layer: string,
    @Query('chemistry') chemistry: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    if (!isLayer(layer)) {
      response.status(400);
      return fail(
        'VALIDATION_FAILED',
        `Unknown layer '${layer}'.`,
        correlationId,
      );
    }
    const profile = parseChemistry(chemistry);
    if (!profile) {
      response.status(400);
      return fail(
        'VALIDATION_FAILED',
        'chemistry must be FREE_CHLORINE or MONOCHLORAMINE.',
        correlationId,
      );
    }
    return ok(this.operations.layer(layer, profile), correlationId);
  }

  @Get('demo/twin')
  twin(
    @Query('chemistry') chemistry: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const profile = parseChemistry(chemistry);
    if (!profile) {
      response.status(400);
      return fail(
        'VALIDATION_FAILED',
        'chemistry must be FREE_CHLORINE or MONOCHLORAMINE.',
        correlationId,
      );
    }
    return ok(this.operations.twin(profile), correlationId);
  }

  @Get('demo/twin/trace')
  twinTrace(
    @Query('asset') asset: string | undefined,
    @Query('direction') direction: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    if (!asset) {
      response.status(400);
      return fail('VALIDATION_FAILED', 'asset is required.', correlationId);
    }
    if (!isTraceDirection(direction)) {
      response.status(400);
      return fail(
        'VALIDATION_FAILED',
        'direction must be upstream or downstream.',
        correlationId,
      );
    }
    const trace = this.operations.twinTrace(asset, direction);
    if (!trace) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Asset not found.', correlationId);
    }
    return ok(trace, correlationId);
  }

  @Get('demo/assets/:id')
  asset(
    @Param('id') id: string,
    @Query('chemistry') chemistry: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const profile = parseChemistry(chemistry);
    if (!profile) {
      response.status(400);
      return fail(
        'VALIDATION_FAILED',
        'chemistry must be FREE_CHLORINE or MONOCHLORAMINE.',
        correlationId,
      );
    }
    const asset = this.operations.asset(id, profile);
    if (!asset) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Asset not found.', correlationId);
    }
    return ok(asset, correlationId);
  }

  @Get('demo/provenance')
  provenance(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(this.operations.provenance(), correlationId);
  }
}

function isLayer(value: string): value is OperationsLayer {
  return (LAYER_IDS as string[]).includes(value);
}

function isTraceDirection(value: string | undefined): value is TraceDirection {
  return value === 'upstream' || value === 'downstream';
}

function parseChemistry(value: string | undefined): ChemistryId | null {
  if (value == null || value === '') {
    return 'FREE_CHLORINE';
  }
  if (value === 'FREE_CHLORINE' || value === 'MONOCHLORAMINE') {
    return value;
  }
  return null;
}
