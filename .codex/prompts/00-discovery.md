# 00 Discovery

## SPEC

Understand the current Nile Learn repository and the approved modernization
phase before implementing any slice.

## PLAN

- Read `CLAUDE.md`, `AGENTS.md`, `docs/NILE_LEARN_MASTER_PLAN.md`, and
  `docs/MODERNIZATION_EXECUTION_CONTRACT.md`.
- Inspect `package.json`, `client/src`, `server`, `shared`, `supabase`,
  `scripts`, and the matching feature prompt.
- Identify routes, roles, data authority, domain models, repositories, action
  gates, design files, tests, and available validation commands.
- Treat `docs/legacy-ems-discovery.md` as evidence, not product authority, and
  `docs/production-persistence-architecture.md` as the detailed persistence
  companion to the master plan.
- Name the master-plan phase, bounded slice, write set, and baseline evidence.

## IMPLEMENT

- Do not implement product changes during discovery unless explicitly asked.
- Produce an authority, route, data, action, component, and test map.
- Stop if source ownership, role scope, migration direction, or provider
  authority is unresolved.
- Identify the next approved slice, not merely the largest missing feature.

## VERIFY

- Record branch, worktree status, and accepted portal QA artifact first.
- Run read-only checks first.
- Use `npm run check`, `npm test -- --run`, and `npm run build` only after edits.

## REVIEW

- Use only the data, security, RBAC, QA, or UI reviewers relevant to the slice.
- Keep reviewers read-only until an explicit fix and write set is assigned.

## FIX

- Patch only concrete issues found during implementation.

## DOCUMENT

- Update the owning architecture, workflow, migration, QA, UI, or prompt file
  when verified knowledge changes. Do not duplicate the rule in every guide.
