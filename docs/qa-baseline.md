# QA Baseline

Nile Learn is currently in internal alpha stabilization. The protected portal QA baseline is:

- Portal QA: 1,163 checks, 0 failures.
- Checked at: `2026-07-07T22:00:33.555Z`.
- Validation command: `QA_OUTPUT_DIR=output/playwright/codex-admin-governance-fix-verify-final QA_PORT=3015 scripts/verify.sh`.
- QA summary artifact: `output/playwright/codex-admin-governance-fix-verify-final/portal-qa-summary.json`.

Admin governance is now separated across focused Simple UI routes:

- `/app/admin/roles` for role overview and role summaries.
- `/app/admin/permissions` for access rules and permission editing.
- `/app/admin/branches` for branch management.

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
