import { useMemo, useState } from "react";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { platformStore } from "@/lib/domain/store";
import { roleMeta, type Role } from "@/lib/platformData";

type MoodleSourcePageProps = {
  role: Role;
};

function courseRoute(role: Role) {
  if (role === "student") return "/app/student/courses";
  if (role === "teacher") return "/app/teacher/classes";
  if (role === "headofdepartment") return "/app/hod/courses";
  return "/app/admin/courses";
}

export default function MoodleSourcePage({ role }: MoodleSourcePageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const roleCourseIds = new Set(
    role === "student"
      ? state.enrollments
          .map(item => item.courseRunId)
          .flatMap(
            runId =>
              state.courseRuns.find(run => run.id === runId)?.courseId ?? []
          )
      : role === "teacher"
        ? state.courseRuns
            .filter(run => run.teacherId === "usr_teacher_demo")
            .map(run => run.courseId)
        : state.courses.map(course => course.id)
  );
  const rows = state.courses
    .filter(course =>
      role === "student" || role === "teacher"
        ? roleCourseIds.has(course.id)
        : true
    )
    .map(course => {
      const program = state.programs.find(item => item.id === course.programId);
      const modules = state.modules.filter(item => item.courseId === course.id);
      const lessons = state.lessons.filter(lesson =>
        modules.some(module => module.id === lesson.moduleId)
      );
      const resources = state.resources.filter(resource =>
        lessons.some(lesson => lesson.id === resource.lessonId)
      );
      return { course, program, modules, lessons, resources };
    })
    .filter(row =>
      [row.course.title, row.course.slug, row.program?.title, row.course.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  return (
    <PlatformShell role={role} title="Moodle">
      <WorkspaceLayout
        className="portal-simple-page moodle-source-page"
        title="Moodle content"
        description="Review the course content available to this workspace."
        context={roleMeta[role].label}
        actions={
          <Link className="platform-primary-button" href={courseRoute(role)}>
            <BookOpen size={15} />
            Open courses
          </Link>
        }
        toolbar={
          <div className="moodle-source-toolbar-v3">
            <label>
              <span className="sr-only">Search course content</span>
              <Search size={15} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search course content"
              />
            </label>
          </div>
        }
        main={
          <section
            className="moodle-source-list-v3"
            data-testid={`moodle-source-list-${role}`}
          >
            <div className="moodle-source-list-heading">
              <div>
                <span>Course content</span>
                <h2>Available courses</h2>
              </div>
              <small>{rows.length} course(s)</small>
            </div>
            <div>
              {rows.map(row => (
                <article key={row.course.id}>
                  <div>
                    <span>{row.program?.title ?? "Program"}</span>
                    <strong>{row.course.title}</strong>
                    <p>
                      {row.lessons.length} lesson(s) · {row.resources.length}{" "}
                      resource(s)
                    </p>
                  </div>
                  <span className={`moodle-course-status ${row.course.status}`}>
                    {row.course.status}
                  </span>
                  <Link
                    href={courseRoute(role)}
                    aria-label={`Open ${row.course.title}`}
                  >
                    <ChevronRight size={17} />
                  </Link>
                </article>
              ))}
              {!rows.length ? (
                <div className="moodle-source-empty-v3">
                  <strong>No course content found</strong>
                  <p>Try a different course name or program.</p>
                </div>
              ) : null}
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
