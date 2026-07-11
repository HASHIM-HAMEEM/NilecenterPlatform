#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_ID="$(sed -n 's/^project_id = "\([^"]*\)"/\1/p' supabase/config.toml | head -1)"
API_PORT="$(sed -n '/^\[api\]/,/^\[/s/^port = \([0-9]*\)/\1/p' supabase/config.toml | head -1)"
DB_CONTAINER="supabase_db_${PROJECT_ID}"

if [[ -z "$PROJECT_ID" || -z "$API_PORT" ]]; then
  printf 'Local Supabase project_id or API port is missing.\n' >&2
  exit 1
fi

if [[ -z "${DOCKER_HOST:-}" ]] && [[ -S "$HOME/.colima/nile-learn/docker.sock" ]]; then
  export DOCKER_HOST="unix://$HOME/.colima/nile-learn/docker.sock"
fi

for command_name in docker node supabase; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  printf 'Disposable local Supabase is not running: %s\n' "$DB_CONTAINER" >&2
  exit 1
fi

CONTAINER_PROJECT_ID="$(docker inspect "$DB_CONTAINER" \
  --format '{{ index .Config.Labels "com.supabase.cli.project" }}')"
COMPOSE_PROJECT_ID="$(docker inspect "$DB_CONTAINER" \
  --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
if [[ "$CONTAINER_PROJECT_ID" != "$PROJECT_ID" ]] \
  || [[ "$COMPOSE_PROJECT_ID" != "$PROJECT_ID" ]]; then
  printf 'Refusing session integration tests for an unrecognized database container.\n' >&2
  exit 1
fi

STATUS_OUTPUT="$(supabase status -o env 2>/dev/null)"
status_value() {
  local value
  value="$(printf '%s\n' "$STATUS_OUTPUT" | sed -n "s/^$1=//p" | head -1)"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s' "$value"
}

API_URL="$(status_value API_URL)"
ANON_KEY="$(status_value ANON_KEY)"
SERVICE_ROLE_KEY="$(status_value SERVICE_ROLE_KEY)"
JWT_SECRET="$(status_value JWT_SECRET)"
EXPECTED_API_URL="http://127.0.0.1:${API_PORT}"

if [[ "$API_URL" != "$EXPECTED_API_URL" ]]; then
  printf 'Refusing non-local Supabase URL: %s\n' "$API_URL" >&2
  exit 1
fi
if [[ -z "$ANON_KEY" || -z "$SERVICE_ROLE_KEY" || -z "$JWT_SECRET" ]]; then
  printf 'Local Supabase status did not return required test credentials.\n' >&2
  exit 1
fi

npm run check:phase2-session-schema

SUPABASE_URL="$API_URL" \
SUPABASE_SECRET_KEY="$SERVICE_ROLE_KEY" \
NILE_LOCAL_SUPABASE_ANON_KEY="$ANON_KEY" \
NILE_LOCAL_SUPABASE_JWT_SECRET="$JWT_SECRET" \
NILE_SESSION_REPOSITORY="supabase" \
  node --import tsx scripts/validate-phase2-session-supabase.ts
