import { describe, expect, it } from "vitest";
import { LEAD_STAGES } from "./pages/leads-page";
import {
  dropAction,
  moveTargets,
  nextBookingByLead,
  quietDays,
} from "./pipeline";

const lead = (status: Parameters<typeof dropAction>[0]["status"], studentId: string | null = null) => ({
  status,
  studentId,
});

describe("dropAction", () => {
  it("sets the stages EMS accepts directly", () => {
    expect(dropAction(lead("in_process"), "follow_up")).toEqual({ type: "patch", status: "follow_up", reopen: false });
    expect(dropAction(lead("follow_up"), "future_registration")).toMatchObject({ type: "patch" });
  });

  it("reopens a lost lead when it is moved to an open stage", () => {
    expect(dropAction(lead("lost"), "in_process")).toEqual({ type: "patch", status: "in_process", reopen: true });
  });

  it("asks for a reason before Lost, and books before test or trial", () => {
    expect(dropAction(lead("in_process"), "lost")).toEqual({ type: "lost" });
    expect(dropAction(lead("in_process"), "placement_test")).toEqual({ type: "book", kind: "placement" });
    expect(dropAction(lead("follow_up"), "trial_lesson")).toEqual({ type: "book", kind: "trial" });
  });

  it("never makes a lead registered, and never moves a lead that is already a student", () => {
    expect(dropAction(lead("follow_up"), "registered")).toEqual({ type: "blocked" });
    expect(dropAction(lead("registered", "s1"), "follow_up")).toEqual({ type: "blocked" });
    expect(dropAction(lead("follow_up"), "follow_up")).toEqual({ type: "none" });
  });
});

describe("moveTargets", () => {
  it("lists every stage a lead may go to, in board order", () => {
    expect(moveTargets(lead("in_process"), LEAD_STAGES)).toEqual([
      "follow_up",
      "placement_test",
      "trial_lesson",
      "future_registration",
      "lost",
    ]);
    expect(moveTargets(lead("registered", "s1"), LEAD_STAGES)).toEqual([]);
  });
});

describe("quietDays", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  it("flags open leads untouched for a week or more", () => {
    expect(quietDays({ status: "follow_up", updatedAt: "2026-10-08T12:00:00Z" }, now)).toBe(12);
    expect(quietDays({ status: "follow_up", updatedAt: "2026-10-15T12:00:00Z" }, now)).toBeNull();
  });
  it("ignores leads waiting on a booking, closed leads and bad dates", () => {
    expect(quietDays({ status: "trial_lesson", updatedAt: "2026-09-01T12:00:00Z" }, now)).toBeNull();
    expect(quietDays({ status: "lost", updatedAt: "2026-09-01T12:00:00Z" }, now)).toBeNull();
    expect(quietDays({ status: "in_process", updatedAt: "not a date" }, now)).toBeNull();
  });
});

describe("nextBookingByLead", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const booking = (id: string, scheduledAt: string | null, status = "scheduled", type = "lead") => ({
    status: status as "scheduled",
    scheduledAt,
    subject: { type: type as "lead", id, name: "", email: "" },
  });
  it("keeps each lead's earliest upcoming scheduled test or trial", () => {
    const next = nextBookingByLead(
      [booking("a", "2026-10-25T09:00:00Z"), booking("a", "2026-10-19T09:00:00Z")],
      [booking("a", "2026-10-22T09:00:00Z"), booking("b", "2026-10-30T09:00:00Z", "cancelled"), booking("c", "2026-10-30T09:00:00Z", "scheduled", "student")],
      now
    );
    expect(next.get("a")).toEqual({ kind: "trial", scheduledAt: "2026-10-22T09:00:00Z" });
    expect(next.has("b")).toBe(false);
    expect(next.has("c")).toBe(false);
  });
});
