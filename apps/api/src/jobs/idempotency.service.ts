import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MODEL_NAMES, newId } from '@repo/persistence';
import { createHash } from 'node:crypto';
import type { Model } from 'mongoose';
import { authError } from '../auth/auth.errors';

interface IdempotencyDoc {
  _id: string;
  organizationId: string;
  key: string;
  method: string;
  path: string;
  requestHash: string;
  resourceType: string;
  resourceId: string;
  statusCode: number;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(MODEL_NAMES.Idempotency)
    private readonly keys: Model<IdempotencyDoc>,
  ) {}

  requestHash(body: unknown): string {
    return createHash('sha256').update(stable(body)).digest('hex');
  }

  async find(
    organizationId: string,
    key: string,
    method: string,
    path: string,
  ): Promise<IdempotencyDoc | null> {
    return this.keys.findOne({ organizationId, key, method, path }).lean();
  }

  async remember(input: {
    organizationId: string;
    key: string;
    method: string;
    path: string;
    requestHash: string;
    resourceType: string;
    resourceId: string;
    statusCode: number;
  }): Promise<void> {
    await this.keys.create({
      _id: newId(),
      ...input,
    });
  }

  assertSameRequest(
    existing: IdempotencyDoc,
    requestHash: string,
    correlationId: string,
  ): void {
    if (existing.requestHash !== requestHash) {
      throw authError(
        'VALIDATION_FAILED',
        'Idempotency-Key was reused with a different body.',
        correlationId,
        409,
      );
    }
  }
}

function stable(value: unknown): string {
  return JSON.stringify(value ?? null);
}
