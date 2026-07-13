# ADR-007: Nile Forms Processing And Typed Module Boundary

- Status: Accepted
- Date: 2026-07-12

## Context

ADR-006 established Nile Forms as a bounded schema-driven collection module.
The approved full Jotform replacement program adds operational requests,
bounded approvals, appointments, surveys, applications, storage, reporting,
and provider delivery. Implementing those capabilities inside mutable form
responses or an arbitrary workflow canvas would weaken the existing evidence,
authorization, and domain-command boundaries.

## Decision

Nile Forms remains responsible for form definitions, immutable versions,
publications, assignments, drafts, immutable submissions, review evidence,
exports, offline capture, and finite migration.

A published form may later pin one immutable processing-profile version. The
only processing profile kinds are `evidence`, `request`,
`sequential_approval`, `booking`, `survey`, and `application`. A profile may
select only registered Nile adapters, bounded routing conditions, scoped
targets, fixed transition families, and safe notification template keys.

Operational state belongs to typed modules:

- Requests own request number, priority, assignee, department, due date,
  comments, activity, resolution, and reassignment history.
- Approvals own ordered stages, one/all/any completion policy, decisions,
  correction requests, deadlines, and escalation evidence.
- Appointments own services, schedules, slots, capacity, reservations,
  cancellations, rescheduling, waiting lists, and timezone rules.
- Surveys own identity policy, scored values, privacy thresholds, aggregates,
  and result projections.
- Applications own recruitment or admissions pipeline state.

Registered commands may create those records from a submission. Form answers
never become mutable workflow state and never write operational tables
directly.

## Invariants

- A submitted answer set is immutable. Corrections create a new submission
  linked to the original root and immediate predecessor.
- Publishing a replacement version may retain the same slug only in one atomic
  same-definition transaction. The prior publication is retired, existing
  submissions remain pinned, and active assignments are recreated for the new
  assigned publication without mutating historical assignment evidence. Until
  a scheduler exists, same-slug replacements must open immediately rather than
  retiring an active publication before a future opening time. A slug owned by
  another definition remains a conflict.
- Every processing profile is immutable once published and is pinned by the
  publication or resulting case.
- Routing, approval, scoring, and calculation rules are structured, bounded,
  deterministic, cycle-free, and evaluated again on the server.
- Condition operators and values must match their source field type in both the
  builder and published-schema validation; malformed conditions fail closed.
- Retired or closed publications accept no new assignments. Existing assignment
  evidence may still be revoked through the authorized command.
- A failed promotion replays for the same idempotency key. An explicit retry
  uses a new key, while audit evidence retains the prior command, key, and error.
- Actor, respondent, active role grant, branch, department, ownership,
  assignment, approver identity, and manager relationship come from normalized
  server authority.
- Global scope markers and an empty effective scope are distinct. Global is an
  explicit grant; an empty or non-overlapping session/profile intersection
  returns `403` before any list, detail, export, review, promotion, or mutation.
- Missing, expired, revoked, or unauthorized user, session, role grant,
  permission, scope, ownership, or assignment authority returns `403` and
  writes no submission, quarantine row, command evidence, audit, or outbox
  event for an online command or unverifiable offline item. Offline quarantine
  is permitted only when the current staff session and enrolled device are
  valid and a server-issued bundle proves that capture was authorized before
  its assignment or version changed. The batch must retain that evidence, pick
  no fallback target, and perform no automatic processing. Quarantine is also
  permitted after authorization for unresolved operational routing.
- Application permissions use colon-delimited codes. Database permissions use
  dot-delimited codes. The server owns one explicit one-to-one translation
  table, for example `forms:read` to `forms.read`; callers cannot supply or
  translate permission codes.
- Sensitive values classified as government identity, payment, health,
  credential, file, or signature data are redacted from server projections and
  omitted from exports unless the active scoped role grant has
  `form_submissions:sensitive_read` (database code
  `form_submissions.sensitive_read`). This entitlement is attached to one role
  grant, never to an entire non-admin role. A new Super Admin role grant receives
  it by default; every other role grant requires an explicit scoped grant with
  grantor and audit evidence. UI hiding is not an access control.
- Form authors cannot configure scripts, SQL, secrets, arbitrary commands,
  direct database mappings, or provider credentials.
- Outbound webhooks are not form-author actions. A later Super-Admin-only
  gateway requires an allowlisted destination, server-held secret, egress
  controls, replay protection, audit, and a separate provider approval.
- Payment-request forms may create internal approval records but never collect
  funds or activate a payment gateway.
- Drawn signatures are versioned acknowledgments, not an electronic-contract
  platform.
- File bytes, drawn signatures, external delivery, scheduled jobs, remote
  migrations, and production runtime activation remain disabled until their
  own approved slices satisfy storage, threat, rollback, and provider gates.

## Operational Sources Of Truth

Typed adapters extend existing authorities instead of creating parallel
operational records:

| Form outcome                           | Canonical operational owner                             |
| -------------------------------------- | ------------------------------------------------------- |
| Enquiry or free-trial lead             | Existing Registrar admissions lead command              |
| Application intake                     | Existing Registrar application command                  |
| Placement request                      | Existing placement command and workflow                 |
| Student support request                | Existing support-ticket command and records             |
| Attendance exception                   | Existing attendance-exception command and records       |
| Consent acknowledgment                 | Nile Forms immutable evidence only                      |
| Branch incident or maintenance request | Future typed Requests module                            |
| Recruitment application                | Future typed Applications module                        |
| Internal payment request               | Future typed Approvals module; never payment collection |

The processing profile stores the registered adapter identity and resulting
entity reference. It never duplicates canonical mutable status in a form
submission or a second workflow row.

## Phase 13F1 Security Boundary

- Every protected command receives only the server-derived opaque session-token
  hash. Its database transaction locks session, role-grant, permission, scope,
  assignment, and target rows in a documented deterministic order, then repeats
  all authorization checks. Revocation uses the same lock order. Concurrent
  revoke-versus-command tests must prove that only the lock winner can commit.
- Phase 13F1 adds grant-level permission evidence for sensitive access. One
  centralized server projection performs redaction for list/detail APIs, CSV,
  searchable indexes, audit, application logs, and outbox payloads. Sensitive
  answer values are never indexed or copied into audit, logs, or outbox.
- Anonymous public submissions use an immutable one-to-one public command record
  and cannot reference protected actor evidence. A versioned server-keyed HMAC
  binds operation, publication, version, canonical answers, and client
  submission ID. Replay returns the original result; a same-key/different-HMAC
  request returns `409` and writes nothing.
- Offline sync requires a persisted bundle and item record plus a server MAC
  bound to device, role grant, assignment, publication, version, issue/expiry,
  and safe-option digest. Missing, tampered, foreign-device, revoked, or expired
  proof writes no submission, receipt, audit, quarantine, or outbox evidence.
- The runtime uses a dedicated Forms execution principal with RPC/projection
  execution only. The broad Supabase service role is restricted to controlled
  migration and acceptance tooling, not application runtime.
- Cookie-authenticated mutations require the first-party request header, exact
  allowed Origin/Host validation, and Fetch Metadata checks before route logic.
- Public rate limiting uses a cross-instance durable store keyed by a versioned
  HMAC of a canonical client address. Raw addresses are never persisted or
  logged, proxy trust is an explicit allowlist, and key rotation plus retention
  are tested.

## Sequencing

1. Activate no new behavior until the current checkpoint approves one bounded
   slice.
2. Build and prove the normalized Nile Forms repository before adding fields or
   typed processing modules.
   The first repository slice excludes promotion execution because the current
   promotion adapters mutate a separate compatibility snapshot. Promotion must
   fail closed until each canonical target command can share the same durable
   transaction and idempotency evidence.
3. Add builder and validation parity in small field-family slices.
4. Add Requests, Approvals, Appointments, and Surveys as separate typed-module
   slices.
5. Add storage, reporting, PDF, notifications, and external providers only
   after their prerequisites are accepted.
6. Cut over one existing intake route at a time and keep rollback available.

The first Phase 14 language slice extends `FormLocale` to `en | ar | tr`, gives
every localized value an explicit Turkish member, and returns validation message
keys plus parameters instead of English-only strings. Arabic remains RTL;
English and Turkish remain LTR. Partial Turkish support, a binary EN/AR switch,
or fallback labels presented as translated content cannot pass the slice.

Requests, Approvals, Appointments, and Survey Results use the dedicated route
families owned by `docs/UI_INFORMATION_ARCHITECTURE.md`. Processing-profile
selection has its own Forms route and is not part of field editing. No typed
module queue, calendar, decision surface, or results dashboard may be embedded
in the structured builder.

## Consequences

The requested Jotform outcomes remain achievable without turning Nile Learn
into a generic application builder. The complete program is intentionally
multi-phase. Approval of this ADR does not itself activate normalized Forms
writes, apply a remote migration, enable a provider, or authorize a broad UI or
workflow implementation.
