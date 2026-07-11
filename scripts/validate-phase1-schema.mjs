import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const draftPath = path.join(
  root,
  "docs/supabase-phase-1-identity-session-rls-draft.sql"
);
const rollbackPath = path.join(
  root,
  "docs/supabase-phase-1-identity-session-rls-rollback.sql"
);
const assertionsPath = path.join(
  root,
  "docs/supabase-phase-1-identity-session-rls-assertions.sql"
);
const migrationsDir = path.join(root, "supabase/migrations");
const phase1MigrationFiles = readdirSync(migrationsDir).filter(file =>
  file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);

if (phase1MigrationFiles.length !== 1) {
  throw new Error(
    `Expected exactly one promoted Phase 1 migration, found ${phase1MigrationFiles.length}`
  );
}

const migrationPath = path.join(migrationsDir, phase1MigrationFiles[0]);
const seedPath = path.join(root, "supabase/seed.sql");
const manualMigrationPath = path.join(
  root,
  "supabase/manual/001_phase1_identity_scope_session_audit_mapping.sql"
);
const manualSeedPath = path.join(root, "supabase/manual/100_fake_seed.sql");
const manualRollbackPath = path.join(
  root,
  "supabase/manual/902_phase1_rollback.sql"
);
const manualVerificationPath = path.join(
  root,
  "supabase/manual/200_install_verification.sql"
);

const draft = readFileSync(draftPath, "utf8");
const rollback = readFileSync(rollbackPath, "utf8");
const assertions = readFileSync(assertionsPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const seed = readFileSync(seedPath, "utf8");
const manualMigration = readFileSync(manualMigrationPath, "utf8");
const manualSeed = readFileSync(manualSeedPath, "utf8");
const manualRollback = readFileSync(manualRollbackPath, "utf8");
const manualVerification = readFileSync(manualVerificationPath, "utf8");

if (migration !== draft) {
  throw new Error(
    "Promoted Phase 1 migration differs from the reviewed SQL draft"
  );
}

if (manualMigration !== migration) {
  throw new Error("Manual Phase 1 SQL differs from the promoted migration");
}
if (manualSeed !== seed) {
  throw new Error("Manual fake seed differs from supabase/seed.sql");
}
if (manualRollback !== rollback) {
  throw new Error("Manual Phase 1 rollback differs from the reviewed rollback");
}

for (const marker of [
  "student@nilelearn.local",
  "teacher@nilelearn.local",
  "registrar@nilelearn.local",
  "hod@nilelearn.local",
  "branch@nilelearn.local",
  "admin@nilelearn.local",
]) {
  if (!seed.includes(marker)) {
    throw new Error(`Local Phase 1 seed marker is missing: ${marker}`);
  }
}

if (seed.includes("encrypted_password")) {
  throw new Error("Local Phase 1 seed must not embed password material");
}

const expectedTables = [
  "branches",
  "app_users",
  "departments",
  "department_branches",
  "permissions",
  "role_permissions",
  "role_grants",
  "role_grant_branch_scopes",
  "role_grant_department_scopes",
  "staff_profiles",
  "staff_subjects",
  "auth_sessions",
  "command_executions",
  "audit_logs",
  "outbox_events",
  "integration_connections",
  "integration_env_requirements",
  "external_records",
  "sync_cursors",
  "sync_runs",
  "sync_run_items",
  "reconciliation_cases",
  "migration_runs",
  "migration_run_items",
  "migration_evidence",
];

const browserReadableTables = [];

const sensitiveTables = expectedTables.filter(
  table => !browserReadableTables.includes(table)
);

function fail(message) {
  throw new Error(message);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function assertSameSet(label, actual, expected) {
  const normalizedActual = unique(actual);
  const normalizedExpected = unique(expected);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    fail(
      `${label} mismatch\nactual: ${normalizedActual.join(", ")}\nexpected: ${normalizedExpected.join(", ")}`
    );
  }
}

function tableNamesFromBlock(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) fail(`${label} block is missing`);
  return [...match[1].matchAll(/public\.([a-z][a-z0-9_]*)/g)].map(
    entry => entry[1]
  );
}

const createdTables = [
  ...draft.matchAll(/create table public\.([a-z][a-z0-9_]*)/g),
].map(entry => entry[1]);
const droppedTables = [
  ...rollback.matchAll(/drop table public\.([a-z][a-z0-9_]*)/g),
].map(entry => entry[1]);

assertSameSet("Phase 1 created tables", createdTables, expectedTables);
assertSameSet("Phase 1 rollback tables", droppedTables, expectedTables);

for (const table of expectedTables) {
  if (
    !draft.includes(`alter table public.${table} enable row level security;`)
  ) {
    fail(`RLS enable statement missing for public.${table}`);
  }
  if (
    !draft.includes(`alter table public.${table} force row level security;`)
  ) {
    fail(`RLS force statement missing for public.${table}`);
  }
}

const revokedTables = tableNamesFromBlock(
  draft,
  /revoke all on table\s+([\s\S]*?)\s+from public, anon, authenticated;/,
  "Browser revoke"
);
const serviceTables = tableNamesFromBlock(
  draft,
  /grant select, insert, update, delete on table\s+([\s\S]*?)\s+to service_role;/,
  "service_role grant"
);
assertSameSet("Browser revokes", revokedTables, expectedTables);
assertSameSet("service_role grants", serviceTables, expectedTables);

if (
  !draft.includes(
    "revoke all on sequence public.audit_logs_id_seq\nfrom public, anon, authenticated;"
  )
) {
  fail("Browser revoke is missing for public.audit_logs_id_seq");
}

if (
  !draft.includes(
    "grant usage, select on sequence public.audit_logs_id_seq to service_role;"
  )
) {
  fail("service_role sequence grant is missing for public.audit_logs_id_seq");
}

for (const resolver of [
  "public.resolve_login_authority(uuid, text)",
  "public.resolve_auth_session_authority(text)",
]) {
  if (
    !draft.includes(
      `revoke all on function ${resolver}\nfrom public, anon, authenticated;`
    )
  ) {
    fail(`Browser function revoke is missing for ${resolver}`);
  }
  if (
    !draft.includes(`grant execute on function ${resolver}\nto service_role;`)
  ) {
    fail(`service_role function grant is missing for ${resolver}`);
  }
}

const authenticatedSelects = [
  ...draft.matchAll(
    /grant select on public\.([a-z][a-z0-9_]*) to authenticated;/g
  ),
].map(entry => entry[1]);
assertSameSet(
  "Authenticated read-only grants",
  authenticatedSelects,
  browserReadableTables
);

for (const table of sensitiveTables) {
  if (authenticatedSelects.includes(table)) {
    fail(`Sensitive table public.${table} is browser-readable`);
  }
}

const policyTables = [
  ...draft.matchAll(
    /create policy [a-z][a-z0-9_]*\s+on public\.([a-z][a-z0-9_]*)/g
  ),
].map(entry => entry[1]);
assertSameSet("Browser policy tables", policyTables, browserReadableTables);

const assertionTablesMatch = assertions.match(
  /required_tables text\[\] := array\[([\s\S]*?)\];/
);
if (!assertionTablesMatch) fail("Assertion table inventory is missing");
const assertionTables = [
  ...assertionTablesMatch[1].matchAll(/'([a-z][a-z0-9_]*)'/g),
].map(entry => entry[1]);
assertSameSet("Assertion tables", assertionTables, expectedTables);

const manualVerificationTablesMatch = manualVerification.match(
  /required_tables text\[\] := array\[([\s\S]*?)\];/
);
if (!manualVerificationTablesMatch)
  fail("Manual verification table inventory is missing");
const manualVerificationTables = [
  ...manualVerificationTablesMatch[1].matchAll(/'([a-z][a-z0-9_]*)'/g),
].map(entry => entry[1]);
assertSameSet(
  "Manual verification tables",
  manualVerificationTables,
  expectedTables
);

for (const marker of [
  "begin read only;",
  "create_auth_session_with_evidence",
  "revoke_auth_session_with_evidence",
  "verified_table_count",
]) {
  if (!manualVerification.includes(marker)) {
    fail(`Manual verification marker is missing: ${marker}`);
  }
}

const forbiddenLegacyNames = [
  "public.user_roles",
  "public.staff_branch_scopes",
  "public.staff_department_scopes",
  "public.app_sessions",
  "nile_private.current_app_user_id",
  "nile_private.current_role_grant_ids",
  "nile_private.current_branch_scope_ids",
  "nile_private.current_department_scope_ids",
];
for (const legacyName of forbiddenLegacyNames) {
  if (draft.includes(legacyName)) {
    fail(`Superseded Phase 1 name remains: ${legacyName}`);
  }
}

const securityDefinerFunctions = [
  ...draft.matchAll(
    /create function nile_private\.([a-z][a-z0-9_]*)\([^)]*\)([\s\S]*?)\$\$;/g
  ),
]
  .filter(entry => entry[2].includes("security definer"))
  .map(entry => ({ name: entry[1], body: entry[2] }));

for (const fn of securityDefinerFunctions) {
  if (!fn.body.includes("set search_path = ''")) {
    fail(`Security-definer function ${fn.name} lacks an empty search_path`);
  }
}

const requiredIndexes = [
  "department_branches_branch_idx",
  "role_permissions_permission_idx",
  "role_permissions_updated_by_idx",
  "role_grants_user_effective_idx",
  "role_grants_granted_by_idx",
  "role_grants_revoked_by_idx",
  "role_grant_branch_scopes_grant_idx",
  "role_grant_branch_scopes_branch_idx",
  "role_grant_branch_scopes_granted_by_idx",
  "role_grant_department_scopes_grant_idx",
  "role_grant_department_scopes_department_idx",
  "role_grant_department_scopes_granted_by_idx",
  "auth_sessions_user_active_idx",
  "auth_sessions_user_id_idx",
  "auth_sessions_expires_at_idx",
  "auth_sessions_revoked_at_idx",
  "auth_sessions_grant_user_idx",
  "auth_sessions_revoked_by_idx",
  "command_executions_actor_started_idx",
  "command_executions_session_actor_idx",
  "command_executions_role_actor_idx",
  "audit_logs_actor_time_idx",
  "audit_logs_entity_time_idx",
  "audit_logs_role_actor_idx",
  "audit_logs_command_authority_idx",
  "audit_logs_session_idx",
  "audit_logs_branch_time_idx",
  "audit_logs_department_time_idx",
  "audit_logs_retention_idx",
  "outbox_events_claim_idx",
  "outbox_events_command_idx",
  "integration_connections_created_by_idx",
  "integration_connections_updated_by_idx",
  "external_records_sync_state_idx",
  "sync_runs_connection_time_idx",
  "sync_runs_created_by_idx",
  "sync_run_items_external_record_idx",
  "reconciliation_cases_status_idx",
  "reconciliation_cases_resolved_by_idx",
  "migration_runs_connection_time_idx",
  "migration_runs_approved_by_idx",
  "migration_runs_created_by_idx",
  "migration_run_items_run_source_idx",
  "migration_run_items_external_source_idx",
  "migration_run_items_one_import_uidx",
  "migration_evidence_recorded_by_idx",
];

for (const indexName of requiredIndexes) {
  if (!draft.includes(`index ${indexName}`)) {
    fail(`Required foreign-key or authority index ${indexName} is missing`);
  }
}

if (!draft.includes("before update or delete on public.audit_logs")) {
  fail("Immutable audit trigger is missing");
}
if (!draft.includes("Legacy EMS writeback is prohibited")) {
  fail("Legacy EMS writeback guard is missing");
}
if (!draft.includes("Outbox event identity and payload are immutable")) {
  fail("Outbox identity guard is missing");
}
if (!draft.includes("create function nile_private.resolve_auth_session")) {
  fail("Authoritative durable-session resolver is missing");
}
if (!draft.includes("create constraint trigger command_evidence_required")) {
  fail("Atomic command audit/outbox evidence trigger is missing");
}
if (
  !draft.includes(
    "create constraint trigger migration_cutover_evidence_required"
  )
) {
  fail("Migration cutover evidence trigger is missing");
}
if (!draft.includes("create trigger external_records_preserve_identity")) {
  fail("Durable external mapping immutability trigger is missing");
}
if (
  !draft.includes("provider <> 'moodle' or mode in ('disabled', 'read_only')")
) {
  fail("Moodle read-only authority constraint is missing");
}
if (!draft.includes("auth_user_id is not null or status = 'invited'")) {
  fail("Auth mapping lifecycle constraint is missing");
}
if (!draft.includes("create trigger app_users_preserve_identity")) {
  fail("Established Auth mapping immutability trigger is missing");
}
if (!draft.includes("retention_until timestamptz not null default")) {
  fail("365-day operational audit retention marker is missing");
}
if (draft.includes("grant usage on schema nile_private to authenticated")) {
  fail("Authenticated browser role can access the private authority schema");
}
if (!draft.includes("Do not apply this file")) {
  fail("Planning-only warning is missing from the draft");
}
if (!rollback.includes("Never use this as a production data rollback")) {
  fail("Production rollback warning is missing");
}
if (!rollback.includes("drop schema nile_private cascade;")) {
  fail("Rollback does not remove the Phase 1 private schema as one owned unit");
}
if (!assertions.includes("set local role authenticated;")) {
  fail("Authenticated RLS behavior assertion is missing");
}
for (const assertionMarker of [
  "A revoked active role grant still resolved an application session",
  "Successful command without audit evidence was accepted",
  "The same EMS source version produced duplicate imported effects",
  "Authenticated browser read server-only table",
]) {
  if (!assertions.includes(assertionMarker)) {
    fail(`Required semantic assertion is missing: ${assertionMarker}`);
  }
}
if (!assertions.trimEnd().endsWith("rollback;")) {
  fail("Assertion fixtures are not transactionally rolled back");
}

for (const compatibilityTable of [
  "platform_records",
  "platform_demo_entities",
  "platform_state_snapshots",
  "platform_events",
]) {
  const destructivePattern = new RegExp(
    `(?:drop|alter|truncate|delete\\s+from)\\s+(?:table\\s+)?public\\.${compatibilityTable}`,
    "i"
  );
  if (destructivePattern.test(draft) || destructivePattern.test(rollback)) {
    fail(`Compatibility table public.${compatibilityTable} is modified`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      tables: expectedTables.length,
      browserReadableTables: browserReadableTables.length,
      sensitiveServerOnlyTables: sensitiveTables.length,
      securityDefinerFunctions: securityDefinerFunctions.map(fn => fn.name),
      draft: path.relative(root, draftPath),
      migration: path.relative(root, migrationPath),
      rollback: path.relative(root, rollbackPath),
      assertions: path.relative(root, assertionsPath),
    },
    null,
    2
  )
);
