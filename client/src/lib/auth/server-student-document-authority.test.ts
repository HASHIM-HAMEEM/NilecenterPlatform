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
import type { PendingMediaAttachment, PlatformState } from "../domain/types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function session(
  role: ServerSession["activeRole"],
  userId: string,
  email: string
): ServerSession {
  return {
    id: `student_document_${role}`,
    userId,
    email,
    name: role,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-12T00:00:00.000Z",
    expiresAt: "2026-07-12T12:00:00.000Z",
  };
}

const registrar = () =>
  session("registrar", "usr_registrar_demo", "registrar.demo@nilelearn.local");
const teacher = () =>
  session("teacher", "usr_teacher_demo", "teacher.demo@nilelearn.local");
const student = () =>
  session("student", "usr_student_demo", "student.demo@nilelearn.local");

function attachment(
  overrides: Partial<PendingMediaAttachment> = {}
): PendingMediaAttachment {
  return {
    id: "pending_passport",
    name: "passport-scan.pdf",
    type: "application/pdf",
    size: 2048,
    kind: "document",
    previewLabel: "Passport scan",
    storageStatus: "pending_storage",
    createdAt: "2026-07-12T08:00:00.000Z",
    ...overrides,
  };
}

function repositoryFor(state: PlatformState): PlatformRepository {
  return {
    readSnapshot: vi.fn(async () => ({
      state,
      persistence: "local" as const,
      syncedAt: "2026-07-12T08:00:00.000Z",
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

function install(state = cloneState()) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return { state, repository };
}

describe("student identity document authority", () => {
  it("parses only bounded metadata for approved identity document kinds", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "student.document.add",
        studentId: "stu_demo",
        documentType: "passport",
        attachment: {
          ...attachment(),
          storageStatus: "stored",
          url: "https://untrusted.example.test/passport.pdf",
          bytes: "must-not-survive",
        },
        actorId: "spoofed-actor",
      })
    ).toEqual({
      type: "student.document.add",
      studentId: "stu_demo",
      documentType: "passport",
      attachment: attachment(),
    });

    expect(
      parsePlatformWorkflowAction({
        type: "student.document.add",
        studentId: "stu_demo",
        documentType: "visa",
        attachment: attachment(),
      })
    ).toBeNull();
  });

  it("adds metadata in registrar scope, audits it, and redacts event evidence", async () => {
    const { repository } = install();
    const output = await applyPlatformWorkflowAction(
      {
        type: "student.document.add",
        studentId: "stu_demo",
        documentType: "passport",
        attachment: attachment(),
      },
      registrar()
    );

    const document = output.state.documents.find(
      item => item.ownerId === "stu_demo" && item.type === "passport"
    );
    expect(document).toMatchObject({
      ownerType: "student",
      status: "pending",
      sensitivity: "restricted_identity",
      fileName: "passport-scan.pdf",
      mimeType: "application/pdf",
      size: 2048,
      storageStatus: "pending_storage",
      createdBy: "usr_registrar_demo",
      url: "",
    });
    expect(output.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "student.document_metadata_added",
        entityId: document?.id,
        actorId: "usr_registrar_demo",
      })
    );
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student.document_metadata_added",
        actorId: "usr_registrar_demo",
        payload: expect.objectContaining({
          redacted: true,
          request: {
            type: "student.document.add",
            actorId: "usr_registrar_demo",
          },
        }),
      })
    );
    expect(
      JSON.stringify(vi.mocked(repository.recordEvent).mock.calls)
    ).not.toContain("passport-scan.pdf");
  });

  it("rejects invalid files, duplicates, unauthorized roles, and out-of-scope students", async () => {
    const first = install();
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "student.document.add",
          studentId: "stu_demo",
          documentType: "profile_photo",
          attachment: attachment(),
        },
        registrar()
      )
    ).rejects.toThrow("profile photos must be image files");
    expect(first.repository.writeSnapshot).not.toHaveBeenCalled();
    restoreRepository?.();

    const second = install();
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "student.document.add",
          studentId: "stu_demo",
          documentType: "passport",
          attachment: attachment({ size: 11 * 1024 * 1024 }),
        },
        registrar()
      )
    ).rejects.toThrow("10 MB or smaller");
    expect(second.repository.writeSnapshot).not.toHaveBeenCalled();
    restoreRepository?.();

    const third = install();
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "student.document.add",
          studentId: "stu_alex_demo",
          documentType: "passport",
          attachment: attachment(),
        },
        registrar()
      )
    ).rejects.toThrow("inside admissions branches");
    expect(third.repository.writeSnapshot).not.toHaveBeenCalled();
    restoreRepository?.();

    const fourth = install();
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "student.document.add",
          studentId: "stu_demo",
          documentType: "passport",
          attachment: attachment(),
        },
        teacher()
      )
    ).rejects.toThrow("cannot run student.document.add");
    expect(fourth.repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("keeps restricted documents and guardian details out of teacher projections", async () => {
    const { state } = install();
    state.students = state.students.map(item =>
      item.id === "stu_demo"
        ? {
            ...item,
            legalName: "Private Legal Name",
            dateOfBirth: "2010-01-01",
            guardianName: "Private Guardian",
            guardianPhone: "+20 100 000 0000",
            notes: "Private admissions note",
          }
        : item
    );
    state.documents.push({
      id: "doc_private_passport",
      ownerId: "stu_demo",
      ownerType: "student",
      title: "passport",
      type: "passport",
      url: "",
      status: "pending",
      sensitivity: "restricted_identity",
      fileName: "private-passport.pdf",
      mimeType: "application/pdf",
      size: 100,
      storageStatus: "pending_storage",
    });

    const teacherState = scopePlatformStateForSession(state, teacher());
    const teacherStudent = teacherState.students.find(
      item => item.id === "stu_demo"
    );
    expect(teacherStudent).not.toHaveProperty("legalName");
    expect(teacherStudent).not.toHaveProperty("dateOfBirth");
    expect(teacherStudent).not.toHaveProperty("guardianName");
    expect(teacherStudent).not.toHaveProperty("guardianPhone");
    expect(teacherStudent).not.toHaveProperty("notes");
    expect(teacherState.documents).not.toContainEqual(
      expect.objectContaining({ id: "doc_private_passport" })
    );

    const studentState = scopePlatformStateForSession(state, student());
    expect(studentState.documents).toContainEqual(
      expect.objectContaining({ id: "doc_private_passport" })
    );
  });
});
