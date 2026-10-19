import { Link, useParams } from "wouter";
import { ExternalLink } from "lucide-react";
import {
  type NccJotformFormDto,
  type NccJotformSubmissionDto,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { formatDateTime } from "../i18n";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
} from "../ui/primitives";
import { submissionEmail, submissionName } from "./jotform-submissions-page";

const J = copy.jotform;

export default function JotformSubmissionPage() {
  const { rowId, submissionId } = useParams<{
    rowId: string;
    submissionId: string;
  }>();
  const detail = useNcc<{ form: NccJotformFormDto }>(
    `/api/ncc/settings/jotform/forms/${rowId}`
  );
  const submissionQuery = useNcc<{ submission: NccJotformSubmissionDto }>(
    `/api/ncc/settings/jotform/forms/${rowId}/submissions/${encodeURIComponent(submissionId)}`
  );

  const form = detail.data?.form ?? null;
  const submission = submissionQuery.data?.submission ?? null;

  if (submissionQuery.error && !submission) {
    return (
      <div className="staff-detail flex min-w-0 flex-col gap-6">
        <ErrorState
          error={submissionQuery.error}
          onRetry={() => void submissionQuery.mutate()}
        />
      </div>
    );
  }
  if (!submission) return <LoadingRows />;

  const email = submissionEmail(submission);

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="min-w-0">
          <div className="staff-eyebrow">
            <Link
              href={`/app/jotform/${rowId}/submissions`}
              className="staff-link-quiet"
            >
              {form?.name ?? J.title}
            </Link>
          </div>
          <h1 className="staff-detail-name">
            {submissionName(submission)}
          </h1>
          <div className="staff-detail-meta">
            <span className="staff-muted">
              {J.received}: {formatDateTime(submission.receivedAt)}
            </span>
          </div>
        </div>
        <div className="staff-detail-actions">
          {submission.submissionId ? (
            <a
              className="staff-btn"
              data-variant="quiet"
              data-size="sm"
              href={`https://www.jotform.com/submission/${encodeURIComponent(submission.submissionId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" aria-hidden />{" "}
              {J.openOnJotform}
            </a>
          ) : null}
          {email ? (
            <Link
              href={`/app/leads?q=${encodeURIComponent(email)}`}
              className="staff-btn"
              data-variant="quiet"
              data-size="sm"
            >
              {J.findLead}
            </Link>
          ) : null}
        </div>
      </header>

      {submission.answers.length ? (
        <section className="staff-section">
          <dl className="staff-answers">
            {submission.answers.map((answer, index) => (
              <div key={index} className="staff-answer">
                <dt dir="auto">{answer.label}</dt>
                <dd dir="auto" className="whitespace-pre-wrap">
                  {answer.value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <EmptyState title={J.noAnswers} />
      )}
    </div>
  );
}
