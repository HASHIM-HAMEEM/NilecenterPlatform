-- Semantic assertions for the local-only Nile Forms foundation.

do $$
declare
  expected_tables text[] := array[
    'form_definitions',
    'form_versions',
    'form_publications',
    'form_assignments',
    'form_drafts',
    'form_submissions',
    'form_submission_index_values',
    'form_reviews',
    'form_promotions',
    'form_offline_devices',
    'form_sync_receipts',
    'form_attachments'
  ];
  table_name text;
  table_row record;
  browser_role text;
begin
  foreach table_name in array expected_tables loop
    select class.relrowsecurity, class.relforcerowsecurity
    into table_row
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = table_name
      and class.relkind = 'r';

    if not found then
      raise exception 'Missing Nile Forms table: %', table_name;
    end if;
    if not table_row.relrowsecurity or not table_row.relforcerowsecurity then
      raise exception 'RLS is not enabled and forced for %', table_name;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = table_name
    ) then
      raise exception 'Browser-facing policy unexpectedly exists for %', table_name;
    end if;

    foreach browser_role in array array['anon', 'authenticated'] loop
      if pg_catalog.has_table_privilege(browser_role, 'public.' || table_name, 'SELECT')
        or pg_catalog.has_table_privilege(browser_role, 'public.' || table_name, 'INSERT')
        or pg_catalog.has_table_privilege(browser_role, 'public.' || table_name, 'UPDATE')
        or pg_catalog.has_table_privilege(browser_role, 'public.' || table_name, 'DELETE') then
        raise exception '% has direct privilege on %', browser_role, table_name;
      end if;
    end loop;
  end loop;
end;
$$;

do $$
declare
  permission_count integer;
  trigger_count integer;
begin
  select count(*)
  into permission_count
  from public.permissions
  where code in (
    'forms.read',
    'forms.write',
    'forms.publish',
    'forms.assign',
    'forms.respond',
    'form_submissions.read',
    'form_submissions.review',
    'form_submissions.export'
  );

  if permission_count <> 8 then
    raise exception 'Expected 8 Nile Forms permissions, found %', permission_count;
  end if;

  select count(*)
  into trigger_count
  from pg_catalog.pg_trigger
  where not tgisinternal
    and tgname in (
      'form_versions_preserve_published',
      'form_submissions_preserve_evidence',
      'form_reviews_immutable',
      'form_sync_receipts_immutable'
    );

  if trigger_count <> 4 then
    raise exception 'Expected 4 Nile Forms evidence triggers, found %', trigger_count;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'form_submissions_client_id_uidx'
  ) then
    raise exception 'Offline/web client submission idempotency index is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'form_submissions_legacy_source_uidx'
  ) then
    raise exception 'Legacy import replay index is missing';
  end if;
end;
$$;
