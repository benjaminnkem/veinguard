"use client";

import Link from "next/link";
import type { AssetDetail } from "@/lib/operations";

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
    return (
      <button type="button" className="h-full w-full text-xs" onClick={onToggle}>
        Inspector
      </button>
    );
  }
  return (
    <div className="flex h-full flex-col overflow-auto p-4 text-xs">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-water">Context inspector</p><h2 className="mt-1 text-sm font-medium">Modeled asset state</h2></div>
        <button type="button" onClick={onToggle} className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
      {!detail ? (
        <div className="border border-dashed border-white/15 bg-white/[.02] p-3 text-muted-foreground">
          Select an asset on the map. Metrics are shown only when the run calculated them.
        </div>
      ) : (
        <div className="space-y-3">
          <div><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{detail.type}</p><p className="mt-1 text-lg font-light">{detail.sourceId}</p></div>
          {detail.chemistryState?.projectedTargetBreach ? (
            <p className="border border-danger/35 bg-danger/10 px-3 py-2 text-danger">
              Projected target breach · configured operational target
            </p>
          ) : null}
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">EPA_BENCHMARK · SYNTHETIC_GEOREFERENCING</p>
          {detail.hydraulics ? (
            <section>
              <SectionTitle title="Hydraulics" />
              <Metric label="Pressure (m)" value={detail.hydraulics.pressureM} />
              <Metric label="Flow (m³/s)" value={detail.hydraulics.flowM3s} />
              <Metric label="Velocity (m/s)" value={detail.hydraulics.velocityMs} />
              <Metric label="Water age (h)" value={detail.hydraulics.waterAgeHours} />
            </section>
          ) : null}
          {detail.thermal ? (
            <section>
              <SectionTitle title="Thermal state" />
              <Metric
                label="FortyGuard cell"
                value={detail.thermal.fortyGuardCellId}
              />
              <Metric
                label="Associated air (°C)"
                value={detail.thermal.associatedAirTemperatureC}
              />
              <Metric
                label="Modeled water (°C)"
                value={detail.thermal.modeledWaterTemperatureC}
              />
            </section>
          ) : null}
          {detail.chemistryState ? (
            <section>
              <SectionTitle title="Chemistry" />
              <Metric
                label="Modeled residual (mg/L)"
                value={detail.chemistryState.residualMgL}
              />
              <Metric
                label="Configured target (mg/L)"
                value={detail.chemistryState.operationalTargetMgL}
              />
              {detail.chemistryState.freeAmmoniaMgNL != null ? (
                <Metric
                  label="Free ammonia (mg-N/L)"
                  value={detail.chemistryState.freeAmmoniaMgNL}
                />
              ) : null}
              {detail.chemistryState.nitrificationLabel ? (
                <p className="mt-1 text-muted-foreground">
                  {detail.chemistryState.nitrificationLevel}:{" "}
                  {detail.chemistryState.nitrificationLabel}
                </p>
              ) : null}
            </section>
          ) : null}
          <section>
            <SectionTitle title="Why?" />
            {detail.why && detail.why.length > 0 ? (
              <ul className="list-disc pl-4">
                {detail.why.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No modeled drivers at this sample time.
              </p>
            )}
          </section>
          <div className="flex flex-col gap-1 pt-2">
            {twinHref === null ? null : twinHref ? (
              <Link
                href={twinHref}
                className="border border-water/25 bg-water/10 px-3 py-2 text-left text-water hover:bg-water/15"
              >
                Open in Digital Twin
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="border border-white/10 px-3 py-2 text-left text-muted-foreground"
                title="Select an asset first"
              >
                Open in Digital Twin
              </button>
            )}
            <Link
              href="/intervention-lab"
              className="border border-white/10 px-3 py-2 text-left text-zinc-300 hover:border-white/25"
            >
              Create scenario
            </Link>
            <button
              type="button"
              className="border border-white/10 px-3 py-2 text-left text-zinc-300 hover:border-white/25"
              onClick={onProvenance}
            >
              View provenance
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
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display =
    value == null || value === ""
      ? "Not calculated"
      : typeof value === "number"
        ? value.toPrecision(4)
        : String(value);
  return (
    <p className="flex justify-between gap-2 border-b border-white/[.06] py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-zinc-200">{display}</span>
    </p>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-water">{title}</h3>;
}
