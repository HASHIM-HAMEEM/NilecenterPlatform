# Nile Learn Auth And Session Hardening Plan

## Purpose

This document defines the durable session path for Nile Learn after the server session-store boundary was added. It is a planning document only. It does not authorize live Supabase table changes, migrations, or replacement of the current demo login behavior.

The platform is in internal alpha stabilization. The protected portal QA baseline is 921 checks and 0 failures.

## Current State

### Runtime Behavior

Current server auth is implemented in `server/auth.ts`.

Current behavior:

- `POST /api/auth/login` validates email, password, and requested role.
- Supabase password sign-in is attempted when server env is configured.
- Demo auth remains available for local/internal testing when enabled.
- A server session is created with:
  - `id`
  - `userId`
  - `email`
  - `name`
  - `roles`
  - `activeRole`
  - `provider`
  - `createdAt`
  - `expiresAt`
- The browser receives an HttpOnly `nilelearn_session` cookie.
- `getRequestSession` reads the cookie, resolves the server session, and rejects expired sessions.
- `endRequestSession` deletes the server session and clears the cookie.

### Current Boundary

`server/sessionStore.ts` now owns session storage behind:

- `SessionStore.create(session)`
- `SessionStore.get(sessionId)`
- `SessionStore.delete(sessionId)`
- `SessionStore.clear()`

The default adapter is still in-memory. This preserves current behavior while making the storage replaceable.

### Current Limitations

- Sessions are lost on server restart.
- Sessions are not shared across server instances.
- Session revocation is process-local.
- No persistent `last_seen_at`, `revoked_at`, `ip_hash`, or `user_agent_hash` exists.
- Supabase user identity can sign in, but session authority is not yet backed by normalized app profile and scope tables.
- Current role/scope checks remain server-side, but durable role/scope refresh is future work.

## Production Session Model

Production sessions should be server-authoritative and durable.

### Target Session Table

Proposed table: `app_sessions`

| Column            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `id`              | Session UUID or opaque session ID hash   |
| `user_id`         | Foreign key to `app_users.id`            |
| `auth_user_id`    | Optional Supabase `auth.users.id`        |
| `provider`        | `supabase` or `demo`                     |
| `active_role`     | Active role at sign-in                   |
| `roles_snapshot`  | Role list at sign-in for display only    |
| `created_at`      | Session creation timestamp               |
| `expires_at`      | Hard expiry timestamp                    |
| `last_seen_at`    | Last successful session read             |
| `revoked_at`      | Revocation timestamp                     |
| `revoked_by`      | User/admin that revoked the session      |
| `ip_hash`         | Optional non-reversible client IP hash   |
| `user_agent_hash` | Optional non-reversible user-agent hash  |
| `metadata`        | Server-only JSON details for diagnostics |

Indexes:

- `app_sessions_user_id_idx` on `user_id`
- `app_sessions_auth_user_id_idx` on `auth_user_id`
- `app_sessions_expires_at_idx` on `expires_at`
- `app_sessions_revoked_at_idx` on `revoked_at`

Uniqueness:

- `id` primary key.
- Do not store raw session cookie values if a hashed lookup can be used.

### Cookie Contract

Keep the cookie name stable unless there is a deliberate migration:

- Name: `nilelearn_session`
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- `Path=/`
- Max age must not exceed the server session expiry.

Future optional hardening:

- Prefix with `__Host-` only after confirming deployment path/domain constraints.
- Add short idle timeout separate from hard expiry.
- Add session rotation after sensitive actions.

## Authorization Contract

Sessions identify the actor. They do not replace authorization checks.

Server actions must still derive:

- `actorId`
- `userId`
- `activeRole`
- branch scope
- department scope
- student ownership
- teacher class ownership

from the authenticated session and server-owned profile data.

Do not trust request body fields for:

- `actorId`
- `userId`
- `role`
- `studentId`
- `branchId`
- `departmentId`
- `expiresAt`

## Role And Scope Refresh

The current `ServerSession` contains `roles` and `activeRole`. In production, these values should be treated as session hints, not the final permission authority.

Target read flow:

1. Resolve session from cookie.
2. Reject missing, expired, or revoked session.
3. Load `app_users`, `user_roles`, `staff_profiles`, branch scopes, and department scopes.
4. Confirm the requested active role is still granted and active.
5. Use fresh server-owned scopes for protected routes and actions.
6. Update `last_seen_at` asynchronously or on a bounded interval.

If role/scope changed since sign-in:

- allow harmless session display to refresh;
- deny sensitive actions if the active role is no longer granted;
- require role re-selection if the previous active role was removed;
- write an audit log for admin role changes, not every session refresh.

## RLS Boundary

RLS should protect session rows:

- Users may read their own active session metadata if a user-facing session page is built.
- Users may revoke their own sessions.
- Super admins may view/revoke sessions for operational support.
- Regular users must not read other users' session records.
- Direct browser access to session tables should be avoided unless a deliberate UI is built.

Most server session reads should use server-side credentials or an internal repository method, not browser queries.

## Adapter Plan

### Phase 0: Current In-Memory Adapter

Status: implemented.

- `server/sessionStore.ts` provides `SessionStore`.
- Default adapter is in-memory.
- Tests prove create/get/delete/expiry behavior.

### Phase 1: Durable Adapter Skeleton

No runtime default change.

- Add a `PostgresSessionStore` behind an explicit server env flag.
- Keep memory store as default.
- Add unit tests with a fake repository implementation.
- Add integration tests only when a local/dev database is available.

### Phase 2: Durable Session Reads

Keep auth behavior stable.

- On sign-in, write `app_sessions`.
- On session read, load by session ID or session hash.
- Reject expired or revoked sessions.
- Keep existing cookie response shape.
- Preserve demo auth for local/internal testing.

### Phase 3: Role/Scope Revalidation

After normalized profile tables exist:

- Resolve `activeRole` against `user_roles`.
- Resolve branch and department scopes from server-owned tables.
- Remove any dependency on Supabase user-editable metadata.
- Use Supabase `app_metadata` only as an optimization or sign-in hint.

### Phase 4: Session Management UI

Only after durable storage exists:

- Add user-visible active sessions page if needed.
- Add super admin session revocation tools.
- Audit admin revocations.

## Tests Needed

Unit tests:

- sign-in writes a session through the configured store
- request session reads through the configured store
- logout deletes through the configured store
- expired sessions are deleted/rejected
- revoked sessions are rejected once durable adapter exists
- missing roles are rejected after role/scope refresh exists
- active role removed after sign-in blocks sensitive actions

API tests:

- `/api/auth/session` returns only safe session fields
- `/api/auth/logout` clears cookie and revokes/deletes server session
- protected routes reject missing/expired session
- server workflow actions reject spoofed `actorId` even when a valid session exists

Portal QA:

- login/logout still works for all six roles
- direct route access still redirects/denies correctly
- portal QA remains 921/0 after any session adapter change

## Migration Risks

- Accidentally treating client `localStorage` or request body role fields as authority.
- Breaking demo auth while replacing storage.
- Role/scope drift between Supabase Auth metadata and app profile tables.
- Session reads becoming slow if every request reloads large profile graphs.
- Revoked sessions remaining valid because of stale JWT/app metadata assumptions.

## Rollback Plan

- Keep memory store as the default until durable adapter is proven.
- Gate durable sessions with an explicit server env flag.
- Preserve cookie name and response shape during adapter rollout.
- If durable reads fail, switch back to memory store without changing routes.
- Run `scripts/verify.sh` before reporting any auth/session slice complete.

## Next Implementation Slice

The next code slice should be small:

1. Add a non-default durable `PostgresSessionStore` skeleton only after migrations exist.
2. Add fake-adapter tests first.
3. Do not enable it by default.
4. Do not change login UX.
5. Preserve portal QA 921/0.
