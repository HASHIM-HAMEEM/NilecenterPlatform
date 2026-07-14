# QA Baseline

Nile Learn is currently in internal alpha stabilization. The protected portal QA baseline is:

- Portal QA: 1,598 checks, 0 failures.
- Checked at: `2026-07-13T13:19:02.018Z`.
- Validation command: `QA_BASE_URL=http://127.0.0.1:3061 QA_OUTPUT_DIR=output/playwright/forms-program-final-matrix-c-20260713 QA_SESSION=forms-program-final-matrix-c-20260713 npm run qa:portals`.
- QA summary artifact:
  `output/playwright/forms-program-final-matrix-c-20260713/portal-qa-summary.json`.

`docs/NILE_LEARN_MASTER_PLAN.md` defines the next architecture phases, and
`docs/MODERNIZATION_EXECUTION_CONTRACT.md` defines how this baseline is
protected during each slice.

## Latest Preservation Evidence

The accepted count was intentionally expanded after dedicated Forms creation,
publication-history, and assignment routes were added to the role matrices and
the complete route, workflow, denial, accessibility, responsive, and console
checks passed:

- Checked at: `2026-07-13T13:19:02.018Z`.
- QA summary artifact:
  `output/playwright/forms-program-final-matrix-c-20260713/portal-qa-summary.json`.
- Result: 1,598 checks, 0 failures in 1,294,206 ms.
- Supporting validation: all static and portable PostgreSQL gates passed, 528
  unit tests passed across 47 files, TypeScript passed, and the production build
  passed through `SKIP_PORTAL_QA=1 scripts/verify.sh`.
- Sequential data, security, UI/accessibility, and workflow reviews closed with
  no remaining high or medium finding.

This is the current protected baseline. The previous 1,509/0 evidence remains
below as historical acceptance for the earlier route matrix.

## Moodle M2B Preservation Evidence

The synthetic Moodle sandbox write proof did not replace the accepted
single-run `1,598/0` baseline. After all non-browser verification gates passed,
an external process `SIGTERM` interrupted the first browser run and the QA
runner correctly recorded the interruption as a failure. The same complete
coverage was then partitioned with the runner's existing role filter across
isolated servers and data directories:

- Public Nile Forms and role denials: 20 checks, 0 failures.
- Student: 363 checks, 0 failures.
- Teacher: 349 checks, 0 failures.
- Registrar and HOD: 591 checks, 0 failures.
- Branch Admin and Super Admin: 696 checks, 0 failures.

The 2,019 executed checks include repeated common public, authentication, and
shell assertions in each shard. The evidence therefore preserves, but does not
renumber, the official baseline. Exact artifacts and provider cleanup evidence
are recorded in `docs/moodle-m2b-write-proof-evidence-20260713.md`.

## Moodle M2C-R Preservation Evidence

The partial M2C-R provider-contract run did not change the accepted application
baseline. After sandbox cleanup and credential teardown, the full repository
gate completed in one run:

- QA summary artifact:
  `output/playwright/moodle-m2c-read-partial-20260713/portal-qa-summary.json`.
- Portal QA: 1,598 checks, 0 failures.
- Supporting validation: all static and portable PostgreSQL, session, and Nile
  Forms gates passed; 572 unit tests passed across 50 files; TypeScript and the
  production build passed.

The provider result remains partial at 26/31 because H5P and SCORM fixtures are
not available. The exact provider boundary, cleanup, and stop decision are
recorded in `docs/moodle-m2c-read-closure-evidence-20260713.md`.

## Previous 1,509 Preservation Evidence

The previous accepted count was expanded after Nile Forms online, registered promotion,
offline, and finite-migration routes were verified with the existing academic,
delivery, attendance, linked-admissions, and assignment-publication regression
suite:

- Checked at: `2026-07-12T11:58:47Z`.
- Validation command:
  `QA_OUTPUT_DIR=output/playwright/moodle-read-foundation-20260712 QA_PORT=3052 QA_SESSION=moodle-read-foundation-20260712 scripts/verify.sh`.
- QA summary artifact:
  `output/playwright/moodle-read-foundation-20260712/portal-qa-summary.json`.
- Result: 1,509 checks, 0 failures.
- Supporting validation: TypeScript passed, 478 unit tests passed across 40
  files, and the
  production build passed. The repository verification gate is recorded
  separately after this evidence update.

The previously accepted frozen run recorded an identical source fingerprint
before and after its complete browser matrix. The HOD certificate workflow also
passed its focused `6/6` rerun before that matrix completed, so the prior
same-route transient `Not Found` miss is not recorded as a product failure.

The expanded checks verify that Student management/review access is denied,
Registrar cannot manage a global Super Admin form, denied builder/publish URLs
render an actionable scoped state, and Super Admin can assign then revoke one
authorized publication recipient through the browser UI. A route-matrix chunk
may retry once after a missing-shell crash; the retry repeats every assertion,
retains diagnostics, and does not convert a persistent failure into a pass.

This evidence proves regression preservation for exact enrollment assignment,
active delivery gates, registrar branch scope, attendance session state,
branch-scoped class creation and updates, HOD-scoped course-run creation,
room/capacity/schedule constraints, enrollment transfer and status transitions,
atomic roster membership, class-session rescheduling and cancellation,
attendance-history locks, learner notifications, and scoped audit projection in
the compatibility state. It also proves exact attendance-exception submission,
branch-scoped approval/rejection, atomic excused-status and attendance-rate
updates, and role-scoped exception/audit projections. It does not prove a
production durable-session activation, remote Supabase promotion, or normalized
workflow persistence. Assignment creation now produces an exact course-run
draft; assigned Teacher and scoped HOD or Super Admin actions can edit and
publish it, only published or completed rows reach Student projections, terminal
and submission guards preserve history, and publish/cancel/close transitions
write learner notifications and scoped audit evidence. It does not prove a
Moodle assignment sync or production normalized assignment persistence.
Quiz creation now produces an exact course-run draft; question-set, future
delivery-window, and active-class checks guard publication; student attempts
are denied before publication; and cancellation or editing is locked after an
attempt. Closed quizzes retain attempts and grades, while the Student view is
read-only. This does not prove a Moodle quiz sync or production normalized quiz
persistence.

Assignment and manual-quiz reviews now finalize exact pending submissions and
attempts once. Missing, malformed, out-of-scope, and already-finalized reviews
are rejected before mutation. A successful review preserves the result,
gradebook entry, learner notification, and scoped audit evidence; a manual quiz
submission also alerts the assigned Teacher. Regrade and appeal history remain
outside this baseline until a separate authority model is approved.

## What This Baseline Proves

- The accepted route matrix and portal workflows completed without a recorded
  failure in the controlled alpha fixture.
- The current portal run completed at 1,598/0. TypeScript, 528 unit tests, and
  the production build passed as separate supporting gates.
- The previous frozen portal run completed at 1,509/0 and remains historical
  evidence for its earlier source fingerprint.
- The tested role routes, actions, labels, and responsive assertions matched the
  current product contract.

## What This Baseline Does Not Prove

- Production-scale correctness or real legacy EMS parity.
- A live Moodle data projection, provider reconciliation, or production token.
- A completed legacy EMS migration, cutover, or balance reconciliation.
- Durable sessions across instances and deployments.
- Normalized Postgres authority, RLS coverage, concurrent-write safety, or
  transaction rollback.
- Atomic domain, audit, and outbox persistence.
- Delivery through payment, email/SMS/WhatsApp, meeting, or media providers.
- Security of credentials that were exposed outside the repository.

These require separate phase-specific evidence. A green portal run must never
be used to claim that an unimplemented provider or persistence boundary works.

Admin governance is now separated across focused Simple UI routes:

- `/app/admin/roles` for role overview and role summaries.
- `/app/admin/permissions` for access rules and permission editing.
- `/app/admin/branches` for branch management.

Admin reports are now separated across focused report routes:

- `/app/admin/reports` for report overview.
- `/app/admin/reports/attendance` for attendance records.
- `/app/admin/reports/finance` for payment and invoice rows.
- `/app/admin/reports/certificates` for certificate status rows.
- `/app/admin/reports/admissions` for leads, applications, and placement rows.
- `/app/admin/reports/classes` for class-group rows.
- `/app/admin/reports/saved-views` for saved report filters.

The generic `FeaturePage` fallback route table has been reduced so routes already owned by Simple UI pages or dedicated workflow pages do not keep duplicate fallback entries.

Admin courses now follows the Simple UI split:

- `/app/admin/courses` for the course catalog and status workflow.
- `/app/admin/courses/:courseId` for one course record and its relationships.
- `/app/admin/courses/programs`, `/levels`, `/curriculum`, `/teachers`, and `/resources` for their focused course-governance lists.

Admin activity now follows the Simple UI split:

- `/app/admin/audit-logs` for search, action filtering, latest activity context, and audit CSV export.

Admin health now follows the Simple UI split:

- `/app/admin/system-health` for readiness checks, system signals, and the audited health-check action.

Admin settings and connections now follow the Simple UI split:

- `/app/admin/settings` for global platform configuration, retention, language, and audited settings saves.
- `/app/admin/integrations` for connection status review, local provider checks, and integration audit rows. Live providers remain placeholders.

Registrar students now follows the Simple UI split:

- `/app/registrar/students` for direct student creation and student records.
- `/app/registrar/students/:studentId` for one student lifecycle record, status, placement, enrollment, and audit context.

Registrar admissions now follows the Simple UI split:

- `/app/registrar/leads` and `/app/registrar/leads/:leadId` for enquiry intake and lead conversion.
- `/app/registrar/applications` and `/app/registrar/applications/:applicationId` for application intake and enrollment handoff preparation.
- `/app/registrar/placement-tests` and `/app/registrar/placement-tests/:bookingId` for placement booking and result recording.

Registrar payments now follows the Simple UI split:

- `/app/registrar/payments` for invoice search, balance review, and receipt recording.

Registrar enrollments now follows the Simple UI split:

- `/app/registrar/enrollments` for assignment handoff, course run selection, class selection, and portal activation.

Registrar schedule now follows the Simple UI split:

- `/app/registrar/schedule` for placement, trial, and admissions event booking.

Registrar classes now follows the Simple UI split:

- `/app/registrar/classes` for class capacity, branch-scoped assignment visibility, and enrollment readiness.

Branch rooms now follows the Simple UI split:

- `/app/branch/rooms` for branch-scoped room readiness, room status updates, and room creation.

Branch payments now follows the Simple UI split:

- `/app/branch/payments` for branch-scoped invoice review, balance status, and internal payment recording.

Branch reports now follows the Simple UI split:

- `/app/branch/reports` for branch-scoped attendance, finance, enrollment rows, saved views, and CSV export.

Branch schedule now follows the Simple UI split:

- `/app/branch/schedule` for branch-scoped event booking, room/class selection, schedule review, and class-session creation.

Branch attendance now follows the Simple UI split:

- `/app/branch/attendance` for branch-scoped roster attendance, session filters, status marking, notes, and save state.

HOD reports now use a dedicated route owner:

- `/app/hod/reports` for department-scoped academic reports, saved report views, and CSV export.

HOD workflow routes now use a dedicated route owner:

- `/app/hod/courses` for department-scoped course status review.
- `/app/hod/curriculum` for module creation and curriculum review.
- `/app/hod/schedule` for academic schedule review.
- `/app/hod/assessments` for department-scoped assessment creation, grading, and review.
- `/app/hod/certificates` for certificate approval, rejection, issue checks, and verification context.

Teacher assignment routes now use a dedicated route owner:

- `/app/teacher/assignments` for the assignment list.
- `/app/teacher/assignments/new` for one assignment create flow.
- `/app/teacher/assignments/:assignmentId` for one assignment record and submission review context.

Student assessment detail routes now use a dedicated route owner:

- `/app/student/assignments/:assignmentId` for one assignment submission.
- `/app/student/quizzes/:quizId` for one quiz attempt.

This baseline must remain clean for future changes. If a task changes UI, workflows, routes, RBAC, domain actions, or server action gates, run validation and confirm the portal QA result before reporting completion.

## Required Discipline

- Keep each change small and scoped.
- Do not change unrelated routes, tests, or business logic.
- Preserve RBAC and server-side action gates.
- Preserve audit logging for workflow mutations.
- Update tests or portal QA only when product behavior intentionally changes.
- Do not integrate external systems until internal workflows and data architecture are stable.

## Reporting

Every implementation report must include:

- exact files changed
- exact commands run
- validation result
- whether portal QA remains clean
