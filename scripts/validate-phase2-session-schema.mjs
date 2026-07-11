import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");
const migrationFiles = readdirSync(migrationsDir).filter(file =>
  file.endsWith("_phase2b_atomic_session_lifecycle.sql")
);

if (migrationFiles.length !== 1) {
  throw new Error(
    `Expected exactly one Phase 2B session migration, found ${migrationFiles.length}`
  );
}

const migration = readFileSync(
  path.join(migrationsDir, migrationFiles[0]),
  "utf8"
);
const rollback = readFileSync(
  path.join(root, "docs/supabase-phase-2b-session-lifecycle-rollback.sql"),
  "utf8"
);
const manualMigration = readFileSync(
  path.join(root, "supabase/manual/002_phase2b_atomic_session_lifecycle.sql"),
  "utf8"
);
const manualRollback = readFileSync(
  path.join(root, "supabase/manual/901_phase2b_rollback.sql"),
  "utf8"
);

if (manualMigration !== migration) {
  throw new Error("Manual Phase 2B SQL differs from the promoted migration");
}
if (manualRollback !== rollback) {
  throw new Error(
    "Manual Phase 2B rollback differs from the reviewed rollback"
  );
}

const functions = [
  {
    name: "create_auth_session_with_evidence",
    signature: "text, uuid, uuid, uuid, integer, text, text",
  },
  {
    name: "revoke_auth_session_with_evidence",
    signature: "text, text, text",
  },
];

for (const { name, signature } of functions) {
  if (!migration.includes(`create function public.${name}(`)) {
    throw new Error(`Phase 2B function is missing: ${name}`);
  }
  const functionPattern = new RegExp(
    `create function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`
  );
  const functionBody = migration.match(functionPattern)?.[0] ?? "";
  if (!functionBody.includes("security definer")) {
    throw new Error(`Phase 2B function is not SECURITY DEFINER: ${name}`);
  }
  if (!functionBody.includes("set search_path = ''")) {
    throw new Error(`Phase 2B function lacks an empty search_path: ${name}`);
  }
  const normalizedSignature = signature.replaceAll(", ", ",\\s*");
  const revokePattern = new RegExp(
    `revoke all on function public\\.${name}\\(\\s*${normalizedSignature}\\s*\\)[\\s\\S]*?from public, anon, authenticated;`
  );
  if (!revokePattern.test(migration)) {
    throw new Error(`Browser execute revoke is missing for ${name}`);
  }
  const grantPattern = new RegExp(
    `grant execute on function public\\.${name}\\(\\s*${normalizedSignature}\\s*\\)[\\s\\S]*?to service_role;`
  );
  if (!grantPattern.test(migration)) {
    throw new Error(`service_role execute grant is missing for ${name}`);
  }
  const rollbackPattern = new RegExp(
    `drop function public\\.${name}\\(\\s*${normalizedSignature}\\s*\\);`
  );
  if (!rollbackPattern.test(rollback)) {
    throw new Error(`Phase 2B rollback is missing function: ${name}`);
  }
}

for (const marker of [
  "audit_logs_session_lifecycle_uidx",
  "session.created",
  "session.revoked",
  "command_executions",
  "pg_advisory_xact_lock",
  "revoked_by",
  "p_request_hash",
]) {
  if (!migration.includes(marker)) {
    throw new Error(`Phase 2B lifecycle marker is missing: ${marker}`);
  }
}

if (!rollback.includes("drop index public.audit_logs_session_lifecycle_uidx")) {
  throw new Error("Phase 2B rollback is missing the lifecycle audit index");
}

for (const forbidden of [
  "plaintext_token",
  "password",
  "access_token",
  "refresh_token",
  "authorization_header",
  "cookie",
]) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(
      `Phase 2B SQL contains forbidden credential marker: ${forbidden}`
    );
  }
}

console.log(
  JSON.stringify({
    ok: true,
    migration: migrationFiles[0],
    functions: functions.map(item => item.name),
    browserExecutableFunctions: 0,
    lifecycleAuditIndex: "audit_logs_session_lifecycle_uidx",
  })
);
