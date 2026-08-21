import { OperationsService } from './operations.service';

describe('OperationsService', () => {
  const service = new OperationsService();

  it('loads the captured FortyGuard heatmap for TCM', () => {
    const layer = service.layer('tcm', 'FREE_CHLORINE');
    expect(layer.geojson.features.length).toBe(150);
    const props = layer.geojson.features[0]?.properties as {
      average_temperature?: number;
    };
    expect(typeof props.average_temperature).toBe('number');
  });

  it('returns a pressure layer without residual arrays', () => {
    const layer = service.layer('pressure', 'FREE_CHLORINE');
    const props = layer.geojson.features[0]?.properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('pressureM');
    expect(props).not.toHaveProperty('residualMgL');
  });

  it('does not invent nitrification for free chlorine', () => {
    const layer = service.layer('nitrification', 'FREE_CHLORINE');
    expect(layer.modeled).toBe(false);
    expect(layer.geojson.features).toHaveLength(0);
  });

  it('returns inspector payload from the snapshot', () => {
    const context = service.context();
    const id = context.cards.projectedTargetBreachAssetIds[0];
    expect(id).toBeTruthy();
    const asset = service.asset(id!, 'FREE_CHLORINE') as {
      chemistryState: { projectedTargetBreach: boolean };
    };
    expect(asset.chemistryState.projectedTargetBreach).toBe(true);
  });
});
