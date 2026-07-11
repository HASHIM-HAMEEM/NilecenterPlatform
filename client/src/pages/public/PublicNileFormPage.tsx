import { useEffect, useState } from "react";
import { ArrowLeft, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

import NileFormRenderer from "@/components/forms/NileFormRenderer";
import { fetchPublicForm } from "@/lib/forms/api";
import type { FormResponderBundle } from "../../../../server/nileFormsService";

export default function PublicNileFormPage({ slug }: { slug: string }) {
  const [bundle, setBundle] = useState<FormResponderBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError("");
      const response = await fetchPublicForm(slug);
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setError(response.error ?? "This form is not available.");
        return;
      }
      setBundle(response.data);
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload, slug]);

  return (
    <main className="nile-public-form-page">
      <header className="nile-public-form-header">
        <Link href="/" className="nile-public-form-brand">
          <span>N</span>
          <div><strong>Nile Center</strong><small>Nile Forms</small></div>
        </Link>
        <Link href="/" className="nile-public-form-back">
          <ArrowLeft size={15} /> Nile Center
        </Link>
      </header>

      {status === "loading" ? (
        <section className="nile-public-form-state" aria-live="polite">
          <span className="nile-forms-spinner" />
          <strong>Loading form</strong>
        </section>
      ) : status === "error" || !bundle ? (
        <section className="nile-public-form-state" role="alert">
          <FileText size={28} />
          <h1>Form unavailable</h1>
          <p>{error}</p>
          <div>
            <button type="button" className="platform-secondary-button" onClick={() => setReload(value => value + 1)}>
              <RefreshCw size={15} /> Retry
            </button>
            <Link href="/" className="platform-primary-button">Return to Nile Center</Link>
          </div>
        </section>
      ) : (
        <div className="nile-public-form-layout">
          <aside className="nile-public-form-context">
            <span className="nile-forms-eyebrow">Nile Forms</span>
            <h2>{bundle.definition.title}</h2>
            <p>{bundle.version.content.description.en}</p>
            <div>
              <ShieldCheck size={17} />
              <span>Version {bundle.version.versionNumber}</span>
            </div>
          </aside>
          <NileFormRenderer bundle={bundle} mode="public" slug={slug} />
        </div>
      )}
    </main>
  );
}
