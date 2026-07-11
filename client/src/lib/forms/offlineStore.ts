import type { FormSyncReceipt } from "@shared/nileForms";
import type {
  FormOfflineBundle,
  FormOfflineSyncItem,
} from "../../../../server/nileFormsService";
import {
  decryptOfflineValue,
  encryptOfflineValue,
  type OfflineEncryptedEnvelope,
} from "./offlineCrypto";

const DATABASE_NAME = "nile-forms-offline-v1";
const DATABASE_VERSION = 1;
const SECURE_STORE = "secure";
const QUEUE_STORE = "queue";
const RECEIPT_STORE = "receipts";

type SecureRecord = {
  key: "credential" | "bundle";
  envelope: OfflineEncryptedEnvelope;
  updatedAt: string;
};

type QueueRecord = {
  id: string;
  envelope: OfflineEncryptedEnvelope;
  status: "pending" | "rejected";
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

type ReceiptRecord = FormSyncReceipt & {
  storedAt: string;
};

export type OfflineDeviceCredential = {
  deviceId: string;
  deviceToken: string;
  label: string;
  enrolledAt: string;
  expiresAt: string;
};

export type OfflineQueuedSubmission = {
  item: FormOfflineSyncItem;
  formTitle: string;
  queuedAt: string;
};

export type OfflineQueueEntry = OfflineQueuedSubmission & {
  status: QueueRecord["status"];
  reason?: string;
};

export class OfflineStorageError extends Error {
  readonly code: "storage_unavailable" | "storage_quota" | "storage_failed";

  constructor(
    message: string,
    code: OfflineStorageError["code"],
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "OfflineStorageError";
    this.code = code;
  }
}

export function normalizeOfflineStorageError(error: unknown) {
  if (error instanceof OfflineStorageError) return error;
  if (
    error instanceof DOMException &&
    ["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name)
  ) {
    return new OfflineStorageError(
      "This device has no storage space left for another offline response.",
      "storage_quota",
      { cause: error }
    );
  }
  return new OfflineStorageError(
    "The encrypted offline workspace could not be updated.",
    "storage_failed",
    { cause: error }
  );
}

function requireIndexedDb() {
  if (!globalThis.indexedDB) {
    throw new OfflineStorageError(
      "Offline storage is unavailable in this browser.",
      "storage_unavailable"
    );
  }
  return globalThis.indexedDB;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function openDatabase() {
  const indexedDb = requireIndexedDb();
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SECURE_STORE)) {
        database.createObjectStore(SECURE_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(RECEIPT_STORE)) {
        database.createObjectStore(RECEIPT_STORE, {
          keyPath: "clientSubmissionId",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () =>
      reject(
        new Error(
          "Close other Nile Learn tabs before updating offline storage."
        )
      );
  });
}

async function readRecord<T>(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    return (await requestResult(
      transaction.objectStore(storeName).get(key)
    )) as T | undefined;
  } finally {
    database.close();
  }
}

async function readAllRecords<T>(storeName: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    return (await requestResult(
      transaction.objectStore(storeName).getAll()
    )) as T[];
  } finally {
    database.close();
  }
}

async function putRecord(storeName: string, value: unknown) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
  } catch (error) {
    throw normalizeOfflineStorageError(error);
  } finally {
    database.close();
  }
}

async function deleteRecord(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
  } catch (error) {
    throw normalizeOfflineStorageError(error);
  } finally {
    database.close();
  }
}

export async function hasOfflineWorkspace() {
  try {
    return Boolean(await readRecord<SecureRecord>(SECURE_STORE, "credential"));
  } catch (error) {
    throw normalizeOfflineStorageError(error);
  }
}

export async function saveOfflineCredential(
  passphrase: string,
  credential: OfflineDeviceCredential
) {
  await putRecord(SECURE_STORE, {
    key: "credential",
    envelope: await encryptOfflineValue(passphrase, credential),
    updatedAt: new Date().toISOString(),
  } satisfies SecureRecord);
}

export async function loadOfflineCredential(passphrase: string) {
  const record = await readRecord<SecureRecord>(SECURE_STORE, "credential");
  if (!record) return null;
  return decryptOfflineValue<OfflineDeviceCredential>(
    passphrase,
    record.envelope
  );
}

export async function saveOfflineBundle(
  passphrase: string,
  bundle: FormOfflineBundle
) {
  await putRecord(SECURE_STORE, {
    key: "bundle",
    envelope: await encryptOfflineValue(passphrase, bundle),
    updatedAt: new Date().toISOString(),
  } satisfies SecureRecord);
}

export async function loadOfflineBundle(passphrase: string) {
  const record = await readRecord<SecureRecord>(SECURE_STORE, "bundle");
  if (!record) return null;
  return decryptOfflineValue<FormOfflineBundle>(passphrase, record.envelope);
}

export async function queueOfflineSubmission(
  passphrase: string,
  submission: OfflineQueuedSubmission
) {
  const now = new Date().toISOString();
  await putRecord(QUEUE_STORE, {
    id: submission.item.clientSubmissionId,
    envelope: await encryptOfflineValue(passphrase, submission),
    status: "pending",
    createdAt: submission.queuedAt,
    updatedAt: now,
  } satisfies QueueRecord);
}

export async function listOfflineQueue(passphrase: string) {
  const records = await readAllRecords<QueueRecord>(QUEUE_STORE);
  const entries = await Promise.all(
    records.map(async record => ({
      ...(await decryptOfflineValue<OfflineQueuedSubmission>(
        passphrase,
        record.envelope
      )),
      status: record.status,
      reason: record.reason,
    }))
  );
  return entries.sort((left, right) =>
    right.queuedAt.localeCompare(left.queuedAt)
  );
}

export async function removeOfflineQueueItem(clientSubmissionId: string) {
  await deleteRecord(QUEUE_STORE, clientSubmissionId);
}

export async function applyOfflineSyncReceipts(receipts: FormSyncReceipt[]) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(
      [QUEUE_STORE, RECEIPT_STORE],
      "readwrite"
    );
    const queue = transaction.objectStore(QUEUE_STORE);
    const storedReceipts = transaction.objectStore(RECEIPT_STORE);
    const storedAt = new Date().toISOString();
    for (const receipt of receipts) {
      storedReceipts.put({ ...receipt, storedAt } satisfies ReceiptRecord);
      if (receipt.status === "rejected") {
        const record = (await requestResult(
          queue.get(receipt.clientSubmissionId)
        )) as QueueRecord | undefined;
        if (record) {
          queue.put({
            ...record,
            status: "rejected",
            reason: receipt.reason,
            updatedAt: storedAt,
          } satisfies QueueRecord);
        }
      } else {
        queue.delete(receipt.clientSubmissionId);
      }
    }
    await transactionDone(transaction);
  } catch (error) {
    throw normalizeOfflineStorageError(error);
  } finally {
    database.close();
  }
}

export async function listOfflineReceipts() {
  const records = await readAllRecords<ReceiptRecord>(RECEIPT_STORE);
  return records.sort((left, right) =>
    right.receivedAt.localeCompare(left.receivedAt)
  );
}

export async function clearOfflineWorkspace() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(
      [SECURE_STORE, QUEUE_STORE, RECEIPT_STORE],
      "readwrite"
    );
    transaction.objectStore(SECURE_STORE).clear();
    transaction.objectStore(QUEUE_STORE).clear();
    transaction.objectStore(RECEIPT_STORE).clear();
    await transactionDone(transaction);
  } catch (error) {
    throw normalizeOfflineStorageError(error);
  } finally {
    database.close();
  }
}

export const offlineStoreMetadata = {
  databaseName: DATABASE_NAME,
  version: DATABASE_VERSION,
} as const;
