"use client";

import type { ProvenancePayload } from "@/lib/operations";

export function ProvenanceDrawer({
  open,
  onClose,
  payload,
}: {
  open: boolean;
  onClose: () => void;
  payload: ProvenancePayload | null;
}) {
  if (!open) {
    return null;
  }
  const network = (payload?.network ?? {}) as {
    network?: Record<string, unknown>;
    thermal?: Array<Record<string, unknown>>;
    engines?: Record<string, unknown>;
    models?: Record<string, unknown>;
  };
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provenance-title"
    >
      <button
        type="button"
        className="h-full flex-1"
        aria-label="Close provenance"
        onClick={onClose}
      />
      <aside className="h-full w-full max-w-md overflow-auto bg-card p-5 text-sm shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="provenance-title" className="text-base font-semibold">
            Provenance
          </h2>
          <button type="button" onClick={onClose} className="text-xs">
            Close
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{payload?.notice}</p>
        <Section title="Snapshot" value={payload?.snapshotId} />
        <Section title="Observation time" value={payload?.observationTime} />
        <Section
          title="Network SHA-256"
          value={String(network.network?.sha256 ?? "")}
        />
        <Section
          title="Georeference"
          value={String(network.network?.geoReferenceType ?? "")}
        />
        <Section
          title="FortyGuard activity"
          value={String(network.thermal?.[0]?.providerActivityId ?? "")}
        />
        <Section
          title="WNTR"
          value={String(network.engines?.wntrVersion ?? "")}
        />
        <Section
          title="EPANET"
          value={String(network.engines?.epanetVersion ?? "")}
        />
        <Section
          title="Thermal model"
          value={String(network.models?.thermalModelVersion ?? "")}
        />
        <Section
          title="Chemistry model"
          value={String(network.models?.chemistryModelVersion ?? "")}
        />
        <Section
          title="Monochloramine"
          value={String(network.models?.monochloramineModelVersion ?? "not on this run")}
        />
      </aside>
    </div>
  );
}

function Section({ title, value }: { title: string; value?: string }) {
  return (
    <p className="mt-3">
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <span className="break-all font-mono text-xs">{value || "—"}</span>
    </p>
  );
}
