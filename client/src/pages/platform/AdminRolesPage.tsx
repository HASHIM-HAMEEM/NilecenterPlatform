import { ArrowRight, KeyRound, Users } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import {
  roleMeta,
  roleOrder,
  rolePermissions,
  type Role,
} from "@/lib/platformData";

const rolePurpose: Record<Role, string> = {
  student: "Learns from assigned courses and classes.",
  teacher: "Runs classes, attendance, grading, and feedback.",
  registrar: "Handles admissions, placement, enrollment, and payments.",
  headofdepartment:
    "Oversees curriculum, teachers, assessments, and approvals.",
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

export default function AdminRolesPage() {
  const state = platformStore.getState();
  const roles = roleOrder.map(role => {
    const users = state.users.filter(user => user.roles.includes(role));
    const activeUsers = users.filter(
      user => user.activeRole === role && user.status !== "paused"
    );
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
  return (
    <PlatformShell role="superadmin" title="Roles & access">
      <WorkspaceLayout
        className="admin-roles-simple-page"
        title="Roles & access"
        description="Understand each role, then manage people or access rules separately."
        context="Admin"
        actions={
          <>
            <Link
              className="platform-secondary-button"
              href="/app/admin/permissions"
            >
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
          <div
            className="admin-roles-main-stack"
            data-testid="admin-roles-overview"
          >
            <DataTableCard
              title="Role overview"
              subtitle={`${roles.length} roles`}
            >
              <div className="admin-record-list admin-role-record-list">
                {roles.map(item => (
                  <article
                    key={item.role}
                    data-testid={`admin-role-row-${item.role}`}
                  >
                    <div className="admin-role-record-copy">
                      <span
                        className="admin-roles-role-mark"
                        style={{
                          background: roleMeta[item.role].tint,
                          color: roleMeta[item.role].color,
                        }}
                      >
                        {roleMeta[item.role].avatar}
                      </span>
                      <div className="admin-record-list-copy">
                        <span>{item.scope}</span>
                        <strong>{item.label}</strong>
                        <p>{item.purpose}</p>
                      </div>
                    </div>
                    <dl className="admin-record-list-facts">
                      <div>
                        <dt>Access rules</dt>
                        <dd>{item.permissions.length}</dd>
                      </div>
                      <div>
                        <dt>Active users</dt>
                        <dd>
                          {item.activeUsers.length} of {item.users.length}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      className="simple-portal-row-action"
                      href="/app/admin/users"
                    >
                      Users
                      <ArrowRight size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
