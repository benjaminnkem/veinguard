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
    <div className="flex h-full flex-col overflow-auto p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Inspector</h2>
        <button type="button" onClick={onToggle} className="text-muted-foreground">
          Hide
        </button>
      </div>
      {!detail ? (
        <p className="text-muted-foreground">
          Select an asset on the map. Metrics are shown only when the run calculated them.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            {detail.type} {detail.sourceId}
          </p>
          {detail.chemistryState?.projectedTargetBreach ? (
            <p className="rounded bg-red-950/40 px-2 py-1 text-red-200">
              Projected target breach · configured operational target
            </p>
          ) : null}
          <p className="text-muted-foreground">EPA benchmark network</p>
          {detail.hydraulics ? (
            <section>
              <h3 className="font-medium">Hydraulics</h3>
              <Metric label="Pressure (m)" value={detail.hydraulics.pressureM} />
              <Metric label="Flow (m³/s)" value={detail.hydraulics.flowM3s} />
              <Metric label="Velocity (m/s)" value={detail.hydraulics.velocityMs} />
              <Metric label="Water age (h)" value={detail.hydraulics.waterAgeHours} />
            </section>
          ) : null}
          {detail.thermal ? (
            <section>
              <h3 className="font-medium">Thermal</h3>
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
              <h3 className="font-medium">Chemistry</h3>
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
            <h3 className="font-medium">Why?</h3>
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
                className="rounded border border-border px-2 py-1 text-left"
              >
                Open in Digital Twin
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded border border-border px-2 py-1 text-left text-muted-foreground"
                title="Select an asset first"
              >
                Open in Digital Twin
              </button>
            )}
            <Link
              href="/intervention-lab"
              className="rounded border border-border px-2 py-1 text-left"
            >
              Create scenario
            </Link>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-left"
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
    <p className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{display}</span>
    </p>
  );
}
