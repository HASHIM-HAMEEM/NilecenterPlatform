const OFFLINE_AAD = "nile-forms-offline:v1";
const PBKDF2_ITERATIONS = 310_000;

export type OfflineEncryptedEnvelope = {
  version: 1;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
  };
  ciphertext: string;
};

export class OfflineCryptoError extends Error {
  readonly code:
    | "crypto_unavailable"
    | "passphrase_invalid"
    | "envelope_invalid"
    | "decryption_failed";

  constructor(
    message: string,
    code: OfflineCryptoError["code"],
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "OfflineCryptoError";
    this.code = code;
  }
}

function webCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new OfflineCryptoError(
      "Secure browser cryptography is unavailable.",
      "crypto_unavailable"
    );
  }
  return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch (error) {
    throw new OfflineCryptoError(
      "The encrypted offline record is malformed.",
      "envelope_invalid",
      { cause: error }
    );
  }
}

function assertPassphrase(passphrase: string) {
  if (passphrase.length < 10 || passphrase.length > 256) {
    throw new OfflineCryptoError(
      "Use an offline passphrase between 10 and 256 characters.",
      "passphrase_invalid"
    );
  }
}

function assertEnvelope(
  value: unknown
): asserts value is OfflineEncryptedEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OfflineCryptoError(
      "The encrypted offline record is invalid.",
      "envelope_invalid"
    );
  }
  const envelope = value as Partial<OfflineEncryptedEnvelope>;
  if (
    envelope.version !== 1 ||
    envelope.kdf?.name !== "PBKDF2" ||
    envelope.kdf.hash !== "SHA-256" ||
    envelope.kdf.iterations !== PBKDF2_ITERATIONS ||
    typeof envelope.kdf.salt !== "string" ||
    envelope.cipher?.name !== "AES-GCM" ||
    typeof envelope.cipher.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new OfflineCryptoError(
      "The encrypted offline record uses an unsupported format.",
      "envelope_invalid"
    );
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const crypto = webCrypto();
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptOfflineValue<T>(
  passphrase: string,
  value: T
): Promise<OfflineEncryptedEnvelope> {
  assertPassphrase(passphrase);
  const crypto = webCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(OFFLINE_AAD),
      tagLength: 128,
    },
    key,
    plaintext
  );
  return {
    version: 1,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: { name: "AES-GCM", iv: bytesToBase64(iv) },
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptOfflineValue<T>(
  passphrase: string,
  envelopeInput: unknown
): Promise<T> {
  assertPassphrase(passphrase);
  assertEnvelope(envelopeInput);
  const crypto = webCrypto();
  try {
    const salt = base64ToBytes(envelopeInput.kdf.salt);
    const iv = base64ToBytes(envelopeInput.cipher.iv);
    if (salt.byteLength !== 16 || iv.byteLength !== 12) {
      throw new OfflineCryptoError(
        "The encrypted offline record has invalid parameters.",
        "envelope_invalid"
      );
    }
    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(OFFLINE_AAD),
        tagLength: 128,
      },
      key,
      base64ToBytes(envelopeInput.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch (error) {
    if (error instanceof OfflineCryptoError) throw error;
    throw new OfflineCryptoError(
      "The offline vault could not be unlocked. Check the passphrase or reset this device.",
      "decryption_failed",
      { cause: error }
    );
  }
}

export const offlineCryptoParameters = {
  version: 1,
  pbkdf2Iterations: PBKDF2_ITERATIONS,
} as const;
