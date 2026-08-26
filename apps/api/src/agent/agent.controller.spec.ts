import { Test, TestingModule } from '@nestjs/testing';
import { AgentError } from '@repo/agent';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../jobs/idempotency.service';
import { JobsService } from '../jobs/jobs.service';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

function mockRequest(): Request & {
  auth?: { userId: string; organizationId: string; role: 'OPERATOR' };
} {
  return {
    header: () => undefined,
    auth: { userId: 'u1', organizationId: 'org-1', role: 'OPERATOR' },
    ip: '127.0.0.1',
  } as unknown as Request & {
    auth?: { userId: string; organizationId: string; role: 'OPERATOR' };
  };
}

function mockResponse(): { response: Response; status: jest.Mock } {
  const status = jest.fn().mockReturnThis();
  return {
    status,
    response: {
      setHeader: jest.fn(),
      status,
    } as unknown as Response,
  };
}

describe('AgentController', () => {
  let controller: AgentController;
  let agent: { create: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    agent = { create: jest.fn(), get: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        { provide: AgentService, useValue: agent },
        {
          provide: JobsService,
          useValue: { create: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
        {
          provide: IdempotencyService,
          useValue: {
            requestHash: jest.fn().mockReturnValue('hash'),
            find: jest.fn().mockResolvedValue(null),
            remember: jest.fn(),
            assertSameRequest: jest.fn(),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    controller = module.get(AgentController);
  });

  it('returns 202 with agentRunId when queued', async () => {
    agent.create.mockResolvedValue({
      queued: true,
      run: { id: 'ar-1', status: 'QUEUED' },
    });
    const { response, status } = mockResponse();
    const body = await controller.create(
      {
        baselineRunId: 'base-1',
        goal: 'Protect zone-c without flushing.',
        structuredConstraints: { forbidInterventionTypes: ['FLUSH_EVENT'] },
      },
      undefined,
      mockRequest(),
      response,
    );
    expect(status).toHaveBeenCalledWith(202);
    expect(body).toMatchObject({
      data: { agentRunId: 'ar-1', status: 'QUEUED' },
    });
  });

  it('returns 503 when Gemini is unavailable', async () => {
    agent.create.mockRejectedValue(
      new AgentError(
        'UNAVAILABLE',
        'Gemini is not configured. The operations agent is unavailable.',
      ),
    );
    const { response } = mockResponse();
    await expect(
      controller.create(
        { baselineRunId: 'base-1', goal: 'inspect' },
        undefined,
        mockRequest(),
        response,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
