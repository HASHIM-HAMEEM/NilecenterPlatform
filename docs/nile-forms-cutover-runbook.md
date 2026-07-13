# Nile Forms Cutover Runbook

## Purpose

Nile Forms can replace the existing enquiry, application, placement, student
support, and attendance-exception entry points without deleting their current
implementations. The route switch is deliberately fail-closed.

## Current State

- `VITE_NILE_FORMS_CUTOVER_ENABLED` defaults to `0`.
- The existing entry routes remain active while the flag is disabled.
- Direct Nile Forms routes remain available for internal-alpha testing.
- The compatibility repository remains an internal-alpha boundary and is not a
  production source of truth.
- Jotform migration is finite and read-only. Imported records do not trigger
  promotions.

## Required Promotion Gate

Do not enable the route switch in a deployed environment until all of these are
true:

1. The approved durable Forms repository replaces the in-memory compatibility
   repository for definitions, versions, publications, assignments, drafts,
   submissions, reviews, promotions, audit evidence, and outbox events.
2. The Forms schema forward, assertion, rollback, and reapply checks pass
   against an isolated environment.
3. Promotion adapters have durable command idempotency and atomic evidence for
   every enabled adapter.
4. Public rate limits, server-derived scope, RBAC denials, immutable versions,
   draft security, review conflicts, and export boundaries pass their tests.
5. Enquiry, application, placement, support, and attendance parity is accepted
   route by route.
6. Responsive EN/AR, RTL, keyboard, loading, empty, error, success, and mobile
   behavior is verified through the Codex in-app Browser.
7. The reviewed portal QA baseline remains green or is intentionally replaced
   by a reviewed higher-count baseline.

## Enablement Order

Enable one entry flow at a time in this order:

1. Free-trial enquiry: `/book-free-trial`.
2. Course application: `/apply`.
3. Placement request: `/book-placement-test`.
4. Student support request: `/app/student/support/new`.
5. Attendance exception from the student attendance workspace.

For each flow, verify submission, scoped review, acceptance, promotion,
idempotent replay, audit evidence, and the resulting typed domain entity before
moving to the next flow.

## Rollback

Set `VITE_NILE_FORMS_CUTOVER_ENABLED=0` and redeploy the frontend. The existing
entry implementations remain in the codebase, so rollback does not require a
data rewrite. Keep already-created Nile Forms submissions and promotion
evidence immutable for reconciliation.

Do not remove the previous entry implementations until every flow has passed
the production observation window and a separate removal change is approved.
