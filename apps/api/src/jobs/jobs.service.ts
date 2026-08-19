import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { RunStatus } from '@repo/contracts';
import { MODEL_NAMES, newId } from '@repo/persistence';
import type { Model } from 'mongoose';
import { EventsService } from '../events/events.service';

export interface JobRecord {
  id: string;
  organizationId: string;
  type: string;
  status: RunStatus;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string | null;
  correlationId: string;
  bullJobId: string | null;
  attempt: number;
  error: { code: string | null; message: string | null };
  createdAt: string;
  updatedAt: string;
}

interface JobDoc {
  _id: string;
  organizationId: string;
  type: string;
  status: RunStatus;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string | null;
  correlationId: string;
  bullJobId: string | null;
  attempt: number;
  error: { code: string | null; message: string | null };
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(MODEL_NAMES.Job) private readonly jobs: Model<JobDoc>,
    private readonly events: EventsService,
  ) {}

  async create(input: {
    organizationId: string;
    type: string;
    resourceType: string;
    resourceId: string;
    correlationId: string;
    idempotencyKey?: string | null;
    bullJobId?: string | null;
    status?: RunStatus;
  }): Promise<JobRecord> {
    const now = new Date();
    const created = await this.jobs.create({
      _id: newId(),
      organizationId: input.organizationId,
      type: input.type,
      status: input.status ?? 'QUEUED',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      idempotencyKey: input.idempotencyKey ?? null,
      correlationId: input.correlationId,
      bullJobId: input.bullJobId ?? null,
      attempt: 0,
      error: { code: null, message: null },
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    });
    const record = toRecord(created);
    this.events.publish(record.id, 'job.queued', {
      jobId: record.id,
      status: record.status,
      resourceId: record.resourceId,
      correlationId: record.correlationId,
    });
    return record;
  }

  async get(id: string, organizationId: string): Promise<JobRecord | null> {
    const doc = await this.jobs.findOne({ _id: id, organizationId }).lean();
    return doc ? toRecord(doc) : null;
  }

  async markStatus(
    id: string,
    organizationId: string,
    status: RunStatus,
    error?: { code: string; message: string },
  ): Promise<JobRecord | null> {
    const now = new Date();
    const doc = await this.jobs.findOneAndUpdate(
      { _id: id, organizationId },
      {
        $set: {
          status,
          updatedAt: now,
          ...(status === 'RUNNING' ? { startedAt: now } : {}),
          ...(status === 'SUCCEEDED' ||
          status === 'FAILED' ||
          status === 'CANCELLED'
            ? { completedAt: now }
            : {}),
          ...(error ? { error } : {}),
        },
        ...(status === 'RUNNING' ? { $inc: { attempt: 1 } } : {}),
      },
      { new: true },
    );
    if (!doc) {
      return null;
    }
    const record = toRecord(doc);
    this.events.publish(record.id, `job.${status.toLowerCase()}`, {
      jobId: record.id,
      status: record.status,
      resourceId: record.resourceId,
      correlationId: record.correlationId,
    });
    return record;
  }
}

function toRecord(doc: JobDoc | (JobDoc & { _id: string })): JobRecord {
  return {
    id: doc._id,
    organizationId: doc.organizationId,
    type: doc.type,
    status: doc.status,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    idempotencyKey: doc.idempotencyKey,
    correlationId: doc.correlationId,
    bullJobId: doc.bullJobId,
    attempt: doc.attempt,
    error: doc.error,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
