import crypto from "node:crypto";
import assert from "node:assert/strict";

import type { ServerSession } from "../server/auth.js";
import { createSupabaseSessionRepository } from "../server/sessionRepository.js";
import { supabaseAdminRestFetch } from "../server/supabase.js";

const localUrl = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.NILE_LOCAL_SUPABASE_ANON_KEY ?? "";
const jwtSecret = process.env.NILE_LOCAL_SUPABASE_JWT_SECRET ?? "";
const localHost = new URL(localUrl).hostname;
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
assert.equal(
  process.env.NILE_PHASE2_SESSION_DISPOSABLE_LOCAL,
  "1",
  "Phase 2 session validation requires explicit disposable-local acknowledgement."
);
assert.ok(
  localHosts.has(localHost),
  "Phase 2 session validation is local-only."
);
assert.ok(process.env.SUPABASE_SECRET_KEY, "Local service key is required.");
assert.ok(anonKey && jwtSecret, "Local browser-role test keys are required.");

const authUserId = "10000000-0000-4000-8000-000000000002";
const appUserId = "40000000-0000-4000-8000-000000000002";
const roleGrantId = "50000000-0000-4000-8000-000000000002";
const branchId = "20000000-0000-4000-8000-000000000001";
const departmentId = "30000000-0000-4000-8000-000000000001";
const disposableFixtureId = "a0000000-0000-4000-8000-000000000001";

const repository = createSupabaseSessionRepository({ env: process.env });

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function authenticatedJwt() {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      aud: "authenticated",
      role: "authenticated",
      sub: authUserId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    })
  );
  const signature = crypto
    .createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function expectBrowserDenial(
  label: string,
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(`${localUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  assert.ok(
    response.status === 401 || response.status === 403,
    `${label} should be denied, received ${response.status}.`
  );
  const payload = (await response.json()) as {
    code?: unknown;
    message?: unknown;
  };
  assert.equal(
    payload.code,
    "42501",
    `${label} did not reach the expected PostgreSQL permission boundary: ${JSON.stringify(payload)}`
  );
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminRestFetch(path, init, process.env);
  assert.ok(
    response.ok,
    `Admin request failed: ${init.method ?? "GET"} ${path} (${response.status}).`
  );
  return response;
}

async function assertDisposableFixture() {
  const markerResponse = await adminRequest(
    `integration_connections?id=eq.${disposableFixtureId}&select=id,provider,label,environment,mode,status,capabilities`
  );
  assert.deepEqual(await markerResponse.json(), [
    {
      id: disposableFixtureId,
      provider: "nile_phase2_test_fixture",
      label: "phase2b-disposable-local-v1",
      environment: "local",
      mode: "disabled",
      status: "disabled",
      capabilities: ["session_acceptance"],
    },
  ]);

  const usersResponse = await adminRequest(
    "app_users?select=id,email&order=id.asc"
  );
  const users = (await usersResponse.json()) as Array<{
    id: string;
    email: string;
  }>;
  assert.deepEqual(
    users.map(user => user.id),
    [1, 2, 3, 4, 5, 6].map(
      suffix => `40000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`
    ),
    "Phase 2 session validation requires the exact fake-only user fixture."
  );
  assert.ok(
    users.every(user => user.email.endsWith("@nilelearn.local")),
    "Phase 2 session validation refuses non-fixture user data."
  );

  const sessionsResponse = await adminRequest(
    "auth_sessions?select=id&limit=1"
  );
  assert.deepEqual(
    await sessionsResponse.json(),
    [],
    "Phase 2 session validation requires a freshly reset disposable fixture."
  );
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function session(
  token: string,
  createdAt: Date,
  expiresAt: Date
): ServerSession {
  return {
    id: token,
    userId: appUserId,
    authUserId,
    email: "teacher@nilelearn.local",
    name: "Local Teacher",
    roles: ["teacher"],
    activeRole: "teacher",
    activeRoleGrantId: roleGrantId,
    branchIds: [branchId],
    departmentIds: [departmentId],
    provider: "supabase",
    authorizationModel: "normalized",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

const identity = await repository.resolveSupabaseIdentity?.(
  authUserId,
  "teacher"
);
assert.deepEqual(identity, {
  userId: appUserId,
  authUserId,
  email: "teacher@nilelearn.local",
  name: "Local Teacher",
  activeRole: "teacher",
  activeRoleGrantId: roleGrantId,
  branchIds: [branchId],
  departmentIds: [departmentId],
});

await assertDisposableFixture();

await expectBrowserDenial("anon base table", anonKey, "app_users?select=id");
await expectBrowserDenial(
  "authenticated base table",
  authenticatedJwt(),
  "app_users?select=id"
);
await expectBrowserDenial(
  "anon authority RPC",
  anonKey,
  "rpc/resolve_auth_session_authority",
  { method: "POST", body: JSON.stringify({ p_token_hash: "0".repeat(64) }) }
);
await expectBrowserDenial(
  "authenticated authority RPC",
  authenticatedJwt(),
  "rpc/resolve_auth_session_authority",
  { method: "POST", body: JSON.stringify({ p_token_hash: "0".repeat(64) }) }
);
for (const [roleLabel, token] of [
  ["anon", anonKey],
  ["authenticated", authenticatedJwt()],
] as const) {
  await expectBrowserDenial(
    `${roleLabel} session create RPC`,
    token,
    "rpc/create_auth_session_with_evidence",
    {
      method: "POST",
      body: JSON.stringify({
        p_token_hash: "0".repeat(64),
        p_user_id: appUserId,
        p_auth_user_id: authUserId,
        p_active_role_grant_id: roleGrantId,
        p_ttl_seconds: 43200,
        p_idempotency_key: "browser-denied",
        p_request_hash: "0".repeat(64),
      }),
    }
  );
  await expectBrowserDenial(
    `${roleLabel} session revoke RPC`,
    token,
    "rpc/revoke_auth_session_with_evidence",
    {
      method: "POST",
      body: JSON.stringify({
        p_token_hash: "0".repeat(64),
        p_idempotency_key: "browser-denied",
        p_request_hash: "0".repeat(64),
      }),
    }
  );
}

const now = new Date();
const activeToken = crypto.randomBytes(32).toString("base64url");
const activeSession = session(
  activeToken,
  new Date(now.getTime() - 60_000),
  new Date(now.getTime() + 60 * 60_000)
);
const persistedTiming = await repository.create(activeSession);
assert.ok(persistedTiming);
assert.ok(Date.parse(persistedTiming.createdAt) <= Date.now());
assert.ok(
  Date.parse(persistedTiming.expiresAt) -
    Date.parse(persistedTiming.createdAt) <=
    12 * 60 * 60_000
);

const replayedTiming = await repository.create(activeSession);
assert.deepEqual(replayedTiming, persistedTiming);

const hash = tokenHash(activeToken);
const storedResponse = await adminRequest(
  `auth_sessions?token_hash=eq.%5Cx${hash}&select=id,token_hash,created_at,expires_at,revoked_at,revoked_by`
);
const storedRows = (await storedResponse.json()) as Array<{
  id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}>;
assert.equal(storedRows.length, 1);
assert.equal(storedRows[0].token_hash.toLowerCase(), `\\x${hash}`);
assert.equal(storedRows[0].created_at, persistedTiming.createdAt);
assert.equal(storedRows[0].expires_at, persistedTiming.expiresAt);
assert.equal(storedRows[0].revoked_at, null);
assert.equal(storedRows[0].revoked_by, null);
assert.ok(!JSON.stringify(storedRows).includes(activeToken));

const sessionId = storedRows[0].id;
const createCommandsResponse = await adminRequest(
  `command_executions?session_id=eq.${sessionId}&command_type=eq.session.create&select=id,status,idempotency_key,request_hash`
);
const createCommands = (await createCommandsResponse.json()) as Array<{
  id: string;
  status: string;
  idempotency_key: string;
  request_hash: string;
}>;
assert.equal(createCommands.length, 1);
assert.equal(createCommands[0].status, "succeeded");
assert.equal(createCommands[0].idempotency_key, `session.create:${hash}`);
assert.match(createCommands[0].request_hash, /^\\x[0-9a-f]{64}$/i);
const persistedCreateRequestHash = createCommands[0].request_hash.replace(
  /^\\x/i,
  ""
);

const createAuditResponse = await adminRequest(
  `audit_logs?session_id=eq.${sessionId}&action=eq.session.created&select=command_id,action,entity_type,entity_id,after_state,metadata`
);
const createAudits = (await createAuditResponse.json()) as Array<{
  command_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  after_state: Record<string, unknown>;
  metadata: Record<string, unknown>;
}>;
assert.equal(createAudits.length, 1);
assert.equal(createAudits[0].command_id, createCommands[0].id);
assert.equal(createAudits[0].entity_id, sessionId);
assert.equal(createAudits[0].after_state.status, "active");
assert.equal(createAudits[0].metadata.session_model, "normalized");
assert.ok(!JSON.stringify(createAudits).includes(activeToken));

const conflictResponse = await supabaseAdminRestFetch(
  "rpc/create_auth_session_with_evidence",
  {
    method: "POST",
    body: JSON.stringify({
      p_token_hash: hash,
      p_user_id: appUserId,
      p_auth_user_id: authUserId,
      p_active_role_grant_id: roleGrantId,
      p_ttl_seconds: 43200,
      p_idempotency_key: `session.create:${hash}`,
      p_request_hash: "f".repeat(64),
    }),
  },
  process.env
);
assert.equal(conflictResponse.status, 409);

const parameterConflictResponse = await supabaseAdminRestFetch(
  "rpc/create_auth_session_with_evidence",
  {
    method: "POST",
    body: JSON.stringify({
      p_token_hash: hash,
      p_user_id: appUserId,
      p_auth_user_id: "10000000-0000-4000-8000-000000000003",
      p_active_role_grant_id: roleGrantId,
      p_ttl_seconds: 43200,
      p_idempotency_key: `session.create:${hash}`,
      p_request_hash: persistedCreateRequestHash,
    }),
  },
  process.env
);
assert.equal(parameterConflictResponse.status, 409);

const deniedToken = crypto.randomBytes(32).toString("base64url");
const deniedHash = tokenHash(deniedToken);
const deniedIdempotencyKey = `session.create:${deniedHash}`;
const deniedResponse = await supabaseAdminRestFetch(
  "rpc/create_auth_session_with_evidence",
  {
    method: "POST",
    body: JSON.stringify({
      p_token_hash: deniedHash,
      p_user_id: "40000000-0000-4000-8000-000000000099",
      p_auth_user_id: authUserId,
      p_active_role_grant_id: roleGrantId,
      p_ttl_seconds: 43200,
      p_idempotency_key: deniedIdempotencyKey,
      p_request_hash: "e".repeat(64),
    }),
  },
  process.env
);
assert.equal(deniedResponse.status, 403);
const deniedSessionsResponse = await adminRequest(
  `auth_sessions?token_hash=eq.%5Cx${deniedHash}&select=id`
);
assert.deepEqual(await deniedSessionsResponse.json(), []);
const deniedCommandsResponse = await adminRequest(
  `command_executions?idempotency_key=eq.${encodeURIComponent(deniedIdempotencyKey)}&select=id`
);
assert.deepEqual(await deniedCommandsResponse.json(), []);

await assert.doesNotReject(async () => {
  const resolved = await repository.get(activeToken);
  assert.equal(resolved?.authorizationModel, "normalized");
  assert.deepEqual(resolved?.branchIds, [branchId]);
  assert.deepEqual(resolved?.departmentIds, [departmentId]);
});

await adminRequest(`branches?id=eq.${branchId}`, {
  method: "PATCH",
  body: JSON.stringify({ status: "paused" }),
});
try {
  assert.equal(await repository.get(activeToken), null);
} finally {
  await adminRequest(`branches?id=eq.${branchId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "active" }),
  });
}
assert.ok(await repository.get(activeToken));

await adminRequest(
  `department_branches?department_id=eq.${departmentId}&branch_id=eq.${branchId}`,
  { method: "DELETE" }
);
try {
  assert.equal(await repository.get(activeToken), null);
} finally {
  await adminRequest("department_branches", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ department_id: departmentId, branch_id: branchId }),
  });
}
assert.ok(await repository.get(activeToken));

const expiredToken = crypto.randomBytes(32).toString("base64url");
const expiredHash = tokenHash(expiredToken);
await adminRequest("auth_sessions", {
  method: "POST",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({
    token_hash: `\\x${expiredHash}`,
    user_id: appUserId,
    active_role_grant_id: roleGrantId,
    provider: "supabase",
    created_at: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(),
    expires_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
  }),
});
assert.equal(await repository.get(expiredToken), null);
await repository.delete(expiredToken);

await repository.delete(activeToken);
await repository.delete(activeToken);
assert.equal(await repository.get(activeToken), null);
const revokedResponse = await adminRequest(
  `auth_sessions?token_hash=eq.%5Cx${hash}&select=revoked_at,revoked_by`
);
const revokedRows = (await revokedResponse.json()) as Array<{
  revoked_at: string | null;
  revoked_by: string | null;
}>;
assert.equal(revokedRows.length, 1);
assert.ok(revokedRows[0].revoked_at);
assert.equal(revokedRows[0].revoked_by, appUserId);

const lifecycleCommandsResponse = await adminRequest(
  `command_executions?session_id=eq.${sessionId}&select=command_type,status,idempotency_key,request_hash`
);
const lifecycleCommands = (await lifecycleCommandsResponse.json()) as Array<{
  command_type: string;
  status: string;
  idempotency_key: string;
  request_hash: string;
}>;
assert.deepEqual(lifecycleCommands.map(item => item.command_type).sort(), [
  "session.create",
  "session.revoke",
]);
assert.ok(lifecycleCommands.every(item => item.status === "succeeded"));
const revokeCommand = lifecycleCommands.find(
  item => item.command_type === "session.revoke"
);
assert.ok(revokeCommand);
const revokeParameterConflictResponse = await supabaseAdminRestFetch(
  "rpc/revoke_auth_session_with_evidence",
  {
    method: "POST",
    body: JSON.stringify({
      p_token_hash: "0".repeat(64),
      p_idempotency_key: revokeCommand.idempotency_key,
      p_request_hash: revokeCommand.request_hash.replace(/^\\x/i, ""),
    }),
  },
  process.env
);
assert.equal(revokeParameterConflictResponse.status, 409);

const lifecycleAuditsResponse = await adminRequest(
  `audit_logs?session_id=eq.${sessionId}&select=action,entity_id,after_state`
);
const lifecycleAudits = (await lifecycleAuditsResponse.json()) as Array<{
  action: string;
  entity_id: string;
  after_state: Record<string, unknown>;
}>;
assert.deepEqual(lifecycleAudits.map(item => item.action).sort(), [
  "session.created",
  "session.revoked",
]);
assert.ok(lifecycleAudits.every(item => item.entity_id === sessionId));

console.log(
  JSON.stringify({
    ok: true,
    adapter: repository.kind,
    authority: "atomic-rpc",
    browserRoleDenials: 8,
    durableSessionChecks: [
      "create",
      "database-timestamps",
      "hashed-token",
      "atomic-command-audit",
      "idempotent-replay",
      "idempotency-conflict",
      "authority-denial-no-write",
      "resolve",
      "expiry",
      "branch-status-refresh",
      "relationship-refresh",
      "revoke",
      "revoked-by",
    ],
  })
);
