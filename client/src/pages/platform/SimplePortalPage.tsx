import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";
import type { Role } from "@/lib/platformData";

type SimplePortalPageProps = {
  role: Role;
  pageId: string;
};

function humanize(value?: string) {
  if (!value) return "Not set";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  const normalized = status.toLowerCase();
  if (
    ["active", "paid", "approved", "issued", "completed"].includes(normalized)
  ) {
    return "green";
  }
  if (
    ["pending", "draft", "ready_to_enroll", "placement_booked"].includes(
      normalized
    )
  ) {
    return "amber";
  }
  if (
    ["overdue", "rejected", "paused", "cancelled", "revoked"].includes(
      normalized
    )
  ) {
    return "red";
  }
  return "slate";
}

const branchStatuses: EntityStatus[] = ["active", "paused", "pending"];

function AdminBranchesPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const rows = state.branches.map(branch => {
    const userCount = state.users.filter(
      user => user.branchId === branch.id
    ).length;
    const roomCount = state.rooms.filter(
      room => room.branchId === branch.id
    ).length;
    const classCount = state.classGroups.filter(group => {
      const run = state.courseRuns.find(item => item.id === group.courseRunId);
      return run?.branchId === branch.id;
    }).length;
    return {
      branch,
      userCount,
      roomCount,
      classCount,
      searchText:
        `${branch.name} ${branch.code} ${branch.address} ${branch.timezone} ${branch.status} ${userCount} ${classCount}`.toLowerCase(),
    };
  });
  const statuses = Array.from(
    new Set(rows.map(row => row.branch.status))
  ).filter(Boolean);
  const filteredRows = rows.filter(row => {
    const matchesQuery =
      !query.trim() || row.searchText.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || row.branch.status === status;
    return matchesQuery && matchesStatus;
  });
  const updateBranchStatus = async (
    branchId: string,
    nextStatus: EntityStatus
  ) => {
    const branch = state.branches.find(item => item.id === branchId);
    if (!branch || branch.status === nextStatus || savingBranchId) return;
    setSavingBranchId(branchId);
    setResult(null);
    const response = await runPlatformWorkflowActionRequest({
      type: "branch.update",
      branchId,
      status: nextStatus,
    });
    setSavingBranchId(null);
    if (!response.ok || !response.data) {
      setResult({
        tone: "error",
        title: "Branch status was not saved",
        detail: response.error ?? "Try again or review your session.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    setResult({
      tone: "success",
      title: "Branch status saved",
      detail: `${branch.name} is now ${humanize(nextStatus).toLowerCase()}.`,
    });
  };

  return (
    <PlatformShell role="superadmin" title="Branches">
      <WorkspaceLayout
        className="admin-branches-page"
        title="Branches"
        description="Manage branch status and review local operations."
        context="Admin"
        toolbar={
          <div
            className="admin-compact-toolbar admin-branches-toolbar"
            data-testid="admin-branches-toolbar"
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search branches"
                  data-testid="branch-search"
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
                data-testid="branch-status-filter"
              >
                <option value="all">All statuses</option>
                {statuses.map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <section
            className="admin-branches-main"
            data-testid="admin-branches-page"
          >
            {result ? (
              <div
                className={`admin-branches-result ${result.tone}`}
                data-testid="branch-result"
                role={result.tone === "error" ? "alert" : "status"}
              >
                <strong>{result.title}</strong>
                <span>{result.detail}</span>
              </div>
            ) : null}
            <DataTableCard
              title="Branches"
              subtitle={`${filteredRows.length} branches`}
            >
              <div className="admin-record-list admin-branch-record-list">
                {filteredRows.length ? (
                  filteredRows.map(row => (
                    <article
                      key={row.branch.id}
                      data-testid={`branch-row-${row.branch.id}`}
                    >
                      <div className="admin-record-list-copy">
                        <span>
                          {row.branch.code} ·{" "}
                          {row.branch.address || row.branch.timezone}
                        </span>
                        <strong>{row.branch.name}</strong>
                        <p>
                          {row.userCount} users · {row.classCount} classes ·{" "}
                          {row.roomCount} rooms
                        </p>
                      </div>
                      <div className="admin-record-list-actions">
                        <StatusBadge tone={statusTone(row.branch.status)}>
                          {humanize(row.branch.status)}
                        </StatusBadge>
                        <label className="admin-record-list-select">
                          <span>Branch status</span>
                          <select
                            value={row.branch.status}
                            disabled={Boolean(savingBranchId)}
                            data-testid={`branch-status-${row.branch.id}`}
                            aria-label={`${row.branch.name} status`}
                            onChange={event =>
                              void updateBranchStatus(
                                row.branch.id,
                                event.target.value as EntityStatus
                              )
                            }
                          >
                            {branchStatuses.map(item => (
                              <option key={item} value={item}>
                                {humanize(item)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="platform-empty-state">
                    <strong>No branches found</strong>
                    <span>Try a different search or status filter.</span>
                  </div>
                )}
              </div>
            </DataTableCard>
          </section>
        }
      />
    </PlatformShell>
  );
}

export default function SimplePortalPage({
  role,
  pageId,
}: SimplePortalPageProps) {
  if (role === "superadmin" && pageId === "branches") {
    return <AdminBranchesPage />;
  }

  return null;
}
