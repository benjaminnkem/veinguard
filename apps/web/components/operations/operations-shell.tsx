"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  fetchAsset,
  fetchContext,
  fetchLayer,
  fetchProvenance,
  LAYER_META,
  operationsKeys,
  type ChemistryId,
  type OperationsLayer,
} from "@/lib/operations";
import { Inspector } from "./inspector";
import { LayerPanel } from "./layer-panel";
import { ProvenanceDrawer } from "./provenance-drawer";
import { StatusBar } from "./status-bar";
import { SummaryCards } from "./summary-cards";
import { Timeline } from "./timeline";

const OperationsMap = dynamic(
  () => import("./operations-map").then((mod) => mod.OperationsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-accent text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

const QUANT_LAYERS: OperationsLayer[] = [
  "tcm",
  "pressure",
  "flow",
  "water-age",
  "water-temperature",
  "residual",
  "target",
  "nitrification",
];

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

export function OperationsShell() {
  const [chemistry, setChemistry] = useState<ChemistryId>("FREE_CHLORINE");
  const [quantLayer, setQuantLayer] = useState<OperationsLayer>("tcm");
  const [showNetwork, setShowNetwork] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const visibleQuant = useMemo(() => {
    if (quantLayer === "nitrification" && chemistry !== "MONOCHLORAMINE") {
      return "residual" as OperationsLayer;
    }
    return quantLayer;
  }, [quantLayer, chemistry]);

  const contextQuery = useQuery({
    queryKey: operationsKeys.context(),
    queryFn: fetchContext,
  });
  const quantQuery = useQuery({
    queryKey: operationsKeys.layer(visibleQuant, chemistry),
    queryFn: () => fetchLayer(visibleQuant, chemistry),
  });
  const networkQuery = useQuery({
    queryKey: operationsKeys.layer("network", chemistry),
    queryFn: () => fetchLayer("network", chemistry),
    enabled: showNetwork,
  });
  const assetsQuery = useQuery({
    queryKey: operationsKeys.layer("assets", chemistry),
    queryFn: () => fetchLayer("assets", chemistry),
    enabled: showAssets,
  });
  const assetQuery = useQuery({
    queryKey: operationsKeys.asset(selectedId ?? "", chemistry),
    queryFn: () => fetchAsset(selectedId!, chemistry),
    enabled: selectedId != null,
  });
  const provenanceQuery = useQuery({
    queryKey: operationsKeys.provenance(),
    queryFn: fetchProvenance,
    enabled: provenanceOpen,
  });

  const contextError = contextQuery.error;
  const layerMessage =
    quantQuery.data?.message ??
    (quantQuery.error instanceof Error ? quantQuery.error.message : null);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-4">
          <p className="text-sm font-semibold tracking-tight">VeinGuard</p>
          <nav aria-label="Primary" className="flex gap-1 text-xs">
            <span className="rounded-md bg-accent px-2 py-1 font-medium">Operations</span>
            <span
              className="rounded-md px-2 py-1 text-muted-foreground"
              title="Digital Twin ships in a later phase"
            >
              Digital Twin
            </span>
            <span
              className="rounded-md px-2 py-1 text-muted-foreground"
              title="Intervention Lab ships in a later phase"
            >
              Intervention Lab
            </span>
            <span
              className="rounded-md px-2 py-1 text-muted-foreground"
              title="Resilience ships in a later phase"
            >
              Resilience
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Chemistry</span>
            <select
              className="rounded-md border border-border bg-card px-2 py-1"
              value={chemistry}
              onChange={(event) => {
                const next = event.target.value as ChemistryId;
                setChemistry(next);
                if (
                  quantLayer === "nitrification" &&
                  next !== "MONOCHLORAMINE"
                ) {
                  setQuantLayer("residual");
                }
              }}
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

      {contextError ? (
        <div
          role="alert"
          className="border-b border-amber-700/40 bg-amber-950/30 px-4 py-2 text-sm"
        >
          Provider or API error:{" "}
          {contextError instanceof Error
            ? contextError.message
            : "Operations data unavailable."}{" "}
          Manual simulation remains available when configured. No placeholder map
          values are shown.
        </div>
      ) : null}

      <StatusBar context={contextQuery.data ?? null} chemistry={chemistry} />
      <SummaryCards context={contextQuery.data ?? null} />

      <div className="flex min-h-0 flex-1">
        <aside
          className={`${layersOpen ? "w-60" : "w-10"} hidden shrink-0 border-r border-border md:block`}
        >
          <LayerPanel
            open={layersOpen}
            onToggle={() => setLayersOpen((value) => !value)}
            quantLayer={visibleQuant}
            onQuantLayer={(layer) => {
              if (
                layer === "nitrification" &&
                chemistry !== "MONOCHLORAMINE"
              ) {
                return;
              }
              setQuantLayer(layer);
            }}
            showNetwork={showNetwork}
            onShowNetwork={setShowNetwork}
            showAssets={showAssets}
            onShowAssets={setShowAssets}
            chemistry={chemistry}
            layers={LAYER_META}
            groups={QUANT_LAYERS}
          />
        </aside>
        <div className="relative min-w-0 flex-1">
          <OperationsMap
            quantLayer={visibleQuant}
            quantData={quantQuery.data?.geojson ?? EMPTY_COLLECTION}
            networkData={showNetwork ? (networkQuery.data?.geojson ?? null) : null}
            assetData={showAssets ? (assetsQuery.data?.geojson ?? null) : null}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
          {layerMessage ? (
            <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-card/90 px-3 py-2 text-xs shadow">
              {layerMessage}
            </p>
          ) : null}
        </div>
        <aside
          className={`${inspectorOpen ? "w-80" : "w-10"} hidden shrink-0 border-l border-border lg:block`}
        >
          <Inspector
            open={inspectorOpen}
            onToggle={() => setInspectorOpen((value) => !value)}
            detail={selectedId ? (assetQuery.data ?? null) : null}
            onProvenance={() => setProvenanceOpen(true)}
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
