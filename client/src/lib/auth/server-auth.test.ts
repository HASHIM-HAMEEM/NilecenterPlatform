import { afterEach, describe, expect, it } from "vitest";
import {
  attachSession,
  changeDemoPasswordForSession,
  confirmDemoPasswordReset,
  endRequestSession,
  getRequestSession,
  requestDemoPasswordReset,
  resetDemoPasswordResetState,
  signIn,
  type ServerSession,
} from "../../../../server/auth";
import { resetDefaultSessionStore, setSessionStore, type SessionStore } from "../../../../server/sessionStore";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED,
  VITE_DEMO_AUTH_ENABLED: process.env.VITE_DEMO_AUTH_ENABLED,
  NILE_DEMO_PASSWORD: process.env.NILE_DEMO_PASSWORD,
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
};

afterEach(() => {
  if (originalEnv.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
  process.env.DEMO_AUTH_ENABLED = originalEnv.DEMO_AUTH_ENABLED;
  process.env.VITE_DEMO_AUTH_ENABLED = originalEnv.VITE_DEMO_AUTH_ENABLED;
  process.env.NILE_DEMO_PASSWORD = originalEnv.NILE_DEMO_PASSWORD;
  process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
  process.env.VITE_SUPABASE_URL = originalEnv.VITE_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_ANON_KEY = originalEnv.VITE_SUPABASE_ANON_KEY;
  resetDemoPasswordResetState();
  resetDefaultSessionStore();
});

describe("server demo auth", () => {
  function useDemoOnlyAuth() {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  }

  it("requires the configured Nile demo password when one is set", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "12345";

    await expect(signIn("s@nl.test", "wrong-password", "student")).rejects.toThrow("Invalid email, password, or role.");

    const session = await signIn("s@nl.test", "12345", "student");
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("student");
    expect(session.userId).toBe("usr_student_demo");
  });

  it("keeps legacy demo-password behavior when no password env is configured", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    delete process.env.NILE_DEMO_PASSWORD;

    const session = await signIn("teacher.demo@nilelearn.local", "demo1234", "teacher");
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("teacher");
  });

  it("keeps demo auth disabled by default in production unless explicitly enabled", async () => {
    useDemoOnlyAuth();
    process.env.NODE_ENV = "production";
    delete process.env.DEMO_AUTH_ENABLED;
    delete process.env.VITE_DEMO_AUTH_ENABLED;
    process.env.NILE_DEMO_PASSWORD = "12345";

    await expect(signIn("s@nl.test", "12345", "student")).rejects.toThrow("Invalid email, password, or role.");

    process.env.DEMO_AUTH_ENABLED = "true";
    const session = await signIn("s@nl.test", "12345", "student");

    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("student");
  });

  it("resets a demo password without changing Supabase auth behavior", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "original-password";

    const request = requestDemoPasswordReset("teacher.demo@nilelearn.local", "teacher");
    expect(request.ok).toBe(true);
    expect(request.demoResetPath).toContain("/auth/reset-password?");

    const params = new URLSearchParams(request.demoResetPath!.split("?")[1]);
    const result = confirmDemoPasswordReset({
      token: params.get("token") ?? "",
      email: params.get("email") ?? "",
      password: "new-demo-password",
    });
    expect(result).toMatchObject({ ok: true, role: "teacher" });

    await expect(signIn("teacher.demo@nilelearn.local", "original-password", "teacher")).resolves.toMatchObject({
      provider: "demo",
    });
    const session = await signIn("teacher.demo@nilelearn.local", "new-demo-password", "teacher");
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("teacher");
  });

  it("keeps reset request neutral for unknown accounts", () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";

    const request = requestDemoPasswordReset("unknown@example.com", "student");

    expect(request.ok).toBe(true);
    expect(request.demoResetPath).toBeUndefined();
  });

  it("changes demo passwords only after validating current password and length", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "original-password";

    const session = await signIn("teacher.demo@nilelearn.local", "original-password", "teacher");

    expect(() =>
      changeDemoPasswordForSession(session, {
        currentPassword: "wrong-password",
        newPassword: "new-demo-password",
      })
    ).toThrow("Current password is incorrect.");
    expect(() =>
      changeDemoPasswordForSession(session, {
        currentPassword: "original-password",
        newPassword: "short",
      })
    ).toThrow("Use at least 8 characters.");

    expect(
      changeDemoPasswordForSession(session, {
        currentPassword: "original-password",
        newPassword: "new-demo-password",
      })
    ).toMatchObject({ ok: true, role: "teacher" });

    const nextSession = await signIn("teacher.demo@nilelearn.local", "new-demo-password", "teacher");
    expect(nextSession.provider).toBe("demo");
  });

  it("does not fake password changes for provider-managed sessions", () => {
    const session: ServerSession = {
      id: "sess_supabase",
      userId: "usr_teacher_demo",
      email: "teacher.demo@nilelearn.local",
      name: "Teacher Demo",
      roles: ["teacher"],
      activeRole: "teacher",
      provider: "supabase",
      createdAt: "2026-07-04T00:00:00.000Z",
      expiresAt: "2026-07-04T12:00:00.000Z",
    };

    expect(() =>
      changeDemoPasswordForSession(session, {
        currentPassword: "original-password",
        newPassword: "new-demo-password",
      })
    ).toThrow("Password changes are managed by your sign-in provider.");
  });
});

describe("server session store", () => {
  function responseRecorder() {
    const headers = new Map<string, string>();
    return {
      headers,
      response: {
        setHeader(name: string, value: string) {
          headers.set(name, value);
        },
      },
    };
  }

  function requestWithCookie(cookie?: string) {
    return { headers: { cookie } };
  }

  function testSession(overrides: Partial<ServerSession> = {}): ServerSession {
    return {
      id: "sess_test_1",
      userId: "usr_student_demo",
      email: "student.demo@nilelearn.local",
      name: "Student Demo",
      roles: ["student"],
      activeRole: "student",
      provider: "demo",
      createdAt: "2026-07-04T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    };
  }

  function createInspectableStore() {
    const sessions = new Map<string, ServerSession>();
    const store: SessionStore = {
      create(session) {
        sessions.set(session.id, session);
      },
      get(sessionId) {
        return sessions.get(sessionId) ?? null;
      },
      delete(sessionId) {
        sessions.delete(sessionId);
      },
      clear() {
        sessions.clear();
      },
    };
    return { store, sessions };
  }

  it("reads request sessions through the configured server store", () => {
    const { store } = createInspectableStore();
    const restoreStore = setSessionStore(store);
    const session = testSession();
    store.create(session);

    expect(getRequestSession(requestWithCookie("nilelearn_session=sess_test_1"))).toEqual(session);

    restoreStore();
  });

  it("attaches and ends sessions through the configured server store", () => {
    const { store, sessions } = createInspectableStore();
    const restoreStore = setSessionStore(store);
    const { headers, response } = responseRecorder();
    const session = testSession();

    store.create(session);
    const body = attachSession(response, session);
    const cookie = headers.get("Set-Cookie") ?? "";

    expect(body).toMatchObject({ userId: "usr_student_demo", activeRole: "student", provider: "demo" });
    expect(cookie).toContain("nilelearn_session=sess_test_1");
    expect(cookie).toContain("HttpOnly");

    endRequestSession(requestWithCookie("nilelearn_session=sess_test_1"), response);

    expect(sessions.has("sess_test_1")).toBe(false);
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");

    restoreStore();
  });

  it("sets production cookies with secure HttpOnly session attributes", () => {
    process.env.NODE_ENV = "production";
    const { headers, response } = responseRecorder();

    attachSession(response, testSession());
    const cookie = headers.get("Set-Cookie") ?? "";

    expect(cookie).toContain("nilelearn_session=sess_test_1");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=43200");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");

    endRequestSession(requestWithCookie("nilelearn_session=sess_test_1"), response);

    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(headers.get("Set-Cookie")).toContain("Secure");
  });

  it("keeps local development cookies non-secure for localhost testing", () => {
    process.env.NODE_ENV = "test";
    const { headers, response } = responseRecorder();

    attachSession(response, testSession());

    expect(headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(headers.get("Set-Cookie")).toContain("SameSite=Lax");
    expect(headers.get("Set-Cookie")).not.toContain("Secure");
  });

  it("deletes expired sessions from the configured server store", () => {
    const { store, sessions } = createInspectableStore();
    const restoreStore = setSessionStore(store);
    const session = testSession({ expiresAt: "2000-01-01T00:00:00.000Z" });
    store.create(session);

    expect(getRequestSession(requestWithCookie("nilelearn_session=sess_test_1"))).toBeNull();
    expect(sessions.has("sess_test_1")).toBe(false);

    restoreStore();
  });
});
