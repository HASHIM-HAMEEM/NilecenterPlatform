import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  fetchOwnFormSubmission,
  withdrawFormSubmissionRequest,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import { getLocalizedText, type FormField } from "@shared/nileForms";
import type { FormResponderSubmissionDetail } from "../../../../server/nileFormsService";

function displayValue(value: unknown, locale: "en" | "ar") {
  if (typeof value === "boolean") {
    return value
      ? locale === "ar"
        ? "نعم"
        : "Yes"
      : locale === "ar"
        ? "لا"
        : "No";
  }
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "") {
    return locale === "ar" ? "غير متاح" : "Not provided";
  }
  return String(value);
}

function formattedAnswer(
  field: FormField,
  value: unknown,
  detail: FormResponderSubmissionDetail,
  locale: "en" | "ar"
) {
  const options = field.options ?? detail.entityOptions[field.id] ?? [];
  const selected = options
    .filter(option =>
      Array.isArray(value) ? value.includes(option.id) : option.id === value
    )
    .map(option => getLocalizedText(option.label, locale));
  return selected.length ? selected.join(", ") : displayValue(value, locale);
}

function statusLabel(status: string, locale: "en" | "ar") {
  const labels: Record<string, { en: string; ar: string }> = {
    submitted: { en: "Submitted", ar: "تم الإرسال" },
    under_review: { en: "Under review", ar: "قيد المراجعة" },
    accepted: { en: "Accepted", ar: "مقبول" },
    rejected: { en: "Needs changes", ar: "يحتاج تعديلاً" },
    promoted: { en: "Completed", ar: "مكتمل" },
    withdrawn: { en: "Withdrawn", ar: "تم السحب" },
    quarantined: { en: "Needs attention", ar: "يحتاج متابعة" },
  };
  return labels[status]?.[locale] ?? status.replaceAll("_", " ");
}

export default function NileFormsResponsePage({
  role,
  publicationId,
  submissionId,
}: {
  role: Role;
  publicationId: string;
  submissionId: string;
}) {
  const [, navigate] = useLocation();
  const [detail, setDetail] = useState<FormResponderSubmissionDetail | null>(
    null
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      const response = await fetchOwnFormSubmission(
        publicationId,
        submissionId
      );
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setMessage(response.error ?? "This response could not be loaded.");
        return;
      }
      setDetail(response.data);
      setStatus("ready");
      setMessage("");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [publicationId, reload, submissionId]);

  const fields = useMemo(
    () => detail?.version.content.pages.flatMap(page => page.fields) ?? [],
    [detail]
  );

  const withdraw = async () => {
    if (!detail) return;
    setWithdrawing(true);
    setMessage("");
    const response = await withdrawFormSubmissionRequest(
      detail.submission.id,
      detail.submission.revision
    );
    setWithdrawing(false);
    if (!response.ok) {
      setMessage(response.error ?? "The response could not be withdrawn.");
      return;
    }
    navigate(formsRoute(role, `/${publicationId}`));
  };

  if (status !== "ready" || !detail) {
    return (
      <PlatformShell role={role} title="Form response">
        <div className="nile-forms-page">
          <NileFormsNavigation role={role} />
          <section
            className="nile-forms-state"
            role={status === "error" ? "alert" : undefined}
          >
            {status === "loading" ? (
              <span className="nile-forms-spinner" />
            ) : (
              <CheckCircle2 size={24} />
            )}
            <strong>
              {status === "loading"
                ? "Loading response"
                : "Response unavailable"}
            </strong>
            {message ? <p>{message}</p> : null}
            {status === "error" ? (
              <button
                type="button"
                className="platform-secondary-button"
                onClick={() => setReload(value => value + 1)}
              >
                <RefreshCw size={15} />
                Retry
              </button>
            ) : null}
          </section>
        </div>
      </PlatformShell>
    );
  }

  const locale = detail.version.content.defaultLanguage;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const latestReview = detail.reviews.reduce<
    (typeof detail.reviews)[number] | undefined
  >(
    (latest, review) =>
      !latest ||
      new Date(review.createdAt).getTime() >
        new Date(latest.createdAt).getTime()
        ? review
        : latest,
    undefined
  );
  const dateLocale = locale === "ar" ? "ar-EG" : "en";

  return (
    <PlatformShell role={role} title="Form response">
      <div
        className="nile-forms-page nile-form-response-detail"
        dir={direction}
      >
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header compact">
          <div>
            <Link href={formsRoute(role)} className="nile-forms-back-link">
              <ArrowLeft size={15} />
              {locale === "ar" ? "النماذج" : "Forms"}
            </Link>
            <h1>{getLocalizedText(detail.version.content.title, locale)}</h1>
            <p>
              {locale === "ar"
                ? "عرض الرد المسجل وحالة مراجعته."
                : "View the recorded response and its review status."}
            </p>
          </div>
          <span
            className={`nile-form-status is-${detail.submission.status}`}
            data-testid="nile-form-response-status"
          >
            {statusLabel(detail.submission.status, locale)}
          </span>
        </header>

        {message ? (
          <p className="nile-form-notice is-error" role="alert">
            {message}
          </p>
        ) : null}

        <section
          className="nile-form-response-summary"
          data-testid="nile-form-response-detail"
        >
          <CheckCircle2 size={20} />
          <div>
            <span>
              {locale === "ar" ? "تم إرسال الرد" : "Response submitted"}
            </span>
            <strong>
              {new Intl.DateTimeFormat(dateLocale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(detail.submission.submittedAt))}
            </strong>
          </div>
          <div>
            <span>{locale === "ar" ? "الإصدار" : "Version"}</span>
            <strong>{detail.version.versionNumber}</strong>
          </div>
        </section>

        <section className="nile-form-review-grid">
          <article className="nile-form-review-answers">
            <header>
              <div>
                <span>{locale === "ar" ? "ردك" : "Your response"}</span>
                <h2>
                  {locale === "ar" ? "الإجابات المسجلة" : "Recorded answers"}
                </h2>
              </div>
            </header>
            <dl>
              {fields
                .filter(field =>
                  Object.hasOwn(detail.submission.answers, field.id)
                )
                .map(field => (
                  <div key={field.id}>
                    <dt>{getLocalizedText(field.label, locale)}</dt>
                    <dd>
                      {formattedAnswer(
                        field,
                        detail.submission.answers[field.id],
                        detail,
                        locale
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>

          <aside className="nile-form-review-context">
            <section>
              <header>
                <h2>{locale === "ar" ? "حالة المراجعة" : "Review status"}</h2>
              </header>
              {detail.submission.status === "submitted" ? (
                <p>
                  {locale === "ar"
                    ? "سيتم إخطارك عند بدء المراجعة."
                    : "This response is waiting for review."}
                </p>
              ) : detail.submission.status === "under_review" ? (
                <p>
                  {locale === "ar"
                    ? "يقوم الفريق بمراجعة ردك الآن."
                    : "The team is reviewing this response now."}
                </p>
              ) : detail.submission.status === "rejected" ? (
                <p>
                  {locale === "ar"
                    ? "يرجى مراجعة ملاحظة الفريق أدناه."
                    : "Review the team note below."}
                </p>
              ) : (
                <p>
                  {locale === "ar"
                    ? "اكتملت مراجعة هذا الرد."
                    : "This response has completed review."}
                </p>
              )}
            </section>

            {latestReview?.comments ? (
              <section className="nile-form-response-review">
                <header>
                  <h2>{locale === "ar" ? "ملاحظة الفريق" : "Team note"}</h2>
                </header>
                <p>{latestReview.comments}</p>
              </section>
            ) : null}

            {detail.submission.status === "submitted" ? (
              <section className="nile-form-review-actions">
                <header>
                  <h2>
                    {locale === "ar"
                      ? "تحتاج إلى تعديل؟"
                      : "Need to make a correction?"}
                  </h2>
                </header>
                <p>
                  {locale === "ar"
                    ? "يمكنك سحب الرد قبل أن تبدأ المراجعة."
                    : "You can withdraw this response before review begins."}
                </p>
                <button
                  type="button"
                  className="platform-secondary-button is-danger"
                  disabled={withdrawing}
                  onClick={withdraw}
                  data-testid="nile-form-withdraw-response"
                >
                  <RotateCcw size={16} />
                  {withdrawing
                    ? locale === "ar"
                      ? "جارٍ السحب"
                      : "Withdrawing"
                    : locale === "ar"
                      ? "سحب الرد"
                      : "Withdraw response"}
                </button>
              </section>
            ) : null}

            <section className="nile-form-response-activity">
              <header>
                <h2>{locale === "ar" ? "آخر تحديث" : "Latest update"}</h2>
              </header>
              <p>
                <Clock3 size={14} />
                {new Intl.DateTimeFormat(dateLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(detail.submission.updatedAt))}
              </p>
            </section>
          </aside>
        </section>
      </div>
    </PlatformShell>
  );
}
