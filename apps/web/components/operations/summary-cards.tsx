"use client";

import type { OperationsContext } from "@/lib/operations";

export function SummaryCards({ context }: { context: OperationsContext | null }) {
  if (!context) {
    return null;
  }
  const cards = [
    {
      label: "Projected target-breach assets",
      value: String(context.cards.projectedTargetBreachAssetCount),
      note: "Relative to the configured operational target",
    },
    {
      label: "Earliest projected breach",
      value: context.cards.earliestProjectedTargetBreach
        ? `At ${context.cards.earliestProjectedTargetBreach.sampleTimeSeconds / 3600} h sample`
        : "None at sample time",
      note: "No earlier clock time is invented",
    },
    {
      label: "Minimum modeled residual",
      value:
        context.cards.minimumModeledResidualMgL == null
          ? "Not calculated"
          : `${context.cards.minimumModeledResidualMgL.toPrecision(3)} mg/L`,
      note: `Configured target ${context.cards.operationalTargetMgL} mg/L`,
    },
    {
      label: "Maximum modeled water age",
      value:
        context.cards.maximumWaterAgeHours == null
          ? "Not calculated"
          : `${context.cards.maximumWaterAgeHours.toFixed(1)} h`,
      note: "Sample time only",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-border px-4 py-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-1 text-sm font-semibold">{card.value}</p>
          <p className="text-[11px] text-muted-foreground">{card.note}</p>
        </article>
      ))}
    </div>
  );
}
