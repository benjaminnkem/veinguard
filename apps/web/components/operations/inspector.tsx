"use client";

import Link from "next/link";
import type { AssetDetail } from "@/lib/operations";
import { SidebarHeader, SidebarRail } from "@/components/app-chrome";

interface InspectorProps {
  open: boolean;
  onToggle: () => void;
  detail: AssetDetail | null;
  onProvenance: () => void;
  twinHref?: string | null;
}

export function Inspector({
  open,
  onToggle,
  detail,
  onProvenance,
  twinHref,
}: InspectorProps) {
  if (!open) {
    return <SidebarRail label="Inspector" onOpen={onToggle} />;
  }
  return (
    <div className="flex h-full flex-col overflow-auto bg-card p-3 text-xs">
      <SidebarHeader title="Inspector" onHide={onToggle} />
      {!detail ? (
        <p className="border border-dashed border-border bg-muted/60 px-3 py-3 text-muted-foreground">
          Select an asset. Metrics appear only when the run calculated them.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {detail.type}
            </p>
            <p className="mt-0.5 text-lg font-light tracking-tight">{detail.sourceId}</p>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">
              EPA_BENCHMARK · SYNTHETIC_GEOREFERENCING
            </p>
          </div>
          {detail.chemistryState?.projectedTargetBreach ? (
            <p className="border border-danger/35 bg-danger/10 px-3 py-2 text-danger">
              Projected target breach
            </p>
          ) : null}
          {detail.hydraulics ? (
            <section>
              <SectionTitle title="Hydraulics" />
              <Metric label="Pressure" value={detail.hydraulics.pressureM} unit="m" />
              <Metric label="Flow" value={detail.hydraulics.flowM3s} unit="m³/s" />
              <Metric label="Velocity" value={detail.hydraulics.velocityMs} unit="m/s" />
              <Metric label="Water age" value={detail.hydraulics.waterAgeHours} unit="h" />
            </section>
          ) : null}
          {detail.thermal ? (
            <section>
              <SectionTitle title="Thermal" />
              <Metric label="FortyGuard cell" value={detail.thermal.fortyGuardCellId} />
              <Metric
                label="Associated air"
                value={detail.thermal.associatedAirTemperatureC}
                unit="°C"
              />
              <Metric
                label="Modeled water"
                value={detail.thermal.modeledWaterTemperatureC}
                unit="°C"
              />
            </section>
          ) : null}
          {detail.chemistryState ? (
            <section>
              <SectionTitle title="Chemistry" />
              <Metric
                label="Modeled residual"
                value={detail.chemistryState.residualMgL}
                unit="mg/L"
              />
              <Metric
                label="Configured target"
                value={detail.chemistryState.operationalTargetMgL}
                unit="mg/L"
              />
              {detail.chemistryState.freeAmmoniaMgNL != null ? (
                <Metric
                  label="Free ammonia"
                  value={detail.chemistryState.freeAmmoniaMgNL}
                  unit="mg-N/L"
                />
              ) : null}
              {detail.chemistryState.nitrificationLabel ? (
                <p className="mt-1.5 text-muted-foreground">
                  {detail.chemistryState.nitrificationLevel}:{" "}
                  {detail.chemistryState.nitrificationLabel}
                </p>
              ) : null}
            </section>
          ) : null}
          <section>
            <SectionTitle title="Why?" />
            {detail.why && detail.why.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-[12px]">
                {detail.why.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No modeled drivers at this sample time.</p>
            )}
          </section>
          <div className="flex flex-col gap-1.5 pt-1">
            {twinHref === null ? null : twinHref ? (
              <Link
                href={twinHref}
                className="border border-water/30 bg-water/10 px-3 py-2 text-left text-water hover:bg-water/15"
              >
                Open in Digital Twin
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="border border-border px-3 py-2 text-left text-muted-foreground"
                title="Select an asset first"
              >
                Open in Digital Twin
              </button>
            )}
            <Link
              href="/intervention-lab"
              className="border border-border px-3 py-2 text-left hover:bg-muted"
            >
              Create scenario
            </Link>
            <button
              type="button"
              className="border border-border px-3 py-2 text-left hover:bg-muted"
              onClick={onProvenance}
            >
              Provenance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  const display =
    value == null || value === ""
      ? "Not calculated"
      : typeof value === "number"
        ? `${value.toPrecision(4)}${unit ? ` ${unit}` : ""}`
        : String(value);
  return (
    <p className="flex justify-between gap-2 border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{display}</span>
    </p>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
      {title}
    </h3>
  );
}
