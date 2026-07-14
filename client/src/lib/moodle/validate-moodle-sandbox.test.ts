import { describe, expect, it, vi } from "vitest";

import {
  MOODLE_READ_FUNCTIONS,
  type MoodleClient,
  type MoodleReadFunction,
} from "../../../../server/moodleClient";
import {
  MOODLE_PROJECTION_FUNCTIONS,
  runMoodleSandboxReadValidation,
} from "../../../../scripts/validate-moodle-sandbox";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    MOODLE_READ_ONLY_ENABLED: "1",
    MOODLE_BASE_URL: "https://moodle.example.test",
    MOODLE_SERVICE: "nilelearn_m2_read_sandbox",
    MOODLE_TOKEN: "read-token-only",
    MOODLE_ALLOWED_HOSTS: "moodle.example.test",
    MOODLE_FIXTURE_CATEGORY_ID: "1",
    MOODLE_FIXTURE_COURSE_ID: "2",
    MOODLE_FIXTURE_COURSE_MODULE_ID: "3",
    MOODLE_FIXTURE_USER_ID: "4",
    MOODLE_FIXTURE_GROUPING_ID: "5",
    MOODLE_FIXTURE_ASSIGNMENT_ID: "6",
    MOODLE_FIXTURE_QUIZ_ID: "7",
    MOODLE_FIXTURE_QUIZ_ATTEMPT_ID: "8",
    MOODLE_FIXTURE_H5P_ACTIVITY_ID: "9",
    MOODLE_FIXTURE_H5P_ATTEMPT_ID: "10",
    MOODLE_FIXTURE_SCORM_SCO_ID: "11",
    MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER: "1",
    MOODLE_FIXTURE_LESSON_ID: "12",
  };
}

function contractPayload(functionName: MoodleReadFunction): unknown {
  switch (functionName) {
    case "core_course_get_categories":
    case "core_course_get_contents":
    case "core_enrol_get_enrolled_users":
    case "core_enrol_get_users_courses":
    case "core_user_get_users_by_field":
    case "core_group_get_course_groups":
    case "core_group_get_course_groupings":
      return [{}];
    case "core_course_get_courses_by_field":
      return { courses: [{}] };
    case "core_course_get_course_module":
      return { cm: {} };
    case "core_group_get_course_user_groups":
      return { groups: [{}] };
    case "core_completion_get_activities_completion_status":
      return { statuses: [{}] };
    case "core_completion_get_course_completion_status":
      return { completionstatus: {} };
    case "gradereport_user_get_grade_items":
      return { usergrades: [{}] };
    case "mod_assign_get_assignments":
      return { courses: [{ assignments: [{}] }] };
    case "mod_assign_get_submissions":
      return { assignments: [{ submissions: [{}] }] };
    case "mod_assign_get_grades":
      return { assignments: [{ grades: [{}] }] };
    case "mod_quiz_get_quizzes_by_courses":
      return { quizzes: [{}] };
    case "mod_quiz_get_user_attempts":
      return { attempts: [{}] };
    case "mod_quiz_get_attempt_review":
      return { questions: [{}] };
    case "mod_h5pactivity_get_h5pactivities_by_courses":
      return { h5pactivities: [{}] };
    case "mod_h5pactivity_get_attempts":
    case "mod_h5pactivity_get_results":
      return { attempts: [{}] };
    case "mod_scorm_get_scorms_by_courses":
      return { scorms: [{}] };
    case "mod_scorm_get_scorm_sco_tracks":
      return { data: { tracks: [{}] } };
    case "mod_lesson_get_lessons_by_courses":
      return { lessons: [{}] };
    case "mod_lesson_get_user_grade":
      return { grade: 0 };
    case "mod_book_get_books_by_courses":
      return { books: [{}] };
    case "mod_page_get_pages_by_courses":
      return { pages: [{}] };
    case "mod_resource_get_resources_by_courses":
      return { resources: [{}] };
    case "mod_url_get_urls_by_courses":
      return { urls: [{}] };
    default:
      throw new Error(`Unexpected contract function: ${functionName}`);
  }
}

function fakeClient(
  payloadFor: (functionName: MoodleReadFunction) => unknown = contractPayload
): Pick<MoodleClient, "call" | "probe"> {
  return {
    async call<T>(functionName: MoodleReadFunction) {
      return payloadFor(functionName) as T;
    },
    async probe() {
      return {
        mode: "read_only" as const,
        verifiedAt: "2026-07-13T12:00:00.000Z",
        site: {
          name: "M2C Sandbox",
          url: "https://moodle.example.test",
        },
        availableFunctionCount: MOODLE_READ_FUNCTIONS.length,
        approvedFunctionCount: MOODLE_READ_FUNCTIONS.length,
        missingApprovedFunctions: [],
        unexpectedFunctions: [],
        minimumPrivilegeVerified: true,
      };
    },
  };
}

describe("Moodle M2C read validator", () => {
  it("parses every one of the 30 dispatched read contracts before accepting it", async () => {
    const parsedFunctions: MoodleReadFunction[] = [];
    const parseResponse = vi.fn((functionName: MoodleReadFunction) => {
      parsedFunctions.push(functionName);
      return [];
    });

    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () => fakeClient(),
      parseResponse,
    });

    expect(result.exitCode).toBe(0);
    expect(result.results).toHaveLength(MOODLE_READ_FUNCTIONS.length);
    expect(parseResponse).toHaveBeenCalledTimes(30);
    expect(parsedFunctions).toEqual(MOODLE_PROJECTION_FUNCTIONS);
    expect(result.results.every(item => item.ok)).toBe(true);
  });

  it("fails closed when the parser rejects a malformed provider payload", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "core_course_get_categories"
            ? [{}]
            : contractPayload(functionName)
        ),
    });

    expect(
      result.results.find(
        item => item.function === "core_course_get_categories"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
    expect(result.exitCode).toBe(1);
  });

  it("rejects a leaky parsed projection instead of accepting the contract", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () => fakeClient(),
      parseResponse: functionName =>
        functionName === "core_course_get_categories"
          ? [{ sourceId: "1", email: "private@example.test" }]
          : [],
    });

    expect(
      result.results.find(
        item => item.function === "core_course_get_categories"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
    expect(result.exitCode).toBe(1);
  });

  it("keeps zero-count and warning fixture gaps distinct from parser failures", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName => {
          if (functionName === "core_course_get_categories") return [];
          if (functionName === "core_course_get_courses_by_field") {
            return { courses: [{}], warnings: [{ warningcode: "missing" }] };
          }
          return contractPayload(functionName);
        }),
      parseResponse: () => [],
    });

    expect(result.exitCode).toBe(2);
    expect(
      result.results.find(
        item => item.function === "core_course_get_categories"
      )
    ).toMatchObject({ ok: false, errorCode: "fixture_absent", count: 0 });
    expect(
      result.results.find(
        item => item.function === "core_course_get_courses_by_field"
      )
    ).toMatchObject({ ok: false, errorCode: "fixture_absent", count: 1 });
  });
});
