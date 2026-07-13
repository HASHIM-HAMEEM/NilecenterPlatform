# Nile Learn Durable Session Hardening Plan

## Purpose

This document governs the staged implementation of durable production sessions
in Nile Learn. Phase 2A adds the repository boundary and a non-default Supabase
adapter while preserving the memory adapter, cookie contract, authentication
UX, RBAC, and portal routes as the runtime default.

It is a detailed companion to `docs/NILE_LEARN_MASTER_PLAN.md`. The master plan
owns sequencing and terminology when this document conflicts with it.

The existing implementation remains an internal-alpha session model with clean portal QA coverage. Durable production sessions should be implemented only after the normalized identity/profile/scope persistence plan is reviewed and the migration path remains reversible.

## Current State

Current server session code:

- `server/auth.ts` owns sign-in, cookie writing, session lookup, logout, demo reset, and demo password change behavior.
- `server/sessionRepository.ts` owns the asynchronous session repository,
  memory adapter, non-default Supabase adapter, and fail-closed selector.
- `server/sessionStore.ts` is a compatibility re-export only.
- The default session store is in-memory.
- `POST /api/auth/login` can use Supabase password auth when configured, then falls back to demo auth when allowed.
- `attachSession` writes the `nilelearn_session` HttpOnly cookie.
- `getRequestSession` reads the cookie and awaits the selected repository.
  Memory rows are deleted on expiry; durable rows are rejected when expired,
  revoked, unmapped, inactive, or bound to an ineffective grant.
- `endRequestSession` deletes memory sessions or revokes durable sessions, then
  clears the cookie.
- `NILE_SESSION_REPOSITORY=memory` remains the default.
- `NILE_SESSION_REPOSITORY=supabase` is non-default and requires server-only
  Supabase configuration. It is not approved for linked/shared runtime use.
- Client auth in `client/src/lib/auth/session.ts` stores a browser-local copy of the safe session DTO for UX and route refresh, but it is not the authorization boundary.

Current tests:

- `client/src/lib/auth/server-auth.test.ts` covers demo auth, password reset/change boundaries, session-store injection, cookies, logout, and expiry behavior.
- `client/src/lib/auth/server-session-repository.test.ts` covers adapter
  selection, fail-closed configuration, identity/grant mapping, scope refresh,
  token hashing, expiry, ambiguity, and revocation.
- `client/src/lib/auth/server-state-scoping.test.ts` covers scoped read models by role.
- `client/src/lib/auth/server-platform-state.test.ts` covers server action role/scope gates.

## Current Limitations

- Default memory sessions are lost on process restart, are not shared across
  instances, and revoke only in one process.
- The non-default durable adapter passes the corrected Phase 2B lifecycle
  through isolated native PostgreSQL 17 and PostgREST 14.14. This is local-only
  database acceptance; linked/shared promotion and runtime-default use remain
  prohibited.
- The schema includes `last_seen_at`, `revoked_at`, `revoked_by`, `ip_hash`, and
  `user_agent_hash`. The adapter currently writes `revoked_at` and `revoked_by`;
  it does not yet populate `last_seen_at`, IP hash, or user-agent hash.
- Supabase Auth can authenticate, but normalized identity and session authority
  remain non-default until the promotion gates pass.
- In memory mode, roles remain alpha session values. In Supabase mode, every
  lookup revalidates the mapped app user, one active role grant, and current
  branch/department scope rows.
- `authorizationModel` separates the login provider from the authority model.
  Memory-backed Supabase Auth remains snapshot-compatible, while normalized
  durable sessions are blocked from legacy snapshot workflows.
- Normalized durable sessions intentionally receive `503` for legacy snapshot
  workflow reads and writes until normalized workflow repositories exist.
- Client `localStorage` can preserve a stale display copy until `/api/auth/session` refreshes it.
- If durable revocation is unavailable, logout returns `503` and clears the
  browser cookie to remove the local credential, but a copied token may remain
  valid until expiry. Production activation requires an explicit residual-risk
  decision, bounded TTL, and an administrative revocation/recovery path.

## Target Durable Session Model

Production sessions must be server-authoritative, durable, revocable, and scope-aware.

Target table: `auth_sessions`

Recommended fields:

- `id`: server session UUID or opaque public session ID.
- `token_hash`: SHA-256 hash of the opaque cookie token.
- `user_id`: internal `app_users.id`.
- `provider`: `supabase` or controlled `demo`.
- `active_role_grant_id`: active, effective role grant selected for this
  session.
- `created_at`: session creation time.
- `expires_at`: hard expiry time.
- `last_seen_at`: last accepted session read.
- `revoked_at`: revocation time.
- `revoked_by`: admin/user that revoked the session.
- `ip_hash`: optional non-reversible client IP hash.
- `user_agent_hash`: optional non-reversible user-agent hash.
- `metadata`: server-owned diagnostics JSON.

Required indexes:

- `auth_sessions_user_id_idx`
- `auth_sessions_expires_at_idx`
- `auth_sessions_revoked_at_idx`

Do not store plaintext secrets, service keys, provider tokens, or raw passwords in session rows.

## Cookie Contract

Keep the current cookie behavior stable during rollout:

- Name: `nilelearn_session`
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- `Path=/`
- `Max-Age` no longer than server-side session expiry

Future hardening after stable rollout:

- consider `__Host-` cookie prefix only after deployment/domain constraints are confirmed
- rotate session after sensitive actions
- add idle timeout separate from hard expiry
- add explicit user/admin session revocation UI only after durable storage exists

## Supabase Auth Mapping

Supabase Auth should identify the login user, but Nile Learn authorization must come from server-owned app tables.

Target sign-in flow:

1. Authenticate with Supabase Auth or controlled demo auth.
2. Resolve `auth.users.id` to `app_users.auth_user_id`.
3. Load active grants from `role_grants`.
4. Load branch and department scope from role-grant and student profile tables.
5. Confirm the requested grant is active, effective, and allowed.
6. Create a durable `auth_sessions` row.
7. Return the same safe session DTO shape used today.

Rules:

- Do not use `raw_user_meta_data` as authority.
- Supabase `app_metadata` may be used as a sign-in hint only.
- Server-owned `app_users`, `role_grants`, role-grant scope tables, and student
  profile tables are the final authority.
- Demo auth remains local/internal only until explicitly retired.

## Role Switching Rules

Current client-side role switching updates the local safe session DTO only when the user already has the role. Production role switching should become server-confirmed.

Target behavior:

- Role switch calls a server endpoint or server action.
- Server checks the current session, active user, and current `role_grants`.
- Server revokes the current durable session and creates a new session bound to
  the selected effective grant. Session authority columns are never rewritten.
- Server returns a safe session DTO.
- If the role was removed or paused, the switch fails and the client clears stale local state.

Sensitive actions must always use the active role and scopes resolved server-side, not browser-local role state.

## LocalStorage Limitations

Allowed:

- cache the safe session DTO for UX while `/api/auth/session` refreshes
- remember UI preferences such as locale/sidebar state
- clear stale session state after server refresh returns null

Not allowed:

- authorize routes or server actions
- determine active role for server permissions
- determine branch or department scope
- store service keys, provider tokens, or secrets
- override server session expiry
- persist production refresh tokens

## Durable Session Adapter Plan

### Adapter Stage A: Current Memory Store

Status: current runtime.

- Keep `server/sessionRepository.ts` with `server/sessionStore.ts` as a
  compatibility re-export.
- Keep memory store as default.
- Preserve current login/logout/password behavior.
- Keep portal QA clean.

### Adapter Stage B: Non-Default Durable Store Skeleton

Status: implemented in Phase 2A with no runtime default change.

- The local-only `auth_sessions` migration now exists and passes disposable
  Supabase reset, assertion, rollback, reapply, seed, and lint gates. It is not
  applied to a linked or shared project.
- The durable implementation is selected only with
  `NILE_SESSION_REPOSITORY=supabase`.
- Repository code uses the server-only Supabase REST boundary; auth handlers do
  not contain table operations.
- Contract tests use fake server responses, and the corrected Phase 2B SQL now
  passes the real repository adapter through isolated native PostgREST.
- Keep memory store as the explicit local/demo adapter. Failing closed instead
  of selecting memory when production durable storage is unavailable is a
  required activation gate, not current default behavior.

### Adapter Stage C: Durable Writes

Status: implemented and accepted against the isolated local database/Data API
boundary. Linked/shared promotion remains prohibited. No UX change.

- On sign-in, write a durable session row.
- Store only a safe cookie/session identifier.
- Keep response DTO unchanged.
- Keep logout revoking through the configured store. Durable session evidence is
  not deleted.

### Adapter Stage D: Durable Reads And Revocation

Status: implemented and accepted against the isolated local database/Data API
boundary; activation remains prohibited.

- `getRequestSession` loads from the configured durable store.
- Every lookup revalidates the mapped user and referenced role grant. Missing,
  expired, revoked, paused, or no-longer-effective authority returns null even
  when the session row itself has not changed.
- A bounded `last_seen_at` update policy remains a target; it is not implemented
  in the current adapter.
- Logout revokes the durable session; it never deletes durable evidence.

### Adapter Stage E: Server-Side Role/Scope Refresh

Status: app-user, active-grant, branch-scope, and department-scope refresh is
implemented and locally verified inside the non-default adapter. Workflow
authorization will consume these normalized scopes only after normalized
workflow data is runtime-ready; snapshot workflow use remains blocked.

- resolve `active_role_grant_id` against active `role_grants`
- resolve branch and department scopes from server-owned tables
- deny sensitive actions if role/scope changed since sign-in
- require role re-selection when active role is no longer valid

### Adapter Stage F: Session Management UI

Only after durable sessions are proven:

- optional user page for active sessions
- optional super admin revocation view
- audit admin revocations
- keep this out of normal dashboards unless it is a clear user job

## RLS And Access Plan

`auth_sessions` is a server-only base table in Phase 1:

- enable and force RLS;
- revoke browser `anon` and `authenticated` privileges;
- expose only scoped, redacted session DTOs through server endpoints;
- create, rotate, revoke, and inspect sessions through server application
  services;
- never expose `token_hash`, IP hash, user-agent hash, or internal metadata.

## Tests Needed Before Activation

Unit tests:

- sign-in writes through the configured session store
- request lookup reads through the configured session store
- logout revokes through the configured store
- expired durable sessions are rejected
- revoked durable sessions are rejected
- missing durable session rows clear the client session on refresh
- role removed after sign-in blocks sensitive actions
- branch/department scope changes block sensitive actions
- provider-managed sessions cannot use demo password change behavior

API tests:

- `/api/auth/session` returns only safe fields
- `/api/auth/logout` clears the cookie and revokes the configured session
- protected APIs reject missing, expired, and revoked sessions
- workflow actions ignore spoofed body fields and use session actor/scope

Browser/portal QA:

- login/logout for all six roles
- direct protected-route access after login
- direct protected-route access without login
- stale localStorage session after server logout
- role switch with valid role
- role switch after role removal once role refresh exists

Use the Codex in-app Browser for manual QA. If it is unavailable, stop browser
work and report the blocker. Built-in repository QA may continue using its own
automation.

## Rollback Plan

- Keep memory store as default until durable session tests and portal QA are green.
- Gate durable session reads/writes behind an explicit server env flag.
- Preserve cookie name and response DTO during rollout.
- If durable storage fails, roll back the production release or disable affected
  traffic. Never continue production authorization with the memory store.
- Do not remove demo auth until production auth, durable sessions, role refresh, and QA are proven.
- Do not remove local safe-session cache until route refresh behavior has a replacement.

## Acceptance Gates

Before any durable session runtime change is accepted:

- `npm run check`
- `npm run check:phase2-session-schema`
- `npm run check:phase2-session-schema:runtime`
- `npm test -- --run`
- `npm run build`
- focused auth/session tests
- focused RBAC/scope tests
- full portal QA with 0 failures
- manual browser QA for login/logout and protected-route behavior

The real local Data API gate is required for slices that touch the durable
adapter or its database contract. Use
`npm run check:phase2-session:supabase` only with the recognized disposable
local Supabase stack. When Docker operation is not approved, use
`npm run check:phase2-session:postgrest` only with an already-running isolated
local PostgREST endpoint. The latter requires an explicit local-only
acknowledgement, rejects non-local URLs, and requires the exact fresh fake
fixture marker; its SQL and fake-data prerequisites remain in
`supabase/manual/README.md`. Either command is local acceptance evidence only
and does not approve a runtime-default change.

The accepted portal baseline is defined by the current master-plan checkpoint.

## Current Slice Authority

The authoritative current status, remaining work, and only approved next slice
live in `docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization
Checkpoint**. This detailed session contract does not duplicate or
independently approve that sequence.
