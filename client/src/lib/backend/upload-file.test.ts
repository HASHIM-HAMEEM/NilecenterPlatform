import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadNccFile } from "./api";

const intent = {
  id: "file-1",
  uploadUrl: "https://storage.example/put/abc",
  expiresAt: "2099-01-01T00:00:00Z",
  headers: { "x-amz-meta-tag": "v1" },
  file: { id: "file-1", status: "pending" },
};

const done = {
  file: {
    id: "file-1",
    entityType: "student",
    entityId: "student-1",
    purpose: "passport",
    status: "ready",
    originalFilename: "passport.pdf",
    contentType: "application/pdf",
    sizeBytes: 10,
    checksumSha256: null,
    variants: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    errorDetail: null,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const file = new File(["0123456789"], "passport.pdf", {
  type: "application/pdf",
});

describe("uploadNccFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs intent → PUT → complete", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? "GET" });
        if (url === "/api/ncc/files/uploads")
          return jsonResponse(intent);
        if (url === intent.uploadUrl) return new Response(null, { status: 200 });
        return jsonResponse(done);
      })
    );
    const result = await uploadNccFile({
      entityType: "student",
      entityId: "student-1",
      purpose: "passport",
      file,
    });
    expect(result.id).toBe("file-1");
    expect(calls.map(call => call.method)).toEqual(["POST", "PUT", "POST"]);
    expect(calls[2].url).toContain("/api/ncc/files/uploads/file-1/complete");
  });

  it("archives the pending file and throws when the storage PUT fails", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? "GET" });
        if (url === "/api/ncc/files/uploads")
          return jsonResponse(intent);
        if (url === intent.uploadUrl) return new Response(null, { status: 403 });
        return jsonResponse({ file: { ...done.file, status: "archived" } });
      })
    );
    await expect(
      uploadNccFile({
        entityType: "student",
        entityId: "student-1",
        purpose: "passport",
        file,
      })
    ).rejects.toThrow(/403|failed/i);
    expect(calls.map(call => call.method)).toEqual(["POST", "PUT", "POST"]);
    expect(calls[2].url).toBe("/api/ncc/files/file-1/archive");
  });
});
