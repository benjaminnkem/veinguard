"use client";

import type { OperationsContext } from "@/lib/operations";

export function Timeline({ context }: { context: OperationsContext | null }) {
  const times = context?.availableTimes ?? [];
  const current = times[0];
  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <label className="flex flex-col gap-1 font-mono text-[10px]">
        <span className="uppercase tracking-[0.12em] text-muted-foreground">
          Timeline
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(times.length - 1, 0)}
          step={1}
          defaultValue={0}
          aria-valuetext={current?.label ?? "No times"}
          disabled={times.length <= 1}
        />
        <span className="text-foreground">
          {current
            ? `${current.label} · sample ${current.seconds}s`
            : "No observation time available"}
        </span>
      </label>
    </div>
  );
}
