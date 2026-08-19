import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ApiEnv } from '@repo/config';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { correlationMiddleware } from './common/correlation';
import { EnvelopeExceptionFilter } from './common/http-exception.filter';
import { API_ENV } from './config/env.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<ApiEnv>(API_ENV);

  app.use(helmet());
  app.use(json({ limit: '2mb' }));
  app.use(correlationMiddleware);
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new EnvelopeExceptionFilter());

  const openapi = new DocumentBuilder()
    .setTitle('VeinGuard API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openapi);
  SwaggerModule.setup('docs', app, document);
  app
    .getHttpAdapter()
    .get(
      '/v1/openapi.json',
      (_req: unknown, res: { json: (body: unknown) => void }) => {
        res.json(document);
      },
    );

  await app.listen(env.PORT);
}

void bootstrap();
