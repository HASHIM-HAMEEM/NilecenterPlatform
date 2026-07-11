import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, X } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import {
  roleMeta,
  roleOrder,
  rolePermissions,
  type Permission,
  type Role,
} from "@/lib/platformData";

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  courses: "Courses",
  classes: "Classes",
  rooms: "Rooms",
  schedule: "Schedule",
  students: "Students",
  teachers: "Teachers",
  attendance: "Attendance",
  assessments: "Assessments",
  payments: "Payments",
  certificates: "Certificates",
  settings: "Settings",
  reports: "Reports",
  messages: "Messages",
  audit: "Activity",
};

function formatPermission(permission: Permission) {
  return permission
    .split(":")
    .map(part => part.replace(/_/g, " "))
    .join(" / ");
}

function permissionModule(permission: Permission) {
  return permission.split(":")[0] ?? "other";
}

function permissionTestId(role: Role, permission: Permission) {
  return `permission-toggle-${role}-${permission.replace(/[:_]/g, "-")}`;
}

function getAllPermissions(statePermissions: Record<Role, Permission[]>) {
  return Array.from(
    new Set([
      ...Object.values(rolePermissions).flat(),
      ...Object.values(statePermissions).flat(),
    ])
  ).sort((a, b) => a.localeCompare(b)) as Permission[];
}

export default function AdminPermissionsPage() {
  const [version, setVersion] = useState(0);
  const [selectedRole, setSelectedRole] = useState<Role>("teacher");
  const [selectedModule, setSelectedModule] = useState("payments");
  const [savingPermission, setSavingPermission] = useState<Permission | null>(
    null
  );
  const [result, setResult] = useState<{
    tone: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const allPermissions = useMemo(
    () => getAllPermissions(state.permissions),
    [state.permissions]
  );
  const modules = useMemo(
    () =>
      Array.from(new Set(allPermissions.map(permissionModule))).sort((a, b) =>
        (moduleLabels[a] ?? a).localeCompare(moduleLabels[b] ?? b)
      ),
    [allPermissions]
  );
  const filteredPermissions = allPermissions.filter(
    permission =>
      selectedModule === "all" ||
      permissionModule(permission) === selectedModule
  );
  const selectedRolePermissions = state.permissions[selectedRole] ?? [];
  const grantedCount = filteredPermissions.filter(permission =>
    selectedRolePermissions.includes(permission)
  ).length;
  const togglePermission = async (permission: Permission) => {
    if (savingPermission) return;
    const currentlyGranted = selectedRolePermissions.includes(permission);
    const nextGranted = !currentlyGranted;
    setSavingPermission(permission);
    setResult(null);
    const response = await runPlatformWorkflowActionRequest({
      type: "permission.update",
      role: selectedRole,
      permission,
      granted: nextGranted,
    });
    setSavingPermission(null);
    if (!response.ok || !response.data) {
      setResult({
        tone: "error",
        title: "Access rule was not saved",
        detail: response.error ?? "Try again or review your session.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    setResult({
      tone: "success",
      title: "Access rule saved",
      detail: `${roleMeta[selectedRole].label} ${nextGranted ? "can now use" : "can no longer use"} ${formatPermission(permission)}.`,
    });
  };

  return (
    <PlatformShell role="superadmin" title="Roles & access">
      <WorkspaceLayout
        className="admin-permissions-page"
        title="Roles & access"
        description="Review and update the access rules for one role at a time."
        context="Admin"
        main={
          <section
            className="admin-permissions-workspace"
            data-testid="admin-permissions-page"
          >
            <div
              className="admin-permissions-heading"
              data-testid="access-rules-section"
            >
              <span>
                <KeyRound size={15} />
                Access rules
              </span>
              <strong>{roleMeta[selectedRole].label}</strong>
              <p>
                Choose a role and area, then switch only the rules that need to
                change.
              </p>
            </div>

            <div className="admin-compact-toolbar admin-permissions-toolbar">
              <label>
                Role
                <select
                  value={selectedRole}
                  data-testid="permission-role-filter"
                  onChange={event => {
                    setSelectedRole(event.target.value as Role);
                    setResult(null);
                  }}
                >
                  {roleOrder.map(role => (
                    <option key={role} value={role}>
                      {roleMeta[role].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Area
                <select
                  value={selectedModule}
                  data-testid="permission-module-filter"
                  onChange={event => {
                    setSelectedModule(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="all">All areas</option>
                  {modules.map(module => (
                    <option key={module} value={module}>
                      {moduleLabels[module] ?? module}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-permissions-count">
                <span>Allowed</span>
                <strong>
                  {grantedCount}/{filteredPermissions.length}
                </strong>
              </div>
            </div>

            {result ? (
              <div
                className={`admin-permissions-result ${result.tone}`}
                data-testid="permission-result"
                role={result.tone === "error" ? "alert" : "status"}
              >
                <strong>{result.title}</strong>
                <span>{result.detail}</span>
              </div>
            ) : null}

            <div
              className="admin-permission-grid"
              data-testid={`permission-group-${selectedModule}`}
              aria-busy={Boolean(savingPermission)}
            >
              {filteredPermissions.map(permission => {
                const granted = selectedRolePermissions.includes(permission);
                const saving = savingPermission === permission;
                return (
                  <button
                    key={permission}
                    type="button"
                    className={`admin-permission-toggle ${granted ? "granted" : ""}`}
                    data-testid={permissionTestId(selectedRole, permission)}
                    aria-pressed={granted}
                    aria-label={`${roleMeta[selectedRole].label} ${formatPermission(permission)} ${granted ? "allowed" : "blocked"}`}
                    disabled={Boolean(savingPermission)}
                    onClick={() => void togglePermission(permission)}
                  >
                    <span>
                      {granted ? <CheckCircle2 size={14} /> : <X size={14} />}
                    </span>
                    <strong>{formatPermission(permission)}</strong>
                    <small>
                      {saving ? "Saving" : granted ? "Allowed" : "Blocked"}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
