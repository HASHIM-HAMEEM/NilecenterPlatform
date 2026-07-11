import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
  History,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  commitJotformMigrationRequest,
  fetchJotformMigrationRuns,
  fetchJotformMigrationStatus,
  fetchJotformRemoteForms,
  inspectJotformMigrationRequest,
  previewJotformMigrationRequest,
  reconcileJotformMigrationRecordRequest,
  type JotformMigrationInspection,
  type JotformMigrationPreview,
  type JotformMigrationStatus,
} from "@/lib/forms/api";
import type { JotformForm } from "../../../../server/jotformClient";
import type { JotformMigrationRunBundle } from "../../../../server/nileFormsMigrationService";

type MigrationView = "new" | "history";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeMatch(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function suggestedMappings(inspection: JotformMigrationInspection) {
  return Object.fromEntries(
    inspection.targetFields.map(field => {
      const target = normalizeMatch(`${field.id} ${field.label.en}`);
      const question = inspection.questions.find(item => {
        const source = normalizeMatch(`${item.name ?? ""} ${item.text}`);
        return (
          source.includes(normalizeMatch(field.id)) || target.includes(source)
        );
      });
      return [field.id, question?.qid ?? ""];
    })
  );
}

export default function NileFormsMigrationPage() {
  const [view, setView] = useState<MigrationView>("new");
  const [status, setStatus] = useState<JotformMigrationStatus | null>(null);
  const [remoteForms, setRemoteForms] = useState<JotformForm[]>([]);
  const [runs, setRuns] = useState<JotformMigrationRunBundle[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [sourceFormId, setSourceFormId] = useState("");
  const [targetPublicationId, setTargetPublicationId] = useState("");
  const [inspection, setInspection] =
    useState<JotformMigrationInspection | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(500);
  const [preview, setPreview] = useState<JotformMigrationPreview | null>(null);
  const [busy, setBusy] = useState<
    "loading" | "forms" | "inspect" | "preview" | "commit" | "reconcile" | null
  >("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  const selectedRun = useMemo(
    () => runs.find(item => item.run.id === selectedRunId) ?? runs[0],
    [runs, selectedRunId]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setBusy("loading");
      setError("");
      const [statusResponse, runsResponse] = await Promise.all([
        fetchJotformMigrationStatus(),
        fetchJotformMigrationRuns(),
      ]);
      if (cancelled) return;
      if (!statusResponse.ok || !statusResponse.data) {
        setError(
          statusResponse.error ?? "Migration status could not be loaded."
        );
      } else {
        setStatus(statusResponse.data);
        setTargetPublicationId(
          current =>
            current || statusResponse.data?.targets[0]?.publication.id || ""
        );
      }
      if (runsResponse.ok && runsResponse.data) {
        setRuns(runsResponse.data);
        setSelectedRunId(
          current => current || runsResponse.data?.[0]?.run.id || ""
        );
      }
      setBusy(null);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const loadRemoteForms = async () => {
    setBusy("forms");
    setError("");
    setNotice("");
    const response = await fetchJotformRemoteForms();
    if (response.ok && response.data) {
      setRemoteForms(response.data.forms);
      if (!sourceFormId && response.data.forms[0]) {
        setSourceFormId(response.data.forms[0].id);
      }
      setNotice(
        `${response.data.forms.length} Jotform forms loaded for selection.`
      );
    } else {
      setError(response.error ?? "Jotform forms could not be loaded.");
    }
    setBusy(null);
  };

  const inspect = async () => {
    if (!sourceFormId || !targetPublicationId) return;
    setBusy("inspect");
    setError("");
    setNotice("");
    setPreview(null);
    const response = await inspectJotformMigrationRequest(
      sourceFormId,
      targetPublicationId
    );
    if (response.ok && response.data) {
      setInspection(response.data);
      setMapping(suggestedMappings(response.data));
      setNotice("Source questions and target fields inspected.");
    } else {
      setError(response.error ?? "The selected forms could not be inspected.");
    }
    setBusy(null);
  };

  const runPreview = async () => {
    if (!inspection) return;
    const mappings = inspection.targetFields
      .map(field => ({
        sourceQuestionId: mapping[field.id] ?? "",
        targetFieldId: field.id,
      }))
      .filter(item => item.sourceQuestionId && item.targetFieldId);
    setBusy("preview");
    setError("");
    setNotice("");
    const response = await previewJotformMigrationRequest({
      sourceFormId,
      targetPublicationId,
      mapping: mappings,
      offset,
      limit,
    });
    if (response.ok && response.data) {
      setPreview(response.data);
      setNotice("Dry run recorded. Review exceptions before importing.");
    } else {
      setError(response.error ?? "The dry run could not be completed.");
    }
    setBusy(null);
  };

  const commit = async () => {
    if (!preview) return;
    setBusy("commit");
    setError("");
    setNotice("");
    const response = await commitJotformMigrationRequest(
      preview.run.id,
      preview.run.previewHash
    );
    if (response.ok && response.data) {
      setNotice(
        `${response.data.run.importedRows} imported, ${response.data.run.duplicateRows} duplicates, ${response.data.run.exceptionRows} exceptions.`
      );
      setPreview(null);
      setInspection(null);
      setView("history");
      setSelectedRunId(response.data.run.id);
      setReload(value => value + 1);
    } else {
      setError(response.error ?? "The approved import could not be completed.");
    }
    setBusy(null);
  };

  const reconcile = async (
    recordId: string,
    reconciliationStatus: "matched" | "exception"
  ) => {
    setBusy("reconcile");
    setError("");
    const response = await reconcileJotformMigrationRecordRequest(
      recordId,
      reconciliationStatus
    );
    if (response.ok) {
      setNotice(`Record marked ${reconciliationStatus}.`);
      setReload(value => value + 1);
    } else {
      setError(response.error ?? "The record could not be reconciled.");
    }
    setBusy(null);
  };

  return (
    <PlatformShell role="superadmin" title="Jotform migration">
      <div className="nile-forms-page nile-forms-migration-page">
        <NileFormsNavigation role="superadmin" />

        <header className="nile-forms-page-header">
          <div>
            <span className="nile-forms-eyebrow">Finite migration</span>
            <h1>Jotform import</h1>
            <p>
              Dry-run, import, and reconcile selected historical submissions.
            </p>
          </div>
          <span
            className={`nile-migration-connection ${status?.configured ? "is-ready" : "is-blocked"}`}
          >
            {status?.configured ? <Link2 size={15} /> : <XCircle size={15} />}
            {status?.configured
              ? `${status.region} API ready`
              : "Server key required"}
          </span>
        </header>

        {busy === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading migration evidence</strong>
          </section>
        ) : !status ? (
          <section className="nile-forms-state" role="alert">
            <AlertTriangle size={24} />
            <strong>Migration unavailable</strong>
            <p>{error}</p>
          </section>
        ) : !status.configured ? (
          <section className="nile-migration-not-configured">
            <ShieldCheck size={24} />
            <div>
              <h2>Temporary credential not configured</h2>
              <p>
                Set <code>JOTFORM_API_KEY</code> on the application server for
                the approved import window.
              </p>
            </div>
            <span>Browser credential entry is disabled</span>
          </section>
        ) : (
          <>
            <div
              className="nile-migration-tabs"
              role="tablist"
              aria-label="Jotform migration"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "new"}
                className={view === "new" ? "is-active" : ""}
                onClick={() => setView("new")}
              >
                <Upload size={15} />
                New import
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "history"}
                className={view === "history" ? "is-active" : ""}
                onClick={() => setView("history")}
              >
                <History size={15} />
                Run history
                {runs.length ? <span>{runs.length}</span> : null}
              </button>
            </div>

            {notice ? (
              <p className="nile-form-notice is-success">{notice}</p>
            ) : null}
            {error ? (
              <p className="nile-form-notice is-error">{error}</p>
            ) : null}

            {view === "new" ? (
              <section className="nile-migration-workspace">
                <header className="nile-migration-source-bar">
                  <div className="nile-migration-source-field">
                    <label htmlFor="jotform-source-id">Source form ID</label>
                    <div>
                      <Search size={15} />
                      <input
                        id="jotform-source-id"
                        inputMode="numeric"
                        list="jotform-form-options"
                        value={sourceFormId}
                        onChange={event => {
                          setSourceFormId(
                            event.target.value.replaceAll(/\D/g, "")
                          );
                          setInspection(null);
                          setPreview(null);
                        }}
                        placeholder="Jotform form ID"
                      />
                    </div>
                    <datalist id="jotform-form-options">
                      {remoteForms.map(form => (
                        <option key={form.id} value={form.id}>
                          {form.title}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    disabled={busy !== null}
                    onClick={loadRemoteForms}
                  >
                    <RefreshCw size={15} />
                    {busy === "forms" ? "Loading" : "Load forms"}
                  </button>
                  <div className="nile-migration-arrow" aria-hidden="true">
                    →
                  </div>
                  <label className="nile-migration-source-field">
                    Target Nile form
                    <select
                      value={targetPublicationId}
                      onChange={event => {
                        setTargetPublicationId(event.target.value);
                        setInspection(null);
                        setPreview(null);
                      }}
                    >
                      {status.targets.map(target => (
                        <option
                          key={target.publication.id}
                          value={target.publication.id}
                        >
                          {target.definition.title} · v
                          {target.version.versionNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="platform-primary-button"
                    disabled={
                      !sourceFormId || !targetPublicationId || busy !== null
                    }
                    onClick={inspect}
                  >
                    <Eye size={15} />
                    {busy === "inspect" ? "Inspecting" : "Inspect"}
                  </button>
                </header>

                {inspection ? (
                  <>
                    <div className="nile-migration-inspection-heading">
                      <div>
                        <span>Field mapping</span>
                        <h2>{inspection.sourceForm.title}</h2>
                      </div>
                      <div>
                        <label>
                          Offset
                          <input
                            type="number"
                            min={0}
                            value={offset}
                            onChange={event =>
                              setOffset(Math.max(0, Number(event.target.value)))
                            }
                          />
                        </label>
                        <label>
                          Limit
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={limit}
                            onChange={event =>
                              setLimit(
                                Math.min(
                                  1000,
                                  Math.max(1, Number(event.target.value))
                                )
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="nile-migration-mapping-list">
                      {inspection.targetFields.map(field => (
                        <div
                          key={field.id}
                          className={field.restricted ? "is-restricted" : ""}
                        >
                          <div>
                            <strong>{field.label.en}</strong>
                            <small>
                              {field.id} · {field.type}
                            </small>
                          </div>
                          <span aria-hidden="true">←</span>
                          <label>
                            <span className="sr-only">
                              Jotform question for {field.label.en}
                            </span>
                            <select
                              value={mapping[field.id] ?? ""}
                              disabled={field.restricted}
                              onChange={event =>
                                setMapping(current => ({
                                  ...current,
                                  [field.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Not mapped</option>
                              {inspection.questions.map(question => (
                                <option key={question.qid} value={question.qid}>
                                  {question.qid} · {question.text}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span
                            className={`nile-migration-field-state ${field.required ? "is-required" : ""}`}
                          >
                            {field.restricted
                              ? "Restricted"
                              : field.required
                                ? "Required"
                                : "Optional"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="nile-migration-preview-action">
                      <div>
                        <ShieldCheck size={17} />
                        <p>No submission is written during this step.</p>
                      </div>
                      <button
                        type="button"
                        className="platform-primary-button"
                        disabled={
                          !Object.values(mapping).some(Boolean) || busy !== null
                        }
                        onClick={runPreview}
                      >
                        <FileCheck2 size={16} />
                        {busy === "preview" ? "Running" : "Run dry preview"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="nile-migration-empty">
                    <Database size={25} />
                    <strong>Select one source and one published target</strong>
                    <p>
                      The server will inspect question metadata before any
                      submission is read.
                    </p>
                  </div>
                )}

                {preview ? (
                  <section className="nile-migration-preview-result">
                    <header>
                      <div>
                        <span>Recorded dry run</span>
                        <h2>{preview.run.totalRows} source submissions</h2>
                      </div>
                      <div className="nile-migration-preview-metrics">
                        <span>
                          <strong>{preview.run.validRows}</strong> valid
                        </span>
                        <span>
                          <strong>{preview.run.exceptionRows}</strong>{" "}
                          exceptions
                        </span>
                        <span>
                          <strong>{preview.run.duplicateRows}</strong> existing
                        </span>
                      </div>
                    </header>
                    <div className="nile-migration-preview-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Source ID</th>
                            <th>Created</th>
                            <th>Result</th>
                            <th>Evidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sample.map(row => (
                            <tr key={row.sourceSubmissionId}>
                              <td>{row.sourceSubmissionId}</td>
                              <td>{row.sourceCreatedAt ?? "Unknown"}</td>
                              <td>
                                <span
                                  className={`nile-form-status ${row.valid ? "is-accepted" : "is-rejected"}`}
                                >
                                  {row.alreadyImported
                                    ? "existing"
                                    : row.valid
                                      ? "valid"
                                      : "exception"}
                                </span>
                              </td>
                              <td>
                                {row.errors[0] ??
                                  `${Object.keys(row.mappedAnswers).length} mapped fields`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <footer>
                      <div>
                        <AlertTriangle size={17} />
                        <p>
                          Imported rows enter review and never promote
                          automatically.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="platform-primary-button"
                        disabled={!preview.run.validRows || busy !== null}
                        onClick={commit}
                      >
                        <Upload size={16} />
                        {busy === "commit"
                          ? "Importing"
                          : `Import ${preview.run.validRows} validated`}
                      </button>
                    </footer>
                  </section>
                ) : null}
              </section>
            ) : (
              <section className="nile-migration-history-layout">
                <aside>
                  <header>
                    <h2>Import runs</h2>
                    <button
                      type="button"
                      className="nile-forms-icon-button"
                      title="Refresh runs"
                      aria-label="Refresh migration runs"
                      onClick={() => setReload(value => value + 1)}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </header>
                  {runs.map(item => (
                    <button
                      key={item.run.id}
                      type="button"
                      className={
                        selectedRun?.run.id === item.run.id ? "is-active" : ""
                      }
                      onClick={() => setSelectedRunId(item.run.id)}
                    >
                      <span
                        className={`nile-migration-run-icon is-${item.run.status}`}
                      >
                        {item.run.status === "reconciled" ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <History size={15} />
                        )}
                      </span>
                      <div>
                        <strong>{item.run.sourceFormTitle}</strong>
                        <small>{formatDate(item.run.createdAt)}</small>
                      </div>
                      <em>{item.run.status}</em>
                    </button>
                  ))}
                  {!runs.length ? <p>No migration run recorded.</p> : null}
                </aside>

                <div className="nile-migration-run-detail">
                  {selectedRun ? (
                    <>
                      <header>
                        <div>
                          <span>{selectedRun.run.provider}</span>
                          <h2>{selectedRun.run.sourceFormTitle}</h2>
                          <p>
                            {selectedRun.run.sourceFormId} →{" "}
                            {selectedRun.run.targetPublicationId}
                          </p>
                        </div>
                        <span
                          className={`nile-form-status is-${selectedRun.run.status}`}
                        >
                          {selectedRun.run.status}
                        </span>
                      </header>
                      <div className="nile-migration-run-metrics">
                        <span>
                          <strong>{selectedRun.run.importedRows}</strong>{" "}
                          imported
                        </span>
                        <span>
                          <strong>{selectedRun.run.duplicateRows}</strong>{" "}
                          duplicate
                        </span>
                        <span>
                          <strong>{selectedRun.run.exceptionRows}</strong>{" "}
                          exception
                        </span>
                        <span>
                          <strong>
                            {
                              selectedRun.records.filter(
                                record =>
                                  record.reconciliationStatus === "pending"
                              ).length
                            }
                          </strong>{" "}
                          pending
                        </span>
                      </div>
                      <div className="nile-migration-record-list">
                        {selectedRun.records.map(record => (
                          <article key={record.id}>
                            <span
                              className={`nile-migration-record-icon is-${record.reconciliationStatus}`}
                            >
                              {record.reconciliationStatus === "exception" ? (
                                <AlertTriangle size={16} />
                              ) : (
                                <FileCheck2 size={16} />
                              )}
                            </span>
                            <div>
                              <strong>{record.sourceSubmissionId}</strong>
                              <small>
                                {record.submissionId ??
                                  "No Nile submission created"}
                              </small>
                              {record.errors[0] ? (
                                <p>{record.errors[0]}</p>
                              ) : null}
                            </div>
                            <span
                              className={`nile-form-status is-${record.reconciliationStatus}`}
                            >
                              {record.reconciliationStatus}
                            </span>
                            {record.reconciliationStatus === "pending" ? (
                              <div className="nile-migration-record-actions">
                                <button
                                  type="button"
                                  className="platform-secondary-button"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    reconcile(record.id, "exception")
                                  }
                                >
                                  Exception
                                </button>
                                <button
                                  type="button"
                                  className="platform-primary-button"
                                  disabled={
                                    busy !== null || !record.submissionId
                                  }
                                  onClick={() =>
                                    reconcile(record.id, "matched")
                                  }
                                >
                                  Matched
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="nile-migration-empty">
                      <History size={24} />
                      <strong>No run selected</strong>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PlatformShell>
  );
}
