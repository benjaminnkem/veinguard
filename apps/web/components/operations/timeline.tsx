"use client";

import type { OperationsContext } from "@/lib/operations";

export function Timeline({ context }: { context: OperationsContext | null }) {
  const times = context?.availableTimes ?? [];
  const current = times[0];
  return (
    <div className="border-t border-border px-4 py-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">
          Timeline · Historical replay (one captured FortyGuard hour)
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
        <span>
          {current
            ? `${current.label} · sample ${current.seconds}s`
            : "No observation time available"}
        </span>
      </label>
    </div>
  );
}
