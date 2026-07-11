import { useEffect, useMemo, useState } from "react";
import { Download, Inbox, RefreshCw, Search } from "lucide-react";
import { Link } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  exportFormSubmissionsRequest,
  fetchFormSubmissions,
  type FormSubmissionListItem,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";

const reviewStatuses = [
  "all",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "promoted",
  "quarantined",
] as const;

export default function NileFormsReviewPage({ role }: { role: Role }) {
  const [items, setItems] = useState<FormSubmissionListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof reviewStatuses)[number]>("all");
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError("");
      const response = await fetchFormSubmissions();
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setError(response.error ?? "The submission inbox could not be loaded.");
        return;
      }
      setItems(response.data);
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter(item => {
      const text =
        `${item.definition.title} ${item.definition.key} ${item.submission.id}`.toLowerCase();
      return (
        (filter === "all" || item.submission.status === filter) &&
        (!search || text.includes(search))
      );
    });
  }, [filter, items, query]);

  const exportRows = async () => {
    setExporting(true);
    setError("");
    const response = await exportFormSubmissionsRequest();
    setExporting(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The export could not be prepared.");
      return;
    }
    const blob = new Blob([response.data.csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = response.data.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PlatformShell role={role} title="Form review">
      <div className="nile-forms-page">
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header">
          <div>
            <span className="nile-forms-eyebrow">Submission inbox</span>
            <h1>Review responses</h1>
            <p>Review one immutable response at a time before promotion.</p>
          </div>
          <button
            type="button"
            className="platform-secondary-button"
            disabled={exporting}
            onClick={exportRows}
          >
            <Download size={16} />
            {exporting ? "Preparing" : "Export CSV"}
          </button>
        </header>

        <section className="nile-forms-toolbar" aria-label="Submission filters">
          <label>
            <Search size={15} />
            <span className="sr-only">Search submissions</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search form or submission"
            />
          </label>
          <div
            className="nile-forms-filter-tabs"
            role="group"
            aria-label="Status"
          >
            {reviewStatuses.map(item => (
              <button
                key={item}
                type="button"
                className={filter === item ? "is-active" : ""}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <p className="nile-form-notice is-error" role="alert">
            {error}
          </p>
        ) : null}

        {status === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading submissions</strong>
          </section>
        ) : status === "error" ? (
          <section className="nile-forms-state" role="alert">
            <Inbox size={24} />
            <strong>Inbox unavailable</strong>
            <p>{error}</p>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setReload(value => value + 1)}
            >
              <RefreshCw size={15} /> Retry
            </button>
          </section>
        ) : filtered.length ? (
          <section className="nile-forms-table-wrap">
            <table className="nile-forms-table">
              <thead>
                <tr>
                  <th>Submission</th>
                  <th>Form</th>
                  <th>Scope</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.submission.id}>
                    <td data-label="Submission">
                      <strong>{item.submission.id.slice(-12)}</strong>
                      <span>Revision {item.submission.revision}</span>
                    </td>
                    <td data-label="Form">
                      <strong>{item.definition.title}</strong>
                      <span>{item.definition.key}</span>
                    </td>
                    <td data-label="Scope">
                      {item.submission.branchId ??
                        item.submission.departmentId ??
                        "Global"}
                    </td>
                    <td data-label="Source">
                      {item.submission.source.replaceAll("_", " ")}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`nile-form-status is-${item.submission.status}`}
                      >
                        {item.submission.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td data-label="Submitted">
                      {new Date(item.submission.submittedAt).toLocaleString()}
                    </td>
                    <td data-label="Actions">
                      <Link
                        href={formsRoute(role, `/review/${item.submission.id}`)}
                        className="platform-secondary-button"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="nile-forms-state">
            <Inbox size={24} />
            <strong>No matching submissions</strong>
            <p>The active scope has no responses in this state.</p>
          </section>
        )}
      </div>
    </PlatformShell>
  );
}
