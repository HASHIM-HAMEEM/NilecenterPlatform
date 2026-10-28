import {
  normalizeEmsFile,
  normalizeEmsFileDownload,
  normalizeEmsFileUploadIntent,
  normalizeEmsFiles,
  type EmsStagingFile,
} from "./emsStagingClient.js";
import {
  hasNccAuthCookie,
  nccStaffAuthEnabled,
  runNccRead,
  runNccWrite,
  sendNccAuthError,
  type NccAuthDependencies,
  type RemoteResult,
} from "./nccAuthSession.js";
import {
  nccAdmissionsReadsEnabled,
  nccAdmissionsWritesEnabled,
} from "./nccOperationalRoutes.js";

type FilesRequest = {
  headers: { cookie?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

type FilesResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
  json(body: unknown): void;
};

type FilesApp = {
  get(path: string, handler: (request: FilesRequest, response: FilesResponse) => unknown): unknown;
  post(path: string, handler: (request: FilesRequest, response: FilesResponse) => unknown): unknown;
};

const FILE_ENTITY_TYPES = ["user_profile", "student", "lead"] as const;
const FILE_PURPOSES = ["avatar", "passport", "national_id", "attachment"] as const;
const FILE_VARIANTS = ["original", "w64", "w256", "w1600"] as const;

const STORAGE_UNAVAILABLE = {
  error: "File storage is not reachable yet.",
  code: "storage_unavailable",
} as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Upload/download URLs must be public https — staging sometimes emits
 *  loopback minio URLs that a browser can never reach. */
export function isSafeFileUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "[::1]") return false;
  if (host.endsWith(".local") || host.endsWith(".localhost")) return false;
  if (host.includes(":")) return false; // other IPv6 literals
  const octets = host.split(".");
  if (octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o) && +o <= 255)) {
    const a = Number(octets[0]);
    const b = Number(octets[1]);
    if (a === 0 || a === 127 || a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
  }
  return true;
}

function prepareFilesRead(
  request: FilesRequest,
  response: FilesResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
  const env = dependencies.env ?? process.env;
  if (!nccAdmissionsReadsEnabled(env)) {
    response.status(503).json({ error: "NCC admissions reads are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

function prepareFilesWrite(
  request: FilesRequest,
  response: FilesResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccAdmissionsWritesEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC admissions writes are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

function uploadIntentBody(
  body: unknown
): Record<string, unknown> | { error: string } {
  if (!isPlainObject(body)) return { error: "Request body is invalid." };
  for (const key of Object.keys(body)) {
    if (
      ![
        "entityType",
        "entityId",
        "purpose",
        "filename",
        "contentType",
        "sizeBytes",
      ].includes(key)
    ) {
      return { error: `${key} is not allowed.` };
    }
  }
  if (!FILE_ENTITY_TYPES.includes(body.entityType as never))
    return { error: "entityType is invalid." };
  if (!isNonBlankString(body.entityId))
    return { error: "entityId is required." };
  if (!FILE_PURPOSES.includes(body.purpose as never))
    return { error: "purpose is invalid." };
  if (
    typeof body.filename !== "string" ||
    !body.filename.trim() ||
    body.filename.length > 255
  )
    return { error: "filename is invalid." };
  if (
    typeof body.contentType !== "string" ||
    !body.contentType.trim() ||
    body.contentType.length > 128
  )
    return { error: "contentType is invalid." };
  if (
    typeof body.sizeBytes !== "number" ||
    !Number.isInteger(body.sizeBytes) ||
    body.sizeBytes < 1
  )
    return { error: "sizeBytes is invalid." };
  return {
    entity_type: body.entityType,
    entity_id: body.entityId.trim(),
    purpose: body.purpose,
    filename: body.filename.trim(),
    content_type: body.contentType.trim(),
    size_bytes: body.sizeBytes,
  };
}

function fileDto(file: EmsStagingFile) {
  return {
    id: file.id,
    entityType: file.entityType,
    entityId: file.entityId,
    purpose: file.purpose,
    status: file.status,
    originalFilename: file.originalFilename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    checksumSha256: file.checksumSha256,
    variants: file.variants,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    errorDetail: file.errorDetail,
  };
}

export function registerNccFilesRoutes(
  app: FilesApp,
  dependencies: NccAuthDependencies = {}
) {
  app.get("/api/ncc/files", async (request, response) => {
    if (!prepareFilesRead(request, response, dependencies)) return;
    const { entityType, entityId, purpose } = request.query ?? {};
    if (
      typeof entityType !== "string" ||
      !FILE_ENTITY_TYPES.includes(entityType as never) ||
      !isNonBlankString(entityId) ||
      (purpose !== undefined && !FILE_PURPOSES.includes(purpose as never))
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    try {
      const items = normalizeEmsFiles(
        await runNccRead(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.files(token, {
              entityType,
              entityId: entityId.trim(),
              purpose: typeof purpose === "string" ? purpose : undefined,
            }),
          dependencies
        )
      );
      if (!items) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid files data." });
        return;
      }
      response.json({ items: items.map(fileDto) });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.post("/api/ncc/files/uploads", async (request, response) => {
    if (!prepareFilesWrite(request, response, dependencies)) return;
    const upstream = uploadIntentBody(request.body);
    if ("error" in upstream) {
      response.status(400).json({ error: upstream.error });
      return;
    }
    try {
      const intent = normalizeEmsFileUploadIntent(
        await runNccWrite(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.createFileUpload(token, upstream),
          dependencies
        )
      );
      if (!intent) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid files data." });
        return;
      }
      if (!isSafeFileUrl(intent.uploadUrl)) {
        // Storage URL is not reachable for browsers (e.g. a loopback minio
        // host): park the pending file and report storage as unavailable.
        await runNccWrite(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.archiveFile(token, intent.id),
          dependencies
        ).catch(() => null);
        response.status(503).json(STORAGE_UNAVAILABLE);
        return;
      }
      response.json({
        id: intent.id,
        uploadUrl: intent.uploadUrl,
        expiresAt: intent.expiresAt,
        headers: intent.headers,
        file: fileDto(intent.file),
      });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.post(
    "/api/ncc/files/uploads/:fileId/complete",
    async (request, response) => {
      if (!prepareFilesWrite(request, response, dependencies)) return;
      const fileId = request.params?.fileId;
      if (!isNonBlankString(fileId)) {
        response.status(400).json({ error: "fileId is invalid." });
        return;
      }
      try {
        const file = normalizeEmsFile(
          await runNccWrite(
            request,
            response,
            (api, token): Promise<RemoteResult> =>
              api.completeFileUpload(token, fileId),
            dependencies
          )
        );
        if (!file) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid files data." });
          return;
        }
        response.json({ file: fileDto(file) });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get("/api/ncc/files/:fileId/download", async (request, response) => {
    if (!prepareFilesRead(request, response, dependencies)) return;
    const fileId = request.params?.fileId;
    const variant = request.query?.variant;
    if (
      !isNonBlankString(fileId) ||
      (variant !== undefined && !FILE_VARIANTS.includes(variant as never))
    ) {
      response.status(400).json({ error: "Request is invalid." });
      return;
    }
    try {
      const download = normalizeEmsFileDownload(
        await runNccRead(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.fileDownload(
              token,
              fileId,
              typeof variant === "string" ? variant : undefined
            ),
          dependencies
        )
      );
      if (!download) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid files data." });
        return;
      }
      if (!isSafeFileUrl(download.url)) {
        response.status(503).json(STORAGE_UNAVAILABLE);
        return;
      }
      response.json(download);
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.post("/api/ncc/files/:fileId/archive", async (request, response) => {
    if (!prepareFilesWrite(request, response, dependencies)) return;
    const fileId = request.params?.fileId;
    if (!isNonBlankString(fileId)) {
      response.status(400).json({ error: "fileId is invalid." });
      return;
    }
    try {
      const file = normalizeEmsFile(
        await runNccWrite(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.archiveFile(token, fileId),
          dependencies
        )
      );
      if (!file) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid files data." });
        return;
      }
      response.json({ file: fileDto(file) });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });
}
