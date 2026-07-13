import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMoodleSandboxWriteClient,
  createMoodleSandboxWriteClientFromEnvironment,
  getMoodleSandboxWriteServerStatus,
  isMoodleSandboxMarker,
  MOODLE_SANDBOX_WRITE_ACK,
  MOODLE_SANDBOX_WRITE_FUNCTIONS,
  MOODLE_SANDBOX_WRITE_HOST,
  MoodleSandboxWriteError,
} from "../../../../server/moodleSandboxWriteClient";

const marker = "NILE-M2B-20260713T120000Z-a1b2c3d4";
const syntheticUsername = "nile-m2b-20260713t120000z-a1b2c3d4";
const syntheticEmail = `${syntheticUsername}@example.invalid`;
const syntheticPassword = "Nile-M2B-OneRun!20260713#a1b2c3d4";
const publicResolution = async () => [{ address: "93.184.216.34", family: 4 }];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function siteInfo(
  functions: readonly string[] = MOODLE_SANDBOX_WRITE_FUNCTIONS
) {
  return {
    sitename: "Nile M2B Practice",
    siteurl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
    release: "4.5.12+",
    version: "2024100712.00",
    functions: functions.map(name => ({ name })),
  };
}

function configuredClient(fetchImpl: typeof fetch) {
  return createMoodleSandboxWriteClient({
    enabled: true,
    baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
    service: "nile_m2b_sandbox_write",
    token: "server-only-sandbox-write-token",
    syntheticAck: MOODLE_SANDBOX_WRITE_ACK,
    allowedCourseId: 42,
    allowedRoleId: 5,
    fetchImpl,
    resolveHostname: publicResolution,
    now: () => new Date("2026-07-13T12:00:00.000Z"),
  });
}

async function verifiedClient(fetchImpl: typeof fetch) {
  const client = configuredClient(fetchImpl);
  await client.probe();
  return client;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("server-only Moodle sandbox write client", () => {
  it("is disabled by default and requires separate complete write configuration", () => {
    expect(() =>
      createMoodleSandboxWriteClient({
        enabled: false,
        baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
        service: "nile_m2b_sandbox_write",
        token: "token",
        syntheticAck: MOODLE_SANDBOX_WRITE_ACK,
        allowedCourseId: 42,
        allowedRoleId: 5,
      })
    ).toThrowError(
      expect.objectContaining<MoodleSandboxWriteError>({
        code: "configuration",
      })
    );

    expect(() =>
      createMoodleSandboxWriteClient({
        enabled: true,
        baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
        service: "nile_m2b_sandbox_write",
        token: "token",
        syntheticAck: `${MOODLE_SANDBOX_WRITE_ACK} `,
        allowedCourseId: 42,
        allowedRoleId: 5,
      })
    ).toThrowError(
      expect.objectContaining<MoodleSandboxWriteError>({
        code: "configuration",
      })
    );

    expect(
      getMoodleSandboxWriteServerStatus({
        MOODLE_READ_ONLY_ENABLED: "1",
        MOODLE_BASE_URL: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
        MOODLE_SERVICE: "read_service",
        MOODLE_TOKEN: "read-token",
      } as NodeJS.ProcessEnv)
    ).toEqual({
      enabled: false,
      baseUrlConfigured: false,
      serviceConfigured: false,
      tokenConfigured: false,
      readServiceSeparated: true,
      readTokenSeparated: true,
      syntheticAckConfigured: false,
      allowedCourseIdConfigured: false,
      allowedRoleIdConfigured: false,
      configured: false,
      mode: "sandbox_write",
    });
  });

  it("rejects reuse of the read service or token namespace", () => {
    const baseEnvironment = {
      MOODLE_SANDBOX_WRITE_ENABLED: "1",
      MOODLE_SANDBOX_WRITE_BASE_URL: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
      MOODLE_SANDBOX_WRITE_SERVICE: "write_service",
      MOODLE_SANDBOX_WRITE_TOKEN: "write-token",
      MOODLE_SANDBOX_WRITE_SYNTHETIC_ACK: MOODLE_SANDBOX_WRITE_ACK,
      MOODLE_SANDBOX_WRITE_COURSE_ID: "42",
      MOODLE_SANDBOX_WRITE_ROLE_ID: "5",
    } as NodeJS.ProcessEnv;

    expect(() =>
      createMoodleSandboxWriteClientFromEnvironment({
        ...baseEnvironment,
        MOODLE_SERVICE: "write_service",
        MOODLE_TOKEN: "read-token",
      })
    ).toThrowError(
      expect.objectContaining<MoodleSandboxWriteError>({
        code: "configuration",
      })
    );
    expect(() =>
      createMoodleSandboxWriteClientFromEnvironment({
        ...baseEnvironment,
        MOODLE_SERVICE: "read_service",
        MOODLE_TOKEN: "write-token",
      })
    ).toThrowError(
      expect.objectContaining<MoodleSandboxWriteError>({
        code: "configuration",
      })
    );
  });

  it("restricts writes to the exact HTTPS sandbox host and public DNS", async () => {
    for (const baseUrl of [
      "https://moodle.example.test",
      `http://${MOODLE_SANDBOX_WRITE_HOST}`,
      `https://${MOODLE_SANDBOX_WRITE_HOST}:8443`,
    ]) {
      expect(() =>
        createMoodleSandboxWriteClient({
          enabled: true,
          baseUrl,
          service: "nile_m2b_sandbox_write",
          token: "token",
          syntheticAck: MOODLE_SANDBOX_WRITE_ACK,
          allowedCourseId: 42,
          allowedRoleId: 5,
        })
      ).toThrowError(
        expect.objectContaining<MoodleSandboxWriteError>({
          code: "configuration",
        })
      );
    }

    const client = createMoodleSandboxWriteClient({
      enabled: true,
      baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
      service: "nile_m2b_sandbox_write",
      token: "token",
      syntheticAck: MOODLE_SANDBOX_WRITE_ACK,
      allowedCourseId: 42,
      allowedRoleId: 5,
      fetchImpl: vi.fn<typeof fetch>(),
      resolveHostname: async () => [{ address: "127.0.0.1", family: 4 }],
    });

    await expect(client.probe()).rejects.toMatchObject({
      statusCode: 503,
      code: "configuration",
    });
  });

  it("enforces the exact function allowlist and requires a strict probe before writes", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        siteInfo([
          ...MOODLE_SANDBOX_WRITE_FUNCTIONS,
          "core_course_create_courses",
        ])
      )
    );
    const client = configuredClient(fetchImpl);

    await expect(
      client.call("core_course_create_courses" as never)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "function_not_allowed",
    });
    await expect(client.probe()).resolves.toMatchObject({
      unexpectedFunctions: ["core_course_create_courses"],
      minimumPrivilegeVerified: false,
    });
    await expect(
      client.deleteUser({ marker, userId: 44 })
    ).rejects.toMatchObject({ code: "guard" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects reserved protocol fields at any nesting depth", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(siteInfo()));
    const client = await verifiedClient(fetchImpl);

    await expect(
      client.call(
        "core_user_create_users",
        {
          users: [
            {
              username: syntheticUsername,
              firstname: "Practice",
              lastname: "Learner",
              email: syntheticEmail,
              idnumber: marker,
              password: syntheticPassword,
              wsfunction: "core_course_create_courses",
            },
          ],
        },
        { marker }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "function_not_allowed",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires a canonical marker, fake identity, bounded text, and one-item calls", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(siteInfo()));
    const client = await verifiedClient(fetchImpl);

    expect(isMoodleSandboxMarker(marker)).toBe(true);
    expect(isMoodleSandboxMarker("NILE-M2B-20260230T120000Z-a1b2c3d4")).toBe(
      false
    );
    await expect(
      client.createUser({
        marker: "NILE-M2B-bad",
        username: syntheticUsername,
        firstName: "Practice",
        lastName: "Learner",
        email: syntheticEmail,
        password: syntheticPassword,
      })
    ).rejects.toMatchObject({ code: "guard" });
    await expect(
      client.createUser({
        marker,
        username: syntheticUsername,
        firstName: "Practice",
        lastName: "Learner",
        email: "real-person@example.com",
        password: syntheticPassword,
      })
    ).rejects.toMatchObject({ code: "guard" });
    await expect(
      client.call("core_user_delete_users", { userids: [44, 45] }, { marker })
    ).rejects.toMatchObject({ code: "guard" });
    await expect(
      client.call(
        "core_user_get_users",
        {
          criteria: [{ key: "email", value: syntheticEmail }],
        },
        { marker }
      )
    ).rejects.toMatchObject({ code: "guard" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the token out of the URL and emits one canonical Moodle item", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (
        new URLSearchParams(String(init?.body)).get("wsfunction") ===
        "core_webservice_get_site_info"
      ) {
        return jsonResponse(siteInfo());
      }
      expect(String(input)).toBe(
        `https://${MOODLE_SANDBOX_WRITE_HOST}/webservice/rest/server.php`
      );
      expect(String(input)).not.toContain("server-only-sandbox-write-token");
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("wstoken")).toBe("server-only-sandbox-write-token");
      expect(body.get("wsfunction")).toBe("core_user_create_users");
      expect(body.get("users[0][email]")).toBe(syntheticEmail);
      expect(body.get("users[0][idnumber]")).toBe(marker);
      expect(body.has("users[0][createpassword]")).toBe(false);
      expect(body.has("users[1][email]")).toBe(false);
      expect(body.get("users[0][password]")).toBe(syntheticPassword);
      return jsonResponse([{ id: 44, username: syntheticUsername }]);
    });
    const client = await verifiedClient(fetchImpl);

    await expect(
      client.createUser({
        marker,
        username: syntheticUsername,
        firstName: "Practice",
        lastName: "Learner",
        email: syntheticEmail,
        password: syntheticPassword,
      })
    ).resolves.toEqual({ id: 44, username: syntheticUsername });
  });

  it("uses only the configured course and role IDs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(siteInfo()));
    const client = await verifiedClient(fetchImpl);

    await expect(
      client.call(
        "enrol_manual_enrol_users",
        {
          enrolments: [{ roleid: 6, userid: 44, courseid: 42, suspend: 0 }],
        },
        { marker }
      )
    ).rejects.toMatchObject({ code: "guard" });
    await expect(
      client.call(
        "core_group_create_groups",
        {
          groups: [
            {
              courseid: 43,
              name: `Practice ${marker}`,
              description: `Synthetic proof ${marker}`,
              idnumber: marker,
            },
          ],
        },
        { marker }
      )
    ).rejects.toMatchObject({ code: "guard" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("provides typed one-item methods for the complete approved mutation surface", async () => {
    const requests: URLSearchParams[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = new URLSearchParams(String(init?.body));
      requests.push(body);
      const functionName = body.get("wsfunction");
      if (functionName === "core_webservice_get_site_info") {
        return jsonResponse(siteInfo());
      }
      if (functionName === "core_user_create_users") {
        return jsonResponse([{ id: 44, username: syntheticUsername }]);
      }
      if (functionName === "core_user_get_users") {
        return jsonResponse({
          users: [
            {
              id: 44,
              username: syntheticUsername,
              firstname: "Practice",
              lastname: "Learner",
              email: syntheticEmail,
              deleted: false,
            },
          ],
          warnings: [],
        });
      }
      if (functionName === "core_user_update_users") {
        return jsonResponse({ warnings: [] });
      }
      if (functionName === "core_group_create_groups") {
        return jsonResponse([
          {
            id: 77,
            courseid: 42,
            name: `Practice ${marker}`,
            idnumber: marker,
            enrolmentkey: "",
          },
        ]);
      }
      return jsonResponse(null);
    });
    const client = await verifiedClient(fetchImpl);
    const identity = {
      marker,
      username: syntheticUsername,
      firstName: "Practice",
      lastName: "Learner",
      email: syntheticEmail,
      password: syntheticPassword,
    };

    await client.createUser(identity);
    await expect(client.findUsersByMarker(marker)).resolves.toEqual([
      {
        id: 44,
        username: syntheticUsername,
        firstName: "Practice",
        lastName: "Learner",
        email: syntheticEmail,
        marker,
      },
    ]);
    await client.updateUser({ ...identity, userId: 44 });
    await client.enrolUser({ marker, userId: 44 });
    await client.unenrolUser({ marker, userId: 44 });
    const group = await client.createGroup({
      marker,
      name: `Practice ${marker}`,
      description: `Synthetic proof ${marker}`,
    });
    await client.addGroupMember({ marker, groupId: group.id, userId: 44 });
    await client.deleteGroupMember({ marker, groupId: group.id, userId: 44 });
    await client.deleteGroup({ marker, groupId: group.id });
    await client.deleteUser({ marker, userId: 44 });

    const calledFunctions = requests.map(body => body.get("wsfunction"));
    expect(calledFunctions).toHaveLength(MOODLE_SANDBOX_WRITE_FUNCTIONS.length);
    expect(new Set(calledFunctions)).toEqual(
      new Set(MOODLE_SANDBOX_WRITE_FUNCTIONS)
    );
    expect(requests[4].get("enrolments[0][courseid]")).toBe("42");
    expect(requests[4].get("enrolments[0][roleid]")).toBe("5");
    expect(requests[6].get("groups[0][courseid]")).toBe("42");
    expect(requests[6].get("groups[0][description]")).toBe(
      `Synthetic proof ${marker}`
    );
    expect(requests.every(body => !body.has("enrolments[1][userid]"))).toBe(
      true
    );
  });

  it("fails closed on malformed probes and strict write response mismatches", async () => {
    const wrongSiteClient = configuredClient(
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ ...siteInfo(), siteurl: "https://moodle.example.test" })
      )
    );
    await expect(wrongSiteClient.probe()).rejects.toMatchObject({
      code: "invalid_response",
    });

    const duplicateClient = configuredClient(
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          siteInfo([
            ...MOODLE_SANDBOX_WRITE_FUNCTIONS,
            MOODLE_SANDBOX_WRITE_FUNCTIONS[0],
          ])
        )
      )
    );
    await expect(duplicateClient.probe()).resolves.toMatchObject({
      hasDuplicateFunctions: true,
      minimumPrivilegeVerified: false,
    });

    const malformedWriteFetch = vi.fn<typeof fetch>(async (_input, init) => {
      const functionName = new URLSearchParams(String(init?.body)).get(
        "wsfunction"
      );
      return jsonResponse(
        functionName === "core_webservice_get_site_info" ? siteInfo() : {}
      );
    });
    const malformedWriteClient = await verifiedClient(malformedWriteFetch);
    await expect(
      malformedWriteClient.deleteUser({ marker, userId: 44 })
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("redacts provider-controlled errors, tokens, and synthetic identity values", async () => {
    const secretToken = "server-only-sandbox-write-token";
    const privateValue = "real-person@example.com";
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const functionName = new URLSearchParams(String(init?.body)).get(
        "wsfunction"
      );
      if (functionName === "core_webservice_get_site_info") {
        return jsonResponse(siteInfo());
      }
      return jsonResponse({
        exception: "moodle_exception",
        errorcode: "invalidtoken",
        message: `Rejected ${secretToken} for ${privateValue}`,
      });
    });
    const client = await verifiedClient(fetchImpl);

    let caught: unknown;
    try {
      await client.deleteUser({ marker, userId: 44 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      code: "authentication",
      statusCode: 401,
      message: "Moodle sandbox write credentials were rejected.",
    });
    expect(String(caught)).not.toContain(secretToken);
    expect(String(caught)).not.toContain(privateValue);
  });

  it("bounds provider responses and the combined DNS plus HTTP timeout", async () => {
    const oversizedClient = createMoodleSandboxWriteClient({
      enabled: true,
      baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
      service: "nile_m2b_sandbox_write",
      token: "token",
      syntheticAck: MOODLE_SANDBOX_WRITE_ACK,
      allowedCourseId: 42,
      allowedRoleId: 5,
      maxResponseBytes: 1_024,
      fetchImpl: vi.fn<typeof fetch>(async () =>
        jsonResponse({ data: "x".repeat(2_000) })
      ),
      resolveHostname: publicResolution,
    });
    await expect(oversizedClient.probe()).rejects.toMatchObject({
      code: "invalid_response",
    });

    vi.useFakeTimers();
    const timeoutClient = createMoodleSandboxWriteClient({
      enabled: true,
      baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
      service: "nile_m2b_sandbox_write",
      token: "token",
      syntheticAck: MOODLE_SANDBOX_WRITE_ACK,
      allowedCourseId: 42,
      allowedRoleId: 5,
      timeoutMs: 1_000,
      fetchImpl: vi.fn<typeof fetch>(),
      resolveHostname: async () => new Promise(() => undefined),
    });
    const request = expect(timeoutClient.probe()).rejects.toMatchObject({
      code: "timeout",
      statusCode: 504,
    });
    await vi.advanceTimersByTimeAsync(1_001);
    await request;
  });
});
