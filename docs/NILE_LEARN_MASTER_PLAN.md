# Nile Learn Modernization Master Plan

## Purpose

This document is the product and architecture roadmap for moving Nile Learn
from a broad internal alpha into a production-ready LMS and EMS foundation.

It is grounded in:

- the current Nile Learn codebase and protected portal QA baseline;
- the read-only legacy EMS audit for Registrar, Teacher, HOD, Supervisor, and
  Branch Administrator views;
- the read-only Moodle teacher and course audit;
- the existing Nile Learn domain, server action, repository, auth, and UI
  architecture.

This plan owns product sequencing, data authority, architecture boundaries,
migration order, and completion gates. It does not replace `CLAUDE.md`,
`AGENTS.md`, the design contracts, or feature-specific prompts.

## Mission

Build Nile Learn as the canonical school operating system while retaining
Moodle as the initial learning-content and activity engine. Migrate verified
legacy EMS data into Nile Learn through a finite, reconciled, reversible
process. Do not reproduce legacy security flaws, invalid data states, role
leaks, crowded UI, or ambiguous ownership.

The protected internal-alpha baseline is:

- Portal QA: 1,501 checks, 0 failures.
- TypeScript check, unit tests, and production build are required gates.
- The accepted evidence is recorded in `docs/qa-baseline.md`.

## Agent Goal

Move Nile Learn from a broad internal alpha to a production-ready LMS and EMS
foundation without losing the clean baseline. Make Nile Learn authoritative for
identity, RBAC, organization, admissions, enrollments, classes, schedules,
attendance, finance, certificates, messaging, and audit. Treat legacy EMS as a
finite read-only migration source and Moodle as the initial authority for
Moodle-managed content and activities. Implement normalized persistence,
durable sessions, strict scope enforcement, reconciliation-based integrations,
and route-by-route Simple UI through small verified slices.

Every agent must name the master-plan phase and bounded slice before editing,
then follow `docs/MODERNIZATION_EXECUTION_CONTRACT.md` through completion or a
clear stop condition.

## Non-Negotiable Product Model

Supported roles remain:

- `student`
- `teacher`
- `registrar`
- `headofdepartment`
- `branchadmin`
- `superadmin`

Legacy Supervisor, Guidance, Accountant, and Administrator labels do not become
new permanent Nile Learn roles. Their valid capabilities are expressed as
permissions and scopes within the five staff roles.

```text
User
  -> Role grant
  -> Active role
  -> Branch and department scopes
  -> Permissions
  -> Portal access
  -> Server-authorized actions
  -> Immutable audit events
```

## Source-Of-Truth Matrix

| Data family                                           | Initial authority                       | Nile Learn behavior                                   |
| ----------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Authentication                                        | Supabase Auth                           | Verify identity and manage durable sessions           |
| Roles, permissions, active role, scopes               | Nile Learn                              | Canonical, server-authoritative                       |
| Branches and departments                              | Nile Learn                              | Canonical                                             |
| Leads, applications, placement                        | Nile Learn                              | Canonical                                             |
| Students, guardians, enrollments                      | Nile Learn                              | Canonical                                             |
| Programs, levels, catalog metadata                    | Nile Learn                              | Canonical                                             |
| Course offerings, classes, teachers, rooms, schedules | Nile Learn                              | Canonical                                             |
| Class sessions and attendance                         | Nile Learn                              | Canonical; Moodle writeback is a later optional phase |
| Finance, certificates, messages, audit                | Nile Learn                              | Canonical                                             |
| Moodle course structure and content                   | Moodle initially                        | Read-only synchronized projection                     |
| Moodle activities and completion                      | Moodle for provider-managed activities  | Read-only synchronized projection                     |
| Moodle attempts, grades, and feedback                 | Moodle for provider-managed assessments | Read-only summary in Nile Learn                       |
| Nile-native assessments                               | Nile Learn                              | Canonical; never dual-owned with a Moodle activity    |
| Legacy EMS records                                    | Legacy EMS only during migration        | One-way import, reconciliation, then retirement       |
| Files, audio, and video                               | Future approved storage provider        | Metadata only until storage is approved               |

No entity field may have two writable authorities. Provider-managed fields must
be visibly read-only in Nile Learn and rejected by server actions.

## Accepted Architecture Decisions

The Phase 0 decisions are recorded under `docs/decisions/`:

- ADR-001: system authority boundaries;
- ADR-002: durable sessions and effective role grants;
- ADR-003: read-only Moodle projection;
- ADR-004: finite legacy EMS migration;
- ADR-005: atomic domain, audit, and outbox writes.

Implementation must follow these records. Any change requires a superseding ADR
and the approval process defined in `docs/decisions/README.md`.

## Canonical Academic Model

The new model must distinguish reusable academic design from delivery:

```text
Department
  -> Program
  -> Level
  -> Course template
  -> Curriculum version
  -> Modules
  -> Lessons

Course template
  -> Course offering
  -> Class group
  -> Teacher assignment history
  -> Student membership history
  -> Recurring schedule
  -> Class sessions
  -> Attendance and outcomes
```

Required corrections to the current snapshot model:

- A course template is not a class.
- A course offering is not a class group.
- A recurring schedule is not an individual session.
- Teacher assignment needs effective dates, substitutes, and history.
- Student class membership needs effective dates and status history.
- Moodle and EMS identifiers belong in external mapping records.
- Course titles and human names are never integration keys.

## Target Application Architecture

Keep a modular monolith. Do not create microservices during stabilization.

```text
React route and page-type layer
  -> Typed query and command API
  -> Application use cases
  -> Domain rules and authorization policy
  -> Granular repositories
  -> Supabase/Postgres transactions
  -> Audit and outbox records
  -> Provider adapters and background synchronization
```

### Client

- Render role-scoped read models returned by the server.
- Send typed commands without actor, role, or ownership authority.
- Use local storage only for non-authoritative UI preferences and safe drafts.
- Never merge demo seed data into production results.

### Server

- Resolve identity, active role, permissions, branch scope, department scope,
  ownership, and provider authority from the authenticated session and database.
- Use explicit application services for lifecycle transitions.
- Commit domain mutation, audit event, and outbox event atomically.
- Require an idempotency key for retried commands and integration writes.
- Fail closed when production persistence is unavailable.

### Repository

The current snapshot repository remains a compatibility adapter during
migration. It must not become the production model.

Target repository families:

- Identity and access
- Organization
- Admissions and students
- Catalog and curriculum
- Course delivery and scheduling
- Attendance
- Assessments and progress
- Finance
- Certificates
- Communication
- Audit and reporting
- Integrations and migration

## Authentication And Authorization

Supabase Auth authenticates the person. Nile Learn tables authorize the action.

Required chain:

```text
auth.users
  -> app_users
  -> role_grants
  -> staff or student profile
  -> branch and department scopes
  -> permission policy
```

Hard rules:

- A missing or ambiguous identity mapping returns 403. It never falls back to a
  demo user.
- Production sessions are durable across instances and deployments.
- Active-role switching requires an active grant and creates an audit event.
- Sensitive actions refresh role and scope authority server-side.
- RLS and server action gates provide defense in depth.
- Service-role credentials are used only by server jobs that require them.
- Previously exposed credentials must be rotated before production use.

## Integration Architecture

Use provider-neutral mapping and synchronization records:

- `integration_connections`
- `external_records`
- `sync_cursors`
- `sync_runs`
- `sync_run_items`
- `reconciliation_cases`
- `outbox_events`

Every external record needs provider, entity type, internal ID, external ID,
external parent ID, source version, source timestamp, source hash, sync state,
last seen time, last synchronized time, and last error.

### Moodle

The verified legacy contract includes Moodle user IDs, course IDs, course short
names, course dates, attendance activity IDs, course sections, pages, videos,
quizzes, gradebook, completion, and attendance sessions.

Moodle rollout order:

1. Capability discovery with a dedicated minimum-privilege service account.
2. Read-only user, course, section, activity, enrollment, completion, grade,
   and attendance projections.
3. Mapping and reconciliation UI.
4. Human approval of unmatched or stale records.
5. Controlled user/course enrollment writes.
6. Optional attendance writeback only after Nile attendance is canonical.

Do not use browser automation or staff credentials as a production connector.

### Legacy EMS

Legacy EMS integration is a finite migration, not a permanent sync.

Required migration records:

- `migration_runs`
- immutable source payload hashes
- source-to-internal ID mappings
- match exceptions
- reconciliation totals
- approval state
- cutover watermark
- final delta-import evidence
- rollback evidence

Outbound EMS writeback and recurring EMS synchronization are prohibited. After
approved cutover, retire the migration credentials.

## UI And Information Architecture

All route work follows `DESIGN.md`, `docs/DESIGN_V2.md`,
`docs/SIMPLE_UI.md`, and `docs/UI_INFORMATION_ARCHITECTURE.md`.

One page has one main job. List, detail, create, reports, activity, settings,
and access management remain separate.

Example class route family:

```text
/app/{role}/classes
/app/{role}/classes/:classId
/app/{role}/classes/:classId/roster
/app/{role}/classes/:classId/schedule
/app/{role}/classes/:classId/sessions
/app/{role}/classes/:classId/attendance
/app/{role}/classes/:classId/grades
/app/{role}/classes/:classId/content
/app/{role}/classes/:classId/activity
```

The UI must not reproduce the legacy all-tabs-expanded class screen.

## Delivery Phases

### Phase 0: Authority And Baseline

Deliverables:

- Correct the legacy discovery ledger.
- Approve this source-of-truth matrix.
- Record architecture decisions for auth, Moodle, EMS migration, and audit.
- Preserve the 1,313/0 QA artifact.

Gate: no unresolved ownership conflict.

### Phase 1: Identity, Organization, Audit, And Mapping Schema

Deliverables:

- Migration drafts for users, role grants, permissions, scopes, branches,
  departments, immutable audit events, and external mappings.
- Forced RLS, zero direct browser grants/policies on normalized base tables,
  server-only authority helpers, and complete foreign-key/authority indexes.
- Fake seed data only.

Gate: migration rollback succeeds, database browser-role privilege assertions
and real local PostgREST `anon`/`authenticated` denial checks pass, session
resolution proves one active role grant, and command/migration evidence
constraints pass.

Current local-only Phase 1 package:

- `docs/supabase-phase-1-identity-session-rls-draft.sql`
- `docs/supabase-phase-1-identity-session-rls-rollback.sql`
- `docs/supabase-phase-1-identity-session-rls-assertions.sql`
- `supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql`
- `supabase/seed.sql`
- `scripts/validate-phase1-schema.mjs`
- `scripts/validate-phase1-pglite.mjs`
- `scripts/validate-phase1-supabase.sh`

The reviewed SQL has been promoted into local migration history and proved on a
disposable Supabase Postgres 17 stack after the atomic authority RPC and live
scope-revalidation changes. The local gate resets from migration history, loads
fake-only seed data, runs semantic and database browser-role privilege
assertions, executes the rollback, reapplies the migration and seed, and runs
database lint. It has not been pushed or applied to a linked, shared, or remote
Supabase project.

Current evidence:

- `npm run check:phase1-schema` validates the migration package statically.
- `npm run check:phase1-schema:runtime` proves the portable PGlite cycle.
- `npm run check:phase1-schema:supabase` proves the disposable local Supabase
  cycle for all 25 Phase 1 tables.
- `npm run check:phase2-session:supabase` proves session create, hashed-token
  storage, atomic resolution, expiry, live branch/scope refresh, revocation, and
  four real local PostgREST browser-role denials.
- `QA_OUTPUT_DIR=output/playwright/phase2a-20260710 scripts/verify.sh` preserves
  the full 1,313-check portal baseline with 0 failures.

A remote dry run, managed-project advisors, backup/restore evidence, and
explicit promotion approval remain required before any shared-environment
application.

Phase 2A now provides the asynchronous durable-session repository boundary, a
memory default, a non-default Supabase adapter, opaque-token hashing, atomic
identity/active-grant resolution, live role-scope refresh, revocation,
fail-closed configuration, and real disposable-local PostgREST evidence. It
does not authorize linked/shared use or normalized workflow persistence.

### Phase 2: Durable Authentication And Scope Authority

Deliverables:

- Durable Supabase-backed session model.
- Exact `auth.users -> app_users` mapping.
- Active-role grant verification and revocation.
- Server-side scope refresh for sensitive actions.

Gate: no in-memory session dependency in production and no demo fallback.

### Phase 3: Repository Read Migration

Deliverables:

- Granular repository interfaces.
- Normalized read adapter behind an explicit server flag.
- Snapshot compatibility adapter remains default during parity testing.
- Read-model parity tests.

Gate: seeded route and workflow results remain equivalent and QA stays clean.

### Phase 4: Admissions And Student Lifecycle

Deliverables:

- Lead, application, placement, profile, enrollment workflow, course offering,
  class assignment, and portal activation in normalized persistence.
- Branch-scoped registrar actions and audit evidence.

Gate: the complete lifecycle passes server, RLS, UI, and portal QA tests.

### Phase 5: Course Delivery And Scheduling

Deliverables:

- Course templates, versions, offerings, class groups, assignment history,
  rooms, recurrence, sessions, conflicts, and membership history.

Gate: teacher, room, branch, and time conflicts are deterministic and audited.

### Phase 6: Read-Only Moodle Projection

Deliverables:

- Dedicated sandbox connection.
- Read-only mappings for users, courses, content, activities, enrollments,
  completion, grades, and attendance.
- Sync run history and reconciliation queues.

Gate: repeated sync creates no duplicates and stale mappings are visible.

### Phase 7: Teacher Operations

Deliverables:

- Assigned classes and rosters.
- Session attendance.
- Native or Moodle-owned assessment distinction.
- Grading and feedback within provider authority.
- Student progress and intervention views.

Gate: teachers cannot read or mutate unrelated classes or students.

### Phase 8: HOD And Branch Governance

Deliverables:

- HOD academic health, teacher oversight, curriculum review, assessment review,
  and certificate approval.
- Branch room, schedule, attendance-exception, finance, and local-report flows.

Gate: department and branch isolation pass direct API and RLS tests.

### Phase 9: Super Admin And Reconciliation

Deliverables:

- User and access administration.
- Branch and department configuration.
- Connection status, sync runs, reconciliation, immutable activity, and health.

Gate: every sensitive action has before/after evidence and an actor.

### Phase 10: Controlled Moodle Write Operations

Deliverables:

- Approved user provisioning and enrollment synchronization.
- Idempotent outbox processing and rollback.
- No broad content writeback until separately approved.

Gate: sandbox proof, threat review, retry proof, and reconciliation approval.

### Phase 11: Legacy Migration And Cutover

Deliverables:

- Dry-run imports.
- Data quality report.
- Human-approved reconciliation.
- Final delta import and cutover.
- Credential retirement and rollback window.

Gate: approved counts, relationships, balances, and sampled records match.

### Phase 12: Route-By-Route UI Completion

UI work follows each stable workflow rather than preceding it.

Deliverables:

- Dedicated page owners instead of generic `FeaturePage` fallback.
- Simple UI separation.
- Responsive and RTL verification.
- Loading, empty, error, disabled, success, and permission-denied states.

Gate: visual review and portal QA at every route-family boundary.

### Phase 13: Nile Forms

Nile Forms replaces the approved Jotform-dependent collection use cases without
turning typed learning and school operations into generic forms.

Deliverables:

- Authority, permissions, schema, rollback, fake fixtures, and ADR-006.
- Immutable versions, structured bilingual renderer and builder, public and
  assigned access, drafts, submissions, scoped inbox, review, export, and typed
  promotion adapters.
- Staff-only encrypted offline capture with expiring bundles, foreground sync,
  duplicate protection, reauthorization, quarantine, and recovery.
- Selective finite Jotform response migration with source hashes,
  reconciliation, no automatic promotion, and credential retirement.

Gate: schema and rule validation, every RBAC and scope denial, immutable-version
proof, idempotent review/promotion/sync/import, EN/AR and RTL accessibility,
local migration rollback, and the accepted portal baseline all pass. Remote
schema application, normalized production runtime activation, uploads, drawn
signatures, arbitrary webhooks, payments, or provider actions require their own
later approvals.

## Testing Strategy

Every phase uses the smallest relevant test pyramid:

- Domain invariant unit tests
- Application service tests
- Repository contract tests
- Transaction and idempotency tests
- RLS allow/deny tests with real role identities
- API ownership and scope tests
- Provider contract fixture tests
- Migration reconciliation tests
- Portal QA
- Responsive visual checks
- Accessibility checks

Completion never relies on a screenshot alone.

## Agent Workstreams

The primary agent owns scope, integration, and final validation. Specialized
review agents may run in parallel under `docs/MODERNIZATION_EXECUTION_CONTRACT.md`.

Recommended workstreams:

- Data architecture and migrations
- Auth, RBAC, RLS, and security
- Domain workflow implementation
- Moodle and migration adapters
- UI information architecture and responsive design
- QA, accessibility, and observability

Shared authority files, migrations, routing, auth, domain types, repositories,
QA scripts, and global CSS are serialized unless isolated worktrees and disjoint
ownership are explicitly approved.

## Definition Of Production-Ready Foundation

The foundation is ready only when:

- Production writes fail closed.
- Sessions are durable.
- Normalized persistence is authoritative.
- RLS and server gates agree.
- Every sensitive write is atomic with audit evidence.
- Cross-role, cross-branch, cross-department, and ownership tests pass.
- External synchronization is idempotent and reconcilable.
- Legacy data migration is approved and reversible.
- No production secret is browser-visible.
- Portal QA remains clean.
- Core routes are usable on mobile, laptop, desktop, ultrawide, and RTL.

## Current Modernization Checkpoint

This section is the single source of truth for current phase status and the
only approved next implementation slice. Companion plans and prompts must link
here rather than restating this checkpoint.

Current status:

- Phase 0 is accepted: authority, legacy boundaries, architecture decisions,
  and the 1,317/0 QA baseline are recorded.
- Phase 1 is accepted as a local-only migration package. It is not approved for
  linked, shared, or remote Supabase promotion.
- Phase 2A is accepted as a non-default local foundation. The repository
  boundary, disposable-local Data API integration, live scope revalidation,
  failure classification, and full 1,317/0 regression evidence are complete.
- The compatibility identity fallback identified during review is removed:
  unmapped student sessions cannot mutate seeded student records, missing or
  ambiguous authority returns `403`, and provider/storage outages return
  `503` without alternate-provider fallback.
- Phase 2B code is implemented but not accepted. Static SQL checks and 56
  focused auth/session tests pass. The corrected RPC migration has not been
  rerun against PostgREST after the explicit instruction to stop Docker use.
  Manual SQL is packaged in `supabase/manual`; database execution remains
  unverified.
- Production Phase 2 is not complete. Memory remains the runtime default, demo
  compatibility remains available under controlled configuration, Supabase
  Auth memory sessions still use the compatibility `app_metadata` role path,
  and normalized sessions cannot access legacy snapshot workflow routes.

The UI V2 shell baseline is accepted. Route-level visual expansion remains
paused while internal functionality is stabilized, except for the
product-owner-approved **Phase 12 Insight System** slice. That slice is
strictly limited to shared accessible chart and motion primitives plus one
role-specific, decision-focused insight panel on each portal dashboard and
report route. It must not change workflows, RBAC, persistence, server actions,
or route ownership, and it must not create analytics walls or dashboard card
grids. The current primary workstream remains **bounded compatibility workflow
integrity**, one feature family at a time, while Phase 2B database acceptance
waits for the manual SQL run:

1. Preserve the authenticated session as the server authority for actor, role,
   branch, department, and ownership.
2. Remove client-cache authority leaks before expanding workflow CRUD.
3. Require exact course-run and class-group targets for initial enrollment
   activation; never select a fallback run or group during a write.
4. Require active course, run, branch, teacher identity, teacher profile, and
   staff scope before creating delivery records.
5. Keep registrar status and enrollment mutations inside every affected branch
   scope; reject global mutations that would cross scope.
6. Require valid session state, run dates, active rooms, and room capacity for
   attendance and class scheduling.
7. Add domain and server-authority tests for every invariant, run focused portal
   workflows, then preserve the full 1,317/0 baseline.
8. Do not add live provider integrations, activate normalized production writes,
   or begin broad route UI polish in this workstream.

The server projection and client cache authority boundary is complete: scoped
snapshots replace global collections, protected-route hydration fails closed,
and role projections are covered by foreign-record sentinel tests. Admissions
transitions now require exact lead and placement identities, validate scores,
link application and placement into one enrollment workflow, preserve internal
handoff and audit evidence, and expose the linked placement route. These
compatibility workflows are covered by 383 unit tests plus the 1,313/0 portal
artifact dated 2026-07-11.

Branch-scoped class-group creation is now server-authoritative. It requires an
active delivery run, active same-branch room, valid capacity, a conflict-free
schedule, and branch-admin scope; it creates an empty roster, updates the run
teacher assignment, and exposes scoped audit evidence. The route
`/app/branch/classes/new` and its focused browser workflow are part of the
1,313/0 baseline.

Exact course-run creation and class-group update/status transitions are now
server-authoritative. HOD course-run creation is department and branch scoped;
branch class changes preserve the run and roster, enforce room and capacity
constraints, block unsafe completion/cancellation, and project audit evidence.
The focused routes `/app/hod/classes/runs/new` and
`/app/branch/classes/:classGroupId` are included in the 1,313/0 baseline.

Enrollment and roster transitions are now server-authoritative. Registrar or
Super Admin can transfer active or paused enrollments between eligible classes
inside the same run, pause/resume, complete, or cancel with guarded transitions.
The mutation keeps roster membership, aggregate student access, workflow state,
teacher relationship, notification, and audit evidence atomic. Cross-run,
out-of-scope, full-class, inactive-class, incomplete-completion, and terminal
replay attempts are rejected before mutation. The focused registrar routes
`/app/registrar/enrollments/records` and
`/app/registrar/enrollments/records/:enrollmentId` are included in the 1,313/0
baseline.

Class-session lifecycle transitions are now server-authoritative. Branch Admin,
assigned Teacher, or Super Admin can reschedule or cancel an active or pending
class session. The transition atomically updates its calendar and session rows,
enforces run dates, active room, room capacity, teacher availability, schedule
conflicts, and role scope, and writes learner notifications plus scoped audit
evidence. Sessions with attendance are locked so academic history cannot be
silently detached. The route
`/app/branch/schedule/sessions/:sessionId` and its focused browser workflow are
included in the 1,313/0 baseline.

Attendance-exception lifecycle transitions are now server-authoritative. A
student can submit a reason against an exact own absent or late attendance row;
Branch Admin or Super Admin can approve or reject a pending request. Approval
atomically changes the record to excused and recomputes the related enrollment
attendance rate, while rejection preserves the original record. Duplicate
pending requests, cross-student submissions, terminal replay, inconsistent
relationships, and cross-branch reviews are rejected. Student, Teacher, Branch
Admin, HOD, and Super Admin receive scoped exception, notification, or audit
projections. The student attendance request and branch attendance review
workflows are included in the 1,313/0 baseline.

Assignment-publication lifecycle transitions are now server-authoritative.
Creation produces an exact course-run draft. Assigned Teacher, department and
branch-scoped HOD, or Super Admin actions can edit and publish it only while the
delivery run and class are active. Drafts and cancelled rows never reach Student
projections. Cancellation is blocked after submission; closing requires the due
date or a completed submission from every active learner; submitted work and
grades remain intact. Publish, published-cancel, and close transitions notify
active learners and write scoped audit evidence. The focused Teacher create and
detail workflow is included in the 1,313/0 baseline.

Quiz-publication lifecycle transitions are now server-authoritative. Creation
produces an exact course-run draft. Assigned Teacher, department and
branch-scoped HOD, or Super Admin actions can update and publish it only with a
valid question set, future delivery window, and active class. Drafts and
cancelled quizzes never reach Student projections. Attempts are denied before
publication; updates, question-set changes, and cancellation are blocked after
attempts. Closing requires the due date or a reviewed attempt from every active
learner, while attempts and grades remain intact. Publish and close transitions
notify active learners and write scoped audit evidence. The focused Teacher
create, question-attachment, and detail workflow plus Student active and
closed-quiz states are included in the 1,317/0 baseline.

Manual assessment-review finalization is complete as a bounded compatibility
integrity slice. Assigned Teacher, department and branch-scoped HOD, or Super
Admin can finalize an exact pending assignment submission or quiz attempt once.
Missing, malformed, out-of-scope, and already-finalized reviews are rejected
before mutation; successful reviews preserve the result, gradebook, learner
notification, and scoped audit evidence. A manual quiz submission alerts the
assigned Teacher. The focused Teacher review detail and Student result state
are included in the 1,317/0 baseline. This closure does not change the separate
product-owner-directed Nile Forms phase or the Phase 2B durability gate.
Regrade and appeal workflows remain out of scope until a separate approval
defines their history and authority model.

Phase 2B remains the required durability gate before runtime session or
persistence activation.

Phase 2B remains a required open gate. Its manual acceptance must prove atomic
create/revoke, audit evidence, idempotent replay, conflict rejection, denial
rollback, browser-role denial, and `revoked_by` before any runtime activation.

No live provider connection, production runtime switch, remote schema
application, or broad UI expansion beyond the bounded Phase 12 Insight System
and explicitly approved Phase 13 route family is approved by this checkpoint.

Phase 13A Nile Forms authority and schema foundation is accepted locally. It
adds ADR-006, the feature prompt, permissions, shared bilingual schema and rule
contracts, seven fake templates, and an additive 12-table migration with forced
RLS and no browser policies. Static validation, two PGlite forward applications,
two assertion passes, one rollback drill, TypeScript, and the production build
pass. It has not been applied to Supabase.

Phase 13B Nile Forms online core is accepted locally. The compatibility-runtime
repository boundary, server-derived scope and permission gates, immutable
draft/publish behavior, public and assigned rendering, encrypted drafts,
assignments, submission inbox, one-stage review, CSV export, dedicated one-job
routes, and responsive EN/AR UI are implemented. TypeScript, 34 test files with
427 passing tests, production build, focused browser workflows, and the full
1,317-check portal matrix were executed. Three unrelated long-run legacy
workflow selector misses passed immediately in isolation; the accepted portal
baseline remains unchanged.

Phase 13C registered promotion adapters are accepted as an internal-alpha
foundation for `lead.create`, `application.create`, `placement.create`, support
tickets, and attendance exceptions. Promotions are reviewed, idempotent, and
audited; form answers never write operational tables directly. Existing enquiry,
application, placement, support, and attendance routes remain authoritative
until separate route-by-route parity and cutover approval.

Phase 13D Nile Forms staff-only offline capture is accepted locally. Staff
device enrollment, 72-hour assigned bundles, PBKDF2-HMAC-SHA-256 key derivation,
AES-256-GCM envelopes, encrypted IndexedDB credentials/bundles/answers, the
Forms-only service worker, foreground batch sync, replay receipts,
reauthorization, quarantine, expiry renewal, lock/reset recovery, and restricted
field denial are implemented. A real Branch Admin browser flow enrolled a
device, captured and encrypted an incident response, synchronized it, received
an accepted receipt, and found the immutable offline submission in the scoped
review inbox. Wrong-passphrase denial, EN/AR RTL rendering, and 390, 768, 1024,
1440, and 1920 responsive layouts passed without horizontal overflow.

Phase 13E finite Jotform migration support is accepted locally. A server-only
official-API client uses the `APIKEY` header and allowlisted standard, EU, or
HIPAA endpoints. Super Admin can inspect selected forms, map fields, record a
dry-run hash, commit only an unchanged preview, replay safely, and reconcile
each import record. Imported answers remain pinned to the selected Nile Forms
version, enter review as `legacy_import`, create no promotion or submission
outbox event, and retain source form, submission, payload hash, run, and
reconciliation evidence. A second additive migration brings the Forms total to
14 forced-RLS, service-only tables; two forward applications, two semantic
assertion passes, and the combined rollback drill pass in PGlite. The full local
suite now passes 37 files and 447 tests, TypeScript, production build, and the
expanded 1,501-check portal matrix with 0 failures. Focused offline and finite
migration browser QA also completed with no console errors.

No further Phase 13 runtime expansion is approved by this checkpoint. The
active modernization gate returns to **Phase 2B durable session database
acceptance**. Phase 13 remains internal alpha: no remote migration was applied,
no real Jotform credential or historical data was used, no existing intake
route was cut over, and normalized production Forms writes remain fail closed.
Actual selective import requires an approved mapping window, a temporary key,
reconciliation sign-off, Jotform intake shutdown, and key revocation. Uploads,
drawn signatures, broad directories, live provider sync, and arbitrary webhooks
remain prohibited.
