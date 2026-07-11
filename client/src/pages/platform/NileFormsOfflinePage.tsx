import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  CloudUpload,
  Download,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import NileFormRenderer from "@/components/forms/NileFormRenderer";
import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import { getStoredAuthSession } from "@/lib/auth/session";
import {
  enrollFormOfflineDeviceRequest,
  fetchFormOfflineBundleRequest,
  revokeFormOfflineDeviceRequest,
  syncFormOfflineBatchRequest,
} from "@/lib/forms/api";
import { registerNileFormsServiceWorker } from "@/lib/forms/offlineServiceWorker";
import {
  applyOfflineSyncReceipts,
  clearOfflineWorkspace,
  hasOfflineWorkspace,
  listOfflineQueue,
  listOfflineReceipts,
  loadOfflineBundle,
  loadOfflineCredential,
  queueOfflineSubmission,
  removeOfflineQueueItem,
  saveOfflineBundle,
  saveOfflineCredential,
  type OfflineDeviceCredential,
  type OfflineQueueEntry,
} from "@/lib/forms/offlineStore";
import type { Role } from "@/lib/platformData";
import type { FormSyncReceipt } from "@shared/nileForms";
import type {
  FormOfflineBundle,
  FormOfflineSyncItem,
  FormResponderBundle,
} from "../../../../server/nileFormsService";

type WorkspacePhase = "loading" | "setup" | "locked" | "ready" | "error";
type OfflineView = "forms" | "queue";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function reasonLabel(value?: string) {
  return (value ?? "Needs attention").replaceAll("_", " ");
}

export default function NileFormsOfflinePage({ role }: { role: Role }) {
  const session = getStoredAuthSession();
  const [phase, setPhase] = useState<WorkspacePhase>("loading");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("Nile Learn staff device");
  const [passphrase, setPassphrase] = useState("");
  const [credential, setCredential] = useState<OfflineDeviceCredential | null>(
    null
  );
  const [bundle, setBundle] = useState<FormOfflineBundle | null>(null);
  const [queue, setQueue] = useState<OfflineQueueEntry[]>([]);
  const [receipts, setReceipts] = useState<FormSyncReceipt[]>([]);
  const [view, setView] = useState<OfflineView>("forms");
  const [selected, setSelected] = useState<FormResponderBundle | null>(null);
  const [captureKey, setCaptureKey] = useState(0);
  const [busy, setBusy] = useState<
    "setup" | "unlock" | "download" | "sync" | "reset" | "renew" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const pendingQueue = useMemo(
    () => queue.filter(item => item.status === "pending"),
    [queue]
  );
  const now = Date.now();
  const credentialExpired = credential
    ? Date.parse(credential.expiresAt) <= now
    : false;
  const bundleExpired = bundle ? Date.parse(bundle.expiresAt) <= now : true;
  const captureAvailable = Boolean(
    credential && bundle && !credentialExpired && !bundleExpired
  );

  useEffect(() => {
    let cancelled = false;
    void hasOfflineWorkspace()
      .then(exists => {
        if (!cancelled) setPhase(exists ? "locked" : "setup");
      })
      .catch(problem => {
        if (!cancelled) {
          setError(
            problem instanceof Error
              ? problem.message
              : "Offline storage could not be opened."
          );
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void registerNileFormsServiceWorker().catch(() => undefined);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshLocalState = async (activePassphrase: string) => {
    const [storedBundle, storedQueue, storedReceipts] = await Promise.all([
      loadOfflineBundle(activePassphrase),
      listOfflineQueue(activePassphrase),
      listOfflineReceipts(),
    ]);
    setBundle(storedBundle);
    setQueue(storedQueue);
    setReceipts(storedReceipts);
  };

  const setupWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!online) {
      setError("Connect to Nile Learn before enrolling this device.");
      return;
    }
    if (passphraseInput !== confirmPassphrase) {
      setError("The passphrases do not match.");
      return;
    }
    setBusy("setup");
    const enrollment = await enrollFormOfflineDeviceRequest(deviceLabel);
    if (!enrollment.ok || !enrollment.data) {
      setError(enrollment.error ?? "This device could not be enrolled.");
      setBusy(null);
      return;
    }
    const nextCredential: OfflineDeviceCredential = {
      deviceId: enrollment.data.device.id,
      deviceToken: enrollment.data.deviceToken,
      label: enrollment.data.device.label,
      enrolledAt: enrollment.data.device.enrolledAt,
      expiresAt: enrollment.data.device.expiresAt,
    };
    try {
      await saveOfflineCredential(passphraseInput, nextCredential);
      const downloaded = await fetchFormOfflineBundleRequest(
        nextCredential.deviceId,
        nextCredential.deviceToken
      );
      if (!downloaded.ok || !downloaded.data) {
        throw new Error(
          downloaded.error ?? "Assigned forms could not be downloaded."
        );
      }
      await saveOfflineBundle(passphraseInput, downloaded.data);
      setCredential(nextCredential);
      setBundle(downloaded.data);
      setQueue([]);
      setReceipts([]);
      setPassphrase(passphraseInput);
      setPassphraseInput("");
      setConfirmPassphrase("");
      setPhase("ready");
      setNotice("Device enrolled and assigned forms downloaded.");
    } catch (problem) {
      void revokeFormOfflineDeviceRequest(nextCredential.deviceId);
      setError(
        problem instanceof Error
          ? problem.message
          : "The encrypted workspace could not be created."
      );
    } finally {
      setBusy(null);
    }
  };

  const unlockWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("unlock");
    setError("");
    setNotice("");
    try {
      const storedCredential = await loadOfflineCredential(passphraseInput);
      if (!storedCredential) throw new Error("No enrolled device was found.");
      await refreshLocalState(passphraseInput);
      setCredential(storedCredential);
      setPassphrase(passphraseInput);
      setPassphraseInput("");
      setPhase("ready");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "The offline vault could not be unlocked."
      );
    } finally {
      setBusy(null);
    }
  };

  const downloadBundle = async () => {
    if (!credential || !passphrase || !online) return;
    setBusy("download");
    setError("");
    setNotice("");
    const response = await fetchFormOfflineBundleRequest(
      credential.deviceId,
      credential.deviceToken
    );
    if (response.ok && response.data) {
      try {
        await saveOfflineBundle(passphrase, response.data);
        setBundle(response.data);
        setSelected(null);
        setNotice("Assigned forms are current on this device.");
      } catch (problem) {
        setError(
          problem instanceof Error ? problem.message : "Download failed."
        );
      }
    } else {
      setError(response.error ?? "Assigned forms could not be downloaded.");
    }
    setBusy(null);
  };

  const renewEnrollment = async () => {
    if (!credential || !passphrase || !online) return;
    setBusy("renew");
    setError("");
    setNotice("");
    const enrollment = await enrollFormOfflineDeviceRequest(credential.label);
    if (!enrollment.ok || !enrollment.data) {
      setError(enrollment.error ?? "Device enrollment could not be renewed.");
      setBusy(null);
      return;
    }
    const nextCredential: OfflineDeviceCredential = {
      deviceId: enrollment.data.device.id,
      deviceToken: enrollment.data.deviceToken,
      label: enrollment.data.device.label,
      enrolledAt: enrollment.data.device.enrolledAt,
      expiresAt: enrollment.data.device.expiresAt,
    };
    const downloaded = await fetchFormOfflineBundleRequest(
      nextCredential.deviceId,
      nextCredential.deviceToken
    );
    if (!downloaded.ok || !downloaded.data) {
      void revokeFormOfflineDeviceRequest(nextCredential.deviceId);
      setError(downloaded.error ?? "Assigned forms could not be downloaded.");
      setBusy(null);
      return;
    }
    try {
      await saveOfflineCredential(passphrase, nextCredential);
      await saveOfflineBundle(passphrase, downloaded.data);
      void revokeFormOfflineDeviceRequest(credential.deviceId);
      setCredential(nextCredential);
      setBundle(downloaded.data);
      setSelected(null);
      setNotice("Device enrollment renewed. Pending responses were preserved.");
    } catch (problem) {
      void revokeFormOfflineDeviceRequest(nextCredential.deviceId);
      setError(problem instanceof Error ? problem.message : "Renewal failed.");
    }
    setBusy(null);
  };

  const queueSubmission = async (
    form: FormResponderBundle,
    payload: Omit<FormOfflineSyncItem, "publicationId" | "versionId">
  ) => {
    if (!passphrase || !captureAvailable) {
      return {
        ok: false,
        error: "Refresh this device before offline capture.",
      };
    }
    try {
      await queueOfflineSubmission(passphrase, {
        item: {
          ...payload,
          publicationId: form.publication.id,
          versionId: form.version.id,
          respondentUserId: session?.userId,
        },
        formTitle: form.definition.title,
        queuedAt: payload.clientSubmittedAt,
      });
      await refreshLocalState(passphrase);
      return { ok: true };
    } catch (problem) {
      return {
        ok: false,
        error:
          problem instanceof Error
            ? problem.message
            : "The response could not be encrypted.",
      };
    }
  };

  const syncQueue = async () => {
    if (!credential || !passphrase || !online || !pendingQueue.length) return;
    setBusy("sync");
    setError("");
    setNotice("");
    const response = await syncFormOfflineBatchRequest(
      credential.deviceId,
      credential.deviceToken,
      pendingQueue.map(item => item.item)
    );
    if (response.ok && response.data) {
      try {
        await applyOfflineSyncReceipts(response.data.receipts);
        await refreshLocalState(passphrase);
        const accepted = response.data.receipts.filter(
          receipt =>
            receipt.status === "accepted" || receipt.status === "duplicate"
        ).length;
        const quarantined = response.data.receipts.filter(
          receipt => receipt.status === "quarantined"
        ).length;
        setNotice(
          `${accepted} response${accepted === 1 ? "" : "s"} synced${
            quarantined ? `; ${quarantined} sent to review quarantine` : ""
          }.`
        );
      } catch (problem) {
        setError(
          problem instanceof Error
            ? problem.message
            : "Sync receipts could not be stored."
        );
      }
    } else {
      setError(
        response.error ?? "Pending responses could not be synchronized."
      );
    }
    setBusy(null);
  };

  const removeQueueItem = async (clientSubmissionId: string) => {
    if (!passphrase) return;
    try {
      await removeOfflineQueueItem(clientSubmissionId);
      await refreshLocalState(passphrase);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Response could not be removed."
      );
    }
  };

  const resetWorkspace = async () => {
    if (!credential) return;
    setBusy("reset");
    setError("");
    if (online) {
      const response = await revokeFormOfflineDeviceRequest(
        credential.deviceId
      );
      if (!response.ok && response.code !== "offline_device_not_found") {
        setError(response.error ?? "Device revocation failed.");
        setBusy(null);
        return;
      }
    }
    try {
      await clearOfflineWorkspace();
      setCredential(null);
      setBundle(null);
      setQueue([]);
      setReceipts([]);
      setPassphrase("");
      setPassphraseInput("");
      setSelected(null);
      setConfirmReset(false);
      setPhase("setup");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Reset failed.");
    }
    setBusy(null);
  };

  const lockWorkspace = () => {
    setPassphrase("");
    setCredential(null);
    setBundle(null);
    setQueue([]);
    setReceipts([]);
    setSelected(null);
    setNotice("");
    setError("");
    setPhase("locked");
  };

  return (
    <PlatformShell role={role} title="Offline forms">
      <div className="nile-forms-page nile-forms-offline-page">
        <NileFormsNavigation role={role} />

        <header className="nile-forms-page-header">
          <div>
            <span className="nile-forms-eyebrow">Staff capture</span>
            <h1>Offline forms</h1>
            <p>
              Encrypted responses for assigned forms on this enrolled device.
            </p>
          </div>
          <span
            className={`nile-offline-network ${online ? "is-online" : "is-offline"}`}
          >
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            {online ? "Online" : "Offline"}
          </span>
        </header>

        {phase === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Opening encrypted workspace</strong>
          </section>
        ) : phase === "error" ? (
          <section className="nile-forms-state" role="alert">
            <AlertTriangle size={24} />
            <strong>Offline storage unavailable</strong>
            <p>{error}</p>
          </section>
        ) : phase === "setup" ? (
          <section className="nile-offline-access-layout">
            <div className="nile-offline-access-copy">
              <span className="nile-offline-access-icon">
                <ShieldCheck size={24} />
              </span>
              <h2>Enroll this staff device</h2>
              <p>
                Enrollment expires after 72 hours. Restricted fields are never
                included.
              </p>
              <dl>
                <div>
                  <dt>Encryption</dt>
                  <dd>AES-256-GCM</dd>
                </div>
                <div>
                  <dt>Key derivation</dt>
                  <dd>PBKDF2-SHA-256</dd>
                </div>
                <div>
                  <dt>Authority</dt>
                  <dd>Active staff session</dd>
                </div>
              </dl>
            </div>
            <form
              className="nile-offline-access-form"
              onSubmit={setupWorkspace}
            >
              <label>
                Device label
                <input
                  value={deviceLabel}
                  maxLength={80}
                  required
                  onChange={event => setDeviceLabel(event.target.value)}
                />
              </label>
              <label>
                Offline passphrase
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={256}
                  required
                  value={passphraseInput}
                  onChange={event => setPassphraseInput(event.target.value)}
                />
                <small>10 characters minimum. It cannot be recovered.</small>
              </label>
              <label>
                Confirm passphrase
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={256}
                  required
                  value={confirmPassphrase}
                  onChange={event => setConfirmPassphrase(event.target.value)}
                />
              </label>
              {error ? (
                <p className="nile-form-notice is-error">{error}</p>
              ) : null}
              <button
                type="submit"
                className="platform-primary-button"
                disabled={busy !== null || !online}
              >
                <Smartphone size={16} />
                {busy === "setup" ? "Enrolling" : "Enroll device"}
              </button>
            </form>
          </section>
        ) : phase === "locked" ? (
          <section className="nile-offline-access-layout is-locked">
            <div className="nile-offline-access-copy">
              <span className="nile-offline-access-icon">
                <LockKeyhole size={24} />
              </span>
              <h2>Offline workspace locked</h2>
              <p>The passphrase is not stored by Nile Learn.</p>
            </div>
            <form
              className="nile-offline-access-form"
              onSubmit={unlockWorkspace}
            >
              <label>
                Offline passphrase
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={10}
                  maxLength={256}
                  autoFocus
                  required
                  value={passphraseInput}
                  onChange={event => setPassphraseInput(event.target.value)}
                />
              </label>
              {error ? (
                <p className="nile-form-notice is-error">{error}</p>
              ) : null}
              <button
                type="submit"
                className="platform-primary-button"
                disabled={busy !== null}
              >
                <KeyRound size={16} />
                {busy === "unlock" ? "Unlocking" : "Unlock"}
              </button>
            </form>
          </section>
        ) : credential ? (
          <>
            <section
              className="nile-offline-device-bar"
              aria-label="Offline device"
            >
              <div className="nile-offline-device-identity">
                <span>
                  <Smartphone size={18} />
                </span>
                <div>
                  <strong>{credential.label}</strong>
                  <small>
                    {credentialExpired
                      ? "Enrollment expired"
                      : `Expires ${formatDate(credential.expiresAt)}`}
                  </small>
                </div>
              </div>
              <div className="nile-offline-device-metrics">
                <span>
                  <strong>{bundle?.forms.length ?? 0}</strong> forms
                </span>
                <span>
                  <strong>{pendingQueue.length}</strong> pending
                </span>
                <span>
                  <strong>{receipts.length}</strong> receipts
                </span>
              </div>
              <div className="nile-offline-device-actions">
                {credentialExpired ? (
                  <button
                    type="button"
                    className="platform-primary-button"
                    disabled={!online || busy !== null}
                    onClick={renewEnrollment}
                  >
                    <RefreshCw size={15} />
                    {busy === "renew" ? "Renewing" : "Renew"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="platform-secondary-button"
                    disabled={!online || busy !== null}
                    onClick={downloadBundle}
                  >
                    <Download size={15} />
                    {busy === "download" ? "Updating" : "Update forms"}
                  </button>
                )}
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={lockWorkspace}
                  disabled={busy !== null}
                >
                  <LockKeyhole size={15} />
                  Lock
                </button>
              </div>
            </section>

            {bundleExpired || credentialExpired ? (
              <section className="nile-offline-warning" role="alert">
                <AlertTriangle size={18} />
                <div>
                  <strong>
                    {credentialExpired
                      ? "Enrollment expired"
                      : "Form bundle expired"}
                  </strong>
                  <p>
                    Reconnect and{" "}
                    {credentialExpired
                      ? "renew this device"
                      : "update assigned forms"}{" "}
                    before capturing another response.
                  </p>
                </div>
              </section>
            ) : null}

            {notice ? (
              <p className="nile-form-notice is-success">{notice}</p>
            ) : null}
            {error ? (
              <p className="nile-form-notice is-error">{error}</p>
            ) : null}

            <div
              className="nile-offline-view-tabs"
              role="tablist"
              aria-label="Offline workspace"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "forms"}
                className={view === "forms" ? "is-active" : ""}
                onClick={() => setView("forms")}
              >
                <ClipboardList size={15} />
                Capture
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "queue"}
                className={view === "queue" ? "is-active" : ""}
                onClick={() => setView("queue")}
              >
                <CloudUpload size={15} />
                Sync queue
                {queue.length ? <span>{queue.length}</span> : null}
              </button>
            </div>

            {view === "forms" ? (
              selected ? (
                <section className="nile-offline-capture-workspace">
                  <button
                    type="button"
                    className="nile-forms-back-link"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft size={15} />
                    Offline forms
                  </button>
                  <NileFormRenderer
                    key={`${selected.publication.id}-${captureKey}`}
                    bundle={selected}
                    mode="offline"
                    onOfflineQueued={payload =>
                      queueSubmission(selected, payload)
                    }
                    onSubmitted={() => {
                      setCaptureKey(value => value + 1);
                      setView("queue");
                    }}
                  />
                </section>
              ) : bundle?.forms.length ? (
                <section
                  className="nile-offline-form-list"
                  aria-label="Downloaded forms"
                >
                  {bundle.forms.map(form => {
                    const completed =
                      !form.publication.allowMultiple &&
                      form.previousSubmissions.some(
                        item => item.status !== "withdrawn"
                      );
                    return (
                      <article key={form.publication.id}>
                        <span className="nile-offline-form-icon">
                          {completed ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <ClipboardList size={18} />
                          )}
                        </span>
                        <div>
                          <h2>{form.definition.title}</h2>
                          <p>{form.version.content.description.en}</p>
                          <small>
                            Version {form.version.versionNumber} · downloaded{" "}
                            {formatDate(bundle.generatedAt)}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="platform-primary-button"
                          disabled={!captureAvailable || completed}
                          onClick={() => setSelected(form)}
                        >
                          {completed ? "Completed" : "Open"}
                        </button>
                      </article>
                    );
                  })}
                </section>
              ) : (
                <section className="nile-forms-state">
                  <ClipboardList size={24} />
                  <strong>No offline forms assigned</strong>
                  <p>
                    Update this device after an eligible staff form is assigned.
                  </p>
                </section>
              )
            ) : (
              <section className="nile-offline-queue-workspace">
                <header>
                  <div>
                    <h2>Sync queue</h2>
                    <p>Only pending encrypted responses are sent.</p>
                  </div>
                  <button
                    type="button"
                    className="platform-primary-button"
                    disabled={
                      !online ||
                      !pendingQueue.length ||
                      busy !== null ||
                      credentialExpired
                    }
                    onClick={syncQueue}
                  >
                    <CloudUpload size={16} />
                    {busy === "sync"
                      ? "Syncing"
                      : `Sync ${pendingQueue.length || "now"}`}
                  </button>
                </header>
                {queue.length ? (
                  <div className="nile-offline-queue-list">
                    {queue.map(entry => (
                      <article key={entry.item.clientSubmissionId}>
                        <span
                          className={`nile-offline-queue-state is-${entry.status}`}
                        >
                          {entry.status === "pending" ? (
                            <CloudUpload size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                        </span>
                        <div>
                          <strong>{entry.formTitle}</strong>
                          <small>{formatDate(entry.queuedAt)}</small>
                          {entry.reason ? (
                            <p>{reasonLabel(entry.reason)}</p>
                          ) : null}
                        </div>
                        <span className={`nile-form-status is-${entry.status}`}>
                          {entry.status}
                        </span>
                        <button
                          type="button"
                          className="nile-forms-icon-button"
                          title="Delete local response"
                          aria-label={`Delete ${entry.formTitle} response`}
                          onClick={() =>
                            removeQueueItem(entry.item.clientSubmissionId)
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="nile-forms-state is-compact">
                    <CheckCircle2 size={22} />
                    <strong>Queue clear</strong>
                    <p>No response is waiting to sync.</p>
                  </div>
                )}

                {receipts.length ? (
                  <div className="nile-offline-receipts">
                    <h3>Recent receipts</h3>
                    {receipts.slice(0, 8).map(receipt => (
                      <div key={receipt.id}>
                        <CheckCircle2 size={15} />
                        <span>{receipt.status}</span>
                        <small>{formatDate(receipt.receivedAt)}</small>
                        {receipt.reason ? (
                          <em>{reasonLabel(receipt.reason)}</em>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            )}

            <section className="nile-offline-reset-zone">
              {confirmReset ? (
                <div>
                  <strong>Reset this offline device?</strong>
                  <p>
                    {queue.length} local response{queue.length === 1 ? "" : "s"}{" "}
                    will be permanently removed.
                  </p>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={() => setConfirmReset(false)}
                    disabled={busy !== null}
                  >
                    Keep device
                  </button>
                  <button
                    type="button"
                    className="platform-danger-button"
                    onClick={resetWorkspace}
                    disabled={busy !== null}
                  >
                    <Trash2 size={15} />
                    {busy === "reset" ? "Resetting" : "Reset device"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="nile-offline-reset-button"
                  onClick={() => setConfirmReset(true)}
                >
                  Reset offline device
                </button>
              )}
            </section>
          </>
        ) : null}
      </div>
    </PlatformShell>
  );
}
