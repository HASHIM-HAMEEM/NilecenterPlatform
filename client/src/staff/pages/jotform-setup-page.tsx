import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createNccJotformAnswerMapRequest,
  deleteNccJotformAnswerMapRequest,
  patchNccJotformAnswerMapRequest,
  patchNccJotformFormRequest,
  replaceNccJotformFormFieldsRequest,
  type NccJotformAnswerMapDto,
  type NccJotformAnswerRoleDto,
  type NccJotformCatalogueInputDto,
  type NccJotformFormDetailDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { StaffApiError } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "../ui/kit";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";
import {
  useCanManage,
} from "./catalog-shared";
import { useActiveAreas, useBranches } from "./admissions-ui";
import { createsLabel, JotformFormSheet } from "./jotform-page";

const J = copy.jotform;
const S = copy.catalog.shared;

/** Radix Select items cannot use ""; sentinel for "no default". */
const NONE = "__none";

const QUESTION_PATTERN = /^[A-Za-z0-9_]{1,80}$/;

/** Strip a leading qN_ prefix and any trailing [..] suffix, then trim. */
export function normalizeQuestionKey(raw: string): string {
  return raw
    .trim()
    .replace(/^q\d+_/, "")
    .replace(/\[[^\]]*\]\s*$/, "")
    .trim();
}

type DraftQuestion = {
  clientId: string;
  /** Saved field-map id; null for rows not yet persisted. */
  id: string | null;
  questionKey: string;
};

let nextClientId = 1;
function clientId() {
  return `q${nextClientId++}`;
}

type DraftFields = Record<string, DraftQuestion[]>;
type DraftDefaults = Record<string, string>;

const INPUT_LABELS: Record<string, string> = {
  email: J.inputEmail,
  first_name: J.inputFirstName,
  last_name: J.inputLastName,
  phone: J.inputPhone,
  nationality: J.inputNationality,
  date_of_birth: J.inputDateOfBirth,
  branch_label: J.inputBranch,
  source: J.inputSource,
  entry_path: J.inputEntryPath,
  area_of_study: J.inputAreaOfStudy,
  preferred_courses: J.inputPreferredCourses,
  delivery: J.inputDelivery,
  notes: J.inputNotes,
  subject_label: J.inputSubject,
  appointment_text: J.inputAppointment,
  contact_preference: J.inputContactPreference,
  comments: J.inputComments,
};

function inputLabel(key: string): string {
  return INPUT_LABELS[key] ?? key;
}

export const LEAD_SOURCE_OPTIONS = [
  { value: "walk-in", label: J.sourceWalkIn },
  { value: "facebook", label: J.sourceFacebook },
  { value: "referral", label: J.sourceReferral },
  { value: "website", label: J.sourceWebsite },
  { value: "phone", label: J.sourcePhone },
  { value: "jotform", label: "Jotform" },
  { value: "other", label: J.sourceOther },
];

export const ENTRY_PATH_OPTIONS = [
  { value: "direct", label: J.entryDirect },
  { value: "placement", label: J.entryPlacement },
  { value: "trial", label: J.entryTrial },
  { value: "unset", label: J.entryUnset },
];

function targetNoun(role: NccJotformAnswerRoleDto): string {
  return role === "branch"
    ? J.targetBranch
    : role === "area"
      ? J.targetArea
      : J.targetSource;
}

function fieldsFromDetail(form: NccJotformFormDetailDto): DraftFields {
  const draft: DraftFields = {};
  for (const input of form.catalogue) draft[input.key] = [];
  const sorted = [...form.fields].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (const field of sorted) {
    if (!draft[field.inputKey]) draft[field.inputKey] = [];
    draft[field.inputKey].push({
      clientId: clientId(),
      id: field.id,
      questionKey: field.questionKey,
    });
  }
  return draft;
}

function defaultsFromDetail(
  form: NccJotformFormDetailDto
): DraftDefaults {
  return Object.fromEntries(
    form.defaults.map(row => [row.inputKey, row.value])
  );
}

/** Canonical string so dirty = one comparison. */
function signature(fields: DraftFields, defaults: DraftDefaults): string {
  const parts = Object.keys(fields)
    .sort()
    .map(
      key =>
        `${key}=${fields[key]
          .map(q => `${q.id ?? "new"}:${q.questionKey.trim()}`)
          .join(",")}`
    );
  const defaultParts = Object.keys(defaults)
    .sort()
    .filter(key => defaults[key] !== "")
    .map(key => `${key}=${defaults[key]}`);
  return `${parts.join(";")}|${defaultParts.join(";")}`;
}

function defaultOptionsFor(
  input: NccJotformCatalogueInputDto,
  branches: ReturnType<typeof useBranches>,
  areas: ReturnType<typeof useActiveAreas>
): Array<{ value: string; label: string }> | null {
  if (input.lookupRole === "branch") {
    return branches.active.map(branch => ({
      value: branch.id,
      label: branch.name,
    }));
  }
  if (input.lookupRole === "area") {
    return areas.map(area => ({ value: area.id, label: area.name }));
  }
  if (input.lookupRole === "source") return LEAD_SOURCE_OPTIONS;
  if (input.key === "entry_path") return ENTRY_PATH_OPTIONS;
  return null;
}

function AnswerMapRows({
  form,
  fieldMapId,
  role,
  maps,
  onChanged,
}: {
  form: NccJotformFormDetailDto;
  fieldMapId: string;
  role: NccJotformAnswerRoleDto;
  maps: NccJotformAnswerMapDto[];
  onChanged: () => Promise<void> | void;
}) {
  const branches = useBranches();
  const areas = useActiveAreas();
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    answerText: string;
    target: string;
  } | null>(null);
  const [removing, setRemoving] = useState<NccJotformAnswerMapDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options =
    role === "branch"
      ? branches.active.map(branch => ({
          value: branch.id,
          label: branch.name,
        }))
      : role === "area"
        ? areas.map(area => ({ value: area.id, label: area.name }))
        : LEAD_SOURCE_OPTIONS;

  function validate(answerText: string): string | null {
    if (!answerText.trim()) return J.answerRequired;
    if (answerText.length > 200) return J.answerRequired;
    if (
      maps.some(
        map =>
          map.answerText.trim().toLowerCase() ===
            answerText.trim().toLowerCase() && map.id !== editing?.id
      )
    ) {
      return J.answerDuplicate;
    }
    return null;
  }

  async function add() {
    const problem = validate(text);
    if (problem || !target) {
      setError(problem ?? J.answerRequired);
      return;
    }
    setError(null);
    await runAction(
      async () => {
        await staffWrite(
          createNccJotformAnswerMapRequest({
            formId: form.formId,
            fieldMapId,
            role,
            answerText: text.trim(),
            ...(role === "source"
              ? { targetValue: target }
              : { targetId: target }),
          })
        );
        setText("");
        setTarget("");
        await onChanged();
      },
      { success: J.answerLinked }
    );
  }

  async function saveEdit() {
    if (!editing) return;
    const problem = validate(editing.answerText);
    if (problem || !editing.target) {
      setError(problem ?? J.answerRequired);
      return;
    }
    setError(null);
    await runAction(
      async () => {
        await staffWrite(
          patchNccJotformAnswerMapRequest(editing.id, {
            answerText: editing.answerText.trim(),
            ...(role === "source"
              ? { targetValue: editing.target, targetId: null }
              : { targetId: editing.target, targetValue: null }),
          })
        );
        setEditing(null);
        await onChanged();
      },
      { success: J.answerUpdated }
    );
  }

  return (
    <div className="staff-answers-panel flex flex-col gap-2">
      {maps.length ? (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th scope="col">{J.visitorAnswer}</th>
                <th scope="col">{J.goesTo}</th>
                <th scope="col">
                  <span className="sr-only">{copy.actions.edit}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {maps.map(map =>
                editing?.id === map.id ? (
                  <tr key={map.id}>
                    <td>
                      <input
                        className="staff-input w-full max-w-[22rem]"
                        value={editing.answerText}
                        onChange={event =>
                          setEditing({
                            ...editing,
                            answerText: event.target.value,
                          })
                        }
                        onKeyDown={event => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveEdit();
                          }
                        }}
                      />
                    </td>
                    <td>
                      <Select
                        value={editing.target || undefined}
                        onValueChange={value =>
                          setEditing({ ...editing, target: value })
                        }
                      >
                        <SelectTrigger
                          className="w-full max-w-[22rem]"
                          aria-label={J.emsTarget.replace(
                            "{target}",
                            targetNoun(role)
                          )}
                        >
                          <SelectValue placeholder={J.noDefault} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="staff-btn"
                          data-variant="quiet"
                          data-size="sm"
                          onClick={() => void saveEdit()}
                        >
                          {copy.actions.save}
                        </button>
                        <button
                          type="button"
                          className="staff-btn"
                          data-variant="quiet"
                          data-size="sm"
                          onClick={() => setEditing(null)}
                        >
                          {copy.actions.cancel}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={map.id}>
                    <td dir="auto">{map.answerText}</td>
                    <td dir="auto">{map.targetName}</td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="staff-btn"
                          data-variant="quiet"
                          data-size="sm"
                          onClick={() =>
                            setEditing({
                              id: map.id,
                              answerText: map.answerText,
                              target:
                                role === "source"
                                  ? (map.targetValue ?? "")
                                  : (map.targetId ?? ""),
                            })
                          }
                        >
                          {copy.actions.edit}
                        </button>
                        <button
                          type="button"
                          className="staff-btn"
                          data-variant="quiet"
                          data-size="sm"
                          onClick={() => setRemoving(map)}
                        >
                          {J.remove}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="staff-input flex-1 min-w-0 w-full sm:w-auto max-w-[22rem]"
          placeholder={J.answerPlaceholder}
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
        />
        <Select
          value={target || undefined}
          onValueChange={setTarget}
        >
          <SelectTrigger
            className="w-full sm:w-56 max-w-[22rem]"
            aria-label={J.emsTarget.replace("{target}", targetNoun(role))}
          >
            <SelectValue
              placeholder={J.emsTarget.replace("{target}", targetNoun(role))}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="staff-btn"
          data-size="sm"
          onClick={() => void add()}
        >
          {J.addAnswer}
        </button>
      </div>
      {error ? (
        <span className="staff-field-error" role="alert">
          {error}
        </span>
      ) : null}
      <span className="staff-muted text-xs">{J.answersFooter}</span>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={next => {
          if (!next) setRemoving(null);
        }}
        title={J.removeAnswerTitle}
        description={J.removeAnswerBody}
        confirmLabel={J.remove}
        destructive
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(
                deleteNccJotformAnswerMapRequest(removing!.id)
              );
              setRemoving(null);
              await onChanged();
            },
            { success: J.answerRemoved }
          )
        }
      />
    </div>
  );
}

function QuestionList({
  input,
  questions,
  savedMaps,
  form,
  onChange,
  onAnswersChanged,
}: {
  input: NccJotformCatalogueInputDto;
  questions: DraftQuestion[];
  savedMaps: NccJotformAnswerMapDto[];
  form: NccJotformFormDetailDto;
  onChange: (next: DraftQuestion[]) => void;
  onAnswersChanged: () => Promise<void> | void;
}) {
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  function move(index: number, delta: number) {
    const next = [...questions];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row);
    onChange(next);
  }

  function update(index: number, raw: string, normalize: boolean) {
    const questionKey = normalize ? normalizeQuestionKey(raw) : raw;
    const next = questions.map((question, item) =>
      item === index ? { ...question, questionKey } : question
    );
    onChange(next);
  }

  function validate(index: number) {
    const question = questions[index];
    const key = question.questionKey.trim();
    let message = "";
    if (key && !QUESTION_PATTERN.test(key)) message = J.questionInvalid;
    else if (
      key &&
      questions.some(
        (other, item) => item !== index && other.questionKey.trim() === key
      )
    ) {
      message = J.questionDuplicate;
    }
    setRowErrors(prev => ({ ...prev, [question.clientId]: message }));
  }

  return (
    <div className="flex flex-col gap-2">
      {questions.map((question, index) => (
        <div key={question.clientId} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              className="staff-input staff-ltr font-mono flex-1 min-w-0 max-w-[22rem]"
              dir="ltr"
              placeholder={J.questionPlaceholder}
              value={question.questionKey}
              onChange={event => update(index, event.target.value, false)}
              onBlur={event => {
                update(index, event.target.value, true);
                validate(index);
              }}
            />
            {questions.length >= 2 ? (
              <>
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="quiet"
                  data-size="sm"
                  aria-label={J.moveUp}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="quiet"
                  data-size="sm"
                  aria-label={J.moveDown}
                  disabled={index === questions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="staff-btn"
              data-variant="quiet"
              data-size="sm"
              aria-label={J.removeQuestion}
              onClick={() =>
                onChange(questions.filter((_, item) => item !== index))
              }
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          {rowErrors[question.clientId] ? (
            <span className="staff-field-error" role="alert">
              {rowErrors[question.clientId]}
            </span>
          ) : null}
          {input.lookupRole ? (
            question.id ? (
              <AnswerMapRows
                form={form}
                fieldMapId={question.id}
                role={input.lookupRole}
                maps={savedMaps.filter(map => map.fieldMapId === question.id)}
                onChanged={onAnswersChanged}
              />
            ) : (
              <span className="staff-muted text-xs">
                {J.saveFirstAnswers}
              </span>
            )
          ) : null}
        </div>
      ))}
      {questions.length >= 2 ? (
        <p className="staff-hint m-0">{J.orderHint}</p>
      ) : null}
      <div>
        <button
          type="button"
          className="staff-btn"
          data-variant="quiet"
          data-size="sm"
          onClick={() =>
            onChange([
              ...questions,
              { clientId: clientId(), id: null, questionKey: "" },
            ])
          }
        >
          <Plus className="size-4" aria-hidden /> {J.addQuestion}
        </button>
      </div>
    </div>
  );
}

export default function JotformSetupPage() {
  const canManage = useCanManage();
  const { rowId } = useParams<{ rowId: string }>();
  const branches = useBranches();
  const areas = useActiveAreas();
  const invalidate = useInvalidate();
  const detail = useNcc<{ form: NccJotformFormDetailDto }>(
    `/api/ncc/settings/jotform/forms/${rowId}`
  );
  const form = detail.data?.form ?? null;

  const answersList = useNcc<{ items: NccJotformAnswerMapDto[] }>(
    form ? `/api/ncc/settings/jotform/answer-maps` : null,
    form ? { formId: form.formId } : undefined
  );
  const savedMaps = answersList.data?.items ?? [];

  const [draftFields, setDraftFields] = useState<DraftFields>({});
  const [draftDefaults, setDraftDefaults] = useState<DraftDefaults>({});
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{
    questions: string[];
    links: number;
  } | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Initialise the draft once the detail arrives (or after a re-save).
  useEffect(() => {
    if (!form) return;
    const fields = fieldsFromDetail(form);
    const defaults = defaultsFromDetail(form);
    setDraftFields(fields);
    setDraftDefaults(defaults);
    setBaseline(signature(fields, defaults));
    setSaveError(null);
    setToggleError(null);
  }, [form]);

  const dirty = useMemo(
    () =>
      baseline !== "" &&
      signature(draftFields, draftDefaults) !== baseline,
    [draftFields, draftDefaults, baseline]
  );

  const missingRequired = useMemo(() => {
    if (!form) return [];
    return form.catalogue
      .filter(input => input.required)
      .filter(
        input =>
          !(draftFields[input.key] ?? []).some(
            question => question.questionKey.trim()
          )
      )
      .map(input => inputLabel(input.key));
  }, [form, draftFields]);

  async function refresh() {
    await Promise.all([
      detail.mutate(),
      invalidate("/api/ncc/settings/jotform/answer-maps"),
    ]);
  }

  function collectUpstream() {
    const fields: Array<{
      id?: string;
      inputKey: string;
      questionKey: string;
      sortOrder: number;
    }> = [];
    for (const [inputKey, questions] of Object.entries(draftFields)) {
      questions.forEach((question, index) => {
        const key = question.questionKey.trim();
        if (!key) return;
        fields.push({
          ...(question.id ? { id: question.id } : {}),
          inputKey,
          questionKey: key,
          sortOrder: index,
        });
      });
    }
    const defaults = Object.entries(draftDefaults)
      .filter(([, value]) => value !== "")
      .map(([inputKey, value]) => ({ inputKey, value }));
    return { fields, defaults };
  }

  async function persist() {
    setSaving(true);
    setSaveError(null);
    try {
      await staffWrite(
        replaceNccJotformFormFieldsRequest(rowId, collectUpstream())
      );
      await refresh();
    } catch (error) {
      setSaveError(
        error instanceof StaffApiError
          ? error.message
          : "The request failed. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    if (!form) return;
    // Saved questions that are no longer in the draft lose their answer links.
    const keptIds = new Set(
      Object.values(draftFields)
        .flat()
        .map(question => question.id)
        .filter((id): id is string => Boolean(id))
    );
    const removed = form.fields.filter(field => !keptIds.has(field.id));
    const links = savedMaps.filter(map =>
      removed.some(field => field.id === map.fieldMapId)
    ).length;
    if (removed.length) {
      setRemoveConfirm({
        questions: removed.map(field => field.questionKey),
        links,
      });
      return;
    }
    void persist();
  }

  if (detail.error && !form) {
    return (
      <div className="flex flex-col gap-4 min-w-0">
        <PageHeader title={J.title} />
        {detail.error.status === 404 ? (
          <EmptyState title={J.notFound} />
        ) : detail.error.status === 403 ? (
          <EmptyState title={J.noAccess} />
        ) : (
          <ErrorState
            error={detail.error}
            onRetry={() => void detail.mutate()}
          />
        )}
      </div>
    );
  }
  if (!form) return <LoadingRows />;

  const required = form.catalogue.filter(input => input.required);
  const optional = form.catalogue.filter(input => !input.required);
  const toggleBlocked = dirty || missingRequired.length > 0;
  const toggleReason = dirty
    ? J.saveFirst
    : missingRequired.length
      ? J.missingRequired.replace("{inputs}", missingRequired.join(", "))
      : null;

  const matchedOf = (matched: number, total: number) =>
    J.matchedOf
      .replace("{matched}", String(matched))
      .replace("{total}", String(total));
  const isMatched = (key: string) =>
    (draftFields[key] ?? []).some(question => question.questionKey.trim());

  return (
    <div className="flex flex-col gap-4 min-w-0 pb-28">
      <PageHeader
        title={form.name}
        description={
          <>
            {J.formId}{" "}
            <span className="staff-ltr font-mono" dir="ltr">
              {form.formId}
            </span>{" "}
            · {J.creates}: {createsLabel(form.target)} · {J.fallbackBranch}:{" "}
            {form.fallbackBranchName || J.noFallback}
          </>
        }
        actions={
          <>
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
            <Link
              href={`/app/jotform/${form.id}/submissions`}
              className="staff-btn"
              data-variant="quiet"
              data-size="sm"
            >
              {J.submissions}
            </Link>
            {canManage ? (
              <button
                type="button"
                className="staff-btn"
                data-variant="quiet"
                data-size="sm"
                onClick={() => setEditOpen(true)}
              >
                {J.editDetails}
              </button>
            ) : null}
          </>
        }
      />

      <section className="staff-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="staff-section-title m-0">{J.statusTitle}</h2>
            <p className="staff-muted text-sm m-0">{J.statusHint}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="staff-muted text-sm">
              {form.enabled ? J.on : J.off}
            </span>
            <Switch
              checked={form.enabled}
              aria-label={J.statusTitle}
              disabled={!canManage || (toggleBlocked && !form.enabled)}
              onCheckedChange={enabled => {
                setToggleError(null);
                void runAction(
                  async () => {
                    await staffWrite(
                      patchNccJotformFormRequest(form.id, { enabled })
                    );
                    await detail.mutate();
                  },
                  {
                    success: enabled
                      ? S.enabledToast
                      : S.disabledToast,
                    onError: error =>
                      setToggleError(
                        error instanceof StaffApiError
                          ? error.message
                          : String(error)
                      ),
                  }
                );
              }}
            />
          </div>
        </div>
        {toggleReason ? (
          <p className="staff-hint mt-2" data-tone="caution" role="status">
            {toggleReason}
          </p>
        ) : null}
        {toggleError ? (
          <p className="staff-field-error mt-2" role="alert">
            {toggleError}
          </p>
        ) : null}
      </section>

      <section className="staff-card">
        <h2 className="m-0">{J.questions}</h2>
        <p className="staff-muted text-sm">
          {J.questionsHint
            .replace("{a}", "email")
            .replace("{b}", "q7_email")}
        </p>
        {(
          [
            [J.requiredLabel, required],
            [J.optionalLabel, optional],
          ] as const
        ).map(([groupLabel, inputs]) =>
          inputs.length ? (
            <div key={groupLabel} className="flex flex-col gap-4">
              <h3 className="staff-muted text-sm m-0 mt-2">
                {groupLabel} ·{" "}
                {matchedOf(
                  inputs.filter(input => isMatched(input.key)).length,
                  inputs.length
                )}
              </h3>
              {inputs.map(input => {
                const questions = draftFields[input.key] ?? [];
                const matched = isMatched(input.key);
                const defaultOptions = defaultOptionsFor(
                  input,
                  branches,
                  areas
                );
                return (
                  <div
                    key={input.key}
                    className="flex flex-col gap-2 border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="staff-field-label">
                        {inputLabel(input.key)}
                      </span>
                      <span
                        className="staff-badge"
                        data-tone={
                          matched
                            ? "green"
                            : input.required
                              ? "amber"
                              : "plain"
                        }
                      >
                        {matched ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : null}
                        {matched ? J.matched : J.notMatched}
                      </span>
                    </div>
                    <QuestionList
                      input={input}
                      questions={questions}
                      savedMaps={savedMaps}
                      form={form}
                      onAnswersChanged={refresh}
                      onChange={next =>
                        setDraftFields({
                          ...draftFields,
                          [input.key]: next,
                        })
                      }
                    />
                    {defaultOptions ? (
                      <label className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="staff-muted">
                          {J.defaultLabel}
                        </span>
                        <Select
                          value={draftDefaults[input.key] || NONE}
                          onValueChange={value =>
                            setDraftDefaults({
                              ...draftDefaults,
                              [input.key]: value === NONE ? "" : value,
                            })
                          }
                        >
                          <SelectTrigger
                            className="w-full sm:w-56 max-w-[22rem]"
                            aria-label={J.defaultLabel}
                          >
                            <SelectValue placeholder={J.noDefault} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>
                              {J.noDefault}
                            </SelectItem>
                            {defaultOptions.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null
        )}
      </section>

      {dirty ? (
        <div className="staff-dirtybar" role="status">
          <span>{J.unsaved}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="staff-btn"
              data-variant="quiet"
              disabled={saving}
              onClick={() => {
                const fields = fieldsFromDetail(form);
                const defaults = defaultsFromDetail(form);
                setDraftFields(fields);
                setDraftDefaults(defaults);
              }}
            >
              {J.discard}
            </button>
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              disabled={saving || !canManage}
              onClick={requestSave}
            >
              {saving ? copy.actions.saving : copy.actions.save}
            </button>
          </div>
        </div>
      ) : null}
      {saveError ? (
        <p className="staff-field-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <JotformFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        form={form}
        onSaved={async () => {
          await detail.mutate();
        }}
      />

      <ConfirmDialog
        open={removeConfirm !== null}
        onOpenChange={next => {
          if (!next) setRemoveConfirm(null);
        }}
        title={J.removeQuestionsTitle}
        description={`${removeConfirm?.questions.join(", ") ?? ""} — ${J.removeQuestionsBody
          .replace("{questions}", String(removeConfirm?.questions.length ?? 0))
          .replace("{links}", String(removeConfirm?.links ?? 0))}`}
        confirmLabel={copy.actions.save}
        destructive
        onConfirm={() => {
          setRemoveConfirm(null);
          void persist();
        }}
      />
    </div>
  );
}
