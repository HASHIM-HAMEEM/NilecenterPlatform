import { useEffect, useMemo, useState } from "react";
import {
  createNccLeadRequest,
  patchNccLeadRequest,
  type NccLeadDto,
  type NccLeadWriteInput,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { canSetAssignee } from "../roles";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { EMAIL_PATTERN, suggestedLeadType } from "../people-matches";
import { PossibleMatches, usePeopleMatches } from "../ui/possible-matches";
import { DateOfBirthField } from "../ui/date-of-birth-field";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { MultiSelect } from "../ui/multi-select";
import {
  useActiveAreas,
  useActiveCourses,
  useAssignees,
  useBranches,
} from "./admissions-ui";

const L = copy.admissions.leads;
const NONE = "__none";

export const LEAD_TYPES: NccLeadDto["leadType"][] = [
  "new",
  "old",
  "old_student",
  "current_student",
];

export function leadTypeLabel(type: NccLeadDto["leadType"]): string {
  if (type === "old") return L.typeOld;
  if (type === "old_student") return L.typeOldStudent;
  if (type === "current_student") return L.typeCurrentStudent;
  return L.typeNew;
}

export type LeadDraft = Draft;

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  branchId: string;
  wantsOnline: boolean;
  wantsOnsite: boolean;
  preferredCourseIds: string[];
  areaOfStudyId: string;
  source: string;
  notes: string;
  dateOfBirth: string;
  nationality: string;
  assignedSsaId: string;
  leadType: NccLeadDto["leadType"];
};

function draftFrom(lead: NccLeadDto | null, branchId: string): Draft {
  return {
    firstName: lead?.firstName ?? "",
    lastName: lead?.lastName ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    branchId: lead?.branchId ?? branchId,
    wantsOnline: lead?.wantsOnline ?? false,
    wantsOnsite: lead?.wantsOnsite ?? true,
    preferredCourseIds: lead?.preferredCourses.map(course => course.id) ?? [],
    areaOfStudyId: lead?.areaOfStudyId ?? "",
    source: lead?.source ?? "",
    notes: lead?.notes ?? "",
    dateOfBirth: lead?.dateOfBirth ?? "",
    nationality: lead?.nationality ?? "",
    assignedSsaId: lead?.assignedSsaId ?? "",
    leadType: lead?.leadType ?? "new",
  };
}

const blank = (value: string) => (value.trim() ? value.trim() : null);

/** Only the fields that changed, mapped to the BFF lead body. */
export function leadPatch(before: Draft, after: Draft): NccLeadWriteInput {
  const patch: NccLeadWriteInput = {};
  if (after.firstName.trim() !== before.firstName)
    patch.firstName = after.firstName.trim();
  if (after.lastName.trim() !== before.lastName)
    patch.lastName = after.lastName.trim();
  if (after.email.trim() !== before.email) patch.email = after.email.trim();
  if (after.phone.trim() !== before.phone) patch.phone = blank(after.phone);
  if (after.wantsOnline !== before.wantsOnline)
    patch.wantsOnline = after.wantsOnline;
  if (after.wantsOnsite !== before.wantsOnsite)
    patch.wantsOnsite = after.wantsOnsite;
  if (after.preferredCourseIds.join() !== before.preferredCourseIds.join()) {
    patch.preferredCourseIds = after.preferredCourseIds;
  }
  if (after.areaOfStudyId !== before.areaOfStudyId) {
    patch.areaOfStudyId = after.areaOfStudyId || null;
  }
  if (after.source.trim() !== before.source) patch.source = blank(after.source);
  if (after.notes.trim() !== before.notes) patch.notes = blank(after.notes);
  if (after.dateOfBirth !== before.dateOfBirth) {
    patch.dateOfBirth = after.dateOfBirth || null;
  }
  if (after.nationality !== before.nationality) {
    patch.nationality = after.nationality || null;
  }
  if (after.assignedSsaId !== before.assignedSsaId) {
    patch.assignedSsaId = after.assignedSsaId || null;
  }
  if (after.leadType !== before.leadType) patch.leadType = after.leadType;
  return patch;
}

export function LeadForm({
  open,
  onOpenChange,
  lead,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: NccLeadDto | null;
  /** Starting values for a new lead, e.g. from a form response. */
  prefill?: Partial<Draft>;
  onSaved?: (lead: NccLeadDto) => void;
}) {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const workspaceBranchId = session?.ncc?.workspaceBranchId ?? "";
  const pickBranch = role === "super_admin";
  const invalidate = useInvalidate();
  const branches = useBranches();
  const courses = useActiveCourses(open);
  const areas = useActiveAreas(open);

  const initial = useMemo(
    () => ({ ...draftFrom(lead, workspaceBranchId), ...(lead ? {} : prefill) }),
    [lead, workspaceBranchId, prefill]
  );
  const [draft, setDraft] = useState<Draft>(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  const assignees = useAssignees(draft.branchId, open && canSetAssignee(role));

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open, initial]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(current => ({ ...current, [key]: value }));

  const errors = {
    firstName: draft.firstName.trim() ? null : L.required,
    lastName: draft.lastName.trim() ? null : L.required,
    email: !draft.email.trim()
      ? L.required
      : EMAIL_PATTERN.test(draft.email.trim())
        ? null
        : L.invalidEmail,
    branchId: pickBranch && !draft.branchId && !lead ? L.chooseBranch : null,
    nationality:
      draft.nationality && !/^[A-Z]{3}$/.test(draft.nationality)
        ? copy.admissions.identity.invalidNationality
        : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  // New leads check email and name; an edit only rechecks a changed email.
  const emailChanged = draft.email.trim() !== initial.email.trim();
  const people = usePeopleMatches(
    {
      email: lead && !emailChanged ? "" : draft.email,
      firstName: lead ? "" : draft.firstName,
      lastName: lead ? "" : draft.lastName,
    },
    {
      enabled: open,
      exclude: { leadId: lead?.id, studentId: lead?.studentId },
      byName: !lead,
    }
  );
  const returning = suggestedLeadType(people.matches);
  // EMS keeps one lead per email (any status), so this cannot be saved.
  const leadTaken = people.matches.some(
    match => match.kind === "lead" && match.strength === "email"
  );

  async function submit() {
    setAttempted(true);
    if (invalid || leadTaken) throw new FormValidationError();
    setSaving(true);
    setFieldErrors(undefined);
    try {
      let saved: NccLeadDto;
      if (lead) {
        const patch = leadPatch(initial, draft);
        saved = Object.keys(patch).length
          ? (await staffWrite(patchNccLeadRequest(lead.id, patch))).lead
          : lead;
      } else {
        saved = (
          await staffWrite(
            createNccLeadRequest({
              firstName: draft.firstName.trim(),
              lastName: draft.lastName.trim(),
              email: draft.email.trim(),
              phone: blank(draft.phone),
              wantsOnline: draft.wantsOnline,
              wantsOnsite: draft.wantsOnsite,
              preferredCourseIds: draft.preferredCourseIds,
              source: blank(draft.source),
              notes: blank(draft.notes),
              ...(draft.dateOfBirth
                ? { dateOfBirth: draft.dateOfBirth }
                : {}),
              ...(draft.nationality
                ? { nationality: draft.nationality }
                : {}),
              leadType: draft.leadType,
              ...(draft.areaOfStudyId
                ? { areaOfStudyId: draft.areaOfStudyId }
                : {}),
              ...(draft.assignedSsaId
                ? { assignedSsaId: draft.assignedSsaId }
                : {}),
              ...(pickBranch ? { branchId: draft.branchId } : {}),
            })
          )
        ).lead;
      }
      await invalidate("/api/ncc/admissions/leads");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> }).details;
      if (details) setFieldErrors(details);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  const show = (message: string | null) => (attempted ? message : null);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={lead ? L.editTitle : L.createTitle}
      description={lead ? L.editDescription : L.createDescription}
      dirty={dirty}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={
        lead
          ? copy.catalog.shared.saveChanges
          : people.strong && !leadTaken
            ? copy.admissions.matches.createAnyway
            : L.createSubmit
      }
      onSubmit={() =>
        runAction(submit, { success: lead ? L.updatedToast : L.createdToast })
      }
    >
      {errorFor => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StaffField
              label={L.firstName}
              htmlFor="lead-first"
              error={show(errors.firstName) ?? errorFor("first_name")}
            >
              <input
                id="lead-first"
                className="staff-input"
                value={draft.firstName}
                autoComplete="given-name"
                onChange={event => set("firstName", event.target.value)}
              />
            </StaffField>
            <StaffField
              label={L.lastName}
              htmlFor="lead-last"
              error={show(errors.lastName) ?? errorFor("last_name")}
            >
              <input
                id="lead-last"
                className="staff-input"
                value={draft.lastName}
                autoComplete="family-name"
                onChange={event => set("lastName", event.target.value)}
              />
            </StaffField>
          </div>
          <StaffField
            label={L.email}
            htmlFor="lead-email"
            error={
              (leadTaken ? copy.admissions.matches.leadTaken : null) ??
              show(errors.email) ??
              errorFor("email")
            }
          >
            <input
              id="lead-email"
              type="email"
              className="staff-input staff-ltr"
              value={draft.email}
              autoComplete="email"
              onChange={event => set("email", event.target.value)}
            />
          </StaffField>
          <PossibleMatches
            matches={people.matches}
            context={leadTaken ? "leadTaken" : "lead"}
            action={
              returning && !leadTaken && draft.leadType !== returning ? (
                <button
                  type="button"
                  className="staff-btn"
                  data-size="sm"
                  onClick={() => set("leadType", returning)}
                >
                  {copy.admissions.matches.markReturning}
                </button>
              ) : null
            }
          />
          <StaffField
            label={L.phone}
            htmlFor="lead-phone"
            error={errorFor("phone")}
          >
            <input
              id="lead-phone"
              type="tel"
              className="staff-input staff-ltr"
              value={draft.phone}
              autoComplete="tel"
              onChange={event => set("phone", event.target.value)}
            />
          </StaffField>
          <div className="grid grid-cols-2 gap-3">
            <DateOfBirthField
              label={L.dateOfBirth}
              value={draft.dateOfBirth}
              onChange={value => set("dateOfBirth", value)}
              error={errorFor("date_of_birth")}
              optional
            />
            <StaffField
              label={L.nationality}
              htmlFor="lead-nationality"
              error={show(errors.nationality) ?? errorFor("nationality")}
            >
              <input
                id="lead-nationality"
                className="staff-input staff-ltr"
                maxLength={3}
                placeholder="EGY"
                value={draft.nationality}
                onChange={event =>
                  set("nationality", event.target.value.toUpperCase())
                }
              />
            </StaffField>
          </div>

          {pickBranch && !lead ? (
            <StaffField label={L.branch} error={show(errors.branchId)}>
              <Select
                value={draft.branchId || undefined}
                onValueChange={value => set("branchId", value)}
              >
                <SelectTrigger aria-label={L.branch}>
                  <SelectValue placeholder={L.chooseBranch} />
                </SelectTrigger>
                <SelectContent>
                  {branches.active.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.isOnline
                        ? ` · ${copy.admissions.mode.online}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}

          <fieldset className="staff-field">
            <legend className="staff-field-label">
              {copy.admissions.mode.label}
            </legend>
            <div className="staff-check-row">
              <label className="staff-check">
                <input
                  type="checkbox"
                  checked={draft.wantsOnsite}
                  onChange={event => set("wantsOnsite", event.target.checked)}
                />
                {L.wantsOnsite}
              </label>
              <label className="staff-check">
                <input
                  type="checkbox"
                  checked={draft.wantsOnline}
                  onChange={event => set("wantsOnline", event.target.checked)}
                />
                {L.wantsOnline}
              </label>
            </div>
          </fieldset>

          <StaffField
            label={L.preferredCourses}
            error={errorFor("preferred_course_ids")}
          >
            <MultiSelect
              options={courses}
              value={draft.preferredCourseIds}
              onChange={value => set("preferredCourseIds", value)}
              allLabel={L.anyCourse}
              noun={L.coursesNoun}
              ariaLabel={L.preferredCourses}
            />
          </StaffField>

          <StaffField
            label={L.areaOfStudy}
            error={errorFor("area_of_study_id")}
          >
            <Select
              value={draft.areaOfStudyId || NONE}
              onValueChange={value =>
                set("areaOfStudyId", value === NONE ? "" : value)
              }
            >
              <SelectTrigger aria-label={L.areaOfStudy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{L.noArea}</SelectItem>
                {areas.map(area => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StaffField>

          {canSetAssignee(role) ? (
            <StaffField label={L.owner} error={errorFor("assigned_ssa_id")}>
              <Select
                value={draft.assignedSsaId || NONE}
                onValueChange={value =>
                  set("assignedSsaId", value === NONE ? "" : value)
                }
              >
                <SelectTrigger aria-label={L.owner}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{L.unassigned}</SelectItem>
                  {assignees.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <StaffField label={L.leadType}>
              <Select
                value={draft.leadType}
                onValueChange={value =>
                  set("leadType", value as Draft["leadType"])
                }
              >
                <SelectTrigger aria-label={L.leadType}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {leadTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
            <StaffField
              label={L.source}
              htmlFor="lead-source"
              error={errorFor("source")}
            >
              <input
                id="lead-source"
                className="staff-input"
                value={draft.source}
                placeholder={L.sourceHint}
                onChange={event => set("source", event.target.value)}
              />
            </StaffField>
          </div>
          <StaffField
            label={L.notes}
            htmlFor="lead-notes"
            error={errorFor("notes")}
          >
            <textarea
              id="lead-notes"
              className="staff-input"
              rows={3}
              value={draft.notes}
              onChange={event => set("notes", event.target.value)}
            />
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}
