import { describe, expect, it, vi } from "vitest";

import {
  MOODLE_READ_FUNCTIONS,
  type MoodleClient,
  type MoodleReadFunction,
} from "../../../../server/moodleClient";
import {
  MOODLE_SANDBOX_WRITE_ACK,
  MOODLE_SANDBOX_WRITE_HOST,
} from "../../../../server/moodleSandboxWriteClient";
import {
  createMoodleReadProjectionFingerprint,
  createMoodleReadProjectionFingerprints,
  createMoodleSandboxSyntheticRun,
  runMoodleSandboxWriteValidation,
  toSafeMoodleSandboxWriteFailure,
  validateMoodleSandboxWriteEnvironment,
} from "../../../../scripts/validate-moodle-sandbox-writes";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    MOODLE_READ_ONLY_ENABLED: "1",
    MOODLE_BASE_URL: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
    MOODLE_SERVICE: "nilelearn_m2_read_sandbox",
    MOODLE_TOKEN: "read-token-only",
    MOODLE_ALLOWED_HOSTS: MOODLE_SANDBOX_WRITE_HOST,
    MOODLE_SANDBOX_WRITE_ENABLED: "1",
    MOODLE_SANDBOX_WRITE_BASE_URL: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
    MOODLE_SANDBOX_WRITE_SERVICE: "nilelearn_m2b_write_sandbox",
    MOODLE_SANDBOX_WRITE_TOKEN: "write-token-only",
    MOODLE_SANDBOX_WRITE_SYNTHETIC_ACK: MOODLE_SANDBOX_WRITE_ACK,
    MOODLE_SANDBOX_WRITE_COURSE_ID: "42",
    MOODLE_SANDBOX_WRITE_ROLE_ID: "5",
  };
}

function fakeReadClient(options?: {
  reverseSets?: boolean;
  reverseSections?: boolean;
}): Pick<MoodleClient, "call" | "probe"> {
  const call: Pick<MoodleClient, "call">["call"] = async <T>(
    functionName: MoodleReadFunction
  ) => {
    if (functionName === "core_course_get_courses_by_field") {
      return {
        warnings: [],
        courses: [{ shortname: "M2B", id: 42 }],
      } as T;
    }
    if (functionName === "core_course_get_contents") {
      const sections = [
        { id: 2, name: "Second" },
        { id: 1, name: "First" },
      ];
      return (
        options?.reverseSections ? [...sections].reverse() : sections
      ) as T;
    }
    if (functionName === "core_enrol_get_enrolled_users") {
      const users = [
        { id: 2, roles: [{ roleid: 5 }] },
        { id: 1, roles: [{ roleid: 5 }] },
      ];
      return (options?.reverseSets ? [...users].reverse() : users) as T;
    }
    if (functionName === "core_group_get_course_groups") return [] as T;
    if (functionName === "core_group_get_course_groupings") return [] as T;
    throw new Error("Unexpected read call.");
  };

  return {
    call,
    async probe() {
      return {
        mode: "read_only",
        verifiedAt: options?.reverseSets
          ? "2026-07-13T12:01:00.000Z"
          : "2026-07-13T12:00:00.000Z",
        site: {
          name: "M2B Sandbox",
          url: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
          release: "4.5",
          version: "2024100700",
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

describe("Moodle M2B validation CLI", () => {
  it("requires exact sandbox, acknowledgement, and separate credentials", () => {
    const valid = validEnvironment();
    expect(validateMoodleSandboxWriteEnvironment(valid)).toEqual({
      courseId: 42,
      roleId: 5,
    });

    expect(() =>
      validateMoodleSandboxWriteEnvironment({
        ...valid,
        MOODLE_SANDBOX_WRITE_TOKEN: valid.MOODLE_TOKEN,
      })
    ).toThrow("validation failed (configuration)");
    expect(() =>
      validateMoodleSandboxWriteEnvironment({
        ...valid,
        MOODLE_SANDBOX_WRITE_BASE_URL: "https://example.com",
      })
    ).toThrow("validation failed (configuration)");
  });

  it("generates marker-bound fake identity and a strong one-run password", () => {
    const generated = createMoodleSandboxSyntheticRun(
      new Date("2026-07-13T12:00:00.000Z"),
      size => Buffer.alloc(size, size === 4 ? 0xab : 0xcd)
    );

    expect(generated.marker).toBe("NILE-M2B-20260713T120000Z-abababab");
    expect(generated.user.email).toMatch(/@example\.invalid$/);
    expect(generated.user.marker).toBe(generated.marker);
    expect(generated.groupName).toContain(generated.marker);
    expect(generated.user.password).toMatch(/[a-z]/);
    expect(generated.user.password).toMatch(/[A-Z]/);
    expect(generated.user.password).toMatch(/\d/);
    expect(generated.user.password).toMatch(/[^A-Za-z0-9]/);
    expect(generated.user.password.length).toBeGreaterThanOrEqual(24);
  });

  it("accepts only a canonical explicit marker for interrupted-run recovery", () => {
    const recoveryMarker = "NILE-M2B-20260713T120000Z-a1b2c3d4";
    const environment = {
      ...validEnvironment(),
      MOODLE_SANDBOX_WRITE_RUN_MARKER: recoveryMarker,
    };

    expect(validateMoodleSandboxWriteEnvironment(environment)).toEqual({
      courseId: 42,
      roleId: 5,
      runMarker: recoveryMarker,
    });
    expect(
      createMoodleSandboxSyntheticRun(
        new Date("2026-07-13T12:30:00.000Z"),
        size => Buffer.alloc(size, 0xcd),
        recoveryMarker
      )
    ).toMatchObject({
      marker: recoveryMarker,
      user: {
        marker: recoveryMarker,
        username: "nile-m2b-20260713t120000z-a1b2c3d4",
        email: "nile-m2b-20260713t120000z-a1b2c3d4@example.invalid",
      },
      groupName: `Nile Learn M2B ${recoveryMarker}`,
    });
    expect(() =>
      validateMoodleSandboxWriteEnvironment({
        ...environment,
        MOODLE_SANDBOX_WRITE_RUN_MARKER: "NILE-M2B-not-canonical",
      })
    ).toThrow("validation failed (configuration)");
  });

  it("keeps true sets stable while preserving semantic Moodle section order", async () => {
    await expect(
      createMoodleReadProjectionFingerprint(fakeReadClient(), 42)
    ).resolves.toBe(
      await createMoodleReadProjectionFingerprint(
        fakeReadClient({ reverseSets: true }),
        42
      )
    );

    await expect(
      createMoodleReadProjectionFingerprint(fakeReadClient(), 42)
    ).resolves.not.toBe(
      await createMoodleReadProjectionFingerprint(
        fakeReadClient({ reverseSections: true }),
        42
      )
    );
  });

  it("records per-family hashes and a combined root", async () => {
    const fingerprints = await createMoodleReadProjectionFingerprints(
      fakeReadClient(),
      42
    );

    expect(Object.keys(fingerprints.families).sort()).toEqual([
      "contents",
      "course",
      "enrolledUsers",
      "groupings",
      "groups",
      "probe",
    ]);
    expect(fingerprints.root).toMatch(/^[0-9a-f]{64}$/);
    Object.values(fingerprints.families).forEach(hash =>
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    );
  });

  it("runs the workflow once and returns only redacted evidence", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const workflow = vi.fn(async options => {
      captured.push(options as unknown as Record<string, unknown>);
      return {
        outcome: "completed" as const,
        ensurePasses: 2 as const,
        evidence: [
          { operation: "read_probe" as const, outcome: "verified" as const },
          {
            operation: "cleanup_verify" as const,
            outcome: "verified" as const,
            courseId: 42,
            roleId: 5,
            userId: 100,
            groupId: 200,
          },
        ],
        cleanup: {
          membership: "absent" as const,
          group: "absent" as const,
          enrolment: "absent" as const,
          user: "absent" as const,
        },
      };
    });

    const result = await runMoodleSandboxWriteValidation(validEnvironment(), {
      createReadClient: () => fakeReadClient(),
      createWriteClient: () => ({}) as never,
      runWorkflow: workflow,
      now: () => new Date("2026-07-13T12:00:00.000Z"),
      randomBytes: size => Buffer.alloc(size, size === 4 ? 0xab : 0xcd),
    });

    expect(workflow).toHaveBeenCalledTimes(1);
    expect(result.readProjection).toMatchObject({ unchanged: true });
    const synthetic = captured[0].user as {
      marker: string;
      username: string;
      email: string;
      password: string;
    };
    const output = JSON.stringify(result);
    for (const privateValue of [
      synthetic.marker,
      synthetic.username,
      synthetic.email,
      synthetic.password,
      validEnvironment().MOODLE_TOKEN,
      validEnvironment().MOODLE_SANDBOX_WRITE_TOKEN,
    ]) {
      expect(output).not.toContain(privateValue);
    }
  });

  it("does not expose unexpected error messages", () => {
    const failure = toSafeMoodleSandboxWriteFailure(
      new Error("secret-token-and-identity")
    );
    expect(failure.errorCode).toBe("unexpected");
    expect(JSON.stringify(failure)).not.toContain("secret-token-and-identity");
  });
});
