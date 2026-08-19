import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  MessageEvent,
  Param,
  Post,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import { AgentError } from '@repo/agent';
import type { Request, Response } from 'express';
import {
  Observable,
  from,
  interval,
  startWith,
  switchMap,
  takeWhile,
} from 'rxjs';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/auth.types';
import { Roles } from '../auth/auth.guard';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { IdempotencyService } from '../jobs/idempotency.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateAgentRunDto } from './agent.dto';
import { AgentService } from './agent.service';

@Controller('v1/agent-runs')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly jobs: JobsService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  async create(
    @Body() body: CreateAgentRunDto,
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
        '/v1/agent-runs',
      );
      if (existing) {
        this.idempotency.assertSameRequest(
          existing,
          requestHash,
          correlationId,
        );
        const run = await this.agent.get(
          existing.resourceId,
          principal.organizationId,
        );
        if (run) {
          response.status(existing.statusCode);
          return ok(
            {
              agentRunId: run.id,
              status: run.status,
              replayed: true,
            },
            correlationId,
          );
        }
      }
    }
    try {
      const { run } = await this.agent.create({
        organizationId: principal.organizationId,
        baselineRunId: body.baselineRunId,
        goal: body.goal,
        structuredConstraints: body.structuredConstraints,
        baselineSummary: body.baselineSummary,
        correlationId,
      });
      const job = await this.jobs.create({
        organizationId: principal.organizationId,
        type: 'agent.run',
        resourceType: 'agentRun',
        resourceId: run.id,
        correlationId,
        idempotencyKey: idempotencyKey ?? null,
        status: 'QUEUED',
      });
      if (idempotencyKey) {
        await this.idempotency.remember({
          organizationId: principal.organizationId,
          key: idempotencyKey,
          method: 'POST',
          path: '/v1/agent-runs',
          requestHash,
          resourceType: 'agentRun',
          resourceId: run.id,
          statusCode: 202,
        });
      }
      await this.audit.record({
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        action: 'agent.run.create',
        resourceType: 'agentRun',
        resourceId: run.id,
        correlationId,
        ip: request.ip,
      });
      response.status(202);
      return ok(
        { agentRunId: run.id, status: run.status, jobId: job.id },
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
    const run = await this.agent.get(id, request.auth!.organizationId);
    if (!run) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Agent run not found.', correlationId);
    }
    return ok(presentRun(run), correlationId);
  }

  @Sse(':id/events/stream')
  eventsStream(
    @Param('id') id: string,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Observable<MessageEvent> {
    const organizationId = request.auth!.organizationId;
    let after = 0;
    const terminal = new Set(['COMPLETED', 'FAILED', 'LIMIT_REACHED']);
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.agent.events(id, organizationId, after))),
      switchMap((events) => {
        if (events.length > 0) {
          after = events[events.length - 1]!.sequence;
        }
        return from(
          events.map(
            (event) =>
              ({
                id: String(event.sequence),
                type: `agent.${event.type.toLowerCase()}`,
                data: {
                  agentRunId: event.agentRunId,
                  sequence: event.sequence,
                  type: event.type,
                  timestamp: event.timestamp,
                  displayMessage: event.displayMessage,
                  toolName: event.toolName ?? null,
                  scenarioRunId: event.scenarioRunId ?? null,
                  resultSummary: event.resultSummary ?? null,
                },
              }) satisfies MessageEvent,
          ),
        );
      }),
      takeWhile((event) => {
        const type = (event.data as { type?: string }).type;
        return !type || !terminal.has(type);
      }, true),
    );
  }
}

function presentRun(run: {
  id: string;
  status: string;
  outcome: string | null;
  goal: string;
  structuredConstraints: unknown;
  baselineRunId: string;
  modelId: string;
  selectedScenarioRunId: string | null;
  rationale: string | null;
  scenarioRunIds: string[];
  correlationId: string;
  error: { code: string | null; message: string | null };
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}) {
  return {
    agentRunId: run.id,
    status: run.status,
    outcome: run.outcome,
    goal: run.goal,
    structuredConstraints: run.structuredConstraints,
    baselineRunId: run.baselineRunId,
    modelId: run.modelId,
    selectedScenarioRunId: run.selectedScenarioRunId,
    rationale: run.rationale,
    scenarioRunIds: run.scenarioRunIds,
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  };
}

function toHttp(error: unknown, correlationId: string): HttpException {
  if (error instanceof AgentError) {
    const status =
      error.errorCode === 'AGENT_UNAVAILABLE'
        ? 503
        : error.errorCode === 'AGENT_LIMIT_REACHED'
          ? 429
          : 400;
    return new HttpException(
      fail(error.errorCode, error.message, correlationId),
      status,
    );
  }
  return new HttpException(
    fail('AGENT_UNAVAILABLE', 'Agent run failed.', correlationId),
    500,
  );
}
