import { describe, expect, it } from "vitest";
import { canSendMessageToUser, getMessageRecipientScope } from "./messageScope";
import { seedPlatformState } from "./seed";
import type { PlatformState } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

describe("message relationship scope", () => {
  it("limits teachers to active assigned learners and approved staff contacts", () => {
    const state = cloneState();

    expect(
      canSendMessageToUser(
        state,
        "teacher",
        "usr_teacher_demo",
        "usr_student_demo"
      )
    ).toBe(true);
    expect(
      canSendMessageToUser(
        state,
        "teacher",
        "usr_teacher_demo",
        "usr_student_alex_demo"
      )
    ).toBe(false);

    state.enrollments = state.enrollments.map(enrollment =>
      enrollment.studentId === "stu_demo"
        ? { ...enrollment, status: "paused" }
        : enrollment
    );
    expect(
      canSendMessageToUser(
        state,
        "teacher",
        "usr_teacher_demo",
        "usr_student_demo"
      )
    ).toBe(false);
  });

  it("uses explicit registrar and branch staff-profile grants", () => {
    const state = cloneState();
    state.staffProfiles = state.staffProfiles.map(profile =>
      profile.id === "staff_registrar_demo"
        ? { ...profile, branchIds: ["br_cairo"] }
        : profile
    );

    expect(
      canSendMessageToUser(
        state,
        "registrar",
        "usr_registrar_demo",
        "usr_student_cairo_demo"
      )
    ).toBe(true);
    expect(
      canSendMessageToUser(
        state,
        "registrar",
        "usr_registrar_demo",
        "usr_student_demo"
      )
    ).toBe(false);
    expect(
      canSendMessageToUser(
        state,
        "branchadmin",
        "usr_branch_demo",
        "usr_student_cairo_demo"
      )
    ).toBe(true);
    expect(
      canSendMessageToUser(
        state,
        "branchadmin",
        "usr_branch_demo",
        "usr_student_alex_demo"
      )
    ).toBe(false);
  });

  it("uses a staff member's full active branch scope for local contacts", () => {
    const state = cloneState();

    expect(
      canSendMessageToUser(
        state,
        "branchadmin",
        "usr_branch_demo",
        "usr_teacher_demo"
      )
    ).toBe(true);

    state.users.find(item => item.id === "usr_teacher_demo")!.branchId =
      "br_alex";
    expect(
      canSendMessageToUser(
        state,
        "registrar",
        "usr_registrar_demo",
        "usr_teacher_demo"
      )
    ).toBe(true);
  });

  it("never exposes paused recipient accounts", () => {
    const state = cloneState();
    state.users.find(item => item.id === "usr_student_demo")!.status = "paused";

    const scope = getMessageRecipientScope(
      state,
      "superadmin",
      "usr_admin_demo"
    );
    expect(scope.visibleUserIds.has("usr_student_demo")).toBe(false);
    expect(scope.sendableUserIds.has("usr_student_demo")).toBe(false);
  });
});
