#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/services/simulation"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Simulation venv is missing. Run: pnpm setup:simulation" >&2
  exit 1
fi

exec .venv/bin/uvicorn veinguard_sim.main:app --reload --host 0.0.0.0 --port 8000
