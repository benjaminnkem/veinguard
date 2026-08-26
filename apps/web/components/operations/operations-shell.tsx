"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeoJSONSource } from "maplibre-gl";
import { AppNav } from "@/components/app-nav";
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

const EMPTY_COLLECTION: Parameters<GeoJSONSource["setData"]>[0] = {
  type: "FeatureCollection",
  features: [],
};

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
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0c0c0c] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.18)] lg:px-5">
        <div className="flex items-center gap-4">
          <AppNav current="operations" />
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Chemistry</span>
            <select
              className="max-w-[9rem] border border-white/15 bg-[#111214] px-2.5 py-1.5 text-[11px] text-foreground"
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
            className="border border-water/25 bg-water/10 px-2.5 py-1.5 text-[11px] text-water"
            onClick={() => setProvenanceOpen(true)}
          >
            Provenance
          </button>
          <Link href="/setup" className="text-[11px] text-muted-foreground hover:text-foreground">
            Setup
          </Link>
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`${layersOpen ? "w-60" : "w-10"} hidden h-full shrink-0 overflow-auto border-r border-border md:block`}
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
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex justify-between md:hidden">
            <div className="pointer-events-auto flex gap-1 border border-white/10 bg-[#0c0c0c]/95 p-1 shadow-xl backdrop-blur-sm">
              <button type="button" className={`px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${layersOpen ? "bg-water/10 text-water" : "text-zinc-400"}`} onClick={() => setLayersOpen((value) => !value)}>Layers</button>
              <button type="button" className={`px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${inspectorOpen ? "bg-water/10 text-water" : "text-zinc-400"}`} onClick={() => setInspectorOpen((value) => !value)}>Inspect</button>
            </div>
          </div>
          <OperationsMap
            quantLayer={visibleQuant}
            quantData={quantQuery.data?.geojson ?? EMPTY_COLLECTION}
            networkData={showNetwork ? (networkQuery.data?.geojson ?? null) : null}
            assetData={showAssets ? (assetsQuery.data?.geojson ?? null) : null}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
          {layersOpen ? <div className="absolute left-3 top-14 z-20 max-h-[55%] w-[min(18rem,calc(100%-1.5rem))] overflow-auto border border-white/10 bg-[#0c0c0c]/95 shadow-2xl backdrop-blur-sm md:hidden"><LayerPanel open={layersOpen} onToggle={() => setLayersOpen(false)} quantLayer={visibleQuant} onQuantLayer={setQuantLayer} showNetwork={showNetwork} onShowNetwork={setShowNetwork} showAssets={showAssets} onShowAssets={setShowAssets} chemistry={chemistry} layers={LAYER_META} groups={QUANT_LAYERS} /></div> : null}
          {inspectorOpen && selectedId ? <div className="absolute bottom-3 left-3 right-3 z-20 max-h-[48%] overflow-auto border border-white/10 bg-[#0c0c0c]/95 shadow-2xl backdrop-blur-sm lg:hidden"><Inspector open onToggle={() => setInspectorOpen(false)} detail={assetQuery.data ?? null} onProvenance={() => setProvenanceOpen(true)} twinHref={selectedId ? `/digital-twin?asset=${encodeURIComponent(selectedId)}&chemistry=${chemistry}` : undefined} /></div> : null}
          {layerMessage ? (
            <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-card/90 px-3 py-2 text-xs shadow">
              {layerMessage}
            </p>
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
            twinHref={
              selectedId
                ? `/digital-twin?asset=${encodeURIComponent(selectedId)}&chemistry=${chemistry}`
                : undefined
            }
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
