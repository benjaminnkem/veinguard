import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SseEnvelope {
  id: number;
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  private sequences = new Map<string, number>();
  private history = new Map<string, SseEnvelope[]>();
  private subjects = new Map<string, Subject<SseEnvelope>>();

  publish(
    jobId: string,
    event: string,
    data: Record<string, unknown>,
  ): SseEnvelope {
    const next = (this.sequences.get(jobId) ?? 0) + 1;
    this.sequences.set(jobId, next);
    const envelope: SseEnvelope = { id: next, event, data };
    const list = this.history.get(jobId) ?? [];
    list.push(envelope);
    this.history.set(jobId, list.slice(-100));
    this.subjects.get(jobId)?.next(envelope);
    return envelope;
  }

  subscribe(jobId: string, lastEventId?: number): Subject<SseEnvelope> {
    const existing = this.subjects.get(jobId);
    if (existing) {
      return existing;
    }
    const subject = new Subject<SseEnvelope>();
    this.subjects.set(jobId, subject);
    const replay = this.history.get(jobId) ?? [];
    queueMicrotask(() => {
      for (const item of replay) {
        if (lastEventId === undefined || item.id > lastEventId) {
          subject.next(item);
        }
      }
    });
    return subject;
  }

  snapshot(jobId: string, lastEventId?: number): SseEnvelope[] {
    const replay = this.history.get(jobId) ?? [];
    return replay.filter(
      (item) => lastEventId === undefined || item.id > lastEventId,
    );
  }
}
