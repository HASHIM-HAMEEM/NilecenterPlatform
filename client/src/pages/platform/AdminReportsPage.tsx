import { useMemo, useState } from "react";
import { BarChart3, Download, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { AttendanceStatus } from "@/lib/domain/types";

type AdminReportsPageProps = {
  view: "overview" | "attendance";
};

type ReportArea = {
  title: string;
  purpose: string;
  rows: number;
  href: string;
  available: boolean;
};

function formatDateTime(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function attendanceTone(status: AttendanceStatus): "green" | "amber" | "red" | "slate" {
  if (status === "present") return "green";
  if (status === "late" || status === "excused") return "amber";
  if (status === "absent") return "red";
  return "slate";
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map(row =>
      row
        .map(value => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage({ view }: AdminReportsPageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | AttendanceStatus>("all");

  const reportAreas: ReportArea[] = [
    {
      title: "Attendance",
      purpose: "Class attendance records and exceptions.",
      rows: state.attendance.length,
      href: "/app/admin/reports/attendance",
      available: true,
    },
    {
      title: "Finance",
      purpose: "Payments and invoice follow-up.",
      rows: state.invoices.length,
      href: "/app/admin/reports",
      available: false,
    },
    {
      title: "Admissions",
      purpose: "Leads, applications, and placement activity.",
      rows: state.applications.length + state.leads.length,
      href: "/app/admin/reports",
      available: false,
    },
    {
      title: "Certificates",
      purpose: "Certificate approvals and issue status.",
      rows: state.certificates.length,
      href: "/app/admin/certificates",
      available: true,
    },
  ];

  const attendanceRows = state.attendance
    .map(record => {
      const student = state.students.find(item => item.id === record.studentId);
      const user = state.users.find(item => item.id === student?.userId);
      const group = state.classGroups.find(
        item => item.id === record.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      const event = state.events.find(item => item.id === record.sessionId);
      const branch = state.branches.find(item => item.id === run?.branchId);
      return {
        ...record,
        studentName: user?.name ?? "Student",
        className: group?.name ?? "Class",
        branchName: branch?.name ?? "Branch",
        date: event?.startsAt,
      };
    })
    .filter(record => {
      const text = [
        record.studentName,
        record.className,
        record.branchName,
        record.notes,
        record.status,
      ]
        .join(" ")
        .toLowerCase();
      return (
        text.includes(search.toLowerCase()) &&
        (status === "all" || record.status === status)
      );
    });

  const overview = (
    <DataTableCard
      title="Report areas"
      subtitle="Choose one area to review"
      className="admin-ia-table-card"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Purpose</th>
              <th>Rows</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reportAreas.map(area => (
              <tr key={area.title}>
                <td>
                  <strong>{area.title}</strong>
                  <small>{area.available ? "Ready" : "Planned"}</small>
                </td>
                <td>{area.purpose}</td>
                <td>{area.rows}</td>
                <td>
                  {area.available ? (
                    <Link className="platform-row-link" href={area.href}>
                      Open
                    </Link>
                  ) : (
                    <StatusBadge tone="slate">Later</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const attendance = (
    <DataTableCard
      title="Attendance records"
      subtitle={`${attendanceRows.length} matching record(s)`}
      className="admin-ia-table-card"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Branch</th>
              <th>Date</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRows.map(record => (
              <tr key={record.id}>
                <td>
                  <strong>{record.studentName}</strong>
                  <small>{record.id}</small>
                </td>
                <td>{record.className}</td>
                <td>{record.branchName}</td>
                <td>{formatDateTime(record.date)}</td>
                <td>
                  <StatusBadge tone={attendanceTone(record.status)}>
                    {record.status}
                  </StatusBadge>
                </td>
                <td>{record.notes || "No note"}</td>
              </tr>
            ))}
            {!attendanceRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No attendance records</strong>
                    <span>Try a different search or status filter.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const tabs = [
    { href: "/app/admin/reports", label: "Overview", active: view === "overview" },
    {
      href: "/app/admin/reports/attendance",
      label: "Attendance",
      active: view === "attendance",
    },
  ];

  return (
    <PlatformShell role="superadmin" title="Reports">
      <ReportLayout
        className="admin-ia-page admin-reports-page"
        title={view === "attendance" ? "Attendance report" : "Reports"}
        description={
          view === "attendance"
            ? "Review attendance records only."
            : "Choose one report area to review."
        }
        actions={
          view === "attendance" ? (
            <button
              type="button"
              className="platform-primary-button"
              onClick={() =>
                downloadCsv("nile-attendance-report.csv", [
                  ["Student", "Class", "Branch", "Date", "Status", "Notes"],
                  ...attendanceRows.map(record => [
                    record.studentName,
                    record.className,
                    record.branchName,
                    formatDateTime(record.date),
                    record.status,
                    record.notes ?? "",
                  ]),
                ])
              }
            >
              <Download size={15} />
              Export CSV
            </button>
          ) : (
            <Link
              className="platform-primary-button"
              href="/app/admin/reports/attendance"
            >
              <BarChart3 size={15} />
              Open attendance
            </Link>
          )
        }
        toolbar={
          <>
            <nav className="admin-ia-subnav" aria-label="Report sections">
              {tabs.map(tab => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={tab.active ? "active" : ""}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            {view === "attendance" ? (
              <div className="admin-ia-toolbar">
                <label className="admin-ia-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search attendance"
                    aria-label="Search attendance"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={event =>
                      setStatus(event.target.value as "all" | AttendanceStatus)
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </select>
                </label>
              </div>
            ) : null}
          </>
        }
        main={view === "attendance" ? attendance : overview}
      />
    </PlatformShell>
  );
}
