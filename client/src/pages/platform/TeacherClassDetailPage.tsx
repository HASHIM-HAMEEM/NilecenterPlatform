import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { getActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";

type TeacherClassDetailPageProps = {
  classId: string;
};

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "paused" || status === "cancelled" || status === "overdue") return "red";
  return "slate";
}

function formatDateTime(value?: string) {
  if (!value) return "No upcoming session";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No upcoming session";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function TeacherClassDetailPage({ classId }: TeacherClassDetailPageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [reminderSaving, setReminderSaving] = useState(false);
  const activeUser = getActiveUser();
  const actorId = activeUser?.id ?? "usr_teacher_demo";

  useEffect(() => {
    const refreshState = () => setState(platformStore.getState());
    window.addEventListener("nilelearn:platform-state-updated", refreshState);
    window.addEventListener("storage", refreshState);
    return () => {
      window.removeEventListener("nilelearn:platform-state-updated", refreshState);
      window.removeEventListener("storage", refreshState);
    };
  }, []);

  const classGroup = state.classGroups.find(item => item.id === classId);
  const run = state.courseRuns.find(item => item.id === classGroup?.courseRunId);
  const course = state.courses.find(item => item.id === run?.courseId);
  const branch = state.branches.find(item => item.id === run?.branchId);
  const room = state.rooms.find(item => item.id === classGroup?.roomId);
  const enrollments = state.enrollments.filter(item => item.classGroupId === classGroup?.id);
  const sessions = state.classSessions
    .filter(item => item.classGroupId === classGroup?.id)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const upcomingSession = sessions.find(item => new Date(item.startsAt).getTime() >= Date.now());
  const attendanceQueue = sessions.filter(item => !item.attendanceSaved).length;
  const assignments = state.assignments.filter(item => item.courseRunId === run?.id);
  const moduleIds = new Set(state.modules.filter(item => item.courseId === course?.id).map(item => item.id));
  const lessonIds = new Set(state.lessons.filter(item => moduleIds.has(item.moduleId)).map(item => item.id));
  const resourceCount = state.resources.filter(item => lessonIds.has(item.lessonId)).length;
  const status = run?.status ?? "active";

  if (!classGroup) {
    return (
      <PlatformShell role="teacher" title="Class not found">
        <DetailLayout
          className="teacher-class-detail-page portal-simple-page"
          context="Teacher"
          title="Class not found"
          description="Return to the class list and choose an assigned class."
          actions={
            <Link className="platform-secondary-button" href="/app/teacher/classes">
              <ArrowLeft size={15} />
              All classes
            </Link>
          }
          main={<div className="portal-simple-form-card">This class is not available for the current workspace.</div>}
        />
      </PlatformShell>
    );
  }

  const currentClass = classGroup;
  const firstStudentId = enrollments[0]?.studentId ?? currentClass.studentIds[0];
  const firstStudent = state.students.find(item => item.id === firstStudentId);
  const firstStudentUser = state.users.find(item => item.id === firstStudent?.userId);

  const taskLinks = [
    {
      href: `/app/teacher/classes/${currentClass.id}/sessions`,
      icon: CalendarDays,
      title: "Sessions",
      detail: `${sessions.length} scheduled`,
    },
    {
      href: `/app/teacher/classes/${currentClass.id}/attendance`,
      icon: CheckCircle2,
      title: "Attendance",
      detail: attendanceQueue ? `${attendanceQueue} to check` : "Up to date",
    },
    {
      href: `/app/teacher/classes/${currentClass.id}/students`,
      icon: Users,
      title: "Students",
      detail: `${enrollments.length || currentClass.studentIds.length} enrolled`,
    },
    {
      href: `/app/teacher/classes/${currentClass.id}/materials`,
      icon: FileText,
      title: "Materials",
      detail: `${resourceCount} resources`,
    },
  ];

  const sendClassReminder = async () => {
    if (!firstStudentUser) return;
    setReminderSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: firstStudentUser.id,
      subject: `${currentClass.name} reminder`,
      body: `${currentClass.name} is scheduled for ${currentClass.schedule}.`,
      channel: "in_app",
      actorId,
    });
    setReminderSaving(false);
    if (result.ok && result.data) {
      platformStore.setState(result.data.state);
      setState(result.data.state);
    }
  };

  return (
    <PlatformShell role="teacher" title={currentClass.name}>
      <DetailLayout
        className="teacher-class-detail-page portal-simple-page"
        context="Teacher"
        title={currentClass.name}
        description={`${course?.title ?? "Course"} · ${currentClass.schedule}`}
        actions={
          <>
            <Link className="platform-secondary-button" href="/app/teacher/classes">
              <ArrowLeft size={15} />
              All classes
            </Link>
            <Link className="platform-primary-button" href={`/app/teacher/classes/${currentClass.id}/sessions`}>
              Open sessions
              <ArrowRight size={15} />
            </Link>
            <button
              className="platform-secondary-button teacher-class-reminder-button"
              type="button"
              onClick={() => void sendClassReminder()}
              disabled={reminderSaving || !firstStudentUser}
            >
              {reminderSaving ? "Sending..." : "Send reminder"}
            </button>
          </>
        }
        main={
          <div className="portal-simple-stack">
            <section className="portal-simple-form-card teacher-class-overview">
              <div className="teacher-class-section-heading">
                <span>
                  <BookOpen size={16} />
                  Class overview
                </span>
                <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
              </div>
              <div className="teacher-class-facts">
                <div>
                  <span>Course</span>
                  <strong>{course?.title ?? "Course"}</strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>{branch?.name ?? "Branch"}</strong>
                </div>
                <div>
                  <span>Room</span>
                  <strong>{room?.name ?? "Room not set"}</strong>
                </div>
                <div>
                  <span>Next session</span>
                  <strong>{formatDateTime(upcomingSession?.startsAt)}</strong>
                </div>
              </div>
            </section>

            <section className="portal-simple-form-card teacher-class-task-card">
              <div className="teacher-class-section-heading">
                <span>
                  <ClipboardList size={16} />
                  Class workspaces
                </span>
              </div>
              <div className="teacher-class-task-grid">
                {taskLinks.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} className="teacher-class-task-link" href={item.href}>
                      <span>
                        <Icon size={16} />
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                      <ArrowRight size={15} />
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
