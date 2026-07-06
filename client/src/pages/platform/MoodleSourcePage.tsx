import { useMemo, useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard, StatusBadge } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import { roleMeta, type Role } from "@/lib/platformData";

type MoodleSourcePageProps = {
  role: Role;
};

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (status === "active") return "green";
  if (status === "draft" || status === "pending") return "amber";
  if (status === "paused" || status === "error") return "red";
  return "slate";
}

function courseRoute(role: Role) {
  if (role === "student") return "/app/student/courses";
  if (role === "teacher") return "/app/teacher/classes";
  if (role === "headofdepartment") return "/app/hod/courses";
  return "/app/admin/courses";
}

export default function MoodleSourcePage({ role }: MoodleSourcePageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const moodle = state.integrations.find(item => item.id === "moodle");
  const roleCourseIds = new Set(
    role === "student"
      ? state.enrollments.map(item => item.courseRunId).flatMap(runId => state.courseRuns.find(run => run.id === runId)?.courseId ?? [])
      : role === "teacher"
        ? state.courseRuns.filter(run => run.teacherId === "usr_teacher_demo").map(run => run.courseId)
        : state.courses.map(course => course.id),
  );
  const rows = state.courses
    .filter(course => (role === "student" || role === "teacher" ? roleCourseIds.has(course.id) : true))
    .map(course => {
      const program = state.programs.find(item => item.id === course.programId);
      const modules = state.modules.filter(item => item.courseId === course.id);
      const lessons = state.lessons.filter(lesson => modules.some(module => module.id === lesson.moduleId));
      const resources = state.resources.filter(resource => lessons.some(lesson => lesson.id === resource.lessonId));
      return { course, program, modules, lessons, resources };
    })
    .filter(row =>
      [row.course.title, row.course.slug, row.program?.title, row.course.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

  return (
    <PlatformShell role={role} title="Moodle">
      <WorkspaceLayout
        className="portal-simple-page"
        title="Moodle"
        description="Review course content mapped from Moodle for this workspace."
        context={roleMeta[role].label}
        actions={
          <Link className="platform-primary-button" href={courseRoute(role)}>
            <BookOpen size={15} />
            Open courses
          </Link>
        }
        toolbar={
          <div className="portal-simple-toolbar">
            <label>
              Search courses
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Course, program, or status"
              />
            </label>
          </div>
        }
        main={
          <DataTableCard title="Mapped courses" subtitle={`${rows.length} course(s)`}>
            <div className="admin-ia-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Program</th>
                    <th>Lessons</th>
                    <th>Resources</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.course.id}>
                      <td>
                        <strong>{row.course.title}</strong>
                        <small>{row.course.slug}</small>
                      </td>
                      <td>{row.program?.title ?? "Program"}</td>
                      <td>{row.lessons.length}</td>
                      <td>{row.resources.length}</td>
                      <td>
                        <StatusBadge tone={statusTone(row.course.status)}>
                          {row.course.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="platform-empty-state">
                          <strong>No mapped courses</strong>
                          <span>Try a different search term.</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DataTableCard>
        }
        side={
          <section className="portal-simple-side-card">
            <span>Connection</span>
            <strong>{moodle?.label ?? "Moodle"}</strong>
            <p>
              {moodle?.status === "connected"
                ? "Connection is configured. Course rows show local mapped records."
                : "Moodle stays as a configured source boundary until sync is enabled."}
            </p>
            <StatusBadge tone={moodle?.status === "connected" ? "green" : "amber"}>
              {moodle?.status?.replace(/_/g, " ") ?? "not configured"}
            </StatusBadge>
            <Link href={courseRoute(role)}>
              <ExternalLink size={14} />
              View course workspace
            </Link>
          </section>
        }
      />
    </PlatformShell>
  );
}
