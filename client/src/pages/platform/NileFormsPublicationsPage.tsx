import { useEffect, useState } from "react";
import { ArrowLeft, FileClock, RefreshCw, Users } from "lucide-react";
import { Link } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  fetchFormDefinition,
  retireFormPublicationRequest,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import type { FormDefinitionBundle } from "../../../../server/nileFormsService";

export default function NileFormsPublicationsPage({
  role,
  formId,
}: {
  role: Role;
  formId: string;
}) {
  const [bundle, setBundle] = useState<FormDefinitionBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      const response = await fetchFormDefinition(formId);
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setMessage(response.error ?? "Publications could not be loaded.");
        return;
      }
      setBundle(response.data);
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [formId, reload]);

  const retire = async (publicationId: string) => {
    setMessage("");
    const response = await retireFormPublicationRequest(publicationId);
    if (!response.ok) {
      setMessage(response.error ?? "Retirement failed.");
      return;
    }
    setMessage("Publication retired.");
    setReload(value => value + 1);
  };

  return (
    <PlatformShell role={role} title="Publications">
      <div className="nile-forms-page">
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header compact">
          <div>
            <Link
              href={formsRoute(role, `/manage/${formId}/publish`)}
              className="nile-forms-back-link"
            >
              <ArrowLeft size={15} /> Publish settings
            </Link>
            <span className="nile-forms-eyebrow">Publication history</span>
            <h1>{bundle?.definition.title ?? "Publications"}</h1>
          </div>
        </header>

        {status === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading publications</strong>
          </section>
        ) : status === "error" || !bundle ? (
          <section className="nile-forms-state" role="alert">
            <FileClock size={24} />
            <strong>Publications unavailable</strong>
            <p>{message}</p>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => {
                setMessage("");
                setReload(value => value + 1);
              }}
            >
              <RefreshCw size={15} /> Retry
            </button>
          </section>
        ) : bundle.publications.length ? (
          <>
            {message ? (
              <p className="nile-form-notice" role="status">
                {message}
              </p>
            ) : null}
            <section className="nile-form-publication-history">
              <header>
                <h2>Publication history</h2>
              </header>
              {bundle.publications.map(publication => (
                <div key={publication.id}>
                  <span className={`nile-form-status is-${publication.status}`}>
                    {publication.status}
                  </span>
                  <strong>{publication.slug}</strong>
                  <span>{publication.audience}</span>
                  <div className="nile-form-publication-actions">
                    {publication.audience === "assigned" &&
                    publication.status !== "retired" ? (
                      <Link
                        href={formsRoute(
                          role,
                          `/manage/${formId}/publications/${publication.id}/assignments`
                        )}
                        className="nile-form-text-button"
                      >
                        <Users size={14} /> Assignments
                      </Link>
                    ) : null}
                    {publication.status !== "retired" ? (
                      <button
                        type="button"
                        className="nile-form-text-button"
                        onClick={() => void retire(publication.id)}
                      >
                        Retire
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="nile-forms-state">
            <FileClock size={24} />
            <strong>No publications</strong>
            <p>Publish a version before managing publication history.</p>
          </section>
        )}
      </div>
    </PlatformShell>
  );
}
