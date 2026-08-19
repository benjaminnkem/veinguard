import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { correlationMiddleware } from '../src/common/correlation';

function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/veinguard-test';
  process.env.MONGODB_DB_NAME = 'veinguard-test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  process.env.SIMULATION_SERVICE_BASE_URL = 'http://localhost:8000';
  process.env.SIMULATION_SERVICE_TOKEN = 'test-simulation-token';
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    applyTestEnv();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(correlationMiddleware);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    const liveBody = response.body as {
      data: { status: string; service: string };
      meta: { correlationId: string };
    };
    expect(liveBody.data.status).toBe('ok');
    expect(liveBody.data.service).toBe('veinguard-api');
    expect(liveBody.meta.correlationId).toBeTruthy();
    expect(response.headers['x-correlation-id']).toBeTruthy();
  });

  it('GET /health/ready returns 200 or 503 envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect([200, 503]).toContain(response.status);
    if (response.status === 200) {
      const readyBody = response.body as { data: { status: string } };
      expect(readyBody.data.status).toBe('ready');
    } else {
      const errorBody = response.body as { error: { code: string } };
      expect(errorBody.error.code).toBe('INTERNAL_DEPENDENCY_UNAVAILABLE');
    }
  });
});
