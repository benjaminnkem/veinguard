"use client";

import type { ChemistryId, OperationsLayer } from "@/lib/operations";

interface LayerPanelProps {
  open: boolean;
  onToggle: () => void;
  quantLayer: OperationsLayer;
  onQuantLayer: (layer: OperationsLayer) => void;
  showNetwork: boolean;
  onShowNetwork: (value: boolean) => void;
  showAssets: boolean;
  onShowAssets: (value: boolean) => void;
  chemistry: ChemistryId;
  layers: Record<OperationsLayer, { label: string; group: string; chemistry?: string }>;
  groups: OperationsLayer[];
}

export function LayerPanel({
  open,
  onToggle,
  quantLayer,
  onQuantLayer,
  showNetwork,
  onShowNetwork,
  showAssets,
  onShowAssets,
  chemistry,
  layers,
  groups,
}: LayerPanelProps) {
  if (!open) {
    return (
      <button
        type="button"
        className="h-full w-full text-xs"
        onClick={onToggle}
        aria-expanded={false}
      >
        Layers
      </button>
    );
  }
  const grouped = new Map<string, OperationsLayer[]>();
  for (const id of groups) {
    const meta = layers[id];
    const list = grouped.get(meta.group) ?? [];
    list.push(id);
    grouped.set(meta.group, list);
  }
  return (
    <div className="flex h-full flex-col overflow-auto p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Layers</h2>
        <button type="button" onClick={onToggle} className="text-muted-foreground">
          Hide
        </button>
      </div>
      <p className="mb-3 text-muted-foreground">
        One quantitative water-quality layer dominates. Network overlay is separate.
      </p>
      <label className="mb-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={showNetwork}
          onChange={(event) => onShowNetwork(event.target.checked)}
        />
        Network overlay
      </label>
      <label className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={showAssets}
          onChange={(event) => onShowAssets(event.target.checked)}
        />
        Asset markers
      </label>
      {[...grouped.entries()].map(([group, ids]) => (
        <fieldset key={group} className="mb-3">
          <legend className="mb-1 font-medium text-muted-foreground">{group}</legend>
          {ids.map((id) => {
            const meta = layers[id];
            const disabled =
              meta.chemistry === "MONOCHLORAMINE" && chemistry !== "MONOCHLORAMINE";
            return (
              <label key={id} className="mb-1 flex items-center gap-2">
                <input
                  type="radio"
                  name="quant-layer"
                  checked={quantLayer === id}
                  disabled={disabled}
                  onChange={() => onQuantLayer(id)}
                />
                <span>
                  {meta.label}
                  {disabled ? " (Monochloramine only)" : ""}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
