import { describe, expect, it, vi } from "vitest";

import { loginNccStaff } from "../../../../server/nccAuthSession";
import { registerNccFilesRoutes } from "../../../../server/nccFilesRoutes";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

type Request = {
  headers: { cookie?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};
type Response = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): Response;
  json(body: unknown): void;
};
type Handler = (request: Request, response: Response) => void | Promise<void>;

function env() {
  return {
    NILE_NCC_STAFF_AUTH_ENABLED: "1",
    NILE_NCC_ADMISSIONS_READS_ENABLED: "1",
    NILE_NCC_ADMISSIONS_WRITES_ENABLED: "1",
    EMS_STAGING_BASE_URL: "https://staging.example/api",
    EMS_STAGING_ALLOWED_HOSTS: "staging.example",
    EMS_SESSION_SEAL_KEY: sealKey,
    NODE_ENV: "test",
  };
}

function tokens() {
  return {
    access_token: "access-1",
    refresh_token: "refresh-1",
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    session_id: "ncc-session-1",
  };
}

function me() {
  return {
    session_id: "ncc-session-1",
    user: {
      id: "ncc-user-1",
      email: "staff@example.test",
      profile: { first_name: "NCC", last_name: "Staff" },
      departments: null,
    },
    assigned_role: "super_admin",
    active_role: "super_admin",
    workspace_branch_id: null,
    scopes: [{ scope_type: "global", scope_id: null, is_live: true }],
  };
}

function fileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "file-1",
    entity_type: "student",
    entity_id: "student-1",
    purpose: "passport",
    status: "ready",
    original_filename: "passport.pdf",
    content_type: "application/pdf",
    size_bytes: 128,
    checksum_sha256: "abc",
    variants: [],
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    ...overrides,
  };
}

function captureRoutes(api: Record<string, unknown>) {
  const routes = new Map<string, Handler>();
  const app = {
    get(path: string, handler: Handler) {
      routes.set(path, handler);
    },
    post(path: string, handler: Handler) {
      routes.set(`POST ${path}`, handler);
    },
  };
  registerNccFilesRoutes(app, {
    env: env(),
    createClient: () => api as never,
  });
  return routes;
}

function responseRecorder() {
  const headers = new Map<string, string | string[]>();
  const result: { status: number; body?: unknown } = { status: 200 };
  const response: Response = {
    setHeader(name, value) {
      headers.set(name, value);
    },
    status(code) {
      result.status = code;
      return response;
    },
    json(body) {
      result.body = body;
    },
  };
  return { headers, result, response };
}

function request(
  cookie = "",
  params?: Record<string, string>,
  body?: Record<string, unknown>,
  query?: Record<string, unknown>
): Request {
  return { headers: cookie ? { cookie } : {}, params, body, query };
}

async function login() {
  const { headers, response } = responseRecorder();
  const api = {
    login: vi.fn(async () => ({ ok: true, data: tokens() })),
    me: vi.fn(async () => ({ ok: true, data: me() })),
    logout: vi.fn(async () => ({ ok: true, data: null })),
  };
  await loginNccStaff("staff@example.test", "password", response, {
    env: env(),
    createClient: () => api as never,
  });
  const value = headers.get("Set-Cookie");
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return (
    values
      .find(item => item.startsWith("nilelearn_ncc_session="))
      ?.split(";")[0] ?? ""
  );
}

const intentBody = {
  entityType: "student",
  entityId: "student-1",
  purpose: "passport",
  filename: "passport.pdf",
  contentType: "application/pdf",
  sizeBytes: 128,
};

describe("NCC files routes", () => {
  it("lists files for an entity", async () => {
    const cookie = await login();
    const api = {
      files: vi.fn(async () => ({ ok: true, data: [fileRow()] })),
    };
    const { result, response } = responseRecorder();
    await captureRoutes(api)
      .get("/api/ncc/files")?.(
        request(cookie, undefined, undefined, {
          entityType: "student",
          entityId: "student-1",
        }),
        response
      );
    expect(result.status).toBe(200);
    expect(api.files).toHaveBeenCalledWith(
      "access-1",
      { entityType: "student", entityId: "student-1", purpose: undefined }
    );
    const items = (result.body as { items: unknown[] }).items;
    expect(items[0]).toMatchObject({
      id: "file-1",
      originalFilename: "passport.pdf",
      status: "ready",
    });
  });

  it("400s bad list queries and bad upload bodies", async () => {
    const cookie = await login();
    const routes = captureRoutes({ files: vi.fn() });
    let { result, response } = responseRecorder();
    await routes.get("/api/ncc/files")?.(
      request(cookie, undefined, undefined, { entityType: "x" }),
      response
    );
    expect(result.status).toBe(400);

    ({ result, response } = responseRecorder());
    await routes.get("POST /api/ncc/files/uploads")?.(
      request(cookie, undefined, { ...intentBody, purpose: "dna" }),
      response
    );
    expect(result.status).toBe(400);

    ({ result, response } = responseRecorder());
    await routes.get("POST /api/ncc/files/uploads")?.(
      request(cookie, undefined, { ...intentBody, sizeBytes: 0 }),
      response
    );
    expect(result.status).toBe(400);

    ({ result, response } = responseRecorder());
    await routes.get("POST /api/ncc/files/uploads")?.(
      request(cookie, undefined, { ...intentBody, extra: 1 }),
      response
    );
    expect(result.status).toBe(400);
  });

  it("passes a safe https upload intent straight through", async () => {
    const cookie = await login();
    const api = {
      createFileUpload: vi.fn(async () => ({
        ok: true,
        data: {
          id: "file-1",
          upload_url: "https://minio.public.example/presigned/put",
          expires_at: "2099-01-01T00:00:00Z",
          headers: { "x-amz-meta-test": "1" },
          file: fileRow({ status: "pending" }),
        },
      })),
      archiveFile: vi.fn(),
    };
    const { result, response } = responseRecorder();
    await captureRoutes(api)
      .get("POST /api/ncc/files/uploads")?.(
        request(cookie, undefined, intentBody),
        response
      );
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.uploadUrl).toBe("https://minio.public.example/presigned/put");
    expect((body.headers as Record<string, string>)["x-amz-meta-test"]).toBe("1");
    expect(api.archiveFile).not.toHaveBeenCalled();
  });

  it("503s a loopback upload_url and best-effort archives the pending file", async () => {
    const cookie = await login();
    const api = {
      createFileUpload: vi.fn(async () => ({
        ok: true,
        data: {
          id: "file-1",
          upload_url: "http://127.0.0.1:9000/bucket/put",
          expires_at: "2099-01-01T00:00:00Z",
          headers: {},
          file: fileRow({ status: "pending" }),
        },
      })),
      archiveFile: vi.fn(async () => ({
        ok: true,
        data: fileRow({ status: "archived" }),
      })),
    };
    const { result, response } = responseRecorder();
    await captureRoutes(api)
      .get("POST /api/ncc/files/uploads")?.(
        request(cookie, undefined, intentBody),
        response
      );
    expect(result.status).toBe(503);
    expect((result.body as { code?: string }).code).toBe("storage_unavailable");
    expect(api.archiveFile).toHaveBeenCalledWith("access-1", "file-1");
  });

  it("503s an unsafe download URL", async () => {
    const cookie = await login();
    const api = {
      fileDownload: vi.fn(async () => ({
        ok: true,
        data: {
          url: "http://192.168.1.5:9000/get",
          expires_at: "2099-01-01T00:00:00Z",
          variant: "original",
          content_type: "application/pdf",
        },
      })),
    };
    const { result, response } = responseRecorder();
    await captureRoutes(api)
      .get("/api/ncc/files/:fileId/download")?.(
        request(cookie, { fileId: "file-1" }),
        response
      );
    expect(result.status).toBe(503);
    expect((result.body as { code?: string }).code).toBe("storage_unavailable");
  });

  it("returns the download URL when it is public https", async () => {
    const cookie = await login();
    const api = {
      fileDownload: vi.fn(async () => ({
        ok: true,
        data: {
          url: "https://files.example/get/abc",
          expires_at: "2099-01-01T00:00:00Z",
          variant: "original",
          content_type: "application/pdf",
        },
      })),
    };
    const { result, response } = responseRecorder();
    await captureRoutes(api)
      .get("/api/ncc/files/:fileId/download")?.(
        request(cookie, { fileId: "file-1" }),
        response
      );
    expect(result.status).toBe(200);
    expect((result.body as { url: string }).url).toBe(
      "https://files.example/get/abc"
    );
  });
});
