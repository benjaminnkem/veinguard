import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readCorrelationId } from './correlation';
import { fail } from './http';

@Catch()
export class EnvelopeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = readCorrelationId(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        response.status(status).json(body);
        return;
      }
      const message =
        typeof body === 'string' ? body : 'Request validation failed.';
      response
        .status(status)
        .json(
          fail(
            status === 401 ? 'AUTH_INVALID_CREDENTIALS' : 'VALIDATION_FAILED',
            message,
            correlationId,
          ),
        );
      return;
    }
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(fail('THERMAL_ACTIVITY_FAILED', 'Internal error.', correlationId));
  }
}
