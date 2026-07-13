import { describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import type { MoodleClient } from "../../../../server/moodleClient";
import {
  MoodleApiError,
  MOODLE_READ_FUNCTIONS,
} from "../../../../server/moodleClient";
import { registerMoodleRoutes } from "../../../../server/moodleRoutes";

type RouteHandler = (
  request: unknown,
  response: unknown
) => Promise<void> | void;

const baseSession: ServerSession = {
  id: "session-admin",
  userId: "usr_admin_demo",
  email: "admin@nilelearn.local",
  name: "Admin Demo",
  roles: ["superadmin"],
  activeRole: "superadmin",
  provider: "demo",
  authorizationModel: "snapshot",
  createdAt: "2026-07-12T09:00:00.000Z",
  expiresAt: "2026-07-12T21:00:00.000Z",
};

function captureRoute(
  dependencies: Parameters<typeof registerMoodleRoutes>[1]
) {
  const routes = new Map<string, RouteHandler>();
  registerMoodleRoutes(
    {
      get(path, handler) {
        routes.set(path, handler as RouteHandler);
      },
    },
    dependencies
  );
  return routes.get("/api/integrations/moodle/status")!;
}

function responseRecorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { response, result };
}

function fakeClient(probe: MoodleClient["probe"]): MoodleClient {
  return {
    mode: "read_only",
    call: vi.fn(),
    probe,
    getCourses: vi.fn(),
    getCourseContents: vi.fn(),
  } as MoodleClient;
}

describe("Moodle integration status route", () => {
  it("requires an authenticated Super Admin before revealing provider state", async () => {
    const getClient = vi.fn(() => fakeClient(vi.fn()));
    const anonymousHandler = captureRoute({
      getSession: async () => null,
      getClient,
    });
    const anonymous = responseRecorder();
    await anonymousHandler({}, anonymous.response);
    expect(anonymous.result).toEqual({
      status: 401,
      body: { error: "Sign in required." },
    });

    const teacherHandler = captureRoute({
      getSession: async () => ({
        ...baseSession,
        activeRole: "teacher",
        roles: ["teacher"],
      }),
      getClient,
    });
    const teacher = responseRecorder();
    await teacherHandler({}, teacher.response);
    expect(teacher.result).toEqual({
      status: 403,
      body: { error: "Super Admin access required." },
    });
    expect(getClient).not.toHaveBeenCalled();
  });

  it("returns a safe disabled state without constructing a provider client", async () => {
    const getClient = vi.fn(() => fakeClient(vi.fn()));
    const handler = captureRoute({
      getSession: async () => baseSession,
      getClient,
      getStatus: () => ({
        enabled: false,
        baseUrlConfigured: false,
        serviceConfigured: false,
        tokenConfigured: false,
        allowedHostsConfigured: false,
        configured: false,
        mode: "read_only",
      }),
    });
    const { response, result } = responseRecorder();

    await handler({}, response);

    expect(result).toEqual({
      status: 200,
      body: {
        enabled: false,
        baseUrlConfigured: false,
        serviceConfigured: false,
        tokenConfigured: false,
        allowedHostsConfigured: false,
        configured: false,
        mode: "read_only",
        state: "disabled",
      },
    });
    expect(getClient).not.toHaveBeenCalled();
  });

  it("reports ready only after a live server-side capability probe", async () => {
    const probe = vi.fn(async () => ({
      mode: "read_only" as const,
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
    }));
    const handler = captureRoute({
      getSession: async () => baseSession,
      getClient: () => fakeClient(probe),
      getStatus: () => ({
        enabled: true,
        baseUrlConfigured: true,
        serviceConfigured: true,
        tokenConfigured: true,
        allowedHostsConfigured: true,
        configured: true,
        mode: "read_only",
      }),
    });
    const { response, result } = responseRecorder();

    await handler({}, response);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      configured: true,
      mode: "read_only",
      state: "ready",
      probe: {
        site: { name: "Moodle Sandbox", release: "4.5.12+" },
        missingApprovedFunctions: [],
        unexpectedFunctions: [],
        minimumPrivilegeVerified: true,
      },
    });
    expect(result.body).not.toHaveProperty("token");
    expect(JSON.stringify(result.body)).not.toContain("secret-value");
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("preserves safe provider error classification", async () => {
    const handler = captureRoute({
      getSession: async () => baseSession,
      getClient: () =>
        fakeClient(
          vi.fn(async () => {
            throw new MoodleApiError(
              "Moodle service account lacks an approved function.",
              403,
              "permission"
            );
          })
        ),
      getStatus: () => ({
        enabled: true,
        baseUrlConfigured: true,
        serviceConfigured: true,
        tokenConfigured: true,
        allowedHostsConfigured: true,
        configured: true,
        mode: "read_only",
      }),
    });
    const { response, result } = responseRecorder();

    await handler({}, response);

    expect(result).toEqual({
      status: 403,
      body: {
        error: "Moodle service account lacks required read access.",
        code: "permission",
      },
    });
  });

  it("reports a broad service as degraded instead of ready", async () => {
    const handler = captureRoute({
      getSession: async () => baseSession,
      getClient: () =>
        fakeClient(
          vi.fn(async () => ({
            mode: "read_only" as const,
            verifiedAt: "2026-07-12T10:00:00.000Z",
            site: {
              name: "Moodle Sandbox",
              url: "https://moodle.example.test",
            },
            availableFunctionCount: MOODLE_READ_FUNCTIONS.length + 1,
            approvedFunctionCount: MOODLE_READ_FUNCTIONS.length,
            missingApprovedFunctions: [],
            unexpectedFunctions: ["core_user_create_users"],
            minimumPrivilegeVerified: false,
          }))
        ),
      getStatus: () => ({
        enabled: true,
        baseUrlConfigured: true,
        serviceConfigured: true,
        tokenConfigured: true,
        allowedHostsConfigured: true,
        configured: true,
        mode: "read_only",
      }),
    });
    const { response, result } = responseRecorder();

    await handler({}, response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        state: "degraded",
        probe: {
          unexpectedFunctions: ["core_user_create_users"],
          minimumPrivilegeVerified: false,
        },
      },
    });
  });
});
