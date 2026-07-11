-- Nile Learn Phase 2B: atomic durable-session lifecycle evidence.
--
-- Local-only until the master-plan checkpoint explicitly approves remote
-- promotion. These RPCs are server-only and never accept plaintext tokens.

begin;

create unique index audit_logs_session_lifecycle_uidx
  on public.audit_logs (action, entity_type, entity_id)
  where entity_type = 'auth_session'
    and action in ('session.created', 'session.revoked');

create function public.create_auth_session_with_evidence(
  p_token_hash text,
  p_user_id uuid,
  p_auth_user_id uuid,
  p_active_role_grant_id uuid,
  p_ttl_seconds integer,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  session_id uuid,
  command_id uuid,
  session_created_at timestamptz,
  session_expires_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_request_hash bytea;
  v_existing_command public.command_executions%rowtype;
  v_session_id uuid;
  v_command_id uuid;
  v_created_at timestamptz;
  v_expires_at timestamptz;
  v_grant_ends_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session token hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session request hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or pg_catalog.btrim(p_idempotency_key) = ''
    or pg_catalog.octet_length(p_idempotency_key) > 200 then
    raise exception 'Session idempotency key is invalid'
      using errcode = '22023';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 43200 then
    raise exception 'Session TTL must be between 60 and 43200 seconds'
      using errcode = '22023';
  end if;

  v_token_hash := pg_catalog.decode(pg_catalog.lower(p_token_hash), 'hex');
  v_request_hash := pg_catalog.decode(pg_catalog.lower(p_request_hash), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key, 0)
  );

  select command.*
  into v_existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_command.command_type <> 'session.create'
      or v_existing_command.actor_user_id <> p_user_id
      or v_existing_command.actor_role_grant_id <> p_active_role_grant_id
      or v_existing_command.request_hash <> v_request_hash
      or v_existing_command.target_type <> 'auth_session'
      or v_existing_command.target_id <> v_existing_command.session_id::text then
      raise exception 'Session create idempotency key conflicts with existing evidence'
        using errcode = '23505';
    end if;
    if v_existing_command.status <> 'succeeded'
      or not exists (
        select 1
        from public.audit_logs as audit
        where audit.command_id = v_existing_command.id
          and audit.action = 'session.created'
          and audit.entity_type = 'auth_session'
          and audit.entity_id = v_existing_command.session_id::text
      ) then
      raise exception 'Session create evidence is incomplete'
        using errcode = '55000';
    end if;

    select session.created_at, session.expires_at
    into strict v_created_at, v_expires_at
    from public.auth_sessions as session
    where session.id = v_existing_command.session_id;

    return query
    select
      v_existing_command.session_id,
      v_existing_command.id,
      v_created_at,
      v_expires_at,
      true;
    return;
  end if;

  select role_grant.ends_at
  into v_grant_ends_at
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.id = p_active_role_grant_id
   and role_grant.user_id = app_user.id
  cross join lateral nile_private.resolve_effective_role_grant(
    app_user.id,
    role_grant.id,
    pg_catalog.statement_timestamp()
  ) as authority
  where app_user.id = p_user_id
    and app_user.auth_user_id = p_auth_user_id
    and app_user.status = 'active';

  if not found then
    raise exception 'Session creation requires one active mapped user and effective role grant'
      using errcode = '42501';
  end if;

  v_created_at := pg_catalog.statement_timestamp();
  v_expires_at := v_created_at
    + pg_catalog.make_interval(secs => p_ttl_seconds);
  if v_grant_ends_at is not null and v_grant_ends_at < v_expires_at then
    v_expires_at := v_grant_ends_at;
  end if;
  if v_expires_at <= v_created_at then
    raise exception 'Session role grant expires too soon'
      using errcode = '42501';
  end if;

  insert into public.auth_sessions (
    token_hash,
    user_id,
    active_role_grant_id,
    provider,
    created_at,
    expires_at
  )
  values (
    v_token_hash,
    p_user_id,
    p_active_role_grant_id,
    'supabase',
    v_created_at,
    v_expires_at
  )
  returning id into v_session_id;

  insert into public.command_executions (
    idempotency_key,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    command_type,
    target_type,
    target_id,
    request_hash
  )
  values (
    p_idempotency_key,
    p_user_id,
    p_active_role_grant_id,
    v_session_id,
    'session.create',
    'auth_session',
    v_session_id::text,
    v_request_hash
  )
  returning id into v_command_id;

  insert into public.audit_logs (
    command_id,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    action,
    entity_type,
    entity_id,
    after_state,
    metadata
  )
  values (
    v_command_id,
    p_user_id,
    p_active_role_grant_id,
    v_session_id,
    'session.created',
    'auth_session',
    v_session_id::text,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'provider', 'supabase',
      'created_at', v_created_at,
      'expires_at', v_expires_at
    ),
    pg_catalog.jsonb_build_object('session_model', 'normalized')
  );

  update public.command_executions
  set status = 'succeeded',
      completed_at = pg_catalog.statement_timestamp()
  where id = v_command_id;

  return query
  select v_session_id, v_command_id, v_created_at, v_expires_at, false;
end;
$$;

create function public.revoke_auth_session_with_evidence(
  p_token_hash text,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  session_id uuid,
  command_id uuid,
  session_revoked_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_request_hash bytea;
  v_existing_command public.command_executions%rowtype;
  v_session public.auth_sessions%rowtype;
  v_command_id uuid;
  v_revoked_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session token hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session request hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or pg_catalog.btrim(p_idempotency_key) = ''
    or pg_catalog.octet_length(p_idempotency_key) > 200 then
    raise exception 'Session idempotency key is invalid'
      using errcode = '22023';
  end if;

  v_token_hash := pg_catalog.decode(pg_catalog.lower(p_token_hash), 'hex');
  v_request_hash := pg_catalog.decode(pg_catalog.lower(p_request_hash), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key, 0)
  );

  select command.*
  into v_existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_command.command_type <> 'session.revoke'
      or v_existing_command.request_hash <> v_request_hash
      or v_existing_command.target_type <> 'auth_session'
      or v_existing_command.target_id <> v_existing_command.session_id::text then
      raise exception 'Session revoke idempotency key conflicts with existing evidence'
        using errcode = '23505';
    end if;
    if v_existing_command.status <> 'succeeded'
      or not exists (
        select 1
        from public.audit_logs as audit
        where audit.command_id = v_existing_command.id
          and audit.action = 'session.revoked'
          and audit.entity_type = 'auth_session'
          and audit.entity_id = v_existing_command.session_id::text
      ) then
      raise exception 'Session revoke evidence is incomplete'
        using errcode = '55000';
    end if;

    select session.revoked_at
    into strict v_revoked_at
    from public.auth_sessions as session
    where session.id = v_existing_command.session_id;

    return query
    select
      v_existing_command.session_id,
      v_existing_command.id,
      v_revoked_at,
      true;
    return;
  end if;

  select session.*
  into v_session
  from public.auth_sessions as session
  where session.token_hash = v_token_hash
  for update;

  if not found or v_session.revoked_at is not null then
    return;
  end if;

  v_revoked_at := pg_catalog.statement_timestamp();

  insert into public.command_executions (
    idempotency_key,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    command_type,
    target_type,
    target_id,
    request_hash
  )
  values (
    p_idempotency_key,
    v_session.user_id,
    v_session.active_role_grant_id,
    v_session.id,
    'session.revoke',
    'auth_session',
    v_session.id::text,
    v_request_hash
  )
  returning id into v_command_id;

  update public.auth_sessions
  set revoked_at = v_revoked_at,
      revoked_by = v_session.user_id
  where id = v_session.id;

  insert into public.audit_logs (
    command_id,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata
  )
  values (
    v_command_id,
    v_session.user_id,
    v_session.active_role_grant_id,
    v_session.id,
    'session.revoked',
    'auth_session',
    v_session.id::text,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'expires_at', v_session.expires_at
    ),
    pg_catalog.jsonb_build_object(
      'status', 'revoked',
      'revoked_at', v_revoked_at,
      'revoked_by', v_session.user_id
    ),
    pg_catalog.jsonb_build_object('session_model', 'normalized')
  );

  update public.command_executions
  set status = 'succeeded',
      completed_at = pg_catalog.statement_timestamp()
  where id = v_command_id;

  return query
  select v_session.id, v_command_id, v_revoked_at, false;
end;
$$;

revoke all on function public.create_auth_session_with_evidence(
  text, uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated;
revoke all on function public.revoke_auth_session_with_evidence(text, text, text)
from public, anon, authenticated;

grant execute on function public.create_auth_session_with_evidence(
  text, uuid, uuid, uuid, integer, text, text
) to service_role;
grant execute on function public.revoke_auth_session_with_evidence(text, text, text)
to service_role;

commit;
