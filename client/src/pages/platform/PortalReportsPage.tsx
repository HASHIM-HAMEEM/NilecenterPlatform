import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  PortalInsight,
  countInsightPoints,
} from "@/components/platform/PortalInsights";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { Role } from "@/lib/platformData";

type PortalReportsPageProps = {
  role: Extract<Role, "teacher" | "registrar">;
  view?: "overview" | "attendance" | "grades" | "admissions" | "payments";
};

type ReportRow = {
  id: string;
  primary: string;
  secondary: string;
  status: string;
  date: string;
  value: string;
};

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["active", "present", "paid", "completed", "approved"].includes(status))
    return "green";
  if (
    ["pending", "late", "partial", "ready_to_enroll", "needs review"].includes(
      status
    )
  )
    return "amber";
  if (["absent", "overdue", "rejected", "cancelled"].includes(status))
    return "red";
  return "slate";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function downloadCsv(filename: string, rows: ReportRow[]) {
  const csv = [
    ["Item", "Detail", "Status", "Date", "Value"],
    ...rows.map(row => [
      row.primary,
      row.secondary,
      row.status,
      row.date,
      row.value,
    ]),
  ]
    .map(row =>
      row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
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

export default function PortalReportsPage({
  role,
  view = "overview",
}: PortalReportsPageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const roleRoot =
    role === "teacher" ? "/app/teacher/reports" : "/app/registrar/reports";
  const tabs =
    role === "teacher"
      ? [
          { href: roleRoot, label: "Overview", active: view === "overview" },
          {
            href: `${roleRoot}/attendance`,
            label: "Attendance",
            active: view === "attendance",
          },
          {
            href: `${roleRoot}/grades`,
            label: "Grades",
            active: view === "grades",
          },
        ]
      : [
          { href: roleRoot, label: "Overview", active: view === "overview" },
          {
            href: `${roleRoot}/admissions`,
            label: "Admissions",
            active: view === "admissions",
          },
          {
            href: `${roleRoot}/payments`,
            label: "Payments",
            active: view === "payments",
          },
        ];

  const rows: ReportRow[] =
    role === "teacher"
      ? view === "grades"
        ? state.grades.map(grade => {
            const student = state.students.find(
              item => item.id === grade.studentId
            );
            const user = state.users.find(item => item.id === student?.userId);
            return {
              id: grade.id,
              primary: user?.name ?? "Student",
              secondary: grade.itemTitle,
              status: grade.score >= 70 ? "approved" : "needs review",
              date: "Current",
              value: `${grade.score}/${grade.maxScore}`,
            };
          })
        : state.attendance.map(record => {
            const student = state.students.find(
              item => item.id === record.studentId
            );
            const user = state.users.find(item => item.id === student?.userId);
            const group = state.classGroups.find(
              item => item.id === record.classGroupId
            );
            return {
              id: record.id,
              primary: user?.name ?? "Student",
              secondary: group?.name ?? "Class",
              status: record.status,
              date: formatDate(
                state.events.find(item => item.id === record.sessionId)
                  ?.startsAt
              ),
              value: record.notes || "No note",
            };
          })
      : view === "payments"
        ? state.invoices.map(invoice => {
            const student = state.students.find(
              item => item.id === invoice.studentId
            );
            const user = state.users.find(item => item.id === student?.userId);
            return {
              id: invoice.id,
              primary: user?.name ?? "Student",
              secondary: `Invoice ${invoice.id}`,
              status: invoice.status,
              date: formatDate(invoice.dueAt),
              value: `${invoice.currency} ${invoice.amount}`,
            };
          })
        : state.applications.map(application => {
            const lead = state.leads.find(
              item => item.id === application.leadId
            );
            const branch = state.branches.find(
              item => item.id === application.branchId
            );
            return {
              id: application.id,
              primary: lead?.fullName ?? "Applicant",
              secondary: `${application.courseInterest} · ${branch?.name ?? "Branch"}`,
              status: application.status,
              date: formatDate(lead?.createdAt),
              value: application.schedulePreference,
            };
          });

  const filteredRows = rows.filter(row =>
    [row.primary, row.secondary, row.status, row.value]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const isTeacherOverview = role === "teacher" && view === "overview";

  const teacherOverview = isTeacherOverview ? (
    <section
      className="teacher-report-overview"
      data-testid="teacher-report-overview"
    >
      <div className="teacher-report-overview-heading">
        <div>
          <span>Teaching records</span>
          <h2>What to review</h2>
        </div>
        <span>Assigned classes</span>
      </div>
      <div className="teacher-report-overview-list">
        <Link href="/app/teacher/reports/attendance">
          <div>
            <strong>Attendance</strong>
            <small>Review saved and missing attendance records.</small>
          </div>
          <span>Open report</span>
        </Link>
        <Link href="/app/teacher/reports/grades">
          <div>
            <strong>Grades</strong>
            <small>Review current scores and learning progress.</small>
          </div>
          <span>Open report</span>
        </Link>
      </div>
    </section>
  ) : null;
  const isGradeReport = role === "teacher" && view === "grades";
  const reportInsightPoints = isGradeReport
    ? filteredRows.slice(0, 6).map(row => {
        const [score, maxScore] = row.value.split("/").map(Number);
        return {
          label: row.primary,
          value: maxScore ? Math.round((score / maxScore) * 100) : 0,
        };
      })
    : countInsightPoints(filteredRows.map(row => row.status));
  const averageVisibleGrade =
    isGradeReport && reportInsightPoints.length
      ? Math.round(
          reportInsightPoints.reduce((sum, point) => sum + point.value, 0) /
            reportInsightPoints.length
        )
      : 0;
  const activeTabLabel = tabs.find(tab => tab.active)?.label ?? "Report";
  const reportInsightTitle = isGradeReport
    ? "Grade spread"
    : role === "teacher"
      ? "Attendance signals"
      : view === "payments"
        ? "Payment status"
        : "Admissions status";

  return (
    <PlatformShell role={role} title="Reports">
      <ReportLayout
        className={`portal-simple-page ${role === "teacher" ? "teacher-reports-page" : ""}`}
        title={
          view === "overview"
            ? "Reports"
            : (tabs.find(tab => tab.active)?.label ?? "Reports")
        }
        description={
          role === "teacher"
            ? "Review class progress and learning records."
            : "Review admissions and payment follow-up."
        }
        context={role === "teacher" ? "Teacher" : "Registrar"}
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => downloadCsv(`nile-${role}-report.csv`, filteredRows)}
          >
            <Download size={15} />
            Export CSV
          </button>
        }
        toolbar={
          <div className="portal-report-toolbar-v4">
            <nav className="portal-report-tabs-v4" aria-label="Report views">
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
            <label className="portal-report-search-v4">
              <Search size={14} />
              <span className="sr-only">Search reports</span>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search report rows"
              />
            </label>
          </div>
        }
        main={
          teacherOverview ?? (
            <DataTableCard
              title={`${tabs.find(tab => tab.active)?.label ?? "Report"} rows`}
              subtitle={`${filteredRows.length} row(s)`}
              className="portal-report-record-card"
            >
              {filteredRows.length ? (
                <div className="portal-report-record-list">
                  {filteredRows.map(row => (
                    <article key={row.id}>
                      <div className="portal-report-record-copy">
                        <strong>{row.primary}</strong>
                        <p>{row.secondary}</p>
                      </div>
                      <dl className="portal-report-record-facts">
                        <div>
                          <dt>Date</dt>
                          <dd>{row.date}</dd>
                        </div>
                        <div>
                          <dt>Detail</dt>
                          <dd>{row.value}</dd>
                        </div>
                      </dl>
                      <StatusBadge tone={statusTone(row.status)}>
                        {formatStatus(row.status)}
                      </StatusBadge>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No report rows</strong>
                  <span>Try a different search or report view.</span>
                </div>
              )}
            </DataTableCard>
          )
        }
        side={
          <PortalInsight
            compact
            eyebrow={activeTabLabel}
            title={reportInsightTitle}
            value={
              isGradeReport ? `${averageVisibleGrade}%` : filteredRows.length
            }
            valueLabel={
              isGradeReport ? "average visible score" : "visible records"
            }
            description={
              isGradeReport
                ? "Compare the current visible scores before opening a learner record."
                : "Use the current status mix to choose the next review queue."
            }
            points={reportInsightPoints}
            variant="bars"
            tone={role === "teacher" ? "teal" : "amber"}
            testId={`${role}-reports-insight`}
          />
        }
      />
    </PlatformShell>
  );
}
