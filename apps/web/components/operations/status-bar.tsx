"use client";

import type { ChemistryId, OperationsContext } from "@/lib/operations";

export function StatusBar({
  context,
  chemistry,
}: {
  context: OperationsContext | null;
  chemistry: ChemistryId;
}) {
  if (!context) {
    return (
      <div className="border-b border-border bg-card px-4 py-2 text-[11px] text-muted-foreground">
        Loading context…
      </div>
    );
  }
  const items = [
    { label: "Network", value: context.network.name, extra: context.network.sourceType },
    {
      label: "Geography",
      value: context.network.geoReferenceType.replaceAll("_", " "),
    },
    { label: "Thermal", value: context.thermal.freshness },
    {
      label: "Chemistry",
      value: chemistry === "FREE_CHLORINE" ? "Free Chlorine" : "Monochloramine",
    },
    { label: "Simulation", value: context.simulation.status },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border bg-card px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
      {items.map((item) => (
        <p key={item.label}>
          <span className="text-muted-foreground">{item.label}: </span>
          <span className="font-medium text-foreground">{item.value}</span>
          {item.extra ? (
            <span className="text-muted-foreground"> · {item.extra}</span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
