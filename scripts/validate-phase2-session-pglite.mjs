import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");

function readSingleMigration(suffix) {
  const files = readdirSync(migrationsDir).filter(file =>
    file.endsWith(suffix)
  );
  assert.equal(
    files.length,
    1,
    `Expected exactly one migration ending in ${suffix}, found ${files.length}`
  );
  return readFileSync(path.join(migrationsDir, files[0]), "utf8");
}

const phase1Migration = readSingleMigration(
  "_phase1_identity_scope_session_audit_mapping.sql"
);
const phase2Migration = readSingleMigration(
  "_phase2b_atomic_session_lifecycle.sql"
);
const manualPhase1Migration = readFileSync(
  path.join(
    root,
    "supabase/manual/001_phase1_identity_scope_session_audit_mapping.sql"
  ),
  "utf8"
);
const manualPhase2Migration = readFileSync(
  path.join(root, "supabase/manual/002_phase2b_atomic_session_lifecycle.sql"),
  "utf8"
);
const phase2Rollback = readFileSync(
  path.join(root, "supabase/manual/901_phase2b_rollback.sql"),
  "utf8"
);
const fakeSeed = readFileSync(
  path.join(root, "supabase/manual/100_fake_seed.sql"),
  "utf8"
);

assert.equal(
  phase1Migration,
  manualPhase1Migration,
  "Manual Phase 1 SQL differs from the promoted migration"
);
assert.equal(
  phase2Migration,
  manualPhase2Migration,
  "Manual Phase 2B SQL differs from the promoted migration"
);

const authUserId = "10000000-0000-4000-8000-000000000002";
const appUserId = "40000000-0000-4000-8000-000000000002";
const roleGrantId = "50000000-0000-4000-8000-000000000002";
const branchId = "20000000-0000-4000-8000-000000000001";
const departmentId = "30000000-0000-4000-8000-000000000001";
const departmentScopeId = "70000000-0000-4000-8000-000000000001";
const tokenHash = "a".repeat(64);
const createRequestHash = "b".repeat(64);
const createIdempotencyKey = `session.create:${tokenHash}`;
const revokeRequestHash = "c".repeat(64);
const revokeIdempotencyKey = `session.revoke:${tokenHash}`;

function logStep(label, startedAt, details = {}) {
  console.log(
    JSON.stringify({
      label,
      ok: true,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })
  );
}

async function runSql(database, label, sql) {
  const startedAt = Date.now();
  await database.exec(sql);
  logStep(label, startedAt);
}

async function expectSqlState(label, expectedCode, callback) {
  const startedAt = Date.now();
  let caught;
  try {
    await callback();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `${label} should fail with SQLSTATE ${expectedCode}`);
  assert.equal(
    caught.code,
    expectedCode,
    `${label} returned SQLSTATE ${caught.code ?? "unknown"}: ${caught.message}`
  );
  logStep(label, startedAt, { sqlState: expectedCode });
}

async function createSession(database, input = {}) {
  return database.query(
    `
      select *
      from public.create_auth_session_with_evidence(
        $1::text,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::integer,
        $6::text,
        $7::text
      )
    `,
    [
      input.tokenHash ?? tokenHash,
      input.userId ?? appUserId,
      input.authUserId ?? authUserId,
      input.roleGrantId ?? roleGrantId,
      input.ttlSeconds ?? 3600,
      input.idempotencyKey ?? createIdempotencyKey,
      input.requestHash ?? createRequestHash,
    ]
  );
}

async function revokeSession(database, input = {}) {
  return database.query(
    `
      select *
      from public.revoke_auth_session_with_evidence(
        $1::text,
        $2::text,
        $3::text
      )
    `,
    [
      input.tokenHash ?? tokenHash,
      input.idempotencyKey ?? revokeIdempotencyKey,
      input.requestHash ?? revokeRequestHash,
    ]
  );
}

async function resolveSessionAuthority(
  database,
  candidateTokenHash = tokenHash
) {
  return database.query(
    `
      select
        user_id,
        auth_user_id,
        active_role_grant_id,
        active_role,
        branch_ids,
        department_ids
      from public.resolve_auth_session_authority($1::text)
    `,
    [candidateTokenHash]
  );
}

async function expectRoleExecutionDenied(database, role, label, callback) {
  const startedAt = Date.now();
  let caught;
  await database.exec("begin");
  try {
    await database.exec(`set local role ${role}`);
    await callback();
  } catch (error) {
    caught = error;
  } finally {
    await database.exec("rollback");
  }
  assert.ok(caught, `${label} should be denied for ${role}`);
  assert.equal(
    caught.code,
    "42501",
    `${label} returned SQLSTATE ${caught.code ?? "unknown"}: ${caught.message}`
  );
  logStep(label, startedAt, { role, sqlState: "42501" });
}

async function assertRoleExecutionDenials(database) {
  for (const role of ["anon", "authenticated"]) {
    await expectRoleExecutionDenied(
      database,
      role,
      `${role}-create-execute-denied`,
      () =>
        createSession(database, {
          tokenHash: "3".repeat(64),
          idempotencyKey: `session.create:${role}`,
          requestHash: "4".repeat(64),
        })
    );
    await expectRoleExecutionDenied(
      database,
      role,
      `${role}-revoke-execute-denied`,
      () =>
        revokeSession(database, {
          tokenHash: "3".repeat(64),
          idempotencyKey: `session.revoke:${role}`,
          requestHash: "5".repeat(64),
        })
    );
  }
  return 4;
}

async function assertAuthorityHiddenDuring(database, label, mutationSql) {
  const startedAt = Date.now();
  await database.exec("begin");
  try {
    await database.exec(mutationSql);
    const hidden = await resolveSessionAuthority(database);
    assert.equal(
      hidden.rows.length,
      0,
      `${label} should remove session authority`
    );
  } finally {
    await database.exec("rollback");
  }
  const restored = await resolveSessionAuthority(database);
  assert.equal(
    restored.rows.length,
    1,
    `${label} rollback should restore authority`
  );
  logStep(label, startedAt);
}

async function assertLiveAuthorityResolution(database) {
  const initial = await resolveSessionAuthority(database);
  assert.deepEqual(initial.rows, [
    {
      user_id: appUserId,
      auth_user_id: authUserId,
      active_role_grant_id: roleGrantId,
      active_role: "teacher",
      branch_ids: [branchId],
      department_ids: [departmentId],
    },
  ]);

  await assertAuthorityHiddenDuring(
    database,
    "authority-user-status-refresh",
    `update public.app_users set status = 'paused' where id = '${appUserId}'::uuid`
  );
  await assertAuthorityHiddenDuring(
    database,
    "authority-role-grant-refresh",
    `
      update public.role_grants
      set status = 'revoked',
          revoked_at = now(),
          revoked_by = '40000000-0000-4000-8000-000000000006'::uuid,
          revocation_reason = 'Portable authority check'
      where id = '${roleGrantId}'::uuid
    `
  );
  await assertAuthorityHiddenDuring(
    database,
    "authority-branch-status-refresh",
    `update public.branches set status = 'paused' where id = '${branchId}'::uuid`
  );
  await assertAuthorityHiddenDuring(
    database,
    "authority-department-status-refresh",
    `update public.departments set status = 'paused' where id = '${departmentId}'::uuid`
  );
  await assertAuthorityHiddenDuring(
    database,
    "authority-scope-window-refresh",
    `
      update public.role_grant_department_scopes
      set ends_at = now()
      where id = '${departmentScopeId}'::uuid
    `
  );

  const expiredTokenHash = "7".repeat(64);
  await database.exec("begin");
  try {
    await database.query(
      `
        insert into public.auth_sessions (
          token_hash,
          user_id,
          active_role_grant_id,
          provider,
          created_at,
          expires_at
        )
        values (
          decode($1::text, 'hex'),
          $2::uuid,
          $3::uuid,
          'supabase',
          now() - interval '2 minutes',
          now() - interval '1 minute'
        )
      `,
      [expiredTokenHash, appUserId, roleGrantId]
    );
    const expired = await resolveSessionAuthority(database, expiredTokenHash);
    assert.equal(expired.rows.length, 0, "Expired sessions must not resolve");
  } finally {
    await database.exec("rollback");
  }

  return {
    activeRole: initial.rows[0].active_role,
    branchIds: initial.rows[0].branch_ids,
    departmentIds: initial.rows[0].department_ids,
    refreshDenials: 6,
  };
}

async function assertFunctionPrivileges(database) {
  const result = await database.query(`
    select
      has_function_privilege(
        'anon',
        'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
        'execute'
      ) as anon_create,
      has_function_privilege(
        'authenticated',
        'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
        'execute'
      ) as authenticated_create,
      has_function_privilege(
        'anon',
        'public.revoke_auth_session_with_evidence(text,text,text)',
        'execute'
      ) as anon_revoke,
      has_function_privilege(
        'authenticated',
        'public.revoke_auth_session_with_evidence(text,text,text)',
        'execute'
      ) as authenticated_revoke,
      has_function_privilege(
        'service_role',
        'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
        'execute'
      ) as service_create,
      has_function_privilege(
        'service_role',
        'public.revoke_auth_session_with_evidence(text,text,text)',
        'execute'
      ) as service_revoke
  `);
  const privileges = result.rows[0];
  assert.deepEqual(privileges, {
    anon_create: false,
    authenticated_create: false,
    anon_revoke: false,
    authenticated_revoke: false,
    service_create: true,
    service_revoke: true,
  });
  return privileges;
}

async function assertGrantExpiryClipping(database) {
  const fixtureAuthUserId = "10000000-0000-4000-8000-000000000099";
  const fixtureAppUserId = "40000000-0000-4000-8000-000000000099";
  const fixtureRoleGrantId = "50000000-0000-4000-8000-000000000099";
  const fixtureTokenHash = "8".repeat(64);
  const grantEndsAt = new Date(Date.now() + 5 * 60 * 1000);

  await database.exec("begin");
  try {
    await database.query("insert into auth.users (id) values ($1::uuid)", [
      fixtureAuthUserId,
    ]);
    await database.query(
      `
        insert into public.app_users (
          id, auth_user_id, full_name, email, status, activated_at
        ) values ($1::uuid, $2::uuid, $3::text, $4::text, 'active', now())
      `,
      [
        fixtureAppUserId,
        fixtureAuthUserId,
        "Portable Expiry Teacher",
        "expiry.teacher@nilelearn.local",
      ]
    );
    await database.query(
      `
        insert into public.role_grants (
          id,
          user_id,
          role,
          status,
          starts_at,
          ends_at,
          granted_by,
          granted_reason
        ) values (
          $1::uuid,
          $2::uuid,
          'teacher',
          'active',
          now() - interval '1 minute',
          $3::timestamptz,
          '40000000-0000-4000-8000-000000000006'::uuid,
          'Portable grant-expiry check'
        )
      `,
      [fixtureRoleGrantId, fixtureAppUserId, grantEndsAt.toISOString()]
    );
    await database.query(
      `
        insert into public.role_grant_branch_scopes (
          role_grant_id, branch_id, granted_by
        ) values (
          $1::uuid,
          $2::uuid,
          '40000000-0000-4000-8000-000000000006'::uuid
        )
      `,
      [fixtureRoleGrantId, branchId]
    );
    await database.query(
      `
        insert into public.role_grant_department_scopes (
          role_grant_id, department_id, granted_by
        ) values (
          $1::uuid,
          $2::uuid,
          '40000000-0000-4000-8000-000000000006'::uuid
        )
      `,
      [fixtureRoleGrantId, departmentId]
    );
    const created = await createSession(database, {
      tokenHash: fixtureTokenHash,
      userId: fixtureAppUserId,
      authUserId: fixtureAuthUserId,
      roleGrantId: fixtureRoleGrantId,
      ttlSeconds: 3600,
      idempotencyKey: `session.create:${fixtureTokenHash}`,
      requestHash: "9".repeat(64),
    });
    assert.equal(created.rows.length, 1);
    const expiresAt = new Date(created.rows[0].session_expires_at).getTime();
    assert.ok(
      expiresAt <= grantEndsAt.getTime(),
      "Session expiry must not exceed the role-grant expiry"
    );
    assert.ok(
      grantEndsAt.getTime() - expiresAt < 1000,
      "Session expiry should be clipped to the role-grant expiry"
    );
  } finally {
    await database.exec("rollback");
  }
}

async function assertAuditFailureRollback(database) {
  const failureTokenHash = "6".repeat(64);
  const failureIdempotencyKey = `session.create:${failureTokenHash}`;
  const before = await database.query(
    "select count(*)::integer as count from public.audit_logs"
  );

  await database.exec(`
    create function nile_private.reject_portable_session_audit()
    returns trigger
    language plpgsql
    as $$
    begin
      if new.action = 'session.created' then
        raise exception 'Injected portable session audit failure'
          using errcode = 'P0001';
      end if;
      return new;
    end;
    $$;
    create trigger reject_portable_session_audit
    before insert on public.audit_logs
    for each row execute function nile_private.reject_portable_session_audit();
  `);

  try {
    await expectSqlState("create-audit-failure", "P0001", () =>
      createSession(database, {
        tokenHash: failureTokenHash,
        idempotencyKey: failureIdempotencyKey,
        requestHash: "6".repeat(64),
      })
    );
  } finally {
    await database.exec(`
      drop trigger reject_portable_session_audit on public.audit_logs;
      drop function nile_private.reject_portable_session_audit();
    `);
  }

  const residue = await database.query(
    `
      select
        (select count(*)::integer
          from public.auth_sessions
          where token_hash = decode($1::text, 'hex')) as sessions,
        (select count(*)::integer
          from public.command_executions
          where idempotency_key = $2::text) as commands,
        (select count(*)::integer from public.audit_logs) as audit_count
    `,
    [failureTokenHash, failureIdempotencyKey]
  );
  assert.deepEqual(residue.rows[0], {
    sessions: 0,
    commands: 0,
    audit_count: before.rows[0].count,
  });
}

async function assertMalformedCreateReplayDenied(
  database,
  { label, tokenCharacter, targetType, targetId, afterStatus, sqlState }
) {
  const malformedTokenHash = tokenCharacter.repeat(64);
  const malformedRequestHash = tokenCharacter.repeat(64);
  const malformedIdempotencyKey = `session.create:malformed:${label}`;

  await database.exec("begin");
  try {
    const sessionResult = await database.query(
      `
        insert into public.auth_sessions (
          token_hash,
          user_id,
          active_role_grant_id,
          provider,
          created_at,
          expires_at
        ) values (
          decode($1::text, 'hex'),
          $2::uuid,
          $3::uuid,
          'supabase',
          now(),
          now() + interval '1 hour'
        )
        returning id
      `,
      [malformedTokenHash, appUserId, roleGrantId]
    );
    const sessionId = sessionResult.rows[0].id;
    const commandResult = await database.query(
      `
        insert into public.command_executions (
          idempotency_key,
          actor_user_id,
          actor_role_grant_id,
          session_id,
          command_type,
          target_type,
          target_id,
          request_hash,
          status,
          completed_at
        ) values (
          $1::text,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          'session.create',
          $5::text,
          $6::text,
          decode($7::text, 'hex'),
          'succeeded',
          now()
        )
        returning id
      `,
      [
        malformedIdempotencyKey,
        appUserId,
        roleGrantId,
        sessionId,
        targetType,
        targetId === "session" ? sessionId : null,
        malformedRequestHash,
      ]
    );
    await database.query(
      `
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
        select
          $1::uuid,
          $2::uuid,
          $3::uuid,
          session.id,
          'session.created',
          'auth_session',
          session.id::text,
          jsonb_build_object(
            'status', $5::text,
            'provider', session.provider,
            'created_at', session.created_at,
            'expires_at', session.expires_at
          ),
          jsonb_build_object(
            'session_model', 'normalized',
            'auth_user_id', $6::uuid,
            'requested_ttl_seconds', 3600
          )
        from public.auth_sessions as session
        where session.id = $4::uuid
      `,
      [
        commandResult.rows[0].id,
        appUserId,
        roleGrantId,
        sessionId,
        afterStatus,
        authUserId,
      ]
    );

    await expectSqlState(label, sqlState, () =>
      createSession(database, {
        tokenHash: malformedTokenHash,
        idempotencyKey: malformedIdempotencyKey,
        requestHash: malformedRequestHash,
      })
    );
  } finally {
    await database.exec("rollback");
  }
}

async function assertMalformedRevokeReplayDenied(database) {
  const malformedTokenHash = "5".repeat(64);
  const malformedRequestHash = "5".repeat(64);
  const malformedIdempotencyKey = "session.revoke:malformed:audit-state";

  await database.exec("begin");
  try {
    const sessionResult = await database.query(
      `
        insert into public.auth_sessions (
          token_hash,
          user_id,
          active_role_grant_id,
          provider,
          created_at,
          expires_at,
          revoked_at,
          revoked_by
        ) values (
          decode($1::text, 'hex'),
          $2::uuid,
          $3::uuid,
          'supabase',
          now() - interval '1 minute',
          now() + interval '1 hour',
          now(),
          $2::uuid
        )
        returning id
      `,
      [malformedTokenHash, appUserId, roleGrantId]
    );
    const sessionId = sessionResult.rows[0].id;
    const commandResult = await database.query(
      `
        insert into public.command_executions (
          idempotency_key,
          actor_user_id,
          actor_role_grant_id,
          session_id,
          command_type,
          target_type,
          target_id,
          request_hash,
          status,
          completed_at
        ) values (
          $1::text,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          'session.revoke',
          'auth_session',
          $4::text,
          decode($5::text, 'hex'),
          'succeeded',
          now()
        )
        returning id
      `,
      [
        malformedIdempotencyKey,
        appUserId,
        roleGrantId,
        sessionId,
        malformedRequestHash,
      ]
    );
    await database.query(
      `
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
        select
          $1::uuid,
          $2::uuid,
          $3::uuid,
          session.id,
          'session.revoked',
          'auth_session',
          session.id::text,
          jsonb_build_object(
            'status', 'active',
            'expires_at', session.expires_at
          ),
          jsonb_build_object(
            'status', 'active',
            'revoked_at', session.revoked_at,
            'revoked_by', session.revoked_by
          ),
          jsonb_build_object('session_model', 'normalized')
        from public.auth_sessions as session
        where session.id = $4::uuid
      `,
      [commandResult.rows[0].id, appUserId, roleGrantId, sessionId]
    );

    await expectSqlState("revoke-malformed-audit-state", "55000", () =>
      revokeSession(database, {
        tokenHash: malformedTokenHash,
        idempotencyKey: malformedIdempotencyKey,
        requestHash: malformedRequestHash,
      })
    );
  } finally {
    await database.exec("rollback");
  }
}

async function assertMalformedReplayEvidenceDenied(database) {
  await assertMalformedCreateReplayDenied(database, {
    label: "create-null-target-evidence",
    tokenCharacter: "3",
    targetType: null,
    targetId: null,
    afterStatus: "active",
    sqlState: "23505",
  });
  await assertMalformedCreateReplayDenied(database, {
    label: "create-malformed-audit-state",
    tokenCharacter: "4",
    targetType: "auth_session",
    targetId: "session",
    afterStatus: "revoked",
    sqlState: "55000",
  });
  await assertMalformedRevokeReplayDenied(database);
}

async function assertLifecycle(database) {
  const created = await createSession(database);
  assert.equal(created.rows.length, 1);
  assert.equal(created.rows[0].replayed, false);
  const sessionId = created.rows[0].session_id;
  const createCommandId = created.rows[0].command_id;
  assert.ok(sessionId && createCommandId);
  assert.ok(
    new Date(created.rows[0].session_expires_at).getTime() >
      new Date(created.rows[0].session_created_at).getTime()
  );

  const stored = await database.query(
    `
      select
        id,
        encode(token_hash, 'hex') as token_hash,
        revoked_at,
        revoked_by
      from public.auth_sessions
      where id = $1::uuid
    `,
    [sessionId]
  );
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].token_hash, tokenHash);
  assert.equal(stored.rows[0].revoked_at, null);
  assert.equal(stored.rows[0].revoked_by, null);

  const createEvidence = await database.query(
    `
      select
        command.status,
        audit.action,
        audit.entity_id,
        audit.after_state ->> 'status' as after_status,
        audit.metadata ->> 'auth_user_id' as evidence_auth_user_id,
        audit.metadata ->> 'requested_ttl_seconds' as evidence_ttl_seconds
      from public.command_executions as command
      join public.audit_logs as audit on audit.command_id = command.id
      where command.id = $1::uuid
    `,
    [createCommandId]
  );
  assert.deepEqual(createEvidence.rows, [
    {
      status: "succeeded",
      action: "session.created",
      entity_id: sessionId,
      after_status: "active",
      evidence_auth_user_id: authUserId,
      evidence_ttl_seconds: "3600",
    },
  ]);

  const authority = await assertLiveAuthorityResolution(database);

  const replay = await createSession(database);
  assert.equal(replay.rows.length, 1);
  assert.equal(replay.rows[0].replayed, true);
  assert.equal(replay.rows[0].session_id, sessionId);
  assert.equal(replay.rows[0].command_id, createCommandId);

  await expectSqlState("create-conflict", "23505", () =>
    createSession(database, { requestHash: "d".repeat(64) })
  );
  await expectSqlState("create-token-parameter-conflict", "23505", () =>
    createSession(database, { tokenHash: "d".repeat(64) })
  );
  await expectSqlState("create-auth-user-parameter-conflict", "23505", () =>
    createSession(database, {
      authUserId: "10000000-0000-4000-8000-000000000003",
    })
  );
  await expectSqlState("create-ttl-parameter-conflict", "23505", () =>
    createSession(database, { ttlSeconds: 7200 })
  );
  await expectSqlState("create-invalid-token", "22023", () =>
    createSession(database, {
      tokenHash: "not-a-hash",
      idempotencyKey: "session.create:invalid-token",
    })
  );
  await expectSqlState("create-invalid-request-hash", "22023", () =>
    createSession(database, { requestHash: "not-a-hash" })
  );
  await expectSqlState("create-blank-idempotency-key", "22023", () =>
    createSession(database, { idempotencyKey: " " })
  );
  await expectSqlState("create-long-idempotency-key", "22023", () =>
    createSession(database, { idempotencyKey: "x".repeat(201) })
  );
  await expectSqlState("create-ttl-too-short", "22023", () =>
    createSession(database, { ttlSeconds: 59 })
  );
  await expectSqlState("create-ttl-too-long", "22023", () =>
    createSession(database, { ttlSeconds: 43201 })
  );

  await assertMalformedReplayEvidenceDenied(database);
  await assertGrantExpiryClipping(database);
  await assertAuditFailureRollback(database);

  const deniedTokenHash = "e".repeat(64);
  const deniedIdempotencyKey = `session.create:${deniedTokenHash}`;
  await expectSqlState("create-denied-authority", "42501", () =>
    createSession(database, {
      tokenHash: deniedTokenHash,
      userId: "40000000-0000-4000-8000-000000000099",
      idempotencyKey: deniedIdempotencyKey,
      requestHash: "f".repeat(64),
    })
  );
  const deniedRows = await database.query(
    `
      select
        (select count(*)::integer from public.auth_sessions
          where token_hash = decode($1::text, 'hex')) as sessions,
        (select count(*)::integer from public.command_executions
          where idempotency_key = $2::text) as commands
    `,
    [deniedTokenHash, deniedIdempotencyKey]
  );
  assert.deepEqual(deniedRows.rows[0], { sessions: 0, commands: 0 });

  const revoked = await revokeSession(database);
  assert.equal(revoked.rows.length, 1);
  assert.equal(revoked.rows[0].replayed, false);
  assert.equal(revoked.rows[0].session_id, sessionId);
  const revokeCommandId = revoked.rows[0].command_id;

  const revokeEvidence = await database.query(
    `
      select
        session.revoked_at,
        session.revoked_by,
        command.status,
        audit.action,
        audit.after_state ->> 'status' as after_status,
        audit.after_state ->> 'revoked_by' as audit_revoked_by
      from public.auth_sessions as session
      join public.command_executions as command
        on command.id = $2::uuid
       and command.session_id = session.id
      join public.audit_logs as audit on audit.command_id = command.id
      where session.id = $1::uuid
    `,
    [sessionId, revokeCommandId]
  );
  assert.equal(revokeEvidence.rows.length, 1);
  assert.ok(revokeEvidence.rows[0].revoked_at);
  assert.equal(revokeEvidence.rows[0].revoked_by, appUserId);
  assert.equal(revokeEvidence.rows[0].status, "succeeded");
  assert.equal(revokeEvidence.rows[0].action, "session.revoked");
  assert.equal(revokeEvidence.rows[0].after_status, "revoked");
  assert.equal(revokeEvidence.rows[0].audit_revoked_by, appUserId);

  const revokeReplay = await revokeSession(database);
  assert.equal(revokeReplay.rows.length, 1);
  assert.equal(revokeReplay.rows[0].replayed, true);
  assert.equal(revokeReplay.rows[0].session_id, sessionId);
  assert.equal(revokeReplay.rows[0].command_id, revokeCommandId);

  await expectSqlState("revoke-conflict", "23505", () =>
    revokeSession(database, { requestHash: "0".repeat(64) })
  );
  await expectSqlState("revoke-token-parameter-conflict", "23505", () =>
    revokeSession(database, { tokenHash: "0".repeat(64) })
  );
  const revokedAuthority = await resolveSessionAuthority(database);
  assert.equal(revokedAuthority.rows.length, 0);
  const unknownRevoke = await revokeSession(database, {
    tokenHash: "1".repeat(64),
    idempotencyKey: `session.revoke:${"1".repeat(64)}`,
    requestHash: "2".repeat(64),
  });
  assert.equal(unknownRevoke.rows.length, 0);

  return { sessionId, createCommandId, revokeCommandId, authority };
}

async function assertLifecycleEvidencePresent(database, lifecycle) {
  const result = await database.query(
    `
      select
        (select count(*)::integer
          from public.auth_sessions
          where id = $1::uuid) as sessions,
        (select count(*)::integer
          from public.command_executions
          where id in ($2::uuid, $3::uuid)) as commands,
        (select count(*)::integer
          from public.audit_logs
          where command_id in ($2::uuid, $3::uuid)) as audits
    `,
    [lifecycle.sessionId, lifecycle.createCommandId, lifecycle.revokeCommandId]
  );
  assert.deepEqual(result.rows[0], { sessions: 1, commands: 2, audits: 2 });
}

async function assertPhase2Rollback(database, lifecycle) {
  await runSql(database, "phase2-rollback", phase2Rollback);
  const result = await database.query(`
    select
      to_regprocedure(
        'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)'
      ) is null as create_removed,
      to_regprocedure(
        'public.revoke_auth_session_with_evidence(text,text,text)'
      ) is null as revoke_removed,
      to_regclass('public.audit_logs_session_lifecycle_uidx') is null as index_removed
  `);
  assert.deepEqual(result.rows[0], {
    create_removed: true,
    revoke_removed: true,
    index_removed: true,
  });
  await assertLifecycleEvidencePresent(database, lifecycle);
}

async function assertPostReapplyLifecycle(database) {
  const postReapplyTokenHash = "9".repeat(64);
  const createInput = {
    tokenHash: postReapplyTokenHash,
    idempotencyKey: `session.create:${postReapplyTokenHash}`,
    requestHash: "1".repeat(64),
  };
  const revokeInput = {
    tokenHash: postReapplyTokenHash,
    idempotencyKey: `session.revoke:${postReapplyTokenHash}`,
    requestHash: "2".repeat(64),
  };

  const created = await createSession(database, createInput);
  assert.equal(created.rows.length, 1);
  assert.equal(created.rows[0].replayed, false);
  const createReplay = await createSession(database, createInput);
  assert.equal(createReplay.rows[0].replayed, true);
  assert.equal(createReplay.rows[0].session_id, created.rows[0].session_id);

  const revoked = await revokeSession(database, revokeInput);
  assert.equal(revoked.rows.length, 1);
  assert.equal(revoked.rows[0].replayed, false);
  const revokeReplay = await revokeSession(database, revokeInput);
  assert.equal(revokeReplay.rows[0].replayed, true);
  assert.equal(revokeReplay.rows[0].session_id, created.rows[0].session_id);

  return {
    sessionId: created.rows[0].session_id,
    createCommandId: created.rows[0].command_id,
    revokeCommandId: revoked.rows[0].command_id,
  };
}

async function assertPreRollbackEvidenceReplays(database, lifecycle) {
  const createReplay = await createSession(database);
  assert.equal(createReplay.rows.length, 1);
  assert.equal(createReplay.rows[0].replayed, true);
  assert.equal(createReplay.rows[0].session_id, lifecycle.sessionId);
  assert.equal(createReplay.rows[0].command_id, lifecycle.createCommandId);

  const revokeReplay = await revokeSession(database);
  assert.equal(revokeReplay.rows.length, 1);
  assert.equal(revokeReplay.rows[0].replayed, true);
  assert.equal(revokeReplay.rows[0].session_id, lifecycle.sessionId);
  assert.equal(revokeReplay.rows[0].command_id, lifecycle.revokeCommandId);
}

const database = new PGlite({
  extensions: { btree_gist, citext, pgcrypto },
});

try {
  await database.waitReady;
  const versionResult = await database.query("select version() as version");
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
  `);

  await runSql(database, "phase1-forward", phase1Migration);
  await runSql(database, "phase2-forward-1", phase2Migration);
  await runSql(database, "fake-seed", fakeSeed);
  const privileges = await assertFunctionPrivileges(database);
  const roleExecutionDenials = await assertRoleExecutionDenials(database);
  const lifecycle = await assertLifecycle(database);
  await assertPhase2Rollback(database, lifecycle);
  await runSql(database, "phase2-forward-2", phase2Migration);
  await assertFunctionPrivileges(database);
  await assertPreRollbackEvidenceReplays(database, lifecycle);
  const postReapplyLifecycle = await assertPostReapplyLifecycle(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: versionResult.rows[0]?.version ?? "PGlite PostgreSQL",
      executionSurface: "pglite-direct-sql",
      phase2ForwardApplications: 2,
      phase2RollbackPasses: 1,
      privilegeCatalogDenials: Object.values(privileges).filter(
        value => value === false
      ).length,
      roleExecutionDenials,
      lifecycle,
      postReapplyLifecycle,
      checks: [
        "create",
        "hashed-token",
        "command-audit-coexistence",
        "idempotent-create-replay",
        "exact-create-parameter-conflict",
        "malformed-create-evidence-denial",
        "create-validation-boundaries",
        "authority-denial-no-write",
        "live-authority-resolution",
        "grant-expiry-clipping",
        "audit-failure-transaction-rollback",
        "revoke",
        "revoked-by",
        "idempotent-revoke-replay",
        "exact-revoke-parameter-conflict",
        "malformed-revoke-evidence-denial",
        "unknown-revoke",
        "browser-role-execute-privilege-denial",
        "browser-role-execute-runtime-denial",
        "rollback-object-removal",
        "rollback-evidence-preservation",
        "pre-rollback-evidence-replay-after-reapply",
        "post-reapply-lifecycle",
      ],
      remoteAccepted: false,
      postgrestAccepted: false,
    })
  );
} finally {
  await database.close();
}
