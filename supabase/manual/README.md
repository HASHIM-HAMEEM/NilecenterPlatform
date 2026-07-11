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

## Supabase Dashboard Steps

1. Open the intended development/test project in Supabase Dashboard.
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

## Required Review Before Any Shared Run

- Rotate any credentials previously exposed outside the repository.
- Confirm the target is a dedicated development/test project.
- Take and verify a backup.
- Review the project diff/dry run and database advisors.
- Confirm `anon` and `authenticated` cannot read base tables or execute the
  session lifecycle RPCs.
- Run `npm run check:phase1-schema` and
  `npm run check:phase2-session-schema` locally.
- Run the manual SQL in the documented order.
- Execute the Phase 1 assertions and the Phase 2 session lifecycle checks in a
  controlled environment.
- Preserve the 1,205/0 portal QA baseline before any runtime flag changes.

## Current Evidence Boundary

Static SQL, TypeScript, and focused unit checks pass. The latest container-based
Phase 2B run was stopped by instruction before the corrected migration was
retested. Therefore database execution, PostgREST behavior, and remote
promotion remain **unverified and unapproved**. Do not switch
`NILE_SESSION_REPOSITORY` away from `memory` based on this bundle alone.
