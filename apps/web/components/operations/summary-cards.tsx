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
      note: "Configured operational target",
      warn: context.cards.projectedTargetBreachAssetCount > 0,
    },
    {
      label: "Earliest projected breach",
      value: context.cards.earliestProjectedTargetBreach
        ? `At ${context.cards.earliestProjectedTargetBreach.sampleTimeSeconds / 3600} h sample`
        : "None at sample time",
      note: "Sample time only",
      warn: false,
    },
    {
      label: "Minimum modeled residual",
      value:
        context.cards.minimumModeledResidualMgL == null
          ? "Not calculated"
          : `${context.cards.minimumModeledResidualMgL.toPrecision(3)} mg/L`,
      note: `Target ${context.cards.operationalTargetMgL} mg/L`,
      warn: false,
    },
    {
      label: "Maximum modeled water age",
      value:
        context.cards.maximumWaterAgeHours == null
          ? "Not calculated"
          : `${context.cards.maximumWaterAgeHours.toFixed(1)} h`,
      note: "Sample time only",
      warn: false,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="bg-card px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {card.label}
          </p>
          <p
            className={`mt-1 text-lg font-light tracking-tight ${
              card.warn ? "text-warning" : "text-foreground"
            }`}
          >
            {card.value}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground">{card.note}</p>
        </article>
      ))}
    </div>
  );
}
