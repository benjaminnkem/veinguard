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
    <div className="grid grid-cols-2 gap-px border-b border-white/10 bg-white/10 px-0 lg:grid-cols-4">
      {cards.map((card, index) => (
        <article key={card.label} className="bg-[#0c0c0c] px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {card.label}
          </p>
          <p className={`mt-1 text-lg font-light tracking-tight ${index === 0 && context.cards.projectedTargetBreachAssetCount > 0 ? "text-amber-300" : "text-zinc-100"}`}>{card.value}</p>
          <p className="font-mono text-[9px] text-muted-foreground">{card.note}</p>
        </article>
      ))}
    </div>
  );
}
