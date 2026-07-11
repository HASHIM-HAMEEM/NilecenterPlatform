-- Nile Learn Phase 1 identity, scope, session, audit, outbox, and mapping SQL.
--
-- Status: reviewed local-only migration source. An exact copy is promoted in
-- supabase/migrations for disposable local Supabase validation.
-- Do not apply this file or its promoted migration to linked, preview, shared,
-- or production Supabase without a separately approved promotion slice.
--
-- This draft is additive. Existing public.platform_* compatibility tables are
-- intentionally untouched until snapshot retirement.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create schema nile_private;
revoke all on schema nile_private from public, anon, authenticated;

create function nile_private.jsonb_has_forbidden_keys(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  pair record;
  element jsonb;
begin
  case pg_catalog.jsonb_typeof(payload)
    when 'object' then
      for pair in
        select entry.key, entry.value
        from pg_catalog.jsonb_each(payload) as entry
      loop
        if pg_catalog.lower(pair.key) ~
          '(password|passwd|secret|api.?key|token|authorization|cookie|credential|private.?key|service.?role)' then
          return true;
        end if;

        if nile_private.jsonb_has_forbidden_keys(pair.value) then
          return true;
        end if;
      end loop;
    when 'array' then
      for element in
        select item.value
        from pg_catalog.jsonb_array_elements(payload) as item
      loop
        if nile_private.jsonb_has_forbidden_keys(element) then
          return true;
        end if;
      end loop;
    else
      return false;
  end case;

  return false;
end;
$$;

create function nile_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function nile_private.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name
    using errcode = '55000';
end;
$$;

create function nile_private.reject_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% rows must be retired, revoked, or archived, not deleted', tg_table_name
    using errcode = '55000';
end;
$$;

create function nile_private.preserve_app_user_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
    or old.legacy_id is distinct from new.legacy_id
    or old.created_at is distinct from new.created_at then
    raise exception 'Application user identity provenance is immutable'
      using errcode = '55000';
  end if;

  if old.auth_user_id is not null
    and old.auth_user_id is distinct from new.auth_user_id then
    raise exception 'An established Auth mapping cannot be cleared or reassigned'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code citext not null unique,
  name text not null,
  timezone text not null default 'Africa/Cairo',
  address jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  legacy_id text unique,
  full_name text not null,
  email citext not null unique,
  phone text,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'paused', 'disabled', 'archived')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or status = 'invited'),
  check (activated_at is null or auth_user_id is not null)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code citext not null unique,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.department_branches (
  department_id uuid not null references public.departments(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (department_id, branch_id)
);

create table public.permissions (
  code text primary key,
  category text not null,
  description text not null,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  check (code ~ '^[a-z][a-z0-9_.-]+$')
);

create table public.role_permissions (
  role text not null
    check (role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  permission_code text not null references public.permissions(code) on delete restrict,
  granted boolean not null default true,
  updated_by uuid references public.app_users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (role, permission_code)
);

create table public.role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  role text not null
    check (role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.app_users(id) on delete restrict,
  granted_reason text,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ends_at is null or ends_at > starts_at),
  check (
    (
      status = 'revoked'
      and revoked_at is not null
      and revocation_reason is not null
    )
    or (
      status <> 'revoked'
      and revoked_at is null
      and revoked_by is null
      and revocation_reason is null
    )
  ),
  exclude using gist (
    user_id with =,
    role with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'active')
);

create table public.role_grant_branch_scopes (
  id uuid primary key default gen_random_uuid(),
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  exclude using gist (
    role_grant_id with =,
    branch_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

create table public.role_grant_department_scopes (
  id uuid primary key default gen_random_uuid(),
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  exclude using gist (
    role_grant_id with =,
    department_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete restrict,
  title text,
  availability_status text not null default 'not_applicable'
    check (availability_status in ('available', 'limited', 'unavailable', 'not_applicable')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_subjects (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  subject text not null,
  teaching_level text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (staff_profile_id, subject, teaching_level)
);

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  user_id uuid not null references public.app_users(id) on delete restrict,
  active_role_grant_id uuid not null,
  provider text not null check (provider in ('supabase', 'demo')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  ip_hash bytea,
  user_agent_hash bytea,
  metadata jsonb not null default '{}'::jsonb,
  unique (id, user_id, active_role_grant_id),
  foreign key (active_role_grant_id, user_id)
    references public.role_grants(id, user_id) on delete restrict,
  check (expires_at > created_at),
  check (last_seen_at is null or last_seen_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (revoked_by is null or revoked_at is not null),
  check (not nile_private.jsonb_has_forbidden_keys(metadata))
);

create table public.command_executions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_user_id uuid not null references public.app_users(id) on delete restrict,
  actor_role_grant_id uuid not null,
  session_id uuid not null,
  command_type text not null,
  target_type text,
  target_id text,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  requires_outbox boolean not null default false,
  status text not null default 'started'
    check (status in ('started', 'succeeded')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (actor_role_grant_id, actor_user_id)
    references public.role_grants(id, user_id) on delete restrict,
  foreign key (session_id, actor_user_id, actor_role_grant_id)
    references public.auth_sessions(id, user_id, active_role_grant_id) on delete restrict,
  unique (id, actor_user_id, actor_role_grant_id, session_id),
  check ((status = 'succeeded') = (completed_at is not null))
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  command_id uuid not null references public.command_executions(id) on delete restrict,
  actor_user_id uuid not null references public.app_users(id) on delete restrict,
  actor_role_grant_id uuid not null,
  session_id uuid not null,
  request_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  branch_id uuid references public.branches(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '365 days'),
  foreign key (command_id, actor_user_id, actor_role_grant_id, session_id)
    references public.command_executions(
      id,
      actor_user_id,
      actor_role_grant_id,
      session_id
    ) on delete restrict,
  unique (command_id, action, entity_type, entity_id),
  check (not nile_private.jsonb_has_forbidden_keys(before_state)),
  check (not nile_private.jsonb_has_forbidden_keys(after_state)),
  check (not nile_private.jsonb_has_forbidden_keys(metadata)),
  check (retention_until >= occurred_at + interval '365 days')
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.command_executions(id) on delete restrict,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not nile_private.jsonb_has_forbidden_keys(payload)),
  check ((status = 'processing') = (locked_at is not null and locked_by is not null)),
  check ((status = 'succeeded') = (processed_at is not null))
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null,
  environment text not null default 'sandbox'
    check (environment in ('local', 'sandbox', 'preview', 'production')),
  mode text not null default 'disabled'
    check (mode in ('disabled', 'read_only', 'write_limited', 'migration')),
  status text not null default 'unconfigured'
    check (status in ('unconfigured', 'verifying', 'ready', 'degraded', 'disabled')),
  capabilities jsonb not null default '[]'::jsonb,
  last_verified_at timestamptz,
  verification_evidence_hash bytea,
  last_error text,
  created_by uuid references public.app_users(id) on delete restrict,
  updated_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, environment, label),
  check (jsonb_typeof(capabilities) = 'array'),
  check (not nile_private.jsonb_has_forbidden_keys(capabilities)),
  check (provider <> 'legacy_ems' or mode in ('disabled', 'read_only', 'migration')),
  check (provider <> 'moodle' or mode in ('disabled', 'read_only')),
  check (
    status <> 'ready'
    or (
      last_verified_at is not null
      and verification_evidence_hash is not null
      and octet_length(verification_evidence_hash) = 32
    )
  )
);

create table public.integration_env_requirements (
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  env_var_name text not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (connection_id, env_var_name),
  check (env_var_name ~ '^[A-Z][A-Z0-9_]+$')
);

create table public.external_records (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  internal_id uuid,
  external_id text not null,
  external_parent_id text,
  source_version text,
  source_updated_at timestamptz,
  source_hash bytea,
  sync_state text not null default 'discovered'
    check (sync_state in ('discovered', 'matched', 'synced', 'stale', 'error', 'ignored')),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, entity_type, external_id),
  unique (id, connection_id, entity_type),
  check (source_hash is null or octet_length(source_hash) = 32),
  check (not nile_private.jsonb_has_forbidden_keys(metadata)),
  check (
    sync_state <> 'synced'
    or (
      internal_id is not null
      and source_hash is not null
      and source_updated_at is not null
      and last_synced_at is not null
    )
  )
);

create unique index external_records_internal_mapping_uidx
  on public.external_records (connection_id, entity_type, internal_id)
  where internal_id is not null;

create table public.sync_cursors (
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  direction text not null check (direction in ('read', 'write')),
  cursor_value text,
  updated_at timestamptz not null default now(),
  primary key (connection_id, entity_type, direction)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  direction text not null check (direction in ('read', 'write')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  cursor_before text,
  cursor_after text,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  succeeded_count integer not null default 0 check (succeeded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text,
  created_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (finished_at is null or started_at is not null),
  check (finished_at is null or finished_at >= started_at),
  check (
    status not in ('succeeded', 'partial', 'failed', 'cancelled')
    or finished_at is not null
  ),
  check (succeeded_count + failed_count <= discovered_count)
);

create table public.sync_run_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  external_record_id uuid references public.external_records(id) on delete restrict,
  external_id text not null,
  status text not null
    check (status in ('succeeded', 'skipped', 'failed', 'needs_review')),
  source_hash bytea,
  error_class text,
  error_detail text,
  created_at timestamptz not null default now(),
  unique (sync_run_id, external_id),
  check (source_hash is null or octet_length(source_hash) = 32),
  check ((status = 'failed') = (error_class is not null))
);

create table public.reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  internal_id uuid,
  external_id text,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'matched', 'ignored', 'resolved')),
  resolution text,
  resolved_by uuid references public.app_users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status = 'open'
    or (resolution is not null and resolved_by is not null and resolved_at is not null)
  )
);

create unique index reconciliation_cases_one_open_uidx
  on public.reconciliation_cases (
    connection_id,
    entity_type,
    coalesce(internal_id::text, ''),
    coalesce(external_id, ''),
    reason
  )
  where status = 'open';

create table public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  run_kind text not null
    check (run_kind in ('dry_run', 'approved_import', 'final_delta', 'cutover', 'rollback')),
  status text not null default 'draft'
    check (status in ('draft', 'validating', 'ready', 'approved', 'applying', 'completed', 'failed', 'rolled_back')),
  source_watermark text,
  source_manifest_hash bytea not null check (octet_length(source_manifest_hash) = 32),
  source_count integer not null default 0 check (source_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  exception_count integer not null default 0 check (exception_count >= 0),
  approved_by uuid references public.app_users(id) on delete restrict,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  rollback_reference text,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, connection_id, entity_type),
  check (matched_count + exception_count <= source_count),
  check (imported_count <= matched_count),
  check (
    status not in ('approved', 'applying', 'completed')
    or (approved_by is not null and approved_at is not null)
  ),
  check (status <> 'rolled_back' or rollback_reference is not null),
  check (completed_at is null or started_at is not null),
  check (completed_at is null or completed_at >= started_at)
);

create table public.migration_run_items (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null,
  connection_id uuid not null,
  entity_type text not null,
  external_record_id uuid not null,
  external_id text not null,
  source_hash bytea not null check (octet_length(source_hash) = 32),
  match_status text not null
    check (match_status in ('unmatched', 'matched', 'ambiguous', 'rejected', 'imported')),
  internal_id uuid,
  validation_errors jsonb not null default '[]'::jsonb,
  before_image jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (migration_run_id, connection_id, entity_type)
    references public.migration_runs(id, connection_id, entity_type) on delete restrict,
  foreign key (external_record_id, connection_id, entity_type)
    references public.external_records(id, connection_id, entity_type) on delete restrict,
  unique (migration_run_id, external_id, source_hash),
  check (jsonb_typeof(validation_errors) = 'array'),
  check (not nile_private.jsonb_has_forbidden_keys(before_image)),
  check ((match_status = 'imported') = (internal_id is not null and applied_at is not null))
);

create unique index migration_run_items_one_import_uidx
  on public.migration_run_items (connection_id, entity_type, external_id, source_hash)
  where match_status = 'imported';

create table public.migration_evidence (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null references public.migration_runs(id) on delete restrict,
  evidence_type text not null
    check (evidence_type in (
      'dry_run_report',
      'reconciliation_approval',
      'final_delta',
      'cutover',
      'rollback',
      'credential_retirement'
    )),
  evidence_hash bytea not null check (octet_length(evidence_hash) = 32),
  summary text not null,
  recorded_by uuid not null references public.app_users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (migration_run_id, evidence_type, evidence_hash)
);

create index role_grants_user_effective_idx
  on public.role_grants (user_id, status, starts_at, ends_at);
create index role_grant_branch_scopes_grant_idx
  on public.role_grant_branch_scopes (role_grant_id, starts_at, ends_at);
create index role_grant_branch_scopes_branch_idx
  on public.role_grant_branch_scopes (branch_id);
create index role_grant_department_scopes_grant_idx
  on public.role_grant_department_scopes (role_grant_id, starts_at, ends_at);
create index role_grant_department_scopes_department_idx
  on public.role_grant_department_scopes (department_id);
create index auth_sessions_user_active_idx
  on public.auth_sessions (user_id, expires_at)
  where revoked_at is null;
create index auth_sessions_user_id_idx
  on public.auth_sessions (user_id);
create index auth_sessions_expires_at_idx
  on public.auth_sessions (expires_at) where revoked_at is null;
create index auth_sessions_revoked_at_idx
  on public.auth_sessions (revoked_at) where revoked_at is not null;
create index command_executions_actor_started_idx
  on public.command_executions (actor_user_id, started_at desc);
create index audit_logs_actor_time_idx
  on public.audit_logs (actor_user_id, occurred_at desc);
create index audit_logs_entity_time_idx
  on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index outbox_events_claim_idx
  on public.outbox_events (status, available_at, created_at)
  where status in ('pending', 'failed');
create index external_records_sync_state_idx
  on public.external_records (connection_id, entity_type, sync_state);
create index sync_runs_connection_time_idx
  on public.sync_runs (connection_id, created_at desc);
create index reconciliation_cases_status_idx
  on public.reconciliation_cases (connection_id, status, created_at);
create index migration_runs_connection_time_idx
  on public.migration_runs (connection_id, created_at desc);

-- Every foreign-key lookup used by authorization, audit, sync, or migration
-- receives a leading btree index. Primary/unique keys already cover the
-- remaining foreign keys whose referenced columns are first in the key.
create index department_branches_branch_idx
  on public.department_branches (branch_id);
create index role_permissions_permission_idx
  on public.role_permissions (permission_code);
create index role_permissions_updated_by_idx
  on public.role_permissions (updated_by) where updated_by is not null;
create index role_grants_granted_by_idx
  on public.role_grants (granted_by) where granted_by is not null;
create index role_grants_revoked_by_idx
  on public.role_grants (revoked_by) where revoked_by is not null;
create index role_grant_branch_scopes_granted_by_idx
  on public.role_grant_branch_scopes (granted_by) where granted_by is not null;
create index role_grant_department_scopes_granted_by_idx
  on public.role_grant_department_scopes (granted_by) where granted_by is not null;
create index auth_sessions_grant_user_idx
  on public.auth_sessions (active_role_grant_id, user_id);
create index auth_sessions_revoked_by_idx
  on public.auth_sessions (revoked_by) where revoked_by is not null;
create index command_executions_session_actor_idx
  on public.command_executions (session_id, actor_user_id, actor_role_grant_id);
create index command_executions_role_actor_idx
  on public.command_executions (actor_role_grant_id, actor_user_id);
create index audit_logs_role_actor_idx
  on public.audit_logs (actor_role_grant_id, actor_user_id);
create index audit_logs_command_authority_idx
  on public.audit_logs (command_id, actor_user_id, actor_role_grant_id, session_id);
create index audit_logs_session_idx
  on public.audit_logs (session_id);
create index audit_logs_branch_time_idx
  on public.audit_logs (branch_id, occurred_at desc) where branch_id is not null;
create index audit_logs_department_time_idx
  on public.audit_logs (department_id, occurred_at desc) where department_id is not null;
create index audit_logs_retention_idx
  on public.audit_logs (retention_until) where retention_until is not null;
create index outbox_events_command_idx
  on public.outbox_events (command_id);
create index integration_connections_created_by_idx
  on public.integration_connections (created_by) where created_by is not null;
create index integration_connections_updated_by_idx
  on public.integration_connections (updated_by) where updated_by is not null;
create index sync_runs_created_by_idx
  on public.sync_runs (created_by) where created_by is not null;
create index sync_run_items_external_record_idx
  on public.sync_run_items (external_record_id) where external_record_id is not null;
create index reconciliation_cases_resolved_by_idx
  on public.reconciliation_cases (resolved_by) where resolved_by is not null;
create index migration_runs_approved_by_idx
  on public.migration_runs (approved_by) where approved_by is not null;
create index migration_runs_created_by_idx
  on public.migration_runs (created_by);
create index migration_run_items_run_source_idx
  on public.migration_run_items (migration_run_id, connection_id, entity_type);
create index migration_run_items_external_source_idx
  on public.migration_run_items (external_record_id, connection_id, entity_type);
create index migration_evidence_recorded_by_idx
  on public.migration_evidence (recorded_by);

create function nile_private.validate_role_grant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_id uuid;
  grant_role text;
  grant_status text;
  grant_user_status text;
  grant_starts_at timestamptz;
  grant_ends_at timestamptz;
  branch_scope_count integer;
  department_scope_count integer;
  branch_scope_total integer;
  department_scope_total integer;
  invalid_scope_pair_count integer;
begin
  if tg_table_name = 'role_grants' then
    grant_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    grant_id := case
      when tg_op = 'DELETE' then old.role_grant_id
      else new.role_grant_id
    end;
  end if;

  select
    role_grant.role,
    role_grant.status,
    app_user.status,
    role_grant.starts_at,
    role_grant.ends_at
  into grant_role, grant_status, grant_user_status, grant_starts_at, grant_ends_at
  from public.role_grants as role_grant
  join public.app_users as app_user on app_user.id = role_grant.user_id
  where role_grant.id = grant_id;

  if not found or grant_status <> 'active' then
    return null;
  end if;

  if grant_user_status <> 'active' then
    raise exception 'Active role grants require an active app user'
      using errcode = '23514';
  end if;

  select count(*)
  into branch_scope_count
  from public.role_grant_branch_scopes as scope
  where scope.role_grant_id = grant_id
    and scope.starts_at <= grant_starts_at
    and (
      scope.ends_at is null
      or (grant_ends_at is not null and scope.ends_at >= grant_ends_at)
    );

  select count(*)
  into department_scope_count
  from public.role_grant_department_scopes as scope
  where scope.role_grant_id = grant_id
    and scope.starts_at <= grant_starts_at
    and (
      scope.ends_at is null
      or (grant_ends_at is not null and scope.ends_at >= grant_ends_at)
    );

  select count(*)
  into branch_scope_total
  from public.role_grant_branch_scopes as scope
  where scope.role_grant_id = grant_id;

  select count(*)
  into department_scope_total
  from public.role_grant_department_scopes as scope
  where scope.role_grant_id = grant_id;

  select count(*)
  into invalid_scope_pair_count
  from public.role_grant_branch_scopes as branch_scope
  cross join public.role_grant_department_scopes as department_scope
  where branch_scope.role_grant_id = grant_id
    and department_scope.role_grant_id = grant_id
    and branch_scope.starts_at <= grant_starts_at
    and (
      branch_scope.ends_at is null
      or (grant_ends_at is not null and branch_scope.ends_at >= grant_ends_at)
    )
    and department_scope.starts_at <= grant_starts_at
    and (
      department_scope.ends_at is null
      or (grant_ends_at is not null and department_scope.ends_at >= grant_ends_at)
    )
    and not exists (
      select 1
      from public.department_branches as department_branch
      where department_branch.branch_id = branch_scope.branch_id
        and department_branch.department_id = department_scope.department_id
    );

  if invalid_scope_pair_count <> 0 then
    raise exception 'Branch and department scopes must reference a valid department branch assignment'
      using errcode = '23514';
  end if;

  if grant_role = 'superadmin'
    and (branch_scope_total <> 0 or department_scope_total <> 0) then
    raise exception 'Super Admin grants must be global and unscoped'
      using errcode = '23514';
  elsif grant_role in ('student', 'registrar', 'branchadmin')
    and (branch_scope_count = 0 or department_scope_total <> 0) then
    raise exception '% grants require branch scope only', grant_role
      using errcode = '23514';
  elsif grant_role = 'teacher'
    and (branch_scope_count = 0 or department_scope_count = 0) then
    raise exception 'Teacher grants require branch and department scope'
      using errcode = '23514';
  elsif grant_role = 'headofdepartment' and department_scope_count = 0 then
    raise exception 'HOD grants require department scope'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create function nile_private.validate_auth_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_user_status text;
  grant_status text;
  grant_starts_at timestamptz;
  grant_ends_at timestamptz;
begin
  select app_user.status
  into strict mapped_user_status
  from public.app_users as app_user
  where app_user.id = new.user_id;

  select role_grant.status, role_grant.starts_at, role_grant.ends_at
  into strict grant_status, grant_starts_at, grant_ends_at
  from public.role_grants as role_grant
  where role_grant.id = new.active_role_grant_id
    and role_grant.user_id = new.user_id;

  if mapped_user_status <> 'active'
    or grant_status <> 'active'
    or grant_starts_at > pg_catalog.now()
    or (grant_ends_at is not null and grant_ends_at <= pg_catalog.now()) then
    raise exception 'Session requires an active user and effective role grant'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.resolve_auth_session(p_token_hash bytea)
returns table (
  session_id uuid,
  user_id uuid,
  active_role_grant_id uuid,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    session.user_id,
    session.active_role_grant_id,
    session.expires_at
  from public.auth_sessions as session
  join public.app_users as app_user on app_user.id = session.user_id
  join public.role_grants as role_grant
    on role_grant.id = session.active_role_grant_id
   and role_grant.user_id = session.user_id
  where session.token_hash = p_token_hash
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now()
    and app_user.status = 'active'
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now())
$$;

create function nile_private.resolve_effective_role_grant(
  p_user_id uuid,
  p_role_grant_id uuid,
  p_at timestamptz
)
returns table (
  active_role text,
  branch_ids uuid[],
  department_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with grant_row as (
    select role_grant.role
    from public.role_grants as role_grant
    where role_grant.id = p_role_grant_id
      and role_grant.user_id = p_user_id
      and role_grant.status = 'active'
      and role_grant.starts_at <= p_at
      and (role_grant.ends_at is null or role_grant.ends_at > p_at)
  ),
  scope_row as (
    select
      grant_row.role,
      coalesce(
        (
          select pg_catalog.array_agg(scope.branch_id order by scope.branch_id)
          from public.role_grant_branch_scopes as scope
          join public.branches as branch
            on branch.id = scope.branch_id
           and branch.status = 'active'
          where scope.role_grant_id = p_role_grant_id
            and scope.starts_at <= p_at
            and (scope.ends_at is null or scope.ends_at > p_at)
        ),
        '{}'::uuid[]
      ) as branch_ids,
      coalesce(
        (
          select pg_catalog.array_agg(scope.department_id order by scope.department_id)
          from public.role_grant_department_scopes as scope
          join public.departments as department
            on department.id = scope.department_id
           and department.status = 'active'
          where scope.role_grant_id = p_role_grant_id
            and scope.starts_at <= p_at
            and (scope.ends_at is null or scope.ends_at > p_at)
        ),
        '{}'::uuid[]
      ) as department_ids
    from grant_row
  )
  select scope_row.role, scope_row.branch_ids, scope_row.department_ids
  from scope_row
  where
    not exists (
      select 1
      from pg_catalog.unnest(scope_row.branch_ids) as branch_scope(branch_id)
      cross join pg_catalog.unnest(scope_row.department_ids) as department_scope(department_id)
      where not exists (
        select 1
        from public.department_branches as department_branch
        where department_branch.branch_id = branch_scope.branch_id
          and department_branch.department_id = department_scope.department_id
      )
    )
    and (
      (
      scope_row.role = 'superadmin'
      and pg_catalog.cardinality(scope_row.branch_ids) = 0
      and pg_catalog.cardinality(scope_row.department_ids) = 0
    )
    or (
      scope_row.role in ('student', 'registrar', 'branchadmin')
      and pg_catalog.cardinality(scope_row.branch_ids) > 0
      and pg_catalog.cardinality(scope_row.department_ids) = 0
    )
    or (
      scope_row.role = 'teacher'
      and pg_catalog.cardinality(scope_row.branch_ids) > 0
      and pg_catalog.cardinality(scope_row.department_ids) > 0
    )
    or (
      scope_row.role = 'headofdepartment'
      and pg_catalog.cardinality(scope_row.department_ids) > 0
    )
    )
$$;

create function public.resolve_login_authority(
  p_auth_user_id uuid,
  p_requested_role text
)
returns table (
  user_id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  active_role_grant_id uuid,
  active_role text,
  branch_ids uuid[],
  department_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.id,
    app_user.auth_user_id,
    app_user.email::text,
    app_user.full_name,
    role_grant.id,
    authority.active_role,
    authority.branch_ids,
    authority.department_ids
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.user_id = app_user.id
   and role_grant.role = p_requested_role
  cross join lateral nile_private.resolve_effective_role_grant(
    app_user.id,
    role_grant.id,
    pg_catalog.now()
  ) as authority
  where app_user.auth_user_id = p_auth_user_id
    and app_user.status = 'active'
$$;

create function public.resolve_auth_session_authority(p_token_hash text)
returns table (
  user_id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  active_role_grant_id uuid,
  active_role text,
  provider text,
  created_at timestamptz,
  expires_at timestamptz,
  branch_ids uuid[],
  department_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.id,
    app_user.auth_user_id,
    app_user.email::text,
    app_user.full_name,
    session.active_role_grant_id,
    authority.active_role,
    session.provider,
    session.created_at,
    session.expires_at,
    authority.branch_ids,
    authority.department_ids
  from public.auth_sessions as session
  join public.app_users as app_user on app_user.id = session.user_id
  cross join lateral nile_private.resolve_effective_role_grant(
    session.user_id,
    session.active_role_grant_id,
    pg_catalog.now()
  ) as authority
  where session.token_hash = case
      when p_token_hash ~ '^[0-9a-f]{64}$'
        then pg_catalog.decode(p_token_hash, 'hex')
      else null
    end
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now()
    and app_user.status = 'active'
$$;

create function nile_private.enforce_sync_direction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_provider text;
  connection_mode text;
begin
  select connection.provider, connection.mode
  into strict connection_provider, connection_mode
  from public.integration_connections as connection
  where connection.id = new.connection_id;

  if new.direction = 'write' and connection_mode <> 'write_limited' then
    raise exception 'Connection % is not approved for writes', new.connection_id
      using errcode = '42501';
  end if;

  if new.direction = 'write' and connection_provider = 'legacy_ems' then
    raise exception 'Legacy EMS writeback is prohibited'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function nile_private.enforce_migration_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_provider text;
  connection_mode text;
begin
  select connection.provider, connection.mode
  into strict connection_provider, connection_mode
  from public.integration_connections as connection
  where connection.id = new.connection_id;

  if connection_provider <> 'legacy_ems' or connection_mode <> 'migration' then
    raise exception 'Migration runs require a legacy_ems migration connection'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_external_record_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'External mappings are durable evidence and cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.connection_id is distinct from new.connection_id
    or old.entity_type is distinct from new.entity_type
    or old.external_id is distinct from new.external_id
    or old.created_at is distinct from new.created_at then
    raise exception 'External source identity is immutable'
      using errcode = '55000';
  end if;

  if old.internal_id is not null and old.internal_id is distinct from new.internal_id then
    raise exception 'An established external-to-internal mapping cannot be rewritten'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.validate_migration_item_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_external_id text;
  mapped_source_hash bytea;
  mapped_internal_id uuid;
  migration_kind text;
  migration_status text;
begin
  select
    external_record.external_id,
    external_record.source_hash,
    external_record.internal_id
  into strict mapped_external_id, mapped_source_hash, mapped_internal_id
  from public.external_records as external_record
  where external_record.id = new.external_record_id
    and external_record.connection_id = new.connection_id
    and external_record.entity_type = new.entity_type;

  if mapped_external_id is distinct from new.external_id
    or mapped_source_hash is null
    or mapped_source_hash is distinct from new.source_hash then
    raise exception 'Migration item must preserve the mapped source identity and payload hash'
      using errcode = '23514';
  end if;

  select migration_run.run_kind, migration_run.status
  into strict migration_kind, migration_status
  from public.migration_runs as migration_run
  where migration_run.id = new.migration_run_id
    and migration_run.connection_id = new.connection_id
    and migration_run.entity_type = new.entity_type;

  if new.match_status = 'imported'
    and (migration_kind = 'dry_run' or migration_status <> 'applying') then
    raise exception 'Imported migration items require an applying non-dry-run migration'
      using errcode = '23514';
  end if;

  if new.match_status = 'imported'
    and (mapped_internal_id is null or mapped_internal_id is distinct from new.internal_id) then
    raise exception 'Imported migration item must use the durable external-record mapping'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_outbox_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.command_id is distinct from new.command_id
    or old.event_type is distinct from new.event_type
    or old.aggregate_type is distinct from new.aggregate_type
    or old.aggregate_id is distinct from new.aggregate_id
    or old.payload is distinct from new.payload
    or old.idempotency_key is distinct from new.idempotency_key
    or old.created_at is distinct from new.created_at then
    raise exception 'Outbox event identity and payload are immutable'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'pending' and new.status in ('processing', 'dead_letter'))
    or (old.status = 'processing' and new.status in ('succeeded', 'failed', 'dead_letter'))
    or (old.status = 'failed' and new.status in ('processing', 'dead_letter'))
  ) then
    raise exception 'Invalid outbox transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_role_grant_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Role grants must be revoked or expired, not deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.user_id is distinct from new.user_id
    or old.role is distinct from new.role
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.granted_by is distinct from new.granted_by
    or old.granted_reason is distinct from new.granted_reason
    or old.created_at is distinct from new.created_at then
    raise exception 'Role-grant identity, effective window, and provenance are immutable'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'pending' and new.status in ('active', 'revoked'))
    or (old.status = 'active' and new.status in ('revoked', 'expired'))
  ) then
    raise exception 'Invalid role-grant transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  if old.status in ('revoked', 'expired') then
    raise exception 'Terminal role-grant evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if new.status = 'expired'
    and (new.ends_at is null or new.ends_at > pg_catalog.now()) then
    raise exception 'A role grant can expire only after its immutable effective window ends'
      using errcode = '23514';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function nile_private.preserve_scope_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Scope history rows cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.role_grant_id is distinct from new.role_grant_id
    or old.starts_at is distinct from new.starts_at
    or old.granted_by is distinct from new.granted_by
    or old.created_at is distinct from new.created_at
    or (to_jsonb(old) ->> 'branch_id') is distinct from (to_jsonb(new) ->> 'branch_id')
    or (to_jsonb(old) ->> 'department_id') is distinct from (to_jsonb(new) ->> 'department_id') then
    raise exception 'Scope identity and provenance are immutable'
      using errcode = '55000';
  end if;

  if old.ends_at is not null and old.ends_at is distinct from new.ends_at then
    raise exception 'A retired scope window cannot be reopened or rewritten'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_session_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Sessions must be revoked, not deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.token_hash is distinct from new.token_hash
    or old.user_id is distinct from new.user_id
    or old.active_role_grant_id is distinct from new.active_role_grant_id
    or old.provider is distinct from new.provider
    or old.created_at is distinct from new.created_at
    or old.expires_at is distinct from new.expires_at then
    raise exception 'Session identity and authority are immutable'
      using errcode = '55000';
  end if;

  if old.revoked_at is not null and old is distinct from new then
    raise exception 'A revoked session cannot be reopened or rewritten'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_command_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Command execution rows cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.idempotency_key is distinct from new.idempotency_key
    or old.actor_user_id is distinct from new.actor_user_id
    or old.actor_role_grant_id is distinct from new.actor_role_grant_id
    or old.session_id is distinct from new.session_id
    or old.command_type is distinct from new.command_type
    or old.target_type is distinct from new.target_type
    or old.target_id is distinct from new.target_id
    or old.request_hash is distinct from new.request_hash
    or old.requires_outbox is distinct from new.requires_outbox
    or old.started_at is distinct from new.started_at then
    raise exception 'Command identity and request evidence are immutable'
      using errcode = '55000';
  end if;

  if old.status = 'succeeded' and old is distinct from new then
    raise exception 'Completed commands cannot be reopened or rewritten'
      using errcode = '55000';
  end if;

  if old.status = 'started' and new.status not in ('started', 'succeeded') then
    raise exception 'Invalid command transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.require_command_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'succeeded' then
    return null;
  end if;

  if not exists (
    select 1 from public.audit_logs as audit where audit.command_id = new.id
  ) then
    raise exception 'A successful command requires immutable audit evidence'
      using errcode = '23514';
  end if;

  if new.requires_outbox and not exists (
    select 1 from public.outbox_events as event where event.command_id = new.id
  ) then
    raise exception 'This successful command requires an outbox event'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create function nile_private.preserve_migration_run_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Migration runs are durable evidence and cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.connection_id is distinct from new.connection_id
    or old.entity_type is distinct from new.entity_type
    or old.run_kind is distinct from new.run_kind
    or old.source_watermark is distinct from new.source_watermark
    or old.source_manifest_hash is distinct from new.source_manifest_hash
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'Migration source identity and manifest evidence are immutable'
      using errcode = '55000';
  end if;

  if old.status = 'rolled_back' and old is distinct from new then
    raise exception 'Completed migration evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.status = 'completed'
    and new.status = 'completed'
    and old is distinct from new then
    raise exception 'Completed migration evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.approved_at is not null
    and (old.approved_at is distinct from new.approved_at
      or old.approved_by is distinct from new.approved_by) then
    raise exception 'Migration approval evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.started_at is not null and old.started_at is distinct from new.started_at then
    raise exception 'Migration start evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.completed_at is not null and old.completed_at is distinct from new.completed_at then
    raise exception 'Migration completion evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'draft' and new.status in ('validating', 'failed'))
    or (old.status = 'validating' and new.status in ('ready', 'failed'))
    or (old.status = 'ready' and new.status in ('approved', 'failed'))
    or (old.status = 'approved' and new.status in ('applying', 'failed'))
    or (old.status = 'applying' and new.status in ('completed', 'failed'))
    or (old.status in ('completed', 'failed') and new.status = 'rolled_back')
  ) then
    raise exception 'Invalid migration transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_migration_item_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Migration item evidence cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.migration_run_id is distinct from new.migration_run_id
    or old.connection_id is distinct from new.connection_id
    or old.entity_type is distinct from new.entity_type
    or old.external_record_id is distinct from new.external_record_id
    or old.external_id is distinct from new.external_id
    or old.source_hash is distinct from new.source_hash
    or old.before_image is distinct from new.before_image
    or old.created_at is distinct from new.created_at then
    raise exception 'Migration item source identity and payload evidence are immutable'
      using errcode = '55000';
  end if;

  if old.match_status in ('imported', 'rejected') and old is distinct from new then
    raise exception 'Terminal migration items cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.internal_id is not null and old.internal_id is distinct from new.internal_id then
    raise exception 'A migration item mapping cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.applied_at is not null and old.applied_at is distinct from new.applied_at then
    raise exception 'Migration application evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if not (
    old.match_status = new.match_status
    or (old.match_status = 'unmatched' and new.match_status in ('matched', 'ambiguous', 'rejected'))
    or (old.match_status = 'ambiguous' and new.match_status in ('matched', 'rejected'))
    or (old.match_status = 'matched' and new.match_status in ('imported', 'rejected'))
  ) then
    raise exception 'Invalid migration item transition from % to %', old.match_status, new.match_status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.require_cutover_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing_evidence text[];
begin
  if new.status <> 'completed' or new.run_kind <> 'cutover' then
    return null;
  end if;

  select pg_catalog.array_agg(required.evidence_type order by required.evidence_type)
  into missing_evidence
  from unnest(array[
    'reconciliation_approval',
    'final_delta',
    'cutover',
    'rollback',
    'credential_retirement'
  ]) as required(evidence_type)
  where not exists (
    select 1
    from public.migration_evidence as evidence
    where evidence.migration_run_id = new.id
      and evidence.evidence_type = required.evidence_type
  );

  if missing_evidence is not null then
    raise exception 'Cutover is missing required evidence: %', missing_evidence
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on all functions in schema nile_private from public, anon, authenticated;

revoke all on function public.resolve_login_authority(uuid, text)
from public, anon, authenticated;
revoke all on function public.resolve_auth_session_authority(text)
from public, anon, authenticated;

grant usage on schema nile_private to service_role;
grant execute on all functions in schema nile_private to service_role;
grant execute on function public.resolve_login_authority(uuid, text)
to service_role;
grant execute on function public.resolve_auth_session_authority(text)
to service_role;

create trigger branches_set_updated_at
before update on public.branches
for each row execute function nile_private.set_updated_at();
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function nile_private.set_updated_at();
create trigger app_users_preserve_identity
before update on public.app_users
for each row execute function nile_private.preserve_app_user_identity();
create trigger departments_set_updated_at
before update on public.departments
for each row execute function nile_private.set_updated_at();
create trigger role_permissions_set_updated_at
before update on public.role_permissions
for each row execute function nile_private.set_updated_at();
create trigger role_grants_preserve_history
before update or delete on public.role_grants
for each row execute function nile_private.preserve_role_grant_history();
create trigger branch_scopes_preserve_history
before update or delete on public.role_grant_branch_scopes
for each row execute function nile_private.preserve_scope_history();
create trigger department_scopes_preserve_history
before update or delete on public.role_grant_department_scopes
for each row execute function nile_private.preserve_scope_history();
create constraint trigger role_grants_validate_scope
after insert or update on public.role_grants
deferrable initially deferred
for each row execute function nile_private.validate_role_grant_scope();
create constraint trigger branch_scopes_validate_grant
after insert or update or delete on public.role_grant_branch_scopes
deferrable initially deferred
for each row execute function nile_private.validate_role_grant_scope();
create constraint trigger department_scopes_validate_grant
after insert or update or delete on public.role_grant_department_scopes
deferrable initially deferred
for each row execute function nile_private.validate_role_grant_scope();
create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function nile_private.set_updated_at();
create trigger auth_sessions_validate
before insert or update of user_id, active_role_grant_id on public.auth_sessions
for each row execute function nile_private.validate_auth_session();
create trigger auth_sessions_preserve_identity
before update or delete on public.auth_sessions
for each row execute function nile_private.preserve_session_identity();
create trigger command_executions_preserve_identity
before update or delete on public.command_executions
for each row execute function nile_private.preserve_command_identity();
create constraint trigger command_evidence_required
after insert or update of status on public.command_executions
deferrable initially deferred
for each row execute function nile_private.require_command_evidence();
create trigger outbox_events_set_updated_at
before update on public.outbox_events
for each row execute function nile_private.set_updated_at();
create trigger outbox_events_preserve_identity
before update on public.outbox_events
for each row execute function nile_private.preserve_outbox_identity();
create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function nile_private.set_updated_at();
create trigger external_records_set_updated_at
before update on public.external_records
for each row execute function nile_private.set_updated_at();
create trigger external_records_preserve_identity
before update or delete on public.external_records
for each row execute function nile_private.preserve_external_record_identity();
create trigger reconciliation_cases_set_updated_at
before update on public.reconciliation_cases
for each row execute function nile_private.set_updated_at();
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function nile_private.reject_immutable_change();
create trigger migration_evidence_immutable
before update or delete on public.migration_evidence
for each row execute function nile_private.reject_immutable_change();
create trigger sync_runs_direction_guard
before insert or update of connection_id, direction on public.sync_runs
for each row execute function nile_private.enforce_sync_direction();
create trigger migration_runs_connection_guard
before insert or update of connection_id on public.migration_runs
for each row execute function nile_private.enforce_migration_connection();
create trigger migration_runs_preserve_history
before update or delete on public.migration_runs
for each row execute function nile_private.preserve_migration_run_history();
create constraint trigger migration_cutover_evidence_required
after insert or update of status on public.migration_runs
deferrable initially deferred
for each row execute function nile_private.require_cutover_evidence();
create trigger migration_run_items_validate_source
before insert or update on public.migration_run_items
for each row execute function nile_private.validate_migration_item_source();
create trigger migration_run_items_preserve_history
before update or delete on public.migration_run_items
for each row execute function nile_private.preserve_migration_item_history();

alter table public.branches enable row level security;
alter table public.branches force row level security;
alter table public.app_users enable row level security;
alter table public.app_users force row level security;
alter table public.departments enable row level security;
alter table public.departments force row level security;
alter table public.department_branches enable row level security;
alter table public.department_branches force row level security;
alter table public.permissions enable row level security;
alter table public.permissions force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.role_grants enable row level security;
alter table public.role_grants force row level security;
alter table public.role_grant_branch_scopes enable row level security;
alter table public.role_grant_branch_scopes force row level security;
alter table public.role_grant_department_scopes enable row level security;
alter table public.role_grant_department_scopes force row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_profiles force row level security;
alter table public.staff_subjects enable row level security;
alter table public.staff_subjects force row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_sessions force row level security;
alter table public.command_executions enable row level security;
alter table public.command_executions force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_connections force row level security;
alter table public.integration_env_requirements enable row level security;
alter table public.integration_env_requirements force row level security;
alter table public.external_records enable row level security;
alter table public.external_records force row level security;
alter table public.sync_cursors enable row level security;
alter table public.sync_cursors force row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_runs force row level security;
alter table public.sync_run_items enable row level security;
alter table public.sync_run_items force row level security;
alter table public.reconciliation_cases enable row level security;
alter table public.reconciliation_cases force row level security;
alter table public.migration_runs enable row level security;
alter table public.migration_runs force row level security;
alter table public.migration_run_items enable row level security;
alter table public.migration_run_items force row level security;
alter table public.migration_evidence enable row level security;
alter table public.migration_evidence force row level security;

revoke all on table
  public.branches,
  public.app_users,
  public.departments,
  public.department_branches,
  public.permissions,
  public.role_permissions,
  public.role_grants,
  public.role_grant_branch_scopes,
  public.role_grant_department_scopes,
  public.staff_profiles,
  public.staff_subjects,
  public.auth_sessions,
  public.command_executions,
  public.audit_logs,
  public.outbox_events,
  public.integration_connections,
  public.integration_env_requirements,
  public.external_records,
  public.sync_cursors,
  public.sync_runs,
  public.sync_run_items,
  public.reconciliation_cases,
  public.migration_runs,
  public.migration_run_items,
  public.migration_evidence
from public, anon, authenticated;

revoke all on sequence public.audit_logs_id_seq
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.branches,
  public.app_users,
  public.departments,
  public.department_branches,
  public.permissions,
  public.role_permissions,
  public.role_grants,
  public.role_grant_branch_scopes,
  public.role_grant_department_scopes,
  public.staff_profiles,
  public.staff_subjects,
  public.auth_sessions,
  public.command_executions,
  public.audit_logs,
  public.outbox_events,
  public.integration_connections,
  public.integration_env_requirements,
  public.external_records,
  public.sync_cursors,
  public.sync_runs,
  public.sync_run_items,
  public.reconciliation_cases,
  public.migration_runs,
  public.migration_run_items,
  public.migration_evidence
to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

-- Phase 1 normalized base tables are server-only. The browser receives scoped
-- DTOs from server APIs that resolve the opaque application session and its
-- single active role grant. Direct authenticated policies are deliberately
-- absent so Supabase Auth JWTs cannot union multi-role grants or bypass the
-- application session boundary.

commit;
