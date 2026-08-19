const OPENFREEMAP_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";

const fallbackStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "";

export const publicEnv = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  mapStyleUrlLight:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL_LIGHT || fallbackStyle || OPENFREEMAP_LIGHT,
  mapStyleUrlDark: process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK || fallbackStyle || OPENFREEMAP_DARK,
} as const;
