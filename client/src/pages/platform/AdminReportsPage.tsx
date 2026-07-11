import { useMemo, useState, type ReactElement } from "react";
import { BarChart3, Download, Search } from "lucide-react";
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
import type {
  AttendanceStatus,
  CertificateStatus,
  PaymentStatus,
} from "@/lib/domain/types";

type AdminReportsPageProps = {
  view:
    | "overview"
    | "attendance"
    | "finance"
    | "certificates"
    | "admissions"
    | "classes"
    | "saved-views";
};

type ReportArea = {
  title: string;
  purpose: string;
  rows: number;
  href: string;
  available: boolean;
};

type ReportRow = Record<string, string | number>;

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

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (
    ["present", "paid", "active", "approved", "issued", "completed"].includes(
      status
    )
  )
    return "green";
  if (
    ["late", "excused", "pending", "pending_approval", "issued"].includes(
      status
    )
  )
    return "amber";
  if (
    [
      "absent",
      "overdue",
      "rejected",
      "revoked",
      "cancelled",
      "refunded",
    ].includes(status)
  )
    return "red";
  return "slate";
}

function attendanceTone(
  status: AttendanceStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "present") return "green";
  if (status === "late" || status === "excused") return "amber";
  if (status === "absent") return "red";
  return "slate";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatRole(role: string) {
  if (role === "headofdepartment") return "Head of Department";
  if (role === "branchadmin") return "Branch Admin";
  if (role === "superadmin") return "Super Admin";
  return role.replace(/\b\w/g, character => character.toUpperCase());
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
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

export default function AdminReportsPage({ view }: AdminReportsPageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const studentUserName = (studentId?: string) => {
    const student = state.students.find(item => item.id === studentId);
    return (
      state.users.find(item => item.id === student?.userId)?.name ?? "Student"
    );
  };

  const branchForStudent = (studentId?: string) => {
    const enrollment = state.enrollments.find(
      item => item.studentId === studentId
    );
    const run = state.courseRuns.find(
      item => item.id === enrollment?.courseRunId
    );
    return (
      state.branches.find(item => item.id === run?.branchId)?.name ??
      "Unassigned"
    );
  };

  const courseTitle = (courseId?: string) =>
    state.courses.find(item => item.id === courseId)?.title ?? "Course";

  const branchName = (branchId?: string) =>
    state.branches.find(item => item.id === branchId)?.name ?? "Branch";

  const teacherName = (teacherId?: string) =>
    state.users.find(item => item.id === teacherId)?.name ?? "Teacher";

  const matchesSearch = (values: Array<string | number | undefined>) =>
    values.join(" ").toLowerCase().includes(search.toLowerCase());

  const matchesStatus = (value: string) => status === "all" || value === status;

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
      href: "/app/admin/reports/finance",
      available: true,
    },
    {
      title: "Admissions",
      purpose: "Leads, applications, and placement activity.",
      rows:
        state.applications.length +
        state.leads.length +
        state.placementTests.length,
      href: "/app/admin/reports/admissions",
      available: true,
    },
    {
      title: "Certificates",
      purpose: "Certificate approvals and issue status.",
      rows: state.certificates.length,
      href: "/app/admin/reports/certificates",
      available: true,
    },
    {
      title: "Classes",
      purpose: "Class groups, branches, and learner counts.",
      rows: state.classGroups.length,
      href: "/app/admin/reports/classes",
      available: true,
    },
    {
      title: "Saved views",
      purpose: "Saved report filters for repeat checks.",
      rows: state.reportPresets.length,
      href: "/app/admin/reports/saved-views",
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
        text.includes(search.toLowerCase()) && matchesStatus(record.status)
      );
    });

  const financeRows = state.invoices
    .map(invoice => {
      const payments = state.payments.filter(
        item => item.invoiceId === invoice.id
      );
      const paid = payments.reduce((sum, item) => sum + item.amount, 0);
      return {
        ...invoice,
        studentName: studentUserName(invoice.studentId),
        branchName: branchForStudent(invoice.studentId),
        paid,
      };
    })
    .filter(
      row =>
        matchesSearch([
          row.studentName,
          row.branchName,
          row.status,
          row.amount,
          row.currency,
        ]) && matchesStatus(row.status)
    );

  const certificateRows = state.certificates
    .map(certificate => ({
      ...certificate,
      studentName: studentUserName(certificate.studentId),
      courseTitle: courseTitle(certificate.courseId),
    }))
    .filter(
      row =>
        matchesSearch([
          row.studentName,
          row.courseTitle,
          row.status,
          row.grade,
        ]) && matchesStatus(row.status)
    );

  const admissionRows = [
    ...state.leads.map(lead => ({
      id: lead.id,
      person: lead.fullName,
      stage: "Lead",
      branch: "Unassigned",
      course: lead.subject,
      status: lead.status,
      date: lead.createdAt,
    })),
    ...state.applications.map(application => {
      const lead = state.leads.find(item => item.id === application.leadId);
      return {
        id: application.id,
        person: lead?.fullName ?? "Applicant",
        stage: "Application",
        branch: branchName(application.branchId),
        course: application.courseInterest,
        status: application.status,
        date: lead?.createdAt,
      };
    }),
    ...state.placementTests.map(test => ({
      id: test.id,
      person: test.fullName,
      stage: "Placement",
      branch: branchName(test.branchId),
      course: test.subject,
      status: test.status,
      date: test.preferredDate,
    })),
  ].filter(
    row =>
      matchesSearch([
        row.person,
        row.stage,
        row.branch,
        row.course,
        row.status,
      ]) && matchesStatus(row.status)
  );

  const classRows = state.classGroups
    .map(group => {
      const run = state.courseRuns.find(item => item.id === group.courseRunId);
      return {
        ...group,
        courseTitle: courseTitle(run?.courseId),
        branchName: branchName(run?.branchId),
        teacherName: teacherName(run?.teacherId),
        status: run?.status ?? "draft",
      };
    })
    .filter(
      row =>
        matchesSearch([
          row.name,
          row.courseTitle,
          row.branchName,
          row.teacherName,
          row.status,
        ]) && matchesStatus(row.status)
    );

  const savedViewRows = state.reportPresets
    .filter(
      preset => view !== "saved-views" || matchesStatus(preset.reportType)
    )
    .filter(preset =>
      matchesSearch([
        preset.label,
        preset.role,
        preset.reportType,
        preset.search,
        preset.status,
      ])
    );

  const summaryForView = () => {
    if (view === "attendance")
      return `${attendanceRows.length} attendance rows`;
    if (view === "finance") return `${financeRows.length} invoice rows`;
    if (view === "certificates")
      return `${certificateRows.length} certificate rows`;
    if (view === "admissions") return `${admissionRows.length} pipeline rows`;
    if (view === "classes") return `${classRows.length} class rows`;
    if (view === "saved-views") return `${savedViewRows.length} saved views`;
    return `${reportAreas.length} report areas`;
  };

  const reportRows: ReportRow[] = (() => {
    if (view === "attendance") {
      return attendanceRows.map(record => ({
        Student: record.studentName,
        Class: record.className,
        Branch: record.branchName,
        Date: formatDateTime(record.date),
        Status: record.status,
        Notes: record.notes ?? "",
      }));
    }
    if (view === "finance") {
      return financeRows.map(row => ({
        Student: row.studentName,
        Branch: row.branchName,
        Amount: `${row.amount} ${row.currency}`,
        Paid: `${row.paid} ${row.currency}`,
        Due: formatDateTime(row.dueAt),
        Status: row.status,
      }));
    }
    if (view === "certificates") {
      return certificateRows.map(row => ({
        Student: row.studentName,
        Course: row.courseTitle,
        Grade: `${row.grade}%`,
        Attendance: `${row.attendanceRate}%`,
        Status: row.status,
        Issued: formatDateTime(row.issuedAt),
      }));
    }
    if (view === "admissions") {
      return admissionRows.map(row => ({
        Applicant: row.person,
        Stage: row.stage,
        Branch: row.branch,
        Course: row.course,
        Status: row.status,
        Date: formatDateTime(row.date),
      }));
    }
    if (view === "classes") {
      return classRows.map(row => ({
        Class: row.name,
        Course: row.courseTitle,
        Teacher: row.teacherName,
        Branch: row.branchName,
        Learners: row.studentIds.length,
        Status: row.status,
      }));
    }
    if (view === "saved-views") {
      return savedViewRows.map(row => ({
        View: row.label,
        Report: row.reportType,
        Role: row.role,
        Filter: row.search || row.status,
        Rows: row.rowCount,
        Created: formatDateTime(row.createdAt),
      }));
    }
    return [];
  })();

  const exportRows = [
    Object.keys(reportRows[0] ?? { Report: "No rows" }),
    ...reportRows.map(row => Object.values(row)),
  ];
  const reportInsightStatusValues =
    view === "attendance"
      ? attendanceRows.map(row => row.status)
      : view === "finance"
        ? financeRows.map(row => row.status)
        : view === "certificates"
          ? certificateRows.map(row => row.status)
          : view === "admissions"
            ? admissionRows.map(row => row.status)
            : view === "classes"
              ? classRows.map(row => row.status)
              : view === "saved-views"
                ? savedViewRows.map(row => row.reportType)
                : [];
  const reportInsightPoints =
    view === "overview"
      ? reportAreas.map(area => ({ label: area.title, value: area.rows }))
      : countInsightPoints(reportInsightStatusValues);
  const reportInsightTitles: Record<AdminReportsPageProps["view"], string> = {
    overview: "Report volume",
    attendance: "Attendance mix",
    finance: "Invoice status",
    certificates: "Certificate status",
    admissions: "Admissions status",
    classes: "Class status",
    "saved-views": "Saved view use",
  };

  const overview = (
    <DataTableCard
      title="Report areas"
      subtitle="Choose one area to review"
      className="admin-reports-record-card"
    >
      <div className="admin-record-list admin-reports-record-list">
        {reportAreas.map(area => (
          <article key={area.title}>
            <div className="admin-record-list-copy">
              <span>{area.available ? "Available" : "Planned"}</span>
              <strong>{area.title}</strong>
              <p>{area.purpose}</p>
            </div>
            <dl className="admin-record-list-facts">
              <div>
                <dt>Records</dt>
                <dd>{area.rows}</dd>
              </div>
            </dl>
            <div className="admin-record-list-actions">
              {area.available ? (
                <Link className="simple-portal-row-action" href={area.href}>
                  Open
                </Link>
              ) : (
                <StatusBadge tone="slate">Not ready</StatusBadge>
              )}
            </div>
          </article>
        ))}
      </div>
    </DataTableCard>
  );

  const attendance = (
    <DataTableCard
      title="Attendance records"
      subtitle={`${attendanceRows.length} matching record(s)`}
      className="admin-reports-record-card"
    >
      {attendanceRows.length ? (
        <div className="admin-record-list admin-reports-record-list">
          {attendanceRows.map(record => (
            <article key={record.id}>
              <div className="admin-record-list-copy">
                <span>{record.branchName}</span>
                <strong>{record.studentName}</strong>
                <p>
                  {record.className}
                  {record.notes ? ` · ${record.notes}` : ""}
                </p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Session</dt>
                  <dd>{formatDateTime(record.date)}</dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={attendanceTone(record.status)}>
                  {formatStatus(record.status)}
                </StatusBadge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No attendance records</strong>
          <span>Try a different search or status filter.</span>
        </div>
      )}
    </DataTableCard>
  );

  const finance = (
    <DataTableCard
      title="Finance report"
      subtitle={`${financeRows.length} matching invoice(s)`}
      className="admin-reports-record-card"
    >
      {financeRows.length ? (
        <div className="admin-record-list admin-reports-record-list">
          {financeRows.map(row => (
            <article key={row.id}>
              <div className="admin-record-list-copy">
                <span>{row.branchName}</span>
                <strong>{row.studentName}</strong>
                <p>Due {formatDateTime(row.dueAt)}</p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Invoice</dt>
                  <dd>
                    {row.amount} {row.currency}
                  </dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>
                    {row.paid} {row.currency}
                  </dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={statusTone(row.status)}>
                  {formatStatus(row.status)}
                </StatusBadge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No invoice rows</strong>
          <span>Try a different search or payment status.</span>
        </div>
      )}
    </DataTableCard>
  );

  const certificates = (
    <DataTableCard
      title="Certificate report"
      subtitle={`${certificateRows.length} matching certificate(s)`}
      className="admin-reports-record-card"
    >
      {certificateRows.length ? (
        <div className="admin-record-list admin-reports-record-list">
          {certificateRows.map(row => (
            <article key={row.id}>
              <div className="admin-record-list-copy">
                <span>{row.courseTitle}</span>
                <strong>{row.studentName}</strong>
                <p>
                  {row.issuedAt
                    ? `Issued ${formatDateTime(row.issuedAt)}`
                    : "Awaiting issue"}
                </p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Grade</dt>
                  <dd>{row.grade}%</dd>
                </div>
                <div>
                  <dt>Attendance</dt>
                  <dd>{row.attendanceRate}%</dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={statusTone(row.status)}>
                  {formatStatus(row.status)}
                </StatusBadge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No certificates</strong>
          <span>Try a different search or certificate status.</span>
        </div>
      )}
    </DataTableCard>
  );

  const admissions = (
    <DataTableCard
      title="Admissions report"
      subtitle={`${admissionRows.length} matching pipeline row(s)`}
      className="admin-reports-record-card"
    >
      {admissionRows.length ? (
        <div className="admin-record-list admin-reports-record-list">
          {admissionRows.map(row => (
            <article key={row.id}>
              <div className="admin-record-list-copy">
                <span>{row.stage}</span>
                <strong>{row.person}</strong>
                <p>{row.course}</p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Branch</dt>
                  <dd>{row.branch}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatDateTime(row.date)}</dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={statusTone(row.status)}>
                  {formatStatus(row.status)}
                </StatusBadge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No admissions rows</strong>
          <span>Try a different applicant or status filter.</span>
        </div>
      )}
    </DataTableCard>
  );

  const classes = (
    <DataTableCard
      title="Classes report"
      subtitle={`${classRows.length} matching class(es)`}
      className="admin-reports-record-card"
    >
      {classRows.length ? (
        <div className="admin-record-list admin-reports-record-list">
          {classRows.map(row => (
            <article key={row.id}>
              <div className="admin-record-list-copy">
                <span>{row.courseTitle}</span>
                <strong>{row.name}</strong>
                <p>{row.schedule}</p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Teacher</dt>
                  <dd>{row.teacherName}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{row.branchName}</dd>
                </div>
                <div>
                  <dt>Learners</dt>
                  <dd>{row.studentIds.length}</dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={statusTone(row.status)}>
                  {formatStatus(row.status)}
                </StatusBadge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No classes</strong>
          <span>Try a different class, branch, or status.</span>
        </div>
      )}
    </DataTableCard>
  );

  const savedViews = (
    <DataTableCard
      title="Saved report views"
      subtitle={`${savedViewRows.length} saved view(s)`}
      className="admin-reports-record-card"
    >
      {savedViewRows.length ? (
        <div className="admin-record-list admin-reports-record-list">
          {savedViewRows.map(row => (
            <article key={row.id}>
              <div className="admin-record-list-copy">
                <span>{row.reportType}</span>
                <strong>{row.label}</strong>
                <p>{row.search || row.status || "No filter"}</p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>For</dt>
                  <dd>{formatRole(row.role)}</dd>
                </div>
                <div>
                  <dt>Rows</dt>
                  <dd>{row.rowCount}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(row.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No saved views</strong>
          <span>Saved report filters will appear here.</span>
        </div>
      )}
    </DataTableCard>
  );

  const mainByView = {
    overview,
    attendance,
    finance,
    certificates,
    admissions,
    classes,
    "saved-views": savedViews,
  } satisfies Record<AdminReportsPageProps["view"], ReactElement>;

  const titleByView: Record<AdminReportsPageProps["view"], string> = {
    overview: "Reports",
    attendance: "Attendance report",
    finance: "Finance report",
    certificates: "Certificate report",
    admissions: "Admissions report",
    classes: "Classes report",
    "saved-views": "Saved views",
  };

  const descriptionByView: Record<AdminReportsPageProps["view"], string> = {
    overview: "Choose one report area to open.",
    attendance: "Filter and export attendance records.",
    finance: "Review invoices and payment follow-up.",
    certificates: "Review certificate status and issue readiness.",
    admissions: "Review leads, applications, and placement activity.",
    classes: "Review class groups, teachers, branches, and learner counts.",
    "saved-views": "Review saved report filters.",
  };

  const tabs = [
    {
      href: "/app/admin/reports",
      label: "Overview",
      active: view === "overview",
    },
    {
      href: "/app/admin/reports/attendance",
      label: "Attendance",
      active: view === "attendance",
    },
    {
      href: "/app/admin/reports/finance",
      label: "Finance",
      active: view === "finance",
    },
    {
      href: "/app/admin/reports/certificates",
      label: "Certificates",
      active: view === "certificates",
    },
    {
      href: "/app/admin/reports/admissions",
      label: "Admissions",
      active: view === "admissions",
    },
    {
      href: "/app/admin/reports/classes",
      label: "Classes",
      active: view === "classes",
    },
    {
      href: "/app/admin/reports/saved-views",
      label: "Saved views",
      active: view === "saved-views",
    },
  ];

  const statusOptions: Record<
    Exclude<AdminReportsPageProps["view"], "overview">,
    Array<{ value: string; label: string }>
  > = {
    attendance: [
      { value: "all", label: "All statuses" },
      { value: "present", label: "Present" },
      { value: "late", label: "Late" },
      { value: "absent", label: "Absent" },
      { value: "excused", label: "Excused" },
    ],
    finance: [
      { value: "all", label: "All statuses" },
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
      { value: "issued", label: "Issued" },
    ] satisfies Array<{ value: PaymentStatus | "all"; label: string }>,
    certificates: [
      { value: "all", label: "All statuses" },
      { value: "pending_approval", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "issued", label: "Issued" },
      { value: "rejected", label: "Rejected" },
    ] satisfies Array<{ value: CertificateStatus | "all"; label: string }>,
    admissions: [
      { value: "all", label: "All statuses" },
      { value: "lead", label: "Lead" },
      { value: "active", label: "Active" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "ready_to_enroll", label: "Ready" },
    ],
    classes: [
      { value: "all", label: "All statuses" },
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "completed", label: "Completed" },
    ],
    "saved-views": [
      { value: "all", label: "All reports" },
      { value: "attendance", label: "Attendance" },
      { value: "finance", label: "Finance" },
      { value: "enrollments", label: "Admissions" },
      { value: "audit", label: "Activity" },
    ],
  };

  const searchableView = view !== "overview";
  const searchPlaceholder =
    view === "attendance"
      ? "Search attendance"
      : `Search ${titleByView[view].toLowerCase()}`;

  return (
    <PlatformShell role="superadmin" title="Reports">
      <ReportLayout
        className="admin-ia-page admin-reports-page"
        title={titleByView[view]}
        description={descriptionByView[view]}
        actions={
          searchableView ? (
            <button
              type="button"
              className="platform-primary-button"
              onClick={() => downloadCsv(`nile-${view}-report.csv`, exportRows)}
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
          <div className="admin-ia-control-row">
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
            {searchableView ? (
              <div className="admin-ia-toolbar">
                <label className="admin-ia-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                  />
                </label>
                <label>
                  {view === "saved-views" ? "Type" : "Status"}
                  <select
                    value={status}
                    onChange={event => setStatus(event.target.value)}
                  >
                    {statusOptions[view].map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="admin-ia-toolbar-count">
                  {summaryForView()}
                </span>
              </div>
            ) : null}
          </div>
        }
        main={mainByView[view]}
        side={
          <PortalInsight
            compact
            eyebrow="Report signal"
            title={reportInsightTitles[view]}
            value={
              view === "overview"
                ? reportAreas.reduce((sum, area) => sum + area.rows, 0)
                : reportInsightStatusValues.length
            }
            valueLabel={
              view === "overview" ? "records across reports" : "visible records"
            }
            description="Use this compact summary to focus the next operational review."
            points={reportInsightPoints}
            variant="bars"
            tone="slate"
            testId="admin-reports-insight"
          />
        }
      />
    </PlatformShell>
  );
}
