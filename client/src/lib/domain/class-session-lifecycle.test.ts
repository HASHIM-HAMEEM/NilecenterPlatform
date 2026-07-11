import { describe, expect, it } from "vitest";
import {
  applyPlatformWorkflowAction,
  type PlatformWorkflowAction,
} from "./actions";
import { seedPlatformState } from "./seed";
import type { PlatformState } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function context() {
  let sequence = 0;
  return {
    createId: (prefix: string) => `${prefix}_session_lifecycle_${++sequence}`,
    now: () => "2026-07-11T12:00:00.000Z",
  };
}

function apply(state: PlatformState, action: PlatformWorkflowAction) {
  return applyPlatformWorkflowAction(state, action, context());
}

function expectDeniedWithoutMutation(
  state: PlatformState,
  action: PlatformWorkflowAction,
  message: string
) {
  const before = JSON.stringify(state);
  expect(() => apply(state, action)).toThrow(message);
  expect(JSON.stringify(state)).toBe(before);
}

describe("class-session lifecycle integrity", () => {
  it("reschedules the paired event and session atomically and notifies the roster", () => {
    const state = cloneState();
    const result = apply(state, {
      type: "class.session.reschedule",
      sessionId: "session_ar_cairo_upcoming",
      startsAt: "2026-07-05T15:00:00+03:00",
      endsAt: "2026-07-05T16:00:00+03:00",
      roomId: "room_cairo_4",
      reason: "Teacher requested a revised class time",
      actorId: "usr_branch_demo",
    }).result as {
      session: PlatformState["classSessions"][number];
      event: PlatformState["events"][number];
    };

    expect(result.session).toMatchObject({
      startsAt: "2026-07-05T15:00:00+03:00",
      endsAt: "2026-07-05T16:00:00+03:00",
      status: "active",
    });
    expect(result.event).toMatchObject({
      id: "evt_ar_cairo_upcoming",
      startsAt: result.session.startsAt,
      endsAt: result.session.endsAt,
      roomId: "room_cairo_4",
      status: "active",
    });
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_cairo_demo",
        title: "Class rescheduled",
        href: "/app/student/calendar",
      })
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "class_session.rescheduled",
      entityType: "ClassSession",
      entityId: "session_ar_cairo_upcoming",
      actorId: "usr_branch_demo",
    });
  });

  it("cancels both rows while retaining the session as schedule history", () => {
    const state = cloneState();
    apply(state, {
      type: "class.session.cancel",
      sessionId: "session_ar_cairo_upcoming",
      reason: "Branch closure requires cancellation",
      actorId: "usr_branch_demo",
    });

    expect(
      state.classSessions.find(item => item.id === "session_ar_cairo_upcoming")
    ).toMatchObject({ status: "cancelled", eventId: "evt_ar_cairo_upcoming" });
    expect(
      state.events.find(item => item.id === "evt_ar_cairo_upcoming")
    ).toMatchObject({
      status: "cancelled",
    });
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_cairo_demo",
        title: "Class cancelled",
      })
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "class_session.cancelled",
      entityId: "session_ar_cairo_upcoming",
    });
  });

  it.each([
    {
      label: "saved attendance",
      mutate: (_state: PlatformState) => undefined,
      action: {
        type: "class.session.cancel" as const,
        sessionId: "session_ar_live",
        reason: "Attempt to cancel historical session",
        actorId: "usr_teacher_demo",
      },
      message: "A session with attendance cannot be rescheduled or cancelled.",
    },
    {
      label: "teacher availability gap",
      mutate: (_state: PlatformState) => undefined,
      action: {
        type: "class.session.reschedule" as const,
        sessionId: "session_ar_cairo_upcoming",
        startsAt: "2026-07-07T15:00:00+03:00",
        endsAt: "2026-07-07T16:00:00+03:00",
        roomId: "room_cairo_4",
        reason: "Move outside teacher availability",
        actorId: "usr_branch_demo",
      },
      message: "Teacher is not available",
    },
    {
      label: "room conflict",
      mutate: (state: PlatformState) => {
        state.events.push({
          id: "evt_session_conflict",
          type: "room_booking",
          title: "Room reservation",
          startsAt: "2026-07-05T15:00:00+03:00",
          endsAt: "2026-07-05T16:00:00+03:00",
          ownerId: "usr_branch_demo",
          branchId: "br_cairo",
          roomId: "room_cairo_4",
          status: "active",
        });
      },
      action: {
        type: "class.session.reschedule" as const,
        sessionId: "session_ar_cairo_upcoming",
        startsAt: "2026-07-05T15:00:00+03:00",
        endsAt: "2026-07-05T16:00:00+03:00",
        roomId: "room_cairo_4",
        reason: "Move into a conflicting reservation",
        actorId: "usr_branch_demo",
      },
      message: "Class-session time conflicts with Room reservation.",
    },
  ])("rejects $label without mutation", ({ mutate, action, message }) => {
    const state = cloneState();
    mutate(state);
    expectDeniedWithoutMutation(state, action, message);
  });

  it("requires a meaningful reason for either lifecycle transition", () => {
    const state = cloneState();
    expectDeniedWithoutMutation(
      state,
      {
        type: "class.session.cancel",
        sessionId: "session_ar_cairo_upcoming",
        reason: "no",
        actorId: "usr_branch_demo",
      },
      "Cancellation reason must be at least 5 characters."
    );
  });
});
