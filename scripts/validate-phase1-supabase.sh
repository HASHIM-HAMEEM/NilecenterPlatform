#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAKE_AUTH_USER_ID="00000000-0000-4000-8000-000000000001"
PROJECT_ID="$(sed -n 's/^project_id = "\([^"]*\)"/\1/p' supabase/config.toml | head -1)"
DB_CONTAINER="supabase_db_${PROJECT_ID}"

if [[ -z "$PROJECT_ID" ]]; then
  printf 'Supabase project_id is missing from supabase/config.toml\n' >&2
  exit 1
fi

if [[ -z "${DOCKER_HOST:-}" ]] && [[ -S "$HOME/.colima/nile-learn/docker.sock" ]]; then
  export DOCKER_HOST="unix://$HOME/.colima/nile-learn/docker.sock"
fi

for command_name in docker supabase npm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command_name" >&2
    exit 1
  fi
done

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  printf 'Local Supabase database container is not running: %s\n' "$DB_CONTAINER" >&2
  printf 'Start the local stack before running this destructive local-only gate.\n' >&2
  exit 1
fi

CONTAINER_PROJECT_ID="$(docker inspect "$DB_CONTAINER" \
  --format '{{ index .Config.Labels "com.supabase.cli.project" }}')"
COMPOSE_PROJECT_ID="$(docker inspect "$DB_CONTAINER" \
  --format '{{ index .Config.Labels "com.docker.compose.project" }}')"

if [[ "$CONTAINER_PROJECT_ID" != "$PROJECT_ID" ]] \
  || [[ "$COMPOSE_PROJECT_ID" != "$PROJECT_ID" ]]; then
  printf 'Refusing destructive validation for an unrecognized container: %s\n' \
    "$DB_CONTAINER" >&2
  exit 1
fi

run_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  "$@"
}

psql_file() {
  local file_path="$1"
  shift
  docker exec -i "$DB_CONTAINER" \
    psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@" < "$file_path"
}

insert_assertion_auth_user() {
  docker exec -i "$DB_CONTAINER" psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 \
    -v nile_test_auth_user_id="$FAKE_AUTH_USER_ID" <<'SQL'
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  :'nile_test_auth_user_id',
  'authenticated',
  'authenticated',
  'phase1.assertion@nilelearn.local',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Phase 1 Assertion User"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;
SQL
}

run_assertions() {
  insert_assertion_auth_user
  psql_file docs/supabase-phase-1-identity-session-rls-assertions.sql \
    -v nile_test_auth_user_id="$FAKE_AUTH_USER_ID"
}

assert_rollback_clean() {
  local result
  result="$(docker exec -i "$DB_CONTAINER" psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -At <<'SQL'
with phase1_tables(name) as (
  values
    ('branches'), ('app_users'), ('departments'), ('department_branches'),
    ('permissions'), ('role_permissions'), ('role_grants'),
    ('role_grant_branch_scopes'), ('role_grant_department_scopes'),
    ('staff_profiles'), ('staff_subjects'), ('auth_sessions'),
    ('command_executions'), ('audit_logs'), ('outbox_events'),
    ('integration_connections'), ('integration_env_requirements'),
    ('external_records'), ('sync_cursors'), ('sync_runs'), ('sync_run_items'),
    ('reconciliation_cases'), ('migration_runs'), ('migration_run_items'),
    ('migration_evidence')
)
select
  count(to_regclass('public.' || phase1_tables.name)) filter (
    where to_regclass('public.' || phase1_tables.name) is not null
  ) || '|' ||
  (select count(*) from pg_namespace where nspname = 'nile_private')
from phase1_tables;
SQL
)"

  if [[ "$result" != "0|0" ]]; then
    printf 'Phase 1 rollback was not clean: %s\n' "$result" >&2
    exit 1
  fi
  printf 'Phase 1 rollback is clean: %s\n' "$result"
}

assert_seed_counts() {
  local result
  result="$(docker exec -i "$DB_CONTAINER" psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -At <<'SQL'
select
  (select count(*) from public.app_users) || '|' ||
  (select count(*) from public.role_grants) || '|' ||
  (select count(*) from public.role_grant_branch_scopes) || '|' ||
  (select count(*) from public.role_grant_department_scopes) || '|' ||
  (select count(*) from public.staff_profiles) || '|' ||
  (select count(*) from public.permissions);
SQL
)"

  if [[ "$result" != "6|6|5|2|5|6" ]]; then
    printf 'Unexpected Phase 1 fake seed counts: %s\n' "$result" >&2
    exit 1
  fi
  printf 'Phase 1 fake seed counts: %s\n' "$result"
}

lint_local_schema() {
  supabase db lint --local \
    --schema public,nile_private \
    --level warning \
    --fail-on warning
}

run_step "Static Phase 1 contract" npm run check:phase1-schema
run_step "Reset local Supabase from migration history" supabase db reset --local
run_step "First semantic assertion pass" run_assertions
run_step "First Supabase schema lint" lint_local_schema
run_step "Apply reviewed Phase 2B rollback" \
  psql_file docs/supabase-phase-2b-session-lifecycle-rollback.sql
run_step "Apply reviewed rollback" \
  psql_file docs/supabase-phase-1-identity-session-rls-rollback.sql
run_step "Verify clean rollback" assert_rollback_clean
run_step "Reapply migrations and fake seed" supabase db reset --local
run_step "Second semantic assertion pass" run_assertions
run_step "Second Supabase schema lint" lint_local_schema
run_step "Verify deterministic fake seed" assert_seed_counts

printf '\nPhase 1 local Supabase promotion gate passed.\n'
