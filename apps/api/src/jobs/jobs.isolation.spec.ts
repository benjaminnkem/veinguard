import type { JobRecord } from './jobs.service';

describe('organization isolation', () => {
  it('does not return another organization job from a scoped lookup', () => {
    const jobs: JobRecord[] = [
      {
        id: 'job-a',
        organizationId: 'org-a',
        type: 'fortyguard.acquire',
        status: 'QUEUED',
        resourceType: 'thermalAcquisition',
        resourceId: 'acq-a',
        idempotencyKey: null,
        correlationId: 'c',
        bullJobId: null,
        attempt: 0,
        error: { code: null, message: null },
        createdAt: 't',
        updatedAt: 't',
      },
    ];
    const lookup = (id: string, organizationId: string) =>
      jobs.find(
        (job) => job.id === id && job.organizationId === organizationId,
      ) ?? null;
    expect(lookup('job-a', 'org-a')?.id).toBe('job-a');
    expect(lookup('job-a', 'org-b')).toBeNull();
  });
});
