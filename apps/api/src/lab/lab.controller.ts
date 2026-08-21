import {
  Body,
  Controller,
  Get,
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
import { Public } from '../auth/auth.guard';
import { CORRELATION_HEADER, readCorrelationId } from '../common/correlation';
import { fail, ok } from '../common/http';
import { AgentService } from '../agent/agent.service';
import { DEMO_ORG_ID } from './lab.constants';
import {
  CompareScenariosDto,
  CreateLabAgentDto,
  CreateScenarioDto,
} from './lab.dto';
import { LabService } from './lab.service';

@Public()
@Controller('v1/lab')
export class LabController {
  constructor(
    private readonly lab: LabService,
    private readonly agent: AgentService,
  ) {}

  @Get('demo')
  demo(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(this.lab.context(), correlationId);
  }

  @Get('scenarios')
  async list(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(await this.lab.list(), correlationId);
  }

  @Post('scenarios')
  async create(
    @Body() body: CreateScenarioDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    try {
      const scenario = await this.lab.create(body, correlationId);
      response.status(201);
      return ok(scenario, correlationId);
    } catch (error) {
      throw toHttp(error, correlationId);
    }
  }

  @Get('scenarios/:id')
  async get(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const scenario = await this.lab.get(id);
    if (!scenario) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Scenario not found.', correlationId);
    }
    return ok(scenario, correlationId);
  }

  @Post('scenarios/:id/run')
  async run(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const scenario = await this.lab.run(id, correlationId);
    if (!scenario) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Scenario not found.', correlationId);
    }
    response.status(202);
    return ok(scenario, correlationId);
  }

  @Post('scenarios/compare')
  async compare(
    @Body() body: CompareScenariosDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(await this.lab.compare(body.scenarioRunIds), correlationId);
  }

  @Post('scenarios/:id/apply')
  async apply(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    try {
      const applied = await this.lab.apply(id);
      if (!applied) {
        response.status(404);
        return fail('VALIDATION_FAILED', 'Scenario not found.', correlationId);
      }
      return ok(applied, correlationId);
    } catch (error) {
      throw toHttp(error, correlationId);
    }
  }

  @Get('applied')
  async applied(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    return ok(await this.lab.applied(), correlationId);
  }

  @Post('agent-runs')
  async startAgent(
    @Body() body: CreateLabAgentDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    try {
      const { run } = await this.lab.startAgent(
        {
          goal: body.goal,
          structuredConstraints: body.structuredConstraints,
        },
        correlationId,
      );
      response.status(202);
      return ok({ agentRunId: run.id, status: run.status }, correlationId);
    } catch (error) {
      throw toHttp(error, correlationId);
    }
  }

  @Get('agent-runs/:id')
  async agentRun(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = readCorrelationId(request);
    response.setHeader(CORRELATION_HEADER, correlationId);
    const run = await this.agent.get(id, DEMO_ORG_ID);
    if (!run) {
      response.status(404);
      return fail('VALIDATION_FAILED', 'Agent run not found.', correlationId);
    }
    return ok(
      {
        agentRunId: run.id,
        status: run.status,
        outcome: run.outcome,
        goal: run.goal,
        structuredConstraints: run.structuredConstraints,
        selectedScenarioRunId: run.selectedScenarioRunId,
        rationale: run.rationale,
        scenarioRunIds: run.scenarioRunIds,
        error: run.error,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      },
      correlationId,
    );
  }

  @Sse('agent-runs/:id/events/stream')
  eventsStream(@Param('id') id: string): Observable<MessageEvent> {
    let after = 0;
    const terminal = new Set(['COMPLETED', 'FAILED', 'LIMIT_REACHED']);
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.agent.events(id, DEMO_ORG_ID, after))),
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
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code);
    const message = error instanceof Error ? error.message : 'Request failed.';
    if (code === 'SCENARIO_INVALID_INTERVENTION') {
      return new HttpException(
        fail('SCENARIO_INVALID_INTERVENTION', message, correlationId),
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
      'Lab request failed.',
      correlationId,
    ),
    500,
  );
}
