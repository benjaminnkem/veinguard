"use client";

import { useEffect } from "react";

export function TheatreStudioLoader() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_THEATRE_STUDIO !== "true") {
      return;
    }

    let cancelled = false;
    void import("@theatre/studio").then(
      (studioModule) => {
        if (cancelled) {
          return;
        }
        const studio = studioModule.default;
        studio.initialize();
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
