import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");
const phase1File = readdirSync(migrationsDir).find(file =>
  file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);
const formsFile = readdirSync(migrationsDir).find(file =>
  file.endsWith("_nile_forms_foundation.sql")
);
const legacyFormsFile = readdirSync(migrationsDir).find(file =>
  file.endsWith("_nile_forms_legacy_import.sql")
);

if (!phase1File || !formsFile || !legacyFormsFile) {
  throw new Error(
    "Phase 1, Forms foundation, and legacy migration files are required"
  );
}

const phase1 = readFileSync(path.join(migrationsDir, phase1File), "utf8");
const forms = readFileSync(path.join(migrationsDir, formsFile), "utf8");
const legacyForms = readFileSync(
  path.join(migrationsDir, legacyFormsFile),
  "utf8"
);
const rollback = readFileSync(
  path.join(root, "docs/supabase-nile-forms-foundation-rollback.sql"),
  "utf8"
);
const assertions = readFileSync(
  path.join(root, "docs/supabase-nile-forms-foundation-assertions.sql"),
  "utf8"
);
const legacyRollback = readFileSync(
  path.join(root, "docs/supabase-nile-forms-legacy-import-rollback.sql"),
  "utf8"
);
const legacyAssertions = readFileSync(
  path.join(root, "docs/supabase-nile-forms-legacy-import-assertions.sql"),
  "utf8"
);
const tables = [
  "form_definitions",
  "form_versions",
  "form_publications",
  "form_assignments",
  "form_drafts",
  "form_submissions",
  "form_submission_index_values",
  "form_reviews",
  "form_promotions",
  "form_offline_devices",
  "form_sync_receipts",
  "form_attachments",
  "form_legacy_import_runs",
  "form_legacy_import_records",
];

function log(label, startedAt, details = {}) {
  console.log(
    JSON.stringify({
      label,
      ok: true,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })
  );
}

async function exec(database, label, sql) {
  const startedAt = Date.now();
  await database.exec(sql);
  log(label, startedAt);
}

async function tableCount(database) {
  const result = await database.query(
    `select count(*)::integer as count
       from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename = any($1::text[])`,
    [tables]
  );
  return result.rows[0]?.count ?? 0;
}

const database = new PGlite({ extensions: { btree_gist, citext, pgcrypto } });

try {
  await database.waitReady;
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
  `);

  await exec(database, "phase1", phase1);
  await exec(database, "forms-forward-1", forms);
  await exec(database, "forms-legacy-forward-1", legacyForms);
  await exec(database, "forms-assertions-1", assertions);
  await exec(database, "forms-legacy-assertions-1", legacyAssertions);
  await exec(database, "forms-legacy-rollback", legacyRollback);
  await exec(database, "forms-rollback", rollback);

  const afterRollback = await tableCount(database);
  if (afterRollback !== 0) {
    throw new Error(`Nile Forms rollback left ${afterRollback} table(s)`);
  }
  log("forms-rollback-clean", Date.now(), { tableCount: afterRollback });

  await exec(database, "forms-forward-2", forms);
  await exec(database, "forms-legacy-forward-2", legacyForms);
  await exec(database, "forms-assertions-2", assertions);
  await exec(database, "forms-legacy-assertions-2", legacyAssertions);
  const finalCount = await tableCount(database);
  if (finalCount !== tables.length) {
    throw new Error(
      `Expected ${tables.length} Nile Forms tables, found ${finalCount}`
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      engine: "PGlite PostgreSQL",
      tables: finalCount,
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackPasses: 1,
    })
  );
} finally {
  await database.close();
}
