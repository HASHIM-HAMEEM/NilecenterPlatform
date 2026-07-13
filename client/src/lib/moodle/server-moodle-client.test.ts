import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMoodleClient,
  getMoodleServerStatus,
  MOODLE_READ_FUNCTIONS,
  MoodleApiError,
} from "../../../../server/moodleClient";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const resolvePublicHost = async () => [{ address: "93.184.216.34", family: 4 }];

function configuredClient(fetchImpl: typeof fetch) {
  return createMoodleClient({
    enabled: true,
    baseUrl: "https://moodle.example.test/learning",
    token: "server-only-test-token",
    allowedHosts: ["moodle.example.test"],
    fetchImpl,
    resolveHostname: resolvePublicHost,
    now: () => new Date("2026-07-12T10:00:00.000Z"),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("server-only Moodle read client", () => {
  it("probes the approved function contract without putting the token in the URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      expect(url).toBe(
        "https://moodle.example.test/learning/webservice/rest/server.php"
      );
      expect(url).not.toContain("server-only-test-token");
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("wstoken")).toBe("server-only-test-token");
      expect(body.get("wsfunction")).toBe("core_webservice_get_site_info");
      return jsonResponse({
        sitename: "Moodle Sandbox",
        siteurl: "https://moodle.example.test",
        release: "4.5.12+",
        version: "2024100712.00",
        functions: MOODLE_READ_FUNCTIONS.map(name => ({ name })),
      });
    });
    const client = configuredClient(fetchImpl);

    await expect(client.probe()).resolves.toEqual({
      mode: "read_only",
      verifiedAt: "2026-07-12T10:00:00.000Z",
      site: {
        name: "Moodle Sandbox",
        url: "https://moodle.example.test",
        release: "4.5.12+",
        version: "2024100712.00",
      },
      availableFunctionCount: MOODLE_READ_FUNCTIONS.length,
      approvedFunctionCount: MOODLE_READ_FUNCTIONS.length,
      missingApprovedFunctions: [],
      unexpectedFunctions: [],
      minimumPrivilegeVerified: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("parses course discovery and nested course content requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = new URLSearchParams(String(init?.body));
      if (body.get("wsfunction") === "core_course_get_courses_by_field") {
        return jsonResponse({
          courses: [
            {
              id: 42,
              fullname: "Arabic Level 1",
              shortname: "AR-L1",
            },
          ],
          warnings: [],
        });
      }
      expect(body.get("wsfunction")).toBe("core_course_get_contents");
      expect(body.get("courseid")).toBe("42");
      return jsonResponse([{ id: 7, name: "Week 1", section: 1, modules: [] }]);
    });
    const client = configuredClient(fetchImpl);

    await expect(client.getCourses()).resolves.toEqual({
      courses: [{ id: 42, fullname: "Arabic Level 1", shortname: "AR-L1" }],
      warnings: [],
    });
    await expect(client.getCourseContents(42)).resolves.toEqual([
      { id: 7, name: "Week 1", section: 1, modules: [] },
    ]);
  });

  it("fails closed for disabled, insecure, missing, and write-capable configuration", async () => {
    expect(() =>
      createMoodleClient({
        enabled: false,
        baseUrl: "https://moodle.example.test",
        token: "token",
        allowedHosts: ["moodle.example.test"],
      })
    ).toThrowError(
      expect.objectContaining<MoodleApiError>({ code: "configuration" })
    );
    expect(() =>
      createMoodleClient({
        enabled: true,
        baseUrl: "http://moodle.example.test",
        token: "token",
        allowedHosts: ["moodle.example.test"],
      })
    ).toThrowError(
      expect.objectContaining<MoodleApiError>({ code: "configuration" })
    );
    expect(() =>
      createMoodleClient({
        enabled: true,
        baseUrl: "https://moodle.example.test",
        token: "",
        allowedHosts: ["moodle.example.test"],
      })
    ).toThrowError(
      expect.objectContaining<MoodleApiError>({ code: "configuration" })
    );

    const client = configuredClient(vi.fn<typeof fetch>());
    await expect(
      client.call("core_user_create_users" as never)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "function_not_allowed",
    });

    const fetchImpl = vi.fn<typeof fetch>();
    const reservedParameterClient = configuredClient(fetchImpl);
    await expect(
      reservedParameterClient.call("core_webservice_get_site_info", {
        wsfunction: "core_user_create_users",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "function_not_allowed",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects hosts outside the explicit allowlist and private DNS results", async () => {
    expect(() =>
      createMoodleClient({
        enabled: true,
        baseUrl: "https://other.example.test",
        token: "token",
        allowedHosts: ["moodle.example.test"],
      })
    ).toThrowError(
      expect.objectContaining<MoodleApiError>({ code: "configuration" })
    );
    expect(() =>
      createMoodleClient({
        enabled: true,
        baseUrl: "https://169.254.169.254",
        token: "token",
        allowedHosts: ["169.254.169.254"],
      })
    ).toThrowError(
      expect.objectContaining<MoodleApiError>({ code: "configuration" })
    );

    const client = createMoodleClient({
      enabled: true,
      baseUrl: "https://moodle.example.test",
      token: "token",
      allowedHosts: ["moodle.example.test"],
      fetchImpl: vi.fn<typeof fetch>(),
      resolveHostname: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    await expect(client.probe()).rejects.toMatchObject({
      statusCode: 503,
      code: "configuration",
    });
  });

  it("does not accept a broad service as minimum privilege", async () => {
    const client = configuredClient(
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          sitename: "Moodle Sandbox",
          siteurl: "https://moodle.example.test",
          functions: [
            ...MOODLE_READ_FUNCTIONS.map(name => ({ name })),
            { name: "core_user_create_users" },
          ],
        })
      )
    );

    await expect(client.probe()).resolves.toMatchObject({
      missingApprovedFunctions: [],
      unexpectedFunctions: ["core_user_create_users"],
      minimumPrivilegeVerified: false,
    });
  });

  it("classifies token, permission, malformed, oversized, and network failures safely", async () => {
    const invalidTokenClient = configuredClient(
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          exception: "moodle_exception",
          errorcode: "invalidtoken",
          message: "Invalid token server-only-test-token",
        })
      )
    );
    await expect(invalidTokenClient.probe()).rejects.toMatchObject({
      statusCode: 401,
      code: "authentication",
      message: "Moodle credentials were rejected.",
    });

    const deniedClient = configuredClient(
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          exception: "webservice_access_exception",
          errorcode: "webservice_access_exception",
          message: "Access denied",
        })
      )
    );
    await expect(deniedClient.probe()).rejects.toMatchObject({
      statusCode: 403,
      code: "permission",
    });

    const malformedClient = configuredClient(
      vi.fn<typeof fetch>(
        async () => new Response("<html>error</html>", { status: 502 })
      )
    );
    await expect(malformedClient.probe()).rejects.toMatchObject({
      statusCode: 502,
      code: "invalid_response",
    });

    const oversizedClient = createMoodleClient({
      enabled: true,
      baseUrl: "https://moodle.example.test",
      token: "server-only-test-token",
      allowedHosts: ["moodle.example.test"],
      maxResponseBytes: 1_024,
      fetchImpl: vi.fn<typeof fetch>(async () =>
        jsonResponse({ data: "x".repeat(2_000) })
      ),
      resolveHostname: resolvePublicHost,
    });
    await expect(oversizedClient.probe()).rejects.toMatchObject({
      statusCode: 502,
      code: "invalid_response",
    });

    const networkClient = configuredClient(
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("fetch failed");
      })
    );
    await expect(networkClient.probe()).rejects.toMatchObject({
      statusCode: 502,
      code: "remote",
      message: "Moodle could not be reached.",
    });
  });

  it("cancels a chunked response as soon as the byte limit is crossed", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("x".repeat(800)));
        controller.enqueue(encoder.encode("x".repeat(800)));
        controller.close();
      },
    });
    const client = createMoodleClient({
      enabled: true,
      baseUrl: "https://moodle.example.test",
      token: "server-only-test-token",
      allowedHosts: ["moodle.example.test"],
      maxResponseBytes: 1_024,
      fetchImpl: vi.fn<typeof fetch>(async () => new Response(stream)),
      resolveHostname: resolvePublicHost,
    });

    await expect(client.probe()).rejects.toMatchObject({
      statusCode: 502,
      code: "invalid_response",
    });
  });

  it("cancels a response whose declared length exceeds the byte limit", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const client = createMoodleClient({
      enabled: true,
      baseUrl: "https://moodle.example.test",
      token: "server-only-test-token",
      allowedHosts: ["moodle.example.test"],
      maxResponseBytes: 1_024,
      fetchImpl: vi.fn<typeof fetch>(
        async () =>
          new Response(stream, { headers: { "Content-Length": "2048" } })
      ),
      resolveHostname: resolvePublicHost,
    });

    await expect(client.probe()).rejects.toMatchObject({
      statusCode: 502,
      code: "invalid_response",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("aborts provider calls at the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    const client = createMoodleClient({
      enabled: true,
      baseUrl: "https://moodle.example.test",
      token: "server-only-test-token",
      allowedHosts: ["moodle.example.test"],
      timeoutMs: 1_000,
      fetchImpl,
      resolveHostname: resolvePublicHost,
    });

    const request = expect(client.probe()).rejects.toMatchObject({
      statusCode: 504,
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(1_001);
    await request;
  });

  it("aborts stalled DNS resolution at the configured timeout", async () => {
    vi.useFakeTimers();
    const client = createMoodleClient({
      enabled: true,
      baseUrl: "https://moodle.example.test",
      token: "server-only-test-token",
      allowedHosts: ["moodle.example.test"],
      timeoutMs: 1_000,
      fetchImpl: vi.fn<typeof fetch>(),
      resolveHostname: async () => new Promise(() => undefined),
    });

    const request = expect(client.probe()).rejects.toMatchObject({
      statusCode: 504,
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(1_001);
    await request;
  });

  it("reports only configuration booleans from environment status", () => {
    expect(
      getMoodleServerStatus({
        MOODLE_READ_ONLY_ENABLED: "1",
        MOODLE_BASE_URL: "https://moodle.example.test",
        MOODLE_SERVICE: "nile_learn_read_projection",
        MOODLE_TOKEN: "secret-value",
        MOODLE_ALLOWED_HOSTS: "moodle.example.test",
      } as NodeJS.ProcessEnv)
    ).toEqual({
      enabled: true,
      baseUrlConfigured: true,
      serviceConfigured: true,
      tokenConfigured: true,
      allowedHostsConfigured: true,
      configured: true,
      mode: "read_only",
    });
  });
});
