# ADR-006: Nile Forms Authority And Promotion Boundary

- Status: Accepted
- Date: 2026-07-11

## Context

Nile Center previously used Jotform for data collection that the legacy LMS and
EMS could not provide. Repeating that dependency would keep school data,
authorization, review evidence, and workflow handoff outside Nile Learn. A full
Jotform clone would also create a generic application-builder product that Nile
Learn does not need.

## Decision

Nile Learn will own Nile Forms, a bounded schema-driven collection module for
admissions, support, attendance exceptions, consent evidence, and branch
operations. It uses structured pages and fields, bilingual English and Arabic
content, deterministic conditional rules, immutable published versions,
scoped assignments, drafts, submissions, one-stage review, exports, and
registered promotion adapters.

Super Admin owns global templates, permissions, retention, exports, and finite
legacy migration. Registrar, HOD, and Branch Admin may manage forms only inside
their effective branch or department scopes. Teachers and students initially
respond only. The application session remains the authority for actor, active
role grant, branch, department, assignment, and respondent identity.

Accepted submissions may be promoted only through a registered typed command.
Form answers never write operational tables directly. Publication, assignment,
submission, review, export, migration, and promotion produce audit evidence;
submission, review, and promotion also produce transactional outbox events when
normalized persistence is active.

## Invariants

- Published versions are immutable. Editing starts a new draft version.
- Drafts and submissions remain pinned to the version they used.
- Hidden answers are cleared by the renderer and ignored by the server.
- Rule order is explicit and cycles are rejected.
- Public writes are rate limited, schema validated, and idempotent.
- Cross-role, cross-branch, cross-department, ownership, and assignment denials
  are enforced on the server.
- Browser roles receive no direct grants to Nile Forms base tables.
- Initial review is linear: `submitted -> under_review -> accepted | rejected -> promoted`.
- Form authors cannot configure URLs, secrets, scripts, SQL, arbitrary commands,
  payments, email, WhatsApp, Moodle writes, or provider credentials.
- Offline capture is staff-only, explicitly enabled per publication, encrypted
  locally, expires within 72 hours, and is reauthorized during synchronization.
- Government IDs, payment data, health data, credentials, files, and signatures
  make a publication ineligible for offline capture.
- Jotform migration is selective and finite. Imported submissions never promote
  automatically, and the temporary API key is retired after reconciliation.
- Provider credentials are accepted only from server environment configuration;
  the browser cannot submit, read, or receive a Jotform key.
- Import commit requires the exact recorded dry-run hash. Source or target
  changes require a new preview, and imported source identities are replay-safe.
- Real uploads and drawn signatures remain prohibited until a storage ADR is
  accepted.

## Consequences

Existing typed workflows remain authoritative and are replaced one form at a
time only after parity evidence. Login, RBAC, payments, attendance rosters,
course delivery, scheduling, assessments, grading, certificates, and Moodle
activities are not genericized. The initial local schema and compatibility
runtime do not activate normalized production writes or authorize a remote
Supabase migration.
