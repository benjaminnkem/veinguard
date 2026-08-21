import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'data', 'networks', 'epa-net3', 'Net3.inp'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate the VeinGuard data directory.');
}

export function operationsSnapshotPath(): string {
  return join(repoRoot(), 'data', 'operations', 'demo-operations-v1.json');
}

export function fortyGuardFixturePath(): string {
  return join(
    repoRoot(),
    'data',
    'fixtures',
    'fortyguard',
    'heatmap-2024-07-15T14-demo-aoi-v1.json',
  );
}

export function aoiPath(): string {
  return join(repoRoot(), 'data', 'georeference', 'demo-aoi-v1.json');
}
