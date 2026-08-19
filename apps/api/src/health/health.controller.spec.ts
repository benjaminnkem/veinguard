import { Test, TestingModule } from '@nestjs/testing';
import type { HealthReadyData } from '@repo/contracts';
import type { Request, Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

function mockRequest(): Request {
  return {
    header: () => undefined,
  } as unknown as Request;
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

describe('HealthController', () => {
  let controller: HealthController;
  let health: { live: jest.Mock; ready: jest.Mock };

  beforeEach(async () => {
    health = {
      live: jest
        .fn()
        .mockReturnValue({ status: 'ok', service: 'veinguard-api' }),
      ready: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: health }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns live status', () => {
    const body = controller.live(mockRequest());
    expect(body.data.status).toBe('ok');
    expect(body.data.service).toBe('veinguard-api');
    expect(body.meta.correlationId).toBeTruthy();
  });

  it('returns ready when dependencies are up', async () => {
    const ready: HealthReadyData = {
      status: 'ready',
      service: 'veinguard-api',
      checks: [
        { name: 'mongo', status: 'up' },
        { name: 'redis', status: 'up' },
      ],
    };
    health.ready.mockResolvedValue(ready);

    const { response } = mockResponse();
    const body = await controller.ready(mockRequest(), response);
    expect('data' in body).toBe(true);
    if ('data' in body) {
      expect(body.data.status).toBe('ready');
    }
  });

  it('returns 503 envelope when dependencies are down', async () => {
    health.ready.mockResolvedValue({
      status: 'not_ready',
      service: 'veinguard-api',
      checks: [{ name: 'mongo', status: 'down' }],
    });
    const { response, status } = mockResponse();

    const body = await controller.ready(mockRequest(), response);
    expect(status).toHaveBeenCalledWith(503);
    expect('error' in body).toBe(true);
    if ('error' in body) {
      expect(body.error.code).toBe('INTERNAL_DEPENDENCY_UNAVAILABLE');
    }
  });
});
