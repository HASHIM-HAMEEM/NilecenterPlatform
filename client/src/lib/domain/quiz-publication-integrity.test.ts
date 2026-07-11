import { describe, expect, it } from "vitest";
import {
  applyPlatformWorkflowAction,
  applySubmitQuizAttempt,
  type PlatformWorkflowAction,
} from "./actions";
import { seedPlatformState } from "./seed";
import type { PlatformState, Quiz } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function context() {
  let sequence = 0;
  return {
    createId: (prefix: string) => `${prefix}_quiz_lifecycle_${++sequence}`,
    now: () => "2026-07-11T12:00:00.000Z",
  };
}

function apply(state: PlatformState, action: PlatformWorkflowAction) {
  return applyPlatformWorkflowAction(state, action, context());
}

function createDraft(
  state: PlatformState,
  overrides: Partial<Extract<PlatformWorkflowAction, { type: "quiz.create" }>> = {}
) {
  return apply(state, {
    type: "quiz.create",
    courseRunId: "run_ar_l3_2026",
    title: "Lifecycle grammar quiz",
    dueAt: "2026-07-20T18:00:00+03:00",
    durationMinutes: 25,
    questionTypes: ["multiple_choice"],
    questionIds: [],
    attemptsAllowed: 2,
    actorId: "usr_teacher_demo",
    ...overrides,
  }).result as Quiz;
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

describe("quiz publication lifecycle integrity", () => {
  it("creates a bounded draft with exact audit evidence", () => {
    const state = cloneState();
    const quiz = createDraft(state, {
      durationMinutes: 500,
      attemptsAllowed: 20,
    });

    expect(quiz).toMatchObject({
      courseRunId: "run_ar_l3_2026",
      status: "draft",
      durationMinutes: 180,
      attemptsAllowed: 5,
      questionIds: [],
    });
    expect(state.auditLogs[0]).toMatchObject({
      action: "quiz.created",
      entityType: "Quiz",
      entityId: quiz.id,
      actorId: "usr_teacher_demo",
    });
  });

  it("attaches same-run questions, updates, and publishes with learner notification", () => {
    const state = cloneState();
    const quiz = createDraft(state);

    apply(state, {
      type: "quiz.questions.set",
      quizId: quiz.id,
      questionIds: ["qbi_ar_conditional_mcq", "qbi_ar_market_short"],
      actorId: "usr_teacher_demo",
    });
    apply(state, {
      type: "quiz.update",
      quizId: quiz.id,
      title: "Published lifecycle grammar quiz",
      dueAt: "2026-07-22T18:00:00+03:00",
      durationMinutes: 35,
      attemptsAllowed: 3,
      actorId: "usr_teacher_demo",
    });
    apply(state, {
      type: "quiz.status.update",
      quizId: quiz.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });
    const published = state.quizzes.find(item => item.id === quiz.id)!;

    expect(published).toMatchObject({
      title: "Published lifecycle grammar quiz",
      status: "active",
      durationMinutes: 35,
      attemptsAllowed: 3,
      questionTypes: ["multiple_choice", "short_answer"],
    });
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_demo",
        title: "New quiz",
        href: `/app/student/quizzes/${quiz.id}`,
      })
    );
    expect(state.auditLogs.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "quiz.questions.updated" }),
        expect.objectContaining({ action: "quiz.updated" }),
        expect.objectContaining({ action: "quiz.published" }),
      ])
    );
  });

  it("rejects publication without questions or with an invalid question definition", () => {
    const emptyState = cloneState();
    const emptyQuiz = createDraft(emptyState);
    expectDeniedWithoutMutation(
      emptyState,
      {
        type: "quiz.status.update",
        quizId: emptyQuiz.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      "Attach at least one active question before publishing a quiz."
    );

    const invalidState = cloneState();
    const invalidQuiz = createDraft(invalidState);
    apply(invalidState, {
      type: "quiz.questions.set",
      quizId: invalidQuiz.id,
      questionIds: ["qbi_ar_conditional_mcq"],
      actorId: "usr_teacher_demo",
    });
    const question = invalidState.questionBankItems.find(
      item => item.id === "qbi_ar_conditional_mcq"
    )!;
    question.answerKey = "not one of the choices";
    expectDeniedWithoutMutation(
      invalidState,
      {
        type: "quiz.status.update",
        quizId: invalidQuiz.id,
        status: "active",
        actorId: "usr_teacher_demo",
      },
      `Multiple-choice question ${question.id} requires at least two choices and a matching answer key.`
    );
  });

  it("locks details and question membership after publication", () => {
    const state = cloneState();
    const quiz = createDraft(state, {
      questionIds: ["qbi_ar_conditional_mcq"],
    });
    apply(state, {
      type: "quiz.status.update",
      quizId: quiz.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });

    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.update",
        quizId: quiz.id,
        title: "Unsafe published edit",
        dueAt: quiz.dueAt,
        durationMinutes: quiz.durationMinutes,
        attemptsAllowed: quiz.attemptsAllowed,
        actorId: "usr_teacher_demo",
      },
      "Only a draft quiz can be edited."
    );
    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.questions.set",
        quizId: quiz.id,
        questionIds: ["qbi_ar_market_short"],
        actorId: "usr_teacher_demo",
      },
      "Only a draft quiz can change questions."
    );
  });

  it("cancels unseen drafts silently and notifies learners only for published cancellation", () => {
    const draftState = cloneState();
    const draft = createDraft(draftState);
    const draftNotifications = JSON.stringify(draftState.notifications);
    apply(draftState, {
      type: "quiz.status.update",
      quizId: draft.id,
      status: "cancelled",
      reason: "Teaching plan has changed",
      actorId: "usr_teacher_demo",
    });
    expect(draft.status).toBe("cancelled");
    expect(JSON.stringify(draftState.notifications)).toBe(draftNotifications);

    const publishedState = cloneState();
    const published = createDraft(publishedState, {
      questionIds: ["qbi_ar_conditional_mcq"],
    });
    apply(publishedState, {
      type: "quiz.status.update",
      quizId: published.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });
    apply(publishedState, {
      type: "quiz.status.update",
      quizId: published.id,
      status: "cancelled",
      reason: "Teaching plan has changed",
      actorId: "usr_teacher_demo",
    });
    expect(publishedState.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_demo",
        title: "Quiz cancelled",
      })
    );
  });

  it("rejects cancellation after an attempt without mutating history", () => {
    const state = cloneState();
    const quiz = createDraft(state, {
      questionIds: ["qbi_ar_conditional_mcq"],
    });
    apply(state, {
      type: "quiz.status.update",
      quizId: quiz.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });
    applySubmitQuizAttempt(
      state,
      {
        quizId: quiz.id,
        answers: { qbi_ar_conditional_mcq: "إذا" },
        studentId: "stu_demo",
        actorId: "usr_student_demo",
      },
      context()
    );

    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.status.update",
        quizId: quiz.id,
        status: "cancelled",
        reason: "Attempt to remove learner history",
        actorId: "usr_teacher_demo",
      },
      "A quiz with attempts cannot be cancelled."
    );
  });

  it("closes early only after every active learner has a reviewed attempt", () => {
    const state = cloneState();
    const quiz = createDraft(state, {
      questionIds: ["qbi_ar_market_short"],
    });
    apply(state, {
      type: "quiz.status.update",
      quizId: quiz.id,
      status: "active",
      actorId: "usr_teacher_demo",
    });
    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.status.update",
        quizId: quiz.id,
        status: "completed",
        actorId: "usr_teacher_demo",
      },
      "Quiz can close only after its due date or after every active learner has a reviewed attempt."
    );

    const attempt = applySubmitQuizAttempt(
      state,
      {
        quizId: quiz.id,
        answers: { qbi_ar_market_short: "Two accurate sentences." },
        studentId: "stu_demo",
        actorId: "usr_student_demo",
      },
      context()
    );
    apply(state, {
      type: "quiz.review",
      attemptId: attempt.id,
      score: 90,
      feedback: "Reviewed lifecycle answer.",
      actorId: "usr_teacher_demo",
    });
    const savedAttempt = JSON.stringify(
      state.quizAttempts.find(item => item.id === attempt.id)
    );
    const savedGrade = JSON.stringify(
      state.grades.find(item => item.itemId === quiz.id)
    );
    apply(state, {
      type: "quiz.status.update",
      quizId: quiz.id,
      status: "completed",
      actorId: "usr_teacher_demo",
    });

    expect(quiz.status).toBe("completed");
    expect(
      JSON.stringify(state.quizAttempts.find(item => item.id === attempt.id))
    ).toBe(savedAttempt);
    expect(JSON.stringify(state.grades.find(item => item.itemId === quiz.id))).toBe(
      savedGrade
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "quiz.closed",
      entityId: quiz.id,
    });
  });
});
