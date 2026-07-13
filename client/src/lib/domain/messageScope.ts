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
  return state.users.filter((user) => user.id !== actorId && user.status === "active");
}

function activeStaffProfile(state: PlatformState, actorId: string, role: Role) {
  if (role === "student") return undefined;
  return state.staffProfiles.find(
    profile =>
      profile.userId === actorId &&
      profile.role === role &&
      profile.status === "active"
  );
}

function activeStaffProfilesForUser(state: PlatformState, user: User) {
  return state.staffProfiles.filter(
    profile =>
      profile.userId === user.id &&
      profile.status === "active" &&
      user.roles.includes(profile.role)
  );
}

function userMatchesBranchScope(
  state: PlatformState,
  user: User,
  branchIds: Set<string>
) {
  if (branchIds.has("br_global")) return true;
  const recipientBranchIds = new Set([
    ...(user.branchId ? [user.branchId] : []),
    ...activeStaffProfilesForUser(state, user).flatMap(profile =>
      profile.branchIds.filter(Boolean)
    ),
  ]);
  return Array.from(recipientBranchIds).some(branchId =>
    branchIds.has(branchId)
  );
}

function userMatchesDepartmentScope(
  state: PlatformState,
  user: User,
  departmentIds: Set<string>
) {
  const recipientDepartmentIds = new Set([
    ...(user.departmentId ? [user.departmentId] : []),
    ...activeStaffProfilesForUser(state, user).flatMap(profile =>
      profile.departmentIds.filter(Boolean)
    ),
  ]);
  return Array.from(recipientDepartmentIds).some(departmentId =>
    departmentIds.has(departmentId)
  );
}

function activeStudent(state: PlatformState, studentId: string) {
  const student = state.students.find(item => item.id === studentId);
  const user = student
    ? state.users.find(item => item.id === student.userId)
    : undefined;
  return student?.status === "active" && user?.status === "active";
}

function assignedStudentIdsForTeacher(state: PlatformState, teacherUserId: string) {
  const runIds = new Set(
    state.courseRuns
      .filter(run => run.teacherId === teacherUserId && run.status === "active")
      .map(run => run.id)
  );
  const classGroups = state.classGroups.filter((group) => runIds.has(group.courseRunId));
  const classGroupsById = new Map(classGroups.map(group => [group.id, group]));
  return new Set(
    state.enrollments
      .filter(enrollment => {
        const group = enrollment.classGroupId
          ? classGroupsById.get(enrollment.classGroupId)
          : undefined;
        return (
          enrollment.status === "active" &&
          Boolean(group?.studentIds.includes(enrollment.studentId)) &&
          activeStudent(state, enrollment.studentId)
        );
      })
      .map(enrollment => enrollment.studentId)
  );
}

function assignedTeacherIdsForStudent(state: PlatformState, studentUserId: string) {
  const student = state.students.find((item) => item.userId === studentUserId);
  const runIds = new Set(
    state.enrollments
      .filter(item => item.studentId === student?.id && item.status === "active")
      .map(item => item.courseRunId)
  );
  return new Set(
    state.courseRuns
      .filter(run => runIds.has(run.id) && run.status === "active")
      .filter(run => {
        const teacherUser = state.users.find(user => user.id === run.teacherId);
        const teacher = state.teachers.find(
          profile => profile.userId === run.teacherId && profile.status === "active"
        );
        return teacherUser?.status === "active" && Boolean(teacher);
      })
      .map(run => run.teacherId)
  );
}

function studentUserIdsForBranches(state: PlatformState, branchIds: Set<string>) {
  const runIds = new Set(
    state.courseRuns
      .filter(run => branchIds.has(run.branchId) && run.status === "active")
      .map(run => run.id)
  );
  const studentIds = new Set(
    state.enrollments
      .filter(
        enrollment =>
          enrollment.status === "active" &&
          runIds.has(enrollment.courseRunId) &&
          activeStudent(state, enrollment.studentId)
      )
      .map(enrollment => enrollment.studentId)
  );
  return new Set(state.students.filter((student) => studentIds.has(student.id)).map((student) => student.userId));
}

function departmentCourseStudentUserIds(
  state: PlatformState,
  departmentIds: Set<string>,
  branchIds: Set<string>
) {
  const programIds = new Set(state.programs.filter((program) => departmentIds.has(program.departmentId)).map((program) => program.id));
  const courseIds = new Set(state.courses.filter((course) => programIds.has(course.programId)).map((course) => course.id));
  const globalScope = branchIds.has("br_global");
  const runIds = new Set(
    state.courseRuns
      .filter(
        run =>
          courseIds.has(run.courseId) &&
          run.status === "active" &&
          (globalScope || branchIds.has(run.branchId))
      )
      .map(run => run.id)
  );
  const studentIds = new Set(
    state.enrollments
      .filter(
        enrollment =>
          enrollment.status === "active" &&
          runIds.has(enrollment.courseRunId) &&
          activeStudent(state, enrollment.studentId)
      )
      .map(enrollment => enrollment.studentId)
  );
  return new Set(state.students.filter((student) => studentIds.has(student.id)).map((student) => student.userId));
}

function addIf(set: Set<string>, user: User | undefined, condition: boolean) {
  if (user?.status === "active" && condition) set.add(user.id);
}

export function getMessageRecipientScope(state: PlatformState, role: Role, actorId: string): MessageRecipientScope {
  const actor = state.users.find((user) => user.id === actorId);
  const staffProfile = activeStaffProfile(state, actorId, role);
  const branchIds = new Set(staffProfile?.branchIds ?? []);
  const departmentIds = new Set(staffProfile?.departmentIds ?? []);
  const visibleUserIds = new Set(activeUsers(state, actorId).map((user) => user.id));
  const sendableUserIds = new Set<string>();

  if (role === "superadmin") {
    visibleUserIds.forEach((userId) => sendableUserIds.add(userId));
    return { visibleUserIds, sendableUserIds };
  }

  if (role === "student") {
    assignedTeacherIdsForStudent(state, actorId).forEach((userId) => sendableUserIds.add(userId));
    const studentBranchIds = new Set(actor?.branchId ? [actor.branchId] : []);
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId &&
          (userHasRole(user, "registrar") || userHasRole(user, "branchadmin")) &&
          (studentBranchIds.size > 0
            ? userMatchesBranchScope(state, user, studentBranchIds)
            : user.branchId === "br_global"),
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
            ((userHasRole(user, "registrar") || userHasRole(user, "branchadmin")) &&
              userMatchesBranchScope(state, user, branchIds)) ||
            (userHasRole(user, "headofdepartment") &&
              userMatchesDepartmentScope(state, user, departmentIds))),
      );
    });
    return { visibleUserIds, sendableUserIds };
  }

  if (role === "branchadmin") {
    studentUserIdsForBranches(state, branchIds).forEach((userId) => sendableUserIds.add(userId));
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId && userMatchesBranchScope(state, user, branchIds)
      );
    });
    return { visibleUserIds: new Set(sendableUserIds), sendableUserIds };
  }

  if (role === "headofdepartment") {
    departmentCourseStudentUserIds(state, departmentIds, branchIds).forEach((userId) => sendableUserIds.add(userId));
    state.users.forEach((user) => {
      addIf(
        sendableUserIds,
        user,
        user.id !== actorId &&
          (userHasRole(user, "superadmin") ||
            userMatchesDepartmentScope(state, user, departmentIds) ||
            (userHasRole(user, "registrar") &&
              userMatchesBranchScope(state, user, branchIds))),
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
              userMatchesBranchScope(state, user, branchIds))),
      );
    });
    return { visibleUserIds: new Set(sendableUserIds), sendableUserIds };
  }

  return { visibleUserIds: new Set(), sendableUserIds };
}

export function canSendMessageToUser(state: PlatformState, role: Role, actorId: string, toUserId: string) {
  return getMessageRecipientScope(state, role, actorId).sendableUserIds.has(toUserId);
}
