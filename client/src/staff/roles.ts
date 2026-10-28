import type { NccRole } from "@/lib/backend/api";
import { copy } from "./copy";

/** Lower-privilege ordering shared with the EMS backend. */
export const ROLE_ORDER: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];

export const ROLE_LABELS: Record<NccRole, string> = copy.roles;

export function roleLabel(role: NccRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function isBranchOperator(role: NccRole | null | undefined): boolean {
  return role === "branch_admin" || role === "vice_manager";
}

/** Leads, placement tests, and trial lessons. Registrar yes, SSA no. */
export function isAdmissionsRole(role: NccRole | null | undefined): boolean {
  return (
    role === "super_admin" ||
    isBranchOperator(role) ||
    role === "registrar"
  );
}

/** Student catalogue readers. Registrar is view-only. */
export function canReadStudents(role: NccRole | null | undefined): boolean {
  return isAdmissionsRole(role) || role === "ssa";
}

/** Student and enrolment writers. Registrar cannot write. */
export function canManageStudents(role: NccRole | null | undefined): boolean {
  return (
    role === "super_admin" || isBranchOperator(role) || role === "ssa"
  );
}

/** Class catalogue writers. SSA yes, Registrar no. */
export function isClassCatalogWriter(
  role: NccRole | null | undefined
): boolean {
  return canManageStudents(role);
}

/** Class session writers (propose, create, edit, cancel). */
export function canManageSessions(
  role: NccRole | null | undefined
): boolean {
  return canManageStudents(role);
}

/** Room catalogue writers. Registrar yes, SSA no. */
export function isRoomCatalogWriter(
  role: NccRole | null | undefined
): boolean {
  return isAdmissionsRole(role);
}

/** Who may set/clear assigned_ssa_id in the UI (matches backend). */
export function canSetAssignee(role: NccRole | null | undefined): boolean {
  return isAdmissionsRole(role);
}

/** Who may set the SSA on the student a lead conversion creates. */
export function canSetLeadAssignee(
  role: NccRole | null | undefined
): boolean {
  return canSetAssignee(role) && role !== "registrar";
}

export function isStaffManager(role: NccRole | null | undefined): boolean {
  return role === "super_admin" || isBranchOperator(role);
}

/** Global audit streams (auth, catalogs). Vice manager reads branch only. */
export function canReadGlobalAuditStreams(
  role: NccRole | null | undefined
): boolean {
  return role === "super_admin" || role === "branch_admin";
}

const BRANCH_ADMIN_MANAGEABLE: readonly NccRole[] = [
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];
const VICE_MANAGER_MANAGEABLE: readonly NccRole[] = [
  "hod",
  "registrar",
  "ssa",
  "teacher",
];

/** Edit, reset, disable, enable and invite on another staff account. */
export function canManageStaffTarget(
  assigned: NccRole | null | undefined,
  target: NccRole
): boolean {
  if (assigned === "super_admin") return true;
  if (assigned === "branch_admin")
    return BRANCH_ADMIN_MANAGEABLE.includes(target);
  if (assigned === "vice_manager")
    return VICE_MANAGER_MANAGEABLE.includes(target);
  return false;
}

/** Roles EMS allows to read the branch directory (HOD and teacher get 403). */
export function canReadBranches(role: NccRole | null | undefined): boolean {
  return canReadStudents(role);
}

/** Roles EMS allows to read the department directory (everyone else gets 403). */
export function canReadDepartments(role: NccRole | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * Roles whose BFF staff-directory reads succeed (registrar, ssa, hod and
 * teacher get 403 on /directory/users).
 */
export function canReadStaffDirectory(
  role: NccRole | null | undefined
): boolean {
  return isStaffManager(role);
}

/** Roles that must choose a workspace branch before operating. */
export function needsWorkspaceBranch(
  role: NccRole | null | undefined
): boolean {
  return isBranchOperator(role) || role === "registrar" || role === "ssa";
}

/** Roles that may switch into a strictly lower-privileged view. */
export function canSwitchRoles(
  assigned: NccRole | null | undefined
): boolean {
  return (
    assigned === "super_admin" ||
    assigned === "branch_admin" ||
    assigned === "vice_manager" ||
    assigned === "hod"
  );
}

/** SSA may mutate only records assigned to the signed-in staff user. */
export function canMutateAssignedRecord(
  role: NccRole | null | undefined,
  actorId: string | null | undefined,
  assignedStaffId: string | null | undefined
): boolean {
  if (role !== "ssa") return true;
  return Boolean(actorId && assignedStaffId && actorId === assignedStaffId);
}
