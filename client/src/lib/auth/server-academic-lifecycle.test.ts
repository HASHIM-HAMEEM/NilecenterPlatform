import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerRole, ServerSession } from "../../../../server/auth";
import type {
  PlatformRepository,
  PlatformRepositoryEvent,
} from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  getPlatformStateSnapshot,
} from "../../../../server/platformState";
import { scopePlatformStateForSession } from "../../../../server/routes";
import type { PlatformWorkflowAction } from "../domain/actions";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

const fixedNow = "2026-07-12T12:00:00.000Z";
const exactCourseId = "course_ar_l3";
const exactCourseRunId = "run_ar_l3_cairo_2026";
const exactClassGroupId = "class_ar_l3_cairo";
const exactBranchId = "br_cairo";
const exactRoomId = "room_cairo_4";

const sessionUsers: Record<
  ServerRole,
  { userId: string; email: string; name: string }
> = {
  student: {
    userId: "usr_student_demo",
    email: "student.demo@nilelearn.local",
    name: "Student Demo",
  },
  teacher: {
    userId: "usr_teacher_demo",
    email: "teacher.demo@nilelearn.local",
    name: "Teacher Demo",
  },
  registrar: {
    userId: "usr_registrar_demo",
    email: "registrar.demo@nilelearn.local",
    name: "Registrar Demo",
  },
  headofdepartment: {
    userId: "usr_hod_demo",
    email: "hod.demo@nilelearn.local",
    name: "HOD Demo",
  },
  branchadmin: {
    userId: "usr_branch_demo",
    email: "branch.demo@nilelearn.local",
    name: "Branch Demo",
  },
  superadmin: {
    userId: "usr_admin_demo",
    email: "admin.demo@nilelearn.local",
    name: "Admin Demo",
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sessionFor(
  role: ServerRole,
  override: Partial<ServerSession> = {}
): ServerSession {
  const user = sessionUsers[role];
  return {
    id: `academic_lifecycle_${role}`,
    userId: user.userId,
    email: user.email,
    name: user.name,
    roles: [role],
    activeRole: role,
    provider: "demo",
    createdAt: "2026-07-12T00:00:00.000Z",
    expiresAt: "2026-07-13T00:00:00.000Z",
    ...override,
  };
}

let restoreRepository: (() => void) | undefined;

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("server academic lifecycle integration", () => {
  it("keeps one repository state coherent across scoped staff work and the student projection", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    let randomSeed = 41;
    vi.spyOn(Math, "random").mockImplementation(() => {
      randomSeed = (randomSeed * 16807) % 2147483647;
      return (randomSeed - 1) / 2147483646;
    });

    const initialState = clone(seedPlatformState);
    initialState.courses = initialState.courses.map(course =>
      course.id === exactCourseId ? { ...course, status: "draft" } : course
    );
    const initialAuditIds = new Set(
      initialState.auditLogs.map(item => item.id)
    );
    const initialCommunicationIds = new Set(
      initialState.communicationLogs.map(item => item.id)
    );
    const initialIntegrations = clone(initialState.integrations);
    let repositoryState = clone(initialState);
    const repositoryEvents: PlatformRepositoryEvent[] = [];

    const repository: PlatformRepository = {
      readSnapshot: vi.fn(async () => ({
        state: clone(repositoryState),
        persistence: "local",
        syncedAt: fixedNow,
      })),
      writeSnapshot: vi.fn(async state => {
        repositoryState = clone(state);
        return "local";
      }),
      recordEvent: vi.fn(async event => {
        repositoryEvents.push(clone(event));
      }),
    };
    restoreRepository = setPlatformStateRepository(repository);

    type CommandEvidence = Pick<
      PlatformRepositoryEvent,
      "action" | "actorId" | "entityType" | "entityId"
    >;
    const successfulCommands: CommandEvidence[] = [];
    const applyAs = async (
      action: PlatformWorkflowAction,
      session: ServerSession
    ) => {
      const output = await applyPlatformWorkflowAction(action, session);
      successfulCommands.push({
        action: output.result.action,
        actorId: session.userId,
        entityType: output.result.entityType,
        entityId: output.result.entityId,
      });
      return output;
    };

    const hodSession = sessionFor("headofdepartment");
    const outOfDepartmentHod = sessionFor("headofdepartment", {
      id: "academic_lifecycle_hod_quran",
      userId: "usr_hod_quran_demo",
      email: "quran.hod.demo@nilelearn.local",
      name: "Quran HOD Demo",
    });
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "course.status.update",
          courseId: exactCourseId,
          status: "active",
        },
        outOfDepartmentHod
      )
    ).rejects.toThrow("HOD can only update course status in their department.");

    const courseActivation = await applyAs(
      {
        type: "course.status.update",
        courseId: exactCourseId,
        status: "active",
      },
      hodSession
    );
    expect(
      courseActivation.state.courses.find(course => course.id === exactCourseId)
    ).toMatchObject({ status: "active" });

    const registrarSession = sessionFor("registrar");
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "application.create",
          fullName: "Outside Scope Learner",
          email: "outside.scope.learner@nilelearn.local",
          phone: "+20 100 555 0000",
          branchId: "br_alex",
          courseInterest: "Arabic Language",
          schedulePreference: "Evening",
        },
        registrarSession
      )
    ).rejects.toThrow(
      "Registrar can only create applications inside admissions branches."
    );

    const applicant = {
      fullName: "Lifecycle Learner",
      email: "lifecycle.learner@nilelearn.local",
      phone: "+20 100 555 0101",
    };
    const applicationWrite = await applyAs(
      {
        type: "application.create",
        ...applicant,
        branchId: exactBranchId,
        courseInterest: "Arabic Language",
        schedulePreference: "Sunday afternoon",
        country: "Test Country",
        notes: "Fake lifecycle integration record.",
        source: "manual",
      },
      registrarSession
    );
    const applicationPayload = applicationWrite.result.result as {
      lead: PlatformState["leads"][number];
      application: PlatformState["applications"][number];
    };

    const placementWrite = await applyAs(
      {
        type: "placement.create",
        ...applicant,
        leadId: applicationPayload.lead.id,
        branchId: exactBranchId,
        subject: "Arabic Language",
        preferredDate: "2026-07-12",
        currentLevel: "Can read short Arabic passages",
      },
      registrarSession
    );
    const placement = placementWrite.result
      .result as PlatformState["placementTests"][number];

    const placementResultWrite = await applyAs(
      {
        type: "placement.result.record",
        bookingId: placement.id,
        recommendedLevel: "Arabic Level 3",
        score: 84,
        notes: "Ready for the existing Cairo Level 3 class.",
      },
      registrarSession
    );
    const placementResult = placementResultWrite.result
      .result as PlatformState["placementResults"][number];
    const placementWorkflow =
      placementResultWrite.state.enrollmentWorkflows.find(
        item => item.placementTestId === placement.id
      );
    expect(placementWorkflow).toBeDefined();
    if (!placementWorkflow) {
      throw new Error(
        "Placement result did not create an enrollment workflow."
      );
    }

    const applicationConvertWrite = await applyAs(
      {
        type: "application.convert",
        applicationId: applicationPayload.application.id,
      },
      registrarSession
    );
    const applicationWorkflow = applicationConvertWrite.result
      .result as PlatformState["enrollmentWorkflows"][number];

    expect(applicationWorkflow).toMatchObject({
      applicationId: applicationPayload.application.id,
      placementTestId: placement.id,
      source: "placement",
    });
    expect(applicationWorkflow.id).toBe(placementWorkflow.id);
    expect(placementWorkflow).toMatchObject({
      applicationId: applicationPayload.application.id,
      placementTestId: placement.id,
      source: "placement",
    });

    const enrollmentActivation = await applyAs(
      {
        type: "enrollment.activate",
        workflowId: placementWorkflow.id,
        courseRunId: exactCourseRunId,
        classGroupId: exactClassGroupId,
      },
      registrarSession
    );
    const activatedStudent = enrollmentActivation.result
      .result as PlatformState["students"][number];
    const activatedUser = enrollmentActivation.state.users.find(
      user => user.id === activatedStudent.userId
    );
    expect(activatedUser).toMatchObject({
      name: applicant.fullName,
      email: applicant.email,
      activeRole: "student",
      branchId: exactBranchId,
      status: "active",
    });
    expect(
      enrollmentActivation.state.enrollments.find(
        enrollment => enrollment.studentId === activatedStudent.id
      )
    ).toMatchObject({
      courseRunId: exactCourseRunId,
      classGroupId: exactClassGroupId,
      teacherId: "usr_teacher_demo",
      source: "placement",
      status: "active",
    });
    expect(
      enrollmentActivation.state.classGroups.find(
        group => group.id === exactClassGroupId
      )?.studentIds
    ).toContain(activatedStudent.id);
    expect(
      enrollmentActivation.state.applications.find(
        item => item.id === applicationPayload.application.id
      )
    ).toMatchObject({ status: "approved" });
    expect(
      enrollmentActivation.state.placementTests.find(
        item => item.id === placement.id
      )
    ).toMatchObject({
      status: "completed",
      recommendedLevel: "Arabic Level 3",
    });

    const classSessionAction = {
      type: "calendar.create" as const,
      eventType: "class_session" as const,
      title: "Lifecycle Cairo class",
      startsAt: "2026-07-12T15:30:00+03:00",
      endsAt: "2026-07-12T16:30:00+03:00",
      branchId: exactBranchId,
      roomId: exactRoomId,
      classGroupId: exactClassGroupId,
    };
    const outOfBranchAdmin = sessionFor("branchadmin", {
      id: "academic_lifecycle_branch_alex",
      userId: "usr_branch_alex_demo",
      email: "alex.branch.demo@nilelearn.local",
      name: "Alex Branch Demo",
    });
    await expect(
      applyPlatformWorkflowAction(classSessionAction, outOfBranchAdmin)
    ).rejects.toThrow("Branch admin can only schedule inside their branch.");

    const calendarWrite = await applyAs(
      classSessionAction,
      sessionFor("branchadmin")
    );
    const calendarResult = calendarWrite.result.result as {
      event: PlatformState["events"][number];
      conflicts: PlatformState["events"];
      availabilityGaps: string[];
    };
    expect(calendarResult).toMatchObject({
      event: {
        ownerId: "usr_branch_demo",
        branchId: exactBranchId,
        roomId: exactRoomId,
        classGroupId: exactClassGroupId,
        status: "active",
      },
      conflicts: [],
      availabilityGaps: [],
    });
    const classSession = calendarWrite.state.classSessions.find(
      item => item.eventId === calendarResult.event.id
    );
    expect(classSession).toMatchObject({
      classGroupId: exactClassGroupId,
      status: "active",
      attendanceSaved: false,
    });
    if (!classSession) {
      throw new Error(
        "Conflict-free calendar action did not create a class session."
      );
    }

    const assignedTeacher = sessionFor("teacher");
    const assignmentWrite = await applyAs(
      {
        type: "assignment.create",
        courseRunId: exactCourseRunId,
        title: "Lifecycle writing response",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy", "Clarity"],
      },
      assignedTeacher
    );
    const assignment = assignmentWrite.result
      .result as PlatformState["assignments"][number];
    expect(assignment).toMatchObject({
      courseRunId: exactCourseRunId,
      status: "draft",
    });

    const assignmentPublish = await applyAs(
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "active",
      },
      assignedTeacher
    );
    expect(
      assignmentPublish.state.assignments.find(item => item.id === assignment.id)
    ).toMatchObject({ status: "active" });

    if (!activatedUser) {
      throw new Error("Enrollment activation did not create a student user.");
    }
    const activatedStudentSession = sessionFor("student", {
      id: "academic_lifecycle_activated_student",
      userId: activatedUser.id,
      email: activatedUser.email,
      name: activatedUser.name,
    });
    const submissionWrite = await applyAs(
      {
        type: "assignment.submit",
        assignmentId: assignment.id,
        response: "A fake response for deterministic lifecycle grading.",
      },
      activatedStudentSession
    );
    const submission = submissionWrite.result
      .result as PlatformState["assignmentSubmissions"][number];

    const exactClass = submissionWrite.state.classGroups.find(
      group => group.id === exactClassGroupId
    );
    expect(exactClass).toBeDefined();
    if (!exactClass) {
      throw new Error(
        "The exact enrollment class is missing from repository state."
      );
    }
    const attendanceStatuses = Object.fromEntries(
      exactClass.studentIds.map(studentId => [
        studentId,
        studentId === activatedStudent.id ? "present" : "late",
      ])
    ) as Record<string, "present" | "late">;
    const attendanceNotes = Object.fromEntries(
      exactClass.studentIds.map(studentId => [
        studentId,
        studentId === activatedStudent.id
          ? "First lifecycle class attended."
          : "Joined after the opening review.",
      ])
    );
    const unassignedTeacher = sessionFor("teacher", {
      id: "academic_lifecycle_teacher_alex",
      userId: "usr_teacher_alex_demo",
      email: "alex.teacher.demo@nilelearn.local",
      name: "Alex Teacher Demo",
    });
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "attendance.save",
          classGroupId: exactClassGroupId,
          sessionId: classSession.id,
          statuses: attendanceStatuses,
          notes: attendanceNotes,
        },
        unassignedTeacher
      )
    ).rejects.toThrow("Teacher can only save attendance for assigned classes.");
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.grade",
          submissionId: submission.id,
          score: 92,
          feedback: "An unassigned teacher must not save this feedback.",
        },
        unassignedTeacher
      )
    ).rejects.toThrow("Teacher can only grade assigned class submissions.");

    const attendanceWrite = await applyAs(
      {
        type: "attendance.save",
        classGroupId: exactClassGroupId,
        sessionId: classSession.id,
        statuses: attendanceStatuses,
        notes: attendanceNotes,
      },
      assignedTeacher
    );
    expect(
      attendanceWrite.state.classSessions.find(
        item => item.id === classSession.id
      )
    ).toMatchObject({ attendanceSaved: true });
    expect(
      attendanceWrite.state.attendance.find(
        item =>
          item.sessionId === classSession.id &&
          item.studentId === activatedStudent.id
      )
    ).toMatchObject({
      classGroupId: exactClassGroupId,
      status: "present",
      notes: "First lifecycle class attended.",
    });

    const gradingWrite = await applyAs(
      {
        type: "assignment.grade",
        submissionId: submission.id,
        score: 92,
        feedback: "Clear reasoning with accurate sentence structure.",
      },
      assignedTeacher
    );
    expect(
      gradingWrite.state.assignmentSubmissions.find(
        item => item.id === submission.id
      )
    ).toMatchObject({
      status: "completed",
      score: 92,
      feedback: "Clear reasoning with accurate sentence structure.",
    });

    const finalSnapshot = await getPlatformStateSnapshot();
    const studentProjection = scopePlatformStateForSession(
      finalSnapshot.state,
      activatedStudentSession
    );
    expect(studentProjection.students).toEqual([
      expect.objectContaining({ id: activatedStudent.id, status: "active" }),
    ]);
    expect(studentProjection.enrollments).toEqual([
      expect.objectContaining({
        studentId: activatedStudent.id,
        courseRunId: exactCourseRunId,
        classGroupId: exactClassGroupId,
        teacherId: assignedTeacher.userId,
      }),
    ]);
    expect(studentProjection.courseRuns.map(item => item.id)).toEqual([
      exactCourseRunId,
    ]);
    expect(studentProjection.classGroups.map(item => item.id)).toEqual([
      exactClassGroupId,
    ]);
    expect(studentProjection.classSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: classSession.id,
          classGroupId: exactClassGroupId,
          attendanceSaved: true,
        }),
      ])
    );
    expect(studentProjection.attendance).toEqual([
      expect.objectContaining({
        sessionId: classSession.id,
        studentId: activatedStudent.id,
        status: "present",
      }),
    ]);
    expect(studentProjection.assignmentSubmissions).toEqual([
      expect.objectContaining({
        id: submission.id,
        studentId: activatedStudent.id,
        score: 92,
        feedback: "Clear reasoning with accurate sentence structure.",
      }),
    ]);
    expect(studentProjection.grades).toEqual([
      expect.objectContaining({
        studentId: activatedStudent.id,
        courseRunId: exactCourseRunId,
        itemId: assignment.id,
        score: 92,
        feedback: "Clear reasoning with accurate sentence structure.",
      }),
    ]);
    expect(studentProjection.applications).toEqual([]);
    expect(studentProjection.placementTests).toEqual([]);
    expect(studentProjection.auditLogs).toEqual([]);

    const adminProjection = scopePlatformStateForSession(
      finalSnapshot.state,
      sessionFor("superadmin")
    );
    const newAuditRows = adminProjection.auditLogs.filter(
      item => !initialAuditIds.has(item.id)
    );
    const expectedAuditRows: Array<
      Pick<
        PlatformState["auditLogs"][number],
        "action" | "actorId" | "entityType" | "entityId"
      >
    > = [
      {
        action: "course.status_updated",
        actorId: hodSession.userId,
        entityType: "Course",
        entityId: exactCourseId,
      },
      {
        action: "application.created",
        actorId: registrarSession.userId,
        entityType: "Application",
        entityId: applicationPayload.application.id,
      },
      {
        action: "placement.created",
        actorId: registrarSession.userId,
        entityType: "PlacementTestBooking",
        entityId: placement.id,
      },
      {
        action: "placement.result_recorded",
        actorId: registrarSession.userId,
        entityType: "PlacementTestResult",
        entityId: placementResult.id,
      },
      {
        action: "application.converted",
        actorId: registrarSession.userId,
        entityType: "EnrollmentWorkflow",
        entityId: applicationWorkflow.id,
      },
      {
        action: "student.created",
        actorId: registrarSession.userId,
        entityType: "StudentProfile",
        entityId: activatedStudent.id,
      },
      {
        action: "enrollment.activated",
        actorId: registrarSession.userId,
        entityType: "EnrollmentWorkflow",
        entityId: placementWorkflow.id,
      },
      {
        action: "calendar.created",
        actorId: "usr_branch_demo",
        entityType: "CalendarEvent",
        entityId: calendarResult.event.id,
      },
      {
        action: "assignment.created",
        actorId: assignedTeacher.userId,
        entityType: "Assignment",
        entityId: assignment.id,
      },
      {
        action: "assignment.published",
        actorId: assignedTeacher.userId,
        entityType: "Assignment",
        entityId: assignment.id,
      },
      {
        action: "assignment.submitted",
        actorId: activatedStudentSession.userId,
        entityType: "AssignmentSubmission",
        entityId: submission.id,
      },
      {
        action: "attendance.saved",
        actorId: assignedTeacher.userId,
        entityType: "AttendanceRecord",
        entityId: exactClassGroupId,
      },
      {
        action: "assignment.graded",
        actorId: assignedTeacher.userId,
        entityType: "AssignmentSubmission",
        entityId: submission.id,
      },
    ];
    expect(newAuditRows).toHaveLength(expectedAuditRows.length);
    expect(newAuditRows).toEqual(
      expect.arrayContaining(
        expectedAuditRows.map(item => expect.objectContaining(item))
      )
    );

    expect(
      repositoryEvents.map(({ action, actorId, entityType, entityId }) => ({
        action,
        actorId,
        entityType,
        entityId,
      }))
    ).toEqual(successfulCommands);
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(
      successfulCommands.length
    );
    expect(repository.recordEvent).toHaveBeenCalledTimes(
      successfulCommands.length
    );
    repositoryEvents.forEach(event => {
      const auditAction =
        event.action === "assignment.submit"
          ? "assignment.submitted"
          : event.action;
      expect(adminProjection.auditLogs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: auditAction,
            actorId: event.actorId,
            entityType: event.entityType,
            entityId: event.entityId,
          }),
        ])
      );
      expect(event.payload).toMatchObject({
        request: expect.objectContaining({ actorId: event.actorId }),
        sourcePersistence: "local",
      });
    });

    const newCommunicationRows = adminProjection.communicationLogs.filter(
      item => !initialCommunicationIds.has(item.id)
    );
    expect(newCommunicationRows).toHaveLength(2);
    newCommunicationRows.forEach(item => {
      expect(item).toMatchObject({
        actorId: registrarSession.userId,
        channel: "manual",
        status: "completed",
      });
      expect(item.body).toContain("no external message was sent");
    });
    expect(adminProjection.integrations).toEqual(initialIntegrations);
    expect(
      repositoryEvents.filter(
        item =>
          item.action.startsWith("integration.") ||
          item.action.startsWith("message.") ||
          item.action.startsWith("payment.")
      )
    ).toEqual([]);
    expect(
      newAuditRows.filter(
        item =>
          item.action.startsWith("integration.") ||
          item.action.startsWith("message.") ||
          item.action.startsWith("payment.")
      )
    ).toEqual([]);
  });
});
