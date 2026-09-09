"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeoJSONSource } from "maplibre-gl";
import { AppHeader, AppSelect, GhostButton } from "@/components/app-chrome";
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
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
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
  const [mobilePanel, setMobilePanel] = useState<"layers" | "inspector" | null>(null);

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
  const twinHref = selectedId
    ? `/digital-twin?asset=${encodeURIComponent(selectedId)}&chemistry=${chemistry}`
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <AppHeader current="operations">
        <AppSelect
          label="Chemistry"
          value={chemistry}
          onChange={(next) => {
            const value = next as ChemistryId;
            setChemistry(value);
            if (quantLayer === "nitrification" && value !== "MONOCHLORAMINE") {
              setQuantLayer("residual");
            }
          }}
        >
          <option value="FREE_CHLORINE">Free Chlorine</option>
          <option value="MONOCHLORAMINE">Monochloramine</option>
          <option value="CHLORINE_DIOXIDE" disabled>
            Chlorine Dioxide (coming soon)
          </option>
        </AppSelect>
        <GhostButton onClick={() => setProvenanceOpen(true)}>Provenance</GhostButton>
      </AppHeader>

      {contextError ? (
        <div
          role="alert"
          className="border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm"
        >
          {contextError instanceof Error
            ? contextError.message
            : "Operations data unavailable."}{" "}
          No placeholder map values are shown.
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
              if (layer === "nitrification" && chemistry !== "MONOCHLORAMINE") {
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
            <div className="pointer-events-auto flex gap-1 border border-border bg-card/95 p-1 shadow-xl backdrop-blur-sm">
              <button
                type="button"
                className={`px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                  mobilePanel === "layers" ? "bg-water/10 text-water" : "text-muted-foreground"
                }`}
                onClick={() =>
                  setMobilePanel((value) => (value === "layers" ? null : "layers"))
                }
              >
                Layers
              </button>
              <button
                type="button"
                className={`px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                  mobilePanel === "inspector" ? "bg-water/10 text-water" : "text-muted-foreground"
                }`}
                onClick={() =>
                  setMobilePanel((value) => (value === "inspector" ? null : "inspector"))
                }
              >
                Inspect
              </button>
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
          {mobilePanel === "layers" ? (
            <div className="absolute left-3 top-14 z-20 max-h-[55%] w-[min(18rem,calc(100%-1.5rem))] overflow-auto border border-border bg-card/95 shadow-2xl backdrop-blur-sm md:hidden">
              <LayerPanel
                open
                onToggle={() => setMobilePanel(null)}
                quantLayer={visibleQuant}
                onQuantLayer={setQuantLayer}
                showNetwork={showNetwork}
                onShowNetwork={setShowNetwork}
                showAssets={showAssets}
                onShowAssets={setShowAssets}
                chemistry={chemistry}
                layers={LAYER_META}
                groups={QUANT_LAYERS}
              />
            </div>
          ) : null}
          {mobilePanel === "inspector" && selectedId ? (
            <div className="absolute bottom-3 left-3 right-3 z-20 max-h-[48%] overflow-auto border border-border bg-card/95 shadow-2xl backdrop-blur-sm lg:hidden">
              <Inspector
                open
                onToggle={() => setMobilePanel(null)}
                detail={assetQuery.data ?? null}
                onProvenance={() => setProvenanceOpen(true)}
                twinHref={twinHref}
              />
            </div>
          ) : null}
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
            twinHref={twinHref}
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
