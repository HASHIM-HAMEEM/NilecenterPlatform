import type {
  NccLeadDto,
  NccPlacementTestDto,
  NccTrialLessonDto,
} from "@/lib/backend/api";

export type LeadStage = NccLeadDto["status"];

/** Stages staff can set directly; EMS accepts these in a lead PATCH. */
const SETTABLE: LeadStage[] = ["in_process", "follow_up", "future_registration"];

/**
 * What dropping a lead on a stage does, following EMS rules checked on
 * staging: booking a test or trial moves the lead there by itself (so the
 * drop opens the booking sheet), "registered" only happens when a lead
 * becomes a student, and "lost" needs a reason. A registered lead is a
 * student already and stays put.
 */
export type DropAction =
  | { type: "none" }
  | { type: "blocked" }
  | { type: "patch"; status: LeadStage; reopen: boolean }
  | { type: "lost" }
  | { type: "book"; kind: "placement" | "trial" };

export function dropAction(
  lead: Pick<NccLeadDto, "status" | "studentId">,
  to: LeadStage
): DropAction {
  if (lead.status === to) return { type: "none" };
  if (lead.status === "registered" || lead.studentId) return { type: "blocked" };
  if (to === "registered") return { type: "blocked" };
  if (to === "lost") return { type: "lost" };
  if (to === "placement_test") return { type: "book", kind: "placement" };
  if (to === "trial_lesson") return { type: "book", kind: "trial" };
  if (SETTABLE.includes(to))
    return { type: "patch", status: to, reopen: lead.status === "lost" };
  return { type: "blocked" };
}

/** Stages a lead can be moved to from its menu (the same rules, as a list). */
export function moveTargets(
  lead: Pick<NccLeadDto, "status" | "studentId">,
  stages: readonly LeadStage[]
): LeadStage[] {
  return stages.filter(stage => {
    const action = dropAction(lead, stage);
    return action.type !== "none" && action.type !== "blocked";
  });
}

/** Stages where a lead is waiting on staff, so silence is worth flagging. */
const OPEN: LeadStage[] = ["in_process", "follow_up", "future_registration"];
export const QUIET_AFTER_DAYS = 7;

/** Whole days since the lead last changed, when it is open and quiet. */
export function quietDays(
  lead: Pick<NccLeadDto, "status" | "updatedAt">,
  now = Date.now()
): number | null {
  if (!OPEN.includes(lead.status)) return null;
  const changed = Date.parse(lead.updatedAt);
  if (Number.isNaN(changed)) return null;
  const days = Math.floor((now - changed) / 864e5);
  return days >= QUIET_AFTER_DAYS ? days : null;
}

export type NextBooking = { kind: "placement" | "trial"; scheduledAt: string };

/** Each lead's earliest upcoming scheduled test or trial. */
export function nextBookingByLead(
  placements: Array<Pick<NccPlacementTestDto, "status" | "scheduledAt" | "subject">>,
  trials: Array<Pick<NccTrialLessonDto, "status" | "scheduledAt" | "subject">>,
  now = Date.now()
): Map<string, NextBooking> {
  const next = new Map<string, NextBooking>();
  const consider = (
    kind: NextBooking["kind"],
    item: { status: string; scheduledAt: string | null; subject: { type: string; id: string } }
  ) => {
    if (item.status !== "scheduled" || !item.scheduledAt) return;
    if (item.subject.type !== "lead") return;
    if (Date.parse(item.scheduledAt) < now) return;
    const seen = next.get(item.subject.id);
    if (!seen || item.scheduledAt < seen.scheduledAt)
      next.set(item.subject.id, { kind, scheduledAt: item.scheduledAt });
  };
  placements.forEach(item => consider("placement", item));
  trials.forEach(item => consider("trial", item));
  return next;
}
