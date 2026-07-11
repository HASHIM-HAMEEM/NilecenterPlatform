# ADR-002: Durable Sessions And Effective Role Grants

- Status: Accepted
- Date: 2026-07-10

## Context

Supabase Auth can authenticate a user, but current authorization facts and
sessions are not durable normalized authority. Process-memory sessions and
client role state cannot protect a multi-instance production deployment.

## Decision

Supabase Auth proves login identity. Nile Learn resolves that identity through
exactly one active `app_users.auth_user_id` mapping. Authorization comes from
effective-dated `role_grants`, branch and department scope rows, permissions,
profiles, class assignments, and ownership relationships.

Nile Learn uses opaque application sessions stored as SHA-256 token hashes in
`auth_sessions`. The cookie contains only the opaque token. Sessions reference
one active role grant, expire, can be revoked, and are shared across instances.
Role switching revokes the old session and creates a new immutable session bound
to the selected grant. Every lookup revalidates the user and grant.

`auth_user_id` may be null only while an account is `invited`. Activating an
account requires a unique Supabase Auth mapping. The database rejects an active
app user without that mapping.

## Invariants

- Missing, duplicate, inactive, or revoked mappings return 403.
- Production never falls back to demo identity or memory sessions.
- A session uses only its referenced active role grant. It never unions roles or
  scopes from the user's other grants.
- Phase 1 normalized base tables are server-only. Browser Auth JWTs receive no
  direct grants or policies that could bypass the application session.
- Active-role changes require an active effective grant and are audited.
- Sensitive actions refresh role, permission, and scope authority server-side.
- Raw session tokens, provider tokens, and password material are never stored.
- `raw_user_meta_data` and browser claims are not authorization sources.

## Consequences

Durable identity and sessions must be operational before normalized workflow
writes. Demo auth and the memory session adapter remain explicit local/QA modes
only.
