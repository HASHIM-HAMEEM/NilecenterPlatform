import { spawnSync } from "node:child_process";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(message) {
  console.error(`Phase 2B local PostgREST acceptance refused: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  NILE_PHASE2_SESSION_LOCAL_ONLY=1 \\
  SUPABASE_URL=http://127.0.0.1:<port> \\
  SUPABASE_SECRET_KEY=<local-service-key> \\
  NILE_LOCAL_SUPABASE_ANON_KEY=<local-anon-key> \\
  NILE_LOCAL_SUPABASE_JWT_SECRET=<local-jwt-secret> \\
  npm run check:phase2-session:postgrest

The target must be an isolated, fake-data-only local PostgREST endpoint. This
runner never applies migrations, starts Docker, or enables the runtime adapter.`);
}

if (process.argv.includes("--help")) {
  usage();
  process.exit(0);
}

if (clean(process.env.NILE_PHASE2_SESSION_LOCAL_ONLY) !== "1") {
  fail(
    "set NILE_PHASE2_SESSION_LOCAL_ONLY=1 to acknowledge a fake-data-only local target."
  );
}

const configuredUrl = clean(process.env.SUPABASE_URL);
if (!configuredUrl) {
  fail("SUPABASE_URL is required.");
}

let localUrl;
try {
  localUrl = new URL(configuredUrl);
} catch {
  fail("SUPABASE_URL must be a valid local HTTP URL.");
}

if (
  localUrl.protocol !== "http:" ||
  !localHosts.has(localUrl.hostname) ||
  !localUrl.port ||
  (localUrl.pathname !== "/" && localUrl.pathname !== "") ||
  localUrl.search ||
  localUrl.hash ||
  localUrl.username ||
  localUrl.password
) {
  fail(
    "SUPABASE_URL must be an explicit local HTTP endpoint such as http://127.0.0.1:54321."
  );
}

const secretKey = clean(
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anonKey = clean(process.env.NILE_LOCAL_SUPABASE_ANON_KEY);
const jwtSecret = clean(process.env.NILE_LOCAL_SUPABASE_JWT_SECRET);
if (!secretKey || !anonKey || !jwtSecret) {
  fail(
    "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY, NILE_LOCAL_SUPABASE_ANON_KEY, and NILE_LOCAL_SUPABASE_JWT_SECRET are required."
  );
}

const childEnv = {
  ...process.env,
  SUPABASE_URL: localUrl.toString().replace(/\/$/, ""),
  SUPABASE_SECRET_KEY: secretKey,
  SUPABASE_SERVICE_ROLE_KEY: "",
  NILE_LOCAL_SUPABASE_ANON_KEY: anonKey,
  NILE_LOCAL_SUPABASE_JWT_SECRET: jwtSecret,
  NILE_PHASE2_SESSION_DISPOSABLE_LOCAL: "1",
  NILE_SESSION_REPOSITORY: "supabase",
};

async function verifyEndpoint() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  timeout.unref?.();
  try {
    await fetch(`${childEnv.SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      signal: controller.signal,
    });
  } catch {
    fail(
      "the local PostgREST endpoint is unreachable. Provision the isolated local endpoint and apply the manual SQL bundle before retrying."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function run(label, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: childEnv,
    stdio: "inherit",
  });
  if (result.error) fail(`${label} could not start.`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("Phase 2B static contract", ["scripts/validate-phase2-session-schema.mjs"]);
await verifyEndpoint();
run("Phase 2B local PostgREST lifecycle", [
  "--import",
  "tsx",
  "scripts/validate-phase2-session-supabase.ts",
]);
