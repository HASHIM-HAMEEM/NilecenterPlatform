import {
  createMoodleClientFromEnvironment,
  getMoodleServerStatus,
  MOODLE_READ_FUNCTIONS,
  MoodleApiError,
  type MoodleClient,
  type MoodleErrorCode,
  type MoodleReadFunction,
} from "../server/moodleClient";

type MoodleCallParameters = NonNullable<Parameters<MoodleClient["call"]>[1]>;
type PayloadShape = "array" | "object";
type FixtureEnvironment =
  | "MOODLE_FIXTURE_CATEGORY_ID"
  | "MOODLE_FIXTURE_COURSE_ID"
  | "MOODLE_FIXTURE_COURSE_MODULE_ID"
  | "MOODLE_FIXTURE_USER_ID"
  | "MOODLE_FIXTURE_GROUPING_ID"
  | "MOODLE_FIXTURE_ASSIGNMENT_ID"
  | "MOODLE_FIXTURE_QUIZ_ID"
  | "MOODLE_FIXTURE_QUIZ_ATTEMPT_ID"
  | "MOODLE_FIXTURE_H5P_ACTIVITY_ID"
  | "MOODLE_FIXTURE_H5P_ATTEMPT_ID"
  | "MOODLE_FIXTURE_SCORM_SCO_ID"
  | "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER"
  | "MOODLE_FIXTURE_LESSON_ID";

type FixtureValues = Record<FixtureEnvironment, number>;
type FixtureIssue = "missing" | "invalid";
type SummaryErrorCode =
  | MoodleErrorCode
  | "fixture_absent"
  | "not_run_after_probe"
  | `configuration:${string}`
  | `fixture_${FixtureIssue}:${string}`;

type FunctionSummary = {
  function: MoodleReadFunction;
  ok: boolean;
  errorCode: SummaryErrorCode | null;
  count: number | null;
  shape: PayloadShape | null;
};

type FunctionSpec = {
  fixtures: readonly FixtureEnvironment[];
  expectedShape: PayloadShape;
  parameters: (fixtures: FixtureValues) => MoodleCallParameters;
  count: (payload: unknown) => number | null;
};

const MAX_MOODLE_ID = 2_147_483_647;
const MAX_SCORM_ATTEMPT_NUMBER = 10_000;
const ENROLLED_USER_LIMIT = 100;

const fixtureEnvironments = [
  "MOODLE_FIXTURE_CATEGORY_ID",
  "MOODLE_FIXTURE_COURSE_ID",
  "MOODLE_FIXTURE_COURSE_MODULE_ID",
  "MOODLE_FIXTURE_USER_ID",
  "MOODLE_FIXTURE_GROUPING_ID",
  "MOODLE_FIXTURE_ASSIGNMENT_ID",
  "MOODLE_FIXTURE_QUIZ_ID",
  "MOODLE_FIXTURE_QUIZ_ATTEMPT_ID",
  "MOODLE_FIXTURE_H5P_ACTIVITY_ID",
  "MOODLE_FIXTURE_H5P_ATTEMPT_ID",
  "MOODLE_FIXTURE_SCORM_SCO_ID",
  "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER",
  "MOODLE_FIXTURE_LESSON_ID",
] as const satisfies readonly FixtureEnvironment[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function topLevelArrayCount(payload: unknown) {
  return Array.isArray(payload) ? payload.length : null;
}

function collectionCount(payload: unknown, key: string) {
  if (!isRecord(payload) || !Array.isArray(payload[key])) return null;
  return payload[key].length;
}

function nestedCollectionCount(
  payload: unknown,
  outerKey: string,
  innerKey: string
) {
  if (!isRecord(payload) || !Array.isArray(payload[outerKey])) return null;
  let count = 0;
  for (const item of payload[outerKey]) {
    if (!isRecord(item) || !Array.isArray(item[innerKey])) return null;
    count += item[innerKey].length;
  }
  return count;
}

function objectFieldCount(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  return isRecord(payload[key]) ? 1 : 0;
}

function ownFieldCount(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  return Object.hasOwn(payload, key) ? 1 : 0;
}

function h5pAttemptCount(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.attempts)) return payload.attempts.length;
  if (!Array.isArray(payload.usersattempts)) return null;

  let count = 0;
  for (const userAttempts of payload.usersattempts) {
    if (!isRecord(userAttempts) || !Array.isArray(userAttempts.attempts)) {
      return null;
    }
    count += userAttempts.attempts.length;
  }
  return count;
}

function h5pResultCount(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.attempts)) return payload.attempts.length;
  if (Array.isArray(payload.results)) return payload.results.length;
  return null;
}

function scormTrackCount(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  return Array.isArray(payload.data.tracks) ? payload.data.tracks.length : null;
}

function warningCount(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.warnings)) return 0;
  return payload.warnings.length;
}

const functionSpecs = {
  core_webservice_get_site_info: {
    fixtures: [],
    expectedShape: "object",
    parameters: () => ({}),
    count: payload => collectionCount(payload, "functions"),
  },
  core_course_get_categories: {
    fixtures: ["MOODLE_FIXTURE_CATEGORY_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      criteria: [
        {
          key: "id",
          value: fixtures.MOODLE_FIXTURE_CATEGORY_ID,
        },
      ],
    }),
    count: topLevelArrayCount,
  },
  core_course_get_courses_by_field: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      field: "id",
      value: String(fixtures.MOODLE_FIXTURE_COURSE_ID),
    }),
    count: payload => collectionCount(payload, "courses"),
  },
  core_course_get_contents: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      options: [{ name: "excludecontents", value: "1" }],
    }),
    count: topLevelArrayCount,
  },
  core_course_get_course_module: {
    fixtures: ["MOODLE_FIXTURE_COURSE_MODULE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      cmid: fixtures.MOODLE_FIXTURE_COURSE_MODULE_ID,
    }),
    count: payload => objectFieldCount(payload, "cm"),
  },
  core_enrol_get_enrolled_users: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      options: [
        { name: "onlyactive", value: "1" },
        { name: "userfields", value: "id" },
        { name: "limitfrom", value: "0" },
        { name: "limitnumber", value: String(ENROLLED_USER_LIMIT) },
      ],
    }),
    count: topLevelArrayCount,
  },
  core_enrol_get_users_courses: {
    fixtures: ["MOODLE_FIXTURE_USER_ID"],
    expectedShape: "array",
    parameters: fixtures => ({ userid: fixtures.MOODLE_FIXTURE_USER_ID }),
    count: topLevelArrayCount,
  },
  core_user_get_users_by_field: {
    fixtures: ["MOODLE_FIXTURE_USER_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      field: "id",
      values: [fixtures.MOODLE_FIXTURE_USER_ID],
    }),
    count: topLevelArrayCount,
  },
  core_group_get_course_groups: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({ courseid: fixtures.MOODLE_FIXTURE_COURSE_ID }),
    count: topLevelArrayCount,
  },
  core_group_get_course_groupings: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({ courseid: fixtures.MOODLE_FIXTURE_COURSE_ID }),
    count: topLevelArrayCount,
  },
  core_group_get_course_user_groups: {
    fixtures: [
      "MOODLE_FIXTURE_COURSE_ID",
      "MOODLE_FIXTURE_USER_ID",
      "MOODLE_FIXTURE_GROUPING_ID",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
      groupingid: fixtures.MOODLE_FIXTURE_GROUPING_ID,
    }),
    count: payload => collectionCount(payload, "groups"),
  },
  core_completion_get_activities_completion_status: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => collectionCount(payload, "statuses"),
  },
  core_completion_get_course_completion_status: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => objectFieldCount(payload, "completionstatus"),
  },
  gradereport_user_get_grade_items: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => collectionCount(payload, "usergrades"),
  },
  mod_assign_get_assignments: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
      includenotenrolledcourses: true,
    }),
    count: payload => nestedCollectionCount(payload, "courses", "assignments"),
  },
  mod_assign_get_submissions: {
    fixtures: ["MOODLE_FIXTURE_ASSIGNMENT_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      assignmentids: [fixtures.MOODLE_FIXTURE_ASSIGNMENT_ID],
      status: "",
      since: 0,
      before: 0,
    }),
    count: payload =>
      nestedCollectionCount(payload, "assignments", "submissions"),
  },
  mod_assign_get_grades: {
    fixtures: ["MOODLE_FIXTURE_ASSIGNMENT_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      assignmentids: [fixtures.MOODLE_FIXTURE_ASSIGNMENT_ID],
      since: 0,
    }),
    count: payload => nestedCollectionCount(payload, "assignments", "grades"),
  },
  mod_quiz_get_quizzes_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "quizzes"),
  },
  mod_quiz_get_user_attempts: {
    fixtures: ["MOODLE_FIXTURE_QUIZ_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      quizid: fixtures.MOODLE_FIXTURE_QUIZ_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
      status: "all",
      includepreviews: false,
    }),
    count: payload => collectionCount(payload, "attempts"),
  },
  mod_quiz_get_attempt_review: {
    fixtures: ["MOODLE_FIXTURE_QUIZ_ATTEMPT_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      attemptid: fixtures.MOODLE_FIXTURE_QUIZ_ATTEMPT_ID,
      page: 0,
    }),
    count: payload => collectionCount(payload, "questions"),
  },
  mod_h5pactivity_get_h5pactivities_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "h5pactivities"),
  },
  mod_h5pactivity_get_attempts: {
    fixtures: ["MOODLE_FIXTURE_H5P_ACTIVITY_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      h5pactivityid: fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID,
      userids: [fixtures.MOODLE_FIXTURE_USER_ID],
    }),
    count: h5pAttemptCount,
  },
  mod_h5pactivity_get_results: {
    fixtures: [
      "MOODLE_FIXTURE_H5P_ACTIVITY_ID",
      "MOODLE_FIXTURE_H5P_ATTEMPT_ID",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      h5pactivityid: fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID,
      attemptids: [fixtures.MOODLE_FIXTURE_H5P_ATTEMPT_ID],
    }),
    count: h5pResultCount,
  },
  mod_scorm_get_scorms_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "scorms"),
  },
  mod_scorm_get_scorm_sco_tracks: {
    fixtures: [
      "MOODLE_FIXTURE_SCORM_SCO_ID",
      "MOODLE_FIXTURE_USER_ID",
      "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      scoid: fixtures.MOODLE_FIXTURE_SCORM_SCO_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
      attempt: fixtures.MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER,
    }),
    count: scormTrackCount,
  },
  mod_lesson_get_lessons_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "lessons"),
  },
  mod_lesson_get_user_grade: {
    fixtures: ["MOODLE_FIXTURE_LESSON_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      lessonid: fixtures.MOODLE_FIXTURE_LESSON_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => ownFieldCount(payload, "grade"),
  },
  mod_book_get_books_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "books"),
  },
  mod_page_get_pages_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "pages"),
  },
  mod_resource_get_resources_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "resources"),
  },
  mod_url_get_urls_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "urls"),
  },
} satisfies Record<MoodleReadFunction, FunctionSpec>;

function payloadShape(payload: unknown): PayloadShape | null {
  if (Array.isArray(payload)) return "array";
  return isRecord(payload) ? "object" : null;
}

function parseFixtureEnvironment(env: NodeJS.ProcessEnv) {
  const values: Partial<FixtureValues> = {};
  const issues = new Map<FixtureEnvironment, FixtureIssue>();

  for (const name of fixtureEnvironments) {
    const raw = env[name]?.trim() ?? "";
    if (!raw) {
      issues.set(name, "missing");
      continue;
    }
    if (!/^[1-9]\d*$/.test(raw)) {
      issues.set(name, "invalid");
      continue;
    }

    const value = Number(raw);
    const maximum =
      name === "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER"
        ? MAX_SCORM_ATTEMPT_NUMBER
        : MAX_MOODLE_ID;
    if (!Number.isSafeInteger(value) || value > maximum) {
      issues.set(name, "invalid");
      continue;
    }
    values[name] = value;
  }

  return { values, issues };
}

function fixtureErrorCode(
  fixtures: readonly FixtureEnvironment[],
  issues: ReadonlyMap<FixtureEnvironment, FixtureIssue>
): SummaryErrorCode | null {
  const affected = fixtures
    .map(name => ({ name, issue: issues.get(name) }))
    .filter(
      (entry): entry is { name: FixtureEnvironment; issue: FixtureIssue } =>
        Boolean(entry.issue)
    );
  if (!affected.length) return null;

  const issue = affected.some(entry => entry.issue === "invalid")
    ? "invalid"
    : "missing";
  return `fixture_${issue}:${affected.map(entry => entry.name).join(",")}`;
}

function sanitizedErrorCode(error: unknown): MoodleErrorCode {
  return error instanceof MoodleApiError ? error.code : "invalid_response";
}

function notRunSummaries(errorCode: SummaryErrorCode): FunctionSummary[] {
  return MOODLE_READ_FUNCTIONS.map(functionName => ({
    function: functionName,
    ok: false,
    errorCode,
    count: null,
    shape: null,
  }));
}

function emit(results: FunctionSummary[], exitCode: number) {
  const passed = results.filter(result => result.ok).length;
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: exitCode === 0,
        mode: "read_only",
        functionCount: MOODLE_READ_FUNCTIONS.length,
        passed,
        failed: results.length - passed,
        results,
      },
      null,
      2
    )}\n`
  );
  process.exitCode = exitCode;
}

function configurationErrorCode(env: NodeJS.ProcessEnv): SummaryErrorCode {
  const missing = [
    ["MOODLE_READ_ONLY_ENABLED", env.MOODLE_READ_ONLY_ENABLED === "1"],
    ["MOODLE_BASE_URL", Boolean(env.MOODLE_BASE_URL?.trim())],
    ["MOODLE_SERVICE", Boolean(env.MOODLE_SERVICE?.trim())],
    ["MOODLE_TOKEN", Boolean(env.MOODLE_TOKEN?.trim())],
    ["MOODLE_ALLOWED_HOSTS", Boolean(env.MOODLE_ALLOWED_HOSTS?.trim())],
  ]
    .filter(([, configured]) => !configured)
    .map(([name]) => name);
  return missing.length
    ? (`configuration:${missing.join(",")}` as SummaryErrorCode)
    : "configuration";
}

async function main() {
  const env = process.env;
  if (!getMoodleServerStatus(env).configured) {
    emit(notRunSummaries(configurationErrorCode(env)), 1);
    return;
  }

  let client: MoodleClient;
  try {
    client = createMoodleClientFromEnvironment(env);
  } catch (error) {
    emit(notRunSummaries(sanitizedErrorCode(error)), 1);
    return;
  }

  const results: FunctionSummary[] = [];
  try {
    const probe = await client.probe();
    results.push({
      function: "core_webservice_get_site_info",
      ok: probe.minimumPrivilegeVerified,
      errorCode: probe.minimumPrivilegeVerified ? null : "permission",
      count: probe.availableFunctionCount,
      shape: "object",
    });

    if (!probe.minimumPrivilegeVerified) {
      const missing = new Set(probe.missingApprovedFunctions);
      for (const functionName of MOODLE_READ_FUNCTIONS.slice(1)) {
        results.push({
          function: functionName,
          ok: false,
          errorCode: missing.has(functionName)
            ? "permission"
            : "not_run_after_probe",
          count: null,
          shape: null,
        });
      }
      emit(results, 1);
      return;
    }
  } catch (error) {
    const errorCode = sanitizedErrorCode(error);
    results.push({
      function: "core_webservice_get_site_info",
      ok: false,
      errorCode,
      count: null,
      shape: null,
    });
    for (const functionName of MOODLE_READ_FUNCTIONS.slice(1)) {
      results.push({
        function: functionName,
        ok: false,
        errorCode: "not_run_after_probe",
        count: null,
        shape: null,
      });
    }
    emit(results, 1);
    return;
  }

  const fixtures = parseFixtureEnvironment(env);
  let hasUnexpectedFailure = false;
  let hasFixtureFailure = false;

  for (const functionName of MOODLE_READ_FUNCTIONS.slice(1)) {
    const spec = functionSpecs[functionName];
    const fixtureError = fixtureErrorCode(spec.fixtures, fixtures.issues);
    if (fixtureError) {
      hasFixtureFailure = true;
      results.push({
        function: functionName,
        ok: false,
        errorCode: fixtureError,
        count: null,
        shape: null,
      });
      continue;
    }

    try {
      const payload = await client.call(
        functionName,
        spec.parameters(fixtures.values as FixtureValues)
      );
      const shape = payloadShape(payload);
      const count = spec.count(payload);
      if (shape !== spec.expectedShape || count === null) {
        hasUnexpectedFailure = true;
        results.push({
          function: functionName,
          ok: false,
          errorCode: "invalid_response",
          count,
          shape,
        });
        continue;
      }
      if (count === 0 || warningCount(payload) > 0) {
        hasFixtureFailure = true;
        results.push({
          function: functionName,
          ok: false,
          errorCode: "fixture_absent",
          count,
          shape,
        });
        continue;
      }
      results.push({
        function: functionName,
        ok: true,
        errorCode: null,
        count,
        shape,
      });
    } catch (error) {
      hasUnexpectedFailure = true;
      results.push({
        function: functionName,
        ok: false,
        errorCode: sanitizedErrorCode(error),
        count: null,
        shape: null,
      });
    }
  }

  emit(results, hasUnexpectedFailure ? 1 : hasFixtureFailure ? 2 : 0);
}

void main().catch(() => {
  emit(notRunSummaries("invalid_response"), 1);
});
