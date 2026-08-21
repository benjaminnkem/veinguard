"use client";

import {
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useMapStyle } from "@/lib/use-map-style";
import type { OperationsLayer } from "@/lib/operations";
import "maplibre-gl/dist/maplibre-gl.css";

interface OperationsMapProps {
  quantLayer: OperationsLayer;
  quantData: unknown;
  networkData: unknown;
  assetData: unknown;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const EMPTY = { type: "FeatureCollection", features: [] };

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
  const onSelectRef = useRef(onSelect);
  const { styleUrl, mounted } = useMapStyle();
  const [ready, setReady] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mounted || !container.current || mapRef.current) {
      return;
    }
    const map = new MapLibreMap({
      container: container.current,
      style: styleUrl,
      center: [-74.01, 40.711],
      zoom: 14.4,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      map.addSource("vg-tcm", { type: "geojson", data: EMPTY as never });
      map.addSource("vg-quant-fill", { type: "geojson", data: EMPTY as never });
      map.addSource("vg-quant-line", { type: "geojson", data: EMPTY as never });
      map.addSource("vg-quant-point", { type: "geojson", data: EMPTY as never });
      map.addSource("vg-network", { type: "geojson", data: EMPTY as never });
      map.addSource("vg-assets", { type: "geojson", data: EMPTY as never });
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
          "fill-opacity": 0.55,
          "fill-outline-color": "#00000033",
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
        id: "vg-network-line",
        type: "line",
        source: "vg-network",
        paint: {
          "line-color": [
            "match",
            ["get", "type"],
            "PUMP",
            "#38bdf8",
            "VALVE",
            "#a78bfa",
            "#94a3b8",
          ],
          "line-width": ["match", ["get", "type"], "PUMP", 3.5, 1.6],
        },
      });
      map.addLayer({
        id: "vg-quant-line",
        type: "line",
        source: "vg-quant-line",
        layout: { visibility: "none" },
        paint: {
          "line-width": 2.4,
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
            "match",
            ["get", "type"],
            "TANK",
            7,
            "RESERVOIR",
            7,
            "JUNCTION",
            3.5,
            5,
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "TANK",
            "#22c55e",
            "RESERVOIR",
            "#38bdf8",
            "JUNCTION",
            "#e2e8f0",
            "#fbbf24",
          ],
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#0f172a",
        },
      });
      const clickLayers = [
        "vg-assets",
        "vg-quant-point",
        "vg-network-line",
        "vg-quant-line",
        "vg-tcm-fill",
      ];
      for (const layerId of clickLayers) {
        map.on("click", layerId, (event: MapLayerMouseEvent) => {
          const id = String(
            event.features?.[0]?.properties?.id ?? event.features?.[0]?.id ?? "",
          );
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
      setReady((value) => value + 1);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mounted, styleUrl]);

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
    const empty = EMPTY as never;
    const data = (quantData ?? EMPTY) as never;
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
    setLayerVisibility(
      map,
      "vg-quant-point",
      quantLayer !== "tcm" && quantLayer !== "flow",
    );
    applyPointPaint(map, quantLayer);
  }, [quantLayer, quantData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getLayer("vg-network-line")) {
      return;
    }
    const source = map.getSource("vg-network") as GeoJSONSource | undefined;
    if (source) {
      source.setData((networkData ?? EMPTY) as never);
    }
    setLayerVisibility(map, "vg-network-line", Boolean(networkData));
  }, [networkData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getLayer("vg-assets")) {
      return;
    }
    const source = map.getSource("vg-assets") as GeoJSONSource | undefined;
    if (source) {
      source.setData((assetData ?? EMPTY) as never);
    }
    setLayerVisibility(map, "vg-assets", Boolean(assetData));
  }, [assetData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.isStyleLoaded() || !map.getSource("vg-assets")) {
      return;
    }
    map.setFeatureState(
      { source: "vg-assets", id: selectedId ?? "" },
      { selected: true },
    );
  }, [selectedId, ready]);

  return (
    <div className="relative h-full min-h-[280px] w-full">
      <div ref={container} className="h-full w-full" role="application" aria-label="Operations map" />
      <Legend layer={quantLayer} />
    </div>
  );
}

function setLayerVisibility(
  map: MapLibreMap,
  layerId: string,
  visible: boolean,
): void {
  if (!map.getLayer(layerId) || !map.isStyleLoaded()) {
    return;
  }
  try {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  } catch {
    // Style can still be swapping when the basemap theme changes.
  }
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
        title: "FortyGuard TCM (°C) — HISTORICAL captured cells",
        rows: [
          { color: "#fff4cc", label: "~31.8 °C" },
          { color: "#f4a261", label: "~32.4 °C" },
          { color: "#9b2226", label: "~33.2 °C" },
        ],
      };
    case "target":
      return {
        title: "Projected target breach (configured operational target)",
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
