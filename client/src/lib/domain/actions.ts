import type {
  AssignmentSubmission,
  AttendanceStatus,
  AuditLog,
  CalendarEvent,
  CalendarEventType,
  Certificate,
  CommunicationLog,
  EntityStatus,
  Grade,
  IntegrationConfig,
  IntegrationStatus,
  Application,
  Lead,
  Lesson,
  LessonResource,
  Module,
  Message,
  MessageAttachment,
  Notification,
  Payment,
  PendingMediaAttachment,
  PlacementTestBooking,
  PlacementTestResult,
  PlatformState,
  ReportPreset,
  ReportType,
  ScopedPortalSettings,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StaffProfile,
  StaffRole,
  StudentEntrySource,
  StudentStatus,
  UserNotificationPreferences,
  QuestionBankItem,
  QuizAttempt,
  QuranProgressRecord,
  RecitationSubmission,
  Room,
  TeacherAvailability,
} from "./types.js";
import { roleOrder, rolePermissions, type Permission, type Role } from "../platformData.js";

export type PlatformLearningAction =
  | { type: "lesson.start"; lessonId: string; studentId?: string; actorId?: string }
  | { type: "lesson.complete"; lessonId: string; studentId?: string; actorId?: string }
  | { type: "assignment.submit"; assignmentId: string; response: string; pendingMedia?: PendingMediaAttachment[]; studentId?: string; actorId?: string }
  | { type: "quiz.submit"; quizId: string; answers: Record<string, string>; pendingMedia?: PendingMediaAttachment[]; studentId?: string; actorId?: string };

export type CreateLeadActionInput = Pick<Lead, "fullName" | "email" | "phone" | "subject" | "notes"> & {
  country?: string;
  source?: Lead["source"];
};

export type CreateApplicationActionInput = Pick<Application, "branchId" | "courseInterest" | "schedulePreference"> & {
  fullName: string;
  email: string;
  phone: string;
  country?: string;
  notes?: string;
  source?: Lead["source"];
};

export type CreatePlacementActionInput = Pick<
  PlacementTestBooking,
  "fullName" | "email" | "phone" | "subject" | "preferredDate" | "currentLevel"
> & {
  branchId?: string;
};

export type CreateCurriculumModuleActionInput = Pick<Module, "courseId" | "title" | "outcomes">;

export type UpdateCourseStatusActionInput = {
  courseId: string;
  status: Extract<EntityStatus, "draft" | "active" | "paused" | "completed">;
};

export type UpdateMaterialPublishActionInput = Pick<LessonResource, "id" | "published">;

export type CreateCalendarEventActionInput = {
  title: string;
  eventType: CalendarEventType;
  startsAt: string;
  endsAt: string;
  ownerId?: string;
  branchId?: string;
  roomId?: string;
  classGroupId?: string;
};

export type CreateAssignmentActionInput = {
  courseRunId: string;
  title: string;
  dueAt: string;
  submissionType: "text" | "file" | "audio" | "video";
  rubric: string[];
};

export type CreateQuizActionInput = {
  courseRunId: string;
  title: string;
  dueAt: string;
  durationMinutes: number;
  questionTypes: string[];
  questionIds?: string[];
  attemptsAllowed: number;
};

export type CreateQuestionActionInput = {
  courseRunId: string;
  prompt: string;
  questionType: QuestionBankItem["type"];
  difficulty: QuestionBankItem["difficulty"];
  tags: string[];
  choices?: string[];
  answerKey?: string;
  rubric?: string[];
};

export type SendMessageActionInput = {
  fromUserId?: string;
  toUserId: string;
  recipientUserIds?: string[];
  subject: string;
  body: string;
  channel?: CommunicationLog["channel"];
  attachments?: MessageAttachment[];
};

export type SubmitRecitationActionInput = Pick<RecitationSubmission, "studentId" | "teacherId" | "title"> & {
  pendingMedia?: PendingMediaAttachment[];
};

export type AssignTeacherActionInput = {
  userId: string;
  courseRunId: string;
  status?: EntityStatus;
  departmentId?: string;
  specialties?: string[];
  teachingLevels?: string[];
  availability?: string[];
  actorId?: string;
};

export type UpdateUserActionInput = {
  userId: string;
  activeRole?: Role;
  roles?: Role[];
  branchId?: string;
  departmentId?: string;
  status?: EntityStatus;
  actorId?: string;
};

export type UpdatePermissionActionInput = {
  role: Role;
  permission: Permission;
  granted: boolean;
  actorId?: string;
};

export type UpdateBranchActionInput = {
  branchId: string;
  status: EntityStatus;
  actorId?: string;
};

export type UpdateRoomStatusActionInput = {
  roomId: Room["id"];
  status: Extract<EntityStatus, "active" | "pending" | "paused">;
  actorId?: string;
};

export type CreateRoomActionInput = {
  branchId: string;
  name: string;
  capacity: number;
  equipment?: string[];
  actorId?: string;
};

export type UpdateIntegrationStatusActionInput = {
  integrationId: IntegrationConfig["id"];
  status: IntegrationStatus;
  actorId?: string;
};

export type CheckIntegrationActionInput = {
  integrationId: IntegrationConfig["id"];
  actorId?: string;
};

export type CheckSystemHealthActionInput = {
  score: number;
  actorId?: string;
};

export type SavePlatformSettingsActionInput = {
  organization: string;
  defaultLanguage: string;
  academicTerm: string;
  retentionDays: number;
  actorId?: string;
};

export type SavePortalSettingsActionInput = Pick<
  ScopedPortalSettings,
  | "role"
  | "scopeId"
  | "label"
  | "language"
  | "timezone"
  | "notifications"
  | "reviewCadenceDays"
  | "paymentReminderDays"
  | "attendanceCutoffMinutes"
> & {
  actorId?: string;
};

function validateAccountStatus(status: EntityStatus | undefined, fallback: EntityStatus = "active") {
  const nextStatus = status ?? fallback;
  if (!accountStatuses.includes(nextStatus)) {
    throw new Error("Choose a valid account status.");
  }
  return nextStatus;
}

const assignableCourseRunStatuses: EntityStatus[] = ["active", "pending"];
const pendingMediaKinds = new Set<PendingMediaAttachment["kind"]>(["document", "image", "audio", "video"]);
const maxPendingMediaSize = 25 * 1024 * 1024;

function cleanPendingMedia(input?: PendingMediaAttachment[]) {
  return (input ?? []).slice(0, 3).map((item) => {
    const name = item.name.trim().slice(0, 120);
    const type = item.type.trim().slice(0, 120) || "application/octet-stream";
    const previewLabel = item.previewLabel.trim().slice(0, 160) || name;
    const size = Math.round(Number(item.size));
    if (!name) throw new Error("Attachment name is required.");
    if (!Number.isFinite(size) || size <= 0 || size > maxPendingMediaSize) {
      throw new Error("Attachment must be 25 MB or smaller.");
    }
    if (!pendingMediaKinds.has(item.kind)) throw new Error("Choose a valid attachment type.");
    return {
      id: item.id.trim().slice(0, 80) || `pending_${Date.now().toString(36)}`,
      name,
      type,
      size,
      kind: item.kind,
      previewLabel,
      storageStatus: "pending_storage" as const,
      createdAt: item.createdAt || new Date().toISOString(),
    };
  });
}

export type CreateUserActionInput = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  branchId?: string;
  departmentId?: string;
  status?: EntityStatus;
  preferredLanguage?: string;
  courseRunId?: string;
  classGroupId?: string;
  currentLevel?: string;
  ageGroup?: string;
  guardianName?: string;
  guardianPhone?: string;
  subjects?: string[];
  specialization?: string[];
  availability?: string[];
  notes?: string;
  actorId?: string;
};

export type CreateStaffUserActionInput = {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  branchId?: string;
  departmentId?: string;
  status?: EntityStatus;
  permissionScope?: StaffPermissionScope;
  subjects?: string[];
  teachingLevels?: string[];
  availabilityStatus?: StaffAvailabilityStatus;
  operationalScope?: string[];
  notes?: string;
  actorId?: string;
};

export type CreateStudentActionInput = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  preferredLanguage: string;
  courseInterest: string;
  ageGroup: string;
  guardianName?: string;
  guardianPhone?: string;
  currentLevel?: string;
  placementResult?: string;
  status?: Extract<StudentStatus, "ready_to_enroll" | "enrolled" | "active" | "paused">;
  notes?: string;
  courseRunId: string;
  classGroupId: string;
  source?: StudentEntrySource;
  leadId?: string;
  applicationId?: string;
  placementTestId?: string;
  actorId?: string;
};

export type UpdateStudentStatusActionInput = {
  studentId: string;
  status: StudentStatus;
  notes?: string;
  actorId?: string;
};

export type UpdateProfileActionInput = {
  userId?: string;
  name?: string;
  phone?: string;
  preferredLanguage?: string;
  timezone?: string;
  notificationPreferences?: Partial<UserNotificationPreferences>;
  country?: string;
  guardianName?: string;
  guardianPhone?: string;
  title?: string;
  availabilityStatus?: StaffAvailabilityStatus;
  actorId?: string;
};

export type PlatformWorkflowAction =
  | PlatformLearningAction
  | ({ type: "lead.create"; actorId?: string } & CreateLeadActionInput)
  | ({ type: "application.create"; actorId?: string } & CreateApplicationActionInput)
  | ({ type: "user.create" } & CreateUserActionInput)
  | ({ type: "staff.user.create" } & CreateStaffUserActionInput)
  | ({ type: "student.create" } & CreateStudentActionInput)
  | ({ type: "student.status.update" } & UpdateStudentStatusActionInput)
  | ({ type: "profile.update" } & UpdateProfileActionInput)
  | ({ type: "user.update" } & UpdateUserActionInput)
  | ({ type: "permission.update" } & UpdatePermissionActionInput)
  | ({ type: "branch.update" } & UpdateBranchActionInput)
  | ({ type: "room.status.update" } & UpdateRoomStatusActionInput)
  | ({ type: "room.create" } & CreateRoomActionInput)
  | ({ type: "integration.status.update" } & UpdateIntegrationStatusActionInput)
  | ({ type: "integration.local_check" } & CheckIntegrationActionInput)
  | ({ type: "system.health_check" } & CheckSystemHealthActionInput)
  | ({ type: "settings.save" } & SavePlatformSettingsActionInput)
  | ({ type: "portal.settings.save" } & SavePortalSettingsActionInput)
  | ({ type: "placement.create"; actorId?: string } & CreatePlacementActionInput)
  | ({ type: "curriculum.module.create"; actorId?: string } & CreateCurriculumModuleActionInput)
  | ({ type: "course.status.update"; actorId?: string } & UpdateCourseStatusActionInput)
  | ({ type: "material.publish.update"; actorId?: string } & UpdateMaterialPublishActionInput)
  | { type: "record.save"; module: string; payload: Record<string, string>; actorId?: string }
  | ({ type: "assignment.create"; actorId?: string } & CreateAssignmentActionInput)
  | ({ type: "quiz.create"; actorId?: string } & CreateQuizActionInput)
  | ({ type: "question.create"; actorId?: string } & CreateQuestionActionInput)
  | { type: "quiz.questions.set"; quizId: string; questionIds: string[]; actorId?: string }
  | { type: "assignment.grade"; submissionId: string; score: number; feedback: string; actorId?: string }
  | { type: "quiz.review"; attemptId: string; score: number; feedback: string; actorId?: string }
  | {
      type: "attendance.save";
      classGroupId: string;
      sessionId: string;
      statuses: Record<string, AttendanceStatus>;
      notes?: Record<string, string>;
      actorId?: string;
    }
  | ({ type: "calendar.create"; actorId?: string } & CreateCalendarEventActionInput)
  | ({ type: "message.send"; actorId?: string } & SendMessageActionInput)
  | { type: "certificate.approve"; certificateId: string; actorId?: string }
  | { type: "certificate.issue"; certificateId: string; actorId?: string }
  | { type: "certificate.reject"; certificateId: string; reason: string; actorId?: string }
  | {
      type: "payment.record";
      invoiceId: string;
      amount?: number;
      method?: Payment["method"];
      reference?: string;
      actorId?: string;
    }
  | {
      type: "report.preset.save";
      role: Role;
      label: string;
      reportType: ReportType;
      search?: string;
      status?: string;
      rowCount?: number;
      actorId?: string;
    }
  | { type: "placement.result.record"; bookingId: string; recommendedLevel: string; score: number; notes: string; actorId?: string }
  | { type: "lead.convert"; leadId: string; branchId?: string; actorId?: string }
  | { type: "application.convert"; applicationId: string; actorId?: string }
  | { type: "enrollment.activate"; workflowId: string; courseRunId?: string; classGroupId?: string; actorId?: string }
  | ({ type: "teacher.assign" } & AssignTeacherActionInput)
  | { type: "quran.progress.update"; recordId: string; memorizedPercent: number; tajweedScore: number; notes: string; actorId?: string }
  | { type: "recitation.review"; submissionId: string; feedback: string; actorId?: string }
  | ({ type: "recitation.submit"; actorId?: string } & SubmitRecitationActionInput)
  | { type: "notification.read"; notificationId: string; actorId?: string };

export type PlatformLearningActionResult =
  | {
      action: "lesson.start" | "lesson.complete";
      entityType: "Lesson";
      entityId: string;
      summary: string;
      result: Lesson;
    }
  | {
      action: "assignment.submit";
      entityType: "AssignmentSubmission";
      entityId: string;
      summary: string;
      result: AssignmentSubmission;
    }
  | {
      action: "quiz.submit";
      entityType: "QuizAttempt";
      entityId: string;
      summary: string;
      result: QuizAttempt;
    };

export type PlatformWorkflowActionResult =
  | PlatformLearningActionResult
  | {
      action: string;
      entityType: string;
      entityId: string;
      summary: string;
      result: unknown;
    };

type MutationContext = {
  createId: (prefix: string) => string;
  now: () => string;
};

const defaultContext: MutationContext = {
  createId: (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  now: () => new Date().toISOString(),
};

function context(input?: Partial<MutationContext>): MutationContext {
  return { ...defaultContext, ...input };
}

function appendAudit(
  state: PlatformState,
  ctx: MutationContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  actorId = "usr_student_demo",
) {
  const audit: AuditLog = {
    id: ctx.createId("audit"),
    actorId,
    action,
    entityType,
    entityId,
    summary,
    createdAt: ctx.now(),
  };
  state.auditLogs = [audit, ...state.auditLogs].slice(0, 160);
  return audit;
}

function notify(state: PlatformState, ctx: MutationContext, input: Omit<Notification, "id" | "read" | "createdAt">) {
  const notification: Notification = {
    id: ctx.createId("not"),
    read: false,
    createdAt: ctx.now(),
    ...input,
  };
  state.notifications = [notification, ...state.notifications].slice(0, 80);
  return notification;
}

function requireLesson(state: PlatformState, lessonId: string) {
  const lesson = state.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} was not found.`);
  return lesson;
}

function requireAssignment(state: PlatformState, assignmentId: string) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} was not found.`);
  return assignment;
}

function requireQuiz(state: PlatformState, quizId: string) {
  const quiz = state.quizzes.find((item) => item.id === quizId);
  if (!quiz) throw new Error(`Quiz ${quizId} was not found.`);
  return quiz;
}

export function applyStartLesson(
  state: PlatformState,
  input: { lessonId: string; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const lesson = requireLesson(state, input.lessonId);
  const existing = state.lessonProgress.find((item) => item.lessonId === lesson.id && item.studentId === studentId);

  if (existing) {
    if (existing.status !== "completed") existing.status = "in_progress";
  } else {
    state.lessonProgress = [
      {
        id: ctx.createId("lp"),
        studentId,
        lessonId: lesson.id,
        status: "in_progress",
      },
      ...state.lessonProgress,
    ];
  }

  appendAudit(state, ctx, "lesson.started", "Lesson", lesson.id, `Opened lesson ${lesson.title}.`, actorId);
  return lesson;
}

export function applyCompleteLesson(
  state: PlatformState,
  input: { lessonId: string; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const lesson = requireLesson(state, input.lessonId);
  const existing = state.lessonProgress.find((item) => item.lessonId === lesson.id && item.studentId === studentId);
  const alreadyCompleted = existing?.status === "completed";

  if (existing) {
    existing.status = "completed";
    existing.completedAt = existing.completedAt ?? ctx.now();
  } else {
    state.lessonProgress = [
      {
        id: ctx.createId("lp"),
        studentId,
        lessonId: lesson.id,
        status: "completed",
        completedAt: ctx.now(),
      },
      ...state.lessonProgress,
    ];
  }

  const module = state.modules.find((item) => item.id === lesson.moduleId);
  const courseRun = module ? state.courseRuns.find((run) => run.courseId === module.courseId) : undefined;
  if (courseRun && !alreadyCompleted) {
    state.enrollments = state.enrollments.map((enrollment) =>
      enrollment.studentId === studentId && enrollment.courseRunId === courseRun.id
        ? { ...enrollment, progress: Math.min(100, enrollment.progress + 6) }
        : enrollment,
    );
  }

  appendAudit(state, ctx, "lesson.completed", "Lesson", lesson.id, `Completed lesson ${lesson.title}.`, actorId);
  return lesson;
}

export function applySubmitAssignment(
  state: PlatformState,
  input: { assignmentId: string; response: string; pendingMedia?: PendingMediaAttachment[]; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const assignment = requireAssignment(state, input.assignmentId);
  const pendingMedia = cleanPendingMedia(input.pendingMedia);
  if (!input.response.trim() && pendingMedia.length === 0) throw new Error("Assignment response or attachment is required.");
  const existing = state.assignmentSubmissions.find(
    (item) => item.assignmentId === assignment.id && item.studentId === studentId && item.status !== "completed",
  );
  const submission: AssignmentSubmission = {
    id: existing?.id ?? ctx.createId("sub"),
    assignmentId: assignment.id,
    studentId,
    submittedAt: ctx.now(),
    status: "pending" as EntityStatus,
    response: input.response,
    pendingMedia,
  };

  state.assignmentSubmissions = existing
    ? state.assignmentSubmissions.map((item) => (item.id === existing.id ? submission : item))
    : [submission, ...state.assignmentSubmissions];
  const run = state.courseRuns.find((item) => item.id === assignment.courseRunId);
  notify(state, ctx, {
    userId: run?.teacherId ?? "usr_teacher_demo",
    title: "Assignment submitted",
    body: `${assignment.title} is ready for review.`,
    href: "/app/teacher/grading",
  });
  appendAudit(
    state,
    ctx,
    existing ? "assignment.resubmitted" : "assignment.submitted",
    "AssignmentSubmission",
    submission.id,
    `Submitted ${assignment.title}${pendingMedia.length ? ` with ${pendingMedia.length} pending attachment(s)` : ""}.`,
    actorId,
  );
  return submission;
}

export function applySubmitQuizAttempt(
  state: PlatformState,
  input: { quizId: string; answers: Record<string, string>; pendingMedia?: PendingMediaAttachment[]; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const quiz = requireQuiz(state, input.quizId);
  const previousAttempts = state.quizAttempts.filter((attempt) => attempt.quizId === quiz.id && attempt.studentId === studentId);
  if (quiz.attemptsAllowed <= 0) throw new Error("This quiz is not accepting attempts.");
  if (previousAttempts.length >= quiz.attemptsAllowed) {
    throw new Error("No quiz attempts remaining.");
  }

  const submittedAnswerEntries = Object.entries(input.answers)
    .map(([questionId, answer]) => [questionId, answer.trim()] as [string, string])
    .filter(([, answer]) => answer.length > 0);
  const submittedAnswers: Record<string, string> = Object.fromEntries(submittedAnswerEntries);
  const pendingMedia = cleanPendingMedia(input.pendingMedia);
  const attachedQuestions = quiz.questionIds.flatMap((questionId) => {
    const question = state.questionBankItems.find((item) => item.id === questionId);
    return question && question.courseRunId === quiz.courseRunId && question.status === "active" ? [question] : [];
  });

  if (attachedQuestions.length > 0) {
    const attachedIds = new Set(attachedQuestions.map((question) => question.id));
    const unknownAnswerId = Object.keys(submittedAnswers).find((questionId) => !attachedIds.has(questionId));
    if (unknownAnswerId) throw new Error("Quiz answers must match attached questions.");
    const mediaQuestionPresent = attachedQuestions.some((question) => question.type === "oral_record" || question.type === "file_upload");
    if (Object.keys(submittedAnswers).length === 0 && (!mediaQuestionPresent || pendingMedia.length === 0)) throw new Error("Quiz answer is required.");
  } else if (Object.keys(submittedAnswers).length === 0 && pendingMedia.length === 0) {
    throw new Error("Quiz answer is required.");
  }

  const objectiveQuestionTypes = new Set<QuestionBankItem["type"]>(["multiple_choice", "true_false"]);
  const requiresManualReview =
    attachedQuestions.length === 0 ||
    attachedQuestions.some((question) => !objectiveQuestionTypes.has(question.type) || !question.answerKey);
  const score = requiresManualReview
    ? 0
    : Math.round(
        attachedQuestions.reduce((total, question) => {
          const answer = submittedAnswers[question.id] ?? "";
          if (!answer) return total;
          return total + (answer.trim().toLowerCase() === question.answerKey?.trim().toLowerCase() ? 100 : 0);
        }, 0) / attachedQuestions.length,
      );
  const attempt: QuizAttempt = {
    id: ctx.createId("attempt"),
    quizId: quiz.id,
    studentId,
    startedAt: ctx.now(),
    submittedAt: ctx.now(),
    status: (requiresManualReview ? "pending" : "completed") as EntityStatus,
    score,
    maxScore: 100,
    answers: submittedAnswers,
    pendingMedia,
  };

  state.quizAttempts = [attempt, ...state.quizAttempts];
  if (!requiresManualReview) {
    const grade: Grade = {
      id: ctx.createId("grade"),
      studentId,
      courseRunId: quiz.courseRunId,
      itemId: quiz.id,
      itemTitle: quiz.title,
      score,
      maxScore: 100,
      feedback: score >= 80 ? "Auto-graded pass. Teacher can add manual feedback." : "Auto-graded with manual review recommended.",
    };
    state.grades = [grade, ...state.grades];
  }
  appendAudit(
    state,
    ctx,
    "quiz.submitted",
    "QuizAttempt",
    attempt.id,
    requiresManualReview
      ? `Submitted ${quiz.title} for teacher review${pendingMedia.length ? ` with ${pendingMedia.length} pending attachment(s)` : ""}.`
      : `Submitted ${quiz.title} with ${score}/100.`,
    actorId,
  );
  return attempt;
}

function messageRouteForUser(user?: PlatformState["users"][number]) {
  switch (user?.activeRole) {
    case "student":
      return "/app/student/messages";
    case "teacher":
      return "/app/teacher/messages";
    case "registrar":
      return "/app/registrar/messages";
    case "headofdepartment":
      return "/app/hod/messages";
    case "branchadmin":
      return "/app/branch/messages";
    case "superadmin":
      return "/app/admin/dashboard";
    default:
      return "/app";
  }
}

function defaultAdmissionsBranchId(state: PlatformState, actorId?: string) {
  const actor = state.users.find((user) => user.id === actorId);
  if (actor?.branchId && state.branches.some((branch) => branch.id === actor.branchId)) return actor.branchId;
  const staffProfile = state.staffProfiles.find((profile) => profile.userId === actorId && profile.role === "registrar");
  const scopedBranch = staffProfile?.branchIds.find((branchId) => state.branches.some((branch) => branch.id === branchId));
  return scopedBranch ?? state.branches.find((branch) => branch.id === "br_online")?.id ?? state.branches[0]?.id ?? "br_online";
}

function appendInternalCommunicationLog(
  state: PlatformState,
  ctx: MutationContext,
  input: { actorId: string; subject: string; body: string; relatedUserId?: string },
) {
  const log: CommunicationLog = {
    id: ctx.createId("comm"),
    actorId: input.actorId,
    channel: "manual",
    subject: input.subject,
    body: input.body,
    relatedUserId: input.relatedUserId,
    status: "completed",
    createdAt: ctx.now(),
  };
  state.communicationLogs = [log, ...state.communicationLogs].slice(0, 120);
  return log;
}

function applyCreateLead(
  state: PlatformState,
  input: CreateLeadActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const lead: Lead = {
    id: ctx.createId("lead"),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    country: input.country,
    subject: input.subject,
    source: input.source ?? "trial_form",
    status: "lead",
    notes: input.notes,
    createdAt: ctx.now(),
  };
  state.leads = [lead, ...state.leads];
  appendAudit(
    state,
    ctx,
    "lead.created",
    "Lead",
    lead.id,
    `Created lead for ${lead.fullName} from ${lead.source}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return lead;
}

function applyCreateApplication(
  state: PlatformState,
  input: CreateApplicationActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const branchId = input.branchId.trim();
  const courseInterest = input.courseInterest.trim();
  const schedulePreference = input.schedulePreference.trim();
  if (!fullName || !email || !phone || !branchId || !courseInterest || !schedulePreference) {
    throw new Error("Application name, email, phone, branch, course, and schedule are required.");
  }
  if (!email.includes("@")) throw new Error("Enter a valid application email address.");
  const branch = state.branches.find((item) => item.id === branchId);
  if (!branch) throw new Error("Choose a valid branch for this application.");
  const existingLead = state.leads.find((lead) => lead.email.toLowerCase() === email);
  const existingApplication = existingLead ? state.applications.find((application) => application.leadId === existingLead.id) : undefined;
  if (existingApplication) {
    throw new Error("An application already exists for this email.");
  }
  if (state.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }

  const actorId = input.actorId ?? "usr_registrar_demo";
  const lead: Lead = {
    id: ctx.createId("lead"),
    fullName,
    email,
    phone,
    country: input.country?.trim() || "Egypt",
    subject: courseInterest,
    source: input.source ?? "manual",
    status: "ready_to_enroll",
    notes: input.notes?.trim() || undefined,
    createdAt: ctx.now(),
  };
  const application: Application = {
    id: ctx.createId("app"),
    leadId: lead.id,
    branchId: branch.id,
    courseInterest,
    schedulePreference,
    status: "pending",
  };
  const communicationLog = appendInternalCommunicationLog(state, ctx, {
    actorId,
    subject: "Application intake",
    body: `Internal follow-up logged for ${fullName}; no external message was sent.`,
  });

  state.leads = [lead, ...state.leads];
  state.applications = [application, ...state.applications];
  appendAudit(
    state,
    ctx,
    "application.created",
    "Application",
    application.id,
    `Created application for ${fullName} in ${branch.name}.`,
    actorId,
  );
  return { lead, application, communicationLog };
}

function applyCreatePlacementBooking(
  state: PlatformState,
  input: CreatePlacementActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const booking: PlacementTestBooking = {
    id: ctx.createId("pt"),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    branchId: input.branchId ?? "br_online",
    subject: input.subject,
    preferredDate: input.preferredDate,
    currentLevel: input.currentLevel,
    status: "pending",
  };
  state.placementTests = [booking, ...state.placementTests];
  appendAudit(
    state,
    ctx,
    "placement.created",
    "PlacementTestBooking",
    booking.id,
    `Booked placement test for ${booking.fullName}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return booking;
}

function applyCreateCurriculumModule(
  state: PlatformState,
  input: CreateCurriculumModuleActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const course = state.courses.find((item) => item.id === input.courseId);
  if (!course) throw new Error(`Course ${input.courseId} was not found.`);
  if (!input.title.trim()) throw new Error("Module title is required.");
  const courseModules = state.modules.filter((module) => module.courseId === course.id);
  const module: Module = {
    id: ctx.createId("mod"),
    courseId: course.id,
    title: input.title.trim(),
    order: courseModules.length + 1,
    outcomes: input.outcomes.map((item) => item.trim()).filter(Boolean),
  };
  state.modules = [...state.modules, module];
  appendAudit(
    state,
    ctx,
    "curriculum.module_created",
    "Module",
    module.id,
    `Added module ${module.title} to ${course.title}.`,
    input.actorId ?? "usr_hod_demo",
  );
  return module;
}

function applyUpdateCourseStatus(
  state: PlatformState,
  input: UpdateCourseStatusActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const course = state.courses.find((item) => item.id === input.courseId);
  if (!course) throw new Error(`Course ${input.courseId} was not found.`);
  const allowedStatuses = new Set<UpdateCourseStatusActionInput["status"]>(["draft", "active", "paused", "completed"]);
  if (!allowedStatuses.has(input.status)) throw new Error("Choose a valid course status.");
  const updated = { ...course, status: input.status };
  state.courses = state.courses.map((item) => (item.id === course.id ? updated : item));
  appendAudit(
    state,
    ctx,
    "course.status_updated",
    "Course",
    course.id,
    `Set ${course.title} to ${input.status}.`,
    input.actorId ?? "usr_hod_demo",
  );
  return updated;
}

function applyUpdateMaterialPublish(
  state: PlatformState,
  input: UpdateMaterialPublishActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const resource = state.resources.find((item) => item.id === input.id);
  if (!resource) throw new Error(`Resource ${input.id} was not found.`);
  const updated = { ...resource, published: input.published };
  state.resources = state.resources.map((item) => (item.id === resource.id ? updated : item));
  appendAudit(
    state,
    ctx,
    input.published ? "material.published" : "material.unpublished",
    "LessonResource",
    resource.id,
    `${resource.title} marked ${input.published ? "published" : "unpublished"}.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return updated;
}

function applySaveOperationalRecord(
  state: PlatformState,
  input: { module: string; payload: Record<string, string>; actorId?: string },
  ctx: MutationContext,
) {
  const entityId = ctx.createId("record");
  const audit = appendAudit(
    state,
    ctx,
    "record.saved",
    input.module,
    entityId,
    `Saved ${input.module} record: ${input.payload.title ?? input.payload.name ?? entityId}.`,
    input.actorId ?? "usr_admin_demo",
  );
  return { entityId, audit };
}

function teacherActor(state: PlatformState, actorId?: string) {
  const actor = actorId ? state.users.find((item) => item.id === actorId) : undefined;
  return actor?.activeRole === "teacher" ? actor : undefined;
}

function teacherOwnsCourseRun(state: PlatformState, teacherUserId: string, courseRunId: string) {
  return state.courseRuns.some((item) => item.id === courseRunId && item.teacherId === teacherUserId);
}

function teacherOwnsStudentInCourseRun(
  state: PlatformState,
  teacherUserId: string,
  courseRunId: string,
  studentId: string,
) {
  if (!teacherOwnsCourseRun(state, teacherUserId, courseRunId)) return false;
  const courseClassGroups = state.classGroups.filter((group) => group.courseRunId === courseRunId);
  const courseClassGroupIds = new Set(courseClassGroups.map((group) => group.id));
  return (
    courseClassGroups.some((group) => group.studentIds.includes(studentId)) ||
    state.enrollments.some(
      (enrollment) =>
        enrollment.studentId === studentId &&
        enrollment.courseRunId === courseRunId &&
        (!enrollment.classGroupId || courseClassGroupIds.has(enrollment.classGroupId)),
    )
  );
}

function assertTeacherCanUseCourseRun(state: PlatformState, actorId: string | undefined, courseRunId: string, message: string) {
  const actor = teacherActor(state, actorId);
  if (!actor) return;
  if (!teacherOwnsCourseRun(state, actor.id, courseRunId)) throw new Error(message);
}

function assertTeacherCanManageStudentInRun(
  state: PlatformState,
  actorId: string | undefined,
  courseRunId: string,
  studentId: string,
  message: string,
) {
  const actor = teacherActor(state, actorId);
  if (!actor) return;
  if (!teacherOwnsStudentInCourseRun(state, actor.id, courseRunId, studentId)) throw new Error(message);
}

function applyCreateAssignment(
  state: PlatformState,
  input: CreateAssignmentActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const run = state.courseRuns.find((item) => item.id === input.courseRunId);
  if (!run) throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertTeacherCanUseCourseRun(state, input.actorId, input.courseRunId, "Teacher can only create assessments for assigned course runs.");
  if (!input.title.trim()) throw new Error("Assignment title is required.");
  if (!Number.isFinite(new Date(input.dueAt).getTime())) {
    throw new Error("Assignment requires a valid due date.");
  }
  const rubric = input.rubric.map((item) => item.trim()).filter(Boolean);
  const assignment = {
    id: ctx.createId("asg"),
    courseRunId: input.courseRunId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    submissionType: input.submissionType,
    rubric: rubric.length ? rubric : ["Completion", "Accuracy"],
    status: "active" as const,
  };
  state.assignments = [assignment, ...state.assignments];
  appendAudit(
    state,
    ctx,
    "assignment.created",
    "Assignment",
    assignment.id,
    `${assignment.title} created.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return assignment;
}

function applyCreateQuiz(
  state: PlatformState,
  input: CreateQuizActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const run = state.courseRuns.find((item) => item.id === input.courseRunId);
  if (!run) throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertTeacherCanUseCourseRun(state, input.actorId, input.courseRunId, "Teacher can only create assessments for assigned course runs.");
  if (!input.title.trim()) throw new Error("Quiz title is required.");
  if (!Number.isFinite(new Date(input.dueAt).getTime())) {
    throw new Error("Quiz requires a valid due date.");
  }
  const durationMinutes = Math.max(5, Math.round(input.durationMinutes));
  const attemptsAllowed = Math.max(1, Math.round(input.attemptsAllowed));
  const questionTypes = input.questionTypes.map((item) => item.trim()).filter(Boolean);
  const questionIds = normalizeQuizQuestionIds(state, input.courseRunId, input.questionIds ?? []);
  const quiz = {
    id: ctx.createId("quiz"),
    courseRunId: input.courseRunId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    durationMinutes,
    questionTypes: questionTypes.length ? questionTypes : ["short_answer"],
    questionIds,
    attemptsAllowed,
    status: "active" as const,
  };
  state.quizzes = [quiz, ...state.quizzes];
  appendAudit(
    state,
    ctx,
    "quiz.created",
    "Quiz",
    quiz.id,
    `${quiz.title} created.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return quiz;
}

function normalizeQuizQuestionIds(state: PlatformState, courseRunId: string, questionIds: string[]) {
  const uniqueIds = Array.from(new Set(questionIds.map((item) => item.trim()).filter(Boolean)));
  return uniqueIds.map((questionId) => {
    const question = state.questionBankItems.find((item) => item.id === questionId);
    if (!question) throw new Error(`Question ${questionId} was not found.`);
    if (question.courseRunId !== courseRunId) throw new Error("Quiz questions must belong to the same course run.");
    if (question.status !== "active") throw new Error("Only active questions can be attached to a quiz.");
    return question.id;
  });
}

function applySetQuizQuestions(
  state: PlatformState,
  input: { quizId: string; questionIds: string[]; actorId?: string },
  ctx: MutationContext,
) {
  const quiz = requireQuiz(state, input.quizId);
  assertTeacherCanUseCourseRun(state, input.actorId, quiz.courseRunId, "Teacher can only attach questions to assigned course quizzes.");
  const questionIds = normalizeQuizQuestionIds(state, quiz.courseRunId, input.questionIds);
  let updatedQuiz = quiz;
  state.quizzes = state.quizzes.map((item) => {
    if (item.id !== quiz.id) return item;
    updatedQuiz = {
      ...item,
      questionIds,
      questionTypes: Array.from(
        new Set(
          questionIds
            .map((questionId) => state.questionBankItems.find((question) => question.id === questionId)?.type)
            .filter(Boolean) as string[],
        ),
      ),
    };
    return updatedQuiz;
  });
  appendAudit(
    state,
    ctx,
    "quiz.questions.updated",
    "Quiz",
    quiz.id,
    `${questionIds.length} question(s) attached to ${quiz.title}.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return updatedQuiz;
}

function normalizeQuestionType(value: string): QuestionBankItem["type"] {
  const allowed: QuestionBankItem["type"][] = [
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
    "oral_record",
    "file_upload",
  ];
  return allowed.includes(value as QuestionBankItem["type"])
    ? (value as QuestionBankItem["type"])
    : "short_answer";
}

function normalizeQuestionDifficulty(
  value: string,
): QuestionBankItem["difficulty"] {
  const allowed: QuestionBankItem["difficulty"][] = [
    "foundation",
    "core",
    "challenge",
  ];
  return allowed.includes(value as QuestionBankItem["difficulty"])
    ? (value as QuestionBankItem["difficulty"])
    : "core";
}

function applyCreateQuestionBankItem(
  state: PlatformState,
  input: CreateQuestionActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const run = state.courseRuns.find((item) => item.id === input.courseRunId);
  if (!run) throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertTeacherCanUseCourseRun(state, input.actorId, input.courseRunId, "Teacher can only create assessments for assigned course runs.");
  if (!input.prompt.trim()) throw new Error("Question prompt is required.");
  const tags = input.tags.map((item) => item.trim()).filter(Boolean);
  const choices = (input.choices ?? []).map((item) => item.trim()).filter(Boolean);
  const rubric = (input.rubric ?? []).map((item) => item.trim()).filter(Boolean);
  const question: QuestionBankItem = {
    id: ctx.createId("qbi"),
    courseRunId: input.courseRunId,
    prompt: input.prompt.trim(),
    type: normalizeQuestionType(input.questionType),
    difficulty: normalizeQuestionDifficulty(input.difficulty),
    tags: tags.length ? tags : ["review"],
    choices,
    answerKey: input.answerKey?.trim() || undefined,
    rubric: rubric.length ? rubric : ["Accurate answer", "Clear reasoning"],
    createdBy: input.actorId ?? "usr_teacher_demo",
    updatedAt: ctx.now(),
    status: "active",
  };
  state.questionBankItems = [question, ...(state.questionBankItems ?? [])];
  appendAudit(
    state,
    ctx,
    "question.created",
    "QuestionBankItem",
    question.id,
    `Question added for ${run.term}.`,
    question.createdBy,
  );
  return question;
}

function applyGradeAssignmentSubmission(
  state: PlatformState,
  input: { submissionId: string; score: number; feedback: string; actorId?: string },
  ctx: MutationContext,
) {
  const submission = state.assignmentSubmissions.find((item) => item.id === input.submissionId);
  if (!submission) return undefined;
  const assignment = state.assignments.find((item) => item.id === submission.assignmentId);
  if (!assignment) throw new Error(`Assignment ${submission.assignmentId} was not found.`);
  assertTeacherCanManageStudentInRun(
    state,
    input.actorId,
    assignment.courseRunId,
    submission.studentId,
    "Teacher can only grade assigned class submissions.",
  );
  const score = Math.min(100, Math.max(0, Math.round(input.score)));
  const feedback = input.feedback.trim() || "Reviewed by teacher.";
  const updatedSubmission = {
    ...submission,
    status: "completed" as const,
    score,
    feedback,
  };
  state.assignmentSubmissions = state.assignmentSubmissions.map((submission) => {
    if (submission.id !== input.submissionId) return submission;
    return updatedSubmission;
  });

  const existingGrade = state.grades.find(
    (grade) =>
      grade.studentId === updatedSubmission.studentId &&
      grade.courseRunId === assignment.courseRunId &&
      (grade.itemId ? grade.itemId === assignment.id : grade.itemTitle === assignment.title),
  );
  const maxScore = 100;
  if (existingGrade) {
    existingGrade.score = score;
    existingGrade.maxScore = maxScore;
    existingGrade.feedback = feedback;
  } else {
    state.grades = [
      {
        id: ctx.createId("gr"),
        studentId: updatedSubmission.studentId,
        courseRunId: assignment.courseRunId,
        itemId: assignment.id,
        itemTitle: assignment.title,
        score,
        maxScore,
        feedback,
      },
      ...state.grades,
    ];
  }
  const student = state.students.find((item) => item.id === updatedSubmission.studentId);
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Assignment graded",
    body: `${assignment.title} received ${score}/${maxScore}.`,
    href: "/app/student/grades",
  });
  appendAudit(
    state,
    ctx,
    "assignment.graded",
    "AssignmentSubmission",
    updatedSubmission.id,
    `${assignment.title} graded ${score}/${maxScore}.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return updatedSubmission;
}

function applyReviewQuizAttempt(
  state: PlatformState,
  input: { attemptId: string; score: number; feedback: string; actorId?: string },
  ctx: MutationContext,
) {
  const attempt = state.quizAttempts.find((item) => item.id === input.attemptId);
  if (!attempt) return undefined;
  const quiz = state.quizzes.find((item) => item.id === attempt.quizId);
  if (!quiz) throw new Error(`Quiz ${attempt.quizId} was not found.`);
  assertTeacherCanManageStudentInRun(
    state,
    input.actorId,
    quiz.courseRunId,
    attempt.studentId,
    "Teacher can only review assigned class quiz attempts.",
  );
  const score = Math.min(100, Math.max(0, Math.round(input.score)));
  const feedback = input.feedback.trim() || "Reviewed by teacher.";
  const updatedAttempt = {
    ...attempt,
    status: "completed" as const,
    score,
  };
  state.quizAttempts = state.quizAttempts.map((attempt) => {
    if (attempt.id !== input.attemptId) return attempt;
    return updatedAttempt;
  });

  const existingGrade = state.grades.find(
    (grade) =>
      grade.studentId === updatedAttempt.studentId &&
      grade.courseRunId === quiz.courseRunId &&
      (grade.itemId ? grade.itemId === quiz.id : grade.itemTitle === quiz.title),
  );
  const maxScore = 100;
  if (existingGrade) {
    existingGrade.itemId = quiz.id;
    existingGrade.itemTitle = quiz.title;
    existingGrade.score = score;
    existingGrade.maxScore = maxScore;
    existingGrade.feedback = feedback;
  } else {
    state.grades = [
      {
        id: ctx.createId("gr"),
        studentId: updatedAttempt.studentId,
        courseRunId: quiz.courseRunId,
        itemId: quiz.id,
        itemTitle: quiz.title,
        score,
        maxScore,
        feedback,
      },
      ...state.grades,
    ];
  }
  const student = state.students.find((item) => item.id === updatedAttempt.studentId);
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Quiz reviewed",
    body: `${quiz.title} received ${score}/${maxScore}.`,
    href: "/app/student/grades",
  });
  appendAudit(
    state,
    ctx,
    "quiz.reviewed",
    "QuizAttempt",
    updatedAttempt.id,
    `${quiz.title} reviewed ${score}/${maxScore}.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return updatedAttempt;
}

function applySaveAttendanceBulk(
  state: PlatformState,
  input: {
    classGroupId: string;
    sessionId: string;
    statuses: Record<string, AttendanceStatus>;
    notes?: Record<string, string>;
    actorId?: string;
  },
  ctx: MutationContext,
) {
  const session = state.classSessions.find((item) => item.id === input.sessionId || item.eventId === input.sessionId);
  const classGroup = state.classGroups.find((item) => item.id === input.classGroupId);
  if (!classGroup) throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (!session) throw new Error(`Attendance session ${input.sessionId} was not found.`);
  if (session && session.classGroupId !== classGroup.id) throw new Error("Attendance session does not belong to this class group.");
  assertTeacherCanUseCourseRun(state, input.actorId, classGroup.courseRunId, "Teacher can only save attendance for assigned classes.");
  const roster = new Set(classGroup.studentIds);
  const suppliedStudentIds = Object.keys(input.statuses);
  const invalidStudentId = suppliedStudentIds.find((studentId) => !roster.has(studentId));
  if (invalidStudentId) throw new Error(`Student ${invalidStudentId} is not in this class roster.`);
  const missingStudentId = classGroup.studentIds.find((studentId) => !(studentId in input.statuses));
  if (missingStudentId) throw new Error(`Attendance is missing roster student ${missingStudentId}.`);
  const sessionKeys = new Set([input.sessionId, session?.id, session?.eventId].filter(Boolean));
  const canonicalSessionId = session.id;
  const hasAttendanceChange =
    !session.attendanceSaved ||
    classGroup.studentIds.some((studentId) => {
      const existing = state.attendance.find(
        (record) =>
          record.classGroupId === input.classGroupId &&
          sessionKeys.has(record.sessionId) &&
          record.studentId === studentId,
      );
      const note = input.notes?.[studentId]?.trim() || undefined;
      return !existing || existing.status !== input.statuses[studentId] || existing.sessionId !== canonicalSessionId || existing.notes !== note;
    });
  if (!hasAttendanceChange) {
    return state.attendance.filter(
      (record) => record.classGroupId === input.classGroupId && sessionKeys.has(record.sessionId),
    );
  }
  Object.entries(input.statuses).forEach(([studentId, status]) => {
    const existing = state.attendance.find(
      (record) =>
        record.classGroupId === input.classGroupId &&
        sessionKeys.has(record.sessionId) &&
        record.studentId === studentId,
    );
    const note = input.notes?.[studentId]?.trim() || undefined;
    if (existing) {
      existing.status = status;
      existing.sessionId = canonicalSessionId;
      existing.notes = note;
    } else {
      state.attendance = [
        {
          id: ctx.createId("att"),
          classGroupId: input.classGroupId,
          studentId,
          sessionId: canonicalSessionId,
          status,
          notes: note,
        },
        ...state.attendance,
      ];
    }
  });
  state.enrollments = state.enrollments.map((enrollment) => {
    if (enrollment.courseRunId !== classGroup.courseRunId || !roster.has(enrollment.studentId)) return enrollment;
    const canonicalSessionIds = new Set(
      state.classSessions
        .filter(item => item.classGroupId === input.classGroupId)
        .map(item => item.id)
    );
    const studentRecords = state.attendance.filter(
      (record) =>
        record.classGroupId === input.classGroupId &&
        canonicalSessionIds.has(record.sessionId) &&
        record.studentId === enrollment.studentId,
    );
    if (!studentRecords.length) return enrollment;
    const attendedCount = studentRecords.filter((record) => record.status !== "absent").length;
    return {
      ...enrollment,
      attendanceRate: Math.round((attendedCount / studentRecords.length) * 100),
    };
  });
  state.classSessions = state.classSessions.map((item) =>
    item.id === input.sessionId || item.eventId === input.sessionId ? { ...item, attendanceSaved: true } : item,
  );
  appendAudit(
    state,
    ctx,
    "attendance.saved",
    "AttendanceRecord",
    input.classGroupId,
    `Saved attendance for ${Object.keys(input.statuses).length} learner(s).`,
    input.actorId ?? "usr_teacher_demo",
  );
  return state.attendance.filter(
    (record) => record.classGroupId === input.classGroupId && sessionKeys.has(record.sessionId),
  );
}

function calendarWeekday(value: string) {
  return new Date(value).toLocaleDateString("en-US", { weekday: "long" });
}

function calendarTime(value: string) {
  return value.slice(11, 16);
}

function availabilityCoversSlot(
  item: TeacherAvailability,
  input: {
    teacherId: string;
    branchId: string;
    weekday: string;
    startsAt: string;
    endsAt: string;
  },
) {
  return (
    item.teacherId === input.teacherId &&
    item.branchId === input.branchId &&
    item.weekday === input.weekday &&
    item.startsAt <= input.startsAt &&
    item.endsAt >= input.endsAt
  );
}

function applyCreateCalendarEvent(
  state: PlatformState,
  input: CreateCalendarEventActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const ownerId = input.ownerId ?? input.actorId;
  const requestedClassGroup = input.classGroupId ? state.classGroups.find((item) => item.id === input.classGroupId) : undefined;
  const requestedRun = requestedClassGroup ? state.courseRuns.find((item) => item.id === requestedClassGroup.courseRunId) : undefined;
  const requestedRoom = input.roomId ? state.rooms.find((item) => item.id === input.roomId) : undefined;
  const branchId = input.branchId ?? requestedRun?.branchId ?? requestedRoom?.branchId;
  const needsClassGroup = input.eventType === "class_session" || input.eventType === "live_session";
  const needsRoom = input.eventType === "room_booking";
  const starts = new Date(input.startsAt).getTime();
  const ends = new Date(input.endsAt).getTime();
  if (!ownerId) throw new Error("Calendar event requires an owner.");
  if (!branchId) throw new Error("Calendar event requires a branch.");
  if (!state.branches.some((item) => item.id === branchId)) throw new Error(`Branch ${branchId} was not found.`);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts >= ends) {
    throw new Error("Calendar event requires a valid time range.");
  }
  if (needsClassGroup && !input.classGroupId) {
    throw new Error("Calendar class session requires a class group.");
  }
  if (input.classGroupId && !requestedClassGroup) throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (input.classGroupId && !requestedRun) throw new Error("Calendar class group is missing a course run.");
  if (branchId && requestedRun && requestedRun.branchId !== branchId) {
    throw new Error("Calendar class group must belong to the event branch.");
  }
  if (needsRoom && !input.roomId) {
    throw new Error("Room booking requires a room.");
  }
  if (input.roomId && !requestedRoom) throw new Error(`Room ${input.roomId} was not found.`);
  if (branchId && requestedRoom && requestedRoom.branchId !== branchId) {
    throw new Error("Calendar room must belong to the event branch.");
  }
  const classGroupId = requestedClassGroup?.id;
  const scheduleTeacherId = requestedRun?.teacherId;
  const needsTeacherAvailability = Boolean(scheduleTeacherId && classGroupId && (input.eventType === "class_session" || input.eventType === "live_session"));
  const availabilityMatches = needsTeacherAvailability
    ? state.teacherAvailability.filter((item) =>
        availabilityCoversSlot(item, {
          teacherId: scheduleTeacherId!,
          branchId,
          weekday: calendarWeekday(input.startsAt),
          startsAt: calendarTime(input.startsAt),
          endsAt: calendarTime(input.endsAt),
        }),
      )
    : [];
  const availabilityGaps = needsTeacherAvailability && !availabilityMatches.length ? [scheduleTeacherId!] : [];
  const conflicts = state.events.filter((event) => {
    const eventStarts = new Date(event.startsAt).getTime();
    const eventEnds = new Date(event.endsAt).getTime();
    const overlaps = starts < eventEnds && ends > eventStarts;
    if (!overlaps) return false;
    const eventGroup = event.classGroupId
      ? state.classGroups.find((item) => item.id === event.classGroupId)
      : undefined;
    const eventRun = eventGroup
      ? state.courseRuns.find((item) => item.id === eventGroup.courseRunId)
      : undefined;
    const eventTeacherId = eventRun?.teacherId ?? event.ownerId;
    return Boolean(
      (input.roomId && event.roomId === input.roomId) ||
        (ownerId && event.ownerId === ownerId) ||
        (classGroupId && event.classGroupId === classGroupId) ||
        (scheduleTeacherId && eventTeacherId === scheduleTeacherId),
    );
  });
  const event: CalendarEvent = {
    id: ctx.createId("evt"),
    type: input.eventType,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ownerId,
    branchId,
    roomId: input.roomId,
    classGroupId,
    status: conflicts.length || availabilityGaps.length ? "pending" : "active",
  };
  state.events = [event, ...state.events];
  if (event.classGroupId && (event.type === "class_session" || event.type === "live_session")) {
    state.classSessions = [
      {
        id: ctx.createId("session"),
        classGroupId: event.classGroupId,
        eventId: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        attendanceSaved: false,
      },
      ...state.classSessions,
    ];
  }
  appendAudit(
    state,
    ctx,
    conflicts.length || availabilityGaps.length ? "calendar.created_with_conflict" : "calendar.created",
    "CalendarEvent",
    event.id,
    `${event.title} created${conflicts.length ? ` with ${conflicts.length} conflict(s)` : ""}${availabilityGaps.length ? `${conflicts.length ? " and" : " with"} teacher availability review` : ""}.`,
    input.actorId ?? "usr_branch_demo",
  );
  return { event, conflicts, availabilityGaps };
}

function applySendMessage(
  state: PlatformState,
  input: SendMessageActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const fromUserId = input.fromUserId ?? input.actorId ?? "usr_student_demo";
  const recipientUserIds = Array.from(
    new Set([input.toUserId, ...(input.recipientUserIds ?? [])])
  ).filter(Boolean);
  const messages = recipientUserIds.map((toUserId) => {
    const message: Message = {
      id: ctx.createId("msg"),
      fromUserId,
      toUserId,
      subject: input.subject,
      body: input.body,
      attachments: input.attachments?.length ? input.attachments : undefined,
      read: false,
      createdAt: ctx.now(),
    };
    const log: CommunicationLog = {
      id: ctx.createId("comm"),
      actorId: fromUserId,
      channel: input.channel ?? "in_app",
      subject: input.subject,
      body: input.body,
      attachments: input.attachments?.length ? input.attachments : undefined,
      relatedUserId: toUserId,
      status: "completed",
      createdAt: ctx.now(),
    };
    const recipient = state.users.find((user) => user.id === toUserId);
    state.communicationLogs = [log, ...state.communicationLogs];
    notify(state, ctx, {
      userId: toUserId,
      title: input.subject,
      body: input.body,
      href: messageRouteForUser(recipient),
    });
    appendAudit(state, ctx, "message.sent", "Message", message.id, `Sent message: ${message.subject}.`, fromUserId);
    return message;
  });
  state.messages = [...messages, ...state.messages];
  return messages[0];
}

function applyApproveCertificate(
  state: PlatformState,
  input: { certificateId: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "approved" || certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "pending_approval") return certificate;
    if (certificate.grade < 80 || certificate.attendanceRate < 80) return certificate;
    changed = true;
    updated = {
      ...certificate,
      status: "approved",
      approvedBy: input.actorId ?? "usr_hod_demo",
      approvedAt: ctx.now(),
    };
    return updated;
  });
  if (updated && changed) {
    appendAudit(
      state,
      ctx,
      "certificate.approved",
      "Certificate",
      updated.id,
      `Approved certificate ${updated.verificationCode}.`,
      input.actorId ?? "usr_hod_demo",
    );
  }
  return updated;
}

function applyIssueCertificate(
  state: PlatformState,
  input: { certificateId: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "approved") return certificate;
    changed = true;
    updated = {
      ...certificate,
      status: "issued",
      issuedBy: input.actorId ?? "usr_hod_demo",
      issuedAt: ctx.now(),
    };
    return updated;
  });
  if (updated && changed) {
    const student = state.students.find((item) => item.id === updated?.studentId);
    const studentId = updated.studentId;
    const verificationCode = updated.verificationCode;
    const documentUrl = `#certificate-${updated.id}`;
    const existingDocument = state.documents.find(
      (item) =>
        item.ownerId === studentId &&
        item.type === "certificate" &&
        (item.url === documentUrl || item.url === "#certificate-preview"),
    );
    if (existingDocument) {
      state.documents = state.documents.map((item) =>
        item.id === existingDocument.id
          ? {
              ...item,
              title: `${verificationCode} certificate`,
              url: documentUrl,
              status: "active" as EntityStatus,
            }
          : item,
      );
    } else {
      state.documents = [
        {
          id: ctx.createId("doc"),
          ownerId: studentId,
          title: `${verificationCode} certificate`,
          type: "certificate",
          url: documentUrl,
          status: "active",
        },
        ...state.documents,
      ];
    }
    notify(state, ctx, {
      userId: student?.userId ?? updated.studentId,
      title: "Certificate issued",
      body: `${updated.verificationCode} is ready to download.`,
      href: "/app/student/certificates",
    });
    appendAudit(
      state,
      ctx,
      "certificate.issued",
      "Certificate",
      updated.id,
      `Issued certificate ${updated.verificationCode}.`,
      input.actorId ?? "usr_hod_demo",
    );
  }
  return updated;
}

function applyRejectCertificate(
  state: PlatformState,
  input: { certificateId: string; reason: string; actorId?: string },
  ctx: MutationContext,
) {
  const reason = input.reason.trim();
  if (!reason) return undefined;
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "issued" || certificate.status === "revoked") return certificate;
    if (certificate.status === "rejected") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "pending_approval" && certificate.status !== "approved") return certificate;
    changed = true;
    updated = {
      ...certificate,
      status: "rejected",
      approvedBy: undefined,
      approvedAt: undefined,
      issuedBy: undefined,
      issuedAt: undefined,
      rejectedBy: input.actorId ?? "usr_hod_demo",
      rejectedAt: ctx.now(),
      rejectionReason: reason,
    };
    return updated;
  });
  if (updated && changed) {
    appendAudit(
      state,
      ctx,
      "certificate.rejected",
      "Certificate",
      updated.id,
      `Rejected certificate ${updated.verificationCode}: ${reason}.`,
      input.actorId ?? "usr_hod_demo",
    );
  }
  return updated;
}

function applyRecordPayment(
  state: PlatformState,
  input: {
    invoiceId: string;
    amount?: number;
    method?: Payment["method"];
    reference?: string;
    actorId?: string;
  },
  ctx: MutationContext,
) {
  const invoice = state.invoices.find((item) => item.id === input.invoiceId);
  if (!invoice) return undefined;
  const student = state.students.find((item) => item.id === invoice.studentId);
  const user = state.users.find((item) => item.id === student?.userId);
  const enrollment = state.enrollments.find((item) => item.studentId === invoice.studentId);
  const classGroup = state.classGroups.find((item) => item.id === enrollment?.classGroupId);
  const paidSoFar = state.payments
    .filter((payment) => payment.invoiceId === invoice.id && payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = Math.max(0, invoice.amount - paidSoFar);
  const requestedAmount = Number.isFinite(input.amount) ? Number(input.amount) : outstanding;
  const amount = Math.min(outstanding, Math.max(0, Math.round(requestedAmount)));
  if (amount <= 0 || outstanding <= 0 || invoice.status === "paid") {
    return state.payments.find((payment) => payment.invoiceId === invoice.id && payment.status === "paid");
  }
  const nextPaid = paidSoFar + amount;
  const nextStatus: Payment["status"] = nextPaid >= invoice.amount ? "paid" : "pending";
  const payment: Payment = {
    id: ctx.createId("pay"),
    invoiceId: invoice.id,
    amount,
    method: input.method ?? "manual",
    reference: input.reference?.trim() || undefined,
    paidAt: ctx.now(),
    status: "paid",
  };
  state.payments = [payment, ...state.payments];
  state.invoices = state.invoices.map((item) => (item.id === invoice.id ? { ...item, status: nextStatus } : item));
  appendAudit(
    state,
    ctx,
    "payment.recorded",
    "Payment",
    payment.id,
    `Recorded ${invoice.currency} ${amount} for ${user?.name ?? invoice.studentId} on ${invoice.id}${enrollment ? ` / ${enrollment.id}` : ""}${classGroup ? ` / ${classGroup.name}` : ""}; balance ${Math.max(0, invoice.amount - nextPaid)}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return payment;
}

function applyRecordPlacementResult(
  state: PlatformState,
  input: { bookingId: string; recommendedLevel: string; score: number; notes: string; actorId?: string },
  ctx: MutationContext,
) {
  const booking = state.placementTests.find((item) => item.id === input.bookingId) ?? state.placementTests[0];
  if (!booking) return undefined;
  const target = resolveCourseTarget(state, {
    courseInterest: booking.subject,
    recommendedLevel: input.recommendedLevel,
    currentLevel: booking.currentLevel,
  });
  const existing = state.placementResults.find((item) => item.bookingId === booking.id);
  const result: PlacementTestResult = {
    id: existing?.id ?? ctx.createId("ptr"),
    bookingId: booking.id,
    examinerId: "usr_teacher_demo",
    score: input.score,
    recommendedLevel: input.recommendedLevel,
    notes: input.notes,
    createdAt: ctx.now(),
  };
  state.placementResults = existing
    ? state.placementResults.map((item) => (item.id === existing.id ? result : item))
    : [result, ...state.placementResults];
  state.placementTests = state.placementTests.map((item) =>
    item.id === booking.id ? { ...item, status: "completed", recommendedLevel: input.recommendedLevel } : item,
  );
  const existingWorkflow = state.enrollmentWorkflows.find((workflow) => workflow.placementTestId === booking.id);
  const workflow = {
    id: existingWorkflow?.id ?? ctx.createId("ew"),
    leadId: booking.leadId,
    placementTestId: booking.id,
    targetCourseId: target.course.id,
    targetLevelId: target.course.levelId,
    recommendedLevel: input.recommendedLevel,
    source: "placement" as const,
    status: "ready_to_enroll" as const,
    nextStep: "Confirm level, assign class, and activate portal",
    updatedAt: ctx.now(),
  };
  state.enrollmentWorkflows = existingWorkflow
    ? state.enrollmentWorkflows.map((item) => (item.id === existingWorkflow.id ? workflow : item))
    : [workflow, ...state.enrollmentWorkflows];
  appendAudit(
    state,
    ctx,
    existing ? "placement.result_updated" : "placement.result_recorded",
    "PlacementTestResult",
    result.id,
    `Recorded placement result for ${booking.fullName}: ${input.recommendedLevel} for ${target.course.title}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return result;
}

function applyConvertLeadToApplication(
  state: PlatformState,
  input: { leadId: string; branchId?: string; actorId?: string },
  ctx: MutationContext,
) {
  const lead = state.leads.find((item) => item.id === input.leadId) ?? state.leads[0];
  if (!lead) return undefined;
  const existing = state.applications.find((item) => item.leadId === lead.id);
  if (existing) return existing;
  const branchId = input.branchId ?? defaultAdmissionsBranchId(state, input.actorId);
  if (!state.branches.some((branch) => branch.id === branchId)) throw new Error("Choose a valid branch for this application.");
  state.leads = state.leads.map((item) => (item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item));
  const application = {
    id: ctx.createId("app"),
    leadId: lead.id,
    branchId,
    courseInterest: lead.subject,
    schedulePreference: "To confirm",
    status: "pending" as EntityStatus,
  };
  state.applications = [application, ...state.applications];
  appendInternalCommunicationLog(state, ctx, {
    actorId: input.actorId ?? "usr_registrar_demo",
    subject: "Lead conversion",
    body: `Internal application file prepared for ${lead.fullName}; no external message was sent.`,
  });
  appendAudit(
    state,
    ctx,
    "lead.converted",
    "Application",
    application.id,
    `Converted ${lead.fullName} to application.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return application;
}

function applyConvertApplicationToEnrollmentWorkflow(
  state: PlatformState,
  input: { applicationId: string; actorId?: string },
  ctx: MutationContext,
) {
  const application = state.applications.find((item) => item.id === input.applicationId);
  if (!application) return undefined;
  const lead = state.leads.find((item) => item.id === application.leadId);
  if (!lead) throw new Error("Application must stay linked to an intake lead before enrollment.");
  const target = resolveCourseTarget(state, {
    courseInterest: application.courseInterest,
    currentLevel: lead?.notes,
  });
  const existingWorkflow = state.enrollmentWorkflows.find(
    (workflow) => workflow.applicationId === application.id || (workflow.leadId === application.leadId && !workflow.placementTestId),
  );
  const workflow = {
    id: existingWorkflow?.id ?? ctx.createId("ew"),
    leadId: application.leadId,
    applicationId: application.id,
    targetCourseId: target.course.id,
    targetLevelId: target.course.levelId,
    recommendedLevel: target.level?.title ?? application.courseInterest,
    source: "application" as const,
    status: "ready_to_enroll" as const,
    nextStep: "Assign course run, class group, and activate portal",
    updatedAt: ctx.now(),
  };
  state.enrollmentWorkflows = existingWorkflow
    ? state.enrollmentWorkflows.map((item) => (item.id === existingWorkflow.id ? workflow : item))
    : [workflow, ...state.enrollmentWorkflows];
  state.applications = state.applications.map((item) =>
    item.id === application.id ? { ...item, status: "approved" } : item,
  );
  if (lead) {
    state.leads = state.leads.map((item) => (item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item));
  }
  if (!existingWorkflow) {
    appendInternalCommunicationLog(state, ctx, {
      actorId: input.actorId ?? "usr_registrar_demo",
      subject: "Enrollment handoff",
      body: `Internal enrollment handoff prepared for ${lead.fullName}; no external message was sent.`,
    });
  }
  appendAudit(
    state,
    ctx,
    "application.converted",
    "EnrollmentWorkflow",
    workflow.id,
    `Prepared enrollment workflow for ${lead?.fullName ?? application.id}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return workflow;
}

function applyCreateStudentLifecycleAccount(
  state: PlatformState,
  input: CreateStudentActionInput,
  ctx: MutationContext,
) {
  const result = createStudentEnrollmentRecords(state, input, ctx);
  if (input.leadId) {
    state.leads = state.leads.map((item) => (item.id === input.leadId ? { ...item, status: result.student.status } : item));
  }
  if (input.applicationId) {
    state.applications = state.applications.map((item) => (item.id === input.applicationId ? { ...item, status: "approved" } : item));
  }
  if (input.placementTestId) {
    state.placementTests = state.placementTests.map((item) =>
      item.id === input.placementTestId ? { ...item, status: "completed", recommendedLevel: result.student.currentLevel } : item,
    );
  }
  appendAudit(
    state,
    ctx,
    "student.created",
    "StudentProfile",
    result.student.id,
    `Created ${result.user.name} from ${result.student.source ?? "direct"} intake.`,
    input.actorId ?? "usr_registrar_demo",
  );
  appendAudit(
    state,
    ctx,
    "enrollment.created",
    "Enrollment",
    result.enrollment.id,
    `Assigned ${result.user.name} to ${result.course.title}, ${result.classGroup.name}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return result;
}

function applyUpdateStudentStatus(
  state: PlatformState,
  input: UpdateStudentStatusActionInput,
  ctx: MutationContext,
) {
  const student = state.students.find((item) => item.id === input.studentId);
  if (!student) throw new Error("Student record was not found.");
  const status = normalizeStudentStatus(input.status);
  const user = state.users.find((item) => item.id === student.userId);
  const notes = input.notes?.trim();
  state.students = state.students.map((item) =>
    item.id === student.id ? { ...item, status, notes: notes ? `${item.notes ? `${item.notes} · ` : ""}${notes}` : item.notes } : item,
  );
  state.users = state.users.map((item) =>
    item.id === student.userId ? { ...item, status: accountStatusFromStudentStatus(status) } : item,
  );
  state.enrollments = state.enrollments.map((item) =>
    item.studentId === student.id ? { ...item, status } : item,
  );
  appendAudit(
    state,
    ctx,
    "student.status_updated",
    "StudentProfile",
    student.id,
    `Set ${user?.name ?? student.id} to ${status}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return state.students.find((item) => item.id === student.id);
}

function applyActivateEnrollmentWorkflow(
  state: PlatformState,
  input: { workflowId: string; courseRunId?: string; classGroupId?: string; actorId?: string },
  ctx: MutationContext,
) {
  const workflow = state.enrollmentWorkflows.find((item) => item.id === input.workflowId);
  if (!workflow) return undefined;

  const existingStudent = workflow.studentId ? state.students.find((student) => student.id === workflow.studentId) : undefined;
  if (existingStudent) {
    const existingEnrollment = state.enrollments.find((enrollment) => enrollment.studentId === existingStudent.id);
    if (input.courseRunId && existingEnrollment?.courseRunId && input.courseRunId !== existingEnrollment.courseRunId) {
      throw new Error("Activated enrollment workflows cannot be reassigned to a different course run.");
    }
    if (input.classGroupId && existingEnrollment?.classGroupId && input.classGroupId !== existingEnrollment.classGroupId) {
      throw new Error("Activated enrollment workflows cannot be reassigned to a different class group.");
    }
    return existingStudent;
  }

  const lead = workflow.leadId ? state.leads.find((item) => item.id === workflow.leadId) : undefined;
  const application = workflow.applicationId ? state.applications.find((item) => item.id === workflow.applicationId) : undefined;
  const placement = workflow.placementTestId ? state.placementTests.find((item) => item.id === workflow.placementTestId) : undefined;
  const placementResult = workflow.placementTestId ? state.placementResults.find((item) => item.bookingId === workflow.placementTestId) : undefined;
  const targetCourseId = workflow.targetCourseId;
  const courseRun =
    state.courseRuns.find((run) => run.id === input.courseRunId && run.courseId === targetCourseId) ??
    state.courseRuns.find((run) => run.courseId === targetCourseId && run.status === "active") ??
    state.courseRuns.find((run) => run.courseId === targetCourseId);
  if (!courseRun) return undefined;
  const classGroup =
    state.classGroups.find((group) => group.id === input.classGroupId && group.courseRunId === courseRun.id) ??
    state.classGroups.find((group) => group.courseRunId === courseRun.id && group.studentIds.length < group.capacity) ??
    state.classGroups.find((group) => group.courseRunId === courseRun.id);
  if (!classGroup || classGroup.studentIds.length >= classGroup.capacity) return undefined;

  const branch = state.branches.find((item) => item.id === courseRun.branchId);
  const course = state.courses.find((item) => item.id === courseRun.courseId);
  const program = state.programs.find((item) => item.id === course?.programId);
  const packageRow = state.packages.find((item) => item.courseId === courseRun.courseId && item.status === "active");
  const resolvedLevelLabel =
    placementResult?.recommendedLevel ??
    placement?.recommendedLevel ??
    workflow.recommendedLevel ??
    placement?.currentLevel ??
    state.levels.find((level) => level.id === workflow.targetLevelId || level.id === course?.levelId)?.title ??
    "Placement pending";
  const name = (lead?.fullName ?? placement?.fullName ?? "").trim();
  const email = (lead?.email ?? placement?.email ?? "").trim().toLowerCase();
  const phone = (lead?.phone ?? placement?.phone ?? "").trim();
  if (!name || !email || !phone) {
    throw new Error("Enrollment activation requires lead or placement identity with name, email, and phone.");
  }
  if (!email.includes("@")) {
    throw new Error("Enrollment activation requires a valid intake email.");
  }
  if (state.users.some((item) => item.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }
  const studentStatus: StudentStatus = "active";
  const userId = ctx.createId("usr_student");
  const studentId = ctx.createId("stu");
  const enrollmentId = ctx.createId("enr");
  const invoiceId = ctx.createId("inv");

  state.users = [
    {
      id: userId,
      name,
      email,
      phone,
      notes: lead?.notes,
      roles: ["student"],
      activeRole: "student",
      branchId: courseRun.branchId,
      departmentId: program?.departmentId ?? "dep_arabic",
      status: "active",
    },
    ...state.users,
  ];
  state.students = [
    {
      id: studentId,
      userId,
      status: studentStatus,
      source: workflow.source ?? (workflow.placementTestId ? "placement" : workflow.applicationId ? "application" : "lead"),
      currentLevel: resolvedLevelLabel,
      courseInterest: application?.courseInterest ?? placement?.subject ?? lead?.subject,
      notes: lead?.notes,
      country: lead?.country ?? "Egypt",
      preferredLanguage: program?.language ?? "English",
      timezone: branch?.timezone ?? "Africa/Cairo",
    },
    ...state.students,
  ];
  state.enrollments = [
    {
      id: enrollmentId,
      studentId,
      courseRunId: courseRun.id,
      levelId: course?.levelId,
      classGroupId: classGroup.id,
      teacherId: courseRun.teacherId,
      source: workflow.source ?? (workflow.placementTestId ? "placement" : workflow.applicationId ? "application" : "lead"),
      status: studentStatus,
      progress: 0,
      attendanceRate: 0,
      currentGrade: 0,
      createdAt: ctx.now(),
    },
    ...state.enrollments,
  ];
  state.classGroups = state.classGroups.map((group) =>
    group.id === classGroup.id ? { ...group, studentIds: [...group.studentIds, studentId] } : group,
  );
  const lessonIds = state.modules
    .filter((module) => module.courseId === courseRun.courseId)
    .flatMap((module) => state.lessons.filter((lesson) => lesson.moduleId === module.id).map((lesson) => lesson.id));
  state.lessonProgress = [
    ...lessonIds.map((lessonId) => ({
      id: ctx.createId("lp"),
      studentId,
      lessonId,
      status: "not_started" as const,
    })),
    ...state.lessonProgress,
  ];
  state.invoices = [
    {
      id: invoiceId,
      studentId,
      amount: packageRow?.amount ?? 0,
      currency: packageRow?.currency ?? "EGP",
      dueAt: ctx.now().slice(0, 10),
      status: "pending",
    },
    ...state.invoices,
  ];
  state.enrollmentWorkflows = state.enrollmentWorkflows.map((item) =>
    item.id === workflow.id
      ? {
          ...item,
          studentId,
          courseRunId: courseRun.id,
          classGroupId: classGroup.id,
          status: studentStatus,
          nextStep: "Portal active, class assigned, invoice pending payment",
          updatedAt: ctx.now(),
        }
      : item,
  );
  if (lead) {
    state.leads = state.leads.map((item) => (item.id === lead.id ? { ...item, status: "active" } : item));
  }
  if (application) {
    state.applications = state.applications.map((item) => (item.id === application.id ? { ...item, status: "approved" } : item));
  }
  appendAudit(
    state,
    ctx,
    "student.created",
    "StudentProfile",
    studentId,
    `Created ${name} from ${workflow.source ?? "enrollment"} workflow.`,
    input.actorId ?? "usr_registrar_demo",
  );
  appendAudit(
    state,
    ctx,
    "enrollment.activated",
    "EnrollmentWorkflow",
    workflow.id,
    `Activated ${name} for ${course?.title ?? courseRun.courseId} in ${classGroup.name}; enrollment ${enrollmentId}, invoice ${invoiceId}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return state.students.find((student) => student.id === studentId);
}

const weekdayAliases: Record<string, string> = {
  sun: "Sunday",
  sunday: "Sunday",
  mon: "Monday",
  monday: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  wed: "Wednesday",
  wednesday: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thursday: "Thursday",
  fri: "Friday",
  friday: "Friday",
  sat: "Saturday",
  saturday: "Saturday",
};

function normalizeTime(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addMinutesToTime(value: string, minutes: number) {
  const [hour, minute] = value.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, hour * 60 + minute + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseTeacherAvailabilitySlot(input: string, branchId: string, teacherId: string, ctx: MutationContext) {
  const normalized = input.trim();
  const weekdayMatch = normalized.match(/[A-Za-z]+/);
  const weekday = weekdayMatch ? weekdayAliases[weekdayMatch[0].toLowerCase()] : undefined;
  const times = normalized.match(/\d{1,2}:\d{2}/g) ?? [];
  const startsAt = normalizeTime(times[0] ?? "");
  const endsAt = normalizeTime(times[1] ?? "") ?? (startsAt ? addMinutesToTime(startsAt, 90) : undefined);
  if (!weekday || !startsAt || !endsAt || startsAt >= endsAt) return undefined;
  return {
    id: ctx.createId("avail"),
    teacherId,
    weekday,
    startsAt,
    endsAt,
    branchId,
  } satisfies TeacherAvailability;
}

function studentStatusFromAccountStatus(status: EntityStatus): StudentStatus {
  if (status === "paused") return "paused";
  if (status === "pending") return "ready_to_enroll";
  return "active";
}

function accountStatusFromStudentStatus(status: StudentStatus): EntityStatus {
  if (status === "paused") return "paused";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "lead" || status === "trial_booked" || status === "placement_booked" || status === "placement_completed" || status === "ready_to_enroll") {
    return "pending";
  }
  return "active";
}

const accountStatuses: EntityStatus[] = ["active", "pending", "paused"];
const studentLifecycleStatuses: StudentStatus[] = [
  "lead",
  "trial_booked",
  "placement_booked",
  "placement_completed",
  "ready_to_enroll",
  "enrolled",
  "active",
  "paused",
  "completed",
  "cancelled",
];
const staffRoles: StaffRole[] = ["teacher", "registrar", "headofdepartment", "branchadmin", "superadmin"];
const staffPermissionScopes = new Set<StaffPermissionScope>(["department", "branch", "admissions", "operations", "global"]);
const staffAvailabilityStatuses = new Set<StaffAvailabilityStatus>(["available", "limited", "unavailable", "not_applicable"]);
const defaultStaffScopeByRole: Record<StaffRole, StaffPermissionScope> = {
  teacher: "department",
  registrar: "admissions",
  headofdepartment: "department",
  branchadmin: "operations",
  superadmin: "global",
};
const defaultOperationalScopeByRole: Record<StaffRole, string[]> = {
  teacher: ["classes", "attendance", "grading"],
  registrar: ["leads", "placement", "enrollments", "payments"],
  headofdepartment: ["curriculum", "teachers", "certificates", "reports"],
  branchadmin: ["rooms", "schedule", "attendance", "payments"],
  superadmin: ["users", "roles", "permissions", "audit"],
};
const staffTitleByRole: Record<StaffRole, string> = {
  teacher: "Teacher",
  registrar: "Registrar",
  headofdepartment: "Head of Department",
  branchadmin: "Branch Admin",
  superadmin: "Super Admin",
};

function validateAccountScope(state: PlatformState, input: CreateUserActionInput) {
  if (!roleOrder.includes(input.role)) {
    throw new Error("Choose a valid account role.");
  }
  const status = validateAccountStatus(input.status);
  const branch = state.branches.find((item) => item.id === input.branchId);
  if (!branch) {
    throw new Error("Choose a valid branch for this account.");
  }
  const department = state.departments.find((item) => item.id === input.departmentId);
  if (!department) {
    throw new Error("Choose a valid department for this account.");
  }
  if (!department.branchIds.includes(branch.id) && branch.id !== "br_global") {
    throw new Error("Selected department is not available in the chosen branch.");
  }
  return { status, branch, department };
}

function normalizeStaffScopeInput(input: CreateStaffUserActionInput) {
  if ((input.role as Role) === "student") {
    throw new Error("Student accounts must be created through registrar admissions.");
  }
  if (!staffRoles.includes(input.role)) throw new Error("Choose a staff role.");
  const branchId = input.role === "superadmin" ? input.branchId ?? "br_global" : input.branchId;
  const departmentId = input.role === "superadmin" ? input.departmentId ?? "dep_platform" : input.departmentId;
  const permissionScope = input.permissionScope ?? defaultStaffScopeByRole[input.role];
  const availabilityStatus = input.availabilityStatus ?? (input.role === "teacher" ? "available" : "not_applicable");
  return { branchId, departmentId, permissionScope, availabilityStatus };
}

function validateStaffAccountScope(state: PlatformState, input: CreateStaffUserActionInput) {
  const status = validateAccountStatus(input.status);
  const { branchId, departmentId, permissionScope, availabilityStatus } = normalizeStaffScopeInput(input);
  if (!staffPermissionScopes.has(permissionScope)) throw new Error("Choose a valid permission scope.");
  if (!staffAvailabilityStatuses.has(availabilityStatus)) throw new Error("Choose a valid availability status.");
  const branch = state.branches.find((item) => item.id === branchId);
  if (!branch) throw new Error("Choose a valid branch for this staff account.");
  const department = state.departments.find((item) => item.id === departmentId);
  if (!department) throw new Error("Choose a valid department for this staff account.");
  if (!department.branchIds.includes(branch.id) && branch.id !== "br_global") {
    throw new Error("Selected department is not available in the chosen branch.");
  }
  if (input.role === "teacher") {
    if (!input.subjects?.map((item) => item.trim()).filter(Boolean).length) {
      throw new Error("Teacher accounts require at least one subject.");
    }
    if (!input.teachingLevels?.map((item) => item.trim()).filter(Boolean).length) {
      throw new Error("Teacher accounts require at least one teaching level.");
    }
    if (availabilityStatus === "not_applicable") {
      throw new Error("Teacher accounts require an availability status.");
    }
  }
  if (input.role === "registrar" && permissionScope !== "admissions") {
    throw new Error("Registrar accounts require admissions permission scope.");
  }
  if (input.role === "headofdepartment" && permissionScope !== "department") {
    throw new Error("HOD accounts require department permission scope.");
  }
  if (input.role === "branchadmin") {
    if (permissionScope !== "operations") throw new Error("Branch admin accounts require operations permission scope.");
    if (!input.operationalScope?.map((item) => item.trim()).filter(Boolean).length) {
      throw new Error("Branch admin accounts require at least one operational scope.");
    }
  }
  if (input.role === "superadmin" && permissionScope !== "global") {
    throw new Error("Super admin accounts require global permission scope.");
  }
  return { status, branch, department, branchId: branch.id, departmentId: department.id, permissionScope, availabilityStatus };
}

function isMinorAgeGroup(ageGroup: string) {
  const normalized = ageGroup.trim().toLowerCase();
  return Boolean(normalized && !/adult|18\+|university|parent not required/.test(normalized));
}

const defaultNotificationPreferences: UserNotificationPreferences = {
  messages: true,
  schedule: true,
  academic: true,
  billing: false,
  system: false,
};

function cleanProfileText(value: string | undefined, maxLength = 120) {
  return value === undefined ? undefined : value.trim().slice(0, maxLength);
}

function normalizeNotificationPreferences(
  input: Partial<UserNotificationPreferences> | undefined,
  current?: UserNotificationPreferences,
) {
  if (!input) return current;
  return {
    ...defaultNotificationPreferences,
    ...current,
    ...Object.fromEntries(
      Object.entries(input).filter((entry): entry is [keyof UserNotificationPreferences, boolean] => typeof entry[1] === "boolean"),
    ),
  };
}

function normalizeStudentStatus(status?: StudentStatus) {
  const nextStatus = status ?? "active";
  if (!studentLifecycleStatuses.includes(nextStatus)) throw new Error("Choose a valid student status.");
  return nextStatus;
}

function resolveCourseTarget(
  state: PlatformState,
  input: {
    courseInterest?: string;
    recommendedLevel?: string;
    currentLevel?: string;
    targetCourseId?: string;
  },
) {
  const text = `${input.courseInterest ?? ""} ${input.recommendedLevel ?? ""} ${input.currentLevel ?? ""}`.toLowerCase();
  const targetCourseId =
    input.targetCourseId ??
    (/(quran|tajweed|recitation|memorization|memorisation)/i.test(text) ? "course_qt_1" : "course_ar_l3");
  const course =
    state.courses.find((item) => item.id === targetCourseId) ??
    state.courses.find((item) => text && item.title.toLowerCase().includes(text)) ??
    state.courses.find((item) => item.id === "course_ar_l3") ??
    state.courses[0];
  if (!course) throw new Error("Choose a valid course for this student.");
  const level = state.levels.find((item) => item.id === course.levelId);
  return { course, level };
}

function resolveEnrollmentAssignment(
  state: PlatformState,
  input: { branchId: string; courseRunId: string; classGroupId: string; targetCourseId?: string },
) {
  const branch = state.branches.find((item) => item.id === input.branchId);
  if (!branch) throw new Error("Choose a valid branch for this student.");
  const courseRun = state.courseRuns.find((item) => item.id === input.courseRunId);
  if (!courseRun) throw new Error("Choose a valid course run for this student.");
  if (input.targetCourseId && courseRun.courseId !== input.targetCourseId) {
    throw new Error("Selected course run must match the student course interest.");
  }
  if (courseRun.branchId !== branch.id) {
    throw new Error("Student branch must match the selected course and class branch.");
  }
  const classGroup = state.classGroups.find((item) => item.id === input.classGroupId);
  if (!classGroup || classGroup.courseRunId !== courseRun.id) {
    throw new Error("Selected class group must belong to the selected course run.");
  }
  if (classGroup.studentIds.length >= classGroup.capacity) {
    throw new Error("Selected class is already at capacity.");
  }
  return { branch, courseRun, classGroup };
}

function createStudentEnrollmentRecords(
  state: PlatformState,
  input: CreateStudentActionInput,
  ctx: MutationContext,
) {
  const name = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const preferredLanguage = input.preferredLanguage.trim() || "English";
  const courseInterest = input.courseInterest.trim();
  const ageGroup = input.ageGroup.trim();
  const currentLevel = (input.placementResult ?? input.currentLevel ?? "").trim();
  const studentStatus = normalizeStudentStatus(input.status);

  if (!name || !email || !phone) throw new Error("Full name, email, and phone are required.");
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (state.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }
  if (!courseInterest) throw new Error("Subject or course interest is required.");
  if (!ageGroup) throw new Error("Age group is required.");
  if (isMinorAgeGroup(ageGroup) && (!input.guardianName?.trim() || !input.guardianPhone?.trim())) {
    throw new Error("Guardian name and phone are required for minor students.");
  }
  if (!currentLevel) throw new Error("Current level or placement result is required.");

  const target = resolveCourseTarget(state, {
    courseInterest,
    recommendedLevel: input.placementResult,
    currentLevel,
  });
  const { branch, courseRun, classGroup } = resolveEnrollmentAssignment(state, {
    branchId: input.branchId,
    courseRunId: input.courseRunId,
    classGroupId: input.classGroupId,
    targetCourseId: target.course.id,
  });
  const program = state.programs.find((item) => item.id === target.course.programId);
  const packageRow = state.packages.find((item) => item.courseId === courseRun.courseId && item.status === "active");
  const userId = ctx.createId("usr_student");
  const studentId = ctx.createId("stu");
  const enrollmentId = ctx.createId("enr");
  const source = input.source ?? "direct";
  const user = {
    id: userId,
    name,
    email,
    phone,
    notes: input.notes?.trim() || undefined,
    roles: ["student"],
    activeRole: "student",
    branchId: branch.id,
    departmentId: program?.departmentId ?? "dep_arabic",
    status: accountStatusFromStudentStatus(studentStatus),
  } satisfies PlatformState["users"][number];
  const student = {
    id: studentId,
    userId,
    status: studentStatus,
    source,
    guardianName: input.guardianName?.trim() || undefined,
    guardianPhone: input.guardianPhone?.trim() || undefined,
    currentLevel,
    ageGroup,
    courseInterest,
    notes: input.notes?.trim() || undefined,
    country: "Egypt",
    preferredLanguage,
    timezone: branch.timezone,
  } satisfies PlatformState["students"][number];
  const enrollment = {
    id: enrollmentId,
    studentId,
    courseRunId: courseRun.id,
    levelId: target.course.levelId,
    classGroupId: classGroup.id,
    teacherId: courseRun.teacherId,
    source,
    status: studentStatus,
    progress: 0,
    attendanceRate: 0,
    currentGrade: 0,
    createdAt: ctx.now(),
  } satisfies PlatformState["enrollments"][number];
  const lessonIds = state.modules
    .filter((module) => module.courseId === courseRun.courseId)
    .flatMap((module) => state.lessons.filter((lesson) => lesson.moduleId === module.id).map((lesson) => lesson.id));
  const invoice = packageRow
    ? {
        id: ctx.createId("inv"),
        studentId,
        amount: packageRow.amount,
        currency: packageRow.currency,
        dueAt: ctx.now().slice(0, 10),
        status: "pending" as const,
      }
    : undefined;

  state.users = [user, ...state.users];
  state.students = [student, ...state.students];
  state.enrollments = [enrollment, ...state.enrollments];
  state.classGroups = state.classGroups.map((group) =>
    group.id === classGroup.id ? { ...group, studentIds: [...group.studentIds, studentId] } : group,
  );
  state.lessonProgress = [
    ...lessonIds.map((lessonId) => ({
      id: ctx.createId("lp"),
      studentId,
      lessonId,
      status: "not_started" as const,
    })),
    ...state.lessonProgress,
  ];
  if (invoice) state.invoices = [invoice, ...state.invoices];

  return {
    user,
    student,
    enrollment,
    classGroup,
    courseRun,
    course: target.course,
    level: target.level,
    invoice,
  };
}

function validateUserScopeUpdate(state: PlatformState, input: UpdateUserActionInput, currentUser: PlatformState["users"][number]) {
  const nextBranchId = input.branchId ?? currentUser.branchId;
  const nextDepartmentId = input.departmentId ?? currentUser.departmentId;
  const branch = state.branches.find((item) => item.id === nextBranchId);
  if (!branch) {
    throw new Error("Choose a valid branch for this account.");
  }
  const department = state.departments.find((item) => item.id === nextDepartmentId);
  if (!department) {
    throw new Error("Choose a valid department for this account.");
  }
  if (!department.branchIds.includes(branch.id) && branch.id !== "br_global") {
    throw new Error("Selected department is not available in the chosen branch.");
  }
  return { branch, department };
}

function applyUpdateProfile(
  state: PlatformState,
  input: UpdateProfileActionInput,
  ctx: MutationContext,
) {
  const userId = input.userId ?? input.actorId;
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new Error("Profile account was not found.");

  const profileChanges: string[] = [];
  const preferenceChanges: string[] = [];
  let nextUser = { ...user };

  if (input.name !== undefined) {
    const name = cleanProfileText(input.name);
    if (!name || name.length < 2) throw new Error("Full name is required.");
    if (name !== user.name) {
      nextUser = { ...nextUser, name };
      profileChanges.push("name");
    }
  }
  if (input.phone !== undefined) {
    const phone = cleanProfileText(input.phone, 40);
    if (phone !== (user.phone ?? "")) {
      nextUser = { ...nextUser, phone: phone || undefined };
      profileChanges.push("phone");
    }
  }
  if (input.preferredLanguage !== undefined) {
    const preferredLanguage = cleanProfileText(input.preferredLanguage, 40);
    if (!preferredLanguage) throw new Error("Preferred language is required.");
    if (preferredLanguage !== user.preferredLanguage) {
      nextUser = { ...nextUser, preferredLanguage };
      preferenceChanges.push("language");
    }
  }
  if (input.timezone !== undefined) {
    const timezone = cleanProfileText(input.timezone, 80);
    if (!timezone) throw new Error("Timezone is required.");
    if (timezone !== user.timezone) {
      nextUser = { ...nextUser, timezone };
      preferenceChanges.push("timezone");
    }
  }
  const notificationPreferences = normalizeNotificationPreferences(input.notificationPreferences, user.notificationPreferences);
  if (
    notificationPreferences &&
    JSON.stringify(notificationPreferences) !== JSON.stringify(user.notificationPreferences)
  ) {
    nextUser = { ...nextUser, notificationPreferences };
    preferenceChanges.push("notifications");
  }

  const student = state.students.find((item) => item.userId === user.id);
  let updatedStudent = student;
  if (student) {
    let nextStudent = { ...student };
    if (input.country !== undefined) {
      const country = cleanProfileText(input.country, 80);
      if (!country) throw new Error("Country is required.");
      if (country !== student.country) {
        nextStudent = { ...nextStudent, country };
        profileChanges.push("country");
      }
    }
    if (input.preferredLanguage !== undefined) {
      nextStudent = { ...nextStudent, preferredLanguage: nextUser.preferredLanguage ?? student.preferredLanguage };
    }
    if (input.timezone !== undefined) {
      nextStudent = { ...nextStudent, timezone: nextUser.timezone ?? student.timezone };
    }
    if (input.guardianName !== undefined) {
      const guardianName = cleanProfileText(input.guardianName, 120);
      if (guardianName !== (student.guardianName ?? "")) {
        nextStudent = { ...nextStudent, guardianName: guardianName || undefined };
        profileChanges.push("guardian name");
      }
    }
    if (input.guardianPhone !== undefined) {
      const guardianPhone = cleanProfileText(input.guardianPhone, 40);
      if (guardianPhone !== (student.guardianPhone ?? "")) {
        nextStudent = { ...nextStudent, guardianPhone: guardianPhone || undefined };
        profileChanges.push("guardian phone");
      }
    }
    if (isMinorAgeGroup(nextStudent.ageGroup ?? "") && (!nextStudent.guardianName || !nextStudent.guardianPhone)) {
      throw new Error("Guardian name and phone are required for minor students.");
    }
    updatedStudent = nextStudent;
  }

  const staffProfile =
    state.staffProfiles.find((item) => item.userId === user.id && item.role === user.activeRole) ??
    state.staffProfiles.find((item) => item.userId === user.id);
  let updatedStaffProfile = staffProfile;
  if (staffProfile) {
    let nextStaffProfile = { ...staffProfile };
    if (input.title !== undefined) {
      const title = cleanProfileText(input.title, 80);
      if (!title) throw new Error("Profile title is required.");
      if (title !== staffProfile.title) {
        nextStaffProfile = { ...nextStaffProfile, title, updatedAt: ctx.now() };
        profileChanges.push("title");
      }
    }
    if (input.availabilityStatus !== undefined) {
      if (staffProfile.role !== "teacher") throw new Error("Availability can only be changed for teacher profiles.");
      if (!staffAvailabilityStatuses.has(input.availabilityStatus)) throw new Error("Choose a valid availability status.");
      if (input.availabilityStatus !== staffProfile.availabilityStatus) {
        nextStaffProfile = {
          ...nextStaffProfile,
          availabilityStatus: input.availabilityStatus,
          updatedAt: ctx.now(),
        };
        profileChanges.push("availability");
      }
    }
    updatedStaffProfile = nextStaffProfile;
  }

  const teacherProfile = state.teachers.find((item) => item.userId === user.id);
  let updatedTeacherProfile = teacherProfile;
  if (teacherProfile && input.availabilityStatus !== undefined) {
    if (!staffAvailabilityStatuses.has(input.availabilityStatus)) throw new Error("Choose a valid availability status.");
    updatedTeacherProfile = {
      ...teacherProfile,
      availabilityStatus: input.availabilityStatus,
    };
  }

  const actorId = input.actorId ?? user.id;
  state.users = state.users.map((item) => (item.id === user.id ? nextUser : item));
  if (student && updatedStudent) {
    state.students = state.students.map((item) => (item.id === student.id ? updatedStudent : item));
  }
  if (staffProfile && updatedStaffProfile) {
    state.staffProfiles = state.staffProfiles.map((item) => (item.id === staffProfile.id ? updatedStaffProfile : item));
  }
  if (teacherProfile && updatedTeacherProfile) {
    state.teachers = state.teachers.map((item) => (item.id === teacherProfile.id ? updatedTeacherProfile : item));
  }

  if (profileChanges.length) {
    appendAudit(
      state,
      ctx,
      "profile.updated",
      student ? "StudentProfile" : staffProfile ? "StaffProfile" : "User",
      student?.id ?? staffProfile?.id ?? user.id,
      `Updated profile fields: ${Array.from(new Set(profileChanges)).join(", ")}.`,
      actorId,
    );
  }
  if (preferenceChanges.length) {
    appendAudit(
      state,
      ctx,
      "preferences.updated",
      "User",
      user.id,
      `Updated preferences: ${Array.from(new Set(preferenceChanges)).join(", ")}.`,
      actorId,
    );
  }

  return {
    user: nextUser,
    student: updatedStudent,
    staffProfile: updatedStaffProfile,
    teacherProfile: updatedTeacherProfile,
    changed: Array.from(new Set([...profileChanges, ...preferenceChanges])),
  };
}

function applyUpdateUserAccount(
  state: PlatformState,
  input: UpdateUserActionInput,
  ctx: MutationContext,
) {
  const user = state.users.find((item) => item.id === input.userId);
  if (!user) throw new Error(`User ${input.userId} was not found.`);

  const { branch, department } = validateUserScopeUpdate(state, input, user);
  const status = validateAccountStatus(input.status, user.status);
  const requestedRoles = input.roles ?? user.roles;
  const roles = Array.from(new Set(requestedRoles.filter((role): role is Role => roleOrder.includes(role))));
  if (!roles.length) throw new Error("Account must keep at least one role.");
  const activeRole = input.activeRole ?? user.activeRole;
  if (!roleOrder.includes(activeRole) || !roles.includes(activeRole)) {
    throw new Error("Active role must be one of the assigned roles.");
  }

  const changes: string[] = [];
  if (status !== user.status) changes.push(`status ${user.status} to ${status}`);
  if (activeRole !== user.activeRole) changes.push(`active role ${user.activeRole} to ${activeRole}`);
  if (branch.id !== user.branchId) changes.push(`branch ${user.branchId ?? "none"} to ${branch.id}`);
  if (department.id !== user.departmentId) changes.push(`department ${user.departmentId ?? "none"} to ${department.id}`);
  if (roles.join("|") !== user.roles.join("|")) changes.push(`roles to ${roles.join(", ")}`);

  const updatedUser = {
    ...user,
    activeRole,
    roles,
    branchId: branch.id,
    departmentId: department.id,
    status,
  };
  state.users = state.users.map((item) => item.id === user.id ? updatedUser : item);

  const student = state.students.find((item) => item.userId === user.id);
  if (student && input.status) {
    const studentStatus = studentStatusFromAccountStatus(status);
    state.students = state.students.map((item) => item.id === student.id ? { ...item, status: studentStatus } : item);
    state.enrollments = state.enrollments.map((enrollment) =>
      enrollment.studentId === student.id ? { ...enrollment, status: studentStatus } : enrollment,
    );
  }

  const teacherProfile = state.teachers.find((item) => item.userId === user.id);
  if (teacherProfile && input.departmentId) {
    state.teachers = state.teachers.map((item) => item.userId === user.id ? { ...item, departmentId: department.id } : item);
  }
  if (input.status || input.branchId || input.departmentId) {
    state.staffProfiles = (state.staffProfiles ?? []).map((item) =>
      item.userId === user.id
        ? {
            ...item,
            branchIds: input.branchId ? [branch.id] : item.branchIds,
            departmentIds: input.departmentId ? [department.id] : item.departmentIds,
            status,
            updatedAt: ctx.now(),
          }
        : item,
    );
  }

  const summary = changes.length
    ? `Updated ${user.name}: ${changes.join("; ")}.`
    : `Reviewed ${user.name}; no access changes were needed.`;
  appendAudit(
    state,
    ctx,
    "user.updated",
    "User",
    user.id,
    summary,
    input.actorId ?? "usr_admin_demo",
  );

  return {
    user: updatedUser,
    branch,
    department,
    roles,
    changed: changes,
  };
}

const allKnownPermissions = new Set<Permission>(
  Object.values(rolePermissions).flatMap((permissions) => permissions),
);
const integrationStatuses = new Set<IntegrationStatus>(["not_configured", "mock_mode", "connected", "error"]);

function validateGovernanceRole(role: Role) {
  if (!roleOrder.includes(role)) throw new Error("Choose a valid account role.");
}

function validatePermission(permission: Permission) {
  if (!allKnownPermissions.has(permission)) throw new Error("Choose a valid permission.");
}

function applyUpdatePermission(
  state: PlatformState,
  input: UpdatePermissionActionInput,
  ctx: MutationContext,
) {
  validateGovernanceRole(input.role);
  validatePermission(input.permission);
  const current = state.permissions[input.role] ?? [];
  const hasPermission = current.includes(input.permission);
  const nextPermissions = input.granted
    ? hasPermission ? current : [...current, input.permission]
    : current.filter((permission) => permission !== input.permission);
  state.permissions = {
    ...state.permissions,
    [input.role]: nextPermissions,
  };
  const summary = `${input.role}: ${input.permission} ${input.granted ? "granted" : "removed"}.`;
  appendAudit(
    state,
    ctx,
    "permission.updated",
    "Role",
    input.role,
    summary,
    input.actorId ?? "usr_admin_demo",
  );
  return {
    role: input.role,
    permission: input.permission,
    granted: nextPermissions.includes(input.permission),
    permissions: nextPermissions,
  };
}

function applyUpdateBranch(
  state: PlatformState,
  input: UpdateBranchActionInput,
  ctx: MutationContext,
) {
  const branch = state.branches.find((item) => item.id === input.branchId);
  if (!branch) throw new Error(`Branch ${input.branchId} was not found.`);
  const status = validateAccountStatus(input.status, branch.status);
  state.branches = state.branches.map((item) => item.id === branch.id ? { ...item, status } : item);
  appendAudit(
    state,
    ctx,
    "branch.updated",
    "Branch",
    branch.id,
    `Set ${branch.name} status from ${branch.status} to ${status}.`,
    input.actorId ?? "usr_admin_demo",
  );
  return {
    branch: state.branches.find((item) => item.id === branch.id)!,
    previousStatus: branch.status,
  };
}

function applyUpdateRoomStatus(
  state: PlatformState,
  input: UpdateRoomStatusActionInput,
  ctx: MutationContext,
) {
  const room = state.rooms.find((item) => item.id === input.roomId);
  if (!room) throw new Error(`Room ${input.roomId} was not found.`);
  const status = validateAccountStatus(input.status, room.status);
  state.rooms = state.rooms.map((item) => (item.id === room.id ? { ...item, status } : item));
  appendAudit(
    state,
    ctx,
    "room.status_updated",
    "Room",
    room.id,
    `Set ${room.name} status from ${room.status} to ${status}.`,
    input.actorId ?? "usr_branch_demo",
  );
  return {
    room: state.rooms.find((item) => item.id === room.id)!,
    previousStatus: room.status,
  };
}

function applyCreateRoom(
  state: PlatformState,
  input: CreateRoomActionInput,
  ctx: MutationContext,
) {
  const branch = state.branches.find((item) => item.id === input.branchId);
  const name = input.name.trim();
  const equipment = (input.equipment ?? []).map((item) => item.trim()).filter(Boolean);
  const capacity = Math.floor(input.capacity);
  if (!branch) throw new Error(`Branch ${input.branchId} was not found.`);
  if (!name) throw new Error("Room name is required.");
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) {
    throw new Error("Room capacity must be between 1 and 200.");
  }
  if (state.rooms.some((item) => item.branchId === branch.id && item.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`${name} already exists in ${branch.name}.`);
  }
  const room: Room = {
    id: ctx.createId("room"),
    branchId: branch.id,
    name,
    capacity,
    equipment,
    status: "active",
  };
  state.rooms = [room, ...state.rooms];
  appendAudit(
    state,
    ctx,
    "room.created",
    "Room",
    room.id,
    `Added ${room.name} to ${branch.name} with ${room.capacity} seats.`,
    input.actorId ?? "usr_branch_demo",
  );
  return { room, branch };
}

function getIntegration(state: PlatformState, integrationId: IntegrationConfig["id"]) {
  const integration = state.integrations.find((item) => item.id === integrationId);
  if (!integration) throw new Error(`Integration ${integrationId} was not found.`);
  return integration;
}

function validateIntegrationStatus(status: IntegrationStatus) {
  if (!integrationStatuses.has(status)) throw new Error("Choose a valid integration status.");
}

function applyUpdateIntegrationStatus(
  state: PlatformState,
  input: UpdateIntegrationStatusActionInput,
  ctx: MutationContext,
) {
  const integration = getIntegration(state, input.integrationId);
  validateIntegrationStatus(input.status);
  const lastSyncAt = input.status === "connected" || input.status === "mock_mode" ? ctx.now() : integration.lastSyncAt;
  state.integrations = state.integrations.map((item) =>
    item.id === integration.id ? { ...item, status: input.status, lastSyncAt } : item,
  );
  appendAudit(
    state,
    ctx,
    "integration.status_updated",
    "IntegrationConfig",
    integration.id,
    `${integration.label} set from ${integration.status.replace("_", " ")} to ${input.status.replace("_", " ")}.`,
    input.actorId ?? "usr_admin_demo",
  );
  return {
    integration: state.integrations.find((item) => item.id === integration.id)!,
    previousStatus: integration.status,
  };
}

function applyCheckIntegration(
  state: PlatformState,
  input: CheckIntegrationActionInput,
  ctx: MutationContext,
) {
  const integration = getIntegration(state, input.integrationId);
  appendAudit(
    state,
    ctx,
    "integration.local_checked",
    "IntegrationConfig",
    integration.id,
    `${integration.label} checked locally.`,
    input.actorId ?? "usr_admin_demo",
  );
  return {
    integration,
    checkedAt: ctx.now(),
  };
}

function applyCheckSystemHealth(
  state: PlatformState,
  input: CheckSystemHealthActionInput,
  ctx: MutationContext,
) {
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  appendAudit(
    state,
    ctx,
    "system.health_checked",
    "PlatformSystem",
    "health",
    `System health check scored ${score}%.`,
    input.actorId ?? "usr_admin_demo",
  );
  return {
    score,
    checkedAt: ctx.now(),
  };
}

function applySavePlatformSettings(
  state: PlatformState,
  input: SavePlatformSettingsActionInput,
  ctx: MutationContext,
) {
  const organization = input.organization.trim();
  const defaultLanguage = input.defaultLanguage.trim();
  const academicTerm = input.academicTerm.trim();
  const retentionDays = Math.round(Number(input.retentionDays));

  if (!organization) throw new Error("Organization is required.");
  if (!defaultLanguage) throw new Error("Default language is required.");
  if (!academicTerm) throw new Error("Academic term is required.");
  if (!Number.isFinite(retentionDays) || retentionDays < 30 || retentionDays > 3650) {
    throw new Error("Audit retention days must be between 30 and 3650.");
  }

  const savedAt = ctx.now();
  const settings = {
    organization,
    defaultLanguage,
    academicTerm,
    retentionDays,
    updatedAt: savedAt,
    updatedBy: input.actorId ?? "usr_admin_demo",
  };
  state.settings = settings;

  appendAudit(
    state,
    ctx,
    "settings.saved",
    "PlatformSettings",
    "global",
    `${organization} · ${defaultLanguage} · ${academicTerm} · ${retentionDays} day retention.`,
    input.actorId ?? "usr_admin_demo",
  );

  return {
    settings,
    savedAt,
  };
}

function applySavePortalSettings(
  state: PlatformState,
  input: SavePortalSettingsActionInput,
  ctx: MutationContext,
) {
  if (!["registrar", "headofdepartment", "branchadmin"].includes(input.role)) {
    throw new Error("Choose a valid portal settings role.");
  }
  const scopeId = input.scopeId.trim();
  const label = input.label.trim();
  const language = input.language.trim();
  const timezone = input.timezone.trim();
  const reviewCadenceDays = input.reviewCadenceDays === undefined ? undefined : Math.round(Number(input.reviewCadenceDays));
  const paymentReminderDays = input.paymentReminderDays === undefined ? undefined : Math.round(Number(input.paymentReminderDays));
  const attendanceCutoffMinutes =
    input.attendanceCutoffMinutes === undefined ? undefined : Math.round(Number(input.attendanceCutoffMinutes));

  if (!scopeId) throw new Error("Scope is required.");
  if (!label) throw new Error("Workspace label is required.");
  if (!language) throw new Error("Language is required.");
  if (!timezone) throw new Error("Timezone is required.");
  if (reviewCadenceDays !== undefined && (!Number.isFinite(reviewCadenceDays) || reviewCadenceDays < 1 || reviewCadenceDays > 90)) {
    throw new Error("Review cadence must be between 1 and 90 days.");
  }
  if (paymentReminderDays !== undefined && (!Number.isFinite(paymentReminderDays) || paymentReminderDays < 1 || paymentReminderDays > 30)) {
    throw new Error("Payment reminders must be between 1 and 30 days.");
  }
  if (attendanceCutoffMinutes !== undefined && (!Number.isFinite(attendanceCutoffMinutes) || attendanceCutoffMinutes < 0 || attendanceCutoffMinutes > 120)) {
    throw new Error("Attendance cutoff must be between 0 and 120 minutes.");
  }

  const savedAt = ctx.now();
  const settings: ScopedPortalSettings = {
    role: input.role,
    scopeId,
    label,
    language,
    timezone,
    notifications: Boolean(input.notifications),
    reviewCadenceDays,
    paymentReminderDays,
    attendanceCutoffMinutes,
    updatedAt: savedAt,
    updatedBy: input.actorId ?? "usr_admin_demo",
  };
  state.portalSettings = [
    settings,
    ...state.portalSettings.filter(
      (item) => item.role !== settings.role || item.scopeId !== settings.scopeId,
    ),
  ];

  appendAudit(
    state,
    ctx,
    "portal_settings.saved",
    "PortalSettings",
    `${settings.role}:${settings.scopeId}`,
    `Saved ${settings.label} settings.`,
    input.actorId ?? "usr_admin_demo",
  );

  return {
    settings,
    savedAt,
  };
}

function applyCreateUserAccount(
  state: PlatformState,
  input: CreateUserActionInput,
  ctx: MutationContext,
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!name || !email || !phone) throw new Error("Name, email, and phone are required.");
  if (state.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }

  const { status, branch, department } = validateAccountScope(state, input);
  if (input.role === "student") {
    if (!input.courseRunId || !input.classGroupId) {
      throw new Error("Student accounts require a course run and class group.");
    }
    const courseRun = state.courseRuns.find((run) => run.id === input.courseRunId);
    const classGroup = state.classGroups.find((group) => group.id === input.classGroupId);
    if (!courseRun || !classGroup || classGroup.courseRunId !== courseRun.id) {
      throw new Error("Selected class group must belong to the selected course run.");
    }
    if (courseRun.branchId !== branch.id) {
      throw new Error("Student branch must match the selected course and class branch.");
    }
    if (classGroup.studentIds.length >= classGroup.capacity) {
      throw new Error("Selected class is already at capacity.");
    }
  }
  if (input.role === "teacher") {
    const specialties = Array.from(new Set([...(input.subjects ?? []), ...(input.specialization ?? [])].map((item) => item.trim()).filter(Boolean)));
    if (!specialties.length) throw new Error("Teacher accounts require at least one subject or specialization.");
    const courseRun = state.courseRuns.find((run) => run.id === input.courseRunId);
    if (!input.courseRunId || !courseRun) {
      throw new Error("Teacher accounts require a course run assignment.");
    }
    if (courseRun.branchId !== branch.id) {
      throw new Error("Teacher branch must match the selected course run branch.");
    }
    if (courseRun.teacherId) {
      throw new Error("Selected course run already has a teacher. Use teacher reassignment instead.");
    }
    const course = state.courses.find((item) => item.id === courseRun.courseId);
    const program = state.programs.find((item) => item.id === course?.programId);
    if (program && program.departmentId !== department.id) {
      throw new Error("Teacher department must own the selected course run.");
    }
  }

  const userId = ctx.createId(`usr_${input.role}`);
  const user = {
    id: userId,
    name,
    email,
    phone,
    notes: input.notes?.trim() || undefined,
    roles: [input.role],
    activeRole: input.role,
    branchId: input.branchId,
    departmentId: input.departmentId,
    status,
  } satisfies PlatformState["users"][number];
  state.users = [user, ...state.users];

  let relationshipSummary = `${input.role} account created with ${branch?.name ?? "selected branch"} scope.`;
  let student: PlatformState["students"][number] | undefined;
  let enrollment: PlatformState["enrollments"][number] | undefined;
  let teacherProfile: PlatformState["teachers"][number] | undefined;
  let teacherAssignment:
    | ReturnType<typeof applyAssignTeacherToCourseRun>
    | undefined;

  if (input.role === "student") {
    const courseRun = state.courseRuns.find((run) => run.id === input.courseRunId)!;
    const classGroup = state.classGroups.find((group) => group.id === input.classGroupId)!;
    const course = state.courses.find((item) => item.id === courseRun.courseId);
    const lessonIds = state.modules
      .filter((module) => module.courseId === courseRun.courseId)
      .flatMap((module) => state.lessons.filter((lesson) => lesson.moduleId === module.id).map((lesson) => lesson.id));
    const studentId = ctx.createId("stu");
    const studentStatus = studentStatusFromAccountStatus(status);
    student = {
      id: studentId,
      userId,
      status: studentStatus,
      guardianName: input.guardianName?.trim() || undefined,
      guardianPhone: input.guardianPhone?.trim() || undefined,
      currentLevel: input.currentLevel?.trim() || undefined,
      ageGroup: input.ageGroup?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      country: "Egypt",
      preferredLanguage: input.preferredLanguage ?? "English",
      timezone: branch?.timezone ?? "Africa/Cairo",
    };
    enrollment = {
      id: ctx.createId("enr"),
      studentId,
      courseRunId: courseRun.id,
      levelId: course?.levelId,
      classGroupId: classGroup.id,
      teacherId: courseRun.teacherId,
      source: "direct",
      status: studentStatus,
      progress: 0,
      attendanceRate: 0,
      currentGrade: 0,
      createdAt: ctx.now(),
    };
    state.students = [student, ...state.students];
    state.enrollments = [enrollment, ...state.enrollments];
    state.classGroups = state.classGroups.map((group) =>
      group.id === classGroup.id ? { ...group, studentIds: [...group.studentIds, studentId] } : group,
    );
    state.lessonProgress = [
      ...lessonIds.map((lessonId) => ({
        id: ctx.createId("lp"),
        studentId,
        lessonId,
        status: "not_started" as const,
      })),
      ...state.lessonProgress,
    ];
    relationshipSummary = `Student linked to ${course?.title ?? courseRun.courseId}, ${classGroup.name}, attendance, grades, lessons, and calendar.`;
  }

  if (input.role === "teacher") {
    const specialties = Array.from(new Set([...(input.subjects ?? []), ...(input.specialization ?? [])].map((item) => item.trim()).filter(Boolean)));
    const teachingLevels = Array.from(new Set((input.specialization ?? []).map((item) => item.trim()).filter(Boolean)));
    teacherAssignment = applyAssignTeacherToCourseRun(
      state,
      {
        userId,
        courseRunId: input.courseRunId!,
        status,
        departmentId: input.departmentId,
        specialties,
        teachingLevels,
        availability: input.availability ?? [],
        actorId: input.actorId,
      },
      ctx,
    );
    teacherProfile = teacherAssignment.profile;
    relationshipSummary = `Teacher linked to ${department?.name ?? "selected department"}, ${teacherAssignment.classGroups.length} class group(s), ${teacherAssignment.availability.length} availability slot(s), attendance, grading, schedule, and feedback tools.`;
  }

  appendAudit(
    state,
    ctx,
    "user.created",
    "User",
    userId,
    `Created ${input.role} account for ${name}. ${relationshipSummary}`,
    input.actorId ?? "usr_admin_demo",
  );

  return {
    user: state.users.find((item) => item.id === userId)!,
    student,
    enrollment,
    teacherProfile,
    teacherAssignment,
    relationshipSummary,
  };
}

function applyCreateStaffUserAccount(
  state: PlatformState,
  input: CreateStaffUserActionInput,
  ctx: MutationContext,
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || undefined;
  if (!name || !email) throw new Error("Full name and email are required.");
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (state.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }

  const { status, branch, department, branchId, departmentId, permissionScope, availabilityStatus } =
    validateStaffAccountScope(state, input);
  const userId = ctx.createId(`usr_${input.role}`);
  const subjects = Array.from(new Set((input.subjects ?? []).map((item) => item.trim()).filter(Boolean)));
  const teachingLevels = Array.from(new Set((input.teachingLevels ?? []).map((item) => item.trim()).filter(Boolean)));
  const operationalScope = Array.from(
    new Set(((input.operationalScope?.length ? input.operationalScope : defaultOperationalScopeByRole[input.role]) ?? [])
      .map((item) => item.trim())
      .filter(Boolean)),
  );
  const user = {
    id: userId,
    name,
    email,
    phone,
    notes: input.notes?.trim() || undefined,
    roles: [input.role],
    activeRole: input.role,
    branchId,
    departmentId,
    status,
  } satisfies PlatformState["users"][number];
  const staffProfile: StaffProfile = {
    id: ctx.createId("staff"),
    userId,
    role: input.role,
    branchIds: [branch.id],
    departmentIds: [department.id],
    permissionScope,
    title: staffTitleByRole[input.role],
    subjects,
    teachingLevels,
    availabilityStatus,
    operationalScope,
    status,
    createdAt: ctx.now(),
    updatedAt: ctx.now(),
  };
  let teacherProfile: PlatformState["teachers"][number] | undefined;

  state.users = [user, ...state.users];
  state.staffProfiles = [staffProfile, ...(state.staffProfiles ?? [])];
  if (input.role === "teacher") {
    teacherProfile = {
      id: ctx.createId("tch"),
      userId,
      departmentId,
      branchId,
      subjects,
      teachingLevels,
      specialties: Array.from(new Set([...subjects, ...teachingLevels])),
      availability: [availabilityStatus],
      availabilityStatus,
      assignedClassIds: [],
      status,
    };
    state.teachers = [teacherProfile, ...state.teachers];
  }

  const relationshipSummary =
    input.role === "teacher"
      ? `Teacher profile created for ${department.name} with ${subjects.length} subject(s), ${teachingLevels.length} teaching level(s), and ${availabilityStatus} availability.`
      : `${staffTitleByRole[input.role]} profile created with ${permissionScope} scope for ${branch.name} / ${department.name}.`;
  appendAudit(
    state,
    ctx,
    "staff.user.created",
    "User",
    userId,
    `Created ${staffTitleByRole[input.role]} account for ${name}. ${relationshipSummary}`,
    input.actorId ?? "usr_admin_demo",
  );

  return {
    user,
    staffProfile,
    teacherProfile,
    permissions: rolePermissions[input.role] ?? [],
    relationshipSummary,
  };
}

function applyAssignTeacherToCourseRun(
  state: PlatformState,
  input: AssignTeacherActionInput,
  ctx: MutationContext,
) {
  const user = state.users.find((item) => item.id === input.userId);
  if (!user) throw new Error(`Teacher user ${input.userId} was not found.`);
  if (!user.roles.includes("teacher") && user.activeRole !== "teacher") {
    throw new Error(`${user.name} does not have teacher access.`);
  }
  const courseRun = state.courseRuns.find((run) => run.id === input.courseRunId);
  if (!courseRun) throw new Error(`Course run ${input.courseRunId} was not found.`);
  if (!assignableCourseRunStatuses.includes(courseRun.status)) {
    throw new Error("Teacher assignment requires an active or pending course run.");
  }
  if (user.branchId && user.branchId !== courseRun.branchId && user.branchId !== "br_global") {
    throw new Error("Teacher branch must match the selected course run.");
  }

  const course = state.courses.find((item) => item.id === courseRun.courseId);
  const program = state.programs.find((item) => item.id === course?.programId);
  const classGroups = state.classGroups.filter((group) => group.courseRunId === courseRun.id);
  const classGroupIds = new Set(classGroups.map((group) => group.id));
  const specialties = Array.from(new Set((input.specialties ?? []).map((item) => item.trim()).filter(Boolean)));
  const courseLevelLabels = [course?.title, course?.levelId].filter(Boolean) as string[];
  const teachingLevels = Array.from(
    new Set([...(input.teachingLevels ?? []).map((item) => item.trim()).filter(Boolean), ...courseLevelLabels]),
  );
  const availability = Array.from(new Set((input.availability ?? []).map((item) => item.trim()).filter(Boolean)));
  const departmentId = input.departmentId ?? user.departmentId ?? "dep_arabic";
  const department = state.departments.find((item) => item.id === departmentId);
  if (!department) throw new Error("Choose a valid department for this teacher.");
  if (!department.branchIds.includes(courseRun.branchId) && courseRun.branchId !== "br_global") {
    throw new Error("Teacher department is not available in the selected course branch.");
  }
  if (program && program.departmentId !== department.id) {
    throw new Error("Teacher department must own the selected course run.");
  }
  const status = validateAccountStatus(input.status, user.status);
  const previousTeacherUserId = courseRun.teacherId && courseRun.teacherId !== user.id ? courseRun.teacherId : undefined;
  const previousTeacher = previousTeacherUserId ? state.users.find((item) => item.id === previousTeacherUserId) : undefined;
  const previousTeacherLabel = previousTeacher?.name ?? previousTeacherUserId ?? "";
  const parsedSlots = availability.map((slot) => parseTeacherAvailabilitySlot(slot, courseRun.branchId, user.id, ctx));
  if (availability.length && parsedSlots.some((slot) => !slot)) {
    throw new Error("Use availability like Mon 09:00 or Wed 09:00-10:30.");
  }
  if (availability.length && !parsedSlots.length) {
    throw new Error("Add at least one valid availability slot.");
  }

  if (previousTeacherUserId) {
    state.teachers = state.teachers.map((teacher) =>
      teacher.userId === previousTeacherUserId
        ? {
            ...teacher,
            assignedClassIds: (teacher.assignedClassIds ?? []).filter((classGroupId) => !classGroupIds.has(classGroupId)),
          }
        : teacher,
    );
  }

  const existingProfile = state.teachers.find((teacher) => teacher.userId === user.id);
  const existingStaffProfile = (state.staffProfiles ?? []).find((profile) => profile.userId === user.id && profile.role === "teacher");
  const staffSubjects = Array.from(
    new Set([...(existingProfile?.subjects ?? []), ...specialties, course?.title ?? courseRun.courseId].filter((item): item is string => Boolean(item))),
  );
  if (existingProfile) {
    state.teachers = state.teachers.map((teacher) =>
      teacher.id === existingProfile.id
        ? {
            ...teacher,
            departmentId,
            branchId: courseRun.branchId,
            subjects: Array.from(new Set([...(teacher.subjects ?? []), ...specialties])),
            teachingLevels: Array.from(new Set([...(teacher.teachingLevels ?? []), ...teachingLevels])),
            specialties: Array.from(new Set([...teacher.specialties, ...specialties])),
            availability: Array.from(new Set([...teacher.availability, ...availability])),
            availabilityStatus: availability.length ? "available" : teacher.availabilityStatus,
            assignedClassIds: Array.from(new Set([...(teacher.assignedClassIds ?? []), ...classGroups.map((group) => group.id)])),
            status,
          }
        : teacher,
    );
  } else {
    state.teachers = [
      {
        id: ctx.createId("tch"),
        userId: user.id,
        departmentId,
        branchId: courseRun.branchId,
        subjects: specialties,
        teachingLevels,
        specialties,
        availability,
        availabilityStatus: availability.length ? "available" : "limited",
        assignedClassIds: classGroups.map((group) => group.id),
        status,
      },
      ...state.teachers,
    ];
  }

  state.users = state.users.map((item) =>
    item.id === user.id
      ? {
          ...item,
          roles: item.roles.includes("teacher") ? item.roles : [...item.roles, "teacher"],
          activeRole: "teacher",
          branchId: courseRun.branchId,
          departmentId,
          status,
        }
      : item,
  );
  const updatedStaffProfiles = (state.staffProfiles ?? []).map((profile) =>
    profile.userId === user.id && profile.role === "teacher"
      ? {
          ...profile,
          branchIds: Array.from(new Set([...profile.branchIds, courseRun.branchId])),
          departmentIds: Array.from(new Set([...profile.departmentIds, departmentId])),
          subjects: Array.from(new Set([...profile.subjects, ...staffSubjects])),
          teachingLevels: Array.from(new Set([...profile.teachingLevels, ...teachingLevels])),
          availabilityStatus: availability.length ? "available" : profile.availabilityStatus,
          operationalScope: Array.from(new Set([...profile.operationalScope, "classes", "attendance", "grading", "progress"])),
          status,
          updatedAt: ctx.now(),
        }
      : profile,
  );
  state.staffProfiles = existingStaffProfile
    ? updatedStaffProfiles
    : [
        {
          id: ctx.createId("staff"),
          userId: user.id,
          role: "teacher",
          branchIds: [courseRun.branchId],
          departmentIds: [departmentId],
          permissionScope: "department",
          title: staffTitleByRole.teacher,
          subjects: staffSubjects,
          teachingLevels,
          availabilityStatus: availability.length ? "available" : "limited",
          operationalScope: Array.from(new Set([...defaultOperationalScopeByRole.teacher, "progress"])),
          status,
          createdAt: ctx.now(),
          updatedAt: ctx.now(),
        },
        ...updatedStaffProfiles,
      ];
  state.courseRuns = state.courseRuns.map((run) => (run.id === courseRun.id ? { ...run, teacherId: user.id } : run));
  state.enrollments = state.enrollments.map((enrollment) =>
    enrollment.courseRunId === courseRun.id ? { ...enrollment, teacherId: user.id } : enrollment,
  );
  state.events = state.events.map((event) =>
    event.classGroupId && classGroupIds.has(event.classGroupId) ? { ...event, ownerId: user.id } : event,
  );

  const seenSlotKeys = new Set(
    state.teacherAvailability
      .filter((slot) => slot.teacherId !== user.id || slot.branchId !== courseRun.branchId)
      .map((slot) => `${slot.teacherId}|${slot.branchId}|${slot.weekday}|${slot.startsAt}|${slot.endsAt}`),
  );
  const nextSlots = (parsedSlots.filter(Boolean) as TeacherAvailability[]).filter((slot) => {
    const key = `${slot.teacherId}|${slot.branchId}|${slot.weekday}|${slot.startsAt}|${slot.endsAt}`;
    if (seenSlotKeys.has(key)) return false;
    seenSlotKeys.add(key);
    return true;
  });
  state.teacherAvailability = [
    ...state.teacherAvailability.filter((slot) => slot.teacherId !== user.id || slot.branchId !== courseRun.branchId),
    ...nextSlots,
  ];

  const result = {
    teacher: state.users.find((item) => item.id === user.id)!,
    previousTeacher,
    previousTeacherId: previousTeacherUserId && !previousTeacher ? previousTeacherUserId : undefined,
    profile: state.teachers.find((teacher) => teacher.userId === user.id),
    courseRun: state.courseRuns.find((run) => run.id === courseRun.id)!,
    classGroups,
    availability: nextSlots,
  };
  appendAudit(
    state,
    ctx,
    "teacher.assigned",
    "CourseRun",
    courseRun.id,
    `${user.name} ${previousTeacherLabel ? `reassigned from ${previousTeacherLabel}` : "assigned"} to ${course?.title ?? courseRun.courseId} with ${classGroups.length} class group(s), ${nextSlots.length} availability slot(s), attendance, grading, and feedback tools.`,
    input.actorId ?? "usr_admin_demo",
  );
  return result;
}

function applyUpdateQuranProgress(
  state: PlatformState,
  input: { recordId: string; memorizedPercent: number; tajweedScore: number; notes: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: QuranProgressRecord | undefined;
  state.quranProgress = state.quranProgress.map((record) => {
    if (record.id !== input.recordId) return record;
    updated = {
      ...record,
      memorizedPercent: Math.min(100, Math.max(0, input.memorizedPercent)),
      tajweedScore: Math.min(100, Math.max(0, input.tajweedScore)),
      notes: input.notes,
    };
    return updated;
  });
  if (updated) {
    appendAudit(
      state,
      ctx,
      "quran.progress_updated",
      "QuranProgressRecord",
      updated.id,
      `Updated ${updated.surah} progress.`,
      input.actorId ?? "usr_teacher_demo",
    );
  }
  return updated;
}

function applyReviewRecitation(
  state: PlatformState,
  input: { submissionId: string; feedback: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: RecitationSubmission | undefined;
  state.recitationSubmissions = state.recitationSubmissions.map((submission) => {
    if (submission.id !== input.submissionId) return submission;
    updated = { ...submission, status: "approved", feedback: input.feedback };
    return updated;
  });
  if (updated) {
    const student = state.students.find((item) => item.id === updated?.studentId);
    notify(state, ctx, {
      userId: student?.userId ?? "usr_student_demo",
      title: "Recitation reviewed",
      body: input.feedback,
      href: "/app/student/quran-progress",
    });
    appendAudit(
      state,
      ctx,
      "recitation.reviewed",
      "RecitationSubmission",
      updated.id,
      `Reviewed ${updated.title}.`,
      input.actorId ?? "usr_teacher_demo",
    );
  }
  return updated;
}

function applySubmitRecitation(
  state: PlatformState,
  input: SubmitRecitationActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const pendingMedia = cleanPendingMedia(input.pendingMedia);
  if (!input.title.trim()) throw new Error("Recitation title is required.");
  const submission: RecitationSubmission = {
    id: ctx.createId("rec"),
    studentId: input.studentId,
    teacherId: input.teacherId,
    title: input.title.trim(),
    submittedAt: ctx.now(),
    status: "pending",
    pendingMedia,
  };
  state.recitationSubmissions = [submission, ...state.recitationSubmissions];
  notify(state, ctx, {
    userId: input.teacherId,
    title: "Recitation submitted",
    body: `${submission.title} is ready for review.`,
    href: "/app/teacher/quran-review",
  });
  appendAudit(
    state,
    ctx,
    "recitation.submitted",
    "RecitationSubmission",
    submission.id,
    pendingMedia.length
      ? `Submitted ${submission.title} with ${pendingMedia.length} pending audio file(s).`
      : `Submitted ${submission.title} for teacher review.`,
    input.actorId ?? "usr_student_demo",
  );
  return submission;
}

function applyMarkNotificationRead(state: PlatformState, input: { notificationId: string }) {
  state.notifications = state.notifications.map((notification) =>
    notification.id === input.notificationId ? { ...notification, read: true } : notification,
  );
  return state.notifications.find((notification) => notification.id === input.notificationId);
}

function applySaveReportPreset(
  state: PlatformState,
  input: Extract<PlatformWorkflowAction, { type: "report.preset.save" }>,
  ctx: MutationContext,
) {
  const label = input.label.trim().slice(0, 80) || "Saved report view";
  const preset: ReportPreset = {
    id: ctx.createId("rptpreset"),
    ownerUserId: input.actorId ?? "usr_admin_demo",
    role: input.role,
    label,
    reportType: input.reportType,
    search: input.search?.trim().slice(0, 120) ?? "",
    status: input.status?.trim().slice(0, 40) || "all",
    rowCount: Math.max(0, Math.round(input.rowCount ?? 0)),
    createdAt: ctx.now(),
  };
  state.reportPresets = [
    preset,
    ...(state.reportPresets ?? []).filter(
      (item) => !(item.ownerUserId === preset.ownerUserId && item.role === preset.role && item.label === preset.label),
    ),
  ].slice(0, 40);
  appendAudit(
    state,
    ctx,
    "report.preset.saved",
    "ReportPreset",
    preset.id,
    `Saved ${preset.reportType} report view for ${preset.role}.`,
    preset.ownerUserId,
  );
  return preset;
}

export function applyPlatformWorkflowAction(
  state: PlatformState,
  action: PlatformWorkflowAction,
  ctxInput?: Partial<MutationContext>,
): PlatformWorkflowActionResult {
  const ctx = context(ctxInput);

  switch (action.type) {
    case "lesson.start": {
      const result = applyStartLesson(state, action, ctx);
      return {
        action: "lesson.start",
        entityType: "Lesson",
        entityId: result.id,
        summary: `Opened lesson ${result.title}.`,
        result,
      };
    }
    case "lesson.complete": {
      const result = applyCompleteLesson(state, action, ctx);
      return {
        action: "lesson.complete",
        entityType: "Lesson",
        entityId: result.id,
        summary: `Completed lesson ${result.title}.`,
        result,
      };
    }
    case "assignment.submit": {
      const result = applySubmitAssignment(state, action, ctx);
      return {
        action: "assignment.submit",
        entityType: "AssignmentSubmission",
        entityId: result.id,
        summary: `Submitted assignment ${result.assignmentId}.`,
        result,
      };
    }
    case "quiz.submit": {
      const result = applySubmitQuizAttempt(state, action, ctx);
      return {
        action: "quiz.submit",
        entityType: "QuizAttempt",
        entityId: result.id,
        summary: `Submitted quiz ${result.quizId}.`,
        result,
      };
    }
    case "lead.create": {
      const result = applyCreateLead(state, action, ctx);
      return { action: "lead.created", entityType: "Lead", entityId: result.id, summary: `Created lead for ${result.fullName}.`, result };
    }
    case "application.create": {
      const result = applyCreateApplication(state, action, ctx);
      return {
        action: "application.created",
        entityType: "Application",
        entityId: result.application.id,
        summary: `Created application for ${result.lead.fullName}.`,
        result,
      };
    }
    case "user.create": {
      const result = applyCreateUserAccount(state, action, ctx);
      return {
        action: "user.created",
        entityType: "User",
        entityId: result.user.id,
        summary: `Created ${result.user.activeRole} account for ${result.user.name}.`,
        result,
      };
    }
    case "staff.user.create": {
      const result = applyCreateStaffUserAccount(state, action, ctx);
      return {
        action: "staff.user.created",
        entityType: "User",
        entityId: result.user.id,
        summary: `Created ${result.staffProfile.title} account for ${result.user.name}.`,
        result,
      };
    }
    case "student.create": {
      const result = applyCreateStudentLifecycleAccount(state, action, ctx);
      return {
        action: "student.created",
        entityType: "StudentProfile",
        entityId: result.student.id,
        summary: `Created student ${result.user.name} and assigned ${result.classGroup.name}.`,
        result,
      };
    }
    case "student.status.update": {
      const result = applyUpdateStudentStatus(state, action, ctx);
      return {
        action: "student.status_updated",
        entityType: "StudentProfile",
        entityId: result?.id ?? action.studentId,
        summary: result ? `Updated student ${result.id} to ${result.status}.` : "No student updated.",
        result,
      };
    }
    case "profile.update": {
      const result = applyUpdateProfile(state, action, ctx);
      return {
        action: "profile.updated",
        entityType: "User",
        entityId: result.user.id,
        summary: result.changed.length
          ? `Updated profile for ${result.user.name}.`
          : `Reviewed profile for ${result.user.name}; no changes were needed.`,
        result,
      };
    }
    case "user.update": {
      const result = applyUpdateUserAccount(state, action, ctx);
      return {
        action: "user.updated",
        entityType: "User",
        entityId: result.user.id,
        summary: `Updated access for ${result.user.name}.`,
        result,
      };
    }
    case "permission.update": {
      const result = applyUpdatePermission(state, action, ctx);
      return {
        action: "permission.updated",
        entityType: "Role",
        entityId: result.role,
        summary: `${result.permission} ${result.granted ? "granted" : "removed"} for ${result.role}.`,
        result,
      };
    }
    case "branch.update": {
      const result = applyUpdateBranch(state, action, ctx);
      return {
        action: "branch.updated",
        entityType: "Branch",
        entityId: result.branch.id,
        summary: `${result.branch.name} set to ${result.branch.status}.`,
        result,
      };
    }
    case "room.status.update": {
      const result = applyUpdateRoomStatus(state, action, ctx);
      return {
        action: "room.status_updated",
        entityType: "Room",
        entityId: result.room.id,
        summary: `${result.room.name} set to ${result.room.status}.`,
        result,
      };
    }
    case "room.create": {
      const result = applyCreateRoom(state, action, ctx);
      return {
        action: "room.created",
        entityType: "Room",
        entityId: result.room.id,
        summary: `${result.room.name} added to ${result.branch.name}.`,
        result,
      };
    }
    case "integration.status.update": {
      const result = applyUpdateIntegrationStatus(state, action, ctx);
      return {
        action: "integration.status_updated",
        entityType: "IntegrationConfig",
        entityId: result.integration.id,
        summary: `${result.integration.label} set to ${result.integration.status}.`,
        result,
      };
    }
    case "integration.local_check": {
      const result = applyCheckIntegration(state, action, ctx);
      return {
        action: "integration.local_checked",
        entityType: "IntegrationConfig",
        entityId: result.integration.id,
        summary: `${result.integration.label} checked locally.`,
        result,
      };
    }
    case "system.health_check": {
      const result = applyCheckSystemHealth(state, action, ctx);
      return {
        action: "system.health_checked",
        entityType: "PlatformSystem",
        entityId: "health",
        summary: `System health check scored ${result.score}%.`,
        result,
      };
    }
    case "settings.save": {
      const result = applySavePlatformSettings(state, action, ctx);
      return {
        action: "settings.saved",
        entityType: "PlatformSettings",
        entityId: "global",
        summary: `Saved platform settings for ${result.settings.organization}.`,
        result,
      };
    }
    case "portal.settings.save": {
      const result = applySavePortalSettings(state, action, ctx);
      return {
        action: "portal_settings.saved",
        entityType: "PortalSettings",
        entityId: `${result.settings.role}:${result.settings.scopeId}`,
        summary: `Saved ${result.settings.label} settings.`,
        result,
      };
    }
    case "placement.create": {
      const result = applyCreatePlacementBooking(state, action, ctx);
      return {
        action: "placement.created",
        entityType: "PlacementTestBooking",
        entityId: result.id,
        summary: `Booked placement test for ${result.fullName}.`,
        result,
      };
    }
    case "curriculum.module.create": {
      const result = applyCreateCurriculumModule(state, action, ctx);
      return {
        action: "curriculum.module_created",
        entityType: "Module",
        entityId: result.id,
        summary: `Added module ${result.title}.`,
        result,
      };
    }
    case "course.status.update": {
      const result = applyUpdateCourseStatus(state, action, ctx);
      return {
        action: "course.status_updated",
        entityType: "Course",
        entityId: result.id,
        summary: `Set ${result.title} to ${result.status}.`,
        result,
      };
    }
    case "material.publish.update": {
      const result = applyUpdateMaterialPublish(state, action, ctx);
      return {
        action: result.published ? "material.published" : "material.unpublished",
        entityType: "LessonResource",
        entityId: result.id,
        summary: `${result.title} marked ${result.published ? "published" : "unpublished"}.`,
        result,
      };
    }
    case "record.save": {
      const result = applySaveOperationalRecord(state, action, ctx);
      return {
        action: "record.saved",
        entityType: action.module,
        entityId: result.entityId,
        summary: result.audit.summary,
        result,
      };
    }
    case "assignment.create": {
      const result = applyCreateAssignment(state, action, ctx);
      return { action: "assignment.created", entityType: "Assignment", entityId: result.id, summary: `${result.title} created.`, result };
    }
    case "quiz.create": {
      const result = applyCreateQuiz(state, action, ctx);
      return { action: "quiz.created", entityType: "Quiz", entityId: result.id, summary: `${result.title} created.`, result };
    }
    case "quiz.questions.set": {
      const result = applySetQuizQuestions(state, action, ctx);
      return {
        action: "quiz.questions.updated",
        entityType: "Quiz",
        entityId: result.id,
        summary: `${result.questionIds.length} question(s) attached to ${result.title}.`,
        result,
      };
    }
    case "question.create": {
      const result = applyCreateQuestionBankItem(state, action, ctx);
      return {
        action: "question.created",
        entityType: "QuestionBankItem",
        entityId: result.id,
        summary: "Question added to the bank.",
        result,
      };
    }
    case "assignment.grade": {
      const result = applyGradeAssignmentSubmission(state, action, ctx);
      return {
        action: "assignment.graded",
        entityType: "AssignmentSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result ? `Graded assignment submission ${result.id}.` : "No assignment submission changed.",
        result,
      };
    }
    case "quiz.review": {
      const result = applyReviewQuizAttempt(state, action, ctx);
      return {
        action: "quiz.reviewed",
        entityType: "QuizAttempt",
        entityId: result?.id ?? action.attemptId,
        summary: result ? `Reviewed quiz attempt ${result.id}.` : "No quiz attempt changed.",
        result,
      };
    }
    case "attendance.save": {
      const result = applySaveAttendanceBulk(state, action, ctx);
      return {
        action: "attendance.saved",
        entityType: "AttendanceRecord",
        entityId: action.classGroupId,
        summary: `Saved attendance for ${Object.keys(action.statuses).length} learner(s).`,
        result,
      };
    }
    case "calendar.create": {
      const result = applyCreateCalendarEvent(state, action, ctx);
      const reviewCount = result.conflicts.length + result.availabilityGaps.length;
      return {
        action: reviewCount ? "calendar.created_with_conflict" : "calendar.created",
        entityType: "CalendarEvent",
        entityId: result.event.id,
        summary: reviewCount
          ? `${result.event.title} created with ${result.conflicts.length} conflict(s) and ${result.availabilityGaps.length} availability review(s).`
          : `${result.event.title} created.`,
        result,
      };
    }
    case "message.send": {
      const result = applySendMessage(state, action, ctx);
      return { action: "message.sent", entityType: "Message", entityId: result.id, summary: `Sent message: ${result.subject}.`, result };
    }
    case "certificate.approve": {
      const result = applyApproveCertificate(state, action, ctx);
      return {
        action: "certificate.approved",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result ? `Approved certificate ${result.verificationCode}.` : "No certificate changed.",
        result,
      };
    }
    case "certificate.issue": {
      const result = applyIssueCertificate(state, action, ctx);
      return {
        action: "certificate.issued",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result ? `Issued certificate ${result.verificationCode}.` : "No certificate changed.",
        result,
      };
    }
    case "certificate.reject": {
      const result = applyRejectCertificate(state, action, ctx);
      return {
        action: "certificate.rejected",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result ? `Rejected certificate ${result.verificationCode}.` : "No certificate changed.",
        result,
      };
    }
    case "payment.record": {
      const result = applyRecordPayment(state, action, ctx);
      return {
        action: "payment.recorded",
        entityType: "Payment",
        entityId: result?.id ?? action.invoiceId,
        summary: result ? `Recorded payment ${result.id}.` : "No payment changed.",
        result,
      };
    }
    case "placement.result.record": {
      const result = applyRecordPlacementResult(state, action, ctx);
      return {
        action: "placement.result_recorded",
        entityType: "PlacementTestResult",
        entityId: result?.id ?? action.bookingId,
        summary: result ? `Recorded placement result ${result.id}.` : "No placement result changed.",
        result,
      };
    }
    case "lead.convert": {
      const result = applyConvertLeadToApplication(state, action, ctx);
      return {
        action: "lead.converted",
        entityType: "Application",
        entityId: result?.id ?? action.leadId,
        summary: result ? `Converted lead ${action.leadId}.` : "No lead converted.",
        result,
      };
    }
    case "application.convert": {
      const result = applyConvertApplicationToEnrollmentWorkflow(state, action, ctx);
      return {
        action: "application.converted",
        entityType: "EnrollmentWorkflow",
        entityId: result?.id ?? action.applicationId,
        summary: result ? `Prepared enrollment workflow ${result.id}.` : "No application converted.",
        result,
      };
    }
    case "enrollment.activate": {
      const result = applyActivateEnrollmentWorkflow(state, action, ctx);
      return {
        action: "enrollment.activated",
        entityType: "EnrollmentWorkflow",
        entityId: action.workflowId,
        summary: result ? `Activated student ${result.id}.` : "No enrollment activated.",
        result,
      };
    }
    case "teacher.assign": {
      const result = applyAssignTeacherToCourseRun(state, action, ctx);
      return {
        action: "teacher.assigned",
        entityType: "CourseRun",
        entityId: result.courseRun.id,
        summary: `${result.teacher.name} assigned to ${result.classGroups.length} class group(s).`,
        result,
      };
    }
    case "quran.progress.update": {
      const result = applyUpdateQuranProgress(state, action, ctx);
      return {
        action: "quran.progress_updated",
        entityType: "QuranProgressRecord",
        entityId: result?.id ?? action.recordId,
        summary: result ? `Updated ${result.surah} progress.` : "No Quran progress changed.",
        result,
      };
    }
    case "recitation.review": {
      const result = applyReviewRecitation(state, action, ctx);
      return {
        action: "recitation.reviewed",
        entityType: "RecitationSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result ? `Reviewed ${result.title}.` : "No recitation changed.",
        result,
      };
    }
    case "recitation.submit": {
      const result = applySubmitRecitation(state, action, ctx);
      return {
        action: "recitation.submitted",
        entityType: "RecitationSubmission",
        entityId: result.id,
        summary: `Submitted ${result.title}.`,
        result,
      };
    }
    case "notification.read": {
      const result = applyMarkNotificationRead(state, action);
      return {
        action: "notification.read",
        entityType: "Notification",
        entityId: action.notificationId,
        summary: "Marked notification as read.",
        result,
      };
    }
    case "report.preset.save": {
      const result = applySaveReportPreset(state, action, ctx);
      return {
        action: "report.preset.saved",
        entityType: "ReportPreset",
        entityId: result.id,
        summary: `Saved ${result.reportType} report view for ${result.role}.`,
        result,
      };
    }
    default: {
      const neverAction: never = action;
      throw new Error(`Unsupported platform action ${(neverAction as { type?: string }).type ?? "unknown"}.`);
    }
  }
}

export function applyLearningAction(
  state: PlatformState,
  action: PlatformLearningAction,
  ctxInput?: Partial<MutationContext>,
): PlatformLearningActionResult {
  if (action.type === "lesson.start") {
    const lesson = applyStartLesson(state, action, ctxInput);
    return {
      action: action.type,
      entityType: "Lesson",
      entityId: lesson.id,
      summary: `Opened lesson ${lesson.title}.`,
      result: lesson,
    };
  }

  if (action.type === "lesson.complete") {
    const lesson = applyCompleteLesson(state, action, ctxInput);
    return {
      action: action.type,
      entityType: "Lesson",
      entityId: lesson.id,
      summary: `Completed lesson ${lesson.title}.`,
      result: lesson,
    };
  }

  if (action.type === "assignment.submit") {
    const submission = applySubmitAssignment(state, action, ctxInput);
    return {
      action: action.type,
      entityType: "AssignmentSubmission",
      entityId: submission.id,
      summary: `Submitted assignment ${submission.assignmentId}.`,
      result: submission,
    };
  }

  const attempt = applySubmitQuizAttempt(state, action, ctxInput);
  return {
    action: action.type,
    entityType: "QuizAttempt",
    entityId: attempt.id,
    summary: `Submitted quiz ${attempt.quizId}.`,
    result: attempt,
  };
}
