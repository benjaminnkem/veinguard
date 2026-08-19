import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MODEL_NAMES, newId } from '@repo/persistence';
import type { Model } from 'mongoose';

interface AuditDoc {
  _id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  correlationId: string;
  ip: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(MODEL_NAMES.AuditLog) private readonly logs: Model<AuditDoc>,
  ) {}

  async record(input: {
    organizationId: string | null;
    actorUserId: string | null;
    action: string;
    correlationId: string;
    resourceType?: string | null;
    resourceId?: string | null;
    ip?: string | null;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    await this.logs.create({
      _id: newId(),
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      correlationId: input.correlationId,
      ip: input.ip ?? null,
      meta: input.meta ?? {},
      createdAt: new Date(),
    });
  }
}
