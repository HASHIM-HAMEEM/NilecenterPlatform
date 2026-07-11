import { describe, expect, it } from "vitest";
import {
  applyPlatformWorkflowAction,
  type PlatformWorkflowAction,
} from "./actions";
import { seedPlatformState } from "./seed";
import type { Assignment, PlatformState } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function context() {
  let sequence = 0;
  return {
    createId: (prefix: string) => `${prefix}_assignment_lifecycle_${++sequence}`,
    now: () => "2026-07-11T12:00:00.000Z",
  };
}

function apply(state: PlatformState, action: PlatformWorkflowAction) {
  return applyPlatformWorkflowAction(state, action, context());
}

function createDraft(
  state: PlatformState,
  overrides: Partial<Extract<PlatformWorkflowAction, { type: "assignment.create" }>> = {}
) {
  return apply(state, {
    type: "assignment.create",
    courseRunId: "run_ar_l3_2026",
    title: "Lifecycle writing task",
    dueAt: "2026-07-20T18:00:00+03:00",
    submissionType: "text",
    rubric: ["Accuracy", "Clarity"],
    actorId: "usr_teacher_demo",
    ...overrides,
  }).result as Assignment;
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

describe("assignment publication lifecycle integrity", () => {
  it("creates an editable draft and records exact audit evidence", () => {
    const state = cloneState();
    const assignment = createDraft(state);

    expect(assignment).toMatchObject({
      courseRunId: "run_ar_l3_2026",
      title: "Lifecycle writing task",
      status: "draft",
    });
    expect(state.auditLogs[0]).toMatchObject({
      action: "assignment.created",
      entityType: "Assignment",
      entityId: assignment.id,
      actorId: "usr_teacher_demo",
    });
  });

  it("updates and publishes a draft with learner notification and audit rows", () => {
    const state = cloneState();
    const assignment = createDraft(state);

    apply(state, {
      type: "assignment.update",
      assignmentId: assignment.id,
      title: "Published lifecycle writing task",
      dueAt: "2026-07-22T18:00:00+03:00",
      submissionType: "file",
      rubric: ["Evidence", "Structure"],
      actorId: "usr_teacher_demo",
    });
    const published = apply(state, {
      type: "assignment.status.update",
      assignmentId: assignment.id,
      status: "active",
      actorId: "usr_teacher_demo",
    }).result as Assignment;

    expect(published).toMatchObject({
      title: "Published lifecycle writing task",
      submissionType: "file",
      rubric: ["Evidence", "Structure"],
      status: "active",
    });
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_demo",
        title: "New assignment",
        href: `/app/student/assignments/${assignment.id}`,
      })
    );
    expect(state.auditLogs.slice(0, 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "assignment.updated",
          entityId: assignment.id,
        }),
        expect.objectContaining({
          action: "assignment.published",
          entityId: assignment.id,
        }),
      ])
    );
  });

  it("rejects publication after the due date or without an active class", () => {
    const expiredState = cloneState();
    const expired = createDraft(expiredState, {
      dueAt: "2026-07-10T18:00:00+03:00",
    });
    expectDeniedWithoutMutation(
      expiredState,
      {
        type: "assignment.status.update",
        assignmentId: expired.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      "Assignment due date must be in the future when published."
    );

    const classlessState = cloneState();
    const classless = createDraft(classlessState);
    classlessState.classGroups
      .filter(group => group.courseRunId === classless.courseRunId)
      .forEach(group => {
        group.status = "paused";
      });
    expectDeniedWithoutMutation(
      classlessState,
      {
        type: "assignment.status.update",
        assignmentId: classless.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      "Publish the assignment only after an active class exists."
    );
  });

  it("prevents editing a published assignment", () => {
    const state = cloneState();
    const assignment = createDraft(state);
    apply(state, {
      type: "assignment.status.update",
      assignmentId: assignment.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });

    expectDeniedWithoutMutation(
      state,
      {
        type: "assignment.update",
        assignmentId: assignment.id,
        title: "Unsafe published edit",
        dueAt: "2026-07-23T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy"],
        actorId: "usr_teacher_demo",
      },
      "Only a draft assignment can be edited."
    );
  });

  it("cancels a draft with a reason but does not notify learners about unseen work", () => {
    const state = cloneState();
    const assignment = createDraft(state);
    const notificationsBefore = state.notifications.length;

    apply(state, {
      type: "assignment.status.update",
      assignmentId: assignment.id,
      status: "cancelled",
      reason: "Draft is no longer required",
      actorId: "usr_teacher_demo",
    });

    expect(assignment.status).toBe("cancelled");
    expect(state.notifications).toHaveLength(notificationsBefore);
    expect(state.auditLogs[0]).toMatchObject({
      action: "assignment.cancelled",
      entityId: assignment.id,
    });
  });

  it("rejects cancellation once submissions exist", () => {
    const state = cloneState();
    const assignment = createDraft(state);
    state.assignmentSubmissions.push({
      id: "sub_assignment_lifecycle",
      assignmentId: assignment.id,
      studentId: "stu_demo",
      submittedAt: "2026-07-12T10:00:00.000Z",
      status: "pending",
      response: "Lifecycle response",
    });

    expectDeniedWithoutMutation(
      state,
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "cancelled",
        reason: "Attempt to remove submitted work",
        actorId: "usr_teacher_demo",
      },
      "An assignment with submissions cannot be cancelled."
    );
  });

  it("closes before the due date only when every active learner is graded", () => {
    const state = cloneState();
    const assignment = createDraft(state);
    apply(state, {
      type: "assignment.status.update",
      assignmentId: assignment.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });

    expectDeniedWithoutMutation(
      state,
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "completed",
        actorId: "usr_teacher_demo",
      },
      "Assignment can close only after its due date or after every submission is graded."
    );

    state.assignmentSubmissions.push({
      id: "sub_assignment_lifecycle_completed",
      assignmentId: assignment.id,
      studentId: "stu_demo",
      submittedAt: "2026-07-12T10:00:00.000Z",
      status: "completed",
      response: "Completed lifecycle response",
      score: 91,
      feedback: "Complete",
    });
    apply(state, {
      type: "assignment.status.update",
      assignmentId: assignment.id,
      status: "completed",
      actorId: "usr_teacher_demo",
    });

    expect(assignment.status).toBe("completed");
    expect(
      state.assignmentSubmissions.find(
        item => item.id === "sub_assignment_lifecycle_completed"
      )
    ).toMatchObject({ score: 91, feedback: "Complete" });
    expect(state.auditLogs[0]).toMatchObject({
      action: "assignment.closed",
      entityId: assignment.id,
    });
  });

  it("closes after the due date while preserving pending submission history", () => {
    const state = cloneState();
    const assignment: Assignment = {
      id: "asg_assignment_lifecycle_overdue",
      courseRunId: "run_ar_l3_2026",
      title: "Overdue lifecycle assignment",
      dueAt: "2026-07-10T18:00:00+03:00",
      submissionType: "text",
      rubric: ["Accuracy"],
      status: "active",
    };
    state.assignments.unshift(assignment);
    state.assignmentSubmissions.push({
      id: "sub_assignment_lifecycle_pending",
      assignmentId: assignment.id,
      studentId: "stu_demo",
      submittedAt: "2026-07-10T17:00:00.000Z",
      status: "pending",
      response: "Pending review remains intact",
    });

    apply(state, {
      type: "assignment.status.update",
      assignmentId: assignment.id,
      status: "completed",
      actorId: "usr_teacher_demo",
    });

    expect(assignment.status).toBe("completed");
    expect(
      state.assignmentSubmissions.find(
        item => item.id === "sub_assignment_lifecycle_pending"
      )
    ).toMatchObject({ status: "pending", response: "Pending review remains intact" });
  });
});
