# Nile Learn Architecture Decisions

These records lock the production-foundation decisions referenced by
`docs/NILE_LEARN_MASTER_PLAN.md`. They are implementation constraints, not
runtime changes.

| Decision                                               | Status   | Scope                                               |
| ------------------------------------------------------ | -------- | --------------------------------------------------- |
| [ADR-001](ADR-001-system-authority.md)                 | Accepted | Nile Learn, Moodle, and legacy EMS authority        |
| [ADR-002](ADR-002-durable-sessions-and-role-grants.md) | Accepted | Identity mapping, role grants, scopes, and sessions |
| [ADR-003](ADR-003-moodle-read-projection.md)           | Accepted | Read-only Moodle projection and reconciliation      |
| [ADR-004](ADR-004-finite-legacy-ems-migration.md)      | Accepted | One-way EMS migration and cutover                   |
| [ADR-005](ADR-005-atomic-audit-and-outbox.md)          | Accepted | Transactional domain, audit, and outbox writes      |
| [ADR-006](ADR-006-nile-forms-authority.md)             | Accepted | Structured forms, review, promotion, and migration  |

Changing an accepted decision requires a superseding ADR, affected threat and
data review, rollback plan, updated tests, and explicit approval. Do not edit an
accepted ADR to hide an architectural change.
