-- Nile Learn Phase 13A Nile Forms schema foundation.
--
-- Status: additive local-only migration. Do not apply to a linked, shared,
-- preview, or production project without a separately approved promotion gate.
-- Phase 1 identity, role grants, scopes, audit, and outbox tables must exist.

begin;

create function nile_private.preserve_published_form_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Published form versions are immutable'
      using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' and old.status in ('published', 'retired') then
    if old.id is distinct from new.id
      or old.definition_id is distinct from new.definition_id
      or old.version_number is distinct from new.version_number
      or old.revision is distinct from new.revision
      or old.schema_json is distinct from new.schema_json
      or old.logic_json is distinct from new.logic_json
      or old.translations_json is distinct from new.translations_json
      or old.content_hash is distinct from new.content_hash
      or old.authored_by is distinct from new.authored_by
      or old.published_by is distinct from new.published_by
      or old.published_at is distinct from new.published_at
      or old.created_at is distinct from new.created_at then
      raise exception 'Published form version content and provenance are immutable'
        using errcode = '55000';
    end if;

    if old.status = 'retired' and new.status <> 'retired' then
      raise exception 'Retired form versions cannot be reactivated'
        using errcode = '55000';
    end if;

    if old.status = 'published' and new.status not in ('published', 'retired') then
      raise exception 'Published form versions may only be retired'
        using errcode = '55000';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function nile_private.preserve_form_submission_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Form submissions are immutable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.definition_id is distinct from new.definition_id
    or old.publication_id is distinct from new.publication_id
    or old.version_id is distinct from new.version_id
    or old.assignment_id is distinct from new.assignment_id
    or old.respondent_user_id is distinct from new.respondent_user_id
    or old.respondent_role is distinct from new.respondent_role
    or old.branch_id is distinct from new.branch_id
    or old.department_id is distinct from new.department_id
    or old.source is distinct from new.source
    or old.answer_json is distinct from new.answer_json
    or old.client_submission_id is distinct from new.client_submission_id
    or old.client_submitted_at is distinct from new.client_submitted_at
    or old.submitted_at is distinct from new.submitted_at
    or old.legacy_source_form_id is distinct from new.legacy_source_form_id
    or old.legacy_source_submission_id is distinct from new.legacy_source_submission_id
    or old.legacy_payload_hash is distinct from new.legacy_payload_hash
    or old.legacy_import_run_id is distinct from new.legacy_import_run_id then
    raise exception 'Form submission answers and provenance are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create table public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  form_key text not null unique check (form_key ~ '^[a-z][a-z0-9_:-]{2,79}$'),
  title text not null check (char_length(title) between 1 and 200),
  category text not null
    check (category in ('admissions', 'student_support', 'attendance', 'consent', 'branch_operations')),
  owner_user_id uuid not null references public.app_users(id) on delete restrict,
  owner_role_grant_id uuid not null,
  owner_role text not null
    check (owner_role in ('registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  branch_id uuid references public.branches(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_role_grant_id, owner_user_id)
    references public.role_grants(id, user_id) on delete restrict,
  check (
    (owner_role = 'superadmin' and branch_id is null and department_id is null)
    or (owner_role in ('registrar', 'branchadmin') and branch_id is not null and department_id is null)
    or (owner_role = 'headofdepartment' and department_id is not null)
  )
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.form_definitions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  revision integer not null default 1 check (revision > 0),
  schema_json jsonb not null,
  logic_json jsonb not null default '[]'::jsonb,
  translations_json jsonb not null,
  content_hash bytea not null check (octet_length(content_hash) = 32),
  authored_by uuid not null references public.app_users(id) on delete restrict,
  published_by uuid references public.app_users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (definition_id, version_number),
  unique (id, definition_id),
  check (jsonb_typeof(schema_json) = 'object'),
  check (jsonb_typeof(logic_json) = 'array'),
  check (jsonb_typeof(translations_json) = 'object'),
  check (not nile_private.jsonb_has_forbidden_keys(schema_json)),
  check (not nile_private.jsonb_has_forbidden_keys(logic_json)),
  check (not nile_private.jsonb_has_forbidden_keys(translations_json)),
  check (
    (status = 'draft' and published_by is null and published_at is null)
    or (status in ('published', 'retired') and published_by is not null and published_at is not null)
  )
);

alter table public.form_definitions
  add column current_draft_version_id uuid,
  add column current_published_version_id uuid,
  add foreign key (current_draft_version_id, id)
    references public.form_versions(id, definition_id) on delete restrict,
  add foreign key (current_published_version_id, id)
    references public.form_versions(id, definition_id) on delete restrict;

create unique index form_definitions_one_draft_version_uidx
  on public.form_definitions (current_draft_version_id)
  where current_draft_version_id is not null;
create unique index form_definitions_one_published_version_uidx
  on public.form_definitions (current_published_version_id)
  where current_published_version_id is not null;

create table public.form_publications (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null,
  version_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  audience text not null check (audience in ('public', 'authenticated', 'assigned')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'open', 'closed', 'retired')),
  opens_at timestamptz,
  closes_at timestamptz,
  allow_multiple boolean not null default false,
  allow_drafts boolean not null default true,
  offline_eligible boolean not null default false,
  created_by uuid not null references public.app_users(id) on delete restrict,
  command_id uuid references public.command_executions(id) on delete restrict,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  foreign key (version_id, definition_id)
    references public.form_versions(id, definition_id) on delete restrict,
  unique (id, definition_id, version_id),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  check (status <> 'retired' or retired_at is not null),
  check (audience = 'assigned' or offline_eligible = false)
);

create unique index form_publications_slug_uidx
  on public.form_publications (lower(slug));

create table public.form_assignments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.form_publications(id) on delete restrict,
  target_type text not null
    check (target_type in ('user', 'role', 'branch', 'department', 'course', 'class')),
  target_user_id uuid references public.app_users(id) on delete restrict,
  target_role text
    check (target_role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  target_branch_id uuid references public.branches(id) on delete restrict,
  target_department_id uuid references public.departments(id) on delete restrict,
  target_key text,
  assigned_by uuid not null references public.app_users(id) on delete restrict,
  command_id uuid references public.command_executions(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > assigned_at),
  check (revoked_at is null or revoked_at >= assigned_at),
  check (
    (target_type = 'user' and target_user_id is not null and num_nonnulls(target_role, target_branch_id, target_department_id, target_key) = 0)
    or (target_type = 'role' and target_role is not null and num_nonnulls(target_user_id, target_branch_id, target_department_id, target_key) = 0)
    or (target_type = 'branch' and target_branch_id is not null and num_nonnulls(target_user_id, target_role, target_department_id, target_key) = 0)
    or (target_type = 'department' and target_department_id is not null and num_nonnulls(target_user_id, target_role, target_branch_id, target_key) = 0)
    or (target_type in ('course', 'class') and target_key is not null and num_nonnulls(target_user_id, target_role, target_branch_id, target_department_id) = 0)
  ),
  unique (id, publication_id)
);

create unique index form_assignments_active_target_uidx
  on public.form_assignments (
    publication_id,
    target_type,
    coalesce(target_user_id::text, target_role, target_branch_id::text, target_department_id::text, target_key)
  )
  where revoked_at is null;

create table public.form_drafts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  definition_id uuid not null,
  version_id uuid not null,
  assignment_id uuid,
  respondent_user_id uuid references public.app_users(id) on delete restrict,
  guest_token_hash bytea check (guest_token_hash is null or octet_length(guest_token_hash) = 32),
  encrypted_payload bytea not null,
  payload_nonce bytea not null check (octet_length(payload_nonce) = 12),
  payload_key_version integer not null check (payload_key_version > 0),
  revision integer not null default 1 check (revision > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (publication_id, definition_id, version_id)
    references public.form_publications(id, definition_id, version_id) on delete restrict,
  foreign key (assignment_id, publication_id)
    references public.form_assignments(id, publication_id) on delete restrict,
  check (num_nonnulls(respondent_user_id, guest_token_hash) = 1),
  check (expires_at > created_at)
);

create unique index form_drafts_respondent_uidx
  on public.form_drafts (publication_id, version_id, respondent_user_id)
  where respondent_user_id is not null;
create unique index form_drafts_guest_uidx
  on public.form_drafts (publication_id, version_id, guest_token_hash)
  where guest_token_hash is not null;

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.form_definitions(id) on delete restrict,
  publication_id uuid not null,
  version_id uuid not null,
  assignment_id uuid,
  respondent_user_id uuid references public.app_users(id) on delete restrict,
  respondent_role text
    check (respondent_role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  branch_id uuid references public.branches(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  source text not null check (source in ('web', 'offline', 'legacy_import')),
  answer_json jsonb not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'promoted', 'withdrawn', 'quarantined')),
  revision integer not null default 1 check (revision > 0),
  client_submission_id text,
  client_submitted_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  command_id uuid references public.command_executions(id) on delete restrict,
  legacy_source_form_id text,
  legacy_source_submission_id text,
  legacy_payload_hash bytea check (legacy_payload_hash is null or octet_length(legacy_payload_hash) = 32),
  legacy_import_run_id uuid references public.migration_runs(id) on delete restrict,
  reconciliation_status text
    check (reconciliation_status in ('pending', 'matched', 'exception')),
  foreign key (publication_id, definition_id, version_id)
    references public.form_publications(id, definition_id, version_id) on delete restrict,
  foreign key (assignment_id, publication_id)
    references public.form_assignments(id, publication_id) on delete restrict,
  check (jsonb_typeof(answer_json) = 'object'),
  check (not nile_private.jsonb_has_forbidden_keys(answer_json)),
  check (respondent_user_id is not null or respondent_role is null),
  check (
    source <> 'legacy_import'
    or num_nonnulls(legacy_source_form_id, legacy_source_submission_id, legacy_payload_hash, legacy_import_run_id, reconciliation_status) = 5
  ),
  check (
    source = 'legacy_import'
    or num_nonnulls(legacy_source_form_id, legacy_source_submission_id, legacy_payload_hash, legacy_import_run_id, reconciliation_status) = 0
  )
);

create unique index form_submissions_client_id_uidx
  on public.form_submissions (publication_id, client_submission_id)
  where client_submission_id is not null;
create unique index form_submissions_legacy_source_uidx
  on public.form_submissions (legacy_source_form_id, legacy_source_submission_id)
  where source = 'legacy_import';
create index form_submissions_inbox_idx
  on public.form_submissions (status, branch_id, department_id, submitted_at desc);

create table public.form_submission_index_values (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  field_id text not null,
  value_type text not null check (value_type in ('text', 'number', 'date', 'timestamp', 'boolean')),
  text_value text,
  number_value numeric,
  date_value date,
  timestamp_value timestamptz,
  boolean_value boolean,
  created_at timestamptz not null default now(),
  unique (submission_id, field_id),
  check (num_nonnulls(text_value, number_value, date_value, timestamp_value, boolean_value) = 1),
  check (
    (value_type = 'text' and text_value is not null)
    or (value_type = 'number' and number_value is not null)
    or (value_type = 'date' and date_value is not null)
    or (value_type = 'timestamp' and timestamp_value is not null)
    or (value_type = 'boolean' and boolean_value is not null)
  )
);

create index form_submission_index_text_idx
  on public.form_submission_index_values (field_id, text_value)
  where text_value is not null;
create index form_submission_index_number_idx
  on public.form_submission_index_values (field_id, number_value)
  where number_value is not null;

create table public.form_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  reviewer_user_id uuid not null references public.app_users(id) on delete restrict,
  reviewer_role_grant_id uuid not null,
  decision text not null check (decision in ('under_review', 'accepted', 'rejected')),
  comments text check (comments is null or char_length(comments) <= 4000),
  expected_submission_revision integer not null check (expected_submission_revision > 0),
  command_id uuid references public.command_executions(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (reviewer_role_grant_id, reviewer_user_id)
    references public.role_grants(id, user_id) on delete restrict
);

create index form_reviews_submission_idx
  on public.form_reviews (submission_id, created_at desc);

create table public.form_promotions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  adapter text not null
    check (adapter in ('lead.create', 'application.create', 'placement.create', 'support_ticket.create', 'attendance_exception.create')),
  command_id uuid not null references public.command_executions(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  resulting_entity_type text,
  resulting_entity_id text,
  error_detail text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'pending') = (completed_at is null)),
  check ((status = 'succeeded') = (resulting_entity_type is not null and resulting_entity_id is not null)),
  check ((status = 'failed') = (error_detail is not null))
);

create unique index form_promotions_submission_adapter_uidx
  on public.form_promotions (submission_id, adapter);

create table public.form_offline_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  role_grant_id uuid not null,
  label text not null check (char_length(label) between 1 and 120),
  device_token_hash bytea not null unique check (octet_length(device_token_hash) = 32),
  public_key text not null,
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  foreign key (role_grant_id, user_id)
    references public.role_grants(id, user_id) on delete restrict,
  check (expires_at > enrolled_at and expires_at <= enrolled_at + interval '90 days'),
  check (revoked_by is null or revoked_at is not null)
);

create table public.form_sync_receipts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.form_offline_devices(id) on delete restrict,
  client_submission_id text not null,
  submission_id uuid references public.form_submissions(id) on delete restrict,
  status text not null check (status in ('accepted', 'duplicate', 'quarantined', 'rejected')),
  reason text,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  received_at timestamptz not null default now(),
  unique (device_id, client_submission_id),
  check ((status = 'rejected') = (submission_id is null)),
  check (status not in ('quarantined', 'rejected') or reason is not null)
);

-- Reserved metadata only. No storage locator, upload API, or file bytes are
-- authorized by this phase.
create table public.form_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  field_id text not null,
  status text not null default 'reserved' check (status = 'reserved'),
  created_at timestamptz not null default now(),
  unique (submission_id, field_id)
);

insert into public.permissions (code, category, description, sensitive)
values
  ('forms.read', 'forms', 'Read assigned or scoped form definitions', false),
  ('forms.write', 'forms', 'Create and edit scoped draft form versions', true),
  ('forms.publish', 'forms', 'Publish or retire scoped form versions', true),
  ('forms.assign', 'forms', 'Assign scoped form publications', true),
  ('forms.respond', 'forms', 'Respond to available form publications', false),
  ('form_submissions.read', 'forms', 'Read scoped form submissions', true),
  ('form_submissions.review', 'forms', 'Review and promote scoped form submissions', true),
  ('form_submissions.export', 'forms', 'Export scoped form submissions', true)
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
values
  ('student', 'forms.read', true),
  ('student', 'forms.respond', true),
  ('teacher', 'forms.read', true),
  ('teacher', 'forms.respond', true),
  ('registrar', 'forms.read', true),
  ('registrar', 'forms.write', true),
  ('registrar', 'forms.publish', true),
  ('registrar', 'forms.assign', true),
  ('registrar', 'forms.respond', true),
  ('registrar', 'form_submissions.read', true),
  ('registrar', 'form_submissions.review', true),
  ('registrar', 'form_submissions.export', true),
  ('headofdepartment', 'forms.read', true),
  ('headofdepartment', 'forms.write', true),
  ('headofdepartment', 'forms.publish', true),
  ('headofdepartment', 'forms.assign', true),
  ('headofdepartment', 'forms.respond', true),
  ('headofdepartment', 'form_submissions.read', true),
  ('headofdepartment', 'form_submissions.review', true),
  ('headofdepartment', 'form_submissions.export', true),
  ('branchadmin', 'forms.read', true),
  ('branchadmin', 'forms.write', true),
  ('branchadmin', 'forms.publish', true),
  ('branchadmin', 'forms.assign', true),
  ('branchadmin', 'forms.respond', true),
  ('branchadmin', 'form_submissions.read', true),
  ('branchadmin', 'form_submissions.review', true),
  ('branchadmin', 'form_submissions.export', true),
  ('superadmin', 'forms.read', true),
  ('superadmin', 'forms.write', true),
  ('superadmin', 'forms.publish', true),
  ('superadmin', 'forms.assign', true),
  ('superadmin', 'forms.respond', true),
  ('superadmin', 'form_submissions.read', true),
  ('superadmin', 'form_submissions.review', true),
  ('superadmin', 'form_submissions.export', true)
on conflict (role, permission_code) do update
set granted = excluded.granted, updated_at = now();

create trigger form_definitions_set_updated_at
before update on public.form_definitions
for each row execute function nile_private.set_updated_at();
create trigger form_versions_set_updated_at
before update on public.form_versions
for each row execute function nile_private.set_updated_at();
create trigger form_versions_preserve_published
before update or delete on public.form_versions
for each row execute function nile_private.preserve_published_form_version();
create trigger form_drafts_set_updated_at
before update on public.form_drafts
for each row execute function nile_private.set_updated_at();
create trigger form_submissions_set_updated_at
before update on public.form_submissions
for each row execute function nile_private.set_updated_at();
create trigger form_submissions_preserve_evidence
before update or delete on public.form_submissions
for each row execute function nile_private.preserve_form_submission_evidence();
create trigger form_reviews_immutable
before update or delete on public.form_reviews
for each row execute function nile_private.reject_immutable_change();
create trigger form_sync_receipts_immutable
before update or delete on public.form_sync_receipts
for each row execute function nile_private.reject_immutable_change();

alter table public.form_definitions enable row level security;
alter table public.form_definitions force row level security;
alter table public.form_versions enable row level security;
alter table public.form_versions force row level security;
alter table public.form_publications enable row level security;
alter table public.form_publications force row level security;
alter table public.form_assignments enable row level security;
alter table public.form_assignments force row level security;
alter table public.form_drafts enable row level security;
alter table public.form_drafts force row level security;
alter table public.form_submissions enable row level security;
alter table public.form_submissions force row level security;
alter table public.form_submission_index_values enable row level security;
alter table public.form_submission_index_values force row level security;
alter table public.form_reviews enable row level security;
alter table public.form_reviews force row level security;
alter table public.form_promotions enable row level security;
alter table public.form_promotions force row level security;
alter table public.form_offline_devices enable row level security;
alter table public.form_offline_devices force row level security;
alter table public.form_sync_receipts enable row level security;
alter table public.form_sync_receipts force row level security;
alter table public.form_attachments enable row level security;
alter table public.form_attachments force row level security;

revoke all on table
  public.form_definitions,
  public.form_versions,
  public.form_publications,
  public.form_assignments,
  public.form_drafts,
  public.form_submissions,
  public.form_submission_index_values,
  public.form_reviews,
  public.form_promotions,
  public.form_offline_devices,
  public.form_sync_receipts,
  public.form_attachments
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.form_definitions,
  public.form_versions,
  public.form_publications,
  public.form_assignments,
  public.form_drafts,
  public.form_submissions,
  public.form_submission_index_values,
  public.form_reviews,
  public.form_promotions,
  public.form_offline_devices,
  public.form_sync_receipts,
  public.form_attachments
to service_role;

revoke all on function nile_private.preserve_published_form_version()
from public, anon, authenticated;
revoke all on function nile_private.preserve_form_submission_evidence()
from public, anon, authenticated;
grant execute on function nile_private.preserve_published_form_version()
to service_role;
grant execute on function nile_private.preserve_form_submission_evidence()
to service_role;

-- Browser policies are deliberately absent. Scoped DTOs are served only after
-- the application server resolves one opaque session and its active role grant.

commit;
