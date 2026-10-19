import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  createNccJotformFormRequest,
  fetchNccJotformFormsRequest,
  fetchNccJotformFormTitleRequest,
  patchNccJotformFormRequest,
  type NccJotformFormDto,
  type NccJotformTargetDto,
  type NccPageDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/kit";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";
import { useListQuery } from "../ui/use-list-query";
import {
  formatDate,
  useCanManage,
} from "./catalog-shared";
import { useBranches } from "./admissions-ui";

const J = copy.jotform;
const S = copy.catalog.shared;

/** Radix Select items cannot use ""; sentinel for "no fallback". */
const NONE = "__none";

const FILTER_KEYS = ["creates", "status", "fallback", "sort"] as const;

/** First 6–20 digit run in a bare id or any Jotform link. */
export function parseJotformFormId(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{6,20}$/.test(trimmed)) return trimmed;
  if (!/[/.\w-]*\.|:\/\//.test(trimmed) && !trimmed.includes("/")) return null;
  const match = trimmed.match(/\d{6,20}/);
  return match ? match[0] : null;
}

export function createsLabel(target: NccJotformTargetDto): string {
  return target === "contact"
    ? J.createsContact
    : target === "placement_test"
      ? J.createsPlacement
      : J.createsTrial;
}

function createsHint(target: NccJotformTargetDto): string {
  return target === "contact"
    ? J.createsContactHint
    : target === "placement_test"
      ? J.createsPlacementHint
      : J.createsTrialHint;
}

const SORT_CHOICES = [
  { value: "name:asc", label: `${J.name} A–Z` },
  { value: "created_at:desc", label: `${J.added} ↓` },
  { value: "created_at:asc", label: `${J.added} ↑` },
  { value: "enabled:desc", label: `${J.on} ↓` },
] as const;

export function JotformFormSheet({
  open,
  onOpenChange,
  form,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for "Edit details" on the setup page; absent for Connect. */
  form?: NccJotformFormDto | null;
  onSaved: (form: NccJotformFormDto) => Promise<void> | void;
}) {
  const isEdit = Boolean(form);
  const branches = useBranches();
  const [, navigate] = useLocation();
  const [formIdInput, setFormIdInput] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [target, setTarget] = useState<NccJotformTargetDto>("contact");
  const [pendingTarget, setPendingTarget] =
    useState<NccJotformTargetDto | null>(null);
  const [fallbackBranchId, setFallbackBranchId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  const [titleState, setTitleState] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ok"; title: string }
    | { state: "bad" }
    | { state: "warn" }
  >({ state: "idle" });
  const [duplicate, setDuplicate] = useState<NccJotformFormDto | null>(null);

  const formId = useMemo(
    () => parseJotformFormId(formIdInput),
    [formIdInput]
  );

  useEffect(() => {
    if (!open) return;
    setFormIdInput(form?.formId ?? "");
    setName(form?.name ?? "");
    setNameTouched(Boolean(form));
    setTarget(form?.target ?? "contact");
    setPendingTarget(null);
    setFallbackBranchId(form?.fallbackBranchId ?? "");
    setFieldErrors(undefined);
    setTitleState({ state: "idle" });
    setDuplicate(null);
  }, [open, form]);

  // Debounced title + duplicate check once the id parses.
  useEffect(() => {
    if (!open || !formId) return;
    let cancelled = false;
    setTitleState({ state: "checking" });
    const timer = window.setTimeout(() => {
      void (async () => {
        const [title, existing] = await Promise.all([
          fetchNccJotformFormTitleRequest(formId),
          fetchNccJotformFormsRequest({ q: formId, pageSize: 5 }),
        ]);
        if (cancelled) return;
        if (existing.ok) {
          const found = existing.data?.items.find(
            item => item.formId === formId && item.id !== form?.id
          );
          setDuplicate(found ?? null);
        }
        if (title.ok && title.data?.title.name) {
          setTitleState({ state: "ok", title: title.data.title.name });
          setNameTouched(touched => {
            if (!touched) setName(title.data!.title.name);
            return touched;
          });
        } else if (title.status === 400) {
          setTitleState({ state: "bad" });
        } else {
          setTitleState({ state: "warn" });
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formId, form?.id]);

  const dirty = isEdit
    ? name !== (form?.name ?? "") ||
      target !== (form?.target ?? "contact") ||
      fallbackBranchId !== (form?.fallbackBranchId ?? "") ||
      (formId ?? "") !== (form?.formId ?? "")
    : true;

  const blocked = !formId || titleState.state === "bad" || duplicate !== null;

  async function submit() {
    if (!formId || !name.trim() || blocked) {
      throw new Error(J.titleError);
    }
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const saved = await staffWrite(
        isEdit
          ? patchNccJotformFormRequest(form!.id, {
              ...(formId !== form!.formId ? { formId } : {}),
              ...(name.trim() !== form!.name ? { name: name.trim() } : {}),
              ...(target !== form!.target ? { target } : {}),
              ...(fallbackBranchId !== (form!.fallbackBranchId ?? "")
                ? { fallbackBranchId: fallbackBranchId || null }
                : {}),
            })
          : createNccJotformFormRequest({
              formId,
              name: name.trim(),
              target,
              ...(fallbackBranchId
                ? { fallbackBranchId }
                : {}),
            })
      );
      await onSaved(saved.form);
      onOpenChange(false);
      if (!isEdit) navigate(`/app/jotform/${saved.form.id}`);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> })
        .details;
      if (details) setFieldErrors(details);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? J.editTitle : J.connectTitle}
        dirty={dirty}
        saving={saving}
        fieldErrors={fieldErrors}
        saveLabel={isEdit ? S.saveChanges : J.connectSubmit}
        saveDisabled={blocked || !name.trim()}
        onSubmit={() =>
          runAction(submit, {
            success: isEdit ? J.savedToast : J.connectedToast,
          })
        }
      >
        {errorFor => (
          <>
            <StaffField
              label={J.formIdField}
              error={
                errorFor("formId") ??
                (!duplicate &&
                formIdInput.trim() &&
                (!formId || titleState.state === "bad")
                  ? J.titleError
                  : undefined)
              }
            >
              <input
                className="staff-input staff-ltr"
                dir="ltr"
                inputMode="numeric"
                value={formIdInput}
                onChange={event => {
                  setFormIdInput(event.target.value);
                  setTitleState({ state: "idle" });
                  setDuplicate(null);
                }}
              />
              <span className="staff-muted text-xs">{J.formIdHint}</span>
              {titleState.state === "ok" ? (
                <span className="staff-muted text-xs" role="status">
                  {J.foundTitle.replace("{title}", titleState.title)}
                </span>
              ) : titleState.state === "warn" ? (
                <span className="staff-field-error" role="status">
                  {J.titleWarning}
                </span>
              ) : null}
              {duplicate ? (
                <span className="staff-field-error" role="alert">
                  {J.duplicate}{" "}
                  <Link
                    href={`/app/jotform/${duplicate.id}`}
                    className="staff-link"
                  >
                    {J.duplicateOpen}
                  </Link>
                </span>
              ) : null}
            </StaffField>
            <StaffField label={J.name} error={errorFor("name")}>
              <input
                className="staff-input"
                value={name}
                onChange={event => {
                  setName(event.target.value);
                  setNameTouched(true);
                }}
                required
              />
            </StaffField>
            <StaffField label={J.creates} error={errorFor("target")}>
              <div
                className="staff-choice-list"
                role="radiogroup"
                aria-label={J.creates}
              >
                {(
                  ["contact", "placement_test", "trial_lesson"] as const
                ).map(value => (
                  <label key={value} className="staff-choice">
                    <input
                      type="radio"
                      name="jotform-target"
                      checked={target === value}
                      onChange={() => {
                        if (isEdit && value !== form!.target) {
                          setPendingTarget(value);
                        } else {
                          setTarget(value);
                        }
                      }}
                    />
                    <span className="staff-choice-body">
                      <span className="staff-choice-title">
                        {createsLabel(value)}
                      </span>
                      <span className="staff-muted">{createsHint(value)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </StaffField>
            <StaffField
              label={J.fallbackBranch}
              error={errorFor("fallbackBranchId")}
            >
              <Select
                value={fallbackBranchId || NONE}
                onValueChange={value =>
                  setFallbackBranchId(value === NONE ? "" : value)
                }
              >
                <SelectTrigger aria-label={J.fallbackBranch}>
                  <SelectValue placeholder={J.noFallback} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{J.noFallback}</SelectItem>
                  {branches.active.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="staff-muted text-xs">
                {target === "placement_test"
                  ? J.fallbackPlacementHint
                  : J.fallbackHint}
              </span>
            </StaffField>
          </>
        )}
      </FormSheet>
      <ConfirmDialog
        open={pendingTarget !== null}
        onOpenChange={next => {
          if (!next) setPendingTarget(null);
        }}
        title={J.changeCreatesTitle}
        description={J.changeCreatesBody}
        confirmLabel={S.saveChanges}
        onConfirm={() => {
          if (pendingTarget) setTarget(pendingTarget);
          setPendingTarget(null);
        }}
      />
    </>
  );
}

export default function JotformPage() {
  const canManage = useCanManage();
  const url = useListQuery(FILTER_KEYS as unknown as string[]);
  const branches = useBranches();
  const [connectOpen, setConnectOpen] = useState(false);
  const invalidate = useInvalidate();

  const query = useMemo(() => {
    const out: Record<string, string | number | boolean | undefined> = {
      pageSize: 25,
    };
    if (url.q) out.q = url.q;
    if (url.page) out.page = url.page;
    if (url.creates) out.target = url.creates;
    if (url.status === "on") out.enabled = true;
    else if (url.status === "off") out.enabled = false;
    if (url.fallback) out.fallbackBranchId = url.fallback;
    const sort = url.sort && String(url.sort).includes(":")
      ? String(url.sort)
      : "name:asc";
    const [field, order] = sort.split(":");
    out.sort = field;
    out.order = order === "desc" ? "desc" : "asc";
    return out;
  }, [url]);

  const list = useNcc<NccPageDto<NccJotformFormDto>>(
    "/api/ncc/settings/jotform/forms",
    query,
    { keepPreviousData: true }
  );
  const page = list.data;

  const filters: ListFilter[] = [
    {
      key: "creates",
      label: J.creates,
      allLabel: J.creates,
      options: (
        ["contact", "placement_test", "trial_lesson"] as const
      ).map(value => ({ value, label: createsLabel(value) })),
    },
    {
      key: "status",
      label: S.status,
      allLabel: S.allStatuses,
      options: [
        { value: "on", label: J.on },
        { value: "off", label: J.off },
      ],
    },
    ...(branches.active.length
      ? [
          {
            key: "fallback",
            label: J.fallbackBranch,
            allLabel: J.fallbackBranch,
            options: branches.active.map(branch => ({
              value: branch.id,
              label: branch.name,
            })),
          },
        ]
      : []),
    {
      key: "sort",
      label: J.sortBy,
      allLabel: J.sortBy,
      options: SORT_CHOICES.map(choice => ({
        value: choice.value,
        label: choice.label,
      })),
    },
  ];

  const columns: ListColumn<NccJotformFormDto>[] = [
    {
      id: "name",
      label: J.name,
      always: true,
      render: row => (
        <div className="flex flex-col min-w-0">
          <Link href={`/app/jotform/${row.id}`} className="staff-stretch">
            {row.name}
          </Link>
          <span
            className="staff-muted text-xs staff-ltr font-mono"
            dir="ltr"
          >
            {row.formId}
          </span>
        </div>
      ),
    },
    {
      id: "creates",
      label: J.creates,
      render: row => createsLabel(row.target),
    },
    {
      id: "fallback",
      label: J.fallbackBranch,
      render: row =>
        row.fallbackBranchId ? (
          row.fallbackBranchName || row.fallbackBranchId
        ) : (
          <span className="staff-muted">{J.noFallback}</span>
        ),
    },
    {
      id: "status",
      label: S.status,
      render: row => (
        <StatusBadge
          status={row.enabled ? "active" : "disabled"}
          label={row.enabled ? J.on : J.off}
        />
      ),
    },
    {
      id: "added",
      label: J.added,
      render: row => formatDate(row.createdAt),
    },
    {
      id: "submissions",
      label: "",
      render: row => (
        <Link
          href={`/app/jotform/${row.id}/submissions`}
          className="staff-link"
        >
          {J.submissions}
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <PageHeader
        title={J.title}
        actions={
          canManage ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              onClick={() => setConnectOpen(true)}
            >
              {J.connect}
            </button>
          ) : undefined
        }
      />
      {list.error && !page ? (
        <ErrorState error={list.error} onRetry={() => void list.mutate()} />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={J.title}
          listId="jotform"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.name}
          filters={filters}
          server={{
            total: page.total,
            pageSize: page.pageSize,
            refreshing: list.isValidating,
          }}
          empty={
            <EmptyState
              title={J.empty}
              description={J.emptyHint}
              action={
                canManage ? (
                  <button
                    type="button"
                    className="staff-btn"
                    data-variant="primary"
                    onClick={() => setConnectOpen(true)}
                  >
                    {J.connect}
                  </button>
                ) : undefined
              }
            />
          }
        />
      )}
      <JotformFormSheet
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onSaved={() =>
          invalidate("/api/ncc/settings/jotform/forms")
        }
      />
    </div>
  );
}
