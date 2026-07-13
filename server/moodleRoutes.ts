import type { ServerSession } from "./auth.js";
import { getRequestSession } from "./auth.js";
import {
  createMoodleClientFromEnvironment,
  getMoodleServerStatus,
  MoodleApiError,
  type MoodleClient,
} from "./moodleClient.js";
import { SessionRepositoryUnavailableError } from "./sessionRepository.js";

type MoodleRouteRequest = {
  headers: { cookie?: string };
  get(name: string): string | undefined;
};

type MoodleRouteResponse = {
  status(code: number): MoodleRouteResponse;
  json(body: unknown): void;
};

type MoodleRouteHandler = (
  request: MoodleRouteRequest,
  response: MoodleRouteResponse
) => void | Promise<void>;

type MoodleRouteApp = {
  get(path: string, handler: MoodleRouteHandler): void;
};

type MoodleRouteDependencies = {
  getSession?: (request: MoodleRouteRequest) => Promise<ServerSession | null>;
  getClient?: () => MoodleClient;
  getStatus?: () => ReturnType<typeof getMoodleServerStatus>;
};

function sendMoodleError(error: unknown, response: MoodleRouteResponse) {
  if (error instanceof SessionRepositoryUnavailableError) {
    response
      .status(503)
      .json({ error: "Session service is temporarily unavailable." });
    return;
  }
  if (error instanceof MoodleApiError) {
    const publicMessages: Record<typeof error.code, string> = {
      configuration: "Moodle read-only integration is not configured safely.",
      function_not_allowed:
        "Moodle function is not approved for read-only use.",
      authentication: "Moodle credentials were rejected.",
      permission: "Moodle service account lacks required read access.",
      remote: "Moodle verification failed.",
      timeout: "Moodle verification timed out.",
      invalid_response: "Moodle returned an invalid response.",
    };
    response.status(error.statusCode).json({
      error: publicMessages[error.code],
      code: error.code,
    });
    return;
  }
  response.status(502).json({ error: "Moodle verification failed." });
}

export function registerMoodleRoutes(
  app: MoodleRouteApp,
  dependencies: MoodleRouteDependencies = {}
) {
  const resolveSession = dependencies.getSession ?? getRequestSession;
  const getClient = dependencies.getClient ?? createMoodleClientFromEnvironment;
  const getStatus = dependencies.getStatus ?? getMoodleServerStatus;

  app.get("/api/integrations/moodle/status", async (request, response) => {
    try {
      const session = await resolveSession(request);
      if (!session) {
        response.status(401).json({ error: "Sign in required." });
        return;
      }
      if (session.activeRole !== "superadmin") {
        response.status(403).json({ error: "Super Admin access required." });
        return;
      }

      const status = getStatus();
      if (!status.configured) {
        response.json({
          ...status,
          state: status.enabled ? "unconfigured" : "disabled",
        });
        return;
      }

      const probe = await getClient().probe();
      response.json({
        ...status,
        state: probe.minimumPrivilegeVerified ? "ready" : "degraded",
        probe,
      });
    } catch (error) {
      sendMoodleError(error, response);
    }
  });
}
