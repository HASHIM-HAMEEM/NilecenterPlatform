export type JotformRegion = "standard" | "eu" | "hipaa";

export type JotformForm = {
  id: string;
  title: string;
  status: string;
  count: string;
  created_at?: string;
  updated_at?: string;
};

export type JotformQuestion = {
  qid: string;
  name?: string;
  text: string;
  type: string;
  order?: string;
};

export type JotformSubmissionAnswer = {
  name?: string;
  text?: string;
  type?: string;
  answer?: unknown;
  prettyFormat?: string;
};

export type JotformSubmission = {
  id: string;
  form_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  answers: Record<string, JotformSubmissionAnswer>;
};

type JotformEnvelope<T> = {
  responseCode: number;
  message: string;
  content: T;
  resultSet?: { offset: number; limit: number; count: number };
};

export class JotformApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: "configuration" | "invalid_id" | "remote" | "timeout"
  ) {
    super(message);
    this.name = "JotformApiError";
  }
}

type JotformClientDependencies = {
  apiKey: string;
  region?: JotformRegion;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const baseUrls: Record<JotformRegion, string> = {
  standard: "https://api.jotform.com",
  eu: "https://eu-api.jotform.com",
  hipaa: "https://hipaa-api.jotform.com",
};
const jotformIdPattern = /^\d{3,30}$/;

function requireJotformId(value: string, label: string) {
  const id = value.trim();
  if (!jotformIdPattern.test(id)) {
    throw new JotformApiError(`${label} is invalid.`, 400, "invalid_id");
  }
  return id;
}

export function createJotformClient({
  apiKey,
  region = "standard",
  fetchImpl = fetch,
  timeoutMs = 15_000,
}: JotformClientDependencies) {
  const key = apiKey.trim();
  if (!key) {
    throw new JotformApiError(
      "Jotform migration credentials are not configured.",
      503,
      "configuration"
    );
  }
  const baseUrl = baseUrls[region];

  const request = async <T>(path: string, query?: Record<string, string>) => {
    const url = new URL(path, `${baseUrl}/`);
    Object.entries(query ?? {}).forEach(([name, value]) =>
      url.searchParams.set(name, value)
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json", APIKEY: key },
        signal: controller.signal,
      });
      const payload = (await response
        .json()
        .catch(() => null)) as JotformEnvelope<T> | null;
      if (
        !response.ok ||
        !payload ||
        typeof payload.responseCode !== "number" ||
        payload.responseCode >= 400
      ) {
        throw new JotformApiError(
          payload?.message || `Jotform returned HTTP ${response.status}.`,
          response.status || 502,
          "remote"
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof JotformApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new JotformApiError(
          "Jotform did not respond before the migration timeout.",
          504,
          "timeout"
        );
      }
      throw new JotformApiError(
        error instanceof Error ? error.message : "Jotform request failed.",
        502,
        "remote"
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    region,
    async listForms(offset = 0, limit = 200) {
      const boundedOffset = Math.max(0, Math.trunc(offset));
      const boundedLimit = Math.min(1_000, Math.max(1, Math.trunc(limit)));
      const response = await request<JotformForm[]>("user/forms", {
        offset: String(boundedOffset),
        limit: String(boundedLimit),
        orderby: "updated_at",
      });
      return {
        forms: Array.isArray(response.content) ? response.content : [],
        resultSet: response.resultSet,
      };
    },

    async getForm(formIdInput: string) {
      const formId = requireJotformId(formIdInput, "Jotform form ID");
      const response = await request<JotformForm>(`form/${formId}`);
      return response.content;
    },

    async getQuestions(formIdInput: string) {
      const formId = requireJotformId(formIdInput, "Jotform form ID");
      const response = await request<Record<string, JotformQuestion>>(
        `form/${formId}/questions`
      );
      return Object.values(response.content ?? {}).sort(
        (left, right) => Number(left.order ?? 0) - Number(right.order ?? 0)
      );
    },

    async getSubmissions(formIdInput: string, offset = 0, limit = 500) {
      const formId = requireJotformId(formIdInput, "Jotform form ID");
      const boundedOffset = Math.max(0, Math.trunc(offset));
      const boundedLimit = Math.min(1_000, Math.max(1, Math.trunc(limit)));
      const response = await request<JotformSubmission[]>(
        `form/${formId}/submissions`,
        {
          offset: String(boundedOffset),
          limit: String(boundedLimit),
          orderby: "created_at",
        }
      );
      return {
        submissions: Array.isArray(response.content) ? response.content : [],
        resultSet: response.resultSet,
      };
    },
  };
}

export type JotformClient = ReturnType<typeof createJotformClient>;

export function configuredJotformRegion(): JotformRegion {
  const value = process.env.JOTFORM_API_REGION?.trim().toLowerCase();
  return value === "eu" || value === "hipaa" ? value : "standard";
}

export function createJotformClientFromEnvironment() {
  return createJotformClient({
    apiKey: process.env.JOTFORM_API_KEY ?? "",
    region: configuredJotformRegion(),
  });
}
