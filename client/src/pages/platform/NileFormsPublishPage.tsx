import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Eye,
  Link2,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "wouter";

import NileFormRenderer from "@/components/forms/NileFormRenderer";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  assignFormPublicationRequest,
  fetchFormDefinition,
  publishFormVersionRequest,
  retireFormPublicationRequest,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import { platformStore } from "@/lib/domain/store";
import type { Role } from "@/lib/platformData";
import type {
  FormAssignmentTarget,
  FormPublication,
  FormVersion,
} from "@shared/nileForms";
import type {
  FormDefinitionBundle,
  FormResponderBundle,
} from "../../../../server/nileFormsService";

function toLocalDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function NileFormsPublishPage({
  role,
  formId,
}: {
  role: Role;
  formId: string;
}) {
  const [bundle, setBundle] = useState<FormDefinitionBundle | null>(null);
  const [draftVersion, setDraftVersion] = useState<FormVersion | null>(null);
  const [published, setPublished] = useState<FormPublication | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState({
    slug: "",
    audience: "assigned" as FormPublication["audience"],
    opensAt: "",
    closesAt: "",
    allowMultiple: false,
    allowDrafts: true,
  });
  const [assignment, setAssignment] = useState({
    type: "role" as FormAssignmentTarget["type"],
    value: "student",
  });
  const state = platformStore.getState();

  const load = async () => {
    setStatus("loading");
    setMessage("");
    const response = await fetchFormDefinition(formId);
    if (!response.ok || !response.data) {
      setStatus("error");
      setMessage(response.error ?? "Publication settings could not be loaded.");
      return;
    }
    const draft = response.data.versions.find(item => item.status === "draft") ?? null;
    setBundle(response.data);
    setDraftVersion(draft);
    setSettings(current => ({
      ...current,
      slug: current.slug || response.data!.definition.key.replaceAll("_", "-"),
    }));
    setStatus("ready");
  };

  useEffect(() => {
    void load();
  }, [formId]);

  const previewBundle = useMemo<FormResponderBundle | null>(() => {
    if (!bundle || !draftVersion) return null;
    return {
      definition: bundle.definition,
      version: draftVersion,
      publication: {
        id: "preview_publication",
        definitionId: bundle.definition.id,
        versionId: draftVersion.id,
        slug: settings.slug || "preview",
        audience: settings.audience,
        status: "open",
        allowMultiple: settings.allowMultiple,
        allowDrafts: false,
        offlineEligible: false,
        createdBy: bundle.definition.ownerUserId,
        createdAt: draftVersion.createdAt,
      },
      previousSubmissions: [],
      entityOptions: {},
    };
  }, [bundle, draftVersion, settings]);

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!draftVersion) return;
    setSaving(true);
    setMessage("");
    const response = await publishFormVersionRequest(formId, draftVersion.id, {
      slug: settings.slug,
      audience: settings.audience,
      opensAt: settings.opensAt
        ? new Date(settings.opensAt).toISOString()
        : undefined,
      closesAt: settings.closesAt
        ? new Date(settings.closesAt).toISOString()
        : undefined,
      allowMultiple: settings.allowMultiple,
      allowDrafts: settings.allowDrafts,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setMessage(response.error ?? "The form could not be published.");
      return;
    }
    setPublished(response.data.publication);
    setDraftVersion(null);
    setMessage("Published successfully.");
    setBundle(current =>
      current
        ? {
            ...current,
            definition: response.data!.definition,
            versions: [response.data!.version, ...current.versions.filter(item => item.id !== response.data!.version.id)],
            publications: [response.data!.publication, ...current.publications],
          }
        : current
    );
  };

  const assign = async () => {
    if (!published) return;
    let target: FormAssignmentTarget;
    if (assignment.type === "role") {
      target = {
        type: "role",
        role: assignment.value as Extract<
          FormAssignmentTarget,
          { type: "role" }
        >["role"],
      };
    } else if (assignment.type === "branch") {
      target = { type: "branch", branchId: assignment.value };
    } else if (assignment.type === "department") {
      target = { type: "department", departmentId: assignment.value };
    } else {
      setMessage("Choose a supported assignment target.");
      return;
    }
    setSaving(true);
    const response = await assignFormPublicationRequest(published.id, target);
    setSaving(false);
    setMessage(response.ok ? "Assignment added." : response.error ?? "Assignment failed.");
  };

  if (status !== "ready" || !bundle) {
    return (
      <PlatformShell role={role} title="Publish form">
        <div className="nile-forms-page">
          <section className="nile-forms-state" role={status === "error" ? "alert" : undefined}>
            {status === "loading" ? <span className="nile-forms-spinner" /> : <Send size={24} />}
            <strong>{status === "loading" ? "Loading publication" : "Publication unavailable"}</strong>
            {message ? <p>{message}</p> : null}
          </section>
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role={role} title="Publish form">
      <div className="nile-forms-page nile-form-publish-page">
        <header className="nile-forms-page-header compact">
          <div>
            <Link href={formsRoute(role, `/manage/${formId}/builder`)} className="nile-forms-back-link">
              <ArrowLeft size={15} /> Builder
            </Link>
            <h1>Publish {bundle.definition.title}</h1>
            <p>Review one draft version and set its response boundary.</p>
          </div>
          <span className={`nile-form-status is-${draftVersion ? "draft" : "active"}`}>
            {draftVersion ? `Draft v${draftVersion.versionNumber}` : "No draft"}
          </span>
        </header>

        {!draftVersion && !published ? (
          <section className="nile-forms-state">
            <CheckCircle2 size={24} />
            <strong>No draft waiting for publication</strong>
            <p>Create a new draft from the builder before publishing again.</p>
            <Link href={formsRoute(role, `/manage/${formId}/builder`)} className="platform-primary-button">
              Open builder
            </Link>
          </section>
        ) : null}

        {draftVersion && previewBundle ? (
          <section className="nile-form-publish-grid">
            <div className="nile-form-publish-preview">
              <header>
                <Eye size={16} />
                <strong>Published preview</strong>
              </header>
              <NileFormRenderer bundle={previewBundle} mode="preview" />
            </div>
            <form className="nile-form-publication-settings" onSubmit={publish}>
              <header>
                <span>Version {draftVersion.versionNumber}</span>
                <h2>Publication settings</h2>
              </header>
              <label>
                <span><Link2 size={15} /> URL slug</span>
                <input required pattern="[a-z0-9][a-z0-9-]{2,79}" value={settings.slug} onChange={event => setSettings(current => ({ ...current, slug: event.target.value.toLowerCase().replaceAll(" ", "-") }))} />
              </label>
              <label>
                <span><Users size={15} /> Audience</span>
                <select value={settings.audience} onChange={event => setSettings(current => ({ ...current, audience: event.target.value as FormPublication["audience"] }))}>
                  <option value="public">Public</option>
                  <option value="authenticated">Authenticated</option>
                  <option value="assigned">Assigned</option>
                </select>
              </label>
              <div className="nile-form-settings-pair">
                <label>
                  <span><CalendarClock size={15} /> Opens</span>
                  <input type="datetime-local" value={toLocalDateTime(settings.opensAt)} onChange={event => setSettings(current => ({ ...current, opensAt: event.target.value }))} />
                </label>
                <label>
                  <span><CalendarClock size={15} /> Closes</span>
                  <input type="datetime-local" value={toLocalDateTime(settings.closesAt)} onChange={event => setSettings(current => ({ ...current, closesAt: event.target.value }))} />
                </label>
              </div>
              <div className="nile-form-toggle-list">
                <label><input type="checkbox" checked={settings.allowDrafts} onChange={event => setSettings(current => ({ ...current, allowDrafts: event.target.checked }))} /> Allow drafts</label>
                <label><input type="checkbox" checked={settings.allowMultiple} onChange={event => setSettings(current => ({ ...current, allowMultiple: event.target.checked }))} /> Allow multiple responses</label>
              </div>
              <div className="nile-form-publish-boundary">
                <ShieldCheck size={17} />
                <p>Responses stay in review until an authorized reviewer accepts and promotes them.</p>
              </div>
              {message ? <p className="nile-form-notice" role="status">{message}</p> : null}
              <button type="submit" className="platform-primary-button" disabled={saving}>
                <Send size={16} /> {saving ? "Publishing" : "Publish version"}
              </button>
            </form>
          </section>
        ) : null}

        {published ? (
          <section className="nile-form-published-result" role="status">
            <CheckCircle2 size={24} />
            <div>
              <h2>Version published</h2>
              <p>{published.slug}</p>
            </div>
            {published.audience === "public" ? (
              <Link href={`/forms/${published.slug}`} className="platform-primary-button">Open public form</Link>
            ) : null}
          </section>
        ) : null}

        {published?.audience === "assigned" ? (
          <section className="nile-form-assignment-panel">
            <header><Users size={17} /><div><h2>Assign publication</h2><p>Choose one scoped audience.</p></div></header>
            <div>
              <select value={assignment.type} onChange={event => setAssignment({ type: event.target.value as FormAssignmentTarget["type"], value: event.target.value === "role" ? "student" : "" })}>
                <option value="role">Role</option>
                <option value="branch">Branch</option>
                <option value="department">Department</option>
              </select>
              {assignment.type === "role" ? (
                <select value={assignment.value} onChange={event => setAssignment(current => ({ ...current, value: event.target.value }))}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="registrar">Registrar</option>
                  <option value="headofdepartment">HOD</option>
                  <option value="branchadmin">Branch Admin</option>
                </select>
              ) : assignment.type === "branch" ? (
                <select value={assignment.value} onChange={event => setAssignment(current => ({ ...current, value: event.target.value }))}>
                  <option value="">Choose branch</option>
                  {state.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              ) : (
                <select value={assignment.value} onChange={event => setAssignment(current => ({ ...current, value: event.target.value }))}>
                  <option value="">Choose department</option>
                  {state.departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              )}
              <button type="button" className="platform-primary-button" disabled={saving || !assignment.value} onClick={assign}><Users size={15} /> Assign</button>
            </div>
          </section>
        ) : null}

        {bundle.publications.length ? (
          <section className="nile-form-publication-history">
            <header><h2>Publication history</h2></header>
            {bundle.publications.map(publication => (
              <div key={publication.id}>
                <span className={`nile-form-status is-${publication.status}`}>{publication.status}</span>
                <strong>{publication.slug}</strong>
                <span>{publication.audience}</span>
                {publication.status !== "retired" ? (
                  <button type="button" className="nile-form-text-button" onClick={async () => { const response = await retireFormPublicationRequest(publication.id); setMessage(response.ok ? "Publication retired." : response.error ?? "Retirement failed."); if (response.ok) await load(); }}>Retire</button>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </PlatformShell>
  );
}
