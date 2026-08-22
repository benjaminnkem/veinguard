export const HIGH_HEAT_C = 15;
export const RECURRENCE_MIN_COUNT = 2;

export interface StudyEvent {
  hour: string;
  status: string;
  freshness: string | null;
  cached: boolean;
  fixtureId: string | null;
  meanAirTemperatureC?: number | null;
  highHeatAssetIds: string[];
  targetBreachAssetIds: string[];
  chemistryStatus: string | null;
  persistenceAvailable: boolean;
  exceedanceAvailable: boolean;
  persistenceAssetIds: string[];
  exceedanceAssetIds: string[];
  error: { code: string | null; message: string | null } | null;
}

export function aggregateStudy(events: StudyEvent[]) {
  const requested = events.length;
  const succeeded = events.filter((event) => event.status === 'SUCCEEDED');
  const failed = events.filter((event) => event.status === 'FAILED');
  const cachedReal = events.filter(
    (event) => event.cached || event.freshness === 'CACHED_REAL',
  );
  const chemistry = events.filter(
    (event) => event.chemistryStatus === 'SUCCEEDED',
  );
  const persistenceEvents = succeeded.filter(
    (event) => event.persistenceAvailable,
  );
  const exceedanceEvents = succeeded.filter(
    (event) => event.exceedanceAvailable,
  );

  return {
    requested,
    succeeded: succeeded.length,
    failed: failed.length,
    cachedReal: cachedReal.length,
    chemistrySucceeded: chemistry.length,
    sampleSize: succeeded.length,
    recurringHighHeatAssets: countRecurring(
      succeeded.map((event) => event.highHeatAssetIds),
      succeeded.length,
    ),
    recurringTargetBreachAssets: countRecurring(
      chemistry.map((event) => event.targetBreachAssetIds),
      chemistry.length,
    ),
    persistenceAssociation: associationNote(
      persistenceEvents,
      'persistence',
      persistenceEvents.map((event) => event.persistenceAssetIds),
    ),
    exceedanceAssociation: associationNote(
      exceedanceEvents,
      'exceedance',
      exceedanceEvents.map((event) => event.exceedanceAssetIds),
    ),
    language: {
      recurrence:
        'Counts are appearances in succeeded events, not a probability or causal claim.',
      targetBreach:
        'Projected target-breach recurrence is reported only for events with a completed chemistry replay.',
      association:
        'Persistence/exceedance are associated only when that analytic was actually returned for the event.',
    },
  };
}

function countRecurring(
  sets: string[][],
  sampleSize: number,
): Array<{
  id: string;
  count: number;
  sampleSize: number;
  recurring: boolean;
}> {
  const counts = new Map<string, number>();
  for (const ids of sets) {
    for (const id of new Set(ids)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      count,
      sampleSize,
      recurring:
        sampleSize >= RECURRENCE_MIN_COUNT && count >= RECURRENCE_MIN_COUNT,
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function associationNote(
  events: StudyEvent[],
  analytic: string,
  idSets: string[][],
): {
  analytic: string;
  sampleSize: number;
  available: boolean;
  notice: string;
  overlappingAssets: Array<{ id: string; count: number }>;
} {
  if (events.length === 0) {
    return {
      analytic,
      sampleSize: 0,
      available: false,
      notice: `No succeeded events returned ${analytic}. Association is not inferred.`,
      overlappingAssets: [],
    };
  }
  const overlap = countRecurring(idSets, events.length)
    .filter((row) => row.recurring)
    .map((row) => ({ id: row.id, count: row.count }));
  return {
    analytic,
    sampleSize: events.length,
    available: true,
    notice:
      overlap.length === 0
        ? `${analytic} was returned for ${events.length} event(s). Co-occurrence with target breach is not claimed from this sample.`
        : `${analytic} co-located assets are listed by count only. This is not a causal finding.`,
    overlappingAssets: overlap,
  };
}
