import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import { scopePlatformStateForSession } from "../../../../server/routes";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

function cloneState(state: PlatformState = seedPlatformState) {
  return JSON.parse(JSON.stringify(state)) as PlatformState;
}

function session(
  role: ServerSession["activeRole"],
  userId: string,
  email: string
): ServerSession {
  return {
    id: `roster_${role}`,
    userId,
    email,
    name: role,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-11T12:00:00.000Z",
  };
}

const registrar = () => session("registrar", "usr_registrar_demo", "registrar.demo@nilelearn.local");
const branchAdmin = () => session("branchadmin", "usr_branch_demo", "branch.demo@nilelearn.local");
const teacher = () => session("teacher", "usr_teacher_demo", "teacher.demo@nilelearn.local");
const cairoStudent = () => session("student", "usr_student_cairo_demo", "cairo.student.demo@nilelearn.local");

function repositoryFor(state: PlatformState): PlatformRepository {
  return {
    readSnapshot: vi.fn(async () => ({
      state,
      persistence: "local" as const,
      syncedAt: "2026-07-11T00:00:00.000Z",
    })),
    writeSnapshot: vi.fn(async () => "local" as const),
    recordEvent: vi.fn(async () => undefined),
  };
}

let restoreRepository: (() => void) | undefined;

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
});

function install(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

function addTargetClass(state: PlatformState) {
  state.classGroups.push({
    id: "class_ar_l3_cairo_transfer_qa",
    courseRunId: "run_ar_l3_cairo_2026",
    name: "Cairo Transfer Class",
    capacity: 12,
    schedule: "Wed 18:00",
    roomId: "room_cairo_4",
    studentIds: [],
    status: "active",
  });
}

describe("server enrollment and roster authority", () => {
  it("persists a registrar-scoped transfer and projects it consistently", async () => {
    const state = cloneState();
    addTargetClass(state);
    const repository = install(state);
    const output = await applyPlatformWorkflowAction(
      {
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        reason: "Schedule moved",
      },
      registrar()
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "enrollment.transferred",
        entityType: "Enrollment",
        entityId: "enr_ar_l3_cairo",
        actorId: "usr_registrar_demo",
      })
    );
    const registrarState = scopePlatformStateForSession(output.state, registrar());
    const teacherState = scopePlatformStateForSession(output.state, teacher());
    const studentState = scopePlatformStateForSession(output.state, cairoStudent());
    for (const scoped of [registrarState, teacherState, studentState]) {
      expect(scoped.enrollments.find(item => item.id === "enr_ar_l3_cairo")).toMatchObject({
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        teacherId: "usr_teacher_demo",
      });
      expect(
        scoped.classGroups.find(item => item.id === "class_ar_l3_cairo_transfer_qa")?.studentIds
      ).toContain("stu_cairo_demo");
    }
    expect(registrarState.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "enrollment.transferred",
        entityId: "enr_ar_l3_cairo",
      })
    );
  });

  it("rejects registrar transfer when the source enrollment is outside branch scope", async () => {
    const state = cloneState();
    state.classGroups.push({
      id: "class_ar_l1_alex_transfer",
      courseRunId: "run_ar_l1_alex_2026",
      name: "Alex Transfer Class",
      capacity: 12,
      schedule: "Tue 18:00",
      roomId: "room_alex_2",
      studentIds: [],
      status: "active",
    });
    const before = cloneState(state);
    const repository = install(state);
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "enrollment.transfer",
          enrollmentId: "enr_ar_l1_alex",
          classGroupId: "class_ar_l1_alex_transfer",
          reason: "Out of scope",
        },
        registrar()
      )
    ).rejects.toThrow("Registrar can only manage enrollments inside admissions branches.");
    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("does not grant branch admins registrar enrollment mutations", async () => {
    const state = cloneState();
    addTargetClass(state);
    install(state);
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "enrollment.transfer",
          enrollmentId: "enr_ar_l3_cairo",
          classGroupId: "class_ar_l3_cairo_transfer_qa",
          reason: "Unauthorized",
        },
        branchAdmin()
      )
    ).rejects.toThrow("Role branchadmin cannot run enrollment.transfer.");
  });

  it("parses exact transfer and status commands and rejects incomplete payloads", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        reason: "Schedule moved",
      })
    ).toEqual({
      type: "enrollment.transfer",
      enrollmentId: "enr_ar_l3_cairo",
      classGroupId: "class_ar_l3_cairo_transfer_qa",
      reason: "Schedule moved",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.status.update",
        enrollmentId: "enr_ar_l3_cairo",
        status: "paused",
        reason: "Travel",
      })
    ).toEqual({
      type: "enrollment.status.update",
      enrollmentId: "enr_ar_l3_cairo",
      status: "paused",
      reason: "Travel",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
      })
    ).toBeNull();
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.status.update",
        enrollmentId: "enr_ar_l3_cairo",
        status: "paused",
      })
    ).toBeNull();
  });
});
