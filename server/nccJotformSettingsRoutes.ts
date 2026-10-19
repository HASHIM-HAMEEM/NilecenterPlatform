import {
  JOTFORM_ANSWER_ROLES,
  JOTFORM_TARGETS,
  normalizeEmsJotformAnswerMap,
  normalizeEmsJotformAnswerMaps,
  normalizeEmsJotformForm,
  normalizeEmsJotformFormDetail,
  normalizeEmsJotformFormPage,
  normalizeEmsJotformFormTitle,
  normalizeEmsJotformSubmission,
  normalizeEmsJotformSubmissionPage,
  type EmsStagingJotformAnswerMap,
  type EmsStagingJotformForm,
  type EmsStagingJotformFormDetail,
  type EmsStagingJotformSubmission,
  type EmsStagingPage,
} from "./emsStagingClient.js";
import { type NccAuthDependencies, type RemoteResult } from "./nccAuthSession.js";
import {
  pageBody,
  readListQuery,
  type ListParam,
} from "./nccOperationalRoutes.js";
import {
  emptyBody,
  handleSettingsRead,
  handleSettingsWrite,
  hasOnlyKeys,
  isPlainObject,
  prepareSettingsWrite,
  type SettingsApp,
  type SettingsRequest,
  type SettingsResponse,
} from "./nccSettingsRoutes.js";

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Jotform numeric form id (digits only, EMS caps it at 32). */
const JOTFORM_FORM_ID = /^\d{1,32}$/;
/** Jotform question unique names are letters/digits/underscore. */
const QUESTION_KEY = /^[A-Za-z0-9_]{1,80}$/;

function optionalUuid(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && UUID.test(value))
  );
}

function badRequest(response: SettingsResponse, error: string) {
  response.setHeader("Cache-Control", "private, no-store");
  response.status(400).json({ error });
}

function readParams(request: SettingsRequest, names: string[]) {
  const params = request.params ?? {};
  return names.every(name => typeof params[name] === "string" && params[name])
    ? params
    : null;
}

/**
 * POST /jotform-answer-maps: the source role maps to a text value, branch and
 * area roles map to an EMS id. Enforced here so upstream always gets a valid
 * pair.
 */
function answerMapTarget(
  body: Record<string, unknown>,
  role: string
): { target_id?: string | null; target_value?: string | null } | string {
  if (role === "source") {
    if (
      typeof body.targetValue !== "string" ||
      !body.targetValue.trim() ||
      body.targetValue.length > 200
    ) {
      return "targetValue is required for the source role.";
    }
    return { target_value: body.targetValue };
  }
  if (typeof body.targetId !== "string" || !UUID.test(body.targetId)) {
    return "targetId is required for this role.";
  }
  return { target_id: body.targetId };
}

export function registerNccJotformSettingsRoutes(
  app: SettingsApp,
  dependencies: NccAuthDependencies = {}
) {
  const LIST_PARAMS: ListParam[] = [
    {
      name: "target",
      ems: "target",
      kind: "array",
      values: JOTFORM_TARGETS,
    },
    { name: "enabled", ems: "enabled", kind: "boolean" },
    { name: "fallbackBranchId", ems: "fallback_branch_id", kind: "string" },
  ];

  app.get("/api/ncc/settings/jotform/forms", (request, response) => {
    const query = readListQuery(request, response, LIST_PARAMS);
    if (!query) return;
    return handleSettingsRead<EmsStagingPage<EmsStagingJotformForm>>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> => api.jotformForms(token, query),
      normalizeEmsJotformFormPage,
      pageBody
    );
  });

  app.post(
    "/api/ncc/settings/jotform/forms",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, [
          "formId",
          "name",
          "target",
          "fallbackBranchId",
        ]) ||
        typeof body.formId !== "string" ||
        !JOTFORM_FORM_ID.test(body.formId) ||
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 200 ||
        !JOTFORM_TARGETS.includes(body.target as never) ||
        !optionalUuid(body.fallbackBranchId)
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {
        form_id: body.formId,
        name: (body.name as string).trim(),
        target: body.target,
      };
      if (body.fallbackBranchId !== undefined) {
        upstream.fallback_branch_id = body.fallbackBranchId;
      }
      await handleSettingsWrite<EmsStagingJotformForm>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.createJotformForm(token, upstream),
        normalizeEmsJotformForm,
        form => ({ form })
      );
    }
  );

  app.get(
    "/api/ncc/settings/jotform/forms/title",
    (request, response) => {
      const formId = request.query?.formId;
      if (typeof formId !== "string" || !JOTFORM_FORM_ID.test(formId)) {
        badRequest(response, "formId is invalid.");
        return;
      }
      return handleSettingsRead<{ name: string }>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.jotformFormTitle(token, formId),
        normalizeEmsJotformFormTitle,
        title => ({ title })
      );
    }
  );

  app.get(
    "/api/ncc/settings/jotform/forms/:rowId",
    (request, response) => {
      const params = readParams(request, ["rowId"]);
      if (!params || !UUID.test(params.rowId)) {
        badRequest(response, "rowId is invalid.");
        return;
      }
      return handleSettingsRead<EmsStagingJotformFormDetail>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.jotformForm(token, params.rowId),
        normalizeEmsJotformFormDetail,
        form => ({ form })
      );
    }
  );

  app.patch?.(
    "/api/ncc/settings/jotform/forms/:rowId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const params = readParams(request, ["rowId"]);
      if (!params || !UUID.test(params.rowId)) {
        response.status(400).json({ error: "rowId is invalid." });
        return;
      }
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, [
          "formId",
          "name",
          "target",
          "fallbackBranchId",
          "enabled",
        ]) ||
        (body.formId !== undefined &&
          (typeof body.formId !== "string" ||
            !JOTFORM_FORM_ID.test(body.formId))) ||
        (body.name !== undefined &&
          (typeof body.name !== "string" ||
            !body.name.trim() ||
            body.name.length > 200)) ||
        (body.target !== undefined &&
          !JOTFORM_TARGETS.includes(body.target as never)) ||
        !optionalUuid(body.fallbackBranchId) ||
        (body.enabled !== undefined && typeof body.enabled !== "boolean")
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      if (body.formId !== undefined) upstream.form_id = body.formId;
      if (body.name !== undefined)
        upstream.name = (body.name as string).trim();
      if (body.target !== undefined) upstream.target = body.target;
      if (body.fallbackBranchId !== undefined)
        upstream.fallback_branch_id = body.fallbackBranchId;
      if (body.enabled !== undefined) upstream.enabled = body.enabled;
      await handleSettingsWrite<EmsStagingJotformForm>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.patchJotformForm(token, params.rowId, upstream),
        normalizeEmsJotformForm,
        form => ({ form })
      );
    }
  );

  app.put?.(
    "/api/ncc/settings/jotform/forms/:rowId/fields",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const params = readParams(request, ["rowId"]);
      if (!params || !UUID.test(params.rowId)) {
        response.status(400).json({ error: "rowId is invalid." });
        return;
      }
      const body = request.body;
      const validField = (field: unknown) =>
        isPlainObject(field) &&
        hasOnlyKeys(field, [
          "id",
          "inputKey",
          "questionKey",
          "sortOrder",
        ]) &&
        (field.id === undefined ||
          field.id === null ||
          (typeof field.id === "string" && UUID.test(field.id))) &&
        typeof field.inputKey === "string" &&
        !!field.inputKey.trim() &&
        field.inputKey.length <= 64 &&
        typeof field.questionKey === "string" &&
        QUESTION_KEY.test(field.questionKey) &&
        Number.isSafeInteger(field.sortOrder) &&
        (field.sortOrder as number) >= 0;
      const validDefault = (row: unknown) =>
        isPlainObject(row) &&
        hasOnlyKeys(row, ["inputKey", "value"]) &&
        typeof row.inputKey === "string" &&
        !!row.inputKey.trim() &&
        row.inputKey.length <= 64 &&
        typeof row.value === "string" &&
        !!row.value &&
        row.value.length <= 2000;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["fields", "defaults"]) ||
        !Array.isArray(body.fields) ||
        body.fields.length > 200 ||
        body.fields.some(field => !validField(field)) ||
        (body.defaults !== undefined &&
          (!Array.isArray(body.defaults) ||
            body.defaults.length > 200 ||
            body.defaults.some(row => !validDefault(row))))
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {
        fields: (body.fields as Array<Record<string, unknown>>).map(
          field => ({
            ...(field.id !== undefined && field.id !== null
              ? { id: field.id }
              : {}),
            input_key: (field.inputKey as string).trim(),
            question_key: field.questionKey,
            sort_order: field.sortOrder,
          })
        ),
        ...(body.defaults !== undefined
          ? {
              defaults: (
                body.defaults as Array<Record<string, unknown>>
              ).map(row => ({
                input_key: (row.inputKey as string).trim(),
                value: row.value,
              })),
            }
          : {}),
      };
      await handleSettingsWrite<EmsStagingJotformFormDetail>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.replaceJotformFormFields(token, params.rowId, upstream),
        normalizeEmsJotformFormDetail,
        form => ({ form })
      );
    }
  );

  app.delete?.(
    "/api/ncc/settings/jotform/forms/:rowId/fields/:fieldMapId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const params = readParams(request, ["rowId", "fieldMapId"]);
      if (
        !params ||
        !UUID.test(params.rowId) ||
        !UUID.test(params.fieldMapId) ||
        !emptyBody(request.body)
      ) {
        response.status(400).json({ error: "Request is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingJotformFormDetail | Record<string, never>>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.deleteJotformFormField(
            token,
            params.rowId,
            params.fieldMapId
          ),
        payload =>
          normalizeEmsJotformFormDetail(payload) ??
          (isPlainObject(payload) ? {} : null),
        () => ({ done: true })
      );
    }
  );

  app.get(
    "/api/ncc/settings/jotform/forms/:rowId/submissions",
    (request, response) => {
      const params = readParams(request, ["rowId"]);
      if (!params || !UUID.test(params.rowId)) {
        badRequest(response, "rowId is invalid.");
        return;
      }
      const query = readListQuery(request, response, []);
      if (!query) return;
      return handleSettingsRead<EmsStagingPage<EmsStagingJotformSubmission>>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.jotformFormSubmissions(token, params.rowId, query),
        normalizeEmsJotformSubmissionPage,
        pageBody
      );
    }
  );

  app.get(
    "/api/ncc/settings/jotform/forms/:rowId/submissions/:submissionId",
    (request, response) => {
      const params = readParams(request, ["rowId", "submissionId"]);
      if (
        !params ||
        !UUID.test(params.rowId) ||
        // EMS keys submissions by the Jotform sid, not a uuid.
        !params.submissionId.trim() ||
        params.submissionId.length > 128
      ) {
        badRequest(response, "Request is invalid.");
        return;
      }
      return handleSettingsRead<EmsStagingJotformSubmission>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.jotformFormSubmission(
            token,
            params.rowId,
            params.submissionId
          ),
        normalizeEmsJotformSubmission,
        submission => ({ submission })
      );
    }
  );

  /* ---- answer maps ---- */

  app.get(
    "/api/ncc/settings/jotform/answer-maps",
    (request, response) => {
      const query = request.query ?? {};
      for (const key of Object.keys(query)) {
        if (key !== "formId" && key !== "role") {
          badRequest(response, `${key} is not a supported filter.`);
          return;
        }
      }
      const formId = query.formId;
      const role = query.role;
      if (
        (formId !== undefined &&
          (typeof formId !== "string" || !formId.trim() || formId.length > 64)) ||
        (role !== undefined &&
          !JOTFORM_ANSWER_ROLES.includes(role as never))
      ) {
        badRequest(response, "Request query is invalid.");
        return;
      }
      return handleSettingsRead<EmsStagingJotformAnswerMap[]>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.jotformAnswerMaps(token, {
            formId:
              typeof formId === "string" && formId.trim()
                ? formId.trim()
                : undefined,
            role: typeof role === "string" ? role : undefined,
          }),
        normalizeEmsJotformAnswerMaps,
        items => ({ items })
      );
    }
  );

  app.post(
    "/api/ncc/settings/jotform/answer-maps",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, [
          "formId",
          "fieldMapId",
          "role",
          "answerText",
          "targetId",
          "targetValue",
        ]) ||
        typeof body.formId !== "string" ||
        !JOTFORM_FORM_ID.test(body.formId) ||
        typeof body.fieldMapId !== "string" ||
        !UUID.test(body.fieldMapId) ||
        !JOTFORM_ANSWER_ROLES.includes(body.role as never) ||
        typeof body.answerText !== "string" ||
        !body.answerText ||
        body.answerText.length > 200 ||
        !optionalUuid(body.targetId) ||
        (body.targetValue !== undefined &&
          body.targetValue !== null &&
          typeof body.targetValue !== "string")
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const target = answerMapTarget(body, body.role as string);
      if (typeof target === "string") {
        response.status(400).json({ error: target });
        return;
      }
      await handleSettingsWrite<EmsStagingJotformAnswerMap>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.createJotformAnswerMap(token, {
            form_id: body.formId,
            field_map_id: body.fieldMapId,
            role: body.role,
            answer_text: body.answerText,
            ...target,
          }),
        normalizeEmsJotformAnswerMap,
        map => ({ map })
      );
    }
  );

  app.patch?.(
    "/api/ncc/settings/jotform/answer-maps/:mapId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const params = readParams(request, ["mapId"]);
      if (!params || !UUID.test(params.mapId)) {
        response.status(400).json({ error: "mapId is invalid." });
        return;
      }
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["answerText", "targetId", "targetValue"]) ||
        (body.answerText !== undefined &&
          (typeof body.answerText !== "string" ||
            !body.answerText ||
            body.answerText.length > 200)) ||
        !optionalUuid(body.targetId) ||
        (body.targetValue !== undefined &&
          body.targetValue !== null &&
          (typeof body.targetValue !== "string" ||
            !body.targetValue ||
            body.targetValue.length > 200))
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      if (body.answerText !== undefined)
        upstream.answer_text = body.answerText;
      if (body.targetId !== undefined) upstream.target_id = body.targetId;
      if (body.targetValue !== undefined)
        upstream.target_value = body.targetValue;
      await handleSettingsWrite<EmsStagingJotformAnswerMap>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.patchJotformAnswerMap(token, params.mapId, upstream),
        normalizeEmsJotformAnswerMap,
        map => ({ map })
      );
    }
  );

  app.delete?.(
    "/api/ncc/settings/jotform/answer-maps/:mapId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const params = readParams(request, ["mapId"]);
      if (
        !params ||
        !UUID.test(params.mapId) ||
        !emptyBody(request.body)
      ) {
        response.status(400).json({ error: "Request is invalid." });
        return;
      }
      await handleSettingsWrite<Record<string, never>>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.deleteJotformAnswerMap(token, params.mapId),
        payload => (isPlainObject(payload) || payload === null ? {} : null),
        () => ({ done: true })
      );
    }
  );
}
