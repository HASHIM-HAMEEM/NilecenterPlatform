import { useEffect, useMemo, useState } from "react";
import { FilePenLine, Plus, RefreshCw, Search, Send } from "lucide-react";
import { Link } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import { fetchFormDefinitions } from "@/lib/forms/api";
import { formCategoryLabels } from "@/lib/forms/management";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import type { FormDefinition } from "@shared/nileForms";

export default function NileFormsManagePage({ role }: { role: Role }) {
  const [definitions, setDefinitions] = useState<FormDefinition[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | FormDefinition["status"]
  >("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError("");
      const response = await fetchFormDefinitions();
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setError(response.error ?? "Form definitions could not be loaded.");
        return;
      }
      setDefinitions(response.data);
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const scopeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          definitions.map(
            definition =>
              definition.branchId ?? definition.departmentId ?? "Global"
          )
        )
      ).sort((left, right) => left.localeCompare(right)),
    [definitions]
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return definitions.filter(definition => {
      const scope = definition.branchId ?? definition.departmentId ?? "Global";
      const matchesSearch = search
        ? `${definition.title} ${definition.key} ${definition.category} ${scope}`
            .toLowerCase()
            .includes(search)
        : true;
      return (
        matchesSearch &&
        (statusFilter === "all" || definition.status === statusFilter) &&
        (scopeFilter === "all" || scope === scopeFilter)
      );
    });
  }, [definitions, query, scopeFilter, statusFilter]);

  return (
    <PlatformShell role={role} title="Manage forms">
      <div className="nile-forms-page">
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header">
          <div>
            <span className="nile-forms-eyebrow">Definitions</span>
            <h1>Manage forms</h1>
            <p>Scoped form definitions and their current lifecycle state.</p>
          </div>
          <Link
            href={formsRoute(role, "/manage/new")}
            className="platform-primary-button"
          >
            <Plus size={16} />
            New form
          </Link>
        </header>

        <section className="nile-forms-toolbar" aria-label="Form filters">
          <label>
            <Search size={15} />
            <span className="sr-only">Search forms</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search forms"
            />
          </label>
          <div className="nile-forms-filter-selects">
            <label>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(
                    event.target.value as "all" | FormDefinition["status"]
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="retired">Retired</option>
              </select>
            </label>
            <label>
              <span>Scope</span>
              <select
                value={scopeFilter}
                onChange={event => setScopeFilter(event.target.value)}
              >
                <option value="all">All scopes</option>
                {scopeOptions.map(scope => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </label>
            <span className="nile-forms-result-count">
              {filtered.length} definitions
            </span>
          </div>
        </section>

        {status === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading definitions</strong>
          </section>
        ) : status === "error" ? (
          <section className="nile-forms-state" role="alert">
            <FilePenLine size={24} />
            <strong>Definitions unavailable</strong>
            <p>{error}</p>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setReload(value => value + 1)}
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </section>
        ) : filtered.length ? (
          <section className="nile-forms-table-wrap">
            <table className="nile-forms-table">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Category</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(definition => (
                  <tr key={definition.id}>
                    <td data-label="Form">
                      <strong>{definition.title}</strong>
                      <span>{definition.key}</span>
                    </td>
                    <td data-label="Category">
                      {formCategoryLabels[definition.category]}
                    </td>
                    <td data-label="Scope">
                      {definition.branchId ??
                        definition.departmentId ??
                        "Global"}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`nile-form-status is-${definition.status}`}
                      >
                        {definition.status}
                      </span>
                    </td>
                    <td data-label="Updated">
                      {new Date(definition.updatedAt).toLocaleDateString()}
                    </td>
                    <td data-label="Actions">
                      <div className="nile-forms-row-actions">
                        <Link
                          href={formsRoute(
                            role,
                            `/manage/${definition.id}/builder`
                          )}
                          className="platform-secondary-button"
                        >
                          <FilePenLine size={15} />
                          Edit
                        </Link>
                        <Link
                          href={formsRoute(
                            role,
                            `/manage/${definition.id}/publish`
                          )}
                          className="nile-forms-icon-link"
                          title="Publish"
                          aria-label={`Publish ${definition.title}`}
                        >
                          <Send size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="nile-forms-state">
            <FilePenLine size={24} />
            <strong>No matching forms</strong>
            <p>Create the first scoped definition or change the search.</p>
          </section>
        )}
      </div>
    </PlatformShell>
  );
}
