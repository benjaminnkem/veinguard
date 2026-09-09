"use client";

import type { ChemistryId, OperationsLayer } from "@/lib/operations";
import {
  ChoiceButton,
  SideSection,
  SidebarHeader,
  SidebarRail,
} from "@/components/app-chrome";

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
  layers: Record<
    OperationsLayer,
    { label: string; group: string; chemistry?: string }
  >;
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
    return <SidebarRail label="Layers" onOpen={onToggle} />;
  }

  const grouped = new Map<string, OperationsLayer[]>();
  for (const id of groups) {
    const meta = layers[id];
    const list = grouped.get(meta.group) ?? [];
    list.push(id);
    grouped.set(meta.group, list);
  }

  return (
    <div className="flex h-full flex-col overflow-auto bg-card p-3 text-xs">
      <SidebarHeader title="Layers" onHide={onToggle} />
      <SideSection title="Overlay">
        <ToggleRow
          label="Network"
          checked={showNetwork}
          onChange={onShowNetwork}
        />
        <ToggleRow
          label="Assets"
          checked={showAssets}
          onChange={onShowAssets}
        />
      </SideSection>
      {[...grouped.entries()].map(([group, ids]) => (
        <SideSection key={group} title={group}>
          <div className="overflow-hidden border border-border">
            {ids.map((id) => {
              const meta = layers[id];
              const disabled =
                meta.chemistry === "MONOCHLORAMINE" &&
                chemistry !== "MONOCHLORAMINE";
              return (
                <ChoiceButton
                  key={id}
                  selected={quantLayer === id}
                  disabled={disabled}
                  onClick={() => onQuantLayer(id)}
                >
                  {meta.label}
                  {disabled ? " · NH2Cl" : ""}
                </ChoiceButton>
              );
            })}
          </div>
        </SideSection>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mb-1 flex cursor-pointer items-center justify-between gap-2 px-0.5 py-1">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--vg-water)]"
      />
    </label>
  );
}
