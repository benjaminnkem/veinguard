import { OperationsService } from './operations.service';
import { traceTwin } from './operations.twin';

describe('digital twin graph', () => {
  const service = new OperationsService();

  it('projects EPA Net3 topology with pumps as nodes', () => {
    const twin = service.twin('FREE_CHLORINE');
    expect(twin.sourceType).toBe('EPA_BENCHMARK');
    expect(twin.geoReferenceType).toBe('SYNTHETIC_GEOREFERENCING');
    expect(twin.counts.junctions).toBe(92);
    expect(twin.counts.tanks).toBe(3);
    expect(twin.counts.reservoirs).toBe(2);
    expect(twin.counts.pumps).toBe(2);
    expect(twin.counts.valves).toBe(0);
    expect(twin.nodes.find((node) => node.id === 'PU-10')?.type).toBe('PUMP');
    expect(twin.edges.filter((edge) => edge.parentId === 'PU-10')).toHaveLength(
      2,
    );
    expect(twin.editing.topologyEditable).toBe(false);
    expect(twin.scenario.afterAvailable).toBe(false);
  });

  it('uses monochloramine residual when that profile is selected', () => {
    const free = service.twin('FREE_CHLORINE');
    const mono = service.twin('MONOCHLORAMINE');
    const freeNode = free.nodes.find((node) => node.id === 'J-601');
    const monoNode = mono.nodes.find((node) => node.id === 'J-601');
    expect(freeNode?.projectedTargetBreach).toBe(true);
    expect(freeNode?.residualMgL).toBe(0);
    expect(monoNode?.projectedTargetBreach).toBe(true);
    expect(monoNode?.residualMgL).not.toBe(freeNode?.residualMgL);
    expect(monoNode?.nitrificationLevel).toBe('HIGH');
    expect(freeNode?.nitrificationLevel).toBeNull();
  });

  it('traces upstream of J-10 along modeled flow to Lake reservoir', () => {
    const trace = service.twinTrace('J-10', 'upstream');
    expect(trace).toBeTruthy();
    expect(trace!.nodeIds).toEqual(
      expect.arrayContaining(['J-10', 'PU-10', 'R-Lake']),
    );
    expect(trace!.supplyAssets.map((item) => item.id)).toContain('R-Lake');
    expect(trace!.edgeIds.length).toBeGreaterThan(0);
  });

  it('does not invent a path when modeled flow is near zero', () => {
    const trace = service.twinTrace('J-601', 'upstream');
    expect(trace).toBeTruthy();
    expect(trace!.nodeIds).toEqual(['J-601']);
    expect(trace!.edgeIds).toEqual([]);
    expect(trace!.notice).toMatch(/does not invent/);
  });

  it('follows negative EPANET flow sign, not link from/to', () => {
    const graph = service.twin('FREE_CHLORINE');
    const pipe = graph.edges.find((edge) => edge.id === 'P-20');
    expect(pipe).toBeTruthy();
    expect((pipe!.flowM3s ?? 0) < 0).toBe(true);
    const downstream = traceTwin(graph, 'P-20', 'downstream');
    expect(downstream).toBeTruthy();
    expect(downstream!.nodeIds).toContain('T-3');
    expect(downstream!.nodeIds).not.toContain('J-20');
  });
});
