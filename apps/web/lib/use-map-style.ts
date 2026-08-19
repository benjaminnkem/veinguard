"use client";

import { useTheme } from "next-themes";
import { publicEnv } from "./public-env";

export type ResolvedMapTheme = "light" | "dark";

export function mapStyleUrlForTheme(theme: ResolvedMapTheme): string {
  return theme === "light" ? publicEnv.mapStyleUrlLight : publicEnv.mapStyleUrlDark;
}

export function useMapStyle(): {
  styleUrl: string;
  theme: ResolvedMapTheme;
  mounted: boolean;
} {
  const { resolvedTheme } = useTheme();
  const mounted = resolvedTheme != null;
  const theme: ResolvedMapTheme = resolvedTheme === "light" ? "light" : "dark";

  return {
    styleUrl: mapStyleUrlForTheme(theme),
    theme,
    mounted,
  };
}
