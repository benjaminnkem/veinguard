"use client";

import { publicEnv } from "@/lib/public-env";
import { useMapStyle } from "@/lib/use-map-style";
import { ThemeToggle } from "./theme-toggle";

export function FoundationPanel() {
  const { styleUrl, theme, mounted } = useMapStyle();

  return (
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300/80">
          Operations foundation
        </p>
        <ThemeToggle />
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">VeinGuard</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Heat-aware drinking-water digital twin. This phase is the platform foundation — health,
        configuration, and local infrastructure. No thermal or simulation features are live yet.
      </p>
      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="font-mono">{publicEnv.appEnv}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted-foreground">API base</dt>
          <dd className="truncate font-mono">{publicEnv.apiBaseUrl}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted-foreground">Theme</dt>
          <dd className="font-mono">{mounted ? theme : "…"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted-foreground">Map style</dt>
          <dd className="truncate font-mono" title={styleUrl}>
            {styleUrl}
          </dd>
        </div>
      </dl>
    </div>
  );
}
