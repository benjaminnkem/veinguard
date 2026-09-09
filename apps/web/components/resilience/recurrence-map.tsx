"use client";

import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useMapStyle } from "@/lib/use-map-style";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const EMPTY = { type: "FeatureCollection", features: [] };

export function RecurrenceMap({
  data,
}: {
  data: { type: string; features: unknown[] } | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const { styleUrl } = useMapStyle();

  useEffect(() => {
    const el = container.current;
    if (!el) {
      return;
    }
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: el,
        style: styleUrl,
        center: [-74.01, 40.711],
        zoom: 14.4,
      });
    } catch {
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      map.addSource("recurrence", {
        type: "geojson",
        data: (data ?? EMPTY) as never,
      });
      map.addLayer({
        id: "recurrence-circle",
        type: "circle",
        source: "recurrence",
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["get", "recurring"], false],
            8,
            5,
          ],
          "circle-color": [
            "case",
            ["boolean", ["get", "recurring"], false],
            "#b45309",
            "#64748b",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0f172a",
        },
      });
      map.resize();
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource("recurrence")) {
      return;
    }
    (map.getSource("recurrence") as GeoJSONSource).setData(
      (data ?? EMPTY) as never,
    );
  }, [data]);

  return <div ref={container} className="h-full min-h-[280px] w-full" />;
}
