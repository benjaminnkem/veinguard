import { aggregateStudy, type StudyEvent } from './resilience.aggregate';

function event(partial: Partial<StudyEvent>): StudyEvent {
  return {
    hour: '2024-07-15T14:00:00.000Z',
    status: 'SUCCEEDED',
    freshness: 'CACHED_REAL',
    cached: true,
    fixtureId: 'heatmap-2024-07-15T14-demo-aoi-v1',
    meanAirTemperatureC: 32,
    highHeatAssetIds: [],
    targetBreachAssetIds: [],
    chemistryStatus: 'SUCCEEDED',
    persistenceAvailable: false,
    exceedanceAvailable: false,
    persistenceAssetIds: [],
    exceedanceAssetIds: [],
    error: null,
    ...partial,
  };
}

describe('resilience aggregation', () => {
  it('does not call a single appearance recurrence', () => {
    const result = aggregateStudy([
      event({ highHeatAssetIds: ['J-601'], targetBreachAssetIds: ['J-601'] }),
    ]);
    expect(result.sampleSize).toBe(1);
    expect(result.recurringTargetBreachAssets[0]).toMatchObject({
      id: 'J-601',
      count: 1,
      recurring: false,
    });
  });

  it('counts failed events without filling them in', () => {
    const result = aggregateStudy([
      event({ status: 'SUCCEEDED', highHeatAssetIds: ['J-10'] }),
      event({
        hour: '2024-07-16T14:00:00.000Z',
        status: 'FAILED',
        cached: false,
        freshness: null,
        fixtureId: null,
        chemistryStatus: null,
        error: { code: 'THERMAL_PROVIDER_UNAVAILABLE', message: 'down' },
      }),
    ]);
    expect(result.requested).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.sampleSize).toBe(1);
  });

  it('does not invent persistence association when the analytic is missing', () => {
    const result = aggregateStudy([event({})]);
    expect(result.persistenceAssociation.available).toBe(false);
    expect(result.exceedanceAssociation.available).toBe(false);
  });

  it('marks recurrence only with sample size >= 2', () => {
    const result = aggregateStudy([
      event({ targetBreachAssetIds: ['J-601'] }),
      event({
        hour: '2024-07-16T14:00:00.000Z',
        targetBreachAssetIds: ['J-601', 'J-10'],
      }),
    ]);
    const row = result.recurringTargetBreachAssets.find(
      (item) => item.id === 'J-601',
    );
    expect(row?.count).toBe(2);
    expect(row?.recurring).toBe(true);
    expect(row?.sampleSize).toBe(2);
  });
});
