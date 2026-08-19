import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  Observable,
  distinctUntilChanged,
  filter,
  from,
  interval,
  map,
  startWith,
  switchMap,
  takeWhile,
} from 'rxjs';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import type { AuthPrincipal } from '../auth/auth.types';
import { JobsService } from './jobs.service';

@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() request: Request & { auth?: AuthPrincipal },
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const job = await this.jobs.get(id, request.auth!.organizationId);
    if (!job) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Job not found.', correlationId);
    }
    return ok(job, correlationId);
  }

  @Sse(':id/events')
  eventsStream(
    @Param('id') id: string,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Observable<MessageEvent> {
    const organizationId = request.auth!.organizationId;
    const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);
    let sequence = 0;
    return interval(1500).pipe(
      startWith(0),
      switchMap(() => from(this.jobs.get(id, organizationId))),
      filter((job): job is NonNullable<typeof job> => job !== null),
      distinctUntilChanged(
        (left, right) =>
          left.status === right.status && left.updatedAt === right.updatedAt,
      ),
      map((job) => {
        sequence += 1;
        return {
          id: String(sequence),
          type: `job.${job.status.toLowerCase()}`,
          data: {
            jobId: job.id,
            status: job.status,
            resourceId: job.resourceId,
            correlationId: job.correlationId,
          },
        } satisfies MessageEvent;
      }),
      takeWhile((event) => {
        const status = (event.data as { status?: string }).status;
        return !status || !terminal.has(status);
      }, true),
    );
  }
}
