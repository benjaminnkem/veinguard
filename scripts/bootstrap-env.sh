#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

copy_env() {
  local example="$1"
  local target="$2"
  if [[ ! -f "$target" ]]; then
    cp "$example" "$target"
    echo "Created $target"
  else
    echo "Kept existing $target"
  fi
}

replace_placeholder() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=replace-with-generated" "$file"; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=replace-with-generated.*|${key}=${value}|" "$file"
    else
      sed -i '' "s|^${key}=replace-with-generated.*|${key}=${value}|" "$file"
    fi
  fi
}

copy_env "$root/apps/api/.env.example" "$root/apps/api/.env"
copy_env "$root/apps/worker/.env.example" "$root/apps/worker/.env"
copy_env "$root/apps/web/.env.local.example" "$root/apps/web/.env.local"
copy_env "$root/services/simulation/.env.example" "$root/services/simulation/.env"

jwt_access="$(openssl rand -hex 32)"
jwt_refresh="$(openssl rand -hex 32)"
service_token="$(openssl rand -hex 32)"

replace_placeholder "$root/apps/api/.env" "JWT_ACCESS_SECRET" "$jwt_access"
replace_placeholder "$root/apps/api/.env" "JWT_REFRESH_SECRET" "$jwt_refresh"
replace_placeholder "$root/apps/api/.env" "SIMULATION_SERVICE_TOKEN" "$service_token"
replace_placeholder "$root/apps/worker/.env" "SIMULATION_SERVICE_TOKEN" "$service_token"
replace_placeholder "$root/services/simulation/.env" "SERVICE_TOKEN" "$service_token"

echo "Env files are ready. Add FORTYGUARD_API_KEY and GEMINI_API_KEY_1..4 locally; do not commit them."
