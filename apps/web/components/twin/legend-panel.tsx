"use client";

import {
  ChoiceButton,
  SideSection,
  SidebarHeader,
  SidebarRail,
} from "@/components/app-chrome";
import type { TwinColorBy, TwinTrace } from "@/lib/operations";

const COLOR_OPTIONS: Array<{ id: TwinColorBy; label: string }> = [
  { id: "residual", label: "Modeled residual" },
  { id: "pressure", label: "Pressure" },
  { id: "water-age", label: "Water age" },
  { id: "water-temperature", label: "Modeled water temperature" },
  { id: "target", label: "Projected target breach" },
];

const ASSET_TYPES = [
  { shape: "●", label: "Junction" },
  { shape: "▲", label: "Reservoir" },
  { shape: "■", label: "Tank" },
  { shape: "◆", label: "Pump" },
  { shape: "✕", label: "Valve" },
] as const;

export function LegendPanel({
  open,
  onToggle,
  colorBy,
  onColorBy,
  selectedId,
  traceDirection,
  onTrace,
  onClearTrace,
  trace,
  tracePending,
  target,
}: {
  open: boolean;
  onToggle: () => void;
  colorBy: TwinColorBy;
  onColorBy: (value: TwinColorBy) => void;
  selectedId: string | null;
  traceDirection: "upstream" | "downstream" | null;
  onTrace: (direction: "upstream" | "downstream") => void;
  onClearTrace: () => void;
  trace: TwinTrace | null;
  tracePending: boolean;
  target: number | null;
}) {
  if (!open) {
    return <SidebarRail label="Legend" onOpen={onToggle} />;
  }
  return (
    <div className="flex h-full flex-col overflow-auto bg-card p-3 text-xs">
      <SidebarHeader title="Legend" onHide={onToggle} />
      <SideSection title="Color by">
        <div className="overflow-hidden border border-border">
          {COLOR_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.id}
              selected={colorBy === option.id}
              onClick={() => onColorBy(option.id)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Unknown is gray
          {target != null ? ` · target ${target} mg/L` : ""}.
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-gradient-to-r from-orange-700 to-blue-800" />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Low</span>
          <span>High</span>
        </div>
      </SideSection>
      <SideSection title="Assets">
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-muted-foreground">
          {ASSET_TYPES.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className="w-3 text-center text-foreground" aria-hidden="true">
                {item.shape}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-danger">Red outline = projected target breach</p>
      </SideSection>
      <SideSection title="Trace">
        <div className="flex overflow-hidden border border-border">
          <button
            type="button"
            disabled={!selectedId}
            className={`flex-1 px-2 py-1.5 disabled:text-muted-foreground ${
              traceDirection === "upstream" ? "bg-water/10 font-medium text-water" : ""
            }`}
            onClick={() => onTrace("upstream")}
          >
            Upstream
          </button>
          <button
            type="button"
            disabled={!selectedId}
            className={`flex-1 border-l border-border px-2 py-1.5 disabled:text-muted-foreground ${
              traceDirection === "downstream" ? "bg-water/10 font-medium text-water" : ""
            }`}
            onClick={() => onTrace("downstream")}
          >
            Downstream
          </button>
        </div>
        <button
          type="button"
          disabled={!traceDirection}
          className="mt-1 w-full px-2 py-1.5 text-left text-muted-foreground hover:text-foreground disabled:opacity-40"
          onClick={onClearTrace}
        >
          Clear
        </button>
        {tracePending ? <p className="mt-2 text-muted-foreground">Tracing…</p> : null}
        {trace ? (
          <div className="mt-2 space-y-1">
            <p>
              {trace.direction} · {trace.nodeIds.length} nodes · {trace.edgeIds.length} links
            </p>
            <p className="text-muted-foreground">{trace.notice}</p>
            {trace.supplyAssets.length > 0 ? (
              <p>
                Supply: {trace.supplyAssets.map((item) => item.id).join(", ")}
              </p>
            ) : (
              <p className="text-muted-foreground">No tank or reservoir on this path.</p>
            )}
          </div>
        ) : !selectedId ? (
          <p className="mt-2 text-muted-foreground">Select an asset to trace flow.</p>
        ) : null}
      </SideSection>
    </div>
  );
}
