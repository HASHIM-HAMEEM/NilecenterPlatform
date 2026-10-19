import { describe, expect, it, vi } from "vitest";

import { loginNccStaff } from "../../../../server/nccAuthSession";
import { registerNccJotformSettingsRoutes } from "../../../../server/nccJotformSettingsRoutes";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";
const ROW_ID = "08516608-14cb-403b-9ca1-b9f9567e432e";
const FIELD_ID = "11111111-1111-4111-8111-111111111111";
const MAP_ID = "22222222-2222-4222-8222-222222222222";
const BRANCH_ID = "73df6659-4252-4d76-ad64-dab15de795cf";

type RouteHandler = (
  request: Request,
  response: Response
) => Promise<void> | void;
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

function env(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NILE_NCC_STAFF_AUTH_ENABLED: "1",
    NILE_NCC_SETTINGS_ENABLED: "1",
    EMS_STAGING_BASE_URL: "https://staging.example/api",
    EMS_STAGING_ALLOWED_HOSTS: "staging.example",
    EMS_SESSION_SEAL_KEY: sealKey,
    NODE_ENV: "test",
    ...overrides,
  };
}

function tokens(sessionId = "ncc-session-1") {
  return {
    access_token: `access-${sessionId}`,
    refresh_token: `refresh-${sessionId}`,
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    session_id: sessionId,
  };
}

function me(sessionId = "ncc-session-1") {
  return {
    session_id: sessionId,
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

function captureRoutes(options: {
  env: NodeJS.ProcessEnv;
  api: Record<string, unknown>;
}) {
  const routes = new Map<string, RouteHandler>();
  const app = {
    get(path: string, handler: RouteHandler) {
      routes.set(path, handler);
    },
    post(path: string, handler: RouteHandler) {
      routes.set(`POST ${path}`, handler);
    },
    patch(path: string, handler: RouteHandler) {
      routes.set(`PATCH ${path}`, handler);
    },
    put(path: string, handler: RouteHandler) {
      routes.set(`PUT ${path}`, handler);
    },
    delete(path: string, handler: RouteHandler) {
      routes.set(`DELETE ${path}`, handler);
    },
  };
  registerNccJotformSettingsRoutes(app, {
    env: options.env,
    createClient: () => options.api as never,
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
  return {
    headers: cookie ? { cookie } : {},
    params,
    body,
    query,
  };
}

function sessionCookie(headers: Map<string, string | string[]>) {
  const value = headers.get("Set-Cookie");
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return (
    values
      .find(item => item.startsWith("nilelearn_ncc_session="))
      ?.split(";")[0] ?? ""
  );
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
  return sessionCookie(headers);
}

const formRow = {
  id: ROW_ID,
  form_id: "223611105769555",
  name: "Book a Placement Test",
  target: "placement_test",
  fallback_branch_id: BRANCH_ID,
  fallback_branch_name: "Nasr City",
  enabled: false,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
};

const detailRow = {
  ...formRow,
  catalogue: [
    { key: "email", required: true, lookup_role: null },
    { key: "branch_label", required: true, lookup_role: "branch" },
  ],
  fields: [
    {
      id: FIELD_ID,
      input_key: "email",
      question_key: "q3_email",
      sort_order: 0,
    },
  ],
  defaults: [{ input_key: "source", value: "jotform" }],
};

const mapRow = {
  id: MAP_ID,
  form_id: "223611105769555",
  field_map_id: FIELD_ID,
  role: "branch",
  answer_text: "Nasr City",
  target_id: BRANCH_ID,
  target_value: null,
  target_name: "Nasr City",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const submissionRow = {
  id: "44444444-4444-4444-8444-444444444444",
  submission_id: "564123987",
  received_at: "2026-10-18T10:04:00Z",
  answers: [{ label: "Email", value: "visitor@example.test" }],
};

describe("NCC Jotform settings routes", () => {
  it("returns 503 while the settings flag is off", async () => {
    const routes = captureRoutes({
      env: env({ NILE_NCC_SETTINGS_ENABLED: "0" }),
      api: {},
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms")?.(
      request(),
      response
    );

    expect(result).toEqual({
      status: 503,
      body: { error: "NCC settings are not active." },
    });
  });

  it("returns 404 without an NCC session cookie", async () => {
    const routes = captureRoutes({ env: env(), api: {} });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms")?.(
      request(),
      response
    );

    expect(result.status).toBe(404);
  });

  it("lists forms with filters and pagination passed to EMS", async () => {
    const cookie = await login();
    const jotformForms = vi.fn(async () => ({
      ok: true,
      data: { items: [formRow], total: 1, page: 1, page_size: 25 },
    }));
    const routes = captureRoutes({ env: env(), api: { jotformForms } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms")?.(
      request(cookie, undefined, undefined, {
        q: "placement",
        target: ["placement_test", "contact"],
        enabled: "true",
        page: "2",
        pageSize: "10",
      }),
      response
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ total: 1 });
    const call = jotformForms.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(call).toMatchObject({
      q: "placement",
      enabled: true,
      page: 2,
      page_size: 10,
      target: ["placement_test", "contact"],
    });
  });

  it("rejects an unknown target filter before calling EMS", async () => {
    const cookie = await login();
    const jotformForms = vi.fn(async () => ({ ok: true, data: [] }));
    const routes = captureRoutes({ env: env(), api: { jotformForms } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms")?.(
      request(cookie, undefined, undefined, { target: "survey" }),
      response
    );

    expect(result.status).toBe(400);
    expect(jotformForms).not.toHaveBeenCalled();
  });

  it("creates a form with snake_case fields upstream", async () => {
    const cookie = await login();
    const createJotformForm = vi.fn(async () => ({
      ok: true,
      data: formRow,
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createJotformForm },
    });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/jotform/forms")?.(
      request(cookie, undefined, {
        formId: "223611105769555",
        name: "  Book a Placement Test  ",
        target: "placement_test",
        fallbackBranchId: BRANCH_ID,
      }),
      response
    );

    expect(createJotformForm).toHaveBeenCalledWith(
      "access-ncc-session-1",
      {
        form_id: "223611105769555",
        name: "Book a Placement Test",
        target: "placement_test",
        fallback_branch_id: BRANCH_ID,
      }
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      form: { formId: "223611105769555", target: "placement_test" },
    });
  });

  it("rejects an invalid create body", async () => {
    const cookie = await login();
    const createJotformForm = vi.fn(async () => ({ ok: true, data: formRow }));
    const routes = captureRoutes({
      env: env(),
      api: { createJotformForm },
    });
    const bad = [
      { formId: "abc", name: "x", target: "contact" },
      { formId: "1".repeat(33), name: "x", target: "contact" },
      { formId: "123", name: "", target: "contact" },
      { formId: "123", name: "x".repeat(201), target: "contact" },
      { formId: "123", name: "x", target: "survey" },
      { formId: "123", name: "x", target: "contact", extra: 1 },
      {
        formId: "123",
        name: "x",
        target: "contact",
        fallbackBranchId: "not-a-uuid",
      },
    ];
    for (const body of bad) {
      const { response, result } = responseRecorder();
      await routes.get("POST /api/ncc/settings/jotform/forms")?.(
        request(cookie, undefined, body),
        response
      );
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
    expect(createJotformForm).not.toHaveBeenCalled();
  });

  it("looks up the Jotform title and rejects a bad formId", async () => {
    const cookie = await login();
    const jotformFormTitle = vi.fn(async () => ({
      ok: true,
      data: { name: "Book a Placement Test" },
    }));
    const routes = captureRoutes({ env: env(), api: { jotformFormTitle } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms/title")?.(
      request(cookie, undefined, undefined, { formId: "223611105769555" }),
      response
    );
    expect(jotformFormTitle).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "223611105769555"
    );
    expect(result.body).toEqual({
      title: { name: "Book a Placement Test" },
    });

    const bad = responseRecorder();
    await routes.get("/api/ncc/settings/jotform/forms/title")?.(
      request(cookie, undefined, undefined, { formId: "not digits!" }),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 400,
      body: { error: "formId is invalid." },
    });
  });

  it("validates the row id on detail reads", async () => {
    const cookie = await login();
    const jotformForm = vi.fn(async () => ({ ok: true, data: detailRow }));
    const routes = captureRoutes({ env: env(), api: { jotformForm } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms/:rowId")?.(
      request(cookie, { rowId: "nope" }),
      response
    );
    expect(result).toEqual({
      status: 400,
      body: { error: "rowId is invalid." },
    });
    expect(jotformForm).not.toHaveBeenCalled();
  });

  it("reads the form detail with catalogue, fields and defaults", async () => {
    const cookie = await login();
    const jotformForm = vi.fn(async () => ({ ok: true, data: detailRow }));
    const routes = captureRoutes({ env: env(), api: { jotformForm } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms/:rowId")?.(
      request(cookie, { rowId: ROW_ID }),
      response
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      form: {
        catalogue: [{ key: "email" }, { key: "branch_label" }],
        fields: [{ questionKey: "q3_email" }],
        defaults: [{ inputKey: "source", value: "jotform" }],
      },
    });
  });

  it("patches a form including a null fallback branch", async () => {
    const cookie = await login();
    const patchJotformForm = vi.fn(async () => ({
      ok: true,
      data: { ...formRow, fallback_branch_id: null, enabled: true },
    }));
    const routes = captureRoutes({ env: env(), api: { patchJotformForm } });
    const { response, result } = responseRecorder();

    await routes.get("PATCH /api/ncc/settings/jotform/forms/:rowId")?.(
      request(cookie, { rowId: ROW_ID }, {
        fallbackBranchId: null,
        enabled: true,
      }),
      response
    );

    expect(patchJotformForm).toHaveBeenCalledWith(
      "access-ncc-session-1",
      ROW_ID,
      { fallback_branch_id: null, enabled: true }
    );
    expect(result.status).toBe(200);
  });

  it("replaces fields and defaults in one write", async () => {
    const cookie = await login();
    const replaceJotformFormFields = vi.fn(async () => ({
      ok: true,
      data: detailRow,
    }));
    const routes = captureRoutes({
      env: env(),
      api: { replaceJotformFormFields },
    });
    const { response, result } = responseRecorder();

    await routes.get("PUT /api/ncc/settings/jotform/forms/:rowId/fields")?.(
      request(cookie, { rowId: ROW_ID }, {
        fields: [
          { inputKey: "email", questionKey: "q3_email", sortOrder: 0 },
          {
            id: FIELD_ID,
            inputKey: "first_name",
            questionKey: "first_name",
            sortOrder: 1,
          },
        ],
        defaults: [{ inputKey: "source", value: "jotform" }],
      }),
      response
    );

    expect(replaceJotformFormFields).toHaveBeenCalledWith(
      "access-ncc-session-1",
      ROW_ID,
      {
        fields: [
          { input_key: "email", question_key: "q3_email", sort_order: 0 },
          {
            id: FIELD_ID,
            input_key: "first_name",
            question_key: "first_name",
            sort_order: 1,
          },
        ],
        defaults: [{ input_key: "source", value: "jotform" }],
      }
    );
    expect(result.status).toBe(200);
  });

  it("rejects bad question keys and extra field keys", async () => {
    const cookie = await login();
    const replaceJotformFormFields = vi.fn(async () => ({
      ok: true,
      data: detailRow,
    }));
    const routes = captureRoutes({
      env: env(),
      api: { replaceJotformFormFields },
    });
    const bad = [
      {
        fields: [
          { inputKey: "email", questionKey: "bad key!", sortOrder: 0 },
        ],
      },
      {
        fields: [
          { inputKey: "email", questionKey: "q1", sortOrder: -1 },
        ],
      },
      {
        fields: [
          { inputKey: "email", questionKey: "q1", sortOrder: 0, junk: 1 },
        ],
      },
      { fields: "not-an-array" },
      {
        fields: [],
        defaults: [{ inputKey: "source", value: "x".repeat(2001) }],
      },
    ];
    for (const body of bad) {
      const { response, result } = responseRecorder();
      await routes.get("PUT /api/ncc/settings/jotform/forms/:rowId/fields")?.(
        request(cookie, { rowId: ROW_ID }, body),
        response
      );
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
    expect(replaceJotformFormFields).not.toHaveBeenCalled();
  });

  it("deletes a field map and rejects a body", async () => {
    const cookie = await login();
    const deleteJotformFormField = vi.fn(async () => ({
      ok: true,
      data: detailRow,
    }));
    const routes = captureRoutes({
      env: env(),
      api: { deleteJotformFormField },
    });
    const { response, result } = responseRecorder();

    await routes.get(
      "DELETE /api/ncc/settings/jotform/forms/:rowId/fields/:fieldMapId"
    )?.(request(cookie, { rowId: ROW_ID, fieldMapId: FIELD_ID }), response);
    expect(deleteJotformFormField).toHaveBeenCalledWith(
      "access-ncc-session-1",
      ROW_ID,
      FIELD_ID
    );
    expect(result.status).toBe(200);

    const bad = responseRecorder();
    await routes.get(
      "DELETE /api/ncc/settings/jotform/forms/:rowId/fields/:fieldMapId"
    )?.(
      request(
        cookie,
        { rowId: ROW_ID, fieldMapId: "bad" },
        undefined
      ),
      bad.response
    );
    expect(bad.result.status).toBe(400);
  });

  it("lists submissions and reads one by the Jotform sid", async () => {
    const cookie = await login();
    const jotformFormSubmissions = vi.fn(async () => ({
      ok: true,
      data: { items: [submissionRow], total: 1, page: 1, page_size: 25 },
    }));
    const jotformFormSubmission = vi.fn(async () => ({
      ok: true,
      data: submissionRow,
    }));
    const routes = captureRoutes({
      env: env(),
      api: { jotformFormSubmissions, jotformFormSubmission },
    });

    const list = responseRecorder();
    await routes.get(
      "/api/ncc/settings/jotform/forms/:rowId/submissions"
    )?.(
      request(cookie, { rowId: ROW_ID }, undefined, { page: "1" }),
      list.response
    );
    expect(list.result.status).toBe(200);
    expect(list.result.body).toMatchObject({ total: 1 });

    const detail = responseRecorder();
    await routes.get(
      "/api/ncc/settings/jotform/forms/:rowId/submissions/:submissionId"
    )?.(
      request(cookie, { rowId: ROW_ID, submissionId: "564123987" }),
      detail.response
    );
    // The Jotform sid is numeric, not a uuid.
    expect(jotformFormSubmission).toHaveBeenCalledWith(
      "access-ncc-session-1",
      ROW_ID,
      "564123987"
    );
    expect(detail.result.status).toBe(200);
    expect(detail.result.body).toMatchObject({
      submission: { submissionId: "564123987" },
    });
  });

  it("filters answer maps and rejects unknown filters", async () => {
    const cookie = await login();
    const jotformAnswerMaps = vi.fn(async () => ({
      ok: true,
      data: [mapRow],
    }));
    const routes = captureRoutes({
      env: env(),
      api: { jotformAnswerMaps },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/answer-maps")?.(
      request(cookie, undefined, undefined, {
        formId: "223611105769555",
        role: "branch",
      }),
      response
    );
    expect(jotformAnswerMaps).toHaveBeenCalledWith("access-ncc-session-1", {
      formId: "223611105769555",
      role: "branch",
    });
    expect(result.status).toBe(200);

    const bad = responseRecorder();
    await routes.get("/api/ncc/settings/jotform/answer-maps")?.(
      request(cookie, undefined, undefined, { role: "colour" }),
      bad.response
    );
    expect(bad.result.status).toBe(400);
  });

  it("maps answer-map targets by role", async () => {
    const cookie = await login();
    const createJotformAnswerMap = vi.fn(async () => ({
      ok: true,
      data: mapRow,
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createJotformAnswerMap },
    });

    // Source role carries a text value.
    const source = responseRecorder();
    await routes.get("POST /api/ncc/settings/jotform/answer-maps")?.(
      request(cookie, undefined, {
        formId: "223611105769555",
        fieldMapId: FIELD_ID,
        role: "source",
        answerText: "Facebook",
        targetValue: "facebook",
      }),
      source.response
    );
    expect(createJotformAnswerMap).toHaveBeenLastCalledWith(
      "access-ncc-session-1",
      expect.objectContaining({ target_value: "facebook" })
    );
    expect(source.result.status).toBe(200);

    // Branch role carries the branch uuid.
    const branch = responseRecorder();
    await routes.get("POST /api/ncc/settings/jotform/answer-maps")?.(
      request(cookie, undefined, {
        formId: "223611105769555",
        fieldMapId: FIELD_ID,
        role: "branch",
        answerText: "Nasr City",
        targetId: BRANCH_ID,
      }),
      branch.response
    );
    expect(createJotformAnswerMap).toHaveBeenLastCalledWith(
      "access-ncc-session-1",
      expect.objectContaining({ target_id: BRANCH_ID })
    );

    // Swapped targets are rejected.
    for (const body of [
      {
        formId: "223611105769555",
        fieldMapId: FIELD_ID,
        role: "source",
        answerText: "Facebook",
        targetId: BRANCH_ID,
      },
      {
        formId: "223611105769555",
        fieldMapId: FIELD_ID,
        role: "branch",
        answerText: "Nasr City",
        targetValue: "nasr",
      },
      {
        formId: "223611105769555",
        fieldMapId: FIELD_ID,
        role: "branch",
        answerText: "x".repeat(201),
        targetId: BRANCH_ID,
      },
    ]) {
      const bad = responseRecorder();
      await routes.get("POST /api/ncc/settings/jotform/answer-maps")?.(
        request(cookie, undefined, body),
        bad.response
      );
      expect(bad.result.status, JSON.stringify(body)).toBe(400);
    }
    expect(createJotformAnswerMap).toHaveBeenCalledTimes(2);
  });

  it("patches and deletes an answer map", async () => {
    const cookie = await login();
    const patchJotformAnswerMap = vi.fn(async () => ({
      ok: true,
      data: mapRow,
    }));
    const deleteJotformAnswerMap = vi.fn(async () => ({
      ok: true,
      data: {},
    }));
    const routes = captureRoutes({
      env: env(),
      api: { patchJotformAnswerMap, deleteJotformAnswerMap },
    });

    const patch = responseRecorder();
    await routes.get("PATCH /api/ncc/settings/jotform/answer-maps/:mapId")?.(
      request(cookie, { mapId: MAP_ID }, { answerText: "Maadi" }),
      patch.response
    );
    expect(patchJotformAnswerMap).toHaveBeenCalledWith(
      "access-ncc-session-1",
      MAP_ID,
      { answer_text: "Maadi" }
    );
    expect(patch.result.status).toBe(200);

    const del = responseRecorder();
    await routes.get("DELETE /api/ncc/settings/jotform/answer-maps/:mapId")?.(
      request(cookie, { mapId: MAP_ID }),
      del.response
    );
    expect(deleteJotformAnswerMap).toHaveBeenCalledWith(
      "access-ncc-session-1",
      MAP_ID
    );
    expect(del.result.body).toEqual({ done: true });
  });

  it("passes an upstream 403 through unchanged", async () => {
    const cookie = await login();
    const createJotformForm = vi.fn(async () => ({
      ok: false,
      error: { error: "forbidden", status: 403 },
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createJotformForm },
    });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/jotform/forms")?.(
      request(cookie, undefined, {
        formId: "223611105769555",
        name: "x",
        target: "contact",
      }),
      response
    );

    expect(result.status).toBe(403);
  });

  it("returns 502 when EMS sends malformed form data", async () => {
    const cookie = await login();
    const jotformForm = vi.fn(async () => ({
      ok: true,
      data: { ...formRow, target: "survey" },
    }));
    const routes = captureRoutes({ env: env(), api: { jotformForm } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/jotform/forms/:rowId")?.(
      request(cookie, { rowId: ROW_ID }),
      response
    );

    expect(result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid settings data." },
    });
  });
});
