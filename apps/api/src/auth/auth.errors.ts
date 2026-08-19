import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@repo/contracts';
import { fail } from '../common/http';

export function authError(
  code: ErrorCode,
  message: string,
  correlationId: string,
  status = 401,
): HttpException {
  return new HttpException(fail(code, message, correlationId), status);
}
