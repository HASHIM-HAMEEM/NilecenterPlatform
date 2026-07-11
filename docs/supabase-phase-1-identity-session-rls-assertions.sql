-- Nile Learn Phase 1 schema and RLS assertions.
--
-- Run only on a disposable local database after applying the reviewed Phase 1
-- migration. Create one unused fake Supabase Auth user first, then run:
--
--   psql "$DATABASE_URL" \
--     -v ON_ERROR_STOP=1 \
--     -v nile_test_auth_user_id='<fake-auth-user-uuid>' \
--     -f docs/supabase-phase-1-identity-session-rls-assertions.sql
--
-- The transaction rolls back all application fixtures. The supplied Auth user
-- must be fake, unused by app_users, and may be deleted after the test.

\set ON_ERROR_STOP on

\if :{?nile_test_auth_user_id}
\else
  \echo 'nile_test_auth_user_id is required'
  \quit 3
\endif

begin;

select set_config('nile.test.auth_user_id', :'nile_test_auth_user_id', false);

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
  rls_missing text[];
  rls_not_forced text[];
  unexpected_policies text[];
begin
  select array_agg(table_name)
  into missing_tables
  from unnest(required_tables) as table_name
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Missing Phase 1 tables: %', missing_tables;
  end if;

  select array_agg(class.relname)
  into rls_missing
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any (required_tables)
    and not class.relrowsecurity;

  if rls_missing is not null then
    raise exception 'RLS is not enabled on: %', rls_missing;
  end if;

  select array_agg(class.relname)
  into rls_not_forced
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any (required_tables)
    and not class.relforcerowsecurity;

  if rls_not_forced is not null then
    raise exception 'RLS is not forced on: %', rls_not_forced;
  end if;

  select array_agg(policy.tablename || '.' || policy.policyname)
  into unexpected_policies
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = any (required_tables);

  if unexpected_policies is not null then
    raise exception 'Phase 1 server-only tables have browser policies: %', unexpected_policies;
  end if;
end;
$$;

with inserted_branch as (
  insert into public.branches (code, name)
  values ('phase1-' || left(gen_random_uuid()::text, 12), 'Phase 1 assertion branch')
  returning id
)
select set_config('nile.test.branch_id', id::text, false)
from inserted_branch;

with inserted_branch as (
  insert into public.branches (code, name)
  values ('phase1-' || left(gen_random_uuid()::text, 12), 'Out-of-scope assertion branch')
  returning id
)
select set_config('nile.test.other_branch_id', id::text, false)
from inserted_branch;

with inserted_department as (
  insert into public.departments (code, name)
  values ('phase1-' || left(gen_random_uuid()::text, 12), 'Phase 1 assertion department')
  returning id
)
select set_config('nile.test.department_id', id::text, false)
from inserted_department;

insert into public.department_branches (department_id, branch_id)
values (
  current_setting('nile.test.department_id')::uuid,
  current_setting('nile.test.branch_id')::uuid
);

do $$
begin
  begin
    insert into public.app_users (full_name, email, status)
    values (
      'Invalid unmapped paused user',
      ('phase1-' || gen_random_uuid()::text || '@invalid.example')::citext,
      'paused'
    );
    raise exception 'A non-invited account without an Auth mapping was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

with inserted_user as (
  insert into public.app_users (
    auth_user_id,
    full_name,
    email,
    status,
    activated_at
  )
  values (
    current_setting('nile.test.auth_user_id')::uuid,
    'Phase 1 Test Teacher',
    ('phase1-' || gen_random_uuid()::text || '@invalid.example')::citext,
    'active',
    now()
  )
  returning id
)
select set_config('nile.test.app_user_id', id::text, false)
from inserted_user;

do $$
begin
  begin
    update public.app_users
    set auth_user_id = null
    where id = current_setting('nile.test.app_user_id')::uuid;
    raise exception 'Established Auth mapping mutation was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

with inserted_grant as (
  insert into public.role_grants (
    user_id,
    role,
    status,
    granted_by
  )
  values (
    current_setting('nile.test.app_user_id')::uuid,
    'teacher',
    'active',
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id
)
select set_config('nile.test.role_grant_id', id::text, false)
from inserted_grant;

insert into public.role_grant_branch_scopes (
  role_grant_id,
  branch_id,
  granted_by
)
values (
  current_setting('nile.test.role_grant_id')::uuid,
  current_setting('nile.test.branch_id')::uuid,
  current_setting('nile.test.app_user_id')::uuid
);

insert into public.role_grant_department_scopes (
  role_grant_id,
  department_id,
  granted_by
)
values (
  current_setting('nile.test.role_grant_id')::uuid,
  current_setting('nile.test.department_id')::uuid,
  current_setting('nile.test.app_user_id')::uuid
);

with inserted_grant as (
  insert into public.role_grants (
    user_id,
    role,
    status,
    granted_by
  )
  values (
    current_setting('nile.test.app_user_id')::uuid,
    'branchadmin',
    'active',
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id
)
select set_config('nile.test.other_role_grant_id', id::text, false)
from inserted_grant;

insert into public.role_grant_branch_scopes (
  role_grant_id,
  branch_id,
  granted_by
)
values (
  current_setting('nile.test.other_role_grant_id')::uuid,
  current_setting('nile.test.other_branch_id')::uuid,
  current_setting('nile.test.app_user_id')::uuid
);

insert into public.staff_profiles (user_id, title, availability_status)
values (
  current_setting('nile.test.app_user_id')::uuid,
  'Teacher',
  'available'
);

insert into public.permissions (code, category, description)
values (
  'phase1.assert.classes.read',
  'classes',
  'Assertion-only permission for assigned classes'
);

insert into public.role_permissions (role, permission_code, granted, updated_by)
values (
  'teacher',
  'phase1.assert.classes.read',
  true,
  current_setting('nile.test.app_user_id')::uuid
);

set constraints all immediate;
set constraints all deferred;

do $$
declare
  authority record;
begin
  select *
  into strict authority
  from public.resolve_login_authority(
    current_setting('nile.test.auth_user_id')::uuid,
    'teacher'
  );

  if authority.user_id <> current_setting('nile.test.app_user_id')::uuid
    or authority.active_role_grant_id <> current_setting('nile.test.role_grant_id')::uuid
    or authority.active_role <> 'teacher'
    or not (current_setting('nile.test.branch_id')::uuid = any (authority.branch_ids))
    or not (current_setting('nile.test.department_id')::uuid = any (authority.department_ids)) then
    raise exception 'Atomic login authority resolved the wrong identity, grant, or scope';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.role_grant_branch_scopes (
      role_grant_id,
      branch_id,
      granted_by
    )
    values (
      current_setting('nile.test.role_grant_id')::uuid,
      current_setting('nile.test.other_branch_id')::uuid,
      current_setting('nile.test.app_user_id')::uuid
    );
    set constraints all immediate;
    raise exception 'An invalid branch and department scope pair was accepted';
  exception
    when check_violation then null;
  end;

  set constraints all deferred;
end;
$$;

with inserted_session as (
  insert into public.auth_sessions (
    token_hash,
    user_id,
    active_role_grant_id,
    provider,
    expires_at
  )
  values (
    digest(gen_random_uuid()::text, 'sha256'),
    current_setting('nile.test.app_user_id')::uuid,
    current_setting('nile.test.role_grant_id')::uuid,
    'supabase',
    now() + interval '1 hour'
  )
  returning id
)
select set_config('nile.test.session_id', id::text, false)
from inserted_session;

do $$
declare
  authority record;
begin
  select *
  into strict authority
  from public.resolve_auth_session_authority(
    (
      select encode(session.token_hash, 'hex')
      from public.auth_sessions as session
      where session.id = current_setting('nile.test.session_id')::uuid
    )
  );

  if authority.user_id <> current_setting('nile.test.app_user_id')::uuid
    or authority.active_role_grant_id <> current_setting('nile.test.role_grant_id')::uuid
    or authority.active_role <> 'teacher'
    or not (current_setting('nile.test.branch_id')::uuid = any (authority.branch_ids))
    or not (current_setting('nile.test.department_id')::uuid = any (authority.department_ids)) then
    raise exception 'Atomic session authority resolved the wrong identity, grant, or scope';
  end if;
end;
$$;

update public.branches
set status = 'paused'
where id = current_setting('nile.test.branch_id')::uuid;

do $$
begin
  if exists (
    select 1
    from public.resolve_auth_session_authority(
      (
        select encode(session.token_hash, 'hex')
        from public.auth_sessions as session
        where session.id = current_setting('nile.test.session_id')::uuid
      )
    )
  ) then
    raise exception 'Session authority survived a paused branch scope';
  end if;
end;
$$;

update public.branches
set status = 'active'
where id = current_setting('nile.test.branch_id')::uuid;

update public.departments
set status = 'archived'
where id = current_setting('nile.test.department_id')::uuid;

do $$
begin
  if exists (
    select 1
    from public.resolve_login_authority(
      current_setting('nile.test.auth_user_id')::uuid,
      'teacher'
    )
  ) then
    raise exception 'Login authority survived an archived department scope';
  end if;
end;
$$;

update public.departments
set status = 'active'
where id = current_setting('nile.test.department_id')::uuid;

delete from public.department_branches
where department_id = current_setting('nile.test.department_id')::uuid
  and branch_id = current_setting('nile.test.branch_id')::uuid;

do $$
begin
  if exists (
    select 1
    from public.resolve_auth_session_authority(
      (
        select encode(session.token_hash, 'hex')
        from public.auth_sessions as session
        where session.id = current_setting('nile.test.session_id')::uuid
      )
    )
  ) then
    raise exception 'Session authority survived a removed branch-department relationship';
  end if;
end;
$$;

insert into public.department_branches (department_id, branch_id)
values (
  current_setting('nile.test.department_id')::uuid,
  current_setting('nile.test.branch_id')::uuid
);

do $$
declare
  resolved_grant_id uuid;
begin
  select resolved.active_role_grant_id
  into strict resolved_grant_id
  from nile_private.resolve_auth_session(
    (
      select session.token_hash
      from public.auth_sessions as session
      where session.id = current_setting('nile.test.session_id')::uuid
    )
  ) as resolved;

  if resolved_grant_id <> current_setting('nile.test.role_grant_id')::uuid then
    raise exception 'Session resolution unioned or selected the wrong role grant';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.resolve_login_authority(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.resolve_login_authority(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.resolve_auth_session_authority(text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.resolve_auth_session_authority(text)', 'EXECUTE') then
    raise exception 'Browser roles can execute a server-only authority resolver';
  end if;

  if not has_function_privilege('service_role', 'public.resolve_login_authority(uuid,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.resolve_auth_session_authority(text)', 'EXECUTE') then
    raise exception 'service_role lacks a required authority resolver privilege';
  end if;
end;
$$;

do $$
begin
  if has_sequence_privilege('anon', 'public.audit_logs_id_seq', 'USAGE')
    or has_sequence_privilege('anon', 'public.audit_logs_id_seq', 'SELECT')
    or has_sequence_privilege('anon', 'public.audit_logs_id_seq', 'UPDATE') then
    raise exception 'anon has a privilege on public.audit_logs_id_seq';
  end if;

  if has_sequence_privilege('authenticated', 'public.audit_logs_id_seq', 'USAGE')
    or has_sequence_privilege('authenticated', 'public.audit_logs_id_seq', 'SELECT')
    or has_sequence_privilege('authenticated', 'public.audit_logs_id_seq', 'UPDATE') then
    raise exception 'authenticated has a privilege on public.audit_logs_id_seq';
  end if;

  if not has_sequence_privilege('service_role', 'public.audit_logs_id_seq', 'USAGE')
    or not has_sequence_privilege('service_role', 'public.audit_logs_id_seq', 'SELECT') then
    raise exception 'service_role lacks required privilege on public.audit_logs_id_seq';
  end if;
end;
$$;

do $$
begin
  begin
    update public.auth_sessions
    set expires_at = expires_at + interval '1 hour'
    where id = current_setting('nile.test.session_id')::uuid;
    raise exception 'Session authority mutation was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

do $$
begin
  begin
    update public.role_grants
    set granted_reason = 'rewritten provenance'
    where id = current_setting('nile.test.role_grant_id')::uuid;
    raise exception 'Role-grant provenance mutation was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

with inserted_command as (
  insert into public.command_executions (
    idempotency_key,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    command_type,
    target_type,
    target_id,
    request_hash,
    requires_outbox
  )
  values (
    'phase1-command-' || gen_random_uuid()::text,
    current_setting('nile.test.app_user_id')::uuid,
    current_setting('nile.test.role_grant_id')::uuid,
    current_setting('nile.test.session_id')::uuid,
    'phase1.assert',
    'app_user',
    current_setting('nile.test.app_user_id'),
    digest('phase1-request', 'sha256'),
    true
  )
  returning id
)
select set_config('nile.test.command_id', id::text, false)
from inserted_command;

insert into public.audit_logs (
  command_id,
  actor_user_id,
  actor_role_grant_id,
  session_id,
  action,
  entity_type,
  entity_id,
  after_state
)
values (
  current_setting('nile.test.command_id')::uuid,
  current_setting('nile.test.app_user_id')::uuid,
  current_setting('nile.test.role_grant_id')::uuid,
  current_setting('nile.test.session_id')::uuid,
  'phase1.asserted',
  'app_user',
  current_setting('nile.test.app_user_id'),
  '{"status":"verified"}'::jsonb
);

do $$
begin
  begin
    update public.audit_logs
    set after_state = '{"status":"changed"}'::jsonb
    where command_id = current_setting('nile.test.command_id')::uuid;
    raise exception 'Audit mutation was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    insert into public.audit_logs (
      command_id,
      actor_user_id,
      actor_role_grant_id,
      session_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      current_setting('nile.test.command_id')::uuid,
      current_setting('nile.test.app_user_id')::uuid,
      current_setting('nile.test.role_grant_id')::uuid,
      current_setting('nile.test.session_id')::uuid,
      'phase1.secret-check',
      'app_user',
      current_setting('nile.test.app_user_id'),
      '{"access_token":"forbidden"}'::jsonb
    );
    raise exception 'Credential-shaped audit metadata was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

with inserted_outbox as (
  insert into public.outbox_events (
    command_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    idempotency_key
  )
  values (
    current_setting('nile.test.command_id')::uuid,
    'phase1.asserted',
    'app_user',
    current_setting('nile.test.app_user_id'),
    '{"safe":true}'::jsonb,
    'phase1-outbox-' || gen_random_uuid()::text
  )
  returning idempotency_key
)
select set_config('nile.test.outbox_key', idempotency_key, false)
from inserted_outbox;

do $$
begin
  begin
    insert into public.outbox_events (
      command_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    )
    values (
      current_setting('nile.test.command_id')::uuid,
      'phase1.asserted',
      'app_user',
      current_setting('nile.test.app_user_id'),
      '{"safe":true}'::jsonb,
      current_setting('nile.test.outbox_key')
    );
    raise exception 'Duplicate outbox idempotency key was accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;

update public.command_executions
set status = 'succeeded', completed_at = now()
where id = current_setting('nile.test.command_id')::uuid;

set constraints command_evidence_required immediate;
set constraints command_evidence_required deferred;

do $$
begin
  begin
    insert into public.audit_logs (
      command_id,
      actor_user_id,
      actor_role_grant_id,
      session_id,
      action,
      entity_type,
      entity_id
    )
    values (
      current_setting('nile.test.command_id')::uuid,
      current_setting('nile.test.app_user_id')::uuid,
      current_setting('nile.test.other_role_grant_id')::uuid,
      current_setting('nile.test.session_id')::uuid,
      'phase1.false-attribution',
      'app_user',
      current_setting('nile.test.app_user_id')
    );
    raise exception 'Audit evidence with mismatched command attribution was accepted';
  exception
    when foreign_key_violation then null;
  end;

  begin
    insert into public.command_executions (
      idempotency_key,
      actor_user_id,
      actor_role_grant_id,
      session_id,
      command_type,
      request_hash,
      status,
      completed_at
    )
    values (
      'phase1-missing-audit-' || gen_random_uuid()::text,
      current_setting('nile.test.app_user_id')::uuid,
      current_setting('nile.test.role_grant_id')::uuid,
      current_setting('nile.test.session_id')::uuid,
      'phase1.missing-audit',
      digest('phase1-missing-audit', 'sha256'),
      'succeeded',
      now()
    );
    set constraints command_evidence_required immediate;
    raise exception 'Successful command without audit evidence was accepted';
  exception
    when check_violation then null;
  end;

  set constraints command_evidence_required deferred;
end;
$$;

with legacy_connection as (
  insert into public.integration_connections (
    provider,
    label,
    mode,
    status,
    created_by
  )
  values (
    'legacy_ems',
    'Phase 1 migration assertion',
    'migration',
    'unconfigured',
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id
)
select set_config('nile.test.legacy_connection_id', id::text, false)
from legacy_connection;

do $$
begin
  begin
    insert into public.sync_runs (
      connection_id,
      entity_type,
      direction,
      created_by
    )
    values (
      current_setting('nile.test.legacy_connection_id')::uuid,
      'student',
      'write',
      current_setting('nile.test.app_user_id')::uuid
    );
    raise exception 'Legacy EMS write run was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.integration_connections (
      provider,
      label,
      mode,
      status,
      created_by
    )
    values (
      'moodle',
      'Invalid ready connection',
      'read_only',
      'ready',
      current_setting('nile.test.app_user_id')::uuid
    );
    raise exception 'Ready connection without evidence was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.integration_connections (
      provider,
      label,
      mode,
      status,
      created_by
    )
    values (
      'moodle',
      'Forbidden write connection',
      'write_limited',
      'unconfigured',
      current_setting('nile.test.app_user_id')::uuid
    );
    raise exception 'Moodle write authority was enabled in the read-only phase';
  exception
    when check_violation then null;
  end;
end;
$$;

with inserted_external_record as (
  insert into public.external_records (
    connection_id,
    entity_type,
    external_id,
    source_updated_at,
    source_hash
  )
  values (
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    'legacy-student-1',
    now(),
    digest('legacy-student-payload-v1', 'sha256')
  )
  returning id
)
select set_config('nile.test.external_record_id', id::text, false)
from inserted_external_record;

with inserted_migration_run as (
  insert into public.migration_runs (
    connection_id,
    entity_type,
    run_kind,
    source_manifest_hash,
    source_count,
    created_by
  )
  values (
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    'dry_run',
    digest('manifest-v1', 'sha256'),
    1,
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id
)
select set_config('nile.test.migration_run_id', id::text, false)
from inserted_migration_run;

insert into public.migration_run_items (
  migration_run_id,
  connection_id,
  entity_type,
  external_record_id,
  external_id,
  source_hash,
  match_status
)
values (
  current_setting('nile.test.migration_run_id')::uuid,
  current_setting('nile.test.legacy_connection_id')::uuid,
  'student',
  current_setting('nile.test.external_record_id')::uuid,
  'legacy-student-1',
  digest('legacy-student-payload-v1', 'sha256'),
  'unmatched'
);

do $$
declare
  approved_run_id uuid;
  approved_item_id uuid;
  duplicate_effect_run_id uuid;
  duplicate_effect_item_id uuid;
  delta_run_id uuid;
  delta_item_id uuid;
  target_internal_id uuid := gen_random_uuid();
  cutover_run_id uuid;
begin
  insert into public.migration_runs (
    connection_id,
    entity_type,
    run_kind,
    source_manifest_hash,
    source_count,
    created_by
  )
  values (
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    'approved_import',
    digest('manifest-v2', 'sha256'),
    1,
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id into approved_run_id;

  update public.migration_runs set status = 'validating' where id = approved_run_id;
  update public.migration_runs set status = 'ready' where id = approved_run_id;
  update public.migration_runs
  set status = 'approved',
      approved_by = current_setting('nile.test.app_user_id')::uuid,
      approved_at = now()
  where id = approved_run_id;
  update public.migration_runs
  set status = 'applying', started_at = now()
  where id = approved_run_id;

  update public.external_records
  set internal_id = target_internal_id
  where id = current_setting('nile.test.external_record_id')::uuid;

  begin
    update public.external_records
    set internal_id = gen_random_uuid()
    where id = current_setting('nile.test.external_record_id')::uuid;
    raise exception 'Durable external mapping rewrite was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  insert into public.migration_run_items (
    migration_run_id,
    connection_id,
    entity_type,
    external_record_id,
    external_id,
    source_hash,
    match_status,
    internal_id
  )
  values (
    approved_run_id,
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    current_setting('nile.test.external_record_id')::uuid,
    'legacy-student-1',
    digest('legacy-student-payload-v1', 'sha256'),
    'matched',
    target_internal_id
  )
  returning id into approved_item_id;

  update public.migration_run_items
  set match_status = 'imported', applied_at = now()
  where id = approved_item_id;

  update public.migration_runs
  set status = 'completed',
      matched_count = 1,
      imported_count = 1,
      completed_at = now()
  where id = approved_run_id;

  insert into public.migration_runs (
    connection_id,
    entity_type,
    run_kind,
    source_manifest_hash,
    source_count,
    created_by
  )
  values (
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    'approved_import',
    digest('duplicate-effect-manifest', 'sha256'),
    1,
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id into duplicate_effect_run_id;

  update public.migration_runs set status = 'validating' where id = duplicate_effect_run_id;
  update public.migration_runs set status = 'ready' where id = duplicate_effect_run_id;
  update public.migration_runs
  set status = 'approved',
      approved_by = current_setting('nile.test.app_user_id')::uuid,
      approved_at = now()
  where id = duplicate_effect_run_id;
  update public.migration_runs
  set status = 'applying', started_at = now()
  where id = duplicate_effect_run_id;

  insert into public.migration_run_items (
    migration_run_id,
    connection_id,
    entity_type,
    external_record_id,
    external_id,
    source_hash,
    match_status,
    internal_id
  )
  values (
    duplicate_effect_run_id,
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    current_setting('nile.test.external_record_id')::uuid,
    'legacy-student-1',
    digest('legacy-student-payload-v1', 'sha256'),
    'matched',
    target_internal_id
  )
  returning id into duplicate_effect_item_id;

  begin
    update public.migration_run_items
    set match_status = 'imported', applied_at = now()
    where id = duplicate_effect_item_id;
    raise exception 'The same EMS source version produced duplicate imported effects';
  exception
    when unique_violation then null;
  end;

  begin
    update public.migration_run_items
    set source_hash = digest('rewritten-source', 'sha256')
    where migration_run_id = current_setting('nile.test.migration_run_id')::uuid;
    raise exception 'Migration source hash mutation was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  update public.external_records
  set source_hash = digest('legacy-student-payload-v2', 'sha256'),
      source_version = 'v2',
      source_updated_at = now()
  where id = current_setting('nile.test.external_record_id')::uuid;

  insert into public.migration_runs (
    connection_id,
    entity_type,
    run_kind,
    source_manifest_hash,
    source_count,
    created_by
  )
  values (
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    'final_delta',
    digest('delta-manifest-v2', 'sha256'),
    1,
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id into delta_run_id;

  update public.migration_runs set status = 'validating' where id = delta_run_id;
  update public.migration_runs set status = 'ready' where id = delta_run_id;
  update public.migration_runs
  set status = 'approved',
      approved_by = current_setting('nile.test.app_user_id')::uuid,
      approved_at = now()
  where id = delta_run_id;
  update public.migration_runs
  set status = 'applying', started_at = now()
  where id = delta_run_id;

  insert into public.migration_run_items (
    migration_run_id,
    connection_id,
    entity_type,
    external_record_id,
    external_id,
    source_hash,
    match_status,
    internal_id
  )
  values (
    delta_run_id,
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    current_setting('nile.test.external_record_id')::uuid,
    'legacy-student-1',
    digest('legacy-student-payload-v2', 'sha256'),
    'matched',
    target_internal_id
  )
  returning id into delta_item_id;

  update public.migration_run_items
  set match_status = 'imported', applied_at = now()
  where id = delta_item_id;

  update public.migration_runs
  set status = 'completed',
      matched_count = 1,
      imported_count = 1,
      completed_at = now()
  where id = delta_run_id;

  insert into public.migration_runs (
    connection_id,
    entity_type,
    run_kind,
    source_manifest_hash,
    source_count,
    created_by
  )
  values (
    current_setting('nile.test.legacy_connection_id')::uuid,
    'student',
    'cutover',
    digest('cutover-manifest', 'sha256'),
    0,
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id into cutover_run_id;

  update public.migration_runs set status = 'validating' where id = cutover_run_id;
  update public.migration_runs set status = 'ready' where id = cutover_run_id;
  update public.migration_runs
  set status = 'approved',
      approved_by = current_setting('nile.test.app_user_id')::uuid,
      approved_at = now()
  where id = cutover_run_id;
  update public.migration_runs
  set status = 'applying', started_at = now()
  where id = cutover_run_id;

  begin
    update public.migration_runs
    set status = 'completed', completed_at = now()
    where id = cutover_run_id;
    set constraints migration_cutover_evidence_required immediate;
    raise exception 'Cutover without reconciliation and retirement evidence was accepted';
  exception
    when check_violation then null;
  end;

  set constraints migration_cutover_evidence_required deferred;
end;
$$;

do $$
declare
  missing_fk_indexes text[];
begin
  select pg_catalog.array_agg(
    referencing_table.relname || '.' || constraint_record.conname
    order by referencing_table.relname, constraint_record.conname
  )
  into missing_fk_indexes
  from pg_catalog.pg_constraint as constraint_record
  join pg_catalog.pg_class as referencing_table
    on referencing_table.oid = constraint_record.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = referencing_table.relnamespace
  where namespace.nspname = 'public'
    and referencing_table.relname in (
      'branches', 'app_users', 'departments', 'department_branches',
      'permissions', 'role_permissions', 'role_grants',
      'role_grant_branch_scopes', 'role_grant_department_scopes',
      'staff_profiles', 'staff_subjects', 'auth_sessions',
      'command_executions', 'audit_logs', 'outbox_events',
      'integration_connections', 'integration_env_requirements',
      'external_records', 'sync_cursors', 'sync_runs', 'sync_run_items',
      'reconciliation_cases', 'migration_runs', 'migration_run_items',
      'migration_evidence'
    )
    and constraint_record.contype = 'f'
    and not exists (
      select 1
      from pg_catalog.pg_index as index_record
      where index_record.indrelid = constraint_record.conrelid
        and index_record.indisvalid
        and index_record.indisready
        and index_record.indnkeyatts >= cardinality(constraint_record.conkey)
        and not exists (
          select 1
          from unnest(constraint_record.conkey) with ordinality
            as foreign_key_column(attnum, position)
          where (index_record.indkey::smallint[])[foreign_key_column.position::integer - 1]
            is distinct from foreign_key_column.attnum
        )
    );

  if missing_fk_indexes is not null then
    raise exception 'Foreign keys lack a leading supporting index: %', missing_fk_indexes;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  for table_name in
    select class.relname
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname in (
        'branches', 'app_users', 'departments', 'department_branches',
        'permissions', 'role_permissions', 'role_grants',
        'role_grant_branch_scopes', 'role_grant_department_scopes',
        'staff_profiles', 'staff_subjects', 'auth_sessions',
        'command_executions', 'audit_logs', 'outbox_events',
        'integration_connections', 'integration_env_requirements',
        'external_records', 'sync_cursors', 'sync_runs', 'sync_run_items',
        'reconciliation_cases', 'migration_runs', 'migration_run_items',
        'migration_evidence'
      )
  loop
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or has_table_privilege('anon', 'public.' || table_name, 'INSERT')
      or has_table_privilege('anon', 'public.' || table_name, 'UPDATE')
      or has_table_privilege('anon', 'public.' || table_name, 'DELETE') then
      raise exception 'anon has a privilege on public.%', table_name;
    end if;

    if has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') then
      raise exception 'authenticated has write privilege on public.%', table_name;
    end if;

    if has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') then
      raise exception 'authenticated can read server-only Phase 1 table public.%', table_name;
    end if;

    if not has_table_privilege('service_role', 'public.' || table_name, 'SELECT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'INSERT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'UPDATE')
      or not has_table_privilege('service_role', 'public.' || table_name, 'DELETE') then
      raise exception 'service_role lacks required privilege on public.%', table_name;
    end if;
  end loop;
end;
$$;

do $$
declare
  insecure_functions text[];
begin
  select array_agg(procedure.proname)
  into insecure_functions
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where (
      namespace.nspname = 'nile_private'
      or (
        namespace.nspname = 'public'
        and procedure.proname in (
          'resolve_login_authority',
          'resolve_auth_session_authority'
        )
      )
    )
    and procedure.prosecdef
    and (
      procedure.proconfig is null
      or array_to_string(procedure.proconfig, ',') not like '%search_path=%'
      or array_to_string(procedure.proconfig, ',') like '%public%'
    );

  if insecure_functions is not null then
    raise exception 'Security-definer functions have unsafe search_path: %', insecure_functions;
  end if;

  if not nile_private.jsonb_has_forbidden_keys(
    '{"nested":{"client_secret":"x","moodle_token":"y","authorization_header":"z"}}'::jsonb
  ) then
    raise exception 'Credential-shaped JSON key was not rejected';
  end if;

  if nile_private.jsonb_has_forbidden_keys(
    '{"event":"password.changed","changed":true}'::jsonb
  ) then
    raise exception 'Safe audit metadata was rejected';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.audit_logs'::regclass
      and tgname = 'audit_logs_immutable'
      and not tgisinternal
  ) then
    raise exception 'Immutable audit trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.role_grants'::regclass
      and contype = 'x'
  ) then
    raise exception 'Role-grant overlap exclusion is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.auth_sessions'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%active_role_grant_id, user_id%'
  ) then
    raise exception 'Session-to-user role-grant composite FK is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.command_executions'::regclass
      and tgname = 'command_evidence_required'
      and not tgisinternal
  ) then
    raise exception 'Deferred command evidence trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.migration_runs'::regclass
      and tgname = 'migration_cutover_evidence_required'
      and not tgisinternal
  ) then
    raise exception 'Migration cutover evidence trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'nile_private'
      and procedure.proname = 'resolve_auth_session'
  ) then
    raise exception 'Authoritative durable-session resolver is missing';
  end if;
end;
$$;

-- Constraint behavior assertions continue below.

do $$
begin
  begin
    insert into public.role_grants (
      user_id,
      role,
      status,
      granted_by
    )
    values (
      current_setting('nile.test.app_user_id')::uuid,
      'teacher',
      'active',
      current_setting('nile.test.app_user_id')::uuid
    );
    raise exception 'Overlapping active role grant was accepted';
  exception
    when exclusion_violation then null;
  end;
end;
$$;

do $$
declare
  temporary_grant_id uuid;
begin
  insert into public.role_grants (user_id, role, status, granted_by)
  values (
    current_setting('nile.test.app_user_id')::uuid,
    'superadmin',
    'active',
    current_setting('nile.test.app_user_id')::uuid
  )
  returning id into temporary_grant_id;

  begin
    insert into public.role_grant_branch_scopes (
      role_grant_id,
      branch_id,
      granted_by
    )
    values (
      temporary_grant_id,
      current_setting('nile.test.branch_id')::uuid,
      current_setting('nile.test.app_user_id')::uuid
    );
    set constraints all immediate;
    raise exception 'Scoped Super Admin grant was accepted';
  exception
    when check_violation then null;
  end;

  set constraints all deferred;
end;
$$;

update public.role_grants
set status = 'revoked',
    revoked_at = now(),
    revoked_by = current_setting('nile.test.app_user_id')::uuid,
    revocation_reason = 'Phase 1 session invalidation assertion'
where id = current_setting('nile.test.role_grant_id')::uuid;

do $$
declare
  resolved_count integer;
begin
  select count(*)
  into resolved_count
  from nile_private.resolve_auth_session(
    (
      select session.token_hash
      from public.auth_sessions as session
      where session.id = current_setting('nile.test.session_id')::uuid
    )
  );

  if resolved_count <> 0 then
    raise exception 'A revoked active role grant still resolved an application session';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('nile.test.auth_user_id'),
  true
);

set local role authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'branches', 'app_users', 'departments', 'department_branches',
    'permissions', 'role_permissions', 'role_grants',
    'role_grant_branch_scopes', 'role_grant_department_scopes',
    'staff_profiles', 'staff_subjects', 'auth_sessions',
    'command_executions', 'audit_logs', 'outbox_events',
    'integration_connections', 'integration_env_requirements',
    'external_records', 'sync_cursors', 'sync_runs', 'sync_run_items',
    'reconciliation_cases', 'migration_runs', 'migration_run_items',
    'migration_evidence'
  ]
  loop
    begin
      execute format('select count(*) from public.%I', table_name);
      raise exception 'Authenticated browser read server-only table public.%', table_name;
    exception
      when insufficient_privilege then null;
    end;
  end loop;

  begin
    perform *
    from nile_private.resolve_auth_session(digest('browser-token', 'sha256'));
    raise exception 'Authenticated browser executed the private session resolver';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

rollback;
