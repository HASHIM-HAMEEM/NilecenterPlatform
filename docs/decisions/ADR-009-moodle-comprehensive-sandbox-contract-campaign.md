# ADR-009: Comprehensive Synthetic Moodle Sandbox Contract Campaign

- Status: Accepted
- Date: 2026-07-13

## Context

M2 proved the approved 31-function read-service boundary and M2B proved one
reversible synthetic identity, enrolment, group, and membership workflow. Those
results do not prove course fixtures, learner interactions, outcomes, files, or
the provider behavior needed to design a production connector.

The product owner explicitly approved comprehensive read and write testing on
the dedicated practice host. The approval is for sandbox evidence only. It does
not change the production authority matrix, enable a Nile Learn runtime
connector, or permit real-person data.

## Decision

Run M2C as a sequence of isolated synthetic provider-contract lanes. Each lane
uses its own authorised-users-only service, non-interactive or synthetic
persona, exact function allowlist, expiring token, deterministic marker,
before-state fingerprint, replay and unknown-outcome reconciliation, ordered
cleanup, after-state fingerprint, and credential teardown proof.

The lanes are:

1. **Read closure**: create the missing Resource, SCORM, and H5P fixtures and
   prove all 31 approved reads through bounded sanitized read models.
2. **Content fixtures**: create, inspect, update, and remove one disposable
   synthetic course or course-content fixture set. Administrator browser use is
   allowed only for fixture setup and teardown; it is not a connector.
3. **Learner interactions**: prove synthetic assignment submission, quiz
   attempt, Lesson attempt, SCORM tracking, H5P attempt where supported, and
   manual completion behavior using learner-scoped services.
4. **Outcomes**: prove synthetic assignment grading, grade and feedback reads,
   completion reads, and report inputs using a separate teacher/outcome service.
5. **Operations evidence**: prove bounded synthetic Moodle message and calendar
   behavior only where cleanup and delivery side effects can be stated
   accurately. These remain Nile Learn-owned production features.
6. **Authority denials**: prove that attendance, certificates, Nile messaging,
   Nile schedules, admissions documents, and portal actions do not acquire
   Moodle write authority from this campaign.

No lane may widen the existing M2 read service or reuse the retired M2B write
credential. A service must contain only its reviewed lane functions. A denied
operation succeeding is a stop condition, not a reason to widen access.

## Data Boundary

Only generated learning identities and generated learning assets may enter the
sandbox. Synthetic text, image, audio, video, PDF, SCORM, H5P, and submission
files must contain no real names, contact details, institution records, or
licensed course content.

Student photographs, passports, national IDs, guardian documents, consent
evidence, addresses, admissions notes, finance records, medical records, and
real communication content remain prohibited. Their campaign test is a denied
export or schema-boundary test, never representative upload data.

## Authority Boundary

- Moodle remains the initial authority for Moodle-managed course structure,
  activities, attempts, grades, feedback, and completion.
- Nile Learn remains authoritative for identity grants, admissions,
  enrolments, class delivery, schedules, attendance, finance, certificates,
  messaging, audit, and all private student documents.
- Files and media remain metadata-only in Nile Learn until a production storage
  decision is accepted.
- Provider-contract evidence does not authorize direct portal-to-Moodle writes.

## Evidence And Cleanup

- Evidence is allowlisted and redacted: function names, synthetic external IDs,
  operation keys or digests, timestamps, counts, source hashes, outcomes,
  cleanup states, and teardown booleans only.
- Preserve ordered course sections and other semantically ordered collections
  in fingerprints. Sort only true sets. Record per-family hashes plus a combined
  root.
- Reconcile after every timeout or unknown outcome before retrying.
- Treat quiz, Lesson, SCORM, H5P, grade history, messages, and completion events
  as durable side effects even when visible state is restored.
- Use disposable fixtures where the provider has no dependable deletion API.
- Re-run cleanup to prove idempotency, remove every temporary capability edge,
  disable or delete every service user and service, revoke every token, and
  prove the final token is rejected.

## Stop Conditions

Stop the active lane and revoke its credentials if the host or version changes,
real data appears, the service exposes an unexpected function, normal login is
possible for a non-interactive account, a cross-course or cross-user operation
succeeds, a marker is ambiguous, a denied operation succeeds, an unknown
outcome cannot be reconciled, an unrelated hash changes, cleanup is incomplete,
or evidence contains a secret or private provider payload.

## Consequences

- M2C may improve clients, sanitized read models, validators, fixture tooling,
  and redacted evidence for the dedicated practice site.
- M2C does not activate M3 persistence, M4 portal projections, Phase 10 writes,
  a production runtime flag, remote Supabase changes, or any external provider
  in the Nile Learn application.
- Production promotion still requires normalized mappings, durable sessions,
  transactional command/audit/outbox records, worker leases, concurrency and
  replay proof, reconciliation approval, RLS, privacy review, and a separate
  production threat review.
