import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ExternalLink } from "lucide-react";
import {
  type NccJotformFormDto,
  type NccJotformSubmissionDto,
  type NccPageDto,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { formatDateTime } from "../i18n";
import { ListPage, type ListColumn } from "../ui/list-page";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";
import { useListQuery } from "../ui/use-list-query";

const J = copy.jotform;

/** Primary label = the answer whose label mentions a name; else generic. */
export function submissionName(row: NccJotformSubmissionDto): string {
  const match = row.answers.find(answer => /name/i.test(answer.label));
  return match?.value.trim() || J.submission;
}

export function submissionEmail(
  row: NccJotformSubmissionDto
): string | null {
  const match = row.answers.find(answer => /e-?mail/i.test(answer.label));
  return match?.value.trim() || null;
}

export default function JotformSubmissionsPage() {
  const { rowId } = useParams<{ rowId: string }>();
  const url = useListQuery([]);
  const detail = useNcc<{ form: NccJotformFormDto }>(
    `/api/ncc/settings/jotform/forms/${rowId}`
  );
  const form = detail.data?.form ?? null;

  const query = useMemo(
    () => ({
      page: url.page,
      pageSize: 25,
    }),
    [url]
  );
  const list = useNcc<NccPageDto<NccJotformSubmissionDto>>(
    `/api/ncc/settings/jotform/forms/${rowId}/submissions`,
    query,
    { keepPreviousData: true }
  );
  const page = list.data;

  const columns: ListColumn<NccJotformSubmissionDto>[] = [
    {
      id: "name",
      label: J.submission,
      always: true,
      render: row =>
        row.submissionId ? (
          <Link
            href={`/app/jotform/${rowId}/submissions/${encodeURIComponent(row.submissionId)}`}
            className="staff-stretch"
          >
            {submissionName(row)}
          </Link>
        ) : (
          <span className="staff-stretch">{submissionName(row)}</span>
        ),
    },
    {
      id: "email",
      label: J.inputEmail,
      render: row => (
        <span className="staff-ltr" dir="auto">
          {submissionEmail(row) ?? "—"}
        </span>
      ),
    },
    {
      id: "received",
      label: J.received,
      render: row => formatDateTime(row.receivedAt),
    },
    {
      id: "jotform",
      label: "",
      render: row =>
        row.submissionId ? (
          <a
            className="staff-btn"
            data-variant="quiet"
            data-size="sm"
            href={`https://www.jotform.com/submission/${encodeURIComponent(row.submissionId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-4" aria-hidden /> {J.openOnJotform}
          </a>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <PageHeader
        title={J.submissionsTitle}
        description={form?.name}
        actions={
          <>
            {form ? (
              <a
                className="staff-btn"
                data-variant="quiet"
                data-size="sm"
                href={`https://form.jotform.com/${form.formId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" aria-hidden />{" "}
                {J.openInJotform}
              </a>
            ) : null}
            <Link
              href={`/app/jotform/${rowId}`}
              className="staff-btn"
              data-variant="quiet"
              data-size="sm"
            >
              {J.formSetup}
            </Link>
          </>
        }
      />
      {list.error && !page ? (
        <ErrorState error={list.error} onRetry={() => void list.mutate()} />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={J.submissionsTitle}
          listId="jotform-submissions"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          server={{
            total: page.total,
            pageSize: page.pageSize,
            refreshing: list.isValidating,
          }}
          empty={
            <EmptyState
              title={J.submissionsEmpty}
              description={J.submissionsEmptyHint}
            />
          }
        />
      )}
    </div>
  );
}
