import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

export function readCorrelationId(request: Request): string {
  const existing = request.header(CORRELATION_HEADER);
  return existing && existing.trim().length > 0
    ? existing.trim()
    : randomUUID();
}

export function correlationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const correlationId = readCorrelationId(request);
  request.headers[CORRELATION_HEADER] = correlationId;
  response.setHeader(CORRELATION_HEADER, correlationId);
  next();
}
