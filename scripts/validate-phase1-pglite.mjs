import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase1Tables = [
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

const fakeAuthUserId = "00000000-0000-4000-8000-000000000001";
const draft = readFileSync(
  path.join(root, "docs/supabase-phase-1-identity-session-rls-draft.sql"),
  "utf8"
);
const phase1MigrationFiles = readdirSync(
  path.join(root, "supabase/migrations")
).filter(file =>
  file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);

if (phase1MigrationFiles.length !== 1) {
  throw new Error(
    `Expected exactly one promoted Phase 1 migration, found ${phase1MigrationFiles.length}`
  );
}

const migration = readFileSync(
  path.join(root, "supabase/migrations", phase1MigrationFiles[0]),
  "utf8"
);

if (migration !== draft) {
  throw new Error(
    "Promoted Phase 1 migration differs from the reviewed SQL draft"
  );
}
const rollback = readFileSync(
  path.join(root, "docs/supabase-phase-1-identity-session-rls-rollback.sql"),
  "utf8"
);
const assertions = readFileSync(
  path.join(root, "docs/supabase-phase-1-identity-session-rls-assertions.sql"),
  "utf8"
)
  .split(/\r?\n/)
  .filter(line => !line.trimStart().startsWith("\\"))
  .join("\n")
  .replaceAll(":'nile_test_auth_user_id'", `'${fakeAuthUserId}'`);

function logStep(label, startedAt, details = {}) {
  console.log(
    JSON.stringify({
      label,
      ok: true,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })
  );
}

async function runSql(database, label, sql) {
  const startedAt = Date.now();
  await database.exec(sql);
  logStep(label, startedAt);
}

async function readPhase1TableCount(database) {
  const placeholders = phase1Tables
    .map((_, index) => `$${index + 1}`)
    .join(", ");
  const result = await database.query(
    `
      select count(*)::integer as count
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename in (${placeholders})
    `,
    phase1Tables
  );
  return result.rows[0]?.count ?? 0;
}

async function assertRollbackClean(database) {
  const tableCount = await readPhase1TableCount(database);
  const schemaResult = await database.query(
    `
      select count(*)::integer as count
      from pg_catalog.pg_namespace
      where nspname = 'nile_private'
    `
  );
  const privateSchemaCount = schemaResult.rows[0]?.count ?? 0;

  if (tableCount !== 0 || privateSchemaCount !== 0) {
    throw new Error(
      `Phase 1 rollback left ${tableCount} table(s) and ${privateSchemaCount} private schema(s)`
    );
  }

  console.log(
    JSON.stringify({
      label: "rollback-clean",
      ok: true,
      tableCount,
      privateSchemaCount,
    })
  );
}

const database = new PGlite({
  extensions: { btree_gist, citext, pgcrypto },
});

try {
  await database.waitReady;
  const versionResult = await database.query("select version() as version");

  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values ('${fakeAuthUserId}');
  `);

  await runSql(database, "forward-1", migration);
  await runSql(database, "assertions-1", assertions);
  await runSql(database, "rollback", rollback);
  await assertRollbackClean(database);
  await runSql(database, "forward-2", migration);
  await runSql(database, "assertions-2", assertions);

  const finalTableCount = await readPhase1TableCount(database);
  if (finalTableCount !== phase1Tables.length) {
    throw new Error(
      `Expected ${phase1Tables.length} Phase 1 tables after reapply, found ${finalTableCount}`
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      engine: versionResult.rows[0]?.version ?? "PGlite PostgreSQL",
      phase1Tables: finalTableCount,
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackPasses: 1,
    })
  );
} finally {
  await database.close();
}
