import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard, StatusBadge } from "@/components/platform/PlatformPrimitives";
import { getActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type { ClassGroup, CourseRun, EntityStatus } from "@/lib/domain/types";

type ClassRow = {
  classGroup: ClassGroup;
  run?: CourseRun;
  courseTitle: string;
  branchLabel: string;
  roomLabel: string;
  learnerCount: number;
  nextSessionLabel: string;
  attendancePending: boolean;
  status: EntityStatus;
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

export default function TeacherClassesPage() {
  const state = useMemo(() => platformStore.getState(), []);
  const activeUser = getActiveUser();
  const teacherId = activeUser?.id ?? "usr_teacher_demo";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | EntityStatus>("all");

  const classRows = useMemo<ClassRow[]>(() => {
    const assignedRunIds = new Set(
      state.courseRuns.filter(run => run.teacherId === teacherId).map(run => run.id)
    );

    return state.classGroups
      .filter(classGroup => assignedRunIds.has(classGroup.courseRunId))
      .map(classGroup => {
        const run = state.courseRuns.find(item => item.id === classGroup.courseRunId);
        const course = state.courses.find(item => item.id === run?.courseId);
        const branch = state.branches.find(item => item.id === run?.branchId);
        const room = state.rooms.find(item => item.id === classGroup.roomId);
        const enrollments = state.enrollments.filter(item => item.classGroupId === classGroup.id);
        const sessions = state.classSessions
          .filter(item => item.classGroupId === classGroup.id)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        const nextSession = sessions.find(item => new Date(item.startsAt).getTime() >= Date.now());

        return {
          classGroup,
          run,
          courseTitle: course?.title ?? "Course",
          branchLabel: branch?.name ?? "Branch",
          roomLabel: room?.name ?? "Room not set",
          learnerCount: enrollments.length || classGroup.studentIds.length,
          nextSessionLabel: formatDateTime(nextSession?.startsAt),
          attendancePending: sessions.some(item => !item.attendanceSaved),
          status: run?.status ?? "active",
        };
      });
  }, [state, teacherId]);

  const filteredRows = classRows.filter(row => {
    const text = `${row.classGroup.name} ${row.courseTitle} ${row.branchLabel} ${row.classGroup.schedule}`.toLowerCase();
    const matchesSearch = !search.trim() || text.includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || row.status === status;
    return matchesSearch && matchesStatus;
  });

  const nextClass = classRows.find(row => row.nextSessionLabel !== "No upcoming session") ?? classRows[0];
  return (
    <PlatformShell role="teacher" title="Classes">
      <WorkspaceLayout
        className="teacher-classes-page portal-simple-page"
        title="Classes"
        description="Choose one assigned class."
        context="Teacher"
        actions={
          nextClass ? (
            <Link className="platform-primary-button" href={`/app/teacher/classes/${nextClass.classGroup.id}`}>
              Open next class
              <ArrowRight size={15} />
            </Link>
          ) : null
        }
        toolbar={
          <div className="portal-simple-toolbar teacher-classes-toolbar">
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Class, course, branch"
                />
              </span>
            </label>
            <label>
              Status
              <select value={status} onChange={event => setStatus(event.target.value as "all" | EntityStatus)}>
                <option value="all">All classes</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard title="Assigned classes" subtitle={`${filteredRows.length} classes`}>
            <table className="teacher-classes-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Schedule</th>
                  <th>Learners</th>
                  <th>Next session</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map(row => (
                    <tr key={row.classGroup.id}>
                      <td>
                        <strong>{row.classGroup.name}</strong>
                        <small>
                          {row.courseTitle} · {row.branchLabel}
                        </small>
                      </td>
                      <td>
                        <strong>{row.classGroup.schedule}</strong>
                        <small>{row.roomLabel}</small>
                      </td>
                      <td>
                        <strong>{row.learnerCount}</strong>
                        <small>learners enrolled</small>
                      </td>
                      <td>
                        <strong>{row.nextSessionLabel}</strong>
                        <small>{row.attendancePending ? "Attendance pending" : "Attendance saved"}</small>
                      </td>
                      <td>
                        <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>
                      </td>
                      <td>
                        <Link className="teacher-classes-row-action" href={`/app/teacher/classes/${row.classGroup.id}`}>
                          Open
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <strong>No classes found</strong>
                      <small>Try a different search or status filter.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
