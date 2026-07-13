import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createMoodleClientFromEnvironment,
  getMoodleServerStatus,
  MoodleApiError,
  type MoodleClient,
} from "../server/moodleClient";
import {
  createMoodleSandboxWriteClientFromEnvironment,
  getMoodleSandboxWriteServerStatus,
  MOODLE_SANDBOX_WRITE_ACK,
  MOODLE_SANDBOX_WRITE_HOST,
  MoodleSandboxWriteError,
  type MoodleSandboxWriteClient,
} from "../server/moodleSandboxWriteClient";
import {
  MoodleSandboxWriteWorkflowError,
  runMoodleSandboxWriteWorkflow,
  type MoodleSandboxWriteEvidence,
  type MoodleSandboxWriteWorkflowResult,
} from "../server/moodleSandboxWriteWorkflow";

type ReadClient = Pick<MoodleClient, "call" | "probe">;
type WriteClient = Pick<
  MoodleSandboxWriteClient,
  | "probe"
  | "findUsersByMarker"
  | "createUser"
  | "updateUser"
  | "deleteUser"
  | "enrolUser"
  | "unenrolUser"
  | "createGroup"
  | "deleteGroup"
  | "addGroupMember"
  | "deleteGroupMember"
>;

type ValidationDependencies = {
  createReadClient?: (env: NodeJS.ProcessEnv) => ReadClient;
  createWriteClient?: (env: NodeJS.ProcessEnv) => WriteClient;
  runWorkflow?: typeof runMoodleSandboxWriteWorkflow;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

type ReadProjectionEvidence = {
  beforeHash?: string;
  afterHash?: string;
  unchanged?: boolean;
};

export type MoodleSandboxWriteValidationResult = Readonly<{
  ok: true;
  mode: "synthetic_sandbox_write_proof";
  sandboxHost: typeof MOODLE_SANDBOX_WRITE_HOST;
  startedAt: string;
  completedAt: string;
  readProjection: Required<ReadProjectionEvidence>;
  workflow: MoodleSandboxWriteWorkflowResult;
}>;

type SafeFailureResult = Readonly<{
  ok: false;
  mode: "synthetic_sandbox_write_proof";
  sandboxHost: typeof MOODLE_SANDBOX_WRITE_HOST;
  errorCode: string;
  readProjection?: ReadProjectionEvidence;
  workflowEvidence?: readonly MoodleSandboxWriteEvidence[];
}>;

export class MoodleSandboxWriteValidationError extends Error {
  constructor(
    readonly code:
      | "configuration"
      | "read_projection_changed"
      | "read_projection_failed"
      | `workflow:${string}`,
    readonly readProjection?: ReadProjectionEvidence,
    readonly workflowEvidence?: readonly MoodleSandboxWriteEvidence[]
  ) {
    super(`Moodle sandbox write validation failed (${code}).`);
    this.name = "MoodleSandboxWriteValidationError";
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveId(value: unknown) {
  const canonical = clean(value);
  if (!/^[1-9]\d*$/.test(canonical)) return undefined;
  const parsed = Number(canonical);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function requireSandboxUrl(value: unknown) {
  let url: URL;
  try {
    url = new URL(clean(value));
  } catch {
    throw new MoodleSandboxWriteValidationError("configuration");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase().replace(/\.$/, "") !==
      MOODLE_SANDBOX_WRITE_HOST ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/*$/.test(url.pathname)
  ) {
    throw new MoodleSandboxWriteValidationError("configuration");
  }
}

export function validateMoodleSandboxWriteEnvironment(env: NodeJS.ProcessEnv) {
  const readStatus = getMoodleServerStatus(env);
  const writeStatus = getMoodleSandboxWriteServerStatus(env);
  const readService = clean(env.MOODLE_SERVICE);
  const writeService = clean(env.MOODLE_SANDBOX_WRITE_SERVICE);
  const readToken = clean(env.MOODLE_TOKEN);
  const writeToken = clean(env.MOODLE_SANDBOX_WRITE_TOKEN);
  const allowedHosts = clean(env.MOODLE_ALLOWED_HOSTS)
    .split(",")
    .map(host => host.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  const courseId = parsePositiveId(env.MOODLE_SANDBOX_WRITE_COURSE_ID);
  const roleId = parsePositiveId(env.MOODLE_SANDBOX_WRITE_ROLE_ID);

  requireSandboxUrl(env.MOODLE_BASE_URL);
  requireSandboxUrl(env.MOODLE_SANDBOX_WRITE_BASE_URL);
  if (
    !readStatus.configured ||
    !writeStatus.configured ||
    env.MOODLE_SANDBOX_WRITE_SYNTHETIC_ACK !== MOODLE_SANDBOX_WRITE_ACK ||
    allowedHosts.length !== 1 ||
    allowedHosts[0] !== MOODLE_SANDBOX_WRITE_HOST ||
    !readService ||
    !writeService ||
    readService === writeService ||
    !readToken ||
    !writeToken ||
    readToken === writeToken ||
    !courseId ||
    !roleId
  ) {
    throw new MoodleSandboxWriteValidationError("configuration");
  }

  return { courseId, roleId };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right))
      );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return null;
}

export async function createMoodleReadProjectionFingerprint(
  readClient: ReadClient,
  courseId: number
) {
  try {
    const probe = await readClient.probe();
    if (
      !probe.minimumPrivilegeVerified ||
      probe.missingApprovedFunctions.length ||
      probe.unexpectedFunctions.length
    ) {
      throw new MoodleSandboxWriteValidationError("read_projection_failed");
    }

    const [course, contents, enrolledUsers, groups, groupings] =
      await Promise.all([
        readClient.call("core_course_get_courses_by_field", {
          field: "id",
          value: String(courseId),
        }),
        readClient.call("core_course_get_contents", {
          courseid: courseId,
          options: [{ name: "excludecontents", value: "1" }],
        }),
        readClient.call("core_enrol_get_enrolled_users", {
          courseid: courseId,
          options: [
            { name: "onlyactive", value: "1" },
            { name: "userfields", value: "id" },
          ],
        }),
        readClient.call("core_group_get_course_groups", {
          courseid: courseId,
        }),
        readClient.call("core_group_get_course_groupings", {
          courseid: courseId,
        }),
      ]);

    const projection = canonicalize({
      probe: {
        mode: probe.mode,
        site: probe.site,
        availableFunctionCount: probe.availableFunctionCount,
        approvedFunctionCount: probe.approvedFunctionCount,
        missingApprovedFunctions: probe.missingApprovedFunctions,
        unexpectedFunctions: probe.unexpectedFunctions,
        minimumPrivilegeVerified: probe.minimumPrivilegeVerified,
      },
      course,
      contents,
      enrolledUsers,
      groups,
      groupings,
    });

    return createHash("sha256")
      .update(JSON.stringify(projection), "utf8")
      .digest("hex");
  } catch (error) {
    if (error instanceof MoodleSandboxWriteValidationError) throw error;
    throw new MoodleSandboxWriteValidationError("read_projection_failed");
  }
}

export function createMoodleSandboxSyntheticRun(
  now: Date,
  randomBytesImpl: (size: number) => Buffer = randomBytes
) {
  if (Number.isNaN(now.getTime())) {
    throw new MoodleSandboxWriteValidationError("configuration");
  }
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const suffix = randomBytesImpl(4).toString("hex");
  if (!/^[0-9a-f]{8}$/.test(suffix)) {
    throw new MoodleSandboxWriteValidationError("configuration");
  }
  const marker = `NILE-M2B-${timestamp}-${suffix}`;
  const passwordEntropy = randomBytesImpl(24).toString("base64url");
  if (!passwordEntropy) {
    throw new MoodleSandboxWriteValidationError("configuration");
  }

  return {
    marker,
    user: {
      marker,
      username: `nile-m2b-${timestamp.toLowerCase()}-${suffix}`,
      firstName: "Nile M2B",
      updatedFirstName: "Nile M2B Verified",
      lastName: "Synthetic Learner",
      email: `nile-m2b-${timestamp.toLowerCase()}-${suffix}@example.invalid`,
      password: `Nile!M2B#${passwordEntropy}`,
    },
    groupName: `Nile Learn M2B ${marker}`,
  };
}

export async function runMoodleSandboxWriteValidation(
  env: NodeJS.ProcessEnv = process.env,
  dependencies: ValidationDependencies = {}
): Promise<MoodleSandboxWriteValidationResult> {
  const { courseId, roleId } = validateMoodleSandboxWriteEnvironment(env);
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now();
  const syntheticRun = createMoodleSandboxSyntheticRun(
    startedAt,
    dependencies.randomBytes
  );
  const readClient = (
    dependencies.createReadClient ?? createMoodleClientFromEnvironment
  )(env);
  const writeClient = (
    dependencies.createWriteClient ??
    createMoodleSandboxWriteClientFromEnvironment
  )(env);
  const workflow = dependencies.runWorkflow ?? runMoodleSandboxWriteWorkflow;
  const beforeHash = await createMoodleReadProjectionFingerprint(
    readClient,
    courseId
  );

  let workflowResult: MoodleSandboxWriteWorkflowResult | undefined;
  let workflowError: unknown;
  try {
    workflowResult = await workflow({
      readClient,
      writeClient,
      marker: syntheticRun.marker,
      courseId,
      roleId,
      user: syntheticRun.user,
      groupName: syntheticRun.groupName,
    });
  } catch (error) {
    workflowError = error;
  }

  let afterHash: string;
  try {
    afterHash = await createMoodleReadProjectionFingerprint(
      readClient,
      courseId
    );
  } catch {
    throw new MoodleSandboxWriteValidationError(
      "read_projection_failed",
      { beforeHash },
      workflowError instanceof MoodleSandboxWriteWorkflowError
        ? workflowError.evidence
        : undefined
    );
  }

  const readProjection = {
    beforeHash,
    afterHash,
    unchanged: beforeHash === afterHash,
  };
  if (!readProjection.unchanged) {
    throw new MoodleSandboxWriteValidationError(
      "read_projection_changed",
      readProjection,
      workflowError instanceof MoodleSandboxWriteWorkflowError
        ? workflowError.evidence
        : workflowResult?.evidence
    );
  }
  if (workflowError) {
    if (workflowError instanceof MoodleSandboxWriteWorkflowError) {
      throw new MoodleSandboxWriteValidationError(
        `workflow:${workflowError.code}`,
        readProjection,
        workflowError.evidence
      );
    }
    throw new MoodleSandboxWriteValidationError(
      "workflow:unexpected",
      readProjection
    );
  }
  if (!workflowResult) {
    throw new MoodleSandboxWriteValidationError(
      "workflow:unexpected",
      readProjection
    );
  }

  return {
    ok: true,
    mode: "synthetic_sandbox_write_proof",
    sandboxHost: MOODLE_SANDBOX_WRITE_HOST,
    startedAt: startedAt.toISOString(),
    completedAt: now().toISOString(),
    readProjection,
    workflow: workflowResult,
  };
}

export function toSafeMoodleSandboxWriteFailure(
  error: unknown
): SafeFailureResult {
  let errorCode = "unexpected";
  let readProjection: ReadProjectionEvidence | undefined;
  let workflowEvidence: readonly MoodleSandboxWriteEvidence[] | undefined;

  if (error instanceof MoodleSandboxWriteValidationError) {
    errorCode = error.code;
    readProjection = error.readProjection;
    workflowEvidence = error.workflowEvidence;
  } else if (error instanceof MoodleSandboxWriteWorkflowError) {
    errorCode = `workflow:${error.code}`;
    workflowEvidence = error.evidence;
  } else if (error instanceof MoodleSandboxWriteError) {
    errorCode = `write_provider:${error.code}`;
  } else if (error instanceof MoodleApiError) {
    errorCode = `read_provider:${error.code}`;
  }

  return {
    ok: false,
    mode: "synthetic_sandbox_write_proof",
    sandboxHost: MOODLE_SANDBOX_WRITE_HOST,
    errorCode,
    ...(readProjection ? { readProjection } : {}),
    ...(workflowEvidence ? { workflowEvidence } : {}),
  };
}

async function main() {
  try {
    const result = await runMoodleSandboxWriteValidation();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify(toSafeMoodleSandboxWriteFailure(error), null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry && pathToFileURL(resolve(entry)).href === import.meta.url) {
  void main();
}
