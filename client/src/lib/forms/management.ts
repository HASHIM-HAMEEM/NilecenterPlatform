import type { Role } from "@/lib/platformData";
import type { FormDefinition } from "@shared/nileForms";

export const formCategoryLabels: Record<FormDefinition["category"], string> = {
  admissions: "Admissions",
  student_support: "Student support",
  attendance: "Attendance",
  consent: "Consent",
  branch_operations: "Branch operations",
};

export function formCategoriesForRole(
  role: Role
): FormDefinition["category"][] {
  if (role === "registrar") return ["admissions"];
  if (role === "headofdepartment") return ["consent", "attendance"];
  if (role === "branchadmin") {
    return ["branch_operations", "attendance", "consent"];
  }
  return [
    "admissions",
    "student_support",
    "attendance",
    "consent",
    "branch_operations",
  ];
}
