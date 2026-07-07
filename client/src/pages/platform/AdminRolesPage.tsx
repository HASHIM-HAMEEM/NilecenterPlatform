import { ArrowRight, Building2, KeyRound, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard, StatusBadge } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import { roleMeta, roleOrder, rolePermissions, type Role } from "@/lib/platformData";

const rolePurpose: Record<Role, string> = {
  student: "Learns from assigned courses and classes.",
  teacher: "Runs classes, attendance, grading, and feedback.",
  registrar: "Handles admissions, placement, enrollment, and payments.",
  headofdepartment: "Oversees curriculum, teachers, assessments, and approvals.",
  branchadmin: "Manages local branch operations and schedules.",
  superadmin: "Controls platform users, settings, and advanced access.",
};

const roleScope: Record<Role, string> = {
  student: "Own learning record",
  teacher: "Assigned classes",
  registrar: "Admissions desk",
  headofdepartment: "Academic department",
  branchadmin: "Branch operations",
  superadmin: "All workspaces",
};

function formatPermission(permission: string) {
  return permission
    .replace(":", " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function AdminRolesPage() {
  const state = platformStore.getState();
  const totalUsers = state.users.length;
  const roles = roleOrder.map(role => {
    const users = state.users.filter(user => user.roles.includes(role));
    const activeUsers = users.filter(user => user.activeRole === role && user.status !== "paused");
    return {
      role,
      label: roleMeta[role].label,
      purpose: rolePurpose[role],
      scope: roleScope[role],
      permissions: rolePermissions[role],
      users,
      activeUsers,
    };
  });
  const accessRuleCount = roleOrder.reduce((count, role) => count + rolePermissions[role].length, 0);
  const branchCount = state.branches.length;

  return (
    <PlatformShell role="superadmin" title="Roles & access">
      <WorkspaceLayout
        className="admin-roles-simple-page"
        title="Roles & access"
        description="Understand who can use each workspace and open the right access task."
        context="Admin"
        actions={
          <>
            <Link className="platform-secondary-button" href="/app/admin/permissions">
              <KeyRound size={15} />
              Access rules
            </Link>
            <Link className="platform-primary-button" href="/app/admin/users">
              <Users size={15} />
              Manage users
            </Link>
          </>
        }
        main={
          <div className="admin-roles-main-stack" data-testid="admin-roles-overview">
            <section
              className="admin-roles-summary"
              aria-label="Access summary"
              data-testid="admin-roles-summary"
            >
              <div>
                <span>Users</span>
                <strong>{totalUsers}</strong>
              </div>
              <div>
                <span>Roles</span>
                <strong>{roles.length}</strong>
              </div>
              <div>
                <span>Access rules</span>
                <strong>{accessRuleCount}</strong>
              </div>
              <div>
                <span>Branches</span>
                <strong>{branchCount}</strong>
              </div>
            </section>

            <DataTableCard title="Role overview" subtitle="One row per workspace role">
              <table className="admin-roles-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Purpose</th>
                    <th>Access level</th>
                    <th>Users</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(item => (
                    <tr key={item.role} data-testid={`admin-role-row-${item.role}`}>
                      <td>
                        <span
                          className="admin-roles-role-mark"
                          style={{ background: roleMeta[item.role].tint, color: roleMeta[item.role].color }}
                        >
                          {roleMeta[item.role].avatar}
                        </span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.permissions.length} rules</small>
                        </div>
                      </td>
                      <td>
                        <span>{item.purpose}</span>
                      </td>
                      <td>
                        <span>{item.scope}</span>
                      </td>
                      <td>
                        <strong>{item.users.length}</strong>
                        <small>{item.activeUsers.length} active</small>
                      </td>
                      <td>
                        <Link className="simple-portal-row-action" href="/app/admin/users">
                          Users
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableCard>
          </div>
        }
        side={
          <aside className="admin-roles-side-panel">
            <div className="admin-roles-side-header">
              <span>
                <ShieldCheck size={16} />
              </span>
              <div>
                <strong>Keep access simple</strong>
                <p>Use this page to understand roles. Edit a person from Users. Change detailed rules from Access rules.</p>
              </div>
            </div>
            <div className="admin-roles-link-list">
              <Link href="/app/admin/users">
                <Users size={15} />
                Users
                <ArrowRight size={14} />
              </Link>
              <Link href="/app/admin/permissions">
                <KeyRound size={15} />
                Access rules
                <ArrowRight size={14} />
              </Link>
              <Link href="/app/admin/branches">
                <Building2 size={15} />
                Branches
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="admin-roles-rule-preview">
              <span>Example access</span>
              {rolePermissions.teacher.slice(0, 4).map(permission => (
                <StatusBadge key={permission} tone="teal">
                  {formatPermission(permission)}
                </StatusBadge>
              ))}
            </div>
          </aside>
        }
      />
    </PlatformShell>
  );
}
