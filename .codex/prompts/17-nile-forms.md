# 17 Nile Forms

## SPEC

Implement one approved Nile Forms slice under `ADR-006` and the current
checkpoint in `docs/NILE_LEARN_MASTER_PLAN.md`.

Nile Forms is a schema-driven collection module, not a free-position form
designer, workflow canvas, quiz engine, payment surface, provider connector, or
generic application builder.

Before work, read the mandatory project guidance and the current checkpoint.
UI work also requires all Nile Learn design and information-architecture
contracts.

## AUTHORITY

- Super Admin owns global forms, permissions, retention, exports, and migration.
- Registrar owns admissions forms only in assigned branches.
- HOD owns academic-administration forms only in assigned departments and
  branches.
- Branch Admin owns branch operations forms only in assigned branches.
- Teacher and Student initially respond only.
- Derive actor, role, scope, assignment, and respondent from the server session.
- Never trust hidden fields or request-body actor, user, role, branch, department,
  provider, or expiry values as authority.

## DOMAIN

- Keep published versions immutable and pin drafts/submissions to one version.
- Validate structured fields, bounded values, translations, deterministic rules,
  forward-only page skips, and cycle rejection.
- Clear hidden values and ignore unknown values server-side.
- Use one-stage review and expected-revision conflict checks.
- Promote only through registered typed domain adapters with idempotency.
- Write audit evidence for publication, assignment, submission, review, export,
  migration, and promotion.

## ROUTES

- `/app/{role}/forms`: assigned forms.
- `/app/{role}/forms/manage`: scoped definitions.
- `/app/{role}/forms/manage/:formId/builder`: one draft version.
- `/app/{role}/forms/manage/:formId/publish`: preview and publication settings.
- `/app/{role}/forms/review`: scoped inbox.
- `/app/{role}/forms/review/:submissionId`: one submission review.
- `/app/{staff-role}/forms/offline`: one enrolled-device capture and sync queue.
- `/app/admin/forms/migration`: finite Jotform inspect, dry-run, import, and
  reconciliation evidence only.
- `/forms/:slug`: one public form.

Each route has one main job. The builder may contain page navigation, add-field,
reorder, field settings, logic, language, preview, and accessibility checks; it
must not contain the submission inbox or a general workflow canvas.

## OFFLINE AND MIGRATION

- Build online behavior before offline behavior.
- Offline is staff-only, publication-gated, encrypted, expiring, idempotent, and
  reauthorized on sync.
- Restricted data classes disable offline use.
- Jotform import uses a temporary server-only key, selected form mappings,
  immutable source hashes, reconciliation, and no automatic promotion.
- Do not enable uploads, drawn signatures, payments, arbitrary webhooks, Moodle
  writes, email, WhatsApp, or other live providers.

## VERIFY

Run focused schema/domain/server/UI tests, TypeScript, the full unit suite, build,
the relevant local schema gates, browser QA, and `scripts/verify.sh`. Preserve
the accepted 1,501/0 portal baseline unless an explicit reviewed count change is
approved.
