"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader, AppSelect, GhostButton } from "@/components/app-chrome";
import { Inspector } from "@/components/operations/inspector";
import { ProvenanceDrawer } from "@/components/operations/provenance-drawer";
import { StatusBar } from "@/components/operations/status-bar";
import { Timeline } from "@/components/operations/timeline";
import { fetchApplied, labKeys } from "@/lib/lab";
import { LegendPanel } from "./legend-panel";
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
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        Loading digital twin…
      </div>
    ),
  },
);

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
      <AppHeader current="twin">
        <AppSelect
          label="Chemistry"
          value={chemistry}
          onChange={(next) => setChemistry(next as ChemistryId)}
        >
          <option value="FREE_CHLORINE">Free Chlorine</option>
          <option value="MONOCHLORAMINE">Monochloramine</option>
          <option value="CHLORINE_DIOXIDE" disabled>
            Chlorine Dioxide (coming soon)
          </option>
        </AppSelect>
        <GhostButton onClick={() => setProvenanceOpen(true)}>Provenance</GhostButton>
      </AppHeader>

      {twinQuery.error ? (
        <div
          role="alert"
          className="border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm"
        >
          {twinQuery.error instanceof Error
            ? twinQuery.error.message
            : "Digital twin data unavailable."}{" "}
          No placeholder network values are shown.
        </div>
      ) : null}

      <StatusBar context={contextQuery.data ?? null} chemistry={chemistry} />

      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 text-[11px]">
        <p className="flex items-center gap-1">
          <span className="text-muted-foreground">Preview</span>
          <button
            type="button"
            className={`px-2 py-1 ${preview === "before" ? "bg-water/10 font-medium text-water" : "text-muted-foreground"}`}
            onClick={() => setPreview("before")}
          >
            Before
          </button>
          <button
            type="button"
            className={`px-2 py-1 ${preview === "after" ? "bg-water/10 font-medium text-water" : "text-muted-foreground"}`}
            onClick={() => setPreview("after")}
            aria-pressed={preview === "after"}
          >
            After
          </button>
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
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
                ? `${appliedQuery.data.heatNotice} After-state is the applied scenario. No infrastructure was actuated.`
                : "No applied scenario. Showing baseline — after-state is not invented."}
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
