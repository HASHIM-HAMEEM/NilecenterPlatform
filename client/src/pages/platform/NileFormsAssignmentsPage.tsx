import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import { Link } from "wouter";

import NileFormsAssignmentManager from "@/components/forms/NileFormsAssignmentManager";
import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import { fetchFormDefinition } from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import type { FormDefinitionBundle } from "../../../../server/nileFormsService";

export default function NileFormsAssignmentsPage({
  role,
  formId,
  publicationId,
}: {
  role: Role;
  formId: string;
  publicationId: string;
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
      setMessage("");
      const response = await fetchFormDefinition(formId);
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setMessage(response.error ?? "Assignments could not be loaded.");
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

  const publication = bundle?.publications.find(
    item => item.id === publicationId
  );
  const invalidPublication =
    status === "ready" &&
    (!publication ||
      publication.audience !== "assigned" ||
      publication.status === "closed" ||
      publication.status === "retired" ||
      Boolean(
        publication.closesAt &&
          new Date(publication.closesAt).getTime() <= Date.now()
      ));

  return (
    <PlatformShell role={role} title="Publication assignments">
      <div className="nile-forms-page">
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header compact">
          <div>
            <Link
              href={formsRoute(role, `/manage/${formId}/publications`)}
              className="nile-forms-back-link"
            >
              <ArrowLeft size={15} /> Publication history
            </Link>
            <span className="nile-forms-eyebrow">Assigned audience</span>
            <h1>{bundle?.definition.title ?? "Publication assignments"}</h1>
          </div>
        </header>

        {status === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading assignments</strong>
          </section>
        ) : status === "error" || !bundle ? (
          <section className="nile-forms-state" role="alert">
            <Users size={24} />
            <strong>Assignments unavailable</strong>
            <p>{message}</p>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setReload(value => value + 1)}
            >
              <RefreshCw size={15} /> Retry
            </button>
          </section>
        ) : invalidPublication || !publication ? (
          <section className="nile-forms-state" role="alert">
            <Users size={24} />
            <strong>Assignments unavailable</strong>
            <p>This publication is not available for new assignments.</p>
          </section>
        ) : (
          <>
            {message ? (
              <p className="nile-form-notice" role="status">
                {message}
              </p>
            ) : null}
            <NileFormsAssignmentManager
              bundle={bundle}
              publication={publication}
              onBundleChange={setBundle}
              onMessage={setMessage}
            />
          </>
        )}
      </div>
    </PlatformShell>
  );
}
