import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import { executeNileFormPromotion } from "../../../../server/nileFormsPromotionAdapters";
import {
  setPlatformStateRepository,
  type PlatformRepository,
} from "../../../../server/platformRepository";
import type { FormSubmission } from "@shared/nileForms";
import { seedPlatformState } from "@/lib/domain/seed";
import type { PlatformState } from "@/lib/domain/types";

const registrar: ServerSession = {
  id: "session_registrar_promotion",
  userId: "usr_registrar_demo",
  email: "registrar.demo@nilelearn.local",
  name: "Registrar Demo",
  roles: ["registrar"],
  activeRole: "registrar",
  provider: "demo",
  authorizationModel: "snapshot",
  branchIds: ["br_cairo"],
  createdAt: "2026-07-11T12:00:00.000Z",
  expiresAt: "2026-07-12T00:00:00.000Z",
};

let state: PlatformState;
let restoreRepository: (() => void) | undefined;

function submission(
  id: string,
  definitionId: string,
  answers: Record<string, unknown>,
  respondentUserId?: string
): FormSubmission {
  return {
    id,
    definitionId,
    publicationId: `publication_${definitionId}_1`,
    versionId: `version_${definitionId}_1`,
    branchId: "br_cairo",
    respondentUserId,
    source: "web",
    answers,
    status: "accepted",
    revision: 3,
    clientSubmissionId: `client_${id}`,
    submittedAt: "2026-07-11T15:00:00.000Z",
    updatedAt: "2026-07-11T15:00:00.000Z",
  };
}

beforeEach(() => {
  state = structuredClone(seedPlatformState);
  const repository: PlatformRepository = {
    async readSnapshot() {
      return {
        state: structuredClone(state),
        persistence: "local",
        syncedAt: "2026-07-11T15:00:00.000Z",
      };
    },
    async writeSnapshot(next) {
      state = structuredClone(next);
      return "local";
    },
    async recordEvent() {},
  };
  restoreRepository = setPlatformStateRepository(repository);
});

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
});

describe("Nile Forms promotion adapters", () => {
  it("replays lead and application promotions from a stable source key", async () => {
    const leadSubmission = submission(
      "form_submission_lead_replay",
      "form_enquiry",
      {
        full_name: "Replay Lead",
        email: "replay-lead@example.test",
        phone: "+20 100 000 0099",
        course_interest: "arabic",
      }
    );
    const firstLead = await executeNileFormPromotion(
      "lead.create",
      leadSubmission,
      registrar
    );
    const replayedLead = await executeNileFormPromotion(
      "lead.create",
      leadSubmission,
      registrar
    );

    expect(replayedLead).toEqual(firstLead);
    expect(
      state.leads.filter(item => item.email === "replay-lead@example.test")
    ).toHaveLength(1);

    const applicationSubmission = submission(
      "form_submission_application_replay",
      "form_application",
      {
        full_name: "Replay Applicant",
        email: "replay-application@example.test",
        phone: "+20 100 000 0088",
        preferred_branch: "br_cairo",
        course_interest: "arabic",
        schedule_preference: "Weekday evenings",
        goals: "Build a complete Arabic learning pathway.",
      }
    );
    const firstApplication = await executeNileFormPromotion(
      "application.create",
      applicationSubmission,
      registrar
    );
    const replayedApplication = await executeNileFormPromotion(
      "application.create",
      applicationSubmission,
      registrar
    );

    expect(replayedApplication).toEqual(firstApplication);
    expect(
      state.leads.filter(
        item => item.email === "replay-application@example.test"
      )
    ).toHaveLength(1);
    expect(
      state.applications.filter(item => item.id === firstApplication.entityId)
    ).toHaveLength(1);
    expect(
      state.auditLogs.filter(
        item =>
          item.sourceKey ===
          `nile_form:application.create:${applicationSubmission.id}`
      )
    ).toHaveLength(1);
  });

  it("replays placement, support, and attendance promotions", async () => {
    const placementSubmission = submission(
      "form_submission_placement_replay",
      "form_placement",
      {
        full_name: "Replay Placement",
        email: "replay-placement@example.test",
        phone: "+20 100 000 0077",
        course_interest: "arabic",
        preferred_date: "2026-07-20",
        current_level: "beginner",
      }
    );
    const firstPlacement = await executeNileFormPromotion(
      "placement.create",
      placementSubmission,
      registrar
    );
    const replayedPlacement = await executeNileFormPromotion(
      "placement.create",
      placementSubmission,
      registrar
    );

    expect(replayedPlacement).toEqual(firstPlacement);
    expect(
      state.placementTests.filter(
        item =>
          item.sourceKey ===
          `nile_form:placement.create:${placementSubmission.id}`
      )
    ).toHaveLength(1);

    const supportSubmission = submission(
      "form_submission_support_replay",
      "form_support",
      {
        subject: "Lesson access",
        details: "I cannot open the next assigned Arabic lesson today.",
        category: "learning",
        urgent: false,
      },
      "usr_student_demo"
    );
    const firstSupport = await executeNileFormPromotion(
      "support_ticket.create",
      supportSubmission,
      registrar
    );
    const replayedSupport = await executeNileFormPromotion(
      "support_ticket.create",
      supportSubmission,
      registrar
    );

    expect(replayedSupport).toEqual(firstSupport);
    expect(
      state.supportTickets.filter(
        item =>
          item.sourceKey ===
          `nile_form:support_ticket.create:${supportSubmission.id}`
      )
    ).toHaveLength(1);

    const attendanceSubmission = submission(
      "form_submission_attendance_replay",
      "form_attendance_exception",
      {
        attendance_record: "att_ar_online_absence",
        reason: "A documented emergency prevented attendance that day.",
      },
      "usr_student_demo"
    );
    const firstAttendance = await executeNileFormPromotion(
      "attendance_exception.create",
      attendanceSubmission,
      registrar
    );
    const replayedAttendance = await executeNileFormPromotion(
      "attendance_exception.create",
      attendanceSubmission,
      registrar
    );

    expect(replayedAttendance).toEqual(firstAttendance);
    expect(
      state.attendanceExceptions.filter(
        item =>
          item.sourceKey ===
          `nile_form:attendance_exception.create:${attendanceSubmission.id}`
      )
    ).toHaveLength(1);
  });
});
