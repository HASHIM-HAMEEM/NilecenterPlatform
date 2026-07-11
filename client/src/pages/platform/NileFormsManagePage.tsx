import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FilePenLine,
  Languages,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import { getStoredAuthSession } from "@/lib/auth/session";
import {
  createFormDefinitionRequest,
  fetchFormDefinitions,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import { platformStore } from "@/lib/domain/store";
import type { Role } from "@/lib/platformData";
import type { FormDefinition } from "@shared/nileForms";

const categoryLabels: Record<FormDefinition["category"], string> = {
  admissions: "Admissions",
  student_support: "Student support",
  attendance: "Attendance",
  consent: "Consent",
  branch_operations: "Branch operations",
};

function categoriesForRole(role: Role): FormDefinition["category"][] {
  if (role === "registrar") return ["admissions"];
  if (role === "headofdepartment") return ["consent", "attendance"];
  if (role === "branchadmin") {
    return ["branch_operations", "attendance", "consent"];
  }
  return [
    "admissions",
    "student_support",
    "attendance",
    "consent",
    "branch_operations",
  ];
}

export default function NileFormsManagePage({ role }: { role: Role }) {
  const [, navigate] = useLocation();
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
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const state = platformStore.getState();
  const session = getStoredAuthSession();
  const activeUser = state.users.find(user => user.id === session?.userId);
  const categories = categoriesForRole(role);
  const [draft, setDraft] = useState({
    key: "",
    titleEn: "",
    titleAr: "",
    category: categories[0],
    branchId: activeUser?.branchId ?? "",
    departmentId: activeUser?.departmentId ?? "",
  });

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

  useEffect(() => {
    setDraft(current => ({
      ...current,
      branchId: current.branchId || activeUser?.branchId || "",
      departmentId: current.departmentId || activeUser?.departmentId || "",
    }));
  }, [activeUser?.branchId, activeUser?.departmentId]);

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

  const createDefinition = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await createFormDefinitionRequest({
      key: draft.key,
      titleEn: draft.titleEn,
      titleAr: draft.titleAr,
      category: draft.category,
      branchId:
        role === "registrar" || role === "branchadmin"
          ? draft.branchId
          : role === "headofdepartment"
            ? draft.branchId || undefined
            : undefined,
      departmentId:
        role === "headofdepartment" ? draft.departmentId : undefined,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The form definition could not be created.");
      return;
    }
    setShowCreate(false);
    navigate(
      formsRoute(role, `/manage/${response.data.definition.id}/builder`)
    );
  };

  return (
    <PlatformShell role={role} title="Manage forms">
      <div className="nile-forms-page">
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header">
          <div>
            <span className="nile-forms-eyebrow">Definitions</span>
            <h1>Manage forms</h1>
            <p>Create and maintain forms inside the active role scope.</p>
          </div>
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => {
              setError("");
              setShowCreate(true);
            }}
          >
            <Plus size={16} />
            New form
          </button>
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
                      {categoryLabels[definition.category]}
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

        {showCreate ? (
          <div className="nile-forms-modal-backdrop" role="presentation">
            <section
              className="nile-forms-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-form-title"
            >
              <header>
                <div>
                  <span className="nile-forms-eyebrow">Definition</span>
                  <h2 id="new-form-title">New form</h2>
                </div>
                <button
                  type="button"
                  className="nile-forms-icon-button"
                  onClick={() => setShowCreate(false)}
                  aria-label="Close"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </header>
              <form onSubmit={createDefinition}>
                <label>
                  English title
                  <input
                    autoFocus
                    required
                    value={draft.titleEn}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        titleEn: event.target.value,
                      }))
                    }
                  />
                </label>
                <label dir="rtl">
                  العنوان بالعربية
                  <input
                    required
                    value={draft.titleAr}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        titleAr: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Form key
                  <input
                    required
                    pattern="[a-z][a-z0-9_:-]{2,79}"
                    value={draft.key}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        key: event.target.value
                          .toLowerCase()
                          .replaceAll(" ", "_"),
                      }))
                    }
                    placeholder="student_feedback"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={draft.category}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        category: event.target
                          .value as FormDefinition["category"],
                      }))
                    }
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {categoryLabels[category]}
                      </option>
                    ))}
                  </select>
                </label>
                {role === "registrar" ||
                role === "branchadmin" ||
                role === "headofdepartment" ? (
                  <label>
                    Branch
                    <select
                      required={role !== "headofdepartment"}
                      value={draft.branchId}
                      onChange={event =>
                        setDraft(current => ({
                          ...current,
                          branchId: event.target.value,
                        }))
                      }
                    >
                      {role === "headofdepartment" ? (
                        <option value="">All assigned branches</option>
                      ) : null}
                      {state.branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {role === "headofdepartment" ? (
                  <label>
                    Department
                    <select
                      required
                      value={draft.departmentId}
                      onChange={event =>
                        setDraft(current => ({
                          ...current,
                          departmentId: event.target.value,
                        }))
                      }
                    >
                      {state.departments.map(department => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {error ? (
                  <p className="nile-form-field-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <footer>
                  <span>
                    <Languages size={15} /> English and Arabic
                  </span>
                  <div>
                    <button
                      type="button"
                      className="platform-secondary-button"
                      onClick={() => setShowCreate(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="platform-primary-button"
                      disabled={saving}
                    >
                      <Plus size={15} />
                      {saving ? "Creating" : "Create"}
                    </button>
                  </div>
                </footer>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </PlatformShell>
  );
}
