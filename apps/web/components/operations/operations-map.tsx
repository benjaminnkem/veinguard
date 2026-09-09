"use client";

import {
  Map as MapLibreMap,
  LngLatBounds,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useMapStyle } from "@/lib/use-map-style";
import type { GeoJsonCollection, OperationsLayer } from "@/lib/operations";
import "maplibre-gl/dist/maplibre-gl.css";

// Next.js Turbopack does not emit maplibre-gl-shared.mjs next to the worker.
// Serve both files from /public/maplibre (see scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

interface OperationsMapProps {
  quantLayer: OperationsLayer;
  quantData: GeoJsonCollection;
  networkData: GeoJsonCollection | null;
  assetData: GeoJsonCollection | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const EMPTY: GeoJsonCollection = { type: "FeatureCollection", features: [] };

export function OperationsMap({
  quantLayer,
  quantData,
  networkData,
  assetData,
  selectedId,
  onSelect,
}: OperationsMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectedRef = useRef<string | null>(null);
  const fittedNetworkRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const quantDataRef = useRef(quantData);
  const quantLayerRef = useRef(quantLayer);
  const networkDataRef = useRef(networkData);
  const assetDataRef = useRef(assetData);
  const { styleUrl } = useMapStyle();
  const [ready, setReady] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    quantDataRef.current = quantData;
    quantLayerRef.current = quantLayer;
    networkDataRef.current = networkData;
    assetDataRef.current = assetData;
  }, [assetData, networkData, quantData, quantLayer]);

  useEffect(() => {
    const el = container.current;
    if (!el) {
      return;
    }
    let cancelled = false;
    let map: MapLibreMap | null = null;

    const createMap = (): MapLibreMap | null => {
      setMapError(null);
      let instance: MapLibreMap;
      try {
        instance = new MapLibreMap({
          container: el,
          style: styleUrl,
          center: [-74.01, 40.711],
          zoom: 14.4,
        });
      } catch (error) {
        setMapError(
          error instanceof Error && /webgl/i.test(error.message)
            ? "Map tiles need WebGL. Overlays and inspector still work in a WebGL-capable browser."
            : "Basemap failed to start. Network overlays may be unavailable.",
        );
        return null;
      }
      mapRef.current = instance;
      instance.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      instance.on("error", (event) => {
        // Do not surface a style-provider response verbatim. It can be noisy,
        // provider-specific, and is not an actionable operator message.
        if (event.error) {
          setMapError(
            "Basemap unavailable. Network overlays may be unavailable until the map reconnects.",
          );
        }
      });
      instance.on("load", () => {
        if (cancelled) {
          return;
        }
        styleBasemap(instance);
        addOverlayLayers(instance, onSelectRef);
        hydrateOverlaySources(
          instance,
          quantLayerRef.current,
          quantDataRef.current,
          networkDataRef.current,
          assetDataRef.current,
        );
        instance.resize();
        setReady((value) => value + 1);
        // Some third-party styles finish their initial style work after `load`.
        // Trigger a second source sync once MapLibre is idle so initial query
        // results are not contingent on a later user layer change.
        instance.once("idle", () => {
          if (!cancelled) setReady((value) => value + 1);
        });
      });
      return instance;
    };

    const observer = new ResizeObserver(() => {
      if (cancelled) {
        return;
      }
      if (!map && el.clientWidth > 0 && el.clientHeight > 0) {
        map = createMap();
        return;
      }
      map?.resize();
    });

    observer.observe(el);
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      map = createMap();
    }
    return () => {
      cancelled = true;
      observer.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getLayer("vg-tcm-fill")) {
      return;
    }
    const tcm = map.getSource("vg-tcm") as GeoJSONSource | undefined;
    const fill = map.getSource("vg-quant-fill") as GeoJSONSource | undefined;
    const line = map.getSource("vg-quant-line") as GeoJSONSource | undefined;
    const point = map.getSource("vg-quant-point") as GeoJSONSource | undefined;
    if (!tcm || !fill || !line || !point) {
      return;
    }
    const empty = EMPTY;
    const data = quantData;
    if (quantLayer === "tcm") {
      tcm.setData(data);
      fill.setData(empty);
      line.setData(empty);
      point.setData(empty);
    } else if (quantLayer === "flow") {
      tcm.setData(empty);
      fill.setData(empty);
      line.setData(data);
      point.setData(empty);
    } else {
      tcm.setData(empty);
      fill.setData(empty);
      line.setData(empty);
      point.setData(data);
    }
    setLayerVisibility(map, "vg-tcm-fill", quantLayer === "tcm");
    setLayerVisibility(map, "vg-quant-line", quantLayer === "flow");
    setLayerVisibility(map, "vg-quant-point", quantLayer !== "tcm" && quantLayer !== "flow");
    applyPointPaint(map, quantLayer);
  }, [quantLayer, quantData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getLayer("vg-network-line")) {
      return;
    }
    const source = map.getSource("vg-network") as GeoJSONSource | undefined;
    if (source) {
      source.setData(networkData ?? EMPTY);
      if (networkData && !fittedNetworkRef.current) {
        const bounds = boundsForCollection(networkData);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 72, right: 56, bottom: 56, left: 56 },
            duration: 0,
            maxZoom: 16.5,
          });
          fittedNetworkRef.current = true;
        }
      }
    }
    setLayerVisibility(map, "vg-network-line", Boolean(networkData));
    setLayerVisibility(map, "vg-network-casing", Boolean(networkData));
  }, [networkData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getLayer("vg-assets")) {
      return;
    }
    const source = map.getSource("vg-assets") as GeoJSONSource | undefined;
    if (source) {
      source.setData(assetData ?? EMPTY);
    }
    setLayerVisibility(map, "vg-assets", Boolean(assetData));
    setLayerVisibility(map, "vg-assets-glyph", Boolean(assetData));
  }, [assetData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getSource("vg-assets")) {
      return;
    }
    if (selectedRef.current) {
      map.setFeatureState({ source: "vg-assets", id: selectedRef.current }, { selected: false });
    }
    if (selectedId) {
      map.setFeatureState({ source: "vg-assets", id: selectedId }, { selected: true });
    }
    selectedRef.current = selectedId;
  }, [selectedId, ready]);

  return (
    <div className="absolute inset-0 min-h-[320px] bg-background">
      <div
        ref={container}
        className="absolute inset-0"
        role="application"
        aria-label="Operations map"
      />
      {mapError ? (
        <p
          role="alert"
          className="absolute left-3 top-3 z-10 max-w-sm rounded-md bg-card/95 px-3 py-2 text-xs"
        >
          Map failed: {mapError}
        </p>
      ) : null}
      <Legend layer={quantLayer} />
    </div>
  );
}

function addOverlayLayers(map: MapLibreMap, onSelectRef: { current: (id: string) => void }): void {
  map.addSource("vg-tcm", { type: "geojson", data: EMPTY });
  map.addSource("vg-quant-fill", { type: "geojson", data: EMPTY });
  map.addSource("vg-quant-line", { type: "geojson", data: EMPTY });
  map.addSource("vg-quant-point", { type: "geojson", data: EMPTY });
  map.addSource("vg-network", { type: "geojson", data: EMPTY });
  map.addSource("vg-assets", { type: "geojson", data: EMPTY, generateId: true });
  map.addLayer({
    id: "vg-tcm-fill",
    type: "fill",
    source: "vg-tcm",
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["to-number", ["get", "average_temperature"], 0],
        31.8,
        "#fff4cc",
        32.4,
        "#f4a261",
        33.2,
        "#9b2226",
      ],
      "fill-opacity": 0.32,
      "fill-outline-color": "#F59E0B55",
    },
  });
  map.addLayer({
    id: "vg-quant-fill",
    type: "fill",
    source: "vg-quant-fill",
    layout: { visibility: "none" },
    paint: { "fill-color": "#888", "fill-opacity": 0.4 },
  });
  map.addLayer({
    id: "vg-network-casing",
    type: "line",
    source: "vg-network",
    paint: {
      "line-color": "#020303",
      "line-opacity": 0.96,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 9],
      "line-blur": 0.4,
    },
  });
  map.addLayer({
    id: "vg-network-line",
    type: "line",
    source: "vg-network",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": [
        "case",
        ["==", ["get", "type"], "PUMP"],
        "#67D5EE",
        ["==", ["get", "type"], "VALVE"],
        "#BAE6FD",
        "#2A454A",
      ],
      "line-opacity": 0.9,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 3.2],
    },
  });
  map.addLayer({
    id: "vg-quant-line",
    type: "line",
    source: "vg-quant-line",
    layout: { visibility: "none" },
    paint: {
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 4],
      "line-dasharray": [1.1, 1.8],
      "line-opacity": 0.84,
      "line-color": [
        "interpolate",
        ["linear"],
        ["abs", ["to-number", ["get", "flowM3s"], 0]],
        0,
        "#94a3b8",
        0.2,
        "#0ea5e9",
        0.8,
        "#1d4ed8",
      ],
    },
  });
  map.addLayer({
    id: "vg-quant-point",
    type: "circle",
    source: "vg-quant-point",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": 6,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#0b0f14",
      "circle-color": "#64748b",
    },
  });
  map.addLayer({
    id: "vg-assets",
    type: "circle",
    source: "vg-assets",
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        9,
        ["match", ["get", "type"], "TANK", 7, "RESERVOIR", 7, "JUNCTION", 3.5, 5],
      ],
      "circle-color": [
        "match",
        ["get", "type"],
        "TANK",
        "#0EA5C6",
        "RESERVOIR",
        "#67D5EE",
        "JUNCTION",
        "#E4E4E7",
        "#F59E0B",
      ],
      "circle-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0.9],
      "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1.2],
      "circle-stroke-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#BAE6FD",
        "#081114",
      ],
      "circle-stroke-opacity": 0.95,
    },
  });
  map.addLayer({
    id: "vg-assets-glyph",
    type: "symbol",
    source: "vg-assets",
    layout: {
      "text-field": [
        "match",
        ["get", "type"],
        "RESERVOIR",
        "▽",
        "TANK",
        "▣",
        "PUMP",
        "◆",
        "VALVE",
        "⋈",
        "·",
      ],
      "text-size": ["match", ["get", "type"], "JUNCTION", 12, 15],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#050505",
        ["match", ["get", "type"], "JUNCTION", "#081114", "#E4E4E7"],
      ],
      "text-halo-color": "#050505",
      "text-halo-width": 0.35,
    },
  });
  const clickLayers = [
    "vg-assets",
    "vg-quant-point",
    "vg-network-line",
    "vg-network-casing",
    "vg-quant-line",
    "vg-tcm-fill",
  ];
  for (const layerId of clickLayers) {
    map.on("click", layerId, (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id ?? event.features?.[0]?.id ?? "");
      if (id) {
        onSelectRef.current(id);
      }
    });
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

function styleBasemap(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers ?? []) {
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", "#050505");
        continue;
      }
      if (layer.type === "symbol") {
        map.setPaintProperty(layer.id, "text-color", "#71717A");
        map.setPaintProperty(layer.id, "text-halo-color", "#050505");
        map.setPaintProperty(layer.id, "text-halo-width", 1);
      }
      if (layer.type === "line") {
        map.setPaintProperty(layer.id, "line-color", "#151B1D");
        map.setPaintProperty(layer.id, "line-opacity", 0.45);
      }
      if (layer.type === "fill") {
        map.setPaintProperty(layer.id, "fill-color", "#080C0D");
        map.setPaintProperty(layer.id, "fill-opacity", 0.72);
      }
    } catch {
      // Third-party style layers can omit a property; the VeinGuard overlays remain authoritative.
    }
  }
}

function setLayerVisibility(map: MapLibreMap, layerId: string, visible: boolean): void {
  if (!map.getLayer(layerId) || !map.isStyleLoaded()) {
    return;
  }
  try {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  } catch {
    // Style can still be swapping when the basemap theme changes.
  }
}

function hydrateOverlaySources(
  map: MapLibreMap,
  quantLayer: OperationsLayer,
  quantData: GeoJsonCollection,
  networkData: GeoJsonCollection | null,
  assetData: GeoJsonCollection | null,
): void {
  const tcm = map.getSource("vg-tcm") as GeoJSONSource | undefined;
  const fill = map.getSource("vg-quant-fill") as GeoJSONSource | undefined;
  const line = map.getSource("vg-quant-line") as GeoJSONSource | undefined;
  const point = map.getSource("vg-quant-point") as GeoJSONSource | undefined;
  const network = map.getSource("vg-network") as GeoJSONSource | undefined;
  const assets = map.getSource("vg-assets") as GeoJSONSource | undefined;
  if (!tcm || !fill || !line || !point || !network || !assets) return;

  tcm.setData(quantLayer === "tcm" ? quantData : EMPTY);
  fill.setData(EMPTY);
  line.setData(quantLayer === "flow" ? quantData : EMPTY);
  point.setData(quantLayer !== "tcm" && quantLayer !== "flow" ? quantData : EMPTY);
  network.setData(networkData ?? EMPTY);
  assets.setData(assetData ?? EMPTY);

  setLayerVisibility(map, "vg-tcm-fill", quantLayer === "tcm");
  setLayerVisibility(map, "vg-quant-line", quantLayer === "flow");
  setLayerVisibility(map, "vg-quant-point", quantLayer !== "tcm" && quantLayer !== "flow");
  setLayerVisibility(map, "vg-network-line", Boolean(networkData));
  setLayerVisibility(map, "vg-network-casing", Boolean(networkData));
  setLayerVisibility(map, "vg-assets", Boolean(assetData));
  setLayerVisibility(map, "vg-assets-glyph", Boolean(assetData));
  applyPointPaint(map, quantLayer);
}

function boundsForCollection(collection: GeoJsonCollection): LngLatBounds | null {
  // MapLibre accepts either an inline GeoJSON value or a URL string. Only a
  // FeatureCollection has feature geometries that can be used for fitting.
  if (typeof collection === "string" || collection.type !== "FeatureCollection") {
    return null;
  }

  const bounds = new LngLatBounds();
  let hasCoordinate = false;

  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      bounds.extend([value[0], value[1]]);
      hasCoordinate = true;
      return;
    }
    for (const child of value) visit(child);
  };

  const visitGeometry = (
    geometry: NonNullable<(typeof collection.features)[number]["geometry"]>,
  ): void => {
    if (geometry.type === "GeometryCollection") {
      for (const child of geometry.geometries) visitGeometry(child);
    } else {
      visit(geometry.coordinates);
    }
  };

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    visitGeometry(geometry);
  }
  return hasCoordinate ? bounds : null;
}

function applyPointPaint(map: MapLibreMap, layer: OperationsLayer): void {
  if (!map.getLayer("vg-quant-point")) {
    return;
  }
  if (layer === "target") {
    map.setPaintProperty("vg-quant-point", "circle-color", [
      "case",
      ["==", ["get", "projectedTargetBreach"], true],
      "#ef4444",
      "#64748b",
    ]);
    return;
  }
  if (layer === "nitrification") {
    map.setPaintProperty("vg-quant-point", "circle-color", [
      "match",
      ["get", "nitrificationLevel"],
      "HIGH",
      "#b45309",
      "ELEVATED",
      "#ca8a04",
      "LOW",
      "#64748b",
      "#334155",
    ]);
    return;
  }
  const metric =
    layer === "pressure"
      ? "pressureM"
      : layer === "water-age"
        ? "waterAgeHours"
        : layer === "water-temperature"
          ? "modeledWaterTemperatureC"
          : "residualMgL";
  const stops =
    layer === "pressure"
      ? [0, "#94a3b8", 40, "#38bdf8", 90, "#1d4ed8"]
      : layer === "water-age"
        ? [0, "#86efac", 24, "#fbbf24", 72, "#b45309"]
        : layer === "water-temperature"
          ? [15, "#93c5fd", 22, "#fb923c", 30, "#9b2226"]
          : [0, "#ef4444", 0.2, "#fbbf24", 1, "#22c55e"];
  map.setPaintProperty("vg-quant-point", "circle-color", [
    "case",
    ["==", ["get", "hasValue"], false],
    "#475569",
    ["interpolate", ["linear"], ["to-number", ["get", metric], 0], ...stops],
  ]);
}

function Legend({ layer }: { layer: OperationsLayer }) {
  const items = legendFor(layer);
  return (
    <div className="absolute bottom-3 left-3 max-w-xs rounded-md bg-card/95 p-3 text-xs shadow-lg">
      <p className="font-medium">{items.title}</p>
      <ul className="mt-2 space-y-1">
        {items.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: row.color }}
              aria-hidden="true"
            />
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function legendFor(layer: OperationsLayer): {
  title: string;
  rows: Array<{ color: string; label: string }>;
} {
  switch (layer) {
    case "tcm":
      return {
        title: "FortyGuard TCM (°C)",
        rows: [
          { color: "#fff4cc", label: "~31.8 °C" },
          { color: "#f4a261", label: "~32.4 °C" },
          { color: "#9b2226", label: "~33.2 °C" },
        ],
      };
    case "target":
      return {
        title: "Projected target breach",
        rows: [
          { color: "#ef4444", label: "Projected breach at sample time" },
          { color: "#64748b", label: "At or above configured target" },
        ],
      };
    case "nitrification":
      return {
        title: "Nitrification-favorable conditions (not a probability)",
        rows: [
          { color: "#64748b", label: "LOW — not indicated" },
          { color: "#ca8a04", label: "ELEVATED" },
          { color: "#b45309", label: "HIGH" },
          { color: "#334155", label: "Not modeled" },
        ],
      };
    case "flow":
      return {
        title: "Modeled flow |Q| (m³/s) at sample time",
        rows: [
          { color: "#94a3b8", label: "Low" },
          { color: "#0ea5e9", label: "Mid" },
          { color: "#1d4ed8", label: "High" },
        ],
      };
    case "residual":
      return {
        title: "Modeled residual (mg/L)",
        rows: [
          { color: "#ef4444", label: "Near 0" },
          { color: "#fbbf24", label: "Around 0.2" },
          { color: "#22c55e", label: "Higher residual" },
          { color: "#475569", label: "No modeled value" },
        ],
      };
    case "water-temperature":
      return {
        title: "Modeled water temperature (°C)",
        rows: [
          { color: "#93c5fd", label: "~15 °C" },
          { color: "#fb923c", label: "~22 °C" },
          { color: "#9b2226", label: "~30 °C" },
          { color: "#475569", label: "No coverage / not modeled" },
        ],
      };
    case "water-age":
      return {
        title: "Modeled water age (h)",
        rows: [
          { color: "#86efac", label: "Fresh" },
          { color: "#fbbf24", label: "~24 h" },
          { color: "#b45309", label: "≥ 72 h" },
        ],
      };
    default:
      return {
        title: "Modeled pressure (m) at sample time",
        rows: [
          { color: "#94a3b8", label: "Lower" },
          { color: "#38bdf8", label: "Mid" },
          { color: "#1d4ed8", label: "Higher" },
        ],
      };
  }
}
