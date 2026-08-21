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
      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        Loading operations context…
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
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border px-4 py-2 text-xs">
      {items.map((item) => (
        <p key={item.label}>
          <span className="text-muted-foreground">{item.label}: </span>
          <span className="font-medium">{item.value}</span>
          {item.extra ? (
            <span className="text-muted-foreground"> · {item.extra}</span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
