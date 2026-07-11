-- Nile Learn Phase 13E finite legacy form migration evidence.
--
-- Status: additive local-only migration. This stores import and reconciliation
-- evidence only. No provider credential, polling job, webhook, or live sync is
-- authorized by this phase.

begin;

create function nile_private.preserve_form_legacy_import_run()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Legacy form import runs are durable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.provider is distinct from new.provider
    or old.source_form_id is distinct from new.source_form_id
    or old.source_form_title is distinct from new.source_form_title
    or old.target_publication_id is distinct from new.target_publication_id
    or old.target_version_id is distinct from new.target_version_id
    or old.mapping_json is distinct from new.mapping_json
    or old.source_offset is distinct from new.source_offset
    or old.source_limit is distinct from new.source_limit
    or old.preview_hash is distinct from new.preview_hash
    or old.total_rows is distinct from new.total_rows
    or old.valid_rows is distinct from new.valid_rows
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'Legacy form import run provenance is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_form_legacy_import_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Legacy form import records are durable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.run_id is distinct from new.run_id
    or old.provider is distinct from new.provider
    or old.source_form_id is distinct from new.source_form_id
    or old.source_submission_id is distinct from new.source_submission_id
    or old.payload_hash is distinct from new.payload_hash
    or old.submission_id is distinct from new.submission_id
    or old.errors_json is distinct from new.errors_json
    or old.created_at is distinct from new.created_at then
    raise exception 'Legacy form import record provenance is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create table public.form_legacy_import_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'jotform'),
  source_form_id text not null check (char_length(source_form_id) between 3 and 40),
  source_form_title text not null check (char_length(source_form_title) between 1 and 240),
  target_publication_id uuid not null references public.form_publications(id) on delete restrict,
  target_version_id uuid not null references public.form_versions(id) on delete restrict,
  mapping_json jsonb not null check (jsonb_typeof(mapping_json) = 'array'),
  source_offset integer not null default 0 check (source_offset >= 0),
  source_limit integer not null check (source_limit between 1 and 1000),
  preview_hash bytea not null check (octet_length(preview_hash) = 32),
  status text not null check (status in ('previewed', 'imported', 'reconciled', 'failed')),
  total_rows integer not null check (total_rows >= 0),
  valid_rows integer not null check (valid_rows between 0 and total_rows),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  exception_rows integer not null default 0 check (exception_rows >= 0),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (not nile_private.jsonb_has_forbidden_keys(mapping_json)),
  check ((status = 'previewed') = (completed_at is null))
);

create index form_legacy_import_runs_source_idx
  on public.form_legacy_import_runs (provider, source_form_id, created_at desc);

alter table public.form_submissions
  drop constraint form_submissions_legacy_import_run_id_fkey,
  add constraint form_submissions_legacy_import_run_id_fkey
    foreign key (legacy_import_run_id)
    references public.form_legacy_import_runs(id) on delete restrict;

create table public.form_legacy_import_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.form_legacy_import_runs(id) on delete restrict,
  provider text not null check (provider = 'jotform'),
  source_form_id text not null check (char_length(source_form_id) between 3 and 40),
  source_submission_id text not null check (char_length(source_submission_id) between 1 and 128),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  submission_id uuid references public.form_submissions(id) on delete restrict,
  reconciliation_status text not null
    check (reconciliation_status in ('pending', 'matched', 'exception')),
  errors_json jsonb not null default '[]'::jsonb check (jsonb_typeof(errors_json) = 'array'),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  reconciled_by uuid references public.app_users(id) on delete restrict,
  reconciled_at timestamptz,
  check (not nile_private.jsonb_has_forbidden_keys(errors_json)),
  check (reconciliation_status <> 'pending' or reconciled_at is null),
  check (reconciliation_status <> 'matched' or reconciled_at is not null),
  check (reconciled_by is null or reconciled_at is not null),
  check ((submission_id is null) = (reconciliation_status = 'exception' and jsonb_array_length(errors_json) > 0))
);

create unique index form_legacy_import_records_imported_source_uidx
  on public.form_legacy_import_records (provider, source_form_id, source_submission_id)
  where submission_id is not null;

create index form_legacy_import_records_run_idx
  on public.form_legacy_import_records (run_id, reconciliation_status, created_at);

create trigger form_legacy_import_runs_preserve_evidence
before update or delete on public.form_legacy_import_runs
for each row execute function nile_private.preserve_form_legacy_import_run();

create trigger form_legacy_import_records_preserve_evidence
before update or delete on public.form_legacy_import_records
for each row execute function nile_private.preserve_form_legacy_import_record();

alter table public.form_legacy_import_runs enable row level security;
alter table public.form_legacy_import_runs force row level security;
alter table public.form_legacy_import_records enable row level security;
alter table public.form_legacy_import_records force row level security;

revoke all on table
  public.form_legacy_import_runs,
  public.form_legacy_import_records
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.form_legacy_import_runs,
  public.form_legacy_import_records
to service_role;

revoke all on function nile_private.preserve_form_legacy_import_run()
from public, anon, authenticated;
revoke all on function nile_private.preserve_form_legacy_import_record()
from public, anon, authenticated;
grant execute on function nile_private.preserve_form_legacy_import_run()
to service_role;
grant execute on function nile_private.preserve_form_legacy_import_record()
to service_role;

commit;
