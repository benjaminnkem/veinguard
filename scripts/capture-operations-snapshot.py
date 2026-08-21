#!/usr/bin/env python3
"""Write a compact operations snapshot from the real Net3 + FortyGuard fixture."""

from __future__ import annotations

import json
from pathlib import Path

from veinguard_sim.operations.snapshot import build_operations_snapshot

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "operations" / "demo-operations-v1.json"


def main() -> None:
    snapshot = build_operations_snapshot()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT} nodes={len(snapshot['nodes'])} links={len(snapshot['links'])}")


if __name__ == "__main__":
    main()
