# ADR-004: Finite Legacy EMS Migration

- Status: Accepted
- Date: 2026-07-10

## Context

The old EMS is a functional discovery and migration source, not a safe long-term
integration contract. Recurring synchronization would preserve ambiguous
ownership and legacy defects.

## Decision

Legacy EMS data moves to Nile Learn through one-way, entity-by-entity migration
runs. Every run records the source watermark, immutable payload hash, mapping,
match result, exception, counts, approval, and rollback evidence.

The sequence is dry run, data-quality report, human reconciliation, approved
import, final delta import, cutover, rollback window, and credential retirement.
There is no EMS writeback and no recurring synchronization after cutover.

## Invariants

- Dry-run, approved-import, and final-delta stages may each retain evidence for
  the same source row. Effects are idempotent by source system, entity type,
  external ID, and immutable source hash: one source version is applied at most
  once, while a later source hash is an explicit delta against the same durable
  mapping.
- Ambiguous identity, relationship, or financial matches never auto-merge.
- Rejected and corrected source rows remain traceable.
- Counts, relationships, balances, and sampled records require approval.
- Migration credentials are server-only and retired after cutover.

## Consequences

The migration reader may be disposable. External mapping and audit evidence
remain durable after the legacy system is retired.
