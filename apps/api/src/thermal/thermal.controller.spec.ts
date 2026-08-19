import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { ThermalController } from './thermal.controller';
import { ThermalService } from './thermal.service';

function mockRequest(): Request {
  return { header: () => undefined } as unknown as Request;
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

describe('ThermalController', () => {
  let controller: ThermalController;
  let thermal: { create: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    thermal = { create: jest.fn(), get: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThermalController],
      providers: [{ provide: ThermalService, useValue: thermal }],
    }).compile();
    controller = module.get(ThermalController);
  });

  it('returns 202 when work is queued', async () => {
    thermal.create.mockResolvedValue({
      queued: true,
      acquisition: {
        id: 'acq-1',
        status: 'QUEUED',
        mode: 'HISTORICAL',
        productRequest: {},
        slices: [],
        includeSolarIrradiance: false,
        correlationId: 'c',
        createdAt: 't',
        updatedAt: 't',
      },
    });
    const { response, status } = mockResponse();
    const body = await controller.create(
      {
        mode: 'HISTORICAL',
        aoi: { type: 'FeatureCollection', features: [] },
        time: { start: '2024-07-15T14:00:00Z', end: '2024-07-15T15:00:00Z' },
        granularityMeters: 100,
        analytics: ['TCM'],
      },
      mockRequest(),
      response,
    );
    expect(status).toHaveBeenCalledWith(202);
    expect('data' in body).toBe(true);
    if ('data' in body) {
      expect(body.data.acquisitionId).toBe('acq-1');
      expect(body.data.status).toBe('QUEUED');
    }
  });

  it('returns 200 for a completed cache hit', async () => {
    thermal.create.mockResolvedValue({
      queued: false,
      acquisition: {
        id: 'acq-2',
        status: 'SUCCEEDED',
        mode: 'HISTORICAL',
        productRequest: {},
        slices: [
          {
            requestHash: 'abc',
            providerRequest: {},
            freshness: 'HISTORICAL',
            observationOrForecastTime: '2024-07-15T14:00:00.000Z',
            snapshot: {
              originalFreshness: 'HISTORICAL',
              fetchedAt: '2026-01-01T00:00:00.000Z',
              mapGeoJson: { type: 'FeatureCollection', features: [] },
              stats: { units: '°C' },
              endpoint: '/v1/heatmap',
            },
          },
        ],
        includeSolarIrradiance: false,
        correlationId: 'c',
        createdAt: 't',
        updatedAt: 't',
      },
    });
    const { response, status } = mockResponse();
    const body = await controller.create(
      {
        mode: 'HISTORICAL',
        aoi: { type: 'FeatureCollection', features: [] },
        time: { start: '2024-07-15T14:00:00Z', end: '2024-07-15T15:00:00Z' },
        granularityMeters: 100,
        analytics: ['TCM'],
      },
      mockRequest(),
      response,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect('data' in body).toBe(true);
    if ('data' in body) {
      expect(body.data.freshness).toBe('CACHED_REAL');
    }
  });
});
