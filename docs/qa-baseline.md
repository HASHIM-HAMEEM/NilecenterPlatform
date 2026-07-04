# QA Baseline

Nile Learn is currently in internal alpha stabilization. The protected portal QA baseline is:

- Portal QA: 921 checks, 0 failures.
- Validation command: `scripts/verify.sh`.
- QA summary artifact: `output/playwright/portal-qa-summary.json`.

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

