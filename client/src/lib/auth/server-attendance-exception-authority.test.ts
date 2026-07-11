import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function session(
  activeRole: ServerSession["activeRole"],
  userId: string
): ServerSession {
  return {
    id: `attendance_exception_${activeRole}_${userId}`,
    userId,
    email: `${activeRole}@nilelearn.local`,
    name: activeRole,
    roles: [activeRole],
    activeRole,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-11T23:59:00.000Z",
  };
}

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

describe("server attendance-exception authority", () => {
  it("derives the student identity and projects the submitted request safely", async () => {
    const state = cloneState();
    const repository = install(state);
    const student = session("student", "usr_student_demo");
    const output = await applyPlatformWorkflowAction(
      {
        type: "attendance.exception.submit",
        attendanceRecordId: "att_ar_online_absence",
        reason: "Medical appointment prevented attendance.",
        studentId: "stu_cairo_demo",
        actorId: "spoofed_actor",
      },
      student
    );
    const request = output.state.attendanceExceptions.find(
      item => item.attendanceRecordId === "att_ar_online_absence"
    );

    expect(request).toMatchObject({ studentId: "stu_demo", status: "pending" });
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "attendance_exception.submitted",
        actorId: "usr_student_demo",
        entityId: request?.id,
      })
    );
    const projection = scopePlatformStateForSession(output.state, student);
    expect(projection.attendanceExceptions).toContainEqual(
      expect.objectContaining({ id: request?.id, studentId: "stu_demo" })
    );
    expect(projection.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "attendance_exception.submitted",
        entityId: request?.id,
      })
    );
  });

  it("lets a branch admin approve only requests inside branch scope", async () => {
    const state = cloneState();
    const repository = install(state);
    const branch = session("branchadmin", "usr_branch_demo");
    const output = await applyPlatformWorkflowAction(
      {
        type: "attendance.exception.review",
        requestId: "aex_cairo_pending",
        decision: "approved",
        reviewNote: "Branch evidence verified.",
      },
      branch
    );
    expect(
      output.state.attendanceExceptions.find(
        item => item.id === "aex_cairo_pending"
      )
    ).toMatchObject({ status: "approved", reviewedBy: "usr_branch_demo" });
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    const branchProjection = scopePlatformStateForSession(output.state, branch);
    expect(branchProjection.auditLogs).toContainEqual(
      expect.objectContaining({ action: "attendance_exception.approved" })
    );
    const studentProjection = scopePlatformStateForSession(
      output.state,
      session("student", "usr_student_cairo_demo")
    );
    expect(studentProjection.notifications).toContainEqual(
      expect.objectContaining({ title: "Attendance exception approved" })
    );
  });

  it("rejects out-of-scope branch and non-reviewer role attempts without persistence", async () => {
    const state = cloneState();
    state.attendanceExceptions.push({
      id: "aex_alex_pending",
      attendanceRecordId: "att_ar_l1_alex_1",
      studentId: "stu_alex_demo",
      classGroupId: "class_ar_l1_alex",
      sessionId: "session_ar_l1_alex",
      reason: "Transport disruption caused a late arrival.",
      status: "pending",
      submittedAt: "2026-07-11T10:00:00.000Z",
    });
    const before = JSON.parse(JSON.stringify(state)) as PlatformState;
    const repository = install(state);
    const action = {
      type: "attendance.exception.review" as const,
      requestId: "aex_alex_pending",
      decision: "approved" as const,
      reviewNote: "Attempt outside branch scope.",
    };

    await expect(
      applyPlatformWorkflowAction(
        action,
        session("branchadmin", "usr_branch_demo")
      )
    ).rejects.toThrow(
      "Branch admin can only review attendance exceptions in their branch."
    );
    await expect(
      applyPlatformWorkflowAction(
        action,
        session("teacher", "usr_teacher_alex_demo")
      )
    ).rejects.toThrow("Role teacher cannot run attendance.exception.review.");
    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("parses complete exception commands only", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "attendance.exception.submit",
        attendanceRecordId: "att_ar_online_absence",
        reason: "Medical appointment prevented attendance.",
      })
    ).toMatchObject({
      type: "attendance.exception.submit",
      attendanceRecordId: "att_ar_online_absence",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "attendance.exception.review",
        requestId: "aex_cairo_pending",
        decision: "approved",
        reviewNote: "no",
      })
    ).toBeNull();
  });
});
