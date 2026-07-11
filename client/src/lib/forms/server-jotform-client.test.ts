import { describe, expect, it, vi } from "vitest";

import {
  createJotformClient,
  JotformApiError,
} from "../../../../server/jotformClient";

function response(content: unknown) {
  return new Response(
    JSON.stringify({ responseCode: 200, message: "success", content }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("Jotform server client", () => {
  it("uses the server-only APIKEY header and bounded official endpoints", async () => {
    const fetchImpl = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/questions")) {
          return response({
            "2": { qid: "2", text: "Email", type: "control_email", order: "2" },
            "1": {
              qid: "1",
              text: "Name",
              type: "control_textbox",
              order: "1",
            },
          });
        }
        if (url.pathname.endsWith("/submissions")) {
          return response([
            { id: "9001", answers: { "1": { answer: "Applicant" } } },
          ]);
        }
        return response({
          id: "1234567890123",
          title: "Enquiry",
          status: "ENABLED",
          count: "1",
        });
      }
    );
    const client = createJotformClient({
      apiKey: "server-secret-key",
      region: "eu",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.getForm("1234567890123")).resolves.toMatchObject({
      title: "Enquiry",
    });
    await expect(client.getQuestions("1234567890123")).resolves.toEqual([
      expect.objectContaining({ qid: "1" }),
      expect.objectContaining({ qid: "2" }),
    ]);
    await expect(
      client.getSubmissions("1234567890123", 0, 5_000)
    ).resolves.toMatchObject({
      submissions: [expect.objectContaining({ id: "9001" })],
    });

    for (const [input, init] of fetchImpl.mock.calls) {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://eu-api.jotform.com");
      expect(url.searchParams.has("apiKey")).toBe(false);
      expect(new Headers(init?.headers).get("APIKEY")).toBe(
        "server-secret-key"
      );
    }
    const submissionsUrl = new URL(String(fetchImpl.mock.calls[2][0]));
    expect(submissionsUrl.searchParams.get("limit")).toBe("1000");
  });

  it("rejects path-like IDs before making a request", async () => {
    const fetchImpl = vi.fn();
    const client = createJotformClient({
      apiKey: "server-secret-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.getForm("../../user")).rejects.toBeInstanceOf(
      JotformApiError
    );
    await expect(client.getForm("../../user")).rejects.toMatchObject({
      code: "invalid_id",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces remote errors without exposing the API key", async () => {
    const client = createJotformClient({
      apiKey: "server-secret-key",
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({ responseCode: 401, message: "Invalid API key" }),
            { status: 401 }
          )
      ) as typeof fetch,
    });

    const error = await client.getForm("1234567890123").catch(value => value);
    expect(error).toMatchObject({ code: "remote", statusCode: 401 });
    expect(String(error)).not.toContain("server-secret-key");
  });
});
