import { Suspense } from "react";
import { TwinShell } from "@/components/twin/twin-shell";

export default function DigitalTwinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading digital twin…
        </div>
      }
    >
      <TwinShell />
    </Suspense>
  );
}
