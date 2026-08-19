#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/services/simulation"

pick_python() {
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    echo "$PYTHON_BIN"
    return
  fi
  local candidate
  for candidate in python3.12 python3.13 python3.11; do
    if command -v "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return
    fi
  done
  echo "WNTR is tested on Python 3.10–3.13. Install 3.12 (preferred) or 3.11 and re-run." >&2
  echo "Set PYTHON_BIN to an explicit interpreter if needed." >&2
  exit 1
}

python_bin="$(pick_python)"

if ! command -v "$python_bin" >/dev/null 2>&1; then
  echo "$python_bin is required to set up the simulation service." >&2
  exit 1
fi

"$python_bin" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
echo "Simulation virtualenv ready at services/simulation/.venv ($python_bin)"
