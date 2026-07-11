# 16 Modernization Execution

## SPEC

Execute one approved Nile Learn modernization slice from
`docs/NILE_LEARN_MASTER_PLAN.md`.

Read the current checkpoint and only approved next slice from
`docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization Checkpoint**.
Do not infer a slice from this prompt or copy phase status into it. Do not
switch runtime defaults, apply remote migrations, or start normalized workflow
persistence unless that checkpoint explicitly approves the work.

Before work, read:

- `CLAUDE.md`
- `AGENTS.md`
- `docs/NILE_LEARN_MASTER_PLAN.md`
- `docs/MODERNIZATION_EXECUTION_CONTRACT.md`
- the matching feature or portal prompt

For UI work, also read `DESIGN.md`, `docs/DESIGN_V2.md`, and
`docs/SIMPLE_UI.md`.

## PLAN

- Name the master-plan phase and bounded slice.
- Identify the role, route, authority, domain transition, RBAC scope, audit
  event, UI states, write set, tests, reviewers, and rollback.
- Record the clean baseline and accepted portal QA artifact.
- Stop before implementation if source ownership or product behavior is
  unresolved.

## IMPLEMENT

- Use one primary writer and the smallest coherent diff.
- Keep shared authority files serialized.
- Preserve current behavior outside the approved slice.
- Add focused tests with the implementation.
- Do not enable live providers or production data behavior unless the named
  master-plan phase is explicitly approved.

## VERIFY

Follow every gate in `docs/MODERNIZATION_EXECUTION_CONTRACT.md`.

At minimum, run the affected tests plus:

- `npm run check`
- `npm test -- --run`
- `npm run build`

Run `scripts/verify.sh` when routes, workflows, RBAC, persistence, shared UI, or
portal behavior can change. Preserve the accepted 1,317/0 portal QA baseline.

## REVIEW

Use only the reviewers relevant to the slice: UI, QA, RBAC, data, or security.
Reviewers stay read-only unless assigned an explicit fix and disjoint write set.

## FIX

- Fix validated findings with the smallest relevant patch.
- Rerun the failing focused check, then the required integrated checks.
- Do not lower expectations or weaken action gates.

## DOCUMENT

Update the relevant workflow, architecture, QA, migration, or integration
document when behavior or authority changes.

## RETURN

Report the completion evidence required by
`docs/MODERNIZATION_EXECUTION_CONTRACT.md`. State clearly whether the slice is
complete, partial, or blocked.
