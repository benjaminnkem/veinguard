import type { ApiErrorBody, ApiSuccessBody, ErrorCode } from '@repo/contracts';

export function ok<T>(data: T, correlationId: string): ApiSuccessBody<T> {
  return {
    data,
    meta: { correlationId },
  };
}

export function fail(
  code: ErrorCode,
  message: string,
  correlationId: string,
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      correlationId,
    },
  };
}
