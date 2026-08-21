"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppNav } from "@/components/app-nav";
import { Inspector } from "@/components/operations/inspector";
import { ProvenanceDrawer } from "@/components/operations/provenance-drawer";
import { StatusBar } from "@/components/operations/status-bar";
import { Timeline } from "@/components/operations/timeline";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchApplied, labKeys } from "@/lib/lab";
import {
  fetchAsset,
  fetchContext,
  fetchProvenance,
  fetchTwin,
  fetchTwinTrace,
  operationsKeys,
  type ChemistryId,
  type TwinColorBy,
  type TwinGraph,
} from "@/lib/operations";

const TwinFlow = dynamic(
  () => import("./twin-flow").then((mod) => mod.TwinFlow),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-accent text-sm text-muted-foreground">
        Loading digital twin…
      </div>
    ),
  },
);

const COLOR_OPTIONS: Array<{ id: TwinColorBy; label: string }> = [
  { id: "residual", label: "Modeled residual" },
  { id: "pressure", label: "Pressure" },
  { id: "water-age", label: "Water age" },
  { id: "water-temperature", label: "Modeled water temperature" },
  { id: "target", label: "Projected target breach" },
];

export function TwinShell() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const assetParam = params.get("asset");
  const chemistryParam = params.get("chemistry");

  const [chemistry, setChemistry] = useState<ChemistryId>(
    chemistryParam === "MONOCHLORAMINE" ? "MONOCHLORAMINE" : "FREE_CHLORINE",
  );
  const [selectedId, setSelectedId] = useState<string | null>(assetParam);
  const [colorBy, setColorBy] = useState<TwinColorBy>("residual");
  const [traceDirection, setTraceDirection] = useState<
    "upstream" | "downstream" | null
  >(null);
  const [preview, setPreview] = useState<"before" | "after">(
    params.get("preview") === "after" ? "after" : "before",
  );
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);

  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedId) {
      next.set("asset", selectedId);
    }
    next.set("chemistry", chemistry);
    const query = next.toString();
    if (params.toString() === query) {
      return;
    }
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { scroll: false });
  }, [chemistry, params, pathname, router, selectedId]);

  const contextQuery = useQuery({
    queryKey: operationsKeys.context(),
    queryFn: fetchContext,
  });
  const twinQuery = useQuery({
    queryKey: operationsKeys.twin(chemistry),
    queryFn: () => fetchTwin(chemistry),
  });
  const assetQuery = useQuery({
    queryKey: operationsKeys.asset(selectedId ?? "", chemistry),
    queryFn: () => fetchAsset(selectedId!, chemistry),
    enabled: selectedId != null,
  });
  const traceQuery = useQuery({
    queryKey: operationsKeys.twinTrace(selectedId ?? "", traceDirection ?? "upstream"),
    queryFn: () => fetchTwinTrace(selectedId!, traceDirection!),
    enabled: selectedId != null && traceDirection != null,
  });
  const provenanceQuery = useQuery({
    queryKey: operationsKeys.provenance(),
    queryFn: fetchProvenance,
    enabled: provenanceOpen,
  });
  const appliedQuery = useQuery({
    queryKey: labKeys.applied(),
    queryFn: fetchApplied,
  });

  const graph = overlayAfter(
    twinQuery.data ?? null,
    preview === "after" ? appliedQuery.data?.scenario?.networkState ?? null : null,
  );
  const trace = traceDirection ? (traceQuery.data ?? null) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-4">
          <p className="text-sm font-semibold tracking-tight">VeinGuard</p>
          <AppNav current="twin" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Chemistry</span>
            <select
              className="rounded-md border border-border bg-card px-2 py-1"
              value={chemistry}
              onChange={(event) =>
                setChemistry(event.target.value as ChemistryId)
              }
              aria-label="Chemistry profile"
            >
              <option value="FREE_CHLORINE">Free Chlorine</option>
              <option value="MONOCHLORAMINE">Monochloramine</option>
              <option value="CHLORINE_DIOXIDE" disabled>
                Chlorine Dioxide (coming soon)
              </option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={() => setProvenanceOpen(true)}
          >
            Provenance
          </button>
          <Link href="/setup" className="text-xs text-muted-foreground underline">
            Setup
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {twinQuery.error ? (
        <div
          role="alert"
          className="border-b border-amber-700/40 bg-amber-950/30 px-4 py-2 text-sm"
        >
          Provider or API error:{" "}
          {twinQuery.error instanceof Error
            ? twinQuery.error.message
            : "Digital twin data unavailable."}{" "}
          No placeholder network values are shown.
        </div>
      ) : null}

      <StatusBar context={contextQuery.data ?? null} chemistry={chemistry} />

      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs">
        <p>
          <span className="text-muted-foreground">Scenario preview: </span>
          <button
            type="button"
            className={`rounded-md px-2 py-1 ${preview === "before" ? "bg-accent font-medium" : "text-muted-foreground"}`}
            onClick={() => setPreview("before")}
          >
            Before (baseline)
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 ${preview === "after" ? "bg-accent font-medium" : "text-muted-foreground"}`}
            onClick={() => setPreview("after")}
            aria-pressed={preview === "after"}
          >
            After
          </button>
        </p>
        <p className="text-muted-foreground">
          {graph
            ? `${graph.counts.nodes} nodes · ${graph.counts.edges} pipes · ${graph.counts.pumps} pumps`
            : "Loading topology…"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`${legendOpen ? "w-60" : "w-10"} hidden h-full shrink-0 overflow-auto border-r border-border md:block`}
        >
          <LegendPanel
            open={legendOpen}
            onToggle={() => setLegendOpen((value) => !value)}
            colorBy={colorBy}
            onColorBy={setColorBy}
            selectedId={selectedId}
            traceDirection={traceDirection}
            onTrace={(direction) => {
              if (!selectedId) {
                return;
              }
              setTraceDirection((current) =>
                current === direction ? null : direction,
              );
            }}
            onClearTrace={() => setTraceDirection(null)}
            trace={trace}
            tracePending={traceQuery.isFetching}
            target={graph?.operationalTargetMgL ?? null}
          />
        </aside>
        <div className="relative min-h-0 min-w-0 flex-1">
          {graph ? (
            <div className="absolute inset-0">
              <TwinFlow
                graph={graph}
                colorBy={colorBy}
                selectedId={selectedId}
                trace={trace}
                focusId={assetParam}
                onSelect={(id) => {
                  setSelectedId(id);
                  setTraceDirection(null);
                }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {twinQuery.isLoading ? "Loading captured run topology…" : "No twin graph."}
            </div>
          )}
          {preview === "after" ? (
            <div
              role="status"
              className="absolute left-3 right-3 top-3 z-10 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow"
            >
              {appliedQuery.data?.afterAvailable
                ? `${appliedQuery.data.heatNotice} After-state is the completed scenario applied to the digital twin. Decision-support simulation. No real infrastructure was actuated.`
                : "After-state is unavailable. No completed scenario simulation has been applied. The schematic still shows the captured baseline. VeinGuard does not invent scenario results."}
            </div>
          ) : null}
        </div>
        <aside
          className={`${inspectorOpen ? "w-80" : "w-10"} hidden h-full shrink-0 overflow-auto border-l border-border lg:block`}
        >
          <Inspector
            open={inspectorOpen}
            onToggle={() => setInspectorOpen((value) => !value)}
            detail={selectedId ? (assetQuery.data ?? null) : null}
            onProvenance={() => setProvenanceOpen(true)}
            twinHref={null}
          />
        </aside>
      </div>

      <Timeline context={contextQuery.data ?? null} />
      <ProvenanceDrawer
        open={provenanceOpen}
        onClose={() => setProvenanceOpen(false)}
        payload={provenanceQuery.data ?? null}
      />
    </div>
  );
}

function LegendPanel({
  open,
  onToggle,
  colorBy,
  onColorBy,
  selectedId,
  traceDirection,
  onTrace,
  onClearTrace,
  trace,
  tracePending,
  target,
}: {
  open: boolean;
  onToggle: () => void;
  colorBy: TwinColorBy;
  onColorBy: (value: TwinColorBy) => void;
  selectedId: string | null;
  traceDirection: "upstream" | "downstream" | null;
  onTrace: (direction: "upstream" | "downstream") => void;
  onClearTrace: () => void;
  trace: import("@/lib/operations").TwinTrace | null;
  tracePending: boolean;
  target: number | null;
}) {
  if (!open) {
    return (
      <button type="button" className="h-full w-full text-xs" onClick={onToggle}>
        Legend
      </button>
    );
  }
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Legend</h2>
        <button type="button" onClick={onToggle} className="text-muted-foreground">
          Hide
        </button>
      </div>
      <section>
        <h3 className="mb-1 font-medium">Color by completed-run metric</h3>
        <div className="flex flex-col gap-1">
          {COLOR_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="twin-color"
                checked={colorBy === option.id}
                onChange={() => onColorBy(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-muted-foreground">
          Unknown / not calculated is gray, not green.
          {target != null ? ` Configured target ${target} mg/L.` : ""}
        </p>
        <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-orange-700 to-blue-900" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Low / unknown</span>
          <span>Higher modeled value</span>
        </div>
      </section>
      <section>
        <h3 className="mb-1 font-medium">Asset types</h3>
        <ul className="space-y-1 text-muted-foreground">
          <li>Circle — Junction</li>
          <li>Trapezoid — Reservoir</li>
          <li>Rectangle — Tank</li>
          <li>Diamond — Pump</li>
          <li>Bowtie — Valve</li>
          <li>Red outline — projected target breach</li>
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-medium">Hydraulic trace</h3>
        <p className="mb-2 text-muted-foreground">
          Follows modeled flow sign at the selected sample time. Select an asset
          first.
        </p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!selectedId}
            className={`rounded border border-border px-2 py-1 text-left disabled:text-muted-foreground ${
              traceDirection === "upstream" ? "bg-accent" : ""
            }`}
            onClick={() => onTrace("upstream")}
          >
            Upstream
          </button>
          <button
            type="button"
            disabled={!selectedId}
            className={`rounded border border-border px-2 py-1 text-left disabled:text-muted-foreground ${
              traceDirection === "downstream" ? "bg-accent" : ""
            }`}
            onClick={() => onTrace("downstream")}
          >
            Downstream
          </button>
          <button
            type="button"
            disabled={!traceDirection}
            className="rounded border border-border px-2 py-1 text-left disabled:text-muted-foreground"
            onClick={onClearTrace}
          >
            Clear trace
          </button>
        </div>
        {tracePending ? (
          <p className="mt-2 text-muted-foreground">Tracing…</p>
        ) : null}
        {trace ? (
          <div className="mt-2 space-y-1">
            <p>
              {trace.direction} · {trace.nodeIds.length} nodes ·{" "}
              {trace.edgeIds.length} links
            </p>
            <p className="text-muted-foreground">{trace.notice}</p>
            {trace.supplyAssets.length > 0 ? (
              <p>
                Upstream tanks/reservoirs:{" "}
                {trace.supplyAssets.map((item) => item.id).join(", ")}
              </p>
            ) : (
              <p className="text-muted-foreground">
                No tank/reservoir on this traced path. Supply share is not
                invented.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function overlayAfter(
  graph: TwinGraph | null,
  networkState: {
    nodes?: Array<{
      id: string;
      residualMgL?: number | null;
      pressureM?: number | null;
      waterAgeHours?: number | null;
      projectedTargetBreach?: boolean;
    }>;
    links?: Array<{ id: string; flowM3s?: number | null }>;
  } | null,
): TwinGraph | null {
  if (!graph || !networkState?.nodes) {
    return graph;
  }
  const byId = new Map(networkState.nodes.map((node) => [node.id, node]));
  const linkById = new Map(
    (networkState.links ?? []).map((link) => [link.id, link]),
  );
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const next = byId.get(node.id);
      if (!next) {
        return node;
      }
      return {
        ...node,
        residualMgL: next.residualMgL ?? node.residualMgL,
        pressureM: next.pressureM ?? node.pressureM,
        waterAgeHours: next.waterAgeHours ?? node.waterAgeHours,
        projectedTargetBreach:
          next.projectedTargetBreach ?? node.projectedTargetBreach,
      };
    }),
    edges: graph.edges.map((edge) => {
      const next = linkById.get(edge.id);
      if (!next) {
        return edge;
      }
      return { ...edge, flowM3s: next.flowM3s ?? edge.flowM3s };
    }),
  };
}
