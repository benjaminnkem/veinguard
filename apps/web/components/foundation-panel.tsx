"use client";

import { publicEnv } from "@/lib/public-env";
import Link from "next/link";
import { useMapStyle } from "@/lib/use-map-style";
import { ThemeToggle } from "./theme-toggle";

export function FoundationPanel() {
  const { styleUrl, theme, mounted } = useMapStyle();

  return (
    <div className="w-full max-w-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-water">
          Configuration
        </p>
        <ThemeToggle />
      </div>
      <h1 className="mt-3 text-4xl font-light tracking-[-0.04em]">Foundation</h1>
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
      <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Link
          href="/operations"
          className="border border-water bg-water px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-foreground"
        >
          Open Operations ↗
        </Link>
      </div>
    </div>
  );
}
