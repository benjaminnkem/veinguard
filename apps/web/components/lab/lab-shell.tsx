"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/app-chrome";
import { StatusBar } from "@/components/operations/status-bar";
import {
  applyScenario,
  compareScenarios,
  createScenario,
  fetchLabContext,
  fetchLabList,
  labKeys,
  runScenario,
  type ScenarioRecord,
} from "@/lib/lab";
import { fetchContext as fetchOpsContext, operationsKeys } from "@/lib/operations";
import { AgentPanel } from "./agent-panel";
import { ScenarioEditor } from "./scenario-editor";

export function LabShell() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | "baseline">("baseline");
  const [tab, setTab] = useState<"manual" | "agent">("manual");
  const [preview, setPreview] = useState<"before" | "after">("before");

  const contextQuery = useQuery({
    queryKey: labKeys.context(),
    queryFn: fetchLabContext,
  });
  const opsQuery = useQuery({
    queryKey: operationsKeys.context(),
    queryFn: fetchOpsContext,
  });
  const listQuery = useQuery({
    queryKey: labKeys.list(),
    queryFn: fetchLabList,
    refetchInterval: (query) => {
      const rows = query.state.data?.scenarios ?? [];
      return rows.some((row) => row.status === "QUEUED" || row.status === "RUNNING") ? 2000 : 8000;
    },
  });

  const create = useMutation({
    mutationFn: createScenario,
    onSuccess: (scenario) => {
      void queryClient.invalidateQueries({ queryKey: labKeys.list() });
      setSelectedId(scenario.id);
    },
  });
  const run = useMutation({
    mutationFn: runScenario,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: labKeys.list() }),
  });
  const apply = useMutation({
    mutationFn: applyScenario,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: labKeys.list() });
      void queryClient.invalidateQueries({ queryKey: labKeys.applied() });
    },
  });
  const compare = useMutation({
    mutationFn: (ids: string[]) => compareScenarios(ids),
  });

  const list = listQuery.data;
  const selected: ScenarioRecord | null = useMemo(() => {
    if (selectedId === "baseline") {
      return null;
    }
    return list?.scenarios.find((row) => row.id === selectedId) ?? null;
  }, [list, selectedId]);

  const completed = list?.scenarios.filter((row) => row.status === "SUCCEEDED") ?? [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <AppHeader current="lab" />
      <StatusBar context={opsQuery.data ?? null} chemistry="FREE_CHLORINE" />
      <div
        role="status"
        className="border-b border-border bg-muted px-4 py-2 text-[11px] text-muted-foreground"
      >
        {contextQuery.data?.notices.actuation}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 overflow-auto border-r border-border bg-card p-3 text-xs md:block">
          <h2 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Branches
          </h2>
          <button
            type="button"
            className={`mb-1 block w-full border-l-2 px-3 py-2 text-left ${
              selectedId === "baseline"
                ? "border-water bg-water/10 font-medium text-water"
                : "border-border hover:bg-muted"
            }`}
            onClick={() => setSelectedId("baseline")}
          >
            Baseline · captured run
          </button>
          <ul className="space-y-1 pl-3">
            {(list?.scenarios ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`block w-full border-l-2 px-3 py-2 text-left ${
                    selectedId === row.id
                      ? "border-water bg-water/10 font-medium text-water"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => setSelectedId(row.id)}
                >
                  {row.name}
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {statusLabel(row)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-4 text-xs">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`border px-2 py-1 text-[11px] ${preview === "before" ? "border-water/30 bg-water/10 font-medium text-water" : "border-transparent text-muted-foreground"}`}
              onClick={() => setPreview("before")}
            >
              Before
            </button>
            <button
              type="button"
              className={`border px-2 py-1 text-[11px] ${preview === "after" ? "border-water/30 bg-water/10 font-medium text-water" : "border-transparent text-muted-foreground"}`}
              onClick={() => setPreview("after")}
            >
              After
            </button>
            <button
              type="button"
              className="border border-border px-2 py-1 text-[11px]"
              disabled={completed.length === 0 || compare.isPending}
              onClick={() => compare.mutate(completed.map((row) => row.id))}
            >
              Compare completed
            </button>
          </div>

          {preview === "after" && !selected?.networkState ? (
            <p className="mb-3 rounded-md border border-border bg-card px-3 py-2">
              After-state comes from a completed simulation only. Heat is unchanged.
            </p>
          ) : null}

          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <Metric
              label="Projected target-breach assets"
              value={
                preview === "after" && selected?.metrics
                  ? String(selected.metrics.targetBreachCount ?? "Not calculated")
                  : String(contextQuery.data?.cards.projectedTargetBreachAssetCount ?? "—")
              }
            />
            <Metric
              label="Minimum modeled residual"
              value={formatMaybe(
                preview === "after" ? null : contextQuery.data?.cards.minimumModeledResidualMgL,
                "mg/L",
              )}
              note="After uses completed-run metrics only"
            />
            <Metric
              label="Min pressure (sample)"
              value={pressureValue(
                preview,
                selected,
                contextQuery.data?.cards.minimumSamplePressureM ?? null,
              )}
            />
            <Metric
              label="Flush volume"
              value={
                preview === "after" && selected?.metrics
                  ? formatMaybe(numberOrNull(selected.metrics.flushWaterLiters), "L")
                  : "0 L (baseline)"
              }
            />
          </section>

          {selected ? (
            <ScenarioDetail
              scenario={selected}
              onRun={() => run.mutate(selected.id)}
              onApply={() => apply.mutate(selected.id)}
              runPending={run.isPending}
              applyPending={apply.isPending}
            />
          ) : (
            <p className="text-muted-foreground">
              Select a branch or create one. Baseline is the captured Net3 run.
            </p>
          )}

          {compare.data ? (
            <section className="mt-4 rounded-md border border-border p-3">
              <h3 className="font-semibold">Deterministic comparison</h3>
              <p className="text-muted-foreground">
                Best is rank 1 from the objective profile, not Gemini. {compare.data.heatNotice}
              </p>
              <ul className="mt-2 space-y-1">
                {compare.data.feasible.map((row) => (
                  <li key={row.scenarioRunId}>
                    Rank {row.rank}: {nameOf(list?.scenarios ?? [], row.scenarioRunId)} · objective{" "}
                    {row.objective.toPrecision(4)}
                    {row.rank === 1 ? " · BEST FEASIBLE" : ""}
                  </li>
                ))}
                {compare.data.rejected.map((row) => (
                  <li key={row.scenarioRunId}>
                    {nameOf(list?.scenarios ?? [], row.scenarioRunId)} · REJECTED ·{" "}
                    {row.hardConstraintViolationIds.join(", ") || "hard constraint"}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="rounded-md border border-border px-2 py-1" href="/operations">
              Before map
            </Link>
            <Link
              className="rounded-md border border-border px-2 py-1"
              href={
                selected?.appliedToTwin || list?.appliedScenarioId
                  ? "/digital-twin?preview=after"
                  : "/digital-twin"
              }
            >
              After twin
            </Link>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 overflow-auto border-l border-border bg-card p-3 lg:block">
          <div className="mb-3 flex overflow-hidden border border-border">
            <button
              type="button"
              className={`flex-1 px-2 py-1.5 text-[11px] ${tab === "manual" ? "bg-water/10 font-medium text-water" : "text-muted-foreground"}`}
              onClick={() => setTab("manual")}
            >
              Manual
            </button>
            <button
              type="button"
              className={`flex-1 border-l border-border px-2 py-1.5 text-[11px] ${tab === "agent" ? "bg-water/10 font-medium text-water" : "text-muted-foreground"}`}
              onClick={() => setTab("agent")}
            >
              Agent
            </button>
          </div>
          {tab === "manual" && contextQuery.data ? (
            <ScenarioEditor
              context={contextQuery.data}
              pending={create.isPending}
              onCreate={async (input) => {
                await create.mutateAsync(input);
              }}
            />
          ) : null}
          {tab === "agent" ? (
            <AgentPanel geminiConfigured={Boolean(contextQuery.data?.geminiConfigured)} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ScenarioDetail({
  scenario,
  onRun,
  onApply,
  runPending,
  applyPending,
}: {
  scenario: ScenarioRecord;
  onRun: () => void;
  onApply: () => void;
  runPending: boolean;
  applyPending: boolean;
}) {
  return (
    <article className="rounded-md border border-border bg-card p-3">
      <h3 className="text-sm font-semibold">{scenario.name}</h3>
      <p className="text-muted-foreground">{statusLabel(scenario)}</p>
      {scenario.error.message ? (
        <p role="alert" className="mt-2 text-red-700 dark:text-red-300">
          {scenario.error.message}
        </p>
      ) : null}
      {scenario.hardConstraintViolations.length > 0 ? (
        <section className="mt-2">
          <h4 className="font-medium">Hard-constraint rejection</h4>
          <ul className="list-disc pl-4">
            {scenario.hardConstraintViolations.map((item) => (
              <li key={item.id}>
                {item.message}
                {item.observed != null
                  ? ` · observed ${String(item.observed)}${item.units ? ` ${String(item.units)}` : ""}`
                  : ""}
                {item.limit != null ? ` · limit ${String(item.limit)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {scenario.status === "SUCCEEDED" ? (
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground">Feasible</dt>
            <dd>{scenario.feasible ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Objective</dt>
            <dd>
              {scenario.objective == null
                ? "Not scored (infeasible)"
                : scenario.objective.toPrecision(4)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Chemical increment</dt>
            <dd>{formatMaybe(numberOrNull(scenario.metrics?.chemicalIncrementMg), "mg")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Energy delta</dt>
            <dd>Not calculated</dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1"
          disabled={runPending || scenario.status === "QUEUED" || scenario.status === "RUNNING"}
          onClick={onRun}
        >
          {scenario.status === "SUCCEEDED" ? "Re-run" : "Run simulation"}
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1"
          disabled={applyPending || scenario.status !== "SUCCEEDED" || scenario.appliedToTwin}
          onClick={onApply}
        >
          {scenario.appliedToTwin ? "Applied to Digital Twin" : "Apply to Digital Twin"}
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
      {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
    </article>
  );
}

function statusLabel(row: ScenarioRecord): string {
  if (row.status === "SUCCEEDED") {
    if (!row.feasible) {
      return "REJECTED · hard constraint";
    }
    return row.appliedToTwin ? "SUCCEEDED · applied" : "FEASIBLE";
  }
  return row.status;
}

function nameOf(rows: ScenarioRecord[], id: string): string {
  return rows.find((row) => row.id === id)?.name ?? id.slice(0, 8);
}

function formatMaybe(value: number | null | undefined, unit: string): string {
  if (value == null) {
    return "Not calculated";
  }
  return `${value.toPrecision(3)} ${unit}`;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function pressureValue(
  preview: "before" | "after",
  selected: ScenarioRecord | null,
  baseline: number | null,
): string {
  if (preview === "after" && selected) {
    const sample = (selected.networkState?.nodes ?? [])
      .map((node) => node.pressureM)
      .filter((value): value is number => typeof value === "number");
    if (sample.length > 0) {
      return formatMaybe(Math.min(...sample), "m");
    }
    const summary = selected.hydraulics?.summary as { minPressureM?: number | null } | undefined;
    return formatMaybe(summary?.minPressureM ?? null, "m");
  }
  return formatMaybe(baseline, "m");
}
