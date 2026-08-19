import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ApiEnv } from '@repo/config';
import { QUEUE_NAMES } from '@repo/config';
import {
  FortyGuardError,
  MongoThermalStore,
  newAcquisitionId,
  planFortyGuardRequests,
  type ProductAcquisitionRequest,
  type ThermalAcquisition,
} from '@repo/fortyguard';
import type { Queue } from 'bullmq';
import { MongoClient } from 'mongodb';
import { API_ENV } from '../config/env.module';
import type { CreateThermalAcquisitionDto } from './thermal.dto';

export interface FortyGuardJobPayload {
  acquisitionId: string;
  sliceIndex: number;
}

@Injectable()
export class ThermalService implements OnModuleInit, OnModuleDestroy {
  private readonly mongo: MongoClient;
  private store!: MongoThermalStore;

  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @InjectQueue(QUEUE_NAMES.fortyguard)
    private readonly queue: Queue<FortyGuardJobPayload>,
  ) {
    this.mongo = new MongoClient(env.MONGODB_URI);
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
    this.store = new MongoThermalStore(this.mongo, this.env.MONGODB_DB_NAME);
    await this.store.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongo.close();
  }

  async create(
    dto: CreateThermalAcquisitionDto,
    correlationId: string,
  ): Promise<{
    acquisition: ThermalAcquisition;
    queued: boolean;
  }> {
    if (!this.env.FORTYGUARD_API_KEY) {
      throw new FortyGuardError(
        'UNAVAILABLE',
        'FortyGuard is not configured. Thermal acquisition is unavailable.',
      );
    }

    const product = dtoToProduct(dto);
    const plan = planFortyGuardRequests(product, {
      now: new Date(),
      maxAoiSqMi: this.env.FORTYGUARD_MAX_AOI_SQ_MI,
    });
    const hashes = plan.slices.map((slice) => slice.requestHash);
    const existing = await this.store.findActiveByHashes(hashes);
    if (existing && existing.status !== 'FAILED') {
      return { acquisition: existing, queued: existing.status !== 'SUCCEEDED' };
    }

    const now = new Date().toISOString();
    const slices = [];
    for (const planned of plan.slices) {
      const cached = await this.store.getCache(planned.requestHash);
      slices.push({
        requestHash: planned.requestHash,
        providerRequest: planned.providerRequest,
        freshness: planned.freshness,
        observationOrForecastTime: planned.observationOrForecastTime,
        activityId: cached?.activityId,
        snapshot: cached ?? undefined,
      });
    }

    const allCached = slices.every((slice) => slice.snapshot);
    const acquisition: ThermalAcquisition = {
      id: newAcquisitionId(),
      status: allCached ? 'SUCCEEDED' : 'QUEUED',
      mode: product.mode,
      productRequest: product,
      slices,
      includeSolarIrradiance: plan.includeSolarIrradiance,
      centroid: plan.centroid,
      correlationId,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.createAcquisition(acquisition);

    if (!allCached) {
      for (const [index, slice] of slices.entries()) {
        if (slice.snapshot) {
          continue;
        }
        await this.queue.add(
          'acquire',
          { acquisitionId: acquisition.id, sliceIndex: index },
          {
            jobId: `fg:${slice.requestHash}:${acquisition.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }
    }

    return { acquisition, queued: !allCached };
  }

  async get(id: string): Promise<ThermalAcquisition | null> {
    return this.store.getAcquisition(id);
  }
}

function dtoToProduct(
  dto: CreateThermalAcquisitionDto,
): ProductAcquisitionRequest {
  const analytics = dto.analytics.filter(
    (item): item is ProductAcquisitionRequest['analytics'][number] =>
      item === 'TCM' ||
      item === 'TIME_OF_MEASURE' ||
      item === 'EXCEEDANCE' ||
      item === 'PERSISTENCE',
  );
  if (analytics.length !== dto.analytics.length) {
    throw new FortyGuardError(
      'REQUEST_INVALID',
      'analytics must be TCM, TIME_OF_MEASURE, EXCEEDANCE, or PERSISTENCE.',
    );
  }
  return {
    mode: dto.mode,
    aoi: dto.aoi as unknown as ProductAcquisitionRequest['aoi'],
    time: dto.time,
    granularityMeters: dto.granularityMeters,
    analytics,
    thresholdC: dto.thresholdC,
    direction: dto.direction,
    includeSolarIrradiance: dto.includeSolarIrradiance,
  };
}
