import { EventsService } from './events.service';

describe('EventsService', () => {
  it('replays events after lastEventId for reconnect', () => {
    const events = new EventsService();
    events.publish('job-1', 'job.queued', { status: 'QUEUED' });
    events.publish('job-1', 'job.running', { status: 'RUNNING' });
    events.publish('job-1', 'job.succeeded', { status: 'SUCCEEDED' });
    const replayed = events.snapshot('job-1', 1);
    expect(replayed.map((item) => item.event)).toEqual([
      'job.running',
      'job.succeeded',
    ]);
  });
});
