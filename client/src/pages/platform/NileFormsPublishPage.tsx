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
  fetchFormDefinition,
  publishFormVersionRequest,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import type { FormPublication, FormVersion } from "@shared/nileForms";
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
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
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
  const load = async () => {
    setStatus("loading");
    setMessage("");
    const response = await fetchFormDefinition(formId);
    if (!response.ok || !response.data) {
      setStatus("error");
      setMessage(response.error ?? "Publication settings could not be loaded.");
      return;
    }
    const draft =
      response.data.versions.find(item => item.status === "draft") ?? null;
    const currentPublication =
      response.data.publications
        .filter(item => item.status !== "retired")
        .toSorted((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        )
        .find(
          item =>
            item.versionId ===
            response.data!.definition.currentPublishedVersionId
        ) ?? null;
    setBundle(response.data);
    setDraftVersion(draft);
    setPublished(currentPublication);
    setSettings({
      slug:
        currentPublication?.slug ??
        response.data.definition.key.replaceAll("_", "-"),
      audience: currentPublication?.audience ?? "assigned",
      opensAt: currentPublication?.opensAt ?? "",
      closesAt: currentPublication?.closesAt ?? "",
      allowMultiple: currentPublication?.allowMultiple ?? false,
      allowDrafts: currentPublication?.allowDrafts ?? true,
    });
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
            versions: [
              response.data!.version,
              ...current.versions.filter(
                item => item.id !== response.data!.version.id
              ),
            ],
            publications: [response.data!.publication, ...current.publications],
          }
        : current
    );
  };

  if (status !== "ready" || !bundle) {
    return (
      <PlatformShell role={role} title="Publish form">
        <div className="nile-forms-page">
          <section
            className="nile-forms-state"
            role={status === "error" ? "alert" : undefined}
          >
            {status === "loading" ? (
              <span className="nile-forms-spinner" />
            ) : (
              <Send size={24} />
            )}
            <strong>
              {status === "loading"
                ? "Loading publication"
                : "Publication unavailable"}
            </strong>
            {message ? <p>{message}</p> : null}
            {status === "error" ? (
              <>
                <p>
                  This form belongs to another owner or scope. Return to the
                  forms available to your active role.
                </p>
                <Link
                  href={formsRoute(role, "/manage")}
                  className="platform-secondary-button"
                >
                  <ArrowLeft size={15} /> Manage forms
                </Link>
              </>
            ) : null}
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
            <Link
              href={formsRoute(role, `/manage/${formId}/builder`)}
              className="nile-forms-back-link"
            >
              <ArrowLeft size={15} /> Builder
            </Link>
            <h1>Publish {bundle.definition.title}</h1>
            <p>Review one draft version and set its response boundary.</p>
          </div>
          <span
            className={`nile-form-status is-${draftVersion ? "draft" : "active"}`}
          >
            {draftVersion ? `Draft v${draftVersion.versionNumber}` : "No draft"}
          </span>
        </header>

        {!draftVersion && !published ? (
          <section className="nile-forms-state">
            <CheckCircle2 size={24} />
            <strong>No draft waiting for publication</strong>
            <p>Create a new draft from the builder before publishing again.</p>
            <Link
              href={formsRoute(role, `/manage/${formId}/builder`)}
              className="platform-primary-button"
            >
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
                <span>
                  <Link2 size={15} /> URL slug
                </span>
                <input
                  required
                  pattern="[a-z0-9][a-z0-9-]{2,79}"
                  value={settings.slug}
                  onChange={event =>
                    setSettings(current => ({
                      ...current,
                      slug: event.target.value
                        .toLowerCase()
                        .replaceAll(" ", "-"),
                    }))
                  }
                />
              </label>
              <label>
                <span>
                  <Users size={15} /> Audience
                </span>
                <select
                  value={settings.audience}
                  onChange={event =>
                    setSettings(current => ({
                      ...current,
                      audience: event.target
                        .value as FormPublication["audience"],
                    }))
                  }
                >
                  <option value="public">Public</option>
                  <option value="authenticated">Authenticated</option>
                  <option value="assigned">Assigned</option>
                </select>
              </label>
              <div className="nile-form-settings-pair">
                <label>
                  <span>
                    <CalendarClock size={15} /> Opens
                  </span>
                  <input
                    type="datetime-local"
                    value={toLocalDateTime(settings.opensAt)}
                    onChange={event =>
                      setSettings(current => ({
                        ...current,
                        opensAt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>
                    <CalendarClock size={15} /> Closes
                  </span>
                  <input
                    type="datetime-local"
                    value={toLocalDateTime(settings.closesAt)}
                    onChange={event =>
                      setSettings(current => ({
                        ...current,
                        closesAt: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="nile-form-toggle-list">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.allowDrafts}
                    onChange={event =>
                      setSettings(current => ({
                        ...current,
                        allowDrafts: event.target.checked,
                      }))
                    }
                  />{" "}
                  Allow drafts
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.allowMultiple}
                    onChange={event =>
                      setSettings(current => ({
                        ...current,
                        allowMultiple: event.target.checked,
                      }))
                    }
                  />{" "}
                  Allow multiple responses
                </label>
              </div>
              <div className="nile-form-publish-boundary">
                <ShieldCheck size={17} />
                <p>
                  Responses stay in review until an authorized reviewer accepts
                  and promotes them.
                </p>
              </div>
              {message ? (
                <p className="nile-form-notice" role="status">
                  {message}
                </p>
              ) : null}
              <button
                type="submit"
                className="platform-primary-button"
                disabled={saving}
              >
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
              <Link
                href={`/forms/${published.slug}`}
                className="platform-primary-button"
              >
                Open public form
              </Link>
            ) : published.audience === "assigned" ? (
              <Link
                href={formsRoute(
                  role,
                  `/manage/${formId}/publications/${published.id}/assignments`
                )}
                className="platform-primary-button"
              >
                Manage assignments
              </Link>
            ) : (
              <Link
                href={formsRoute(role, `/manage/${formId}/publications`)}
                className="platform-primary-button"
              >
                View publication
              </Link>
            )}
          </section>
        ) : null}

        {message && !draftVersion ? (
          <p className="nile-form-notice" role="status">
            {message}
          </p>
        ) : null}

        {bundle.publications.length ? (
          <div className="nile-form-publication-history-link">
            <Link
              href={formsRoute(role, `/manage/${formId}/publications`)}
              className="platform-secondary-button"
            >
              Publication history
            </Link>
          </div>
        ) : null}
      </div>
    </PlatformShell>
  );
}
