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
    createId: (prefix: string) => `${prefix}_roster_${++sequence}`,
    now: () => "2026-07-11T12:00:00.000Z",
  };
}

function apply(state: PlatformState, action: PlatformWorkflowAction) {
  return applyPlatformWorkflowAction(state, action, context());
}

function addCairoTarget(state: PlatformState, overrides: Partial<PlatformState["classGroups"][number]> = {}) {
  state.classGroups.push({
    id: "class_ar_l3_cairo_transfer_qa",
    courseRunId: "run_ar_l3_cairo_2026",
    name: "Arabic L3 Cairo Evening",
    capacity: 12,
    schedule: "Wed 18:00",
    roomId: "room_cairo_4",
    studentIds: [],
    status: "active",
    ...overrides,
  });
}

function expectRejectedWithoutMutation(
  state: PlatformState,
  action: PlatformWorkflowAction,
  message: string
) {
  const before = JSON.stringify(state);
  expect(() => apply(state, action)).toThrow(message);
  expect(JSON.stringify(state)).toBe(before);
}

describe("enrollment and roster transition integrity", () => {
  it("transfers one enrollment atomically inside its course run", () => {
    const state = cloneState();
    addCairoTarget(state);
    const attendanceBefore = JSON.stringify(state.attendance);
    state.enrollmentWorkflows.push({
      id: "ew_cairo_transfer",
      studentId: "stu_cairo_demo",
      targetCourseId: "course_ar_l3",
      courseRunId: "run_ar_l3_cairo_2026",
      classGroupId: "class_ar_l3_cairo",
      status: "active",
      nextStep: "Portal active",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const result = apply(state, {
      type: "enrollment.transfer",
      enrollmentId: "enr_ar_l3_cairo",
      classGroupId: "class_ar_l3_cairo_transfer_qa",
      reason: "Schedule change",
      actorId: "usr_registrar_demo",
    }).result as { enrollment: PlatformState["enrollments"][number] };

    expect(result.enrollment).toMatchObject({
      id: "enr_ar_l3_cairo",
      courseRunId: "run_ar_l3_cairo_2026",
      classGroupId: "class_ar_l3_cairo_transfer_qa",
      teacherId: "usr_teacher_demo",
      status: "active",
    });
    expect(
      state.classGroups.find(item => item.id === "class_ar_l3_cairo")?.studentIds
    ).not.toContain("stu_cairo_demo");
    expect(
      state.classGroups.find(item => item.id === "class_ar_l3_cairo_transfer_qa")?.studentIds
    ).toEqual(["stu_cairo_demo"]);
    expect(state.enrollmentWorkflows.find(item => item.id === "ew_cairo_transfer")).toMatchObject({
      classGroupId: "class_ar_l3_cairo_transfer_qa",
      nextStep: "Enrollment active in Arabic L3 Cairo Evening",
    });
    expect(JSON.stringify(state.attendance)).toBe(attendanceBefore);
    expect(state.auditLogs[0]).toMatchObject({
      action: "enrollment.transferred",
      entityType: "Enrollment",
      entityId: "enr_ar_l3_cairo",
      actorId: "usr_registrar_demo",
    });
    expect(state.notifications[0]).toMatchObject({
      userId: "usr_student_cairo_demo",
      title: "Class assignment updated",
    });
  });

  it.each([
    {
      label: "different course run",
      target: { courseRunId: "run_ar_l3_2026" },
      message: "Enrollment transfers must remain inside the same course run.",
    },
    {
      label: "full class",
      target: { capacity: 1, studentIds: ["stu_demo"] },
      message: "Class group class_ar_l3_cairo_transfer_qa is full.",
    },
    {
      label: "inactive class",
      target: { status: "paused" as const },
      message: "Enrollment transfer requires an active target class.",
    },
  ])("rejects transfer to a $label without mutation", ({ target, message }) => {
    const state = cloneState();
    addCairoTarget(state, target);
    expectRejectedWithoutMutation(
      state,
      {
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        reason: "QA transfer",
        actorId: "usr_registrar_demo",
      },
      message
    );
  });

  it("pauses one enrollment without pausing a student who has another active enrollment", () => {
    const state = cloneState();
    apply(state, {
      type: "enrollment.status.update",
      enrollmentId: "enr_ar_l3",
      status: "paused",
      reason: "Temporary schedule pause",
      actorId: "usr_registrar_demo",
    });

    expect(state.enrollments.find(item => item.id === "enr_ar_l3")?.status).toBe("paused");
    expect(state.students.find(item => item.id === "stu_demo")?.status).toBe("active");
    expect(state.users.find(item => item.id === "usr_student_demo")?.status).toBe("active");
    expect(state.classGroups.find(item => item.id === "class_ar_l3_a")?.studentIds).toContain("stu_demo");
    expect(state.auditLogs[0]).toMatchObject({
      action: "enrollment.status_updated",
      entityId: "enr_ar_l3",
    });
  });

  it("resumes a paused enrollment and restores aggregate student access", () => {
    const state = cloneState();
    apply(state, {
      type: "enrollment.status.update",
      enrollmentId: "enr_ar_l3_paused",
      status: "active",
      actorId: "usr_registrar_demo",
    });
    expect(state.enrollments.find(item => item.id === "enr_ar_l3_paused")?.status).toBe("active");
    expect(state.students.find(item => item.id === "stu_paused_demo")?.status).toBe("active");
    expect(state.users.find(item => item.id === "usr_student_paused_demo")?.status).toBe("active");
  });

  it("completes only a fully progressed enrollment and keeps historical roster membership", () => {
    const state = cloneState();
    state.enrollments = state.enrollments.map(item =>
      item.id === "enr_ar_l3_cairo" ? { ...item, progress: 100 } : item
    );
    apply(state, {
      type: "enrollment.status.update",
      enrollmentId: "enr_ar_l3_cairo",
      status: "completed",
      actorId: "usr_registrar_demo",
    });
    expect(state.enrollments.find(item => item.id === "enr_ar_l3_cairo")?.status).toBe("completed");
    expect(state.students.find(item => item.id === "stu_cairo_demo")?.status).toBe("completed");
    expect(state.classGroups.find(item => item.id === "class_ar_l3_cairo")?.studentIds).toContain("stu_cairo_demo");
  });

  it("cancels an enrollment with a reason and removes active roster membership", () => {
    const state = cloneState();
    apply(state, {
      type: "enrollment.status.update",
      enrollmentId: "enr_ar_l3_cairo",
      status: "cancelled",
      reason: "Learner withdrew",
      actorId: "usr_registrar_demo",
    });
    expect(state.enrollments.find(item => item.id === "enr_ar_l3_cairo")?.status).toBe("cancelled");
    expect(state.students.find(item => item.id === "stu_cairo_demo")?.status).toBe("cancelled");
    expect(state.classGroups.find(item => item.id === "class_ar_l3_cairo")?.studentIds).not.toContain("stu_cairo_demo");
  });

  it("rejects incomplete completion and terminal replay without mutation", () => {
    const state = cloneState();
    expectRejectedWithoutMutation(
      state,
      {
        type: "enrollment.status.update",
        enrollmentId: "enr_ar_l3_cairo",
        status: "completed",
        actorId: "usr_registrar_demo",
      },
      "Enrollment progress must reach 100% before completion."
    );
    expectRejectedWithoutMutation(
      state,
      {
        type: "enrollment.status.update",
        enrollmentId: "enr_ar_l3_completed",
        status: "active",
        actorId: "usr_registrar_demo",
      },
      "Completed or cancelled enrollments are terminal."
    );
  });
});
