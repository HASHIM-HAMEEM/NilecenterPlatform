import { motion } from "framer-motion";
import { useMemo, type CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  Award,
  BookOpen,
  BookCopy,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  Library,
  ListChecks,
  MessageSquare,
  Network,
  Plus,
  PlugZap,
  Presentation,
  ScrollText,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { PlatformPageHeader, platformReveal } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import { dashboardByRole, roleMeta, rolePermissions, sidebarByRole, type Role, type Stat } from "@/lib/platformData";

const toneColor: Record<Stat["tone"], string> = {
  teal: "#1A4A3A",
  amber: "#C4A35A",
  green: "#2D5016",
  red: "#C75B39",
  purple: "#3D1A5C",
  slate: "#1A1A1A",
};

const dashboardReveal = platformReveal;

export default function RoleDashboard({ role }: { role: Role }) {
  const dashboard = dashboardByRole[role];
  const meta = roleMeta[role];
  const primaryActionsByRole: Partial<Record<Role, { label: string; href: string; Icon: LucideIcon }>> = {
    student: {
      label: "Continue lesson",
      href: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
      Icon: BookOpen,
    },
    teacher: {
      label: "Create session",
      href: "/app/teacher/classes/class_ar_l3_a/sessions",
      Icon: Presentation,
    },
    registrar: {
      label: "Add lead",
      href: "/app/registrar/leads",
      Icon: Users,
    },
    branchadmin: {
      label: "Resolve conflict",
      href: "/app/branch/rooms",
      Icon: Building2,
    },
  };
  const primaryDashboardAction = primaryActionsByRole[role] ?? {
    label: "Open workspace",
    href: meta.defaultRoute,
    Icon: Plus,
  };
  const reportActionLabel = role === "student" ? "My report" : "Reports";
  const spotlightRoutes: Partial<Record<Role, string>> = {
    student: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
    teacher: "/app/teacher/classes/class_ar_l3_a/attendance",
    registrar: "/app/registrar/placement-tests",
    branchadmin: "/app/branch/rooms",
  };
  const spotlightHref = spotlightRoutes[role] ?? meta.defaultRoute.replace("/dashboard", "/reports");
  const actionRoutesByRole: Partial<Record<Role, Record<string, string>>> = {
    student: {
      "Join class": "/app/student/courses/course_ar_l3/live",
      "Submit assignment": "/app/student/assignments/asg_ar_grammar",
      "Message teacher": "/app/student/messages",
      "View calendar": "/app/student/calendar",
    },
    teacher: {
      "Create assignment": "/app/teacher/assignments",
      "Upload material": "/app/teacher/classes/class_ar_l3_a/materials",
      "Mark attendance": "/app/teacher/classes/class_ar_l3_a/attendance",
      "Create quiz": "/app/teacher/quizzes",
    },
    registrar: {
      "Add lead": "/app/registrar/leads",
      "Book placement test": "/app/registrar/placement-tests",
      "Register student": "/app/registrar/enrollments",
      "Send message": "/app/registrar/messages",
    },
    branchadmin: {
      "Add room": "/app/branch/rooms",
      "View schedule": "/app/branch/classes",
      "Contact student": "/app/branch/students",
      "Resolve conflict": "/app/branch/rooms",
    },
  };
  const quickActionRoutes = actionRoutesByRole[role] ?? {};

  if (role === "superadmin") {
    return <SuperAdminDashboard />;
  }

  if (role === "headofdepartment") {
    return <HeadOfDepartmentDashboard />;
  }

  if (role === "registrar") {
    return <RegistrarCommandDashboard />;
  }

  if (role === "teacher") {
    return <TeacherCommandDashboard />;
  }

  if (role === "branchadmin") {
    return <BranchAdminOperationsDashboard />;
  }

  return (
    <PlatformShell role={role} title="Dashboard">
      <PlatformPageHeader
        compact
        title={dashboard.title}
        description={dashboard.subtitle}
        actions={
          <>
          <Link href={meta.defaultRoute.replace("/dashboard", "/reports")} className="platform-secondary-button">
            {reportActionLabel}
          </Link>
          <Link
            href={primaryDashboardAction.href}
            className="platform-primary-button"
            style={{ background: meta.color }}
          >
            <primaryDashboardAction.Icon size={15} />
            {primaryDashboardAction.label}
          </Link>
          </>
        }
      />

      <motion.div className="platform-metric-grid" initial="hidden" animate="visible">
        {dashboard.stats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.05 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-dashboard-grid" initial="hidden" animate="visible" custom={0.14} variants={dashboardReveal}>
        <article className="platform-spotlight">
          <div className="platform-card-title">
            <div>
              <span>Next priority</span>
              <strong>{dashboard.spotlight.title}</strong>
            </div>
            <Clock size={18} style={{ color: meta.color }} />
          </div>
          <p>{dashboard.spotlight.description}</p>
          <div className="platform-progress-row">
            <div>
              <strong>Completion</strong>
              <span>{dashboard.spotlight.progress}%</span>
            </div>
            <div>
              <span style={{ width: `${dashboard.spotlight.progress}%`, background: meta.color }} />
            </div>
          </div>
          <Link href={spotlightHref} className="platform-primary-button" style={{ background: meta.color }}>
            {dashboard.spotlight.action}
            <ArrowRight size={15} />
          </Link>
        </article>

        <article className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>Role tools</span>
              <strong>Quick actions</strong>
            </div>
          </div>
          <div className="platform-action-list">
            {dashboard.actions.map((action) => (
              <Link key={action} href={quickActionRoutes[action] ?? meta.defaultRoute}>
                <CheckCircle2 size={15} style={{ color: meta.color }} />
                {action}
              </Link>
            ))}
          </div>
        </article>

        <article className="platform-table-card wide">
          <div className="platform-card-title compact">
            <div>
              <span>Live data</span>
              <strong>Today</strong>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Metric</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.title}</strong>
                    <small>{record.subtitle}</small>
                  </td>
                  <td>
                    <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
                      {record.status}
                    </span>
                  </td>
                  <td>{record.owner}</td>
                  <td>{record.due}</td>
                  <td>{record.metric}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </motion.div>
    </PlatformShell>
  );
}

function RegistrarCommandDashboard() {
  const meta = roleMeta.registrar;
  const state = useMemo(() => platformStore.getState(), []);
  const actor = state.users.find((user) => user.id === "usr_registrar_demo");
  const branch = state.branches.find((item) => item.id === actor?.branchId);
  const applications = state.applications;
  const pendingApplications = applications.filter((application) => application.status === "pending");
  const pendingPlacements = state.placementTests.filter((booking) => booking.status !== "completed");
  const readyWorkflows = state.enrollmentWorkflows.filter((workflow) => workflow.status === "ready_to_enroll");
  const invoiceRows = state.invoices.map((invoice) => {
    const paid = state.payments
      .filter((payment) => payment.invoiceId === invoice.id && payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);
    return { invoice, paid, balance: Math.max(0, invoice.amount - paid) };
  });
  const openInvoices = invoiceRows.filter((row) => row.balance > 0);
  const collected = invoiceRows.reduce((sum, row) => sum + row.paid, 0);
  const nextPlacement = pendingPlacements[0];
  const nextPlacementBranch = state.branches.find((item) => item.id === nextPlacement?.branchId);
  const activeStudents = state.students.filter((student) => student.status === "active");
  const pipelineStats: Stat[] = [
    { label: "Leads", value: String(state.leads.length), change: `${state.leads.filter((lead) => lead.status === "lead").length} new`, tone: "teal" },
    { label: "Applications", value: String(applications.length), change: `${pendingApplications.length} pending`, tone: "amber" },
    { label: "Placement queue", value: String(pendingPlacements.length), change: "awaiting result", tone: pendingPlacements.length ? "red" : "green" },
    { label: "Open balance", value: `EGP ${openInvoices.reduce((sum, row) => sum + row.balance, 0)}`, change: `${openInvoices.length} invoice(s)`, tone: openInvoices.length ? "amber" : "green" },
  ];
  const pipelineSteps: Array<{
    label: string;
    href: string;
    count: number;
    status: string;
    detail: string;
    tone: Stat["tone"];
    Icon: LucideIcon;
  }> = [
    {
      label: "Leads",
      href: "/app/registrar/leads",
      count: state.leads.filter((lead) => lead.status === "lead").length,
      status: "Intake",
      detail: "Capture enquiry and create the application file.",
      tone: "teal",
      Icon: Users,
    },
    {
      label: "Applications",
      href: "/app/registrar/applications",
      count: pendingApplications.length,
      status: "Review",
      detail: "Confirm branch, course interest, schedule, and notes.",
      tone: "amber",
      Icon: FileText,
    },
    {
      label: "Placement",
      href: "/app/registrar/placement-tests",
      count: pendingPlacements.length,
      status: "Result",
      detail: "Record level decision before enrollment handoff.",
      tone: pendingPlacements.length ? "red" : "green",
      Icon: ClipboardList,
    },
    {
      label: "Enrollment",
      href: "/app/registrar/enrollments",
      count: readyWorkflows.length,
      status: "Assign",
      detail: "Pick course run and class group to activate portal.",
      tone: "purple",
      Icon: UserPlus,
    },
    {
      label: "Payment",
      href: "/app/registrar/payments",
      count: openInvoices.length,
      status: "Internal",
      detail: "Record manual receipt against the generated invoice.",
      tone: openInvoices.length ? "amber" : "green",
      Icon: CreditCard,
    },
    {
      label: "Active portal",
      href: "/app/registrar/students",
      count: activeStudents.length,
      status: "Live",
      detail: "Student sees assigned course, class, teacher, and tasks.",
      tone: "green",
      Icon: CheckCircle2,
    },
  ];

  return (
    <PlatformShell role="registrar" title="Dashboard">
      <PlatformPageHeader
        compact
        title="Admissions command center"
        description={`${branch?.name ?? "Admissions"} · leads, applications, placement, enrollment handoff, and internal payments.`}
        actions={
          <>
          <Link href="/app/registrar/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href="/app/registrar/applications" className="platform-primary-button" style={{ background: meta.color }}>
            <FileText size={15} />
            New application
          </Link>
          </>
        }
      />

      <motion.div className="platform-metric-grid registrar-command-metrics" initial="hidden" animate="visible">
        {pipelineStats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.05 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.section className="registrar-command-pipeline" initial="hidden" animate="visible" custom={0.1} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Admissions path</span>
            <strong>Lead to active student</strong>
          </div>
          <ArrowRight size={18} style={{ color: meta.color }} />
        </div>
        <div className="registrar-command-pipeline-track" aria-label="Registrar admissions workflow stages">
          {pipelineSteps.map(({ label, href, count, status, detail, tone, Icon }, index) => (
            <Link key={label} href={href} className="registrar-command-pipeline-step">
              <span style={{ color: toneColor[tone], background: `${toneColor[tone]}14` }}>
                <Icon size={15} />
              </span>
              <div>
                <strong>{label}</strong>
                <small>{detail}</small>
              </div>
              <em>{count} · {status}</em>
              {index < pipelineSteps.length - 1 ? <ArrowRight className="registrar-command-pipeline-arrow" size={14} aria-hidden="true" /> : null}
            </Link>
          ))}
        </div>
      </motion.section>

      <motion.div className="registrar-command-layout" initial="hidden" animate="visible" custom={0.14} variants={dashboardReveal}>
        <section className="registrar-command-now">
          <div className="platform-card-title compact">
            <div>
              <span>Next admissions action</span>
              <strong>{nextPlacement?.fullName ?? pendingApplications[0]?.id ?? "Pipeline ready"}</strong>
            </div>
            <ClipboardList size={18} style={{ color: meta.color }} />
          </div>
          <p>
            {nextPlacement
              ? `${nextPlacement.subject} placement is booked for ${nextPlacement.preferredDate} at ${nextPlacementBranch?.name ?? nextPlacement.branchId}.`
              : pendingApplications.length
                ? "Prepare the next pending application for enrollment handoff."
                : "Lead intake, application files, placement queue, and payment records are synchronized."}
          </p>
          <div className="registrar-command-actions">
            <Link href="/app/registrar/leads" className="platform-secondary-button">
              <Users size={15} />
              Leads
            </Link>
            <Link href="/app/registrar/placement-tests" className="platform-primary-button" style={{ background: meta.color }}>
              <CalendarDays size={15} />
              Placement queue
            </Link>
          </div>
        </section>

        <aside className="registrar-command-finance">
          <div className="platform-card-title compact">
            <div>
              <span>Internal payments</span>
              <strong>EGP {collected} collected</strong>
            </div>
            <CreditCard size={18} style={{ color: meta.color }} />
          </div>
          <dl>
            <div>
              <dt>Open invoices</dt>
              <dd>{openInvoices.length}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>EGP {openInvoices.reduce((sum, row) => sum + row.balance, 0)}</dd>
            </div>
          </dl>
          <Link href="/app/registrar/payments" className="platform-secondary-button">
            Open ledger
          </Link>
        </aside>
      </motion.div>

      <motion.div className="registrar-command-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        <section className="registrar-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Application files</span>
              <strong>{pendingApplications.length} pending</strong>
            </div>
          </div>
          <div className="registrar-command-list">
            {applications.slice(0, 5).map((application) => {
              const lead = state.leads.find((item) => item.id === application.leadId);
              const branchRow = state.branches.find((item) => item.id === application.branchId);
              const workflow = state.enrollmentWorkflows.find((item) => item.applicationId === application.id);
              return (
                <Link key={application.id} href={`/app/registrar/applications/${application.id}`}>
                  <span>{application.status}</span>
                  <div>
                    <strong>{lead?.fullName ?? application.id}</strong>
                    <small>{application.courseInterest} · {branchRow?.name ?? application.branchId} · {application.schedulePreference}</small>
                  </div>
                  <em>{workflow ? "prepared" : "open"}</em>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="registrar-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Enrollment handoff</span>
              <strong>{readyWorkflows.length} ready</strong>
            </div>
          </div>
          <div className="registrar-command-list">
            {readyWorkflows.slice(0, 5).map((workflow) => {
              const lead = state.leads.find((item) => item.id === workflow.leadId);
              const course = state.courses.find((item) => item.id === workflow.targetCourseId);
              return (
                <Link key={workflow.id} href="/app/registrar/enrollments">
                  <span>{workflow.source ?? "intake"}</span>
                  <div>
                    <strong>{lead?.fullName ?? workflow.id}</strong>
                    <small>{course?.title ?? workflow.targetCourseId} · {workflow.nextStep}</small>
                  </div>
                  <em>{workflow.status}</em>
                </Link>
              );
            })}
            {!readyWorkflows.length ? (
              <article>
                <div>
                  <strong>No handoff waiting</strong>
                  <small>Converted applications and placement results will appear here.</small>
                </div>
              </article>
            ) : null}
          </div>
        </section>

        <section className="registrar-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Placement queue</span>
              <strong>{pendingPlacements.length} pending test(s)</strong>
            </div>
          </div>
          <div className="registrar-command-list">
            {pendingPlacements.slice(0, 5).map((booking) => (
              <Link key={booking.id} href={`/app/registrar/placement-tests/${booking.id}`}>
                <span>{booking.status}</span>
                <div>
                  <strong>{booking.fullName}</strong>
                  <small>{booking.subject} · {booking.preferredDate} · {booking.currentLevel}</small>
                </div>
                <em>result</em>
              </Link>
            ))}
          </div>
        </section>

        <section className="registrar-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Payment pending</span>
              <strong>{openInvoices.length} open invoice(s)</strong>
            </div>
          </div>
          <div className="registrar-command-list">
            {openInvoices.slice(0, 5).map((row) => {
              const student = state.students.find((item) => item.id === row.invoice.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              return (
                <Link key={row.invoice.id} href="/app/registrar/payments">
                  <span>{row.invoice.currency} {row.balance}</span>
                  <div>
                    <strong>{user?.name ?? row.invoice.studentId}</strong>
                    <small>{row.invoice.id} · due {row.invoice.dueAt} · {row.invoice.status}</small>
                  </div>
                  <em>collect</em>
                </Link>
              );
            })}
          </div>
        </section>
      </motion.div>
    </PlatformShell>
  );
}

function TeacherCommandDashboard() {
  const dashboard = dashboardByRole.teacher;
  const meta = roleMeta.teacher;
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = "usr_teacher_demo";
  const teacherUser = state.users.find((user) => user.id === actorId);
  const teacherProfile = state.teachers.find((teacher) => teacher.userId === actorId);
  const staffProfile = state.staffProfiles.find((profile) => profile.userId === actorId && profile.role === "teacher");
  const teacherRuns = state.courseRuns.filter((run) => run.teacherId === actorId);
  const runIds = new Set(teacherRuns.map((run) => run.id));
  const teacherClasses = state.classGroups.filter((group) => runIds.has(group.courseRunId));
  const classIds = new Set(teacherClasses.map((group) => group.id));
  const studentIds = new Set(teacherClasses.flatMap((group) => group.studentIds));
  const teacherStudents = state.students.filter((student) => studentIds.has(student.id));
  const sessions = state.classSessions
    .filter((session) => classIds.has(session.classGroupId))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const pendingAttendance = sessions.filter((session) => !session.attendanceSaved);
  const assignments = state.assignments.filter((assignment) => runIds.has(assignment.courseRunId));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const pendingSubmissions = state.assignmentSubmissions.filter(
    (submission) =>
      submission.status === "pending" &&
      studentIds.has(submission.studentId) &&
      assignmentIds.has(submission.assignmentId),
  );
  const grades = state.grades.filter((grade) => studentIds.has(grade.studentId) && runIds.has(grade.courseRunId));
  const averageProgress = teacherStudents.length
    ? Math.round(
        teacherStudents.reduce((sum, student) => {
          const studentEnrollments = state.enrollments.filter(
            (enrollment) => enrollment.studentId === student.id && runIds.has(enrollment.courseRunId),
          );
          if (!studentEnrollments.length) return sum;
          return sum + Math.round(studentEnrollments.reduce((inner, enrollment) => inner + enrollment.progress, 0) / studentEnrollments.length);
        }, 0) / teacherStudents.length,
      )
    : 0;
  const studentsNeedingAttention = teacherStudents
    .map((student) => {
      const user = state.users.find((item) => item.id === student.userId);
      const enrollments = state.enrollments.filter((enrollment) => enrollment.studentId === student.id && runIds.has(enrollment.courseRunId));
      const lowestAttendance = enrollments.length ? Math.min(...enrollments.map((enrollment) => enrollment.attendanceRate)) : 0;
      const lowestGrade = enrollments.length ? Math.min(...enrollments.map((enrollment) => enrollment.currentGrade)) : 0;
      const progress = enrollments.length ? Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / enrollments.length) : 0;
      return { student, user, lowestAttendance, lowestGrade, progress };
    })
    .filter((row) => row.lowestAttendance < 85 || row.lowestGrade < 75 || row.progress < 50)
    .slice(0, 4);
  const nextClass = sessions.find((session) => !session.attendanceSaved) ?? sessions[0];
  const nextClassGroup = teacherClasses.find((group) => group.id === nextClass?.classGroupId) ?? teacherClasses[0];
  const nextRun = teacherRuns.find((run) => run.id === nextClassGroup?.courseRunId);
  const nextCourse = state.courses.find((course) => course.id === nextRun?.courseId);
  const dashboardStats: Stat[] = [
    { label: "Assigned classes", value: String(teacherClasses.length), change: `${teacherRuns.length} course run(s)`, tone: "teal" },
    { label: "Learners", value: String(teacherStudents.length), change: "class roster scope", tone: "green" },
    { label: "Attendance pending", value: String(pendingAttendance.length), change: `${sessions.length} session(s)`, tone: pendingAttendance.length ? "amber" : "green" },
    { label: "Grading queue", value: String(pendingSubmissions.length), change: `${grades.length} grade item(s)`, tone: pendingSubmissions.length ? "red" : "green" },
  ];

  return (
    <PlatformShell role="teacher" title="Dashboard">
      <PlatformPageHeader
        compact
        title="Teaching command center"
        description={`${teacherUser?.name ?? "Teacher"} · ${staffProfile?.subjects.join(", ") || teacherProfile?.subjects.join(", ") || "Assigned teaching scope"}`}
        actions={
          <>
          <Link href="/app/teacher/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href={`/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}/attendance`} className="platform-primary-button" style={{ background: meta.color }}>
            <CheckCircle2 size={15} />
            Mark attendance
          </Link>
          </>
        }
      />

      <motion.div className="platform-metric-grid teacher-command-metrics" initial="hidden" animate="visible">
        {dashboardStats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.05 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="teacher-command-layout" initial="hidden" animate="visible" custom={0.14} variants={dashboardReveal}>
        <section className="teacher-command-now">
          <div className="platform-card-title compact">
            <div>
              <span>Next teaching action</span>
              <strong>{nextClass?.title ?? nextClassGroup?.name ?? dashboard.spotlight.title}</strong>
            </div>
            <Clock size={18} style={{ color: meta.color }} />
          </div>
          <p>{nextCourse?.title ?? dashboard.spotlight.description}</p>
          <dl>
            <div>
              <dt>Class</dt>
              <dd>{nextClassGroup?.name ?? "No class assigned"}</dd>
            </div>
            <div>
              <dt>Schedule</dt>
              <dd>{nextClass ? new Date(nextClass.startsAt).toLocaleString() : nextClassGroup?.schedule ?? "No session"}</dd>
            </div>
            <div>
              <dt>Roster</dt>
              <dd>{nextClassGroup?.studentIds.length ?? 0} learner(s)</dd>
            </div>
          </dl>
          <div className="teacher-command-actions">
            <Link href={`/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}`} className="platform-secondary-button">
              <Presentation size={15} />
              Class panel
            </Link>
            <Link href="/app/teacher/grading" className="platform-primary-button" style={{ background: meta.color }}>
              <ListChecks size={15} />
              Grading queue
            </Link>
          </div>
        </section>

        <aside className="teacher-command-profile">
          <div className="platform-card-title compact">
            <div>
              <span>Teacher profile</span>
              <strong>{teacherUser?.name ?? "Teacher"}</strong>
            </div>
            <GraduationCap size={18} style={{ color: meta.color }} />
          </div>
          <div className="teacher-command-profile-grid">
            <span>{teacherProfile?.status ?? teacherUser?.status ?? "active"}</span>
            <span>{teacherProfile?.availabilityStatus ?? staffProfile?.availabilityStatus ?? "available"}</span>
            <span>{teacherProfile?.subjects.join(", ") || staffProfile?.subjects.join(", ") || "subjects pending"}</span>
            <span>{teacherProfile?.teachingLevels.join(", ") || staffProfile?.teachingLevels.join(", ") || "levels pending"}</span>
          </div>
        </aside>
      </motion.div>

      <motion.div className="teacher-command-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        <section className="teacher-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Assigned classes</span>
              <strong>{teacherClasses.length} active group(s)</strong>
            </div>
          </div>
          <div className="teacher-command-list">
            {teacherClasses.map((group) => {
              const run = teacherRuns.find((item) => item.id === group.courseRunId);
              const course = state.courses.find((item) => item.id === run?.courseId);
              const pending = pendingAttendance.filter((session) => session.classGroupId === group.id).length;
              return (
                <Link key={group.id} href={`/app/teacher/classes/${group.id}`}>
                  <span>{group.studentIds.length}/{group.capacity}</span>
                  <div>
                    <strong>{group.name}</strong>
                    <small>{course?.title ?? run?.term ?? "Course"} · {group.schedule}</small>
                  </div>
                  <em>{pending ? `${pending} pending` : "ready"}</em>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="teacher-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Students needing attention</span>
              <strong>{studentsNeedingAttention.length || "Clear"}</strong>
            </div>
          </div>
          <div className="teacher-command-list">
            {studentsNeedingAttention.length ? (
              studentsNeedingAttention.map((row) => (
                <Link key={row.student.id} href="/app/teacher/classes/class_ar_l3_a/students">
                  <span>{row.progress}%</span>
                  <div>
                    <strong>{row.user?.name ?? row.student.id}</strong>
                    <small>Attendance {row.lowestAttendance}% · Grade {row.lowestGrade}%</small>
                  </div>
                  <em>review</em>
                </Link>
              ))
            ) : (
              <article>
                <div>
                  <strong>No intervention queue</strong>
                  <small>Class progress, attendance, and grades are within current thresholds.</small>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="teacher-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Pending grading</span>
              <strong>{pendingSubmissions.length} submission(s)</strong>
            </div>
          </div>
          <div className="teacher-command-list">
            {pendingSubmissions.slice(0, 5).map((submission) => {
              const assignment = state.assignments.find((item) => item.id === submission.assignmentId);
              const student = state.students.find((item) => item.id === submission.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              return (
                <Link key={submission.id} href="/app/teacher/grading">
                  <span>{assignment?.submissionType ?? "work"}</span>
                  <div>
                    <strong>{assignment?.title ?? submission.assignmentId}</strong>
                    <small>{user?.name ?? submission.studentId} · submitted {new Date(submission.submittedAt).toLocaleDateString()}</small>
                  </div>
                  <em>grade</em>
                </Link>
              );
            })}
            {!pendingSubmissions.length ? (
              <article>
                <div>
                  <strong>Grading queue is clear</strong>
                  <small>New class submissions will appear here.</small>
                </div>
              </article>
            ) : null}
          </div>
        </section>

        <section className="teacher-command-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Progress snapshot</span>
              <strong>{averageProgress}% average</strong>
            </div>
          </div>
          <div className="platform-progress-row">
            <div>
              <strong>Class learning progress</strong>
              <span>{averageProgress}%</span>
            </div>
            <div>
              <span style={{ width: `${averageProgress}%`, background: meta.color }} />
            </div>
          </div>
          <div className="teacher-command-actions">
            <Link href="/app/teacher/reports" className="platform-secondary-button">
              Reports
            </Link>
            <Link href="/app/teacher/messages" className="platform-secondary-button">
              <MessageSquare size={15} />
              Message learners
            </Link>
          </div>
        </section>
      </motion.div>
    </PlatformShell>
  );
}

function BranchAdminOperationsDashboard() {
  const meta = roleMeta.branchadmin;
  const state = useMemo(() => platformStore.getState(), []);
  const actor =
    state.users.find((user) => user.id === "usr_branch_demo") ??
    state.users.find((user) => user.activeRole === "branchadmin");
  const branch = state.branches.find((item) => item.id === actor?.branchId) ?? state.branches.find((item) => item.id === "br_cairo") ?? state.branches[0];
  const branchId = branch?.id ?? actor?.branchId ?? "";
  const branchUsers = state.users.filter((user) => user.branchId === branchId || user.id === actor?.id);
  const branchRuns = state.courseRuns.filter((run) => run.branchId === branchId);
  const branchRunIds = new Set(branchRuns.map((run) => run.id));
  const branchClasses = state.classGroups.filter((group) => branchRunIds.has(group.courseRunId));
  const branchClassIds = new Set(branchClasses.map((group) => group.id));
  const branchSessions = state.classSessions
    .filter((session) => branchClassIds.has(session.classGroupId))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const branchEnrollmentStudentIds = new Set(state.enrollments.filter((enrollment) => branchRunIds.has(enrollment.courseRunId)).map((enrollment) => enrollment.studentId));
  const branchStudents = state.students.filter((student) => {
    const user = state.users.find((item) => item.id === student.userId);
    return branchEnrollmentStudentIds.has(student.id) || user?.branchId === branchId;
  });
  const branchStudentIds = new Set(branchStudents.map((student) => student.id));
  const branchTeachers = state.teachers.filter((teacher) => {
    const user = state.users.find((item) => item.id === teacher.userId);
    return user?.branchId === branchId || state.teacherAvailability.some((slot) => slot.teacherId === teacher.userId && slot.branchId === branchId);
  });
  const branchRooms = state.rooms.filter((room) => room.branchId === branchId);
  const activeRooms = branchRooms.filter((room) => room.status === "active").length;
  const roomCapacity = branchRooms.reduce((total, room) => total + room.capacity, 0);
  const assignedSeats = branchClasses.reduce((total, group) => total + group.studentIds.length, 0);
  const branchEvents = state.events
    .filter((event) => event.branchId === branchId || (event.classGroupId ? branchClassIds.has(event.classGroupId) : false))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = branchSessions.filter((session) => session.startsAt.slice(0, 10) === todayKey);
  const visibleSessions = todaySessions.length ? todaySessions : branchSessions.slice(0, 4);
  const pendingScheduleReviews = branchEvents.filter((event) => event.status === "pending");
  const branchAttendance = state.attendance.filter((record) => branchClassIds.has(record.classGroupId) && branchStudentIds.has(record.studentId));
  const attendanceExceptions = branchAttendance.filter((record) => record.status === "late" || record.status === "absent" || record.status === "excused");
  const missingAttendance = branchSessions.filter((session) => !session.attendanceSaved);
  const branchInvoices = state.invoices.filter((invoice) => branchStudentIds.has(invoice.studentId));
  const paymentRows = branchInvoices.map((invoice) => {
    const paid = state.payments
      .filter((payment) => payment.invoiceId === invoice.id && payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);
    return { invoice, paid, balance: Math.max(0, invoice.amount - paid) };
  });
  const openPayments = paymentRows.filter((row) => row.balance > 0 || row.invoice.status !== "paid");
  const balanceDue = paymentRows.reduce((sum, row) => sum + row.balance, 0);
  const branchAudits = state.auditLogs
    .filter((audit) =>
      branchClassIds.has(audit.entityId) ||
      branchRooms.some((room) => room.id === audit.entityId) ||
      branchInvoices.some((invoice) => invoice.id === audit.entityId) ||
      /branch|room|calendar|attendance|payment|message/i.test(`${audit.action} ${audit.summary}`),
    )
    .slice(0, 4);
  const seatUsage = roomCapacity ? Math.round((assignedSeats / roomCapacity) * 100) : 0;
  const dashboardStats: Stat[] = [
    { label: "Classes today", value: String(todaySessions.length), change: `${branchSessions.length} scheduled`, tone: todaySessions.length ? "teal" : "amber" },
    { label: "Room usage", value: `${activeRooms}/${branchRooms.length}`, change: `${seatUsage}% seats`, tone: activeRooms === branchRooms.length ? "green" : "amber" },
    { label: "Attendance exceptions", value: String(attendanceExceptions.length), change: `${missingAttendance.length} unsaved`, tone: attendanceExceptions.length || missingAttendance.length ? "red" : "green" },
    { label: "Payment balance", value: `EGP ${balanceDue}`, change: `${openPayments.length} open`, tone: balanceDue ? "amber" : "green" },
  ];

  return (
    <PlatformShell role="branchadmin" title="Dashboard">
      <PlatformPageHeader
        compact
        title={`${branch?.name ?? "Branch"} operations`}
        description="Local rooms, schedule, students, teachers, attendance exceptions, and internal payment readiness."
        actions={
          <>
          <Link href="/app/branch/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href="/app/branch/rooms" className="platform-primary-button" style={{ background: meta.color }}>
            <Building2 size={15} />
            Manage rooms
          </Link>
          </>
        }
      />

      <motion.div className="platform-admin-status-strip platform-branch-status-strip" initial="hidden" animate="visible">
        {[
          ["Branch scope", branch?.name ?? "Unassigned"],
          ["Local users", `${branchUsers.length} active records`],
          ["Schedule reviews", `${pendingScheduleReviews.length} pending`],
          ["Audit evidence", `${branchAudits.length} recent rows`],
        ].map(([label, value], index) => (
          <motion.article key={label} custom={0.03 + index * 0.035} variants={dashboardReveal}>
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-metric-grid platform-admin-metric-grid" initial="hidden" animate="visible">
        {dashboardStats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.07 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="branch-ops-layout" initial="hidden" animate="visible" custom={0.14} variants={dashboardReveal}>
        <section className="branch-panel branch-scope-panel">
          <div className="branch-panel-head">
            <div>
              <span>Assigned branch</span>
              <strong>{branch?.name ?? "No branch assigned"}</strong>
            </div>
            <Building2 size={18} />
          </div>
          <div className="branch-scope-card">
            <span>{branch?.code ?? "BR"}</span>
            <div>
              <strong>{branch?.address ?? "Branch address pending"}</strong>
              <small>{branch?.timezone ?? "Africa/Cairo"} · {branch?.status ?? "pending"}</small>
            </div>
          </div>
          <div className="branch-readiness-list">
            <article>
              <strong>Students</strong>
              <small>{branchStudents.length} learner profiles in this branch</small>
            </article>
            <article>
              <strong>Teachers</strong>
              <small>{branchTeachers.length} teacher profiles or availability blocks</small>
            </article>
            <article>
              <strong>Classes</strong>
              <small>{branchClasses.length} groups across {branchRuns.length} course runs</small>
            </article>
            <article>
              <strong>Rooms</strong>
              <small>{activeRooms} active of {branchRooms.length} configured</small>
            </article>
          </div>
        </section>

        <section className="branch-panel branch-schedule-panel">
          <div className="branch-panel-head">
            <div>
              <span>Schedule control</span>
              <strong>{todaySessions.length ? "Today" : "Next sessions"}</strong>
            </div>
            <Clock size={18} />
          </div>
          <div className="branch-class-list">
            {visibleSessions.length ? visibleSessions.map((session) => {
              const group = branchClasses.find((item) => item.id === session.classGroupId);
              const run = branchRuns.find((item) => item.id === group?.courseRunId);
              const teacher = state.users.find((item) => item.id === run?.teacherId);
              return (
                <article key={session.id}>
                  <div>
                    <strong>{session.title}</strong>
                    <small>{group?.name ?? "Class group"} · {teacher?.name ?? "Teacher pending"}</small>
                  </div>
                  <span>{session.attendanceSaved ? "saved" : "attendance due"}</span>
                  <em>{new Date(session.startsAt).toLocaleString()}</em>
                </article>
              );
            }) : (
              <article>
                <div>
                  <strong>No scheduled class sessions</strong>
                  <small>Create a branch event to populate the local schedule.</small>
                </div>
                <span>empty</span>
              </article>
            )}
          </div>
          <Link href="/app/branch/schedule" className="platform-secondary-button">
            <CalendarDays size={15} />
            Open schedule
          </Link>
        </section>

        <section className="branch-panel branch-room-panel">
          <div className="branch-panel-head">
            <div>
              <span>Room usage</span>
              <strong>{assignedSeats}/{roomCapacity || 0} seats planned</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="branch-room-list">
            {branchRooms.slice(0, 5).map((room) => (
              <article key={room.id}>
                <div>
                  <strong>{room.name}</strong>
                  <small>{room.capacity} seats · {room.equipment.join(", ") || "No equipment listed"}</small>
                </div>
                <span className="platform-status" style={{ color: room.status === "active" ? toneColor.green : toneColor.amber, background: room.status === "active" ? `${toneColor.green}14` : `${toneColor.amber}18` }}>
                  {room.status}
                </span>
              </article>
            ))}
            {!branchRooms.length ? (
              <article>
                <div>
                  <strong>No rooms configured</strong>
                  <small>Add rooms before publishing local class schedules.</small>
                </div>
                <span className="platform-status">setup</span>
              </article>
            ) : null}
          </div>
          <Link href="/app/branch/rooms" className="platform-secondary-button">
            <Plus size={15} />
            Room operations
          </Link>
        </section>
      </motion.div>

      <motion.div className="branch-ops-lower-grid branch-ops-command-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        <section className="branch-panel branch-attendance-panel">
          <div className="branch-panel-head">
            <div>
              <span>Attendance exceptions</span>
              <strong>{attendanceExceptions.length} records</strong>
            </div>
            <AlertTriangle size={18} />
          </div>
          <div className="branch-class-list compact">
            {attendanceExceptions.slice(0, 5).map((record) => {
              const student = state.students.find((item) => item.id === record.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              const group = branchClasses.find((item) => item.id === record.classGroupId);
              return (
                <article key={record.id}>
                  <div>
                    <strong>{user?.name ?? record.studentId}</strong>
                    <small>{group?.name ?? "Branch class"} · {record.notes ?? "No note"}</small>
                  </div>
                  <span>{record.status}</span>
                </article>
              );
            })}
            {!attendanceExceptions.length ? (
              <article>
                <div>
                  <strong>No attendance exceptions</strong>
                  <small>Late, absent, and excused rows will appear here after attendance is saved.</small>
                </div>
                <span>clear</span>
              </article>
            ) : null}
          </div>
          <Link href="/app/branch/attendance" className="platform-secondary-button">
            <ClipboardList size={15} />
            Attendance desk
          </Link>
        </section>

        <section className="branch-panel branch-payment-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch payments</span>
              <strong>EGP {balanceDue} balance</strong>
            </div>
            <CreditCard size={18} />
          </div>
          <div className="branch-class-list compact">
            {openPayments.slice(0, 5).map((row) => {
              const student = state.students.find((item) => item.id === row.invoice.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              return (
                <article key={row.invoice.id}>
                  <div>
                    <strong>{user?.name ?? row.invoice.studentId}</strong>
                    <small>{row.invoice.id} · due {new Date(row.invoice.dueAt).toLocaleDateString()}</small>
                  </div>
                  <span>{row.invoice.currency} {row.balance}</span>
                </article>
              );
            })}
            {!openPayments.length ? (
              <article>
                <div>
                  <strong>Payment queue is clear</strong>
                  <small>Open internal invoices for this branch will appear here.</small>
                </div>
                <span>paid</span>
              </article>
            ) : null}
          </div>
          <Link href="/app/branch/payments" className="platform-secondary-button">
            <CreditCard size={15} />
            Payment overview
          </Link>
        </section>

        <section className="branch-panel branch-audit-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch evidence</span>
              <strong>{branchAudits.length} recent audits</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="admin-audit-list">
            {branchAudits.length ? branchAudits.map((audit) => (
              <article key={audit.id}>
                <strong>{audit.action}</strong>
                <small>{audit.summary}</small>
                <span>{new Date(audit.createdAt).toLocaleString()}</span>
              </article>
            )) : (
              <article>
                <strong>branch.ready</strong>
                <small>Room, schedule, attendance, and payment actions will write audit evidence.</small>
                <span>Ready</span>
              </article>
            )}
          </div>
          <Link href="/app/branch/reports" className="platform-secondary-button">
            <Database size={15} />
            Branch reports
          </Link>
        </section>
      </motion.div>
    </PlatformShell>
  );
}

type AdminCapability = {
  label: string;
  description: string;
  metric: string;
  href: string;
  Icon: LucideIcon;
  tone: Stat["tone"];
};

const adminQuickActions = [
  { label: "Create user", description: "Open the user management workspace", href: "/app/admin/users", Icon: Users },
  { label: "Manage roles", description: "Review RBAC rules and assignments", href: "/app/admin/roles", Icon: KeyRound },
  { label: "Review audit logs", description: "Trace platform activity", href: "/app/admin/audit-logs", Icon: ScrollText },
  { label: "Open integrations", description: "Check Moodle, email, meetings, payments", href: "/app/admin/integrations", Icon: PlugZap },
];

const hodCapabilities: AdminCapability[] = [
  {
    label: "Departments",
    description: "Review academic ownership, program responsibility, and department KPIs.",
    metric: "Arabic and Quran",
    href: "/app/hod/departments",
    Icon: Building2,
    tone: "purple",
  },
  {
    label: "Programs and levels",
    description: "Coordinate pathways, levels, placement outcomes, and progression gates.",
    metric: "7 pathways",
    href: "/app/hod/programs",
    Icon: Library,
    tone: "teal",
  },
  {
    label: "Course map",
    description: "Open courses and imported Moodle sections for academic review.",
    metric: "42 courses",
    href: "/app/hod/courses",
    Icon: BookOpen,
    tone: "green",
  },
  {
    label: "Curriculum coverage",
    description: "Track outcomes, lesson sequencing, activities, and hidden teacher-only material.",
    metric: "82% mapped",
    href: "/app/hod/curriculum",
    Icon: BookCopy,
    tone: "amber",
  },
  {
    label: "Teacher quality",
    description: "Review observations, class health, teacher load, and intervention notes.",
    metric: "12 notes",
    href: "/app/hod/teachers",
    Icon: GraduationCap,
    tone: "slate",
  },
  {
    label: "Assessment approvals",
    description: "Review quizzes, certificate eligibility, and academic approval queues.",
    metric: "5 pending",
    href: "/app/hod/certificates",
    Icon: Award,
    tone: "red",
  },
];

const hodQuickActions = [
  { label: "Edit curriculum", description: "Update outcomes and lesson sequence", href: "/app/hod/curriculum", Icon: BookCopy },
  { label: "Assign teacher", description: "Balance teacher load and ownership", href: "/app/hod/teachers", Icon: GraduationCap },
  { label: "Review assessments", description: "Open quizzes and grading quality", href: "/app/hod/assessments", Icon: ListChecks },
  { label: "Approve certificates", description: "Check grade and attendance eligibility", href: "/app/hod/certificates", Icon: Award },
];

function HeadOfDepartmentDashboard() {
  const dashboard = dashboardByRole.headofdepartment;
  const meta = roleMeta.headofdepartment;
  const permissionCount = rolePermissions.headofdepartment.length;
  const navCount = sidebarByRole.headofdepartment.length;
  const state = platformStore.getState();
  const actorUser =
    state.users.find((user) => user.id === "usr_hod_demo") ??
    state.users.find((user) => user.activeRole === "headofdepartment");
  const departmentIds = new Set(
    state.departments
      .filter((department) => department.ownerUserId === actorUser?.id || department.id === actorUser?.departmentId)
      .map((department) => department.id),
  );
  const programIds = new Set(
    state.programs
      .filter((program) => departmentIds.has(program.departmentId))
      .map((program) => program.id),
  );
  const courseIds = new Set(
    state.courses
      .filter((course) => programIds.has(course.programId))
      .map((course) => course.id),
  );
  const courseRuns = state.courseRuns.filter((run) => courseIds.has(run.courseId));
  const courseRunIds = new Set(courseRuns.map((run) => run.id));
  const classes = state.classGroups.filter((group) => courseRunIds.has(group.courseRunId));
  const classCapacity = classes.reduce((total, classGroup) => total + classGroup.capacity, 0);
  const enrolledSeats = classes.reduce((total, classGroup) => total + classGroup.studentIds.length, 0);
  const enrollments = state.enrollments.filter((enrollment) => courseRunIds.has(enrollment.courseRunId));
  const studentIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
  const teachers = state.teachers.filter((teacher) => departmentIds.has(teacher.departmentId));
  const modules = state.modules.filter((module) => courseIds.has(module.courseId));
  const moduleIds = new Set(modules.map((module) => module.id));
  const lessons = state.lessons.filter((lesson) => moduleIds.has(lesson.moduleId));
  const assignments = state.assignments.filter((assignment) => courseRunIds.has(assignment.courseRunId));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const quizzes = state.quizzes.filter((quiz) => courseRunIds.has(quiz.courseRunId));
  const quizIds = new Set(quizzes.map((quiz) => quiz.id));
  const completedAssessmentRows =
    state.assignmentSubmissions.filter((submission) => assignmentIds.has(submission.assignmentId) && submission.status === "completed").length +
    state.quizAttempts.filter((attempt) => quizIds.has(attempt.quizId) && attempt.status === "completed").length;
  const expectedAssessmentRows = studentIds.size * (assignments.length + quizzes.length);
  const assessmentCompletion = expectedAssessmentRows
    ? Math.round((completedAssessmentRows / expectedAssessmentRows) * 100)
    : 0;
  const certificates = state.certificates.filter((certificate) => courseIds.has(certificate.courseId) && studentIds.has(certificate.studentId));
  const pendingCertificates = certificates.filter((certificate) => certificate.status === "pending_approval").length;
  const rejectedCertificates = certificates.filter((certificate) => certificate.status === "rejected").length;
  const atRiskEnrollments = enrollments.filter((enrollment) => enrollment.attendanceRate < 85 || enrollment.currentGrade < 80 || enrollment.progress < 55);
  const activeCourses = state.courses.filter((course) => courseIds.has(course.id) && course.status === "active").length;
  const curriculumCoverage = modules.length ? Math.min(100, Math.round((lessons.length / (modules.length * 3)) * 100)) : 0;
  const seatUsage = classCapacity ? Math.round((enrolledSeats / classCapacity) * 100) : 0;
  const hodStats = [
    { label: "Department courses", value: String(courseIds.size), change: `${activeCourses} active`, tone: "teal" as const },
    { label: "Curriculum coverage", value: `${curriculumCoverage}%`, change: `${lessons.length} lessons`, tone: "amber" as const },
    { label: "Teacher load", value: String(teachers.length), change: `${classes.length} classes`, tone: "green" as const },
    { label: "At-risk learners", value: String(atRiskEnrollments.length), change: `${pendingCertificates} certificates`, tone: atRiskEnrollments.length ? "red" as const : "teal" as const },
  ];
  const courseHealth = state.courses
    .filter((course) => courseIds.has(course.id))
    .map((course) => {
      const runs = courseRuns.filter((run) => run.courseId === course.id);
      const runIds = new Set(runs.map((run) => run.id));
      const courseEnrollments = enrollments.filter((enrollment) => runIds.has(enrollment.courseRunId));
      const averageProgress = courseEnrollments.length
        ? Math.round(courseEnrollments.reduce((total, enrollment) => total + enrollment.progress, 0) / courseEnrollments.length)
        : 0;
      return { course, averageProgress, enrollments: courseEnrollments.length };
    })
    .sort((a, b) => a.averageProgress - b.averageProgress);
  const dashboardRecords = [
    {
      id: "certificate_queue",
      title: "Certificate approval queue",
      subtitle: `${pendingCertificates} pending · ${rejectedCertificates} rejected`,
      status: pendingCertificates ? "Review" : "Clear",
      owner: actorUser?.name ?? "HOD",
      due: "Today",
      metric: `${certificates.length} total`,
      tone: pendingCertificates ? "red" as const : "teal" as const,
    },
    {
      id: "curriculum_coverage",
      title: "Curriculum coverage",
      subtitle: `${modules.length} modules and ${lessons.length} lessons mapped`,
      status: curriculumCoverage >= 80 ? "Healthy" : "Gap",
      owner: state.departments.find((department) => departmentIds.has(department.id))?.name ?? "Department",
      due: "Weekly",
      metric: `${curriculumCoverage}%`,
      tone: curriculumCoverage >= 80 ? "green" as const : "amber" as const,
    },
    {
      id: "assessment_completion",
      title: "Assessment completion",
      subtitle: `${completedAssessmentRows}/${expectedAssessmentRows} submissions and attempts completed`,
      status: assessmentCompletion >= 75 ? "On track" : "Review",
      owner: "Academic team",
      due: "This week",
      metric: `${assessmentCompletion}%`,
      tone: assessmentCompletion >= 75 ? "green" as const : "amber" as const,
    },
    {
      id: "course_risk",
      title: courseHealth[0]?.course.title ?? "Course health",
      subtitle: courseHealth[0] ? `${courseHealth[0].enrollments} enrollments in the lowest progress course` : "No course risk rows",
      status: courseHealth[0]?.averageProgress && courseHealth[0].averageProgress < 60 ? "At risk" : "Stable",
      owner: "HOD",
      due: "Live",
      metric: `${courseHealth[0]?.averageProgress ?? 0}%`,
      tone: courseHealth[0]?.averageProgress && courseHealth[0].averageProgress < 60 ? "red" as const : "teal" as const,
    },
  ];
  const capabilityMetrics: Record<string, string> = {
    Departments: `${departmentIds.size} owned`,
    Programs: `${programIds.size} active`,
    Courses: `${activeCourses}/${courseIds.size} active`,
    Curriculum: `${curriculumCoverage}% mapped`,
    "Teacher quality": `${teachers.length} teachers`,
    "Assessment approvals": `${pendingCertificates} pending`,
  };

  return (
    <PlatformShell role="headofdepartment" title="Dashboard">
      <PlatformPageHeader
        compact
        title={dashboard.title}
        description={dashboard.subtitle}
        actions={
          <>
          <Link href="/app/hod/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href="/app/hod/courses" className="platform-primary-button" style={{ background: meta.color }}>
            <Plus size={15} />
            Course plan
          </Link>
          </>
        }
      />

      <motion.div className="platform-admin-status-strip platform-academic-status-strip" initial="hidden" animate="visible">
        {[
          ["Academic scope", state.departments.filter((department) => departmentIds.has(department.id)).map((department) => department.name).join(", ") || "Department"],
          ["HOD modules", `${navCount} workspaces`],
          ["Approval rights", `${permissionCount} permissions`],
          ["Review queue", `${pendingCertificates} certificates`],
        ].map(([label, value], index) => (
          <motion.article key={label} custom={0.03 + index * 0.035} variants={dashboardReveal}>
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-metric-grid platform-admin-metric-grid" initial="hidden" animate="visible">
        {hodStats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.07 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-admin-layout" initial="hidden" animate="visible" custom={0.16} variants={dashboardReveal}>
        <section className="platform-admin-command platform-academic-command">
          <div className="platform-admin-command-copy">
            <span>Academic command center</span>
            <h2>Keep curriculum, teacher quality, assessments, and certificates aligned across the department.</h2>
            <p>HOD work starts from academic evidence: coverage, observation notes, eligibility, and course structure.</p>
          </div>

          <div className="platform-admin-command-grid">
            {[
              { label: "Curriculum", value: `${curriculumCoverage}%`, color: toneColor.teal },
              { label: "Seat usage", value: `${seatUsage}%`, color: toneColor.green },
              { label: "Certificates", value: String(pendingCertificates), color: toneColor.purple },
            ].map((item) => (
              <article key={item.label} style={{ "--item-color": item.color } as CSSProperties}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="platform-admin-command-actions">
            <Link href="/app/hod/moodle-source" className="platform-secondary-button">
              <PlugZap size={15} />
              Moodle source
            </Link>
            <Link href="/app/hod/certificates" className="platform-primary-button" style={{ background: meta.color }}>
              {dashboard.spotlight.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <aside className="platform-admin-action-panel platform-academic-action-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Academic tools</span>
              <strong>Review actions</strong>
            </div>
          </div>
          <div className="platform-admin-action-list">
            {hodQuickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <span>
                  <action.Icon size={16} />
                </span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </motion.div>

      <motion.section className="platform-admin-capability-grid platform-academic-capability-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        {hodCapabilities.map((item) => (
          <Link key={item.label} href={item.href} className="platform-admin-capability-card" style={{ "--item-color": toneColor[item.tone] } as CSSProperties}>
            <span>
              <item.Icon size={18} />
            </span>
            <div>
              <small>{capabilityMetrics[item.label] ?? item.metric}</small>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
            <ArrowRight size={15} />
          </Link>
        ))}
      </motion.section>

      <motion.section className="platform-admin-event-board platform-academic-event-board" initial="hidden" animate="visible" custom={0.24} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Academic review stream</span>
            <strong>Today</strong>
          </div>
          <Link href="/app/hod/reports" className="platform-secondary-button compact">
            Reports
          </Link>
        </div>
        <div className="platform-admin-event-head" aria-hidden="true">
          <span>Item</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Metric</span>
        </div>
        <div className="platform-admin-event-list">
          {dashboardRecords.map((record) => (
            <article key={record.id} className="platform-admin-event-row">
              <div>
                <strong>{record.title}</strong>
                <small>{record.subtitle}</small>
              </div>
              <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
                {record.status}
              </span>
              <span className="platform-admin-event-meta" data-label="Owner">{record.owner}</span>
              <span className="platform-admin-event-meta" data-label="Due">{record.due}</span>
              <span className="platform-admin-event-meta" data-label="Metric">{record.metric}</span>
            </article>
          ))}
        </div>
      </motion.section>
    </PlatformShell>
  );
}

function SuperAdminDashboard() {
  const dashboard = dashboardByRole.superadmin;
  const meta = roleMeta.superadmin;
  const state = useMemo(() => platformStore.getState(), []);
  const permissionCount = rolePermissions.superadmin.length;
  const navCount = sidebarByRole.superadmin.length;
  const activeUsers = state.users.filter((user) => user.status === "active").length;
  const activeStudents = state.students.filter((student) => student.status === "active").length;
  const activeClasses = state.classGroups.length;
  const connectedIntegrations = state.integrations.filter((integration) => integration.status === "connected").length;
  const usableIntegrations = state.integrations.filter((integration) => integration.status === "connected" || integration.status === "mock_mode").length;
  const pendingInvoices = state.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled").length;
  const platformEntityTotal =
    state.users.length +
    state.branches.length +
    state.departments.length +
    state.programs.length +
    state.courses.length +
    state.courseRuns.length +
    state.classGroups.length +
    state.enrollments.length +
    state.events.length +
    state.auditLogs.length;
  const integrationReadiness = state.integrations.length
    ? Math.round((usableIntegrations / state.integrations.length) * 100)
    : 0;
  const superAdminStats: Stat[] = [
    { label: "Users in state", value: `${activeUsers}/${state.users.length}`, change: "active accounts", tone: "teal" },
    { label: "Active learners", value: String(activeStudents), change: `${state.enrollments.length} enrollments`, tone: "green" },
    { label: "Class groups", value: String(activeClasses), change: `${state.events.length} scheduled events`, tone: "amber" },
    { label: "Integration readiness", value: `${integrationReadiness}%`, change: `${connectedIntegrations} connected`, tone: "purple" },
  ];
  const capabilities: AdminCapability[] = [
    {
      label: "Identity and users",
      description: "Create staff, assign roles, pause accounts, and inspect branch/department scope.",
      metric: `${state.users.length} accounts`,
      href: "/app/admin/users",
      Icon: Users,
      tone: "teal",
    },
    {
      label: "Roles and permissions",
      description: "Control who can read, edit, approve, report, message, and audit each module.",
      metric: `${permissionCount} permissions`,
      href: "/app/admin/roles",
      Icon: ShieldCheck,
      tone: "amber",
    },
    {
      label: "Branch network",
      description: "Review global branches, departments, rooms, and operational ownership.",
      metric: `${state.branches.length} branches`,
      href: "/app/admin/branches",
      Icon: Building2,
      tone: "green",
    },
    {
      label: "Programs and courses",
      description: "Govern Arabic, Quran, language, kids, and teacher-training course catalogs.",
      metric: `${state.courses.length} courses`,
      href: "/app/admin/courses",
      Icon: BookOpen,
      tone: "purple",
    },
    {
      label: "Moodle source",
      description: "Track observed Moodle course sections, activities, and future sync coverage.",
      metric: `${state.modules.length} modules`,
      href: "/app/admin/moodle-source",
      Icon: Database,
      tone: "slate",
    },
    {
      label: "Audit and health",
      description: "Open audit evidence, connector readiness, settings, and system health checks.",
      metric: `${state.auditLogs.length} audit rows`,
      href: "/app/admin/system-health",
      Icon: Activity,
      tone: "red",
    },
  ];
  const hierarchy = [
    {
      label: "Global governance",
      detail: "Super Admin owns platform settings, RBAC, audit evidence, and connector boundaries.",
      metric: `${navCount} admin workspaces`,
      href: "/app/admin/platform-blueprint",
      Icon: Network,
      tone: "slate" as Stat["tone"],
    },
    {
      label: "Academic ownership",
      detail: "Departments, programs, levels, courses, curriculum, certificates, and Moodle source.",
      metric: `${state.departments.length} departments · ${state.programs.length} programs`,
      href: "/app/admin/departments",
      Icon: Library,
      tone: "purple" as Stat["tone"],
    },
    {
      label: "Branch operations",
      detail: "Branches, rooms, branch classes, attendance exceptions, payments, and local schedules.",
      metric: `${state.branches.length} branches · ${state.rooms.length} rooms`,
      href: "/app/admin/branches",
      Icon: Building2,
      tone: "green" as Stat["tone"],
    },
    {
      label: "Admissions and finance",
      detail: "Leads, placement tests, enrollment workflows, invoices, payment records, and reports.",
      metric: `${state.leads.length} lead · ${pendingInvoices} pending invoices`,
      href: "/app/admin/reports",
      Icon: ScrollText,
      tone: "amber" as Stat["tone"],
    },
    {
      label: "Teaching delivery",
      detail: "Teachers, course runs, class groups, resources, assessments, Quran review, and messages.",
      metric: `${state.teachers.length} teacher · ${state.classGroups.length} classes`,
      href: "/app/admin/moodle-source",
      Icon: GraduationCap,
      tone: "teal" as Stat["tone"],
    },
  ];
  const latestIdentityAudit = state.auditLogs.find((audit) =>
    ["staff.user.created", "user.created", "user.updated"].includes(audit.action),
  );
  const latestPermissionAudit = state.auditLogs.find((audit) => audit.action === "permission.updated");
  const latestBranchAudit = state.auditLogs.find((audit) => audit.action === "branch.updated");
  const latestCourseAudit = state.auditLogs.find((audit) => audit.action === "course.status_updated" || audit.action === "curriculum.module_created");
  const latestIntegrationAudit = state.auditLogs.find((audit) => audit.action.startsWith("integration."));
  const latestSystemAudit = state.auditLogs.find((audit) => audit.action === "system.health_checked" || audit.action === "settings.saved");
  const totalPermissionGrants = Object.values(state.permissions).reduce((total, permissions) => total + permissions.length, 0);
  const governanceRecords: Array<{
    id: string;
    title: string;
    subtitle: string;
    status: string;
    owner: string;
    due: string;
    metric: string;
    tone: Stat["tone"];
  }> = [
    {
      id: "identity",
      title: "Identity directory",
      subtitle: latestIdentityAudit?.summary ?? `${state.users.length} user accounts scoped across roles and branches.`,
      status: latestIdentityAudit ? "Audited" : "Ready",
      owner: "Super Admin",
      due: "Live",
      metric: `${activeUsers}/${state.users.length} active`,
      tone: "teal",
    },
    {
      id: "rbac",
      title: "Role and permission matrix",
      subtitle: latestPermissionAudit?.summary ?? `${totalPermissionGrants} permission grants are available in the matrix.`,
      status: latestPermissionAudit ? "Audited" : "Ready",
      owner: "Super Admin",
      due: "Live",
      metric: `${permissionCount} admin grants`,
      tone: "amber",
    },
    {
      id: "branches",
      title: "Branch network",
      subtitle: latestBranchAudit?.summary ?? `${state.branches.length} branches and ${state.rooms.length} rooms are tracked locally.`,
      status: latestBranchAudit ? "Audited" : "Ready",
      owner: "Operations",
      due: "Live",
      metric: `${state.branches.length} branches`,
      tone: "green",
    },
    {
      id: "academics",
      title: "Academic catalog",
      subtitle: latestCourseAudit?.summary ?? `${state.departments.length} departments, ${state.programs.length} programs, and ${state.courses.length} courses.`,
      status: latestCourseAudit ? "Audited" : "Mapped",
      owner: "Academic",
      due: "Live",
      metric: `${state.courses.length} courses`,
      tone: "purple",
    },
    {
      id: "integrations",
      title: "Integration boundaries",
      subtitle: latestIntegrationAudit?.summary ?? "External connectors remain status/config placeholders until server credentials are added.",
      status: latestIntegrationAudit ? "Audited" : "Placeholder",
      owner: "Platform",
      due: "No secrets",
      metric: `${usableIntegrations}/${state.integrations.length} usable`,
      tone: "slate",
    },
    {
      id: "audit",
      title: "Audit and health",
      subtitle: latestSystemAudit?.summary ?? `${state.auditLogs.length} audit events protect administration decisions.`,
      status: latestSystemAudit ? "Audited" : "Open",
      owner: "Platform",
      due: "Live",
      metric: `${state.auditLogs.length} rows`,
      tone: "red",
    },
  ];

  return (
    <PlatformShell role="superadmin" title="Dashboard">
      <PlatformPageHeader
        compact
        title={dashboard.title}
        description={dashboard.subtitle}
        actions={
          <>
          <Link href="/app/admin/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href="/app/admin/users" className="platform-primary-button" style={{ background: meta.color }}>
            <Plus size={15} />
            Quick create
          </Link>
          </>
        }
      />

      <motion.div className="platform-admin-status-strip" initial="hidden" animate="visible">
        {[
          ["Scope", "Global platform"],
          ["Admin modules", `${navCount} workspaces`],
          ["RBAC coverage", `${permissionCount} permissions`],
          ["Data state", `${platformEntityTotal} local records`],
        ].map(([label, value], index) => (
          <motion.article key={label} custom={0.03 + index * 0.035} variants={dashboardReveal}>
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-metric-grid platform-admin-metric-grid" initial="hidden" animate="visible">
        {superAdminStats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.07 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.section className="platform-admin-hierarchy" initial="hidden" animate="visible" custom={0.12} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Platform hierarchy</span>
            <strong>Administration operating map</strong>
          </div>
          <Link href="/app/admin/platform-blueprint" className="platform-secondary-button compact">
            Blueprint
          </Link>
        </div>
        <div className="platform-admin-hierarchy-grid">
          {hierarchy.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className="platform-admin-hierarchy-card"
              style={{ "--item-color": toneColor[item.tone] } as CSSProperties}
            >
              <span className="platform-admin-hierarchy-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="platform-admin-hierarchy-icon">
                <item.Icon size={17} />
              </span>
              <div>
                <small>{item.metric}</small>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      </motion.section>

      <motion.div className="platform-admin-layout" initial="hidden" animate="visible" custom={0.16} variants={dashboardReveal}>
        <section className="platform-admin-command">
          <div className="platform-admin-command-copy">
            <span>Governance command center</span>
            <h2>Govern people, academic structure, branch operations, integrations, and audit evidence from one controlled surface.</h2>
            <p>Every tile opens the module that owns the decision, so administration stays fast without hiding accountability.</p>
          </div>

          <div className="platform-admin-command-grid">
            {[
              { label: "Identity", value: `${activeUsers}/${state.users.length}`, color: toneColor.teal },
              { label: "RBAC", value: `${permissionCount}`, color: toneColor.amber },
              { label: "Integrations", value: `${usableIntegrations}/${state.integrations.length}`, color: toneColor.purple },
            ].map((item) => (
              <article key={item.label} style={{ "--item-color": item.color } as CSSProperties}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="platform-admin-command-actions">
            <Link href="/app/admin/platform-blueprint" className="platform-secondary-button">
              <Network size={15} />
              Blueprint
            </Link>
            <Link href="/app/admin/integrations" className="platform-primary-button" style={{ background: meta.color }}>
              {dashboard.spotlight.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <aside className="platform-admin-action-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Role tools</span>
              <strong>Quick actions</strong>
            </div>
          </div>
          <div className="platform-admin-action-list">
            {adminQuickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <span>
                  <action.Icon size={16} />
                </span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </motion.div>

      <motion.section className="platform-admin-capability-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        {capabilities.map((item) => (
          <Link key={item.label} href={item.href} className="platform-admin-capability-card" style={{ "--item-color": toneColor[item.tone] } as CSSProperties}>
            <span>
              <item.Icon size={18} />
            </span>
            <div>
              <small>{item.metric}</small>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
            <ArrowRight size={15} />
          </Link>
        ))}
      </motion.section>

      <motion.section className="platform-admin-event-board" initial="hidden" animate="visible" custom={0.24} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Live governance stream</span>
            <strong>Today</strong>
          </div>
          <Link href="/app/admin/audit-logs" className="platform-secondary-button compact">
            Audit logs
          </Link>
        </div>
        <div className="platform-admin-event-head" aria-hidden="true">
          <span>Item</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Metric</span>
        </div>
        <div className="platform-admin-event-list">
          {governanceRecords.map((record) => (
            <article key={record.id} className="platform-admin-event-row">
              <div>
                <strong>{record.title}</strong>
                <small>{record.subtitle}</small>
              </div>
              <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
                {record.status}
              </span>
              <span className="platform-admin-event-meta" data-label="Owner">{record.owner}</span>
              <span className="platform-admin-event-meta" data-label="Due">{record.due}</span>
              <span className="platform-admin-event-meta" data-label="Metric">{record.metric}</span>
            </article>
          ))}
        </div>
      </motion.section>
    </PlatformShell>
  );
}
