import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");
const migrationFiles = readdirSync(migrationsDir).filter(file =>
  file.endsWith("_nile_forms_foundation.sql")
);
const legacyMigrationFiles = readdirSync(migrationsDir).filter(file =>
  file.endsWith("_nile_forms_legacy_import.sql")
);

if (migrationFiles.length !== 1 || legacyMigrationFiles.length !== 1) {
  throw new Error(
    `Expected one Forms foundation and one legacy migration, found ${migrationFiles.length}/${legacyMigrationFiles.length}`
  );
}

const migration = [migrationFiles[0], legacyMigrationFiles[0]]
  .map(file => readFileSync(path.join(migrationsDir, file), "utf8"))
  .join("\n");
const rollback = [
  "docs/supabase-nile-forms-foundation-rollback.sql",
  "docs/supabase-nile-forms-legacy-import-rollback.sql",
]
  .map(file => readFileSync(path.join(root, file), "utf8"))
  .join("\n");
const assertions = [
  "docs/supabase-nile-forms-foundation-assertions.sql",
  "docs/supabase-nile-forms-legacy-import-assertions.sql",
]
  .map(file => readFileSync(path.join(root, file), "utf8"))
  .join("\n");

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

for (const table of tables) {
  if (!migration.includes(`create table public.${table}`)) {
    throw new Error(`Nile Forms migration is missing table: ${table}`);
  }
  if (
    !migration.includes(`alter table public.${table} enable row level security`)
  ) {
    throw new Error(`Nile Forms migration does not enable RLS for: ${table}`);
  }
  if (
    !migration.includes(`alter table public.${table} force row level security`)
  ) {
    throw new Error(`Nile Forms migration does not force RLS for: ${table}`);
  }
  if (!rollback.includes(`drop table public.${table}`)) {
    throw new Error(`Nile Forms rollback is missing table: ${table}`);
  }
  if (!assertions.includes(`'${table}'`)) {
    throw new Error(`Nile Forms assertions are missing table: ${table}`);
  }
}

for (const marker of [
  "Published form versions are immutable",
  "Form submission answers and provenance are immutable",
  "form_submissions_client_id_uidx",
  "form_submissions_legacy_source_uidx",
  "audience = 'assigned' or offline_eligible = false",
  "from public, anon, authenticated",
  "to service_role",
  "Legacy form import record provenance is immutable",
  "form_legacy_import_records_imported_source_uidx",
]) {
  if (!migration.includes(marker)) {
    throw new Error(`Nile Forms migration marker is missing: ${marker}`);
  }
}

for (const forbidden of [
  "jotform_api_key",
  "plaintext_token",
  "access_token",
  "refresh_token",
  "authorization_header",
  "storage_locator",
]) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(`Nile Forms SQL contains forbidden marker: ${forbidden}`);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    migrations: [migrationFiles[0], legacyMigrationFiles[0]],
    tables,
    browserPolicies: 0,
    permissions: 8,
    rollback: "docs/supabase-nile-forms-foundation-rollback.sql",
  })
);
