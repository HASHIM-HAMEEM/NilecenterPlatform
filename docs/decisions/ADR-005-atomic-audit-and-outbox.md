# ADR-005: Atomic Domain, Audit, And Outbox Writes

- Status: Accepted
- Date: 2026-07-10

## Context

The alpha snapshot can persist a domain change while optional event persistence
fails. This cannot provide trustworthy audit evidence or reliable provider
delivery.

## Decision

Every sensitive command executes in one Postgres transaction that writes:

1. the domain state transition;
2. an immutable audit row with actor, active role grant, request, entity, and
   before/after evidence;
3. an outbox row when asynchronous work or provider delivery is required.

The command and outbox use idempotency keys. Workers claim outbox rows with
bounded leases, classify errors, retry safely, and move exhausted work to a
dead-letter state. A successful domain transaction never depends on an
immediate provider response.

## Invariants

- Audit rows cannot be updated or deleted through application roles.
- Audit payloads exclude passwords, tokens, secrets, and unnecessary PII.
- Duplicate command or provider delivery keys cannot create duplicate effects.
- Failed transactions create no partial domain, audit, or outbox state.
- Outbox status changes never mutate the original event identity or payload.
- Audit and outbox JSON reject credential-shaped keys such as passwords,
  secrets, API keys, tokens, authorization headers, and cookies.
- Direct browser roles cannot read audit, session, outbox, integration, or
  migration base tables. Authorized views are served by scoped server APIs.
- Phase 1 uses a 365-day operational audit-retention default. Archival or legal
  hold behavior requires a later retention decision and cannot mutate rows.

## Consequences

Application services, not generic snapshot replacement, own production writes.
Retention or archival requires a separately audited administrative process.
