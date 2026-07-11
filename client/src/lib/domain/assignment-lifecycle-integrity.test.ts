import { describe, expect, it } from "vitest";
import { applyPlatformWorkflowAction, applySubmitAssignment } from "./actions";
import { seedPlatformState } from "./seed";
import type { PlatformState } from "./types";

const lifecycleNow = "2026-07-10T12:00:00.000Z";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function createContext(now = lifecycleNow) {
  let sequence = 0;
  return {
    createId: (prefix: string) =>
      `${prefix}_assignment_lifecycle_${++sequence}`,
    now: () => now,
  };
}

function createDraft(state: PlatformState, context = createContext()) {
  const result = applyPlatformWorkflowAction(
    state,
    {
      type: "assignment.create",
      courseRunId: "run_ar_l3_2026",
      title: "Lifecycle grammar response",
      dueAt: "2026-07-20T18:00:00+03:00",
      submissionType: "text",
      rubric: ["Accuracy", "Clarity"],
      actorId: "usr_teacher_demo",
    },
    context
  );
  return result.result as PlatformState["assignments"][number];
}

describe("assignment publication lifecycle integrity", () => {
  it("creates a hidden draft, publishes it to active learners, and locks draft edits after publication", () => {
    const state = cloneState();
    const context = createContext();
    const assignment = createDraft(state, context);

    expect(assignment).toMatchObject({ status: "draft" });
    expect(
      state.notifications.some(
        notification =>
          notification.href === `/app/student/assignments/${assignment.id}`
      )
    ).toBe(false);

    applyPlatformWorkflowAction(
      state,
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      context
    );

    expect(
      state.assignments.find(item => item.id === assignment.id)
    ).toMatchObject({
      status: "active",
    });
    expect(state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "usr_student_demo",
          title: "New assignment",
          href: `/app/student/assignments/${assignment.id}`,
        }),
      ])
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "assignment.published",
      actorId: "usr_teacher_demo",
      entityId: assignment.id,
    });

    expect(() =>
      applyPlatformWorkflowAction(
        state,
        {
          type: "assignment.update",
          assignmentId: assignment.id,
          title: "Changed after publication",
          dueAt: "2026-07-21T18:00:00+03:00",
          submissionType: "text",
          rubric: ["Accuracy"],
          actorId: "usr_teacher_demo",
        },
        context
      )
    ).toThrow("Only a draft assignment can be edited.");
  });

  it("requires a cancellation reason and rejects cancellation after a submission", () => {
    const state = cloneState();
    const context = createContext();
    const assignment = createDraft(state, context);
    const beforeInvalidCancel = JSON.stringify(state);

    expect(() =>
      applyPlatformWorkflowAction(
        state,
        {
          type: "assignment.status.update",
          assignmentId: assignment.id,
          status: "cancelled",
          reason: "No",
          actorId: "usr_teacher_demo",
        },
        context
      )
    ).toThrow("Assignment cancellation reason must be at least 5 characters.");
    expect(JSON.stringify(state)).toBe(beforeInvalidCancel);

    const cancellableState = cloneState();
    const cancellableContext = createContext();
    const cancellableAssignment = createDraft(
      cancellableState,
      cancellableContext
    );
    const notificationsBeforeDraftCancellation = JSON.stringify(
      cancellableState.notifications
    );
    applyPlatformWorkflowAction(
      cancellableState,
      {
        type: "assignment.status.update",
        assignmentId: cancellableAssignment.id,
        status: "cancelled",
        reason: "The class plan has changed.",
        actorId: "usr_teacher_demo",
      },
      cancellableContext
    );
    expect(
      cancellableState.assignments.find(
        item => item.id === cancellableAssignment.id
      )
    ).toMatchObject({ status: "cancelled" });
    expect(JSON.stringify(cancellableState.notifications)).toBe(
      notificationsBeforeDraftCancellation
    );

    applyPlatformWorkflowAction(
      state,
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      context
    );
    const publishedNotificationsBeforeCancellation = state.notifications.length;
    const publishedCancellationState = cloneState();
    const publishedCancellationContext = createContext();
    const publishedCancellationAssignment = createDraft(
      publishedCancellationState,
      publishedCancellationContext
    );
    applyPlatformWorkflowAction(
      publishedCancellationState,
      {
        type: "assignment.status.update",
        assignmentId: publishedCancellationAssignment.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      publishedCancellationContext
    );
    const notificationCountAfterPublication =
      publishedCancellationState.notifications.length;
    applyPlatformWorkflowAction(
      publishedCancellationState,
      {
        type: "assignment.status.update",
        assignmentId: publishedCancellationAssignment.id,
        status: "cancelled",
        reason: "The class plan has changed.",
        actorId: "usr_teacher_demo",
      },
      publishedCancellationContext
    );
    expect(publishedCancellationState.notifications.length).toBeGreaterThan(
      notificationCountAfterPublication
    );
    expect(publishedCancellationState.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "usr_student_demo",
          title: "Assignment cancelled",
          href: "/app/student/assignments",
        }),
      ])
    );
    expect(state.notifications.length).toBe(
      publishedNotificationsBeforeCancellation
    );
    applySubmitAssignment(
      state,
      {
        assignmentId: assignment.id,
        studentId: "stu_demo",
        response: "A complete lifecycle response for teacher review.",
      },
      context
    );
    const beforeSubmittedCancel = JSON.stringify(state);

    expect(() =>
      applyPlatformWorkflowAction(
        state,
        {
          type: "assignment.status.update",
          assignmentId: assignment.id,
          status: "cancelled",
          reason: "The class plan has changed.",
          actorId: "usr_teacher_demo",
        },
        context
      )
    ).toThrow("An assignment with submissions cannot be cancelled.");
    expect(JSON.stringify(state)).toBe(beforeSubmittedCancel);
  });

  it("closes after all submitted work is graded and preserves the grade record", () => {
    const state = cloneState();
    const context = createContext();
    const assignment = createDraft(state, context);

    applyPlatformWorkflowAction(
      state,
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      context
    );
    const submission = applySubmitAssignment(
      state,
      {
        assignmentId: assignment.id,
        studentId: "stu_demo",
        response: "A complete lifecycle response for teacher review.",
      },
      context
    );
    applyPlatformWorkflowAction(
      state,
      {
        type: "assignment.grade",
        submissionId: submission.id,
        score: 91,
        feedback: "Clear, accurate response.",
        actorId: "usr_teacher_demo",
      },
      context
    );
    const savedSubmission = JSON.parse(
      JSON.stringify(
        state.assignmentSubmissions.find(item => item.id === submission.id)
      )
    );
    const savedGrade = JSON.parse(
      JSON.stringify(
        state.grades.find(
          grade =>
            grade.itemId === assignment.id && grade.studentId === "stu_demo"
        )
      )
    );

    applyPlatformWorkflowAction(
      state,
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "completed",
        actorId: "usr_teacher_demo",
      },
      context
    );

    expect(
      state.assignments.find(item => item.id === assignment.id)
    ).toMatchObject({
      status: "completed",
    });
    expect(
      state.assignmentSubmissions.find(item => item.id === submission.id)
    ).toEqual(savedSubmission);
    expect(
      state.grades.find(
        grade =>
          grade.itemId === assignment.id && grade.studentId === "stu_demo"
      )
    ).toEqual(savedGrade);
    expect(state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "usr_student_demo",
          title: "Assignment closed",
          href: `/app/student/assignments/${assignment.id}`,
        }),
      ])
    );
    expect(() =>
      applySubmitAssignment(
        state,
        {
          assignmentId: assignment.id,
          studentId: "stu_demo",
          response: "This must not be accepted after closing.",
        },
        context
      )
    ).toThrow(`Assignment ${assignment.id} must be active.`);
  });
});
