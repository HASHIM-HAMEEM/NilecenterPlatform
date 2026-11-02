import type { NccRole } from "@/lib/backend/api";
import {
  ROLE_ORDER,
  canManageSessions,
  canManageStudents,
  canReadStudents,
  canSetAssignee,
  canSwitchRoles,
  isClassCatalogWriter,
  isRoomCatalogWriter,
} from "../roles";
import { BRANCH_PICKER, CLASS_READ, REPORT_READ, ADMISSIONS } from "../nav";

export type GuideStepDef = {
  /** Optional in-app route the step links to with "Open page". */
  href?: string;
};

export type GuideScenario = {
  id: string;
  roles: NccRole[];
  steps: GuideStepDef[];
  noteCount: number;
};

export type GuideCategory = {
  id: string;
  scenarios: GuideScenario[];
};

const ALL: NccRole[] = [...ROLE_ORDER];
const SA: NccRole[] = ["super_admin"];
const forGate = (gate: (role: NccRole) => boolean): NccRole[] =>
  ROLE_ORDER.filter(role => gate(role));
/** Staff writes that canManageStaffTarget allows for SA, BA and VM. */
const STAFF_MANAGE: NccRole[] = ["super_admin", "branch_admin", "vice_manager"];
const FORM_MANAGE: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
];

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: "access",
    scenarios: [
      {
        id: "manage-own-profile",
        roles: ALL,
        steps: [{ href: "/app/profile" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "act-as-a-lower-role",
        roles: forGate(canSwitchRoles),
        steps: [{ href: "/app/dashboard" }, {}, {}],
        noteCount: 2,
      },
      {
        id: "switch-branch-workspace",
        roles: BRANCH_PICKER.filter(role => role !== "super_admin"),
        steps: [{}, {}, { href: "/app/dashboard" }],
        noteCount: 1,
      },
      {
        id: "read-notifications",
        roles: ALL,
        steps: [{ href: "/app/notifications" }, {}, {}],
        noteCount: 0,
      },
    ],
  },
  {
    id: "setup",
    scenarios: [
      {
        id: "add-a-branch",
        roles: SA,
        steps: [{ href: "/app/branches" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "add-a-department",
        roles: SA,
        steps: [{ href: "/app/departments" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "manage-action-reasons",
        roles: SA,
        steps: [{ href: "/app/action-reasons" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "set-up-areas-of-study",
        roles: SA,
        steps: [{ href: "/app/areas-of-study" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "add-a-custom-field",
        roles: SA,
        steps: [{ href: "/app/custom-fields" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "connect-moodle",
        roles: SA,
        steps: [{ href: "/app/moodle" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "link-a-course",
        roles: SA,
        steps: [{ href: "/app/courses" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "check-system-health",
        roles: SA,
        steps: [{ href: "/app/system" }, {}],
        noteCount: 0,
      },
    ],
  },
  {
    id: "jotform",
    scenarios: [
      {
        id: "register-a-form",
        roles: SA,
        steps: [{ href: "/app/jotform" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "map-form-fields",
        roles: SA,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "receive-a-submission",
        roles: SA,
        steps: [{}, {}],
        noteCount: 1,
      },
      {
        id: "read-a-submission",
        roles: SA,
        steps: [{}, {}],
        noteCount: 0,
      },
    ],
  },
  {
    id: "staff",
    scenarios: [
      {
        id: "invite-staff",
        roles: STAFF_MANAGE,
        steps: [{ href: "/app/staff" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "edit-staff",
        roles: STAFF_MANAGE,
        steps: [{}, {}, {}],
        noteCount: 2,
      },
      {
        id: "reset-or-disable-staff",
        roles: STAFF_MANAGE,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "bind-staff-moodle",
        roles: STAFF_MANAGE,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "set-up-a-teacher",
        roles: STAFF_MANAGE,
        steps: [{}, {}, {}],
        noteCount: 2,
      },
    ],
  },
  {
    id: "leads",
    scenarios: [
      {
        id: "add-a-lead",
        roles: ADMISSIONS,
        steps: [{ href: "/app/leads" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "work-a-lead",
        roles: ADMISSIONS,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "use-the-pipeline-board",
        roles: ADMISSIONS,
        steps: [{ href: "/app/leads?view=board" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "manage-lead-groups",
        roles: ADMISSIONS,
        steps: [{}, {}, {}],
        noteCount: 0,
      },
      {
        id: "mark-a-lead-lost",
        roles: ADMISSIONS,
        steps: [{}, {}, {}],
        noteCount: 2,
      },
      {
        id: "check-for-duplicates",
        roles: ADMISSIONS,
        steps: [{}, {}],
        noteCount: 1,
      },
      {
        id: "convert-a-lead",
        roles: ADMISSIONS,
        steps: [{}, {}, {}, {}],
        noteCount: 2,
      },
    ],
  },
  {
    id: "bookings",
    scenarios: [
      {
        id: "schedule-a-placement-test",
        roles: ADMISSIONS,
        steps: [{ href: "/app/placement-tests" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "schedule-review-placement",
        roles: ADMISSIONS,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "record-a-placement-result",
        roles: ADMISSIONS,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "change-a-placement-test",
        roles: ADMISSIONS,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "schedule-a-trial-lesson",
        roles: ADMISSIONS,
        steps: [{ href: "/app/trial-lessons" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "schedule-review-trial",
        roles: ADMISSIONS,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "record-a-trial-result",
        roles: ADMISSIONS,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "work-the-review-queue",
        roles: ADMISSIONS,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
    ],
  },
  {
    id: "students",
    scenarios: [
      {
        id: "add-a-student",
        roles: forGate(canManageStudents),
        steps: [{ href: "/app/students" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "assign-an-ssa",
        roles: forGate(role => canSetAssignee(role) && canManageStudents(role)),
        steps: [{}, {}],
        noteCount: 1,
      },
      {
        id: "read-student-progress",
        roles: forGate(canReadStudents),
        steps: [{}, {}, {}],
        noteCount: 0,
      },
      {
        id: "add-a-document",
        roles: forGate(canReadStudents),
        steps: [{}, {}, {}],
        noteCount: 2,
      },
      {
        id: "disable-a-student",
        roles: forGate(canManageStudents),
        steps: [{}, {}, {}],
        noteCount: 2,
      },
    ],
  },
  {
    id: "enrolments",
    scenarios: [
      {
        id: "sell-a-course",
        roles: forGate(canManageStudents),
        steps: [{ href: "/app/enrolments" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "record-a-payment",
        roles: forGate(canManageStudents),
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "place-in-a-class",
        roles: forGate(canManageStudents),
        steps: [{}, {}, {}],
        noteCount: 2,
      },
      {
        id: "mark-left-or-cancel",
        roles: forGate(canManageStudents),
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "complete-a-level",
        roles: forGate(canManageStudents),
        steps: [{}, {}],
        noteCount: 1,
      },
    ],
  },
  {
    id: "classes",
    scenarios: [
      {
        id: "create-a-class",
        roles: forGate(isClassCatalogWriter),
        steps: [{ href: "/app/classes" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "bind-moodle-group",
        roles: forGate(isClassCatalogWriter),
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "propose-sessions",
        roles: forGate(canManageSessions),
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "change-a-session",
        roles: forGate(canManageSessions),
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "mark-attendance",
        roles: CLASS_READ,
        steps: [{}, {}],
        noteCount: 1,
      },
      {
        id: "read-roster-and-grades",
        roles: CLASS_READ,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "plan-my-week",
        roles: ["teacher"],
        steps: [{}, {}, {}],
        noteCount: 0,
      },
    ],
  },
  {
    id: "rooms",
    scenarios: [
      {
        id: "add-a-room",
        roles: forGate(isRoomCatalogWriter),
        steps: [{ href: "/app/rooms" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "set-room-availability",
        roles: forGate(canManageSessions),
        steps: [{}, {}, {}],
        noteCount: 1,
      },
    ],
  },
  {
    id: "forms",
    scenarios: [
      {
        id: "build-a-form",
        roles: FORM_MANAGE,
        steps: [{ href: "/app/forms" }, {}, {}],
        noteCount: 0,
      },
      {
        id: "publish-a-form",
        roles: FORM_MANAGE,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "review-a-response",
        roles: FORM_MANAGE,
        steps: [{}, {}],
        noteCount: 0,
      },
      {
        id: "create-a-lead-from-a-response",
        roles: ADMISSIONS,
        steps: [{}, {}, {}],
        noteCount: 1,
      },
      {
        id: "import-from-jotform",
        roles: SA,
        steps: [{}, {}],
        noteCount: 0,
      },
    ],
  },
  {
    id: "reports",
    scenarios: [
      {
        id: "read-reports",
        roles: REPORT_READ,
        steps: [{ href: "/app/reports" }, {}, {}],
        noteCount: 1,
      },
      {
        id: "export-a-report",
        roles: REPORT_READ,
        steps: [{}, {}],
        noteCount: 1,
      },
    ],
  },
];

export const guideScenarioById = (id: string) => {
  for (const category of GUIDE_CATEGORIES)
    for (const scenario of category.scenarios)
      if (scenario.id === id) return { category, scenario };
  return null;
};
