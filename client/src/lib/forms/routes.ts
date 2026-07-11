import type { Role } from "@/lib/platformData";

export function roleAppPrefix(role: Role) {
  if (role === "headofdepartment") return "/app/hod";
  if (role === "branchadmin") return "/app/branch";
  if (role === "superadmin") return "/app/admin";
  return `/app/${role}`;
}

export function formsRoute(role: Role, suffix = "") {
  return `${roleAppPrefix(role)}/forms${suffix}`;
}

export function canManageForms(role: Role) {
  return [
    "registrar",
    "headofdepartment",
    "branchadmin",
    "superadmin",
  ].includes(role);
}

export function canUseOfflineForms(role: Role) {
  return role !== "student";
}
