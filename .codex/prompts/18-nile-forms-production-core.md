# 18 Nile Forms Production Core

## SPEC

Implement only the Nile Forms production-core slice approved by the current
checkpoint in `docs/NILE_LEARN_MASTER_PLAN.md`. Follow ADR-006 for collection
authority and ADR-007 for the processing boundary.

This slice establishes normalized local persistence for the already accepted
Nile Forms behavior. It does not add fields, processing profiles, requests,
approvals, appointments, surveys, storage, providers, or route cutovers.

## AUTHORITY

- Require an authenticated normalized session for every protected operation.
- Resolve the server-held session token hash inside the same transaction as
  each protected command. Revalidate that the session is unexpired and
  unrevoked and that the user, active role grant, role, action permission,
  branch scope, department scope, ownership, and assignment remain active.
- Lock the session, role grant, permission, scope, assignment, and target rows
  in one documented deterministic order before the final checks. Session and
  grant revocation must use the same order. Test both lock winners in concurrent
  revoke-versus-command races and prove the losing operation writes nothing.
- Application permission codes are colon-delimited and map through one
  server-owned one-to-one table to dot-delimited database codes. Callers never
  provide database permission codes. Cross-layer tests must prove every Forms
  permission mapping, including `forms:read` to `forms.read` and
  `form_submissions:sensitive_read` to
  `form_submissions.sensitive_read`.
- Public writes use only an open public publication, bounded input, rate
  limits, idempotency, and server-derived scope. They record a dedicated public
  command-evidence row with publication, request hash, idempotency key, IP
  HMAC, user-agent hash, and timestamps. They never fabricate an app user,
  session, or role grant and never insert anonymous actors into the protected
  `command_executions` or `audit_logs` authority chain.
- Public evidence is immutable and one-to-one with its submission. A provenance
  constraint requires exactly one protected or public authority reference for
  every new normalized submission. Its globally namespaced idempotency key is
  unique, and a versioned server-keyed HMAC binds operation, publication,
  immutable version, canonical normalized answers, and client submission ID.
  Exact replay returns the original result; same-key/different-HMAC returns
  `409` with no new row.
- Missing authority returns `403`; repository/provider unavailability returns
  `503`; neither path may fall back to compatibility state or create quarantine
  evidence. During offline sync, an invalid current session, permission,
  enrolled device, or unverifiable capture is rejected with no submission. A
  valid current staff session and device may quarantine an item only when its
  server-issued bundle proves capture was authorized before an assignment or
  version change; it receives no fallback target and no automatic processing.
- Browser roles receive no table access or function execution grants.
- Cookie-authenticated mutations require `X-Nile-Learn-Request: browser`, an
  exact allowed Origin/Host match, and valid Fetch Metadata before route logic.
  Test missing/spoofed headers, hostile same-site sibling origins, and every
  no-body mutation such as retire or revoke.

## REPOSITORY

- Replace the callback transaction boundary with explicit query and command
  methods covering the currently accepted Forms lifecycle except promotion
  execution.
- Keep the memory adapter as the deterministic test reference.
- Add a server-only Supabase adapter backed by bounded RPCs and projections.
- Add `role_grant_permissions` evidence for permissions that cannot safely be
  role-wide. `form_submissions:sensitive_read` exists only at the grant level;
  creation of a Super Admin role grant adds it by default, while every other
  grant requires an authorized scoped grantor and audit evidence.
- Protected mutations persist domain state, command evidence, and audit rows
  atomically and reject conflicting idempotency payloads. Authorized public
  submission uses its dedicated public command evidence in the same
  transaction as the immutable submission.
- Only successful submission and review commands create `form.submitted` and
  `form.reviewed` outbox events in this slice. Each newly accepted,
  non-quarantined offline item is a successful submission and creates exactly
  one `form.submitted` event. The batch-sync envelope, replayed items, rejected
  items, and quarantined items create no outbox event. Publication, assignment,
  draft, export, and migration commands remain audited but create no outbox
  event unless a later approved asynchronous consequence requires one.
- Normalized promotion execution returns `503` with
  `forms_promotion_persistence_inactive`. It must remain disabled until a
  canonical target command, promotion evidence, audit, and required outbox can
  commit atomically in one durable transaction.
- Reads return only server-authorized projections and redact non-authorized
  answer fields before leaving the server. Government identity, payment,
  health, credential, file, and signature values are omitted from projections
  and exports unless the scoped grant has
  `form_submissions:sensitive_read`.
- Use one centralized answer projector for definition/submission lists,
  submission detail, CSV, report indexes, audit, logs, and outbox. Sensitive
  values are never searchable/indexed and never copied into audit metadata,
  application logs, or outbox payloads, even for an entitled reader.
- Persist offline bundle and bundle-item authority with a server MAC bound to
  device, role grant, assignment, publication, version, issued/expiry time, and
  safe-option digest. Missing, tampered, foreign-device, revoked, or expired
  proof writes no submission, receipt, audit, quarantine, or outbox row.
- Preserve immutable published versions, submission answers, reviews, sync
  receipts, and migration evidence.

## DATABASE

- Use additive local-only migrations, semantic assertions, fake fixtures, and a
  complete rollback/reapply drill.
- The rollback removes only Phase 13F1 objects and preserves every Phase 13A-E
  table, immutable version, submission, review, offline receipt, migration
  record, and accepted evidence row.
- Keep forced RLS and service-only base tables.
- Application runtime uses a dedicated `nile_forms_executor` principal with
  execute access only to exact RPC/projection signatures and no base-table DML.
  `service_role` is limited to migrations and controlled acceptance tooling.
  Every `SECURITY DEFINER` function has an empty `search_path`, fully qualified
  objects, bounded inputs, and explicit execute revocation from `PUBLIC`,
  `anon`, and `authenticated`.
- Test direct `anon` and `authenticated` denials through PostgreSQL and the
  isolated local Data API.
- Do not apply SQL to a linked, shared, or remote Supabase project in this
  slice.
- Keep Phase 13F1 SQL under `supabase/manual` and outside pushable migration
  history until a separate promotion checkpoint. Its runners reject non-local
  database hosts and linked project references with no bypass flag in this
  slice.

## RUNTIME

- Memory remains the default until an explicit later activation checkpoint.
- Normalized production requests continue to fail closed while the adapter is
  disabled.
- `NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED` remains `0`. Startup must reject
  `1` unless the normalized adapter, RPC catalog version, dedicated executor,
  key versions, and schema evidence all match. A flag alone can never select
  the memory adapter for a normalized session.
- `VITE_NILE_FORMS_CUTOVER_ENABLED` remains `0` by default.
- Existing public, support, attendance, admissions, offline, and migration
  routes keep their current authority until route-by-route cutover approval.
- Existing lead, application, placement, support-ticket, and
  attendance-exception records remain the only canonical operational records.
  Phase 13F1 creates no parallel workflow state.
- Public address handling trusts no proxy by default. Production configuration
  allowlists exact proxy hops/networks, canonicalizes the socket-derived client
  address, stores only a versioned HMAC, supports active/previous key rotation,
  and expires durable cross-instance rate-limit rows. Spoofed forwarding headers
  and rotation/retention behavior are acceptance tests.

## VERIFY

Run focused repository and authority tests, Forms schema static/runtime gates,
the relevant Phase 2 session gates, `npm run check`, `npm test -- --run`,
`npm run build`, `scripts/verify.sh`, and focused Codex in-app Browser QA.
Preserve the accepted 1,598/0 portal baseline or establish an intentionally
reviewed higher baseline.

Acceptance tests must include concurrent revoke/command races, exhaustive
permission translation, grant-level sensitive access and redaction on every
projection, public replay/conflict constraints, offline proof tampering, proxy
spoofing and limiter concurrency, direct executor DML denial, RPC signature and
search-path assertions, CSRF/origin denials, local-host migration guards, and a
normalized-promotion executor spy that remains untouched with no mutation,
audit, or outbox row.
