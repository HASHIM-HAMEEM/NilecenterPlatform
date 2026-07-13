# Nile Learn Manual SQL Bundle

This folder contains the current local-only normalized identity/session SQL in
manual execution order. It is a review and development bundle, not production
promotion approval.

## Forward Order

Run each file as one complete transaction in this order:

1. `001_phase1_identity_scope_session_audit_mapping.sql`
2. `002_phase2b_atomic_session_lifecycle.sql`
3. `200_install_verification.sql`
4. `100_fake_seed.sql` only in an empty development/test project

The seed is fake demo data only. Never run it in a real school database.

## Manual SQL Editor Steps - Not Currently Approved For Remote Use

Use only an isolated disposable local project, or a remote development project
explicitly approved by a later master-plan checkpoint. The current checkpoint
does not approve a linked, shared, tunneled, staging, or production target.

1. Open the approved isolated project in Supabase Dashboard or local Studio.
2. Open **SQL Editor** and create a new query.
3. Paste the complete contents of `001_phase1_identity_scope_session_audit_mapping.sql` and run it once.
4. Create a second query, paste `002_phase2b_atomic_session_lifecycle.sql`, and run it once.
5. Create a third query, paste `200_install_verification.sql`, and confirm it returns `verified_table_count = 25`.
6. Only for an empty demo project, run `100_fake_seed.sql` last.

Do not combine the files into one editor run. Stop at the first error and keep
`NILE_SESSION_REPOSITORY=memory` until the verification and server adapter
acceptance checks are both clean.

## Rollback Order

Rollback is destructive. Use it only in an empty disposable development
database before dependent migrations exist:

1. `901_phase2b_rollback.sql`
2. `902_phase1_rollback.sql`

For shared or production environments, use an approved forward migration or a
reviewed backup restore instead of these rollback files.

## Future Shared-Environment Review - Does Not Grant Approval

- Rotate any credentials previously exposed outside the repository.
- Confirm the target is a dedicated development/test project.
- Take and verify a backup.
- Review the project diff/dry run and database advisors.
- Confirm `anon` and `authenticated` cannot read base tables or execute the
  session lifecycle RPCs.
- Run `npm run check:phase1-schema`,
  `npm run check:phase1-schema:runtime`, and
  `npm run check:phase2-session-schema` locally.
- Run `npm run check:phase2-session-schema:runtime` to execute the reviewed SQL
  lifecycle and rollback in portable PGlite PostgreSQL. This is required local
  evidence but is not a substitute for PostgREST acceptance.
- Run the manual SQL in the documented order.
- Execute the Phase 1 assertions and the Phase 2 session lifecycle checks in a
  controlled environment.
- Preserve the accepted portal QA baseline from the master plan before any
  runtime flag changes.

Completing this checklist does not authorize a shared or remote run. Promotion
requires a later master-plan checkpoint with an explicit target and rollback
approval.

## Current Evidence Boundary

Static SQL, TypeScript, focused unit checks, and the portable PGlite Phase 2B
gate pass. The corrected SQL also passes the real repository adapter against
isolated native PostgreSQL 17 and PostgREST 14.14 with the exact fake fixture.
That local run proves eight browser-role denials plus create, replay, conflict,
denial-with-no-write, live scope refresh, expiry, revoke, audit, and
`revoked_by` behavior. Remote promotion and runtime activation remain
**unapproved**. Do not switch `NILE_SESSION_REPOSITORY` away from `memory` based
on this local evidence alone.

## Local PostgREST Acceptance Without Docker

When Docker operation is not approved, use only an already-running, isolated
local PostgREST/Supabase endpoint with fake data. Do not point this runner at a
linked, shared, tunneled, staging, or production project.

After the forward SQL, installation verification, and fake seed above are
complete, provide the local test credentials only in the current command shell.
The runner requires the deterministic
`phase2b-disposable-local-v1` integration marker, exactly the six fake
`@nilelearn.local` users, and no existing session rows. This prevents mutation
of an unknown or previously used database:

```bash
NILE_PHASE2_SESSION_LOCAL_ONLY=1 \
SUPABASE_URL=http://127.0.0.1:<port> \
SUPABASE_SECRET_KEY=<local-service-key> \
NILE_LOCAL_SUPABASE_ANON_KEY=<local-anon-key> \
NILE_LOCAL_SUPABASE_JWT_SECRET=<local-jwt-secret> \
npm run check:phase2-session:postgrest
```

The runner rejects non-local URLs, requires an explicit acknowledgement, never
starts Docker, never applies SQL, and never changes the application runtime
default. It writes fake session lifecycle rows while checking create, replay,
conflict, authority denial with no write, scope refresh, revoke, audit evidence,
and browser role denials; use it only on a freshly reset disposable database. A
pass is local acceptance evidence, not approval to enable
`NILE_SESSION_REPOSITORY=supabase`.
