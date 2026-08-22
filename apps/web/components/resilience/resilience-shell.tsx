"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppNav } from "@/components/app-nav";
import { StatusBar } from "@/components/operations/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchContext, operationsKeys } from "@/lib/operations";
import {
  createStudy,
  fetchResilienceContext,
  fetchStudies,
  fetchStudy,
  resilienceKeys,
  type RecurrenceRow,
  type ResilienceStudy,
} from "@/lib/resilience";

const RecurrenceMap = dynamic(
  () => import("./recurrence-map").then((mod) => mod.RecurrenceMap),
  { ssr: false },
);

export function ResilienceShell() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extraHour, setExtraHour] = useState("");
  const [error, setError] = useState<string | null>(null);

  const contextQuery = useQuery({
    queryKey: resilienceKeys.context(),
    queryFn: fetchResilienceContext,
  });
  const opsQuery = useQuery({
    queryKey: operationsKeys.context(),
    queryFn: fetchContext,
  });
  const listQuery = useQuery({
    queryKey: resilienceKeys.list(),
    queryFn: fetchStudies,
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some(
        (row) => row.status === "QUEUED" || row.status === "RUNNING",
      )
        ? 2000
        : 10000;
    },
  });
  const studyQuery = useQuery({
    queryKey: resilienceKeys.study(selectedId ?? ""),
    queryFn: () => fetchStudy(selectedId!),
    enabled: selectedId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 2000 : false;
    },
  });

  const create = useMutation({
    mutationFn: createStudy,
    onSuccess: (study) => {
      setSelectedId(study.id);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: resilienceKeys.list() });
    },
    onError: (err: Error) => setError(err.message),
  });

  const ctx = contextQuery.data;
  const study = studyQuery.data;

  useEffect(() => {
    if (selectedId || !listQuery.data?.length) {
      return;
    }
    setSelectedId(listQuery.data[0]!.id);
  }, [listQuery.data, selectedId]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-4">
          <p className="text-sm font-semibold tracking-tight">VeinGuard</p>
          <AppNav current="resilience" />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/setup" className="text-xs text-muted-foreground underline">
            Setup
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <StatusBar context={opsQuery.data ?? null} chemistry="FREE_CHLORINE" />
      <div role="status" className="border-b border-border bg-accent/40 px-4 py-2 text-xs">
        {ctx?.notices.sample} {ctx?.notices.causation}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 overflow-auto border-r border-border p-3 text-xs md:block">
          <h2 className="mb-2 font-semibold">New study</h2>
          <p className="mb-2 text-muted-foreground">{ctx?.notices.captured}</p>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!ctx) {
                return;
              }
              const hours = [ctx.capturedEvent.hour];
              if (extraHour.trim()) {
                hours.push(extraHour.trim());
              }
              create.mutate({
                name: extraHour
                  ? "Historical heat hours"
                  : "Captured FortyGuard hour",
                eventHours: hours,
                runChemistry: true,
              });
            }}
          >
            <label className="flex flex-col gap-1">
              Additional HISTORICAL hour (optional)
              <input
                className="rounded-md border border-border bg-card px-2 py-1"
                placeholder="2024-07-16T14:00:00Z"
                value={extraHour}
                onChange={(event) => setExtraHour(event.target.value)}
              />
            </label>
            <p className="text-muted-foreground">
              Extra hours are live or cached-real FortyGuard requests. Missing
              hours stay failed; they are not invented.
            </p>
            {error ? (
              <p role="alert" className="text-red-700 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!ctx || create.isPending}
              className="rounded-md bg-accent px-3 py-1.5 font-medium disabled:text-muted-foreground"
            >
              {create.isPending ? "Queuing…" : "Start study"}
            </button>
          </form>
          <h2 className="mb-2 mt-4 font-semibold">Studies</h2>
          <ul className="space-y-1">
            {(listQuery.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`block w-full rounded px-2 py-1 text-left ${
                    selectedId === row.id ? "bg-accent font-medium" : ""
                  }`}
                  onClick={() => setSelectedId(row.id)}
                >
                  {row.name}
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {row.status} · n={row.aggregation.sampleSize}/
                    {row.aggregation.requested} · failed{" "}
                    {row.aggregation.failed}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-4 text-xs">
          {!study ? (
            <p className="text-muted-foreground">
              Start a study with the captured FortyGuard hour. Add another
              historical hour only if you want a live/cached-real acquisition.
            </p>
          ) : (
            <StudyView study={study} />
          )}
        </main>
      </div>
    </div>
  );
}

function StudyView({ study }: { study: ResilienceStudy }) {
  const agg = study.aggregation;
  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-2 md:grid-cols-4">
        <Card label="Requested" value={String(agg.requested)} />
        <Card label="Succeeded" value={String(agg.succeeded)} />
        <Card label="Failed / missing" value={String(agg.failed)} />
        <Card
          label="Sample size"
          value={String(agg.sampleSize)}
          note="Succeeded events only"
        />
      </section>
      <p className="text-muted-foreground">{agg.language.recurrence}</p>
      <p className="text-muted-foreground">{agg.language.targetBreach}</p>
      <p className="text-muted-foreground">{agg.language.association}</p>

      <section>
        <h3 className="mb-2 font-semibold">Events</h3>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1">Hour</th>
              <th>Status</th>
              <th>Freshness</th>
              <th>Chemistry</th>
              <th>Target-breach assets</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {study.events.map((event) => (
              <tr key={event.hour} className="border-b border-border">
                <td className="py-1 font-mono">{event.hour}</td>
                <td>{event.status}</td>
                <td>
                  {event.freshness ?? "—"}
                  {event.cached ? " · cache" : ""}
                </td>
                <td>{event.chemistryStatus ?? "—"}</td>
                <td>{event.targetBreachAssetIds.join(", ") || "—"}</td>
                <td className="text-red-700 dark:text-red-300">
                  {event.error?.message ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">
            Recurring projected target-breach assets
          </h3>
          <RecurrenceTable rows={agg.recurringTargetBreachAssets} empty="No chemistry-replay appearances yet." />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">
            Recurring elevated associated air temperature (≥ 15 °C)
          </h3>
          <RecurrenceTable rows={agg.recurringHighHeatAssets} empty="No high-heat appearances yet." />
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Persistence / exceedance</h3>
        <p>{agg.persistenceAssociation.notice}</p>
        <p className="mt-1">{agg.exceedanceAssociation.notice}</p>
      </section>

      <section className="h-80 overflow-hidden rounded-md border border-border">
        <RecurrenceMap data={study.recurrenceGeoJson ?? { type: "FeatureCollection", features: [] }} />
      </section>
    </div>
  );
}

function RecurrenceTable({
  rows,
  empty,
}: {
  rows: RecurrenceRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground">{empty}</p>;
  }
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="py-1">Asset</th>
          <th>Count</th>
          <th>n</th>
          <th>Recurring?</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 12).map((row) => (
          <tr key={row.id} className="border-b border-border">
            <td className="py-1">{row.id}</td>
            <td>{row.count}</td>
            <td>{row.sampleSize}</td>
            <td>{row.recurring ? "Yes (≥2 of n≥2)" : "No (sample too small or count < 2)"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
      {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
    </article>
  );
}
