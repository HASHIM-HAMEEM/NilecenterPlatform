import type { Role } from "../platformData.js";
import type { PlatformState, User } from "./types.js";

export type MessageRecipientScope = {
  visibleUserIds: Set<string>;
  sendableUserIds: Set<string>;
};

function userHasRole(user: User, role: Role) {
  return user.activeRole === role || user.roles.includes(role);
}

function activeUsers(state: PlatformState, actorId: string) {
  return state.users.filter((user) => user.id !== actorId && user.status !== "cancelled");
}

function assignedStudentIdsForTeacher(state: PlatformState, teacherUserId: string) {
  const runIds = new Set(state.courseRuns.filter((run) => run.teacherId === teacherUserId).map((run) => run.id));
  const classGroups = state.classGroups.filter((group) => runIds.has(group.courseRunId));
  return new Set([
    ...classGroups.flatMap((group) => group.studentIds),
    ...state.enrollments.filter((enrollment) => enrollment.classGroupId && classGroups.some((group) => group.id === enrollment.classGroupId)).map((enrollment) => enrollment.studentId),
  ]);
}

function assignedTeacherIdsForStudent(state: PlatformState, studentUserId: string) {
  const student = state.students.find((item) => item.userId === studentUserId);
  const runIds = new Set(state.enrollments.filter((item) => item.studentId === student?.id).map((item) => item.courseRunId));
  return new Set(state.courseRuns.filter((run) => runIds.has(run.id)).map((run) => run.teacherId));
}

function studentUserIdsForBranch(state: PlatformState, branchId?: string) {
  const runIds = new Set(state.courseRuns.filter((run) => run.branchId === branchId).map((run) => run.id));
  const studentIds = new Set(state.enrollments.filter((enrollment) => runIds.has(enrollment.courseRunId)).map((enrollment) => enrollment.studentId));
  return new Set(state.students.filter((student) => studentIds.has(student.id)).map((student) => student.userId));
}

function departmentCourseStudentUserIds(state: PlatformState, departmentIds: Set<string>) {
  const programIds = new Set(state.programs.filter((program) => departmentIds.has(program.departmentId)).map((program) => program.id));
  const courseIds = new Set(state.courses.filter((course) => programIds.has(course.programId)).map((course) => course.id));
  const runIds = new Set(state.courseRuns.filter((run) => courseIds.has(run.courseId)).map((run) => run.id));
  const studentIds = new Set(state.enrollments.filter((enrollment) => runIds.has(enrollment.courseRunId)).map((enrollment) => enrollment.studentId));
  return new Set(state.students.filter((student) => studentIds.has(student.id)).map((student) => student.userId));
}

function addIf(set: Set<string>, user: User | undefined, condition: boolean) {
  if (user && condition) set.add(user.id);
}

export function getMessageRecipientScope(state: PlatformState, role: Role, actorId: string): MessageRecipientScope {
  const actor = state.users.find((user) => user.id === actorId);
  const visibleUserIds = new Set(activeUsers(state, actorId).map((user) => user.id));
  const sendableUserIds = new Set<string>();

  if (role === "superadmin") {
    visibleUserIds.forEach((userId) => sendableUserIds.add(userId));
    return { visibleUserIds, sendableUserIds };
  }

  if (role === "student") {
    assignedTeacherIdsForStudent(state, actorId).forEach((userId) => sendableUserIds.add(userId));
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId &&
          (userHasRole(user, "registrar") || userHasRole(user, "branchadmin")) &&
          (!actor?.branchId || user.branchId === actor.branchId || user.branchId === "br_global"),
      );
    });
    return { visibleUserIds: new Set(sendableUserIds), sendableUserIds };
  }

  if (role === "teacher") {
    const assignedStudentIds = assignedStudentIdsForTeacher(state, actorId);
    state.students.forEach((student) => {
      addIf(sendableUserIds, state.users.find((user) => user.id === student.userId), assignedStudentIds.has(student.id));
    });
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId &&
          (userHasRole(user, "superadmin") ||
            ((userHasRole(user, "registrar") || userHasRole(user, "branchadmin")) && user.branchId === actor?.branchId) ||
            (userHasRole(user, "headofdepartment") && Boolean(actor?.departmentId && user.departmentId === actor.departmentId))),
      );
    });
    return { visibleUserIds, sendableUserIds };
  }

  if (role === "branchadmin") {
    studentUserIdsForBranch(state, actor?.branchId).forEach((userId) => sendableUserIds.add(userId));
    state.users.forEach((user) => {
      addIf(sendableUserIds, user, user.id !== actorId && user.branchId === actor?.branchId);
    });
    return { visibleUserIds: new Set(sendableUserIds), sendableUserIds };
  }

  if (role === "headofdepartment") {
    const departmentIds = new Set(state.departments.filter((department) => department.ownerUserId === actorId || department.id === actor?.departmentId).map((department) => department.id));
    departmentCourseStudentUserIds(state, departmentIds).forEach((userId) => sendableUserIds.add(userId));
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId &&
          (userHasRole(user, "superadmin") ||
            (typeof user.departmentId === "string" && departmentIds.has(user.departmentId)) ||
            (userHasRole(user, "registrar") && Boolean(actor?.branchId && user.branchId === actor.branchId))),
      );
    });
    return { visibleUserIds: new Set(sendableUserIds), sendableUserIds };
  }

  if (role === "registrar") {
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId &&
          (userHasRole(user, "superadmin") ||
            ((userHasRole(user, "student") || userHasRole(user, "teacher") || userHasRole(user, "branchadmin") || userHasRole(user, "headofdepartment")) &&
              (!actor?.branchId || user.branchId === actor.branchId || user.branchId === "br_global"))),
      );
    });
    return { visibleUserIds: new Set(sendableUserIds), sendableUserIds };
  }

  return { visibleUserIds: new Set(), sendableUserIds };
}

export function canSendMessageToUser(state: PlatformState, role: Role, actorId: string, toUserId: string) {
  return getMessageRecipientScope(state, role, actorId).sendableUserIds.has(toUserId);
}
