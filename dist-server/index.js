// server/index.ts
import express2 from "express";
import { createServer } from "http";
import path4 from "path";
import { fileURLToPath } from "url";

// server/routes.ts
import express from "express";

// server/auth.ts
import crypto from "node:crypto";
var COOKIE_NAME = "nilelearn_session";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 12;
var sessions = /* @__PURE__ */ new Map();
var demoUsers = {
  student: { id: "usr_student_demo", email: "student.demo@nilelearn.local", name: "Student Demo" },
  teacher: { id: "usr_teacher_demo", email: "teacher.demo@nilelearn.local", name: "Teacher Demo" },
  registrar: { id: "usr_registrar_demo", email: "registrar.demo@nilelearn.local", name: "Registrar Demo" },
  headofdepartment: { id: "usr_hod_demo", email: "hod.demo@nilelearn.local", name: "HOD Demo" },
  branchadmin: { id: "usr_branch_demo", email: "branch.demo@nilelearn.local", name: "Branch Demo" },
  superadmin: { id: "usr_admin_demo", email: "admin.demo@nilelearn.local", name: "Admin Demo" }
};
function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}
function isServerRole(value) {
  return typeof value === "string" && value in demoUsers;
}
function demoAuthEnabled() {
  const explicit = process.env.DEMO_AUTH_ENABLED ?? process.env.VITE_DEMO_AUTH_ENABLED;
  if (explicit !== void 0) return explicit === "true";
  return process.env.NODE_ENV !== "production";
}
function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...rest] = part.split("=");
      return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
    })
  );
}
function writeSessionCookie(res, sessionId) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}; HttpOnly; SameSite=Lax${secure}`
  );
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}
function createSession(input) {
  const id = crypto.randomUUID();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session = { id, createdAt, expiresAt, ...input };
  sessions.set(id, session);
  return session;
}
function getRequestSession(req) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}
function endRequestSession(req, res) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (sessionId) sessions.delete(sessionId);
  clearSessionCookie(res);
}
function getSupabaseAuthConfig() {
  const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
  const key = clean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  return { url, key };
}
function rolesFromAppMetadata(user) {
  const rawRoles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : user.app_metadata?.role ? [user.app_metadata.role] : [];
  return rawRoles.filter(isServerRole);
}
async function signInWithSupabase(email, password, requestedRole) {
  const config = getSupabaseAuthConfig();
  if (!config.url || !config.key) return null;
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const user = payload.user;
  if (!user) return null;
  const roles = rolesFromAppMetadata(user);
  if (!roles.includes(requestedRole)) {
    throw new Error("Your Supabase account is missing the requested role in app_metadata.");
  }
  return createSession({
    userId: clean(user.app_metadata?.demo_user_id) || user.id,
    email: user.email ?? email,
    name: user.app_metadata?.full_name ?? user.app_metadata?.name ?? email,
    roles,
    activeRole: requestedRole,
    provider: "supabase"
  });
}
function signInWithDemo(email, password, requestedRole) {
  if (!demoAuthEnabled()) return null;
  const user = demoUsers[requestedRole];
  if (clean(email).toLowerCase() !== user.email || clean(password).length < 4) return null;
  return createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: [requestedRole],
    activeRole: requestedRole,
    provider: "demo"
  });
}
async function signIn(email, password, requestedRole) {
  const supabaseSession = await signInWithSupabase(email, password, requestedRole);
  if (supabaseSession) return supabaseSession;
  const demoSession = signInWithDemo(email, password, requestedRole);
  if (demoSession) return demoSession;
  throw new Error("Invalid email, password, or role.");
}
function attachSession(res, session) {
  writeSessionCookie(res, session.id);
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    roles: session.roles,
    activeRole: session.activeRole,
    provider: session.provider,
    expiresAt: session.expiresAt
  };
}

// server/env.ts
import fs from "node:fs";
import path from "node:path";
var loaded = false;
function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const equalsAt = trimmed.indexOf("=");
  if (equalsAt === -1) return null;
  const key = trimmed.slice(0, equalsAt).trim();
  const rawValue = trimmed.slice(equalsAt + 1).trim();
  const value = rawValue.startsWith('"') && rawValue.endsWith('"') || rawValue.startsWith("'") && rawValue.endsWith("'") ? rawValue.slice(1, -1) : rawValue;
  return key ? { key, value } : null;
}
function loadServerEnv() {
  if (loaded) return;
  loaded = true;
  [".env", ".env.local"].forEach((filename) => {
    const envPath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    lines.forEach((line) => {
      const parsed = parseEnvLine(line);
      if (parsed && process.env[parsed.key] === void 0) {
        process.env[parsed.key] = parsed.value;
      }
    });
  });
}

// server/platformRecords.ts
import fs2 from "node:fs";
import path2 from "node:path";

// server/supabase.ts
function clean2(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeUrl(url) {
  return clean2(url).replace(/\/+$/, "");
}
function getProjectRef(url) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : void 0;
  } catch {
    return void 0;
  }
}
function getSupabaseServerConfig(env = process.env) {
  const url = normalizeUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const publishableKey = clean2(env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY);
  const secretKey = clean2(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    url,
    publishableKey,
    secretKey,
    projectRef: getProjectRef(url)
  };
}
function getSupabaseServerStatus(env = process.env) {
  const config = getSupabaseServerConfig(env);
  return {
    urlConfigured: Boolean(config.url),
    publishableKeyConfigured: Boolean(config.publishableKey),
    secretKeyConfigured: Boolean(config.secretKey),
    adminAvailable: Boolean(config.url && config.secretKey),
    projectRef: config.projectRef
  };
}
async function supabaseAdminRestFetch(path5, init = {}, env = process.env) {
  const config = getSupabaseServerConfig(env);
  if (!config.url || !config.secretKey) {
    throw new Error("Supabase admin config is missing SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", config.secretKey);
  headers.set("Authorization", `Bearer ${config.secretKey}`);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  return fetch(`${config.url}/rest/v1/${path5.replace(/^\/+/, "")}`, {
    ...init,
    headers
  });
}

// server/platformRecords.ts
var DATA_DIR = process.env.VERCEL ? "/tmp" : path2.resolve(process.cwd(), ".local-data");
var DATA_FILE = path2.join(DATA_DIR, "platform-records.json");
function ensureDataDir() {
  if (!fs2.existsSync(DATA_DIR)) fs2.mkdirSync(DATA_DIR, { recursive: true, mode: 448 });
}
function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function readState() {
  try {
    if (!fs2.existsSync(DATA_FILE)) return { records: [] };
    return JSON.parse(fs2.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { records: [] };
  }
}
function writeState(state) {
  ensureDataDir();
  fs2.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), { mode: 384 });
}
function getPlatformBackendState() {
  return readState();
}
async function saveSupabaseRecord(record2) {
  const table = process.env.SUPABASE_PLATFORM_RECORDS_TABLE || "platform_records";
  const response = await supabaseAdminRestFetch(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: record2.id,
      type: record2.type,
      payload: record2.payload,
      actor_id: record2.actorId ?? null,
      created_at: record2.createdAt
    })
  });
  if (!response.ok) throw new Error(`Supabase record insert failed with ${response.status}`);
  return { ...record2, persistence: "supabase" };
}
function saveLocalRecord(record2) {
  const state = readState();
  const localRecord = { ...record2, persistence: "local" };
  state.records = [localRecord, ...state.records].slice(0, 1e3);
  writeState(state);
  return localRecord;
}
async function savePlatformBackendRecord(type, payload, actorId) {
  const record2 = {
    id: createId(type),
    type,
    payload,
    actorId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    return await saveSupabaseRecord(record2);
  } catch {
    return saveLocalRecord(record2);
  }
}

// server/platformState.ts
import fs3 from "node:fs";
import path3 from "node:path";

// client/src/lib/domain/actions.ts
var defaultContext = {
  createId: (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  now: () => (/* @__PURE__ */ new Date()).toISOString()
};
function context(input) {
  return { ...defaultContext, ...input };
}
function appendAudit(state, ctx, action, entityType, entityId, summary, actorId = "usr_student_demo") {
  const audit = {
    id: ctx.createId("audit"),
    actorId,
    action,
    entityType,
    entityId,
    summary,
    createdAt: ctx.now()
  };
  state.auditLogs = [audit, ...state.auditLogs].slice(0, 160);
  return audit;
}
function notify(state, ctx, input) {
  const notification = {
    id: ctx.createId("not"),
    read: false,
    createdAt: ctx.now(),
    ...input
  };
  state.notifications = [notification, ...state.notifications].slice(0, 80);
  return notification;
}
function requireLesson(state, lessonId) {
  const lesson = state.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} was not found.`);
  return lesson;
}
function requireAssignment(state, assignmentId) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} was not found.`);
  return assignment;
}
function requireQuiz(state, quizId) {
  const quiz = state.quizzes.find((item) => item.id === quizId);
  if (!quiz) throw new Error(`Quiz ${quizId} was not found.`);
  return quiz;
}
function applyStartLesson(state, input, ctxInput) {
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
        status: "in_progress"
      },
      ...state.lessonProgress
    ];
  }
  appendAudit(state, ctx, "lesson.started", "Lesson", lesson.id, `Opened lesson ${lesson.title}.`, actorId);
  return lesson;
}
function applyCompleteLesson(state, input, ctxInput) {
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
        completedAt: ctx.now()
      },
      ...state.lessonProgress
    ];
  }
  const module = state.modules.find((item) => item.id === lesson.moduleId);
  const courseRun = module ? state.courseRuns.find((run) => run.courseId === module.courseId) : void 0;
  if (courseRun && !alreadyCompleted) {
    state.enrollments = state.enrollments.map(
      (enrollment) => enrollment.studentId === studentId && enrollment.courseRunId === courseRun.id ? { ...enrollment, progress: Math.min(100, enrollment.progress + 6) } : enrollment
    );
  }
  appendAudit(state, ctx, "lesson.completed", "Lesson", lesson.id, `Completed lesson ${lesson.title}.`, actorId);
  return lesson;
}
function applySubmitAssignment(state, input, ctxInput) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const assignment = requireAssignment(state, input.assignmentId);
  const existing = state.assignmentSubmissions.find(
    (item) => item.assignmentId === assignment.id && item.studentId === studentId && item.status !== "completed"
  );
  const submission = {
    id: existing?.id ?? ctx.createId("sub"),
    assignmentId: assignment.id,
    studentId,
    submittedAt: ctx.now(),
    status: "pending",
    response: input.response
  };
  state.assignmentSubmissions = existing ? state.assignmentSubmissions.map((item) => item.id === existing.id ? submission : item) : [submission, ...state.assignmentSubmissions];
  notify(state, ctx, {
    userId: "usr_teacher_demo",
    title: "Assignment submitted",
    body: `${assignment.title} is ready for review.`,
    href: "/app/teacher/grading"
  });
  appendAudit(
    state,
    ctx,
    existing ? "assignment.resubmitted" : "assignment.submitted",
    "AssignmentSubmission",
    submission.id,
    `Submitted ${assignment.title}.`,
    actorId
  );
  return submission;
}
function applySubmitQuizAttempt(state, input, ctxInput) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const quiz = requireQuiz(state, input.quizId);
  const previousAttempts = state.quizAttempts.filter((attempt2) => attempt2.quizId === quiz.id && attempt2.studentId === studentId);
  if (quiz.attemptsAllowed <= 0) throw new Error("This quiz is not accepting attempts.");
  if (previousAttempts.length >= quiz.attemptsAllowed) {
    return previousAttempts[0];
  }
  const score = Math.max(70, 100 - Object.values(input.answers).filter((answer) => answer.trim().length < 2).length * 10);
  const attempt = {
    id: ctx.createId("attempt"),
    quizId: quiz.id,
    studentId,
    startedAt: ctx.now(),
    submittedAt: ctx.now(),
    status: "completed",
    score,
    maxScore: 100,
    answers: input.answers
  };
  const grade = {
    id: ctx.createId("grade"),
    studentId,
    courseRunId: quiz.courseRunId,
    itemId: quiz.id,
    itemTitle: quiz.title,
    score,
    maxScore: 100,
    feedback: score >= 80 ? "Auto-graded pass. Teacher can add manual feedback." : "Auto-graded with manual review recommended."
  };
  state.quizAttempts = [attempt, ...state.quizAttempts];
  state.grades = [grade, ...state.grades];
  appendAudit(state, ctx, "quiz.submitted", "QuizAttempt", attempt.id, `Submitted ${quiz.title} with ${score}/100.`, actorId);
  return attempt;
}
function messageRouteForUser(user) {
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
function applyCreateLead(state, input, ctx) {
  const lead = {
    id: ctx.createId("lead"),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    country: input.country,
    subject: input.subject,
    source: input.source ?? "trial_form",
    status: "lead",
    notes: input.notes,
    createdAt: ctx.now()
  };
  state.leads = [lead, ...state.leads];
  appendAudit(
    state,
    ctx,
    "lead.created",
    "Lead",
    lead.id,
    `Created lead for ${lead.fullName} from ${lead.source}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return lead;
}
function applyCreatePlacementBooking(state, input, ctx) {
  const booking = {
    id: ctx.createId("pt"),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    branchId: input.branchId ?? "br_online",
    subject: input.subject,
    preferredDate: input.preferredDate,
    currentLevel: input.currentLevel,
    status: "pending"
  };
  state.placementTests = [booking, ...state.placementTests];
  appendAudit(
    state,
    ctx,
    "placement.created",
    "PlacementTestBooking",
    booking.id,
    `Booked placement test for ${booking.fullName}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return booking;
}
function applySaveOperationalRecord(state, input, ctx) {
  const entityId = ctx.createId("record");
  const audit = appendAudit(
    state,
    ctx,
    "record.saved",
    input.module,
    entityId,
    `Saved ${input.module} record: ${input.payload.title ?? input.payload.name ?? entityId}.`,
    input.actorId ?? "usr_admin_demo"
  );
  return { entityId, audit };
}
function applyCreateAssignment(state, input, ctx) {
  const assignment = {
    id: ctx.createId("asg"),
    courseRunId: input.courseRunId,
    title: input.title,
    dueAt: input.dueAt,
    submissionType: input.submissionType,
    rubric: input.rubric,
    status: "active"
  };
  state.assignments = [assignment, ...state.assignments];
  appendAudit(
    state,
    ctx,
    "assignment.created",
    "Assignment",
    assignment.id,
    `${assignment.title} created.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return assignment;
}
function applyCreateQuiz(state, input, ctx) {
  const quiz = {
    id: ctx.createId("quiz"),
    courseRunId: input.courseRunId,
    title: input.title,
    durationMinutes: input.durationMinutes,
    questionTypes: input.questionTypes,
    attemptsAllowed: input.attemptsAllowed,
    status: "active"
  };
  state.quizzes = [quiz, ...state.quizzes];
  appendAudit(
    state,
    ctx,
    "quiz.created",
    "Quiz",
    quiz.id,
    `${quiz.title} created.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return quiz;
}
function applyGradeAssignmentSubmission(state, input, ctx) {
  let updatedSubmission;
  state.assignmentSubmissions = state.assignmentSubmissions.map((submission) => {
    if (submission.id !== input.submissionId) return submission;
    updatedSubmission = {
      ...submission,
      status: "completed",
      score: input.score,
      feedback: input.feedback
    };
    return updatedSubmission;
  });
  if (!updatedSubmission) return void 0;
  const assignment = state.assignments.find((item) => item.id === updatedSubmission?.assignmentId);
  const existingGrade = state.grades.find(
    (grade) => grade.studentId === updatedSubmission?.studentId && grade.courseRunId === assignment?.courseRunId && (grade.itemId ? grade.itemId === assignment?.id : grade.itemTitle === assignment?.title)
  );
  const maxScore = 100;
  if (existingGrade) {
    existingGrade.score = input.score;
    existingGrade.maxScore = maxScore;
    existingGrade.feedback = input.feedback;
  } else if (assignment) {
    state.grades = [
      {
        id: ctx.createId("gr"),
        studentId: updatedSubmission.studentId,
        courseRunId: assignment.courseRunId,
        itemId: assignment.id,
        itemTitle: assignment.title,
        score: input.score,
        maxScore,
        feedback: input.feedback
      },
      ...state.grades
    ];
  }
  const student = state.students.find((item) => item.id === updatedSubmission?.studentId);
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Assignment graded",
    body: `${assignment?.title ?? "Assignment"} received ${input.score}/${maxScore}.`,
    href: "/app/student/grades"
  });
  appendAudit(
    state,
    ctx,
    "assignment.graded",
    "AssignmentSubmission",
    updatedSubmission.id,
    `${assignment?.title ?? "Assignment"} graded ${input.score}/${maxScore}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return updatedSubmission;
}
function applySaveAttendanceBulk(state, input, ctx) {
  const session = state.classSessions.find((item) => item.id === input.sessionId || item.eventId === input.sessionId);
  const classGroup = state.classGroups.find((item) => item.id === input.classGroupId);
  if (!classGroup) throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (session && session.classGroupId !== classGroup.id) throw new Error("Attendance session does not belong to this class group.");
  const roster = new Set(classGroup.studentIds);
  const suppliedStudentIds = Object.keys(input.statuses);
  const invalidStudentId = suppliedStudentIds.find((studentId) => !roster.has(studentId));
  if (invalidStudentId) throw new Error(`Student ${invalidStudentId} is not in this class roster.`);
  const missingStudentId = classGroup.studentIds.find((studentId) => !(studentId in input.statuses));
  if (missingStudentId) throw new Error(`Attendance is missing roster student ${missingStudentId}.`);
  const sessionKeys = new Set([input.sessionId, session?.id, session?.eventId].filter(Boolean));
  Object.entries(input.statuses).forEach(([studentId, status]) => {
    const existing = state.attendance.find(
      (record2) => record2.classGroupId === input.classGroupId && sessionKeys.has(record2.sessionId) && record2.studentId === studentId
    );
    if (existing) {
      existing.status = status;
      existing.sessionId = session?.id ?? input.sessionId;
    } else {
      state.attendance = [
        {
          id: ctx.createId("att"),
          classGroupId: input.classGroupId,
          studentId,
          sessionId: session?.id ?? input.sessionId,
          status
        },
        ...state.attendance
      ];
    }
  });
  state.classSessions = state.classSessions.map(
    (item) => item.id === input.sessionId || item.eventId === input.sessionId ? { ...item, attendanceSaved: true } : item
  );
  appendAudit(
    state,
    ctx,
    "attendance.saved",
    "AttendanceRecord",
    input.classGroupId,
    `Saved attendance for ${Object.keys(input.statuses).length} learner(s).`,
    input.actorId ?? "usr_teacher_demo"
  );
  return state.attendance.filter(
    (record2) => record2.classGroupId === input.classGroupId && sessionKeys.has(record2.sessionId)
  );
}
function applyCreateCalendarEvent(state, input, ctx) {
  const requestedClassGroup = input.classGroupId ? state.classGroups.find((item) => item.id === input.classGroupId) : void 0;
  const requestedRun = requestedClassGroup ? state.courseRuns.find((item) => item.id === requestedClassGroup.courseRunId) : void 0;
  const classGroupId = requestedClassGroup && (!input.branchId || requestedRun?.branchId === input.branchId) ? requestedClassGroup.id : void 0;
  const starts = new Date(input.startsAt).getTime();
  const ends = new Date(input.endsAt).getTime();
  const conflicts = state.events.filter((event2) => {
    const eventStarts = new Date(event2.startsAt).getTime();
    const eventEnds = new Date(event2.endsAt).getTime();
    const overlaps = starts < eventEnds && ends > eventStarts;
    if (!overlaps) return false;
    return Boolean(
      input.roomId && event2.roomId === input.roomId || input.ownerId && event2.ownerId === input.ownerId || classGroupId && event2.classGroupId === classGroupId
    );
  });
  const event = {
    id: ctx.createId("evt"),
    type: input.eventType,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ownerId: input.ownerId,
    branchId: input.branchId,
    roomId: input.roomId,
    classGroupId,
    status: conflicts.length ? "pending" : "active"
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
        attendanceSaved: false
      },
      ...state.classSessions
    ];
  }
  appendAudit(
    state,
    ctx,
    conflicts.length ? "calendar.created_with_conflict" : "calendar.created",
    "CalendarEvent",
    event.id,
    `${event.title} created${conflicts.length ? ` with ${conflicts.length} conflict(s)` : ""}.`,
    input.actorId ?? "usr_branch_demo"
  );
  return { event, conflicts };
}
function applySendMessage(state, input, ctx) {
  const fromUserId = input.fromUserId ?? input.actorId ?? "usr_student_demo";
  const message = {
    id: ctx.createId("msg"),
    fromUserId,
    toUserId: input.toUserId,
    subject: input.subject,
    body: input.body,
    read: false,
    createdAt: ctx.now()
  };
  state.messages = [message, ...state.messages];
  const log = {
    id: ctx.createId("comm"),
    actorId: fromUserId,
    channel: input.channel ?? "in_app",
    subject: input.subject,
    body: input.body,
    relatedUserId: input.toUserId,
    status: "completed",
    createdAt: ctx.now()
  };
  state.communicationLogs = [log, ...state.communicationLogs];
  const recipient = state.users.find((user) => user.id === input.toUserId);
  notify(state, ctx, {
    userId: input.toUserId,
    title: input.subject,
    body: input.body,
    href: messageRouteForUser(recipient)
  });
  appendAudit(state, ctx, "message.sent", "Message", message.id, `Sent message: ${message.subject}.`, fromUserId);
  return message;
}
function applyApproveCertificate(state, input, ctx) {
  let updated;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "approved" || certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    changed = true;
    updated = { ...certificate, status: "approved", approvedBy: input.actorId ?? "usr_hod_demo" };
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
      input.actorId ?? "usr_hod_demo"
    );
  }
  return updated;
}
function applyIssueCertificate(state, input, ctx) {
  let updated;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "approved") return certificate;
    changed = true;
    updated = { ...certificate, status: "issued" };
    return updated;
  });
  if (updated && changed) {
    const student = state.students.find((item) => item.id === updated?.studentId);
    notify(state, ctx, {
      userId: student?.userId ?? updated.studentId,
      title: "Certificate issued",
      body: `${updated.verificationCode} is ready to download.`,
      href: "/app/student/certificates"
    });
    appendAudit(
      state,
      ctx,
      "certificate.issued",
      "Certificate",
      updated.id,
      `Issued certificate ${updated.verificationCode}.`,
      input.actorId ?? "usr_hod_demo"
    );
  }
  return updated;
}
function applyRecordPayment(state, input, ctx) {
  const invoice = state.invoices.find((item) => item.id === input.invoiceId);
  if (!invoice) return void 0;
  const paidSoFar = state.payments.filter((payment2) => payment2.invoiceId === invoice.id && payment2.status === "paid").reduce((sum, payment2) => sum + payment2.amount, 0);
  const amount = Math.max(0, invoice.amount - paidSoFar);
  if (amount <= 0 || invoice.status === "paid") {
    return state.payments.find((payment2) => payment2.invoiceId === invoice.id && payment2.status === "paid");
  }
  const payment = {
    id: ctx.createId("pay"),
    invoiceId: invoice.id,
    amount,
    method: "manual",
    paidAt: ctx.now(),
    status: "paid"
  };
  state.payments = [payment, ...state.payments];
  state.invoices = state.invoices.map((item) => item.id === invoice.id ? { ...item, status: "paid" } : item);
  appendAudit(
    state,
    ctx,
    "payment.recorded",
    "Payment",
    payment.id,
    `Recorded ${invoice.currency} ${amount} for ${invoice.id}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return payment;
}
function applyRecordPlacementResult(state, input, ctx) {
  const booking = state.placementTests.find((item) => item.id === input.bookingId) ?? state.placementTests[0];
  if (!booking) return void 0;
  const existing = state.placementResults.find((item) => item.bookingId === booking.id);
  const result = {
    id: existing?.id ?? ctx.createId("ptr"),
    bookingId: booking.id,
    examinerId: "usr_teacher_demo",
    score: input.score,
    recommendedLevel: input.recommendedLevel,
    notes: input.notes,
    createdAt: ctx.now()
  };
  state.placementResults = existing ? state.placementResults.map((item) => item.id === existing.id ? result : item) : [result, ...state.placementResults];
  state.placementTests = state.placementTests.map(
    (item) => item.id === booking.id ? { ...item, status: "completed", recommendedLevel: input.recommendedLevel } : item
  );
  const existingWorkflow = state.enrollmentWorkflows.find((workflow2) => workflow2.placementTestId === booking.id);
  const workflow = {
    id: existingWorkflow?.id ?? ctx.createId("ew"),
    leadId: booking.leadId,
    placementTestId: booking.id,
    targetCourseId: "course_ar_l3",
    status: "ready_to_enroll",
    nextStep: "Confirm package, create invoice, and assign class",
    updatedAt: ctx.now()
  };
  state.enrollmentWorkflows = existingWorkflow ? state.enrollmentWorkflows.map((item) => item.id === existingWorkflow.id ? workflow : item) : [workflow, ...state.enrollmentWorkflows];
  appendAudit(
    state,
    ctx,
    existing ? "placement.result_updated" : "placement.result_recorded",
    "PlacementTestResult",
    result.id,
    `Recorded placement result for ${booking.fullName}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return result;
}
function applyConvertLeadToApplication(state, input, ctx) {
  const lead = state.leads.find((item) => item.id === input.leadId) ?? state.leads[0];
  if (!lead) return void 0;
  const existing = state.applications.find((item) => item.leadId === lead.id);
  if (existing) return existing;
  state.leads = state.leads.map((item) => item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item);
  const application = {
    id: ctx.createId("app"),
    leadId: lead.id,
    branchId: "br_online",
    courseInterest: lead.subject,
    schedulePreference: "To confirm",
    status: "pending"
  };
  state.applications = [application, ...state.applications];
  appendAudit(
    state,
    ctx,
    "lead.converted",
    "Application",
    application.id,
    `Converted ${lead.fullName} to application.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return application;
}
function applyUpdateQuranProgress(state, input, ctx) {
  let updated;
  state.quranProgress = state.quranProgress.map((record2) => {
    if (record2.id !== input.recordId) return record2;
    updated = {
      ...record2,
      memorizedPercent: Math.min(100, Math.max(0, input.memorizedPercent)),
      tajweedScore: Math.min(100, Math.max(0, input.tajweedScore)),
      notes: input.notes
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
      input.actorId ?? "usr_teacher_demo"
    );
  }
  return updated;
}
function applyReviewRecitation(state, input, ctx) {
  let updated;
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
      href: "/app/student/quran-progress"
    });
    appendAudit(
      state,
      ctx,
      "recitation.reviewed",
      "RecitationSubmission",
      updated.id,
      `Reviewed ${updated.title}.`,
      input.actorId ?? "usr_teacher_demo"
    );
  }
  return updated;
}
function applySubmitRecitation(state, input, ctx) {
  const submission = {
    id: ctx.createId("rec"),
    studentId: input.studentId,
    teacherId: input.teacherId,
    title: input.title,
    submittedAt: ctx.now(),
    status: "pending"
  };
  state.recitationSubmissions = [submission, ...state.recitationSubmissions];
  notify(state, ctx, {
    userId: input.teacherId,
    title: "Recitation submitted",
    body: `${submission.title} is ready for review.`,
    href: "/app/teacher/quran-review"
  });
  appendAudit(
    state,
    ctx,
    "recitation.submitted",
    "RecitationSubmission",
    submission.id,
    `Submitted ${submission.title}.`,
    input.actorId ?? "usr_student_demo"
  );
  return submission;
}
function applyMarkNotificationRead(state, input) {
  state.notifications = state.notifications.map(
    (notification) => notification.id === input.notificationId ? { ...notification, read: true } : notification
  );
  return state.notifications.find((notification) => notification.id === input.notificationId);
}
function applyPlatformWorkflowAction(state, action, ctxInput) {
  const ctx = context(ctxInput);
  switch (action.type) {
    case "lesson.start": {
      const result = applyStartLesson(state, action, ctx);
      return {
        action: "lesson.start",
        entityType: "Lesson",
        entityId: result.id,
        summary: `Opened lesson ${result.title}.`,
        result
      };
    }
    case "lesson.complete": {
      const result = applyCompleteLesson(state, action, ctx);
      return {
        action: "lesson.complete",
        entityType: "Lesson",
        entityId: result.id,
        summary: `Completed lesson ${result.title}.`,
        result
      };
    }
    case "assignment.submit": {
      const result = applySubmitAssignment(state, action, ctx);
      return {
        action: "assignment.submit",
        entityType: "AssignmentSubmission",
        entityId: result.id,
        summary: `Submitted assignment ${result.assignmentId}.`,
        result
      };
    }
    case "quiz.submit": {
      const result = applySubmitQuizAttempt(state, action, ctx);
      return {
        action: "quiz.submit",
        entityType: "QuizAttempt",
        entityId: result.id,
        summary: `Submitted quiz ${result.quizId}.`,
        result
      };
    }
    case "lead.create": {
      const result = applyCreateLead(state, action, ctx);
      return { action: "lead.created", entityType: "Lead", entityId: result.id, summary: `Created lead for ${result.fullName}.`, result };
    }
    case "placement.create": {
      const result = applyCreatePlacementBooking(state, action, ctx);
      return {
        action: "placement.created",
        entityType: "PlacementTestBooking",
        entityId: result.id,
        summary: `Booked placement test for ${result.fullName}.`,
        result
      };
    }
    case "record.save": {
      const result = applySaveOperationalRecord(state, action, ctx);
      return {
        action: "record.saved",
        entityType: action.module,
        entityId: result.entityId,
        summary: result.audit.summary,
        result
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
    case "assignment.grade": {
      const result = applyGradeAssignmentSubmission(state, action, ctx);
      return {
        action: "assignment.graded",
        entityType: "AssignmentSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result ? `Graded assignment submission ${result.id}.` : "No assignment submission changed.",
        result
      };
    }
    case "attendance.save": {
      const result = applySaveAttendanceBulk(state, action, ctx);
      return {
        action: "attendance.saved",
        entityType: "AttendanceRecord",
        entityId: action.classGroupId,
        summary: `Saved attendance for ${Object.keys(action.statuses).length} learner(s).`,
        result
      };
    }
    case "calendar.create": {
      const result = applyCreateCalendarEvent(state, action, ctx);
      return {
        action: result.conflicts.length ? "calendar.created_with_conflict" : "calendar.created",
        entityType: "CalendarEvent",
        entityId: result.event.id,
        summary: `${result.event.title} created.`,
        result
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
        result
      };
    }
    case "certificate.issue": {
      const result = applyIssueCertificate(state, action, ctx);
      return {
        action: "certificate.issued",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result ? `Issued certificate ${result.verificationCode}.` : "No certificate changed.",
        result
      };
    }
    case "payment.record": {
      const result = applyRecordPayment(state, action, ctx);
      return {
        action: "payment.recorded",
        entityType: "Payment",
        entityId: result?.id ?? action.invoiceId,
        summary: result ? `Recorded payment ${result.id}.` : "No payment changed.",
        result
      };
    }
    case "placement.result.record": {
      const result = applyRecordPlacementResult(state, action, ctx);
      return {
        action: "placement.result_recorded",
        entityType: "PlacementTestResult",
        entityId: result?.id ?? action.bookingId,
        summary: result ? `Recorded placement result ${result.id}.` : "No placement result changed.",
        result
      };
    }
    case "lead.convert": {
      const result = applyConvertLeadToApplication(state, action, ctx);
      return {
        action: "lead.converted",
        entityType: "Application",
        entityId: result?.id ?? action.leadId,
        summary: result ? `Converted lead ${action.leadId}.` : "No lead converted.",
        result
      };
    }
    case "quran.progress.update": {
      const result = applyUpdateQuranProgress(state, action, ctx);
      return {
        action: "quran.progress_updated",
        entityType: "QuranProgressRecord",
        entityId: result?.id ?? action.recordId,
        summary: result ? `Updated ${result.surah} progress.` : "No Quran progress changed.",
        result
      };
    }
    case "recitation.review": {
      const result = applyReviewRecitation(state, action, ctx);
      return {
        action: "recitation.reviewed",
        entityType: "RecitationSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result ? `Reviewed ${result.title}.` : "No recitation changed.",
        result
      };
    }
    case "recitation.submit": {
      const result = applySubmitRecitation(state, action, ctx);
      return {
        action: "recitation.submitted",
        entityType: "RecitationSubmission",
        entityId: result.id,
        summary: `Submitted ${result.title}.`,
        result
      };
    }
    case "notification.read": {
      const result = applyMarkNotificationRead(state, action);
      return {
        action: "notification.read",
        entityType: "Notification",
        entityId: action.notificationId,
        summary: "Marked notification as read.",
        result
      };
    }
    default: {
      const neverAction = action;
      throw new Error(`Unsupported platform action ${neverAction.type ?? "unknown"}.`);
    }
  }
}

// client/src/lib/platformData.ts
var rolePermissions = {
  student: [
    "dashboard:read",
    "courses:read",
    "attendance:read",
    "assessments:read",
    "certificates:read",
    "messages:write",
    "reports:read"
  ],
  teacher: [
    "dashboard:read",
    "courses:read",
    "attendance:read",
    "attendance:write",
    "assessments:read",
    "assessments:write",
    "messages:write",
    "reports:read"
  ],
  registrar: [
    "dashboard:read",
    "students:read",
    "students:write",
    "courses:read",
    "payments:read",
    "payments:write",
    "messages:write",
    "reports:read"
  ],
  headofdepartment: [
    "dashboard:read",
    "courses:read",
    "courses:write",
    "students:read",
    "teachers:read",
    "teachers:write",
    "assessments:read",
    "assessments:write",
    "certificates:read",
    "certificates:approve",
    "messages:write",
    "reports:read"
  ],
  branchadmin: [
    "dashboard:read",
    "students:read",
    "teachers:read",
    "classes:read",
    "classes:write",
    "rooms:read",
    "rooms:write",
    "schedule:read",
    "schedule:write",
    "attendance:read",
    "attendance:write",
    "payments:read",
    "payments:write",
    "messages:write",
    "reports:read",
    "settings:write"
  ],
  superadmin: [
    "dashboard:read",
    "courses:read",
    "courses:write",
    "classes:read",
    "classes:write",
    "rooms:read",
    "rooms:write",
    "schedule:read",
    "schedule:write",
    "students:read",
    "students:write",
    "teachers:read",
    "teachers:write",
    "attendance:read",
    "attendance:write",
    "assessments:read",
    "assessments:write",
    "payments:read",
    "payments:write",
    "certificates:read",
    "certificates:approve",
    "settings:write",
    "reports:read",
    "messages:write",
    "audit:read"
  ]
};
var dashboardByRole = {
  student: {
    title: "Welcome back, Student Demo",
    subtitle: "Your Arabic Level 3 class starts at 09:00 Cairo time.",
    stats: [
      { label: "Active courses", value: "4", change: "2 live this week", tone: "teal" },
      { label: "Course progress", value: "68%", change: "+8% this month", tone: "green" },
      { label: "Attendance", value: "94%", change: "1 excused absence", tone: "amber" },
      { label: "Certificate path", value: "82%", change: "3 items left", tone: "purple" }
    ],
    spotlight: {
      title: "Continue Arabic Grammar: Conditional Sentences",
      description: "Lesson 8 of Module 3 is ready with teacher notes and a short quiz.",
      progress: 68,
      action: "Continue lesson"
    },
    actions: ["Join class", "Submit assignment", "Message teacher", "View calendar"],
    records: [
      record("cls_ar_3", "Standard Arabic L3 live class", "Ahmed Hassan, Room 4", "Live soon", "Teacher", "09:00", "14 students", "teal"),
      record("asg_grammar", "Grammar worksheet", "Due before next class", "Due today", "Ahmed Hassan", "18:00", "Draft saved", "amber"),
      record("quran_review", "Quran revision review", "Juz 2 checkpoint", "Pending feedback", "Fatima Al-Zahra", "Tomorrow", "45%", "green")
    ]
  },
  teacher: {
    title: "Teacher workspace",
    subtitle: "Two classes today, attendance pending for Arabic L2.",
    stats: [
      { label: "Active classes", value: "6", change: "3 online", tone: "teal" },
      { label: "Students", value: "74", change: "8 need attention", tone: "amber" },
      { label: "Pending grading", value: "14", change: "5 overdue", tone: "red" },
      { label: "Attendance saved", value: "91%", change: "+4% vs last week", tone: "green" }
    ],
    spotlight: {
      title: "Mark attendance for Standard Arabic L2",
      description: "Class ended 22 minutes ago. Save attendance before the registrar cutoff.",
      progress: 76,
      action: "Open attendance"
    },
    actions: ["Create assignment", "Upload material", "Mark attendance", "Create quiz"],
    records: [
      record("class_a", "Standard Arabic L3 - Group A", "14 students, Module 3", "Today", "Ahmed Hassan", "09:00", "68%", "teal"),
      record("grading_queue", "Essay submissions", "Arabic writing assignment", "Needs grading", "6 students", "Friday", "6 left", "amber"),
      record("quran_queue", "Recitation queue", "Tajweed review submissions", "Review", "Fatima Al-Zahra", "Today", "9 clips", "green")
    ]
  },
  registrar: {
    title: "Registrar operations",
    subtitle: "Lead, placement, enrollment, and payment queues for Cairo B1.",
    stats: [
      { label: "New leads", value: "18", change: "+6 today", tone: "teal" },
      { label: "Placement pending", value: "6", change: "2 unassigned", tone: "amber" },
      { label: "Ready to enroll", value: "11", change: "4 paid", tone: "green" },
      { label: "Payments pending", value: "EGP 42K", change: "9 invoices", tone: "purple" }
    ],
    spotlight: {
      title: "Placement test pipeline",
      description: "Six bookings need examiner assignment or result entry.",
      progress: 58,
      action: "Manage placement"
    },
    actions: ["Add lead", "Book placement test", "Register student", "Send message"],
    records: [
      record("lead_184", "Amina Rahman", "Interested in Quran and Tajweed", "New lead", "Website", "Today", "WhatsApp", "teal"),
      record("pt_338", "Placement test: Yusuf Karim", "Arabic language", "Assign teacher", "Registrar", "Tomorrow", "B1", "amber"),
      record("inv_778", "Invoice due: Omar Sayed", "Academic English package", "Pending", "Finance", "Jun 29", "EGP 1,600", "purple")
    ]
  },
  headofdepartment: {
    title: "Academic department overview",
    subtitle: "Arabic and Quran programs, curriculum coverage, and quality signals.",
    stats: [
      { label: "Active courses", value: "42", change: "7 categories", tone: "teal" },
      { label: "Teacher load", value: "84%", change: "Balanced", tone: "green" },
      { label: "At-risk students", value: "23", change: "-5 this week", tone: "amber" },
      { label: "Certificates pending", value: "5", change: "Need approval", tone: "purple" }
    ],
    spotlight: {
      title: "Certificate approvals",
      description: "Five students meet grade and attendance requirements and are waiting for review.",
      progress: 84,
      action: "Review certificates"
    },
    actions: ["Create course", "Edit curriculum", "Assign teacher", "Approve certificate"],
    records: [
      record("curr_ar", "Arabic Level 4 curriculum", "Outcome mapping in review", "Draft", "Curriculum team", "Jul 4", "82%", "teal"),
      record("teacher_quality", "Teacher quality review", "Observation notes ready", "Review", "HOD", "This week", "12 notes", "amber"),
      record("cert_quran", "Quran Tajweed certificate", "Eligibility confirmed", "Pending approval", "Student Demo", "Today", "94%", "green")
    ]
  },
  branchadmin: {
    title: "Cairo B1 branch operations",
    subtitle: "Rooms, branch classes, attendance exceptions, and local payments.",
    stats: [
      { label: "Classes today", value: "28", change: "4 online", tone: "teal" },
      { label: "Rooms in use", value: "9/12", change: "2 conflicts", tone: "amber" },
      { label: "Branch students", value: "384", change: "+21 month", tone: "green" },
      { label: "Payment issues", value: "12", change: "EGP 38K", tone: "red" }
    ],
    spotlight: {
      title: "Room conflict at 17:00",
      description: "Room 4 is double-booked for Arabic L1 and Kids Quran.",
      progress: 42,
      action: "Resolve conflict"
    },
    actions: ["Add room", "View schedule", "Contact student", "Resolve conflict"],
    records: [
      record("room_4", "Room 4 conflict", "Arabic L1 and Kids Quran", "Conflict", "Operations", "17:00", "2 classes", "red"),
      record("late_list", "Late arrivals", "Seven attendance exceptions", "Needs review", "Front desk", "Today", "7 records", "amber"),
      record("branch_payments", "Overdue payments", "Branch invoices", "Follow up", "Registrar", "Jun 30", "12 invoices", "purple")
    ]
  },
  superadmin: {
    title: "Platform administration",
    subtitle: "Global users, roles, branches, integrations, and system activity.",
    stats: [
      { label: "Total users", value: "6,412", change: "+3.2%", tone: "teal" },
      { label: "Active students", value: "5,284", change: "+12%", tone: "green" },
      { label: "Active classes", value: "318", change: "26 live today", tone: "amber" },
      { label: "System health", value: "99.9%", change: "All checks passing", tone: "purple" }
    ],
    spotlight: {
      title: "Integration readiness",
      description: "Moodle, EMS, email, WhatsApp, meeting, and payment providers are configured as placeholders.",
      progress: 66,
      action: "Open integrations"
    },
    actions: ["Create user", "Manage roles", "Review audit logs", "System health"],
    records: [
      record("audit_1", "Role changed", "Teacher Demo assigned to Arabic Dept.", "Audited", "Admin Demo", "Today", "RBAC", "teal"),
      record("integration_moodle", "Moodle connector", "Mock mode until token is configured", "Placeholder", "System", "Now", "Ready", "amber"),
      record("branch_report", "Branch comparison", "Cairo B1 outpacing Alexandria", "Report", "Analytics", "Jun 26", "+9%", "green")
    ]
  }
};
var notifications = [
  record("n1", "Class reminder", "Arabic L3 begins in 30 minutes", "Unread", "System", "Today", "09:00", "teal"),
  record("n2", "Assignment due", "Grammar worksheet closes tonight", "Unread", "Ahmed Hassan", "Today", "18:00", "amber"),
  record("n3", "Certificate approved", "Quran Tajweed Level 1 is ready", "Read", "HOD", "Yesterday", "Verified", "green")
];
function record(id, title, subtitle, status, owner, due, metric, tone = "teal") {
  return { id, title, subtitle, status, owner, due, metric, tone };
}

// client/src/lib/domain/seed.ts
var seedPlatformState = {
  users: [
    { id: "usr_student_demo", name: "Student Demo", email: "student.demo@nilelearn.local", roles: ["student"], activeRole: "student", branchId: "br_online", departmentId: "dep_arabic", status: "active" },
    { id: "usr_student_cairo_demo", name: "Cairo Student Demo", email: "cairo.student.demo@nilelearn.local", roles: ["student"], activeRole: "student", branchId: "br_cairo", departmentId: "dep_arabic", status: "active" },
    { id: "usr_teacher_demo", name: "Teacher Demo", email: "teacher.demo@nilelearn.local", roles: ["teacher"], activeRole: "teacher", branchId: "br_online", departmentId: "dep_arabic", status: "active" },
    { id: "usr_registrar_demo", name: "Registrar Demo", email: "registrar.demo@nilelearn.local", roles: ["registrar"], activeRole: "registrar", branchId: "br_cairo", departmentId: "dep_admissions", status: "active" },
    { id: "usr_hod_demo", name: "HOD Demo", email: "hod.demo@nilelearn.local", roles: ["headofdepartment"], activeRole: "headofdepartment", branchId: "br_global", departmentId: "dep_arabic", status: "active" },
    { id: "usr_branch_demo", name: "Branch Demo", email: "branch.demo@nilelearn.local", roles: ["branchadmin"], activeRole: "branchadmin", branchId: "br_cairo", departmentId: "dep_operations", status: "active" },
    { id: "usr_admin_demo", name: "Admin Demo", email: "admin.demo@nilelearn.local", roles: ["superadmin"], activeRole: "superadmin", branchId: "br_global", departmentId: "dep_platform", status: "active" }
  ],
  branches: [
    { id: "br_global", name: "Global", code: "GLOBAL", timezone: "Africa/Cairo", address: "Global online operations", status: "active" },
    { id: "br_cairo", name: "Cairo B1", code: "B1", timezone: "Africa/Cairo", address: "Cairo branch", status: "active" },
    { id: "br_alex", name: "Alexandria B2", code: "B2", timezone: "Africa/Cairo", address: "Alexandria branch", status: "active" },
    { id: "br_online", name: "Online", code: "ONLINE", timezone: "Africa/Cairo", address: "Online classroom", status: "active" }
  ],
  departments: [
    { id: "dep_arabic", name: "Arabic and Quran", ownerUserId: "usr_hod_demo", branchIds: ["br_cairo", "br_online"], status: "active" },
    { id: "dep_admissions", name: "Admissions", ownerUserId: "usr_registrar_demo", branchIds: ["br_cairo", "br_online"], status: "active" },
    { id: "dep_operations", name: "Branch Operations", ownerUserId: "usr_branch_demo", branchIds: ["br_cairo"], status: "active" },
    { id: "dep_platform", name: "Platform", ownerUserId: "usr_admin_demo", branchIds: ["br_global"], status: "active" }
  ],
  programs: [
    { id: "prog_arabic", title: "Arabic Language", category: "Arabic", departmentId: "dep_arabic", language: "English", status: "active" },
    { id: "prog_quran", title: "Quran and Tajweed", category: "Quran & Tajweed", departmentId: "dep_arabic", language: "English", status: "active" },
    { id: "prog_islamic", title: "Islamic Studies", category: "Islamic Studies", departmentId: "dep_arabic", language: "English", status: "active" }
  ],
  levels: [
    { id: "lvl_ar_l3", programId: "prog_arabic", title: "Level 3", order: 3, prerequisites: ["Level 2 completion or placement"], completionRules: ["80% attendance", "70% grade"] },
    { id: "lvl_qt_1", programId: "prog_quran", title: "Tajweed 1", order: 1, prerequisites: ["Can read Arabic letters"], completionRules: ["90% recitation review", "Teacher approval"] }
  ],
  courses: [
    { id: "course_ar_l3", programId: "prog_arabic", levelId: "lvl_ar_l3", slug: "standard-arabic-l3", title: "Standard Arabic Level 3", description: "Intermediate grammar, reading, writing, and conversation.", outcomes: ["Use conditional sentences", "Write short essays", "Read graded texts"], status: "active" },
    { id: "course_qt_1", programId: "prog_quran", levelId: "lvl_qt_1", slug: "quran-tajweed-1", title: "Quran Tajweed 1", description: "Tajweed foundations with recitation feedback.", outcomes: ["Apply madd rules", "Improve makharij", "Track revision"], status: "active" }
  ],
  modules: [
    { id: "mod_ar_3_grammar", courseId: "course_ar_l3", title: "Grammar and syntax", order: 1, outcomes: ["Conditional sentences", "Verb patterns"] },
    { id: "mod_ar_3_reading", courseId: "course_ar_l3", title: "Reading and listening", order: 2, outcomes: ["Read graded passages", "Recognize connected speech"] },
    { id: "mod_ar_3_writing", courseId: "course_ar_l3", title: "Writing studio", order: 3, outcomes: ["Draft short essays", "Use teacher feedback"] },
    { id: "mod_qt_madd", courseId: "course_qt_1", title: "Madd rules", order: 1, outcomes: ["Recognize madd", "Apply timing"] },
    { id: "mod_qt_recitation", courseId: "course_qt_1", title: "Recitation practice", order: 2, outcomes: ["Submit recordings", "Apply tajweed correction"] }
  ],
  lessons: [
    { id: "lesson_ar_conditional", moduleId: "mod_ar_3_grammar", title: "Conditional Sentences", type: "video", durationMinutes: 42, resourceIds: ["res_ar_pdf"] },
    { id: "lesson_ar_patterns", moduleId: "mod_ar_3_grammar", title: "Verb Patterns in Context", type: "practice", durationMinutes: 35, resourceIds: ["res_ar_patterns"] },
    { id: "lesson_ar_reading_market", moduleId: "mod_ar_3_reading", title: "Reading: A Day at the Market", type: "reading", durationMinutes: 28, resourceIds: ["res_ar_reading_market"] },
    { id: "lesson_ar_listening_dialogue", moduleId: "mod_ar_3_reading", title: "Listening Dialogue Lab", type: "video", durationMinutes: 31, resourceIds: ["res_ar_dialogue_audio"] },
    { id: "lesson_ar_writing_outline", moduleId: "mod_ar_3_writing", title: "Writing a Paragraph Outline", type: "practice", durationMinutes: 40, resourceIds: ["res_ar_outline_doc"] },
    { id: "lesson_qt_madd", moduleId: "mod_qt_madd", title: "Madd Tabi'i Practice", type: "live", durationMinutes: 60, resourceIds: ["res_qt_audio"] },
    { id: "lesson_qt_munfasil", moduleId: "mod_qt_madd", title: "Madd Munfasil Drill", type: "practice", durationMinutes: 36, resourceIds: ["res_qt_munfasil_audio"] },
    { id: "lesson_qt_recording", moduleId: "mod_qt_recitation", title: "Submit a Recitation Clip", type: "assessment", durationMinutes: 25, resourceIds: ["res_qt_recording_guide"] }
  ],
  resources: [
    { id: "res_ar_pdf", lessonId: "lesson_ar_conditional", title: "Grammar handout", type: "pdf", url: "#mock-resource", published: true },
    { id: "res_ar_patterns", lessonId: "lesson_ar_patterns", title: "Verb pattern worksheet", type: "document", url: "#mock-resource", published: true },
    { id: "res_ar_reading_market", lessonId: "lesson_ar_reading_market", title: "Reading passage and vocabulary", type: "pdf", url: "#mock-resource", published: true },
    { id: "res_ar_dialogue_audio", lessonId: "lesson_ar_listening_dialogue", title: "Dialogue audio track", type: "audio", url: "#mock-resource", published: true },
    { id: "res_ar_outline_doc", lessonId: "lesson_ar_writing_outline", title: "Paragraph outline template", type: "document", url: "#mock-resource", published: true },
    { id: "res_qt_audio", lessonId: "lesson_qt_madd", title: "Madd practice audio", type: "audio", url: "#mock-resource", published: true },
    { id: "res_qt_munfasil_audio", lessonId: "lesson_qt_munfasil", title: "Madd munfasil examples", type: "audio", url: "#mock-resource", published: true },
    { id: "res_qt_recording_guide", lessonId: "lesson_qt_recording", title: "Recording checklist", type: "document", url: "#mock-resource", published: true }
  ],
  courseRuns: [
    { id: "run_ar_l3_2026", courseId: "course_ar_l3", branchId: "br_online", teacherId: "usr_teacher_demo", term: "Summer 2026", startsOn: "2026-06-01", endsOn: "2026-08-31", status: "active" },
    { id: "run_ar_l3_cairo_2026", courseId: "course_ar_l3", branchId: "br_cairo", teacherId: "usr_teacher_demo", term: "Summer 2026 Cairo", startsOn: "2026-06-01", endsOn: "2026-08-31", status: "active" },
    { id: "run_qt_1_2026", courseId: "course_qt_1", branchId: "br_online", teacherId: "usr_teacher_demo", term: "Summer 2026", startsOn: "2026-06-01", endsOn: "2026-08-31", status: "active" }
  ],
  classGroups: [
    { id: "class_ar_l3_a", courseRunId: "run_ar_l3_2026", name: "Arabic L3 - Group A", capacity: 16, schedule: "Mon/Wed/Fri 09:00", roomId: "room_online_a", meetingLinkId: "meet_ar_l3", studentIds: ["stu_demo"] },
    { id: "class_ar_l3_cairo", courseRunId: "run_ar_l3_cairo_2026", name: "Arabic L3 - Cairo Group", capacity: 20, schedule: "Sun/Tue 14:00", roomId: "room_cairo_4", meetingLinkId: "meet_ar_l3", studentIds: ["stu_cairo_demo"] },
    { id: "class_qt_1_b", courseRunId: "run_qt_1_2026", name: "Quran Tajweed - Group B", capacity: 12, schedule: "Tue/Thu 10:30", roomId: "room_online_b", meetingLinkId: "meet_qt_1", studentIds: ["stu_demo"] }
  ],
  students: [
    { id: "stu_demo", userId: "usr_student_demo", status: "active", country: "Demo Country", preferredLanguage: "English", timezone: "Africa/Cairo" },
    { id: "stu_cairo_demo", userId: "usr_student_cairo_demo", status: "active", country: "Egypt", preferredLanguage: "English", timezone: "Africa/Cairo" }
  ],
  teachers: [
    { id: "tch_demo", userId: "usr_teacher_demo", departmentId: "dep_arabic", specialties: ["Arabic grammar", "Tajweed"], availability: ["Mon 09:00", "Tue 10:30", "Thu 10:30"] }
  ],
  enrollments: [
    { id: "enr_ar_l3", studentId: "stu_demo", courseRunId: "run_ar_l3_2026", status: "active", progress: 68, attendanceRate: 94, currentGrade: 88 },
    { id: "enr_ar_l3_cairo", studentId: "stu_cairo_demo", courseRunId: "run_ar_l3_cairo_2026", status: "active", progress: 52, attendanceRate: 90, currentGrade: 84 },
    { id: "enr_qt_1", studentId: "stu_demo", courseRunId: "run_qt_1_2026", status: "active", progress: 45, attendanceRate: 91, currentGrade: 92 }
  ],
  lessonProgress: [
    { id: "lp_ar_conditional", studentId: "stu_demo", lessonId: "lesson_ar_conditional", status: "in_progress", notes: "Watched once, needs quiz." },
    { id: "lp_ar_patterns", studentId: "stu_demo", lessonId: "lesson_ar_patterns", status: "completed", completedAt: "2026-06-24T10:15:00+03:00" },
    { id: "lp_ar_reading_market", studentId: "stu_demo", lessonId: "lesson_ar_reading_market", status: "not_started" },
    { id: "lp_ar_listening_dialogue", studentId: "stu_demo", lessonId: "lesson_ar_listening_dialogue", status: "not_started" },
    { id: "lp_ar_writing_outline", studentId: "stu_demo", lessonId: "lesson_ar_writing_outline", status: "not_started" },
    { id: "lp_qt_madd", studentId: "stu_demo", lessonId: "lesson_qt_madd", status: "not_started" },
    { id: "lp_qt_munfasil", studentId: "stu_demo", lessonId: "lesson_qt_munfasil", status: "not_started" },
    { id: "lp_qt_recording", studentId: "stu_demo", lessonId: "lesson_qt_recording", status: "not_started" }
  ],
  assignments: [
    { id: "asg_ar_grammar", courseRunId: "run_ar_l3_2026", title: "Grammar worksheet", dueAt: "2026-06-30T18:00:00+03:00", submissionType: "text", rubric: ["Accuracy", "Examples", "Clarity"], status: "active" },
    { id: "asg_qt_audio", courseRunId: "run_qt_1_2026", title: "Audio recitation", dueAt: "2026-07-01T18:00:00+03:00", submissionType: "audio", rubric: ["Makharij", "Madd", "Fluency"], status: "active" }
  ],
  assignmentSubmissions: [
    { id: "sub_ar_grammar_draft", assignmentId: "asg_ar_grammar", studentId: "stu_demo", submittedAt: "2026-06-25T17:30:00+03:00", status: "pending", response: "Draft answer saved locally." }
  ],
  quizzes: [
    { id: "quiz_ar_3", courseRunId: "run_ar_l3_2026", title: "Grammar Quiz 3", durationMinutes: 30, questionTypes: ["multiple_choice", "short_answer"], attemptsAllowed: 2, status: "active" },
    { id: "quiz_qt_madd", courseRunId: "run_qt_1_2026", title: "Madd Rules Check", durationMinutes: 18, questionTypes: ["listening", "multiple_choice"], attemptsAllowed: 2, status: "active" }
  ],
  quizAttempts: [
    { id: "attempt_ar_3_demo", quizId: "quiz_ar_3", studentId: "stu_demo", startedAt: "2026-06-24T12:00:00+03:00", submittedAt: "2026-06-24T12:22:00+03:00", status: "completed", score: 88, maxScore: 100, answers: { q1: "Correct", q2: "Needs review" } }
  ],
  grades: [
    { id: "gr_ar_quiz_3", studentId: "stu_demo", courseRunId: "run_ar_l3_2026", itemTitle: "Grammar Quiz 3", score: 88, maxScore: 100, feedback: "Strong syntax control." }
  ],
  events: [
    { id: "evt_ar_live", type: "live_session", title: "Arabic L3 live class", startsAt: "2026-06-26T09:00:00+03:00", endsAt: "2026-06-26T10:30:00+03:00", ownerId: "usr_teacher_demo", branchId: "br_online", classGroupId: "class_ar_l3_a", status: "active" },
    { id: "evt_ar_cairo_live", type: "live_session", title: "Arabic L3 Cairo live class", startsAt: "2026-06-27T14:00:00+03:00", endsAt: "2026-06-27T15:15:00+03:00", ownerId: "usr_teacher_demo", branchId: "br_cairo", roomId: "room_cairo_4", classGroupId: "class_ar_l3_cairo", status: "active" },
    { id: "evt_pt_demo", type: "placement_test", title: "Placement test booking", startsAt: "2026-06-27T13:00:00+03:00", endsAt: "2026-06-27T13:30:00+03:00", ownerId: "usr_registrar_demo", branchId: "br_online", status: "pending" }
  ],
  classSessions: [
    { id: "session_ar_live", classGroupId: "class_ar_l3_a", eventId: "evt_ar_live", title: "Arabic L3 live class", startsAt: "2026-06-26T09:00:00+03:00", endsAt: "2026-06-26T10:30:00+03:00", status: "active", attendanceSaved: false },
    { id: "session_ar_cairo_live", classGroupId: "class_ar_l3_cairo", eventId: "evt_ar_cairo_live", title: "Arabic L3 Cairo live class", startsAt: "2026-06-27T14:00:00+03:00", endsAt: "2026-06-27T15:15:00+03:00", status: "active", attendanceSaved: false }
  ],
  teacherAvailability: [
    { id: "avail_teacher_mon", teacherId: "usr_teacher_demo", weekday: "Monday", startsAt: "09:00", endsAt: "13:00", branchId: "br_online" },
    { id: "avail_teacher_sun_cairo", teacherId: "usr_teacher_demo", weekday: "Sunday", startsAt: "13:00", endsAt: "17:00", branchId: "br_cairo" },
    { id: "avail_teacher_thu", teacherId: "usr_teacher_demo", weekday: "Thursday", startsAt: "10:00", endsAt: "15:00", branchId: "br_online" }
  ],
  rooms: [
    { id: "room_online_a", branchId: "br_online", name: "Online Room A", capacity: 38, equipment: ["Meeting link", "Recording placeholder"], status: "active" },
    { id: "room_online_b", branchId: "br_online", name: "Online Room B", capacity: 24, equipment: ["Meeting link", "Audio review"], status: "active" },
    { id: "room_cairo_4", branchId: "br_cairo", name: "Cairo Room 4", capacity: 20, equipment: ["Projector", "Whiteboard"], status: "active" }
  ],
  meetingLinks: [
    { id: "meet_ar_l3", provider: "mock", url: "https://meet.nilelearn.local/arabic-l3", status: "active" },
    { id: "meet_qt_1", provider: "mock", url: "https://meet.nilelearn.local/quran-tajweed-1", status: "active" }
  ],
  attendance: [
    { id: "att_ar_1", classGroupId: "class_ar_l3_a", studentId: "stu_demo", sessionId: "evt_ar_live", status: "present", notes: "On time" },
    { id: "att_ar_cairo_1", classGroupId: "class_ar_l3_cairo", studentId: "stu_cairo_demo", sessionId: "evt_ar_cairo_live", status: "present", notes: "Checked in at Cairo branch" }
  ],
  leads: [
    { id: "lead_demo_1", fullName: "Lead Demo", email: "lead.demo@nilelearn.local", phone: "+20 100 000 0020", subject: "Arabic Language", source: "website", status: "lead", notes: "Interested in evening classes", createdAt: "2026-06-26T09:00:00+03:00" }
  ],
  applications: [
    { id: "app_demo_1", leadId: "lead_demo_1", branchId: "br_online", courseInterest: "Arabic Language", schedulePreference: "Evening", status: "pending" }
  ],
  placementTests: [
    { id: "pt_demo_1", leadId: "lead_demo_1", fullName: "Lead Demo", email: "lead.demo@nilelearn.local", phone: "+20 100 000 0020", branchId: "br_online", subject: "Arabic Language", preferredDate: "2026-06-27", currentLevel: "Some reading ability", status: "pending" }
  ],
  placementResults: [
    { id: "ptr_demo_1", bookingId: "pt_demo_1", examinerId: "usr_teacher_demo", score: 74, recommendedLevel: "Arabic Level 2", notes: "Good reading base, needs grammar review.", createdAt: "2026-06-26T12:00:00+03:00" }
  ],
  enrollmentWorkflows: [
    { id: "ew_demo_1", leadId: "lead_demo_1", placementTestId: "pt_demo_1", targetCourseId: "course_ar_l3", status: "ready_to_enroll", nextStep: "Confirm package and create invoice", updatedAt: "2026-06-26T12:10:00+03:00" }
  ],
  invoices: [
    { id: "inv_demo_1", studentId: "stu_demo", amount: 2400, currency: "EGP", dueAt: "2026-06-30", status: "pending" },
    { id: "inv_cairo_demo_1", studentId: "stu_cairo_demo", amount: 2400, currency: "EGP", dueAt: "2026-07-05", status: "pending" }
  ],
  payments: [
    { id: "pay_demo_1", invoiceId: "inv_demo_1", amount: 1200, method: "manual", paidAt: "2026-06-20", status: "paid" }
  ],
  packages: [
    { id: "pkg_ar_l3_month", title: "Arabic L3 monthly", courseId: "course_ar_l3", amount: 2400, currency: "EGP", sessions: 12, status: "active" },
    { id: "pkg_qt_month", title: "Quran Tajweed monthly", courseId: "course_qt_1", amount: 1800, currency: "EGP", sessions: 12, status: "active" }
  ],
  discounts: [
    { id: "disc_family", code: "FAMILY10", amount: 240, currency: "EGP", status: "active" }
  ],
  certificates: [
    { id: "cert_ar_2", studentId: "stu_demo", courseId: "course_ar_l3", status: "pending_approval", grade: 88, attendanceRate: 94, verificationCode: "NCL-AR2-DEMO" }
  ],
  quranPlans: [
    { id: "qp_demo", studentId: "stu_demo", target: "Juz 1-5", currentJuz: "Juz 2", revisionCycle: "Every 7 days", teacherId: "usr_teacher_demo" }
  ],
  quranProgress: [
    { id: "qr_demo", studentId: "stu_demo", surah: "Al-Baqarah", juz: "2", memorizedPercent: 72, tajweedScore: 88, notes: "Madd timing improved." }
  ],
  recitationSubmissions: [
    { id: "rec_demo", studentId: "stu_demo", teacherId: "usr_teacher_demo", title: "Surah Al-Baqarah 24-29", submittedAt: "2026-06-25T18:00:00+03:00", status: "pending" }
  ],
  messages: [
    { id: "msg_demo_1", fromUserId: "usr_teacher_demo", toUserId: "usr_student_demo", subject: "Class reminder", body: "Arabic L3 starts at 09:00 Cairo time.", read: false, createdAt: "2026-06-26T08:30:00+03:00" }
  ],
  communicationLogs: [
    { id: "comm_demo_1", actorId: "usr_registrar_demo", channel: "in_app", subject: "Placement confirmation", body: "Placement test confirmed for tomorrow.", relatedUserId: "usr_student_demo", status: "completed", createdAt: "2026-06-26T10:00:00+03:00" }
  ],
  messageTemplates: [
    { id: "tmpl_trial", title: "Trial lesson confirmation", channel: "whatsapp", subject: "Trial lesson confirmed", body: "Your Nile Center trial lesson is confirmed.", category: "admissions", status: "active" },
    { id: "tmpl_payment", title: "Payment reminder", channel: "email", subject: "Payment reminder", body: "Your invoice is ready for review.", category: "finance", status: "active" }
  ],
  documents: [
    { id: "doc_cert_demo", ownerId: "stu_demo", title: "Certificate preview", type: "certificate", url: "#certificate-preview", status: "draft" }
  ],
  notifications: [
    { id: "not_demo_1", userId: "usr_student_demo", title: "Class reminder", body: "Arabic L3 starts in 30 minutes.", href: "/app/student/calendar", read: false, createdAt: "2026-06-26T08:30:00+03:00" }
  ],
  supportTickets: [
    { id: "ticket_demo_1", requesterId: "usr_student_demo", subject: "Need recording link", status: "pending", priority: "normal", lastUpdatedAt: "2026-06-25T15:00:00+03:00" }
  ],
  auditLogs: [
    { id: "audit_seed_1", actorId: "usr_admin_demo", action: "seed.loaded", entityType: "PlatformState", entityId: "seed", summary: "Loaded local demo platform state.", createdAt: "2026-06-26T08:00:00+03:00" }
  ],
  integrations: [
    { id: "supabase", label: "Supabase data platform", status: "not_configured", envVars: ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"], serverOnly: false, notes: "Browser code uses only the publishable or anon key. Admin/service credentials stay server-only." },
    { id: "moodle", label: "Moodle LMS", status: "mock_mode", envVars: ["MOODLE_BASE_URL", "MOODLE_SERVICE", "MOODLE_TOKEN"], serverOnly: true, notes: "Content, courses, grades, and assignments should sync server-side." },
    { id: "ems", label: "EMS registration portal", status: "mock_mode", envVars: ["EMS_BASE_URL"], serverOnly: true, notes: "Admissions and enrollment import boundary." },
    { id: "email", label: "Email provider", status: "not_configured", envVars: ["EMAIL_PROVIDER"], serverOnly: true, notes: "Templates are logged until delivery is connected." },
    { id: "whatsapp", label: "WhatsApp provider", status: "not_configured", envVars: ["WHATSAPP_PROVIDER"], serverOnly: true, notes: "No external sending from the browser." },
    { id: "meeting", label: "Meeting provider", status: "not_configured", envVars: ["MEETING_PROVIDER"], serverOnly: true, notes: "Live class links and recordings." },
    { id: "payment", label: "Payment provider", status: "not_configured", envVars: ["PAYMENT_PROVIDER"], serverOnly: true, notes: "Invoices stay manual until connected." },
    { id: "jotform", label: "Jotform/import", status: "not_configured", envVars: [], serverOnly: true, notes: "Future import adapter for legacy forms." }
  ],
  permissions: rolePermissions
};

// server/platformState.ts
var DATA_DIR2 = process.env.VERCEL ? "/tmp" : path3.resolve(process.cwd(), ".local-data");
var STATE_FILE = path3.join(DATA_DIR2, "platform-state.json");
var DEFAULT_STATE_ID = "nile-learn-demo";
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function createId2(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function sanitizeTableName(value, fallback) {
  const table = (value || fallback).trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table)) return fallback;
  return table;
}
function snapshotId() {
  return process.env.SUPABASE_PLATFORM_STATE_ID?.trim() || DEFAULT_STATE_ID;
}
function snapshotTable() {
  return sanitizeTableName(process.env.SUPABASE_PLATFORM_STATE_TABLE || "", "platform_state_snapshots");
}
function eventsTable() {
  return sanitizeTableName(process.env.SUPABASE_PLATFORM_EVENTS_TABLE || "", "platform_events");
}
function cloneSeed() {
  return JSON.parse(JSON.stringify(seedPlatformState));
}
function normalizeState(value) {
  if (!value || typeof value !== "object") return cloneSeed();
  return { ...cloneSeed(), ...value };
}
function ensureDataDir2() {
  if (!fs3.existsSync(DATA_DIR2)) fs3.mkdirSync(DATA_DIR2, { recursive: true, mode: 448 });
}
function readLocalState() {
  try {
    if (!fs3.existsSync(STATE_FILE)) return null;
    const payload = JSON.parse(fs3.readFileSync(STATE_FILE, "utf-8"));
    return normalizeState(payload.state);
  } catch {
    return null;
  }
}
function writeLocalState(state) {
  ensureDataDir2();
  fs3.writeFileSync(STATE_FILE, JSON.stringify({ state, updatedAt: now() }, null, 2), { mode: 384 });
}
async function readSupabaseState() {
  const table = snapshotTable();
  const response = await supabaseAdminRestFetch(
    `${table}?id=eq.${encodeURIComponent(snapshotId())}&select=id,state,updated_at&limit=1`,
    { method: "GET" }
  );
  if (!response.ok) throw new Error(`Supabase platform state read failed with ${response.status}`);
  const rows = await response.json();
  return rows[0]?.state ? normalizeState(rows[0].state) : null;
}
async function writeSupabaseState(state) {
  const table = snapshotTable();
  const updatedAt = now();
  const response = await supabaseAdminRestFetch(`${table}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([
      {
        id: snapshotId(),
        state,
        updated_at: updatedAt
      }
    ])
  });
  if (!response.ok) throw new Error(`Supabase platform state write failed with ${response.status}`);
}
async function writeSupabaseEvent(input) {
  const table = eventsTable();
  const response = await supabaseAdminRestFetch(table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: createId2("evtlog"),
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      summary: input.summary,
      payload: input.payload,
      created_at: now()
    })
  });
  if (!response.ok) throw new Error(`Supabase platform event write failed with ${response.status}`);
}
async function persistState(state) {
  try {
    await writeSupabaseState(state);
    writeLocalState(state);
    return "supabase";
  } catch {
    writeLocalState(state);
    return "local";
  }
}
async function getPlatformStateSnapshot() {
  try {
    const supabaseState = await readSupabaseState();
    if (supabaseState) {
      writeLocalState(supabaseState);
      return { state: supabaseState, persistence: "supabase", syncedAt: now() };
    }
    const seededState = readLocalState() ?? cloneSeed();
    const persistence = await persistState(seededState);
    return { state: seededState, persistence, syncedAt: now() };
  } catch {
    const localState = readLocalState() ?? cloneSeed();
    writeLocalState(localState);
    return { state: localState, persistence: "local", syncedAt: now() };
  }
}
function studentIdForSession(state, session) {
  return state.students.find((student) => student.userId === session.userId)?.id ?? "stu_demo";
}
function userForSession(state, session) {
  return state.users.find((item) => item.id === session.userId);
}
function courseRunForAssignment(state, assignmentId) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  return assignment ? state.courseRuns.find((item) => item.id === assignment.courseRunId) : void 0;
}
function courseRunForQuiz(state, quizId) {
  const quiz = state.quizzes.find((item) => item.id === quizId);
  return quiz ? state.courseRuns.find((item) => item.id === quiz.courseRunId) : void 0;
}
function branchForInvoice(state, invoiceId) {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  const enrollment = state.enrollments.find((item) => item.studentId === invoice?.studentId);
  const run = state.courseRuns.find((item) => item.id === enrollment?.courseRunId);
  return run?.branchId;
}
function teacherOwnsStudent(state, teacherUserId, studentId) {
  const runIds = new Set(state.courseRuns.filter((item) => item.teacherId === teacherUserId).map((item) => item.id));
  return state.enrollments.some((item) => item.studentId === studentId && runIds.has(item.courseRunId));
}
function studentIdsForTeacher(state, teacherUserId) {
  const runIds = new Set(state.courseRuns.filter((item) => item.teacherId === teacherUserId).map((item) => item.id));
  return new Set(state.enrollments.filter((item) => runIds.has(item.courseRunId)).map((item) => item.studentId));
}
function studentIdsForBranch(state, branchId) {
  const runIds = new Set(state.courseRuns.filter((item) => item.branchId === branchId).map((item) => item.id));
  return new Set(state.enrollments.filter((item) => runIds.has(item.courseRunId)).map((item) => item.studentId));
}
function hodOwnsCourse(state, session, courseId) {
  const user = userForSession(state, session);
  const course = state.courses.find((item) => item.id === courseId);
  const program = state.programs.find((item) => item.id === course?.programId);
  const department = state.departments.find((item) => item.id === program?.departmentId);
  return Boolean(department && (department.ownerUserId === session.userId || department.id === user?.departmentId));
}
function canMessageRecipient(state, session, toUserId) {
  if (session.activeRole === "superadmin") return true;
  if (toUserId === session.userId) return true;
  const recipient = state.users.find((item) => item.id === toUserId);
  if (!recipient) return false;
  const sender = userForSession(state, session);
  if (session.activeRole === "student") {
    const student = state.students.find((item) => item.userId === session.userId);
    const runIds = new Set(state.enrollments.filter((item) => item.studentId === student?.id).map((item) => item.courseRunId));
    const teacherUserIds = new Set(state.courseRuns.filter((item) => runIds.has(item.id)).map((item) => item.teacherId));
    return teacherUserIds.has(toUserId) || recipient.roles.some((role) => role === "registrar" || role === "branchadmin");
  }
  if (session.activeRole === "teacher") {
    const studentIds = studentIdsForTeacher(state, session.userId);
    const recipientStudent = state.students.find((item) => item.userId === toUserId);
    return Boolean(recipientStudent && studentIds.has(recipientStudent.id));
  }
  if (session.activeRole === "branchadmin") {
    const studentIds = studentIdsForBranch(state, sender?.branchId);
    const recipientStudent = state.students.find((item) => item.userId === toUserId);
    return recipient.branchId === sender?.branchId || Boolean(recipientStudent && studentIds.has(recipientStudent.id));
  }
  if (session.activeRole === "headofdepartment") {
    const departmentIds = new Set(state.departments.filter((item) => item.ownerUserId === session.userId || item.id === sender?.departmentId).map((item) => item.id));
    const programIds = new Set(state.programs.filter((item) => departmentIds.has(item.departmentId)).map((item) => item.id));
    const courseIds = new Set(state.courses.filter((item) => programIds.has(item.programId)).map((item) => item.id));
    const runIds = new Set(state.courseRuns.filter((item) => courseIds.has(item.courseId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => runIds.has(item.courseRunId)).map((item) => item.studentId));
    const recipientStudent = state.students.find((item) => item.userId === toUserId);
    return Boolean(recipient.departmentId && departmentIds.has(recipient.departmentId) || recipientStudent && studentIds.has(recipientStudent.id));
  }
  return session.activeRole === "registrar" && recipient.roles.some((role) => role === "student" || role === "teacher" || role === "branchadmin");
}
function assertStudentScopedAction(state, action, session) {
  if (session.activeRole !== "student") return;
  const studentId = studentIdForSession(state, session);
  if (action.type === "assignment.submit") {
    const run = courseRunForAssignment(state, action.assignmentId);
    if (!state.enrollments.some((item) => item.studentId === studentId && item.courseRunId === run?.id)) {
      throw new Error("Student can only submit assignments for enrolled course runs.");
    }
  }
  if (action.type === "quiz.submit") {
    const run = courseRunForQuiz(state, action.quizId);
    if (!state.enrollments.some((item) => item.studentId === studentId && item.courseRunId === run?.id)) {
      throw new Error("Student can only submit quizzes for enrolled course runs.");
    }
  }
  if (action.type === "lesson.start" || action.type === "lesson.complete") {
    const lesson = state.lessons.find((item) => item.id === action.lessonId);
    const module = state.modules.find((item) => item.id === lesson?.moduleId);
    const run = state.courseRuns.find((item) => item.courseId === module?.courseId);
    if (!state.enrollments.some((item) => item.studentId === studentId && item.courseRunId === run?.id)) {
      throw new Error("Student can only open lessons for enrolled course runs.");
    }
  }
  if (action.type === "notification.read") {
    const notification = state.notifications.find((item) => item.id === action.notificationId);
    if (notification?.userId !== session.userId) throw new Error("Student can only mark own notifications as read.");
  }
}
function roleCanRunAction(session, action) {
  if (session.activeRole === "superadmin") return true;
  const byRole = {
    student: [
      "lesson.start",
      "lesson.complete",
      "assignment.submit",
      "quiz.submit",
      "recitation.submit",
      "message.send",
      "notification.read"
    ],
    teacher: [
      "assignment.create",
      "quiz.create",
      "assignment.grade",
      "attendance.save",
      "calendar.create",
      "message.send",
      "quran.progress.update",
      "recitation.review",
      "notification.read"
    ],
    registrar: [
      "lead.create",
      "placement.create",
      "placement.result.record",
      "lead.convert",
      "payment.record",
      "calendar.create",
      "message.send",
      "record.save",
      "notification.read"
    ],
    headofdepartment: [
      "assignment.create",
      "quiz.create",
      "certificate.approve",
      "certificate.issue",
      "message.send",
      "quran.progress.update",
      "recitation.review",
      "record.save",
      "notification.read"
    ],
    branchadmin: [
      "attendance.save",
      "calendar.create",
      "message.send",
      "payment.record",
      "record.save",
      "notification.read"
    ],
    superadmin: []
  };
  return byRole[session.activeRole].includes(action.type);
}
function assertScopedAction(state, action, session) {
  if (!roleCanRunAction(session, action)) {
    throw new Error(`Role ${session.activeRole} cannot run ${action.type}.`);
  }
  assertStudentScopedAction(state, action, session);
  if (session.activeRole === "teacher") {
    if (action.type === "assignment.create" || action.type === "quiz.create") {
      const run = state.courseRuns.find((item) => item.id === action.courseRunId);
      if (run?.teacherId !== session.userId) throw new Error("Teacher can only create assessments for assigned course runs.");
    }
    if (action.type === "assignment.grade") {
      const submission = state.assignmentSubmissions.find((item) => item.id === action.submissionId);
      const assignment = state.assignments.find((item) => item.id === submission?.assignmentId);
      const run = state.courseRuns.find((item) => item.id === assignment?.courseRunId);
      if (run?.teacherId !== session.userId) throw new Error("Teacher can only grade assigned course submissions.");
    }
    if (action.type === "attendance.save") {
      const group = state.classGroups.find((item) => item.id === action.classGroupId);
      const run = state.courseRuns.find((item) => item.id === group?.courseRunId);
      if (run?.teacherId !== session.userId) throw new Error("Teacher can only save attendance for assigned classes.");
    }
    if (action.type === "calendar.create") {
      const group = action.classGroupId ? state.classGroups.find((item) => item.id === action.classGroupId) : void 0;
      const run = group ? state.courseRuns.find((item) => item.id === group.courseRunId) : void 0;
      if (group && run?.teacherId !== session.userId) throw new Error("Teacher can only schedule assigned classes.");
      if (action.ownerId && action.ownerId !== session.userId) throw new Error("Teacher can only create own calendar events.");
    }
    if (action.type === "quran.progress.update") {
      const record2 = state.quranProgress.find((item) => item.id === action.recordId);
      if (!record2 || !teacherOwnsStudent(state, session.userId, record2.studentId)) {
        throw new Error("Teacher can only update Quran progress for assigned learners.");
      }
    }
    if (action.type === "recitation.review") {
      const submission = state.recitationSubmissions.find((item) => item.id === action.submissionId);
      if (submission?.teacherId !== session.userId) throw new Error("Teacher can only review assigned recitations.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("Teacher can only mark own notifications as read.");
    }
  }
  if (session.activeRole === "branchadmin") {
    const user = userForSession(state, session);
    if (action.type === "calendar.create" && action.branchId && action.branchId !== user?.branchId) {
      throw new Error("Branch admin can only schedule inside their branch.");
    }
    if (action.type === "calendar.create") {
      const room = action.roomId ? state.rooms.find((item) => item.id === action.roomId) : void 0;
      const group = action.classGroupId ? state.classGroups.find((item) => item.id === action.classGroupId) : void 0;
      const run = group ? state.courseRuns.find((item) => item.id === group.courseRunId) : void 0;
      if (room && room.branchId !== user?.branchId) throw new Error("Branch admin can only book rooms in their branch.");
      if (run && run.branchId !== user?.branchId) throw new Error("Branch admin can only schedule classes in their branch.");
    }
    if (action.type === "attendance.save") {
      const group = state.classGroups.find((item) => item.id === action.classGroupId);
      const run = state.courseRuns.find((item) => item.id === group?.courseRunId);
      if (run?.branchId !== user?.branchId) throw new Error("Branch admin can only save attendance in their branch.");
    }
    if (action.type === "payment.record" && branchForInvoice(state, action.invoiceId) !== user?.branchId) {
      throw new Error("Branch admin can only record payments for their branch.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("Branch admin can only mark own notifications as read.");
    }
  }
  if (session.activeRole === "headofdepartment") {
    if (action.type === "certificate.approve" || action.type === "certificate.issue") {
      const certificate = state.certificates.find((item) => item.id === action.certificateId);
      if (!certificate || !hodOwnsCourse(state, session, certificate.courseId)) {
        throw new Error("HOD can only manage certificates in their department.");
      }
    }
    if (action.type === "assignment.create" || action.type === "quiz.create") {
      const run = state.courseRuns.find((item) => item.id === action.courseRunId);
      if (!run || !hodOwnsCourse(state, session, run.courseId)) throw new Error("HOD can only create assessments in their department.");
    }
    if (action.type === "quran.progress.update") {
      const record2 = state.quranProgress.find((item) => item.id === action.recordId);
      const plan = state.quranPlans.find((item) => item.studentId === record2?.studentId);
      if (plan && !teacherOwnsStudent(state, plan.teacherId, record2?.studentId ?? "")) throw new Error("Invalid Quran progress record.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("HOD can only mark own notifications as read.");
    }
  }
  if (session.activeRole === "registrar" && action.type === "notification.read") {
    const notification = state.notifications.find((item) => item.id === action.notificationId);
    if (notification?.userId !== session.userId) throw new Error("Registrar can only mark own notifications as read.");
  }
  if (action.type === "message.send" && !canMessageRecipient(state, session, action.toUserId)) {
    throw new Error("Message recipient is outside this role scope.");
  }
}
function applyServerActor(action, session, state) {
  const actorId = session.userId;
  const studentId = studentIdForSession(state, session);
  const user = userForSession(state, session);
  switch (action.type) {
    case "lesson.start":
    case "lesson.complete":
    case "assignment.submit":
    case "quiz.submit":
      return { ...action, studentId, actorId };
    case "recitation.submit":
      return { ...action, studentId, actorId };
    case "message.send":
      return { ...action, fromUserId: actorId, actorId };
    case "calendar.create":
      return {
        ...action,
        ownerId: actorId,
        branchId: action.branchId ?? user?.branchId,
        actorId
      };
    default:
      return { ...action, actorId };
  }
}
var eventTypes = /* @__PURE__ */ new Set([
  "class_session",
  "live_session",
  "trial_lesson",
  "placement_test",
  "assignment_due",
  "quiz_due",
  "exam",
  "teacher_availability",
  "room_booking",
  "reminder"
]);
var attendanceStatuses = /* @__PURE__ */ new Set(["present", "late", "absent", "excused"]);
var leadSources = /* @__PURE__ */ new Set(["website", "trial_form", "placement_form", "whatsapp", "manual"]);
var communicationChannels = /* @__PURE__ */ new Set(["in_app", "email", "whatsapp", "phone", "manual"]);
function stringValue(input, key) {
  return typeof input[key] === "string" ? input[key] : "";
}
function optionalStringValue(input, key) {
  return typeof input[key] === "string" && input[key] ? input[key] : void 0;
}
function numberValue(input, key) {
  return typeof input[key] === "number" && Number.isFinite(input[key]) ? input[key] : Number(input[key]);
}
function stringArrayValue(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function stringRecordValue(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry) => typeof entry[1] === "string")
  );
}
function attendanceRecordValue(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry) => typeof entry[1] === "string" && attendanceStatuses.has(entry[1])
    )
  );
}
function parsePlatformWorkflowAction(value) {
  if (!value || typeof value !== "object") return null;
  const input = value;
  const type = input.type;
  if ((type === "lesson.start" || type === "lesson.complete") && typeof input.lessonId === "string") {
    return {
      type,
      lessonId: input.lessonId,
      studentId: typeof input.studentId === "string" ? input.studentId : void 0,
      actorId: typeof input.actorId === "string" ? input.actorId : void 0
    };
  }
  if (type === "assignment.submit" && typeof input.assignmentId === "string" && typeof input.response === "string") {
    return {
      type,
      assignmentId: input.assignmentId,
      response: input.response,
      studentId: typeof input.studentId === "string" ? input.studentId : void 0,
      actorId: typeof input.actorId === "string" ? input.actorId : void 0
    };
  }
  if (type === "quiz.submit" && typeof input.quizId === "string" && input.answers && typeof input.answers === "object") {
    const answers = stringRecordValue(input.answers);
    return {
      type,
      quizId: input.quizId,
      answers,
      studentId: typeof input.studentId === "string" ? input.studentId : void 0,
      actorId: typeof input.actorId === "string" ? input.actorId : void 0
    };
  }
  if (type === "lead.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const subject = stringValue(input, "subject");
    if (!fullName || !email || !phone || !subject) return null;
    return {
      type,
      fullName,
      email,
      phone,
      subject,
      notes: optionalStringValue(input, "notes"),
      country: optionalStringValue(input, "country"),
      source: leadSources.has(input.source) ? input.source : void 0
    };
  }
  if (type === "placement.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const subject = stringValue(input, "subject");
    const preferredDate = stringValue(input, "preferredDate");
    const currentLevel = stringValue(input, "currentLevel");
    if (!fullName || !email || !phone || !subject || !preferredDate || !currentLevel) return null;
    return {
      type,
      fullName,
      email,
      phone,
      subject,
      preferredDate,
      currentLevel,
      branchId: optionalStringValue(input, "branchId")
    };
  }
  if (type === "record.save") {
    const module = stringValue(input, "module");
    const payload = stringRecordValue(input.payload);
    if (!module) return null;
    return { type, module, payload };
  }
  if (type === "assignment.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const submissionType = stringValue(input, "submissionType");
    if (!courseRunId || !title || !dueAt || !["text", "file", "audio", "video"].includes(submissionType)) return null;
    return {
      type,
      courseRunId,
      title,
      dueAt,
      submissionType,
      rubric: stringArrayValue(input.rubric)
    };
  }
  if (type === "quiz.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const title = stringValue(input, "title");
    const durationMinutes = numberValue(input, "durationMinutes");
    const attemptsAllowed = numberValue(input, "attemptsAllowed");
    if (!courseRunId || !title || !Number.isFinite(durationMinutes) || !Number.isFinite(attemptsAllowed)) return null;
    return {
      type,
      courseRunId,
      title,
      durationMinutes,
      questionTypes: stringArrayValue(input.questionTypes),
      attemptsAllowed
    };
  }
  if (type === "assignment.grade") {
    const submissionId = stringValue(input, "submissionId");
    const score = numberValue(input, "score");
    const feedback = stringValue(input, "feedback");
    if (!submissionId || !Number.isFinite(score) || !feedback) return null;
    return { type, submissionId, score, feedback };
  }
  if (type === "attendance.save") {
    const classGroupId = stringValue(input, "classGroupId");
    const sessionId = stringValue(input, "sessionId");
    const statuses = attendanceRecordValue(input.statuses);
    if (!classGroupId || !sessionId || !Object.keys(statuses).length) return null;
    return { type, classGroupId, sessionId, statuses };
  }
  if (type === "calendar.create") {
    const eventType = stringValue(input, "eventType");
    const title = stringValue(input, "title");
    const startsAt = stringValue(input, "startsAt");
    const endsAt = stringValue(input, "endsAt");
    const ownerId = stringValue(input, "ownerId");
    if (!eventTypes.has(eventType) || !title || !startsAt || !endsAt || !ownerId) return null;
    return {
      type,
      eventType,
      title,
      startsAt,
      endsAt,
      ownerId,
      branchId: optionalStringValue(input, "branchId"),
      roomId: optionalStringValue(input, "roomId"),
      classGroupId: optionalStringValue(input, "classGroupId")
    };
  }
  if (type === "message.send") {
    const toUserId = stringValue(input, "toUserId");
    const subject = stringValue(input, "subject");
    const body = stringValue(input, "body");
    if (!toUserId || !subject || !body) return null;
    return {
      type,
      toUserId,
      subject,
      body,
      channel: communicationChannels.has(input.channel) ? input.channel : void 0
    };
  }
  if (type === "certificate.approve" || type === "certificate.issue") {
    const certificateId = stringValue(input, "certificateId");
    return certificateId ? { type, certificateId } : null;
  }
  if (type === "payment.record") {
    const invoiceId = stringValue(input, "invoiceId");
    return invoiceId ? { type, invoiceId } : null;
  }
  if (type === "placement.result.record") {
    const bookingId = stringValue(input, "bookingId");
    const recommendedLevel = stringValue(input, "recommendedLevel");
    const score = numberValue(input, "score");
    const notes = stringValue(input, "notes");
    if (!bookingId || !recommendedLevel || !Number.isFinite(score) || !notes) return null;
    return { type, bookingId, recommendedLevel, score, notes };
  }
  if (type === "lead.convert") {
    const leadId = stringValue(input, "leadId");
    return leadId ? { type, leadId } : null;
  }
  if (type === "quran.progress.update") {
    const recordId = stringValue(input, "recordId");
    const memorizedPercent = numberValue(input, "memorizedPercent");
    const tajweedScore = numberValue(input, "tajweedScore");
    const notes = stringValue(input, "notes");
    if (!recordId || !Number.isFinite(memorizedPercent) || !Number.isFinite(tajweedScore)) return null;
    return { type, recordId, memorizedPercent, tajweedScore, notes };
  }
  if (type === "recitation.review") {
    const submissionId = stringValue(input, "submissionId");
    const feedback = stringValue(input, "feedback");
    return submissionId && feedback ? { type, submissionId, feedback } : null;
  }
  if (type === "recitation.submit") {
    const studentId = stringValue(input, "studentId");
    const teacherId = stringValue(input, "teacherId");
    const title = stringValue(input, "title");
    return studentId && teacherId && title ? { type, studentId, teacherId, title } : null;
  }
  if (type === "notification.read") {
    const notificationId = stringValue(input, "notificationId");
    return notificationId ? { type, notificationId } : null;
  }
  return null;
}
var parsePlatformLearningAction = parsePlatformWorkflowAction;
async function applyPlatformWorkflowAction2(action, session) {
  const snapshot = await getPlatformStateSnapshot();
  const nextState = normalizeState(snapshot.state);
  assertScopedAction(nextState, action, session);
  const serverAction = applyServerActor(action, session, nextState);
  const result = applyPlatformWorkflowAction(nextState, serverAction, { createId: createId2, now });
  const persistence = await persistState(nextState);
  try {
    await writeSupabaseEvent({
      action: result.action,
      actorId: session.userId,
      entityType: result.entityType,
      entityId: result.entityId,
      summary: result.summary,
      payload: {
        request: serverAction,
        result: result.result,
        sourcePersistence: snapshot.persistence
      }
    });
  } catch {
  }
  return {
    state: nextState,
    persistence,
    syncedAt: now(),
    result
  };
}
var applyPlatformLearningAction = applyPlatformWorkflowAction2;

// server/routes.ts
function registerApiRoutes(app) {
  loadServerEnv();
  app.use(express.json());
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    if (req.get("X-Nile-Learn-Request") === "browser") {
      next();
      return;
    }
    res.status(403).json({ error: "Missing first-party request header." });
  });
  app.get("/api/integrations/supabase/status", (req, res) => {
    const session = getRequestSession(req);
    const status = getSupabaseServerStatus();
    if (!session || session.activeRole !== "superadmin") {
      res.json({
        urlConfigured: status.urlConfigured,
        publishableKeyConfigured: status.publishableKeyConfigured
      });
      return;
    }
    res.json(status);
  });
  app.post("/api/auth/login", async (req, res) => {
    const { email, password, role } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !isServerRole(role)) {
      res.status(400).json({ error: "Email, password, and role are required." });
      return;
    }
    try {
      const session = await signIn(email, password, role);
      res.json(attachSession(res, session));
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Sign in failed." });
    }
  });
  app.get("/api/auth/session", (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.json(null);
      return;
    }
    res.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      activeRole: session.activeRole,
      provider: session.provider,
      expiresAt: session.expiresAt
    });
  });
  app.post("/api/auth/logout", (req, res) => {
    endRequestSession(req, res);
    res.json({ ok: true });
  });
  app.get("/api/platform/records", (req, res) => {
    const session = getRequestSession(req);
    if (!session || !["registrar", "branchadmin", "superadmin"].includes(session.activeRole)) {
      res.status(403).json({ error: "Records access is restricted." });
      return;
    }
    res.json(getPlatformBackendState());
  });
  app.get("/api/platform/state", async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    const snapshot = await getPlatformStateSnapshot();
    res.json({
      ...snapshot,
      state: scopePlatformStateForSession(snapshot.state, session)
    });
  });
  app.post("/api/platform/state/actions", async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    const action = parsePlatformLearningAction(req.body);
    if (!action) {
      res.status(400).json({ error: "Valid platform learning action is required." });
      return;
    }
    try {
      const actionResult = await applyPlatformLearningAction(action, session);
      res.json({
        ...actionResult,
        state: scopePlatformStateForSession(actionResult.state, session)
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Platform action failed." });
    }
  });
  app.post("/api/platform/records", async (req, res) => {
    const { type, payload } = req.body ?? {};
    if (!["lead", "placement", "operational"].includes(type) || !payload || typeof payload !== "object") {
      res.status(400).json({ error: "Valid record type and payload are required." });
      return;
    }
    const session = getRequestSession(req);
    if (type === "operational") {
      if (!session) {
        res.status(401).json({ error: "Sign in required for operational records." });
        return;
      }
      if (!["registrar", "headofdepartment", "branchadmin", "superadmin"].includes(session.activeRole)) {
        res.status(403).json({ error: "Operational records are restricted." });
        return;
      }
    }
    const record2 = await savePlatformBackendRecord(type, payload, session?.userId);
    res.status(201).json(record2);
  });
}
function scopePlatformStateForSession(state, session) {
  if (session.activeRole === "superadmin") return state;
  const user = state.users.find((item) => item.id === session.userId);
  const branchId = user?.branchId;
  const student = state.students.find((item) => item.userId === session.userId);
  const teacher = state.teachers.find((item) => item.userId === session.userId);
  if (session.activeRole === "student" && student) {
    const courseRunIds = new Set(state.enrollments.filter((item) => item.studentId === student.id).map((item) => item.courseRunId));
    const courseIds = new Set(state.courseRuns.filter((item) => courseRunIds.has(item.id)).map((item) => item.courseId));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const lessonIds = new Set(
      state.lessons.filter((lesson) => state.modules.some((module) => module.id === lesson.moduleId && courseIds.has(module.courseId))).map((item) => item.id)
    );
    return {
      ...state,
      users: state.users.filter((item) => item.id === session.userId || item.roles.includes("teacher")),
      students: [student],
      teachers: state.teachers.filter((item) => state.courseRuns.some((run) => run.teacherId === item.userId && courseRunIds.has(run.id))),
      enrollments: state.enrollments.filter((item) => item.studentId === student.id),
      lessonProgress: state.lessonProgress.filter((item) => item.studentId === student.id),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => item.studentId === student.id),
      quizAttempts: state.quizAttempts.filter((item) => item.studentId === student.id),
      grades: state.grades.filter((item) => item.studentId === student.id),
      attendance: state.attendance.filter((item) => item.studentId === student.id),
      certificates: state.certificates.filter((item) => item.studentId === student.id),
      quranProgress: state.quranProgress.filter((item) => item.studentId === student.id),
      recitationSubmissions: state.recitationSubmissions.filter((item) => item.studentId === student.id),
      invoices: state.invoices.filter((item) => item.studentId === student.id),
      payments: state.payments.filter((item) => state.invoices.some((invoice) => invoice.id === item.invoiceId && invoice.studentId === student.id)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId === student.id),
      auditLogs: [],
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      events: state.events.filter((item) => !item.classGroupId || classGroupIds.has(item.classGroupId) || item.ownerId === session.userId),
      lessons: state.lessons.filter((item) => lessonIds.has(item.id))
    };
  }
  if (session.activeRole === "teacher" && teacher) {
    const courseRunIds = new Set(state.courseRuns.filter((item) => item.teacherId === session.userId).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const userIds = /* @__PURE__ */ new Set([session.userId, ...state.students.filter((item) => studentIds.has(item.id)).map((item) => item.userId)]);
    return {
      ...state,
      users: state.users.filter((item) => userIds.has(item.id)),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: [teacher],
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => state.assignments.some((assignment) => assignment.id === item.assignmentId && courseRunIds.has(assignment.courseRunId))),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      quizAttempts: state.quizAttempts.filter((item) => state.quizzes.some((quiz) => quiz.id === item.quizId && courseRunIds.has(quiz.courseRunId))),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      attendance: state.attendance.filter((item) => studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.ownerId === session.userId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => item.teacherId === session.userId || studentIds.has(item.studentId)),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: [],
      invoices: [],
      payments: [],
      supportTickets: [],
      auditLogs: []
    };
  }
  if (session.activeRole === "branchadmin" && branchId) {
    const courseRunIds = new Set(state.courseRuns.filter((item) => item.branchId === branchId).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const invoiceIds = new Set(state.invoices.filter((item) => studentIds.has(item.studentId)).map((item) => item.id));
    return {
      ...state,
      users: state.users.filter((item) => item.branchId === branchId || item.id === session.userId),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: state.teachers.filter((item) => state.users.some((userItem) => userItem.id === item.userId && userItem.branchId === branchId)),
      branches: state.branches.filter((item) => item.id === branchId),
      rooms: state.rooms.filter((item) => item.branchId === branchId),
      courseRuns: state.courseRuns.filter((item) => item.branchId === branchId),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      attendance: state.attendance.filter((item) => studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.branchId === branchId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => studentIds.has(item.studentId)),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      quizAttempts: state.quizAttempts.filter((item) => studentIds.has(item.studentId)),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      certificates: state.certificates.filter((item) => studentIds.has(item.studentId)),
      quranPlans: state.quranPlans.filter((item) => studentIds.has(item.studentId)),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => studentIds.has(item.studentId)),
      invoices: state.invoices.filter((item) => studentIds.has(item.studentId)),
      payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId ? studentIds.has(item.studentId) : false),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      documents: state.documents.filter((item) => item.ownerId === session.userId),
      auditLogs: []
    };
  }
  if (session.activeRole === "registrar") {
    return {
      ...state,
      auditLogs: [],
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId)
    };
  }
  if (session.activeRole === "headofdepartment") {
    const departmentIds = new Set(state.departments.filter((item) => item.ownerUserId === session.userId || item.id === user?.departmentId).map((item) => item.id));
    const programIds = new Set(state.programs.filter((item) => departmentIds.has(item.departmentId)).map((item) => item.id));
    const courseIds = new Set(state.courses.filter((item) => programIds.has(item.programId)).map((item) => item.id));
    const courseRunIds = new Set(state.courseRuns.filter((item) => courseIds.has(item.courseId)).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const invoiceIds = new Set(state.invoices.filter((item) => studentIds.has(item.studentId)).map((item) => item.id));
    return {
      ...state,
      users: state.users.filter(
        (item) => item.id === session.userId || (item.departmentId ? departmentIds.has(item.departmentId) : false) || studentIds.has(state.students.find((studentItem) => studentItem.userId === item.id)?.id ?? "")
      ),
      departments: state.departments.filter((item) => departmentIds.has(item.id)),
      programs: state.programs.filter((item) => programIds.has(item.id)),
      levels: state.levels.filter((item) => programIds.has(item.programId)),
      courses: state.courses.filter((item) => courseIds.has(item.id)),
      modules: state.modules.filter((item) => courseIds.has(item.courseId)),
      lessons: state.lessons.filter((item) => state.modules.some((module) => module.id === item.moduleId && courseIds.has(module.courseId))),
      resources: state.resources.filter((item) => state.lessons.some((lesson) => lesson.id === item.lessonId && state.modules.some((module) => module.id === lesson.moduleId && courseIds.has(module.courseId)))),
      teachers: state.teachers.filter((item) => item.departmentId && departmentIds.has(item.departmentId)),
      students: state.students.filter((item) => studentIds.has(item.id)),
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => studentIds.has(item.studentId)),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      quizAttempts: state.quizAttempts.filter((item) => studentIds.has(item.studentId)),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      attendance: state.attendance.filter((item) => studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.classGroupId ? classGroupIds.has(item.classGroupId) : item.ownerId === session.userId),
      certificates: state.certificates.filter((item) => courseIds.has(item.courseId)),
      quranPlans: state.quranPlans.filter((item) => studentIds.has(item.studentId)),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => studentIds.has(item.studentId)),
      invoices: state.invoices.filter((item) => studentIds.has(item.studentId)),
      payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
      auditLogs: [],
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId ? studentIds.has(item.studentId) : false),
      documents: state.documents.filter((item) => item.ownerId === session.userId)
    };
  }
  return {
    ...state,
    users: state.users.filter((item) => item.id === session.userId),
    leads: [],
    applications: [],
    placementTests: [],
    placementResults: [],
    invoices: [],
    payments: [],
    messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
    notifications: state.notifications.filter((item) => item.userId === session.userId),
    auditLogs: []
  };
}

// server/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path4.dirname(__filename);
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  registerApiRoutes(app);
  const staticPath = path4.resolve(__dirname, "..", "dist");
  app.use(express2.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path4.join(staticPath, "index.html"));
  });
  const port = process.env.PORT || 3e3;
  const host = process.env.HOST || "127.0.0.1";
  server.listen(Number(port), host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}
startServer().catch(console.error);
