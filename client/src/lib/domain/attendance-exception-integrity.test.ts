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
    createId: (prefix: string) =>
      `${prefix}_attendance_exception_${++sequence}`,
    now: () => "2026-07-11T14:00:00.000Z",
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

describe("attendance-exception lifecycle integrity", () => {
  it("submits an exact absent record with notification and audit evidence", () => {
    const state = cloneState();
    const result = apply(state, {
      type: "attendance.exception.submit",
      attendanceRecordId: "att_ar_online_absence",
      studentId: "stu_demo",
      reason: "Medical appointment prevented attendance.",
      actorId: "usr_student_demo",
    }).result as PlatformState["attendanceExceptions"][number];

    expect(result).toMatchObject({
      attendanceRecordId: "att_ar_online_absence",
      studentId: "stu_demo",
      classGroupId: "class_ar_l3_a",
      sessionId: "session_ar_online_absence",
      status: "pending",
    });
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_teacher_demo",
        title: "Attendance exception submitted",
      })
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "attendance_exception.submitted",
      entityType: "AttendanceExceptionRequest",
      entityId: result.id,
      actorId: "usr_student_demo",
    });
  });

  it("approves a pending request and updates attendance and enrollment metrics atomically", () => {
    const state = cloneState();
    const beforeRate = state.enrollments.find(
      item => item.id === "enr_ar_l3_cairo"
    )?.attendanceRate;
    const result = apply(state, {
      type: "attendance.exception.review",
      requestId: "aex_cairo_pending",
      decision: "approved",
      reviewNote: "Evidence reviewed by branch operations.",
      actorId: "usr_branch_demo",
    }).result as {
      request: PlatformState["attendanceExceptions"][number];
      attendance: PlatformState["attendance"][number];
    };

    expect(result.request).toMatchObject({
      status: "approved",
      reviewedBy: "usr_branch_demo",
    });
    expect(result.attendance).toMatchObject({ status: "excused" });
    expect(result.attendance.notes).toContain("Excuse approved");
    expect(
      state.enrollments.find(item => item.id === "enr_ar_l3_cairo")
        ?.attendanceRate
    ).toBeGreaterThan(beforeRate ?? 0);
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_cairo_demo",
        title: "Attendance exception approved",
      })
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "attendance_exception.approved",
      entityId: "aex_cairo_pending",
    });
  });

  it("rejects a request without changing attendance or enrollment metrics", () => {
    const state = cloneState();
    const attendanceBefore = JSON.stringify(state.attendance);
    const enrollmentsBefore = JSON.stringify(state.enrollments);
    apply(state, {
      type: "attendance.exception.review",
      requestId: "aex_cairo_pending",
      decision: "rejected",
      reviewNote: "Evidence does not support an exception.",
      actorId: "usr_branch_demo",
    });

    expect(JSON.stringify(state.attendance)).toBe(attendanceBefore);
    expect(JSON.stringify(state.enrollments)).toBe(enrollmentsBefore);
    expect(
      state.attendanceExceptions.find(item => item.id === "aex_cairo_pending")
    ).toMatchObject({ status: "rejected" });
  });

  it.each([
    {
      label: "another student's record",
      mutate: (_state: PlatformState) => undefined,
      action: {
        type: "attendance.exception.submit" as const,
        attendanceRecordId: "att_ar_cairo_exception",
        studentId: "stu_demo",
        reason: "Attempt to claim another learner record.",
        actorId: "usr_student_demo",
      },
      message: "Students can only request exceptions for their own attendance.",
    },
    {
      label: "present record",
      mutate: (_state: PlatformState) => undefined,
      action: {
        type: "attendance.exception.submit" as const,
        attendanceRecordId: "att_ar_1",
        studentId: "stu_demo",
        reason: "Present attendance should not be changed.",
        actorId: "usr_student_demo",
      },
      message:
        "Only an absent or late record can receive an exception request.",
    },
    {
      label: "duplicate pending request",
      mutate: (state: PlatformState) => {
        state.attendanceExceptions.push({
          id: "aex_duplicate",
          attendanceRecordId: "att_ar_online_absence",
          studentId: "stu_demo",
          classGroupId: "class_ar_l3_a",
          sessionId: "session_ar_online_absence",
          reason: "Existing request",
          status: "pending",
          submittedAt: "2026-07-10T00:00:00.000Z",
        });
      },
      action: {
        type: "attendance.exception.submit" as const,
        attendanceRecordId: "att_ar_online_absence",
        studentId: "stu_demo",
        reason: "A second request must be rejected.",
        actorId: "usr_student_demo",
      },
      message: "An attendance exception is already pending for this record.",
    },
  ])("rejects $label without mutation", ({ mutate, action, message }) => {
    const state = cloneState();
    mutate(state);
    expectDeniedWithoutMutation(state, action, message);
  });

  it("rejects terminal review replay without mutation", () => {
    const state = cloneState();
    state.attendanceExceptions.find(
      item => item.id === "aex_cairo_pending"
    )!.status = "approved";
    expectDeniedWithoutMutation(
      state,
      {
        type: "attendance.exception.review",
        requestId: "aex_cairo_pending",
        decision: "rejected",
        reviewNote: "Attempt to replay terminal review.",
        actorId: "usr_branch_demo",
      },
      "Only a pending attendance exception can be reviewed."
    );
  });
});
