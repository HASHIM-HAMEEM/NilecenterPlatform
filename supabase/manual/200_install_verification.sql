-- Nile Learn manual installation verification.
--
-- Run after 001 and 002. This script is read-only: it creates no application
-- rows and raises an exception when the identity/session foundation is unsafe
-- or incomplete.

begin read only;

do $$
declare
  required_tables text[] := array[
    'branches',
    'app_users',
    'departments',
    'department_branches',
    'permissions',
    'role_permissions',
    'role_grants',
    'role_grant_branch_scopes',
    'role_grant_department_scopes',
    'staff_profiles',
    'staff_subjects',
    'auth_sessions',
    'command_executions',
    'audit_logs',
    'outbox_events',
    'integration_connections',
    'integration_env_requirements',
    'external_records',
    'sync_cursors',
    'sync_runs',
    'sync_run_items',
    'reconciliation_cases',
    'migration_runs',
    'migration_run_items',
    'migration_evidence'
  ];
  missing_tables text[];
  unsafe_rls text[];
  browser_policy_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(required_tables) as table_name
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Missing Nile Learn tables: %', missing_tables;
  end if;

  select array_agg(class.relname order by class.relname)
  into unsafe_rls
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any (required_tables)
    and (not class.relrowsecurity or not class.relforcerowsecurity);

  if unsafe_rls is not null then
    raise exception 'RLS must be enabled and forced on: %', unsafe_rls;
  end if;

  select array_agg(policy.tablename order by policy.tablename)
  into browser_policy_tables
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = any (required_tables);

  if browser_policy_tables is not null then
    raise exception 'Server-only tables unexpectedly expose browser policies: %', browser_policy_tables;
  end if;

  if to_regprocedure(
    'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)'
  ) is null then
    raise exception 'create_auth_session_with_evidence RPC is missing';
  end if;

  if to_regprocedure(
    'public.revoke_auth_session_with_evidence(text,text,text)'
  ) is null then
    raise exception 'revoke_auth_session_with_evidence RPC is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
    'execute'
  ) then
    raise exception 'Browser roles can execute the session creation RPC';
  end if;

  if has_function_privilege(
    'anon',
    'public.revoke_auth_session_with_evidence(text,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.revoke_auth_session_with_evidence(text,text,text)',
    'execute'
  ) then
    raise exception 'Browser roles can execute the session revocation RPC';
  end if;
end;
$$;

select
  'Nile Learn identity/session foundation verified' as result,
  current_database() as database_name,
  current_timestamp as verified_at,
  (select count(*) from pg_catalog.pg_tables
   where schemaname = 'public'
     and tablename = any (array[
       'branches', 'app_users', 'departments', 'department_branches',
       'permissions', 'role_permissions', 'role_grants',
       'role_grant_branch_scopes', 'role_grant_department_scopes',
       'staff_profiles', 'staff_subjects', 'auth_sessions',
       'command_executions', 'audit_logs', 'outbox_events',
       'integration_connections', 'integration_env_requirements',
       'external_records', 'sync_cursors', 'sync_runs', 'sync_run_items',
       'reconciliation_cases', 'migration_runs', 'migration_run_items',
       'migration_evidence'
     ])) as verified_table_count;

commit;
