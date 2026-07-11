-- Semantic assertions for the local-only Phase 13E migration evidence.

do $$
declare
  table_name text;
  table_row record;
  browser_role text;
begin
  foreach table_name in array array[
    'form_legacy_import_runs',
    'form_legacy_import_records'
  ] loop
    select class.relrowsecurity, class.relforcerowsecurity
    into table_row
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = table_name
      and class.relkind = 'r';

    if not found then
      raise exception 'Missing legacy form migration table: %', table_name;
    end if;
    if not table_row.relrowsecurity or not table_row.relforcerowsecurity then
      raise exception 'RLS is not enabled and forced for %', table_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_policies
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
  trigger_count integer;
begin
  select count(*) into trigger_count
  from pg_catalog.pg_trigger
  where not tgisinternal
    and tgname in (
      'form_legacy_import_runs_preserve_evidence',
      'form_legacy_import_records_preserve_evidence'
    );

  if trigger_count <> 2 then
    raise exception 'Expected 2 legacy import evidence triggers, found %', trigger_count;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'form_legacy_import_records_imported_source_uidx'
  ) then
    raise exception 'Legacy imported source replay index is missing';
  end if;
end;
$$;
