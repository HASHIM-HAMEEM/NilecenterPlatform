import { describe, expect, it } from "vitest";

import {
  decryptOfflineValue,
  encryptOfflineValue,
  offlineCryptoParameters,
} from "./offlineCrypto";
import {
  hasOfflineWorkspace,
  normalizeOfflineStorageError,
} from "./offlineStore";

describe("Nile Forms offline encryption", () => {
  it("round trips structured responses through the versioned AES-GCM envelope", async () => {
    const value = {
      publicationId: "publication_form_incident_1",
      answers: { location: "Room 4", severity: 3 },
    };
    const envelope = await encryptOfflineValue(
      "correct horse battery staple",
      value
    );

    expect(envelope).toMatchObject({
      version: 1,
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: offlineCryptoParameters.pbkdf2Iterations,
      },
      cipher: { name: "AES-GCM" },
    });
    expect(JSON.stringify(envelope)).not.toContain("Room 4");
    await expect(
      decryptOfflineValue("correct horse battery staple", envelope)
    ).resolves.toEqual(value);
  });

  it("fails closed for a wrong passphrase or corrupted ciphertext", async () => {
    const envelope = await encryptOfflineValue("one secure passphrase", {
      answer: "encrypted",
    });
    await expect(
      decryptOfflineValue("different secure passphrase", envelope)
    ).rejects.toMatchObject({ code: "decryption_failed" });

    const corrupted = structuredClone(envelope);
    const last = corrupted.ciphertext.at(-1) === "A" ? "B" : "A";
    corrupted.ciphertext = `${corrupted.ciphertext.slice(0, -1)}${last}`;
    await expect(
      decryptOfflineValue("one secure passphrase", corrupted)
    ).rejects.toMatchObject({ code: "decryption_failed" });
  });

  it("rejects short passphrases and unsupported envelopes", async () => {
    await expect(encryptOfflineValue("short", {})).rejects.toMatchObject({
      code: "passphrase_invalid",
    });
    await expect(
      decryptOfflineValue("one secure passphrase", { version: 99 })
    ).rejects.toMatchObject({ code: "envelope_invalid" });
  });
});

describe("Nile Forms offline storage failures", () => {
  it("normalizes browser quota failures for recovery UI", () => {
    const result = normalizeOfflineStorageError(
      new DOMException("Quota reached", "QuotaExceededError")
    );
    expect(result).toMatchObject({ code: "storage_quota" });
  });

  it("fails explicitly when IndexedDB is unavailable", async () => {
    await expect(hasOfflineWorkspace()).rejects.toMatchObject({
      code: "storage_unavailable",
    });
  });
});
