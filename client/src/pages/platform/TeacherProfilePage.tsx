import { useMemo, useState } from "react";
import { CheckCircle2, GraduationCap } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard, StatusBadge } from "@/components/platform/PlatformPrimitives";
import { getActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export default function TeacherProfilePage() {
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);
  const activeUser = getActiveUser() ?? state.users.find(user => user.id === "usr_teacher_demo");
  const user = state.users.find(item => item.id === activeUser?.id) ?? state.users.find(item => item.id === "usr_teacher_demo");
  const teacher = state.teachers.find(item => item.userId === user?.id);
  const staffProfile = state.staffProfiles.find(item => item.userId === user?.id);
  const department = state.departments.find(item => item.id === user?.departmentId);
  const branch = state.branches.find(item => item.id === user?.branchId);
  const runs = state.courseRuns.filter(run => run.teacherId === user?.id);
  const classGroups = state.classGroups.filter(group => runs.some(run => run.id === group.courseRunId));
  const [title, setTitle] = useState(staffProfile?.title ?? "Teacher");
  const [availabilityStatus, setAvailabilityStatus] = useState(staffProfile?.availabilityStatus ?? "available");
  const [saved, setSaved] = useState(false);

  const saveProfile = () => {
    if (!user) return;
    const current = platformStore.getState();
    platformStore.setState({
      ...current,
      staffProfiles: current.staffProfiles.map(item =>
        item.userId === user.id
          ? { ...item, title: title.trim() || item.title, availabilityStatus, updatedAt: new Date().toISOString() }
          : item,
      ),
    });
    setSaved(true);
    setVersion(currentVersion => currentVersion + 1);
  };

  return (
    <PlatformShell role="teacher" title="Profile">
      <DetailLayout
        className="portal-simple-page"
        title={user?.name ?? "Teacher profile"}
        description="Review your teaching profile, classes, and availability."
        context={department?.name ?? "Teaching"}
        actions={
          <button type="button" className="platform-primary-button" onClick={saveProfile}>
            <CheckCircle2 size={15} />
            Save profile
          </button>
        }
        main={
          <div className="portal-simple-stack">
            <section className="portal-simple-form-card">
              <div className="platform-card-title compact">
                <div>
                  <span>Profile</span>
                  <strong>Teaching details</strong>
                </div>
              </div>
              <div className="portal-simple-form-grid">
                <label>
                  Title
                  <input value={title} onChange={event => setTitle(event.target.value)} />
                </label>
                <label>
                  Availability
                  <select value={availabilityStatus} onChange={event => setAvailabilityStatus(event.target.value as typeof availabilityStatus)}>
                    <option value="available">Available</option>
                    <option value="limited">Limited</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </label>
              </div>
              {saved ? <p className="platform-scheduler-feedback success">Profile saved locally.</p> : null}
            </section>

            <DataTableCard title="Assigned classes" subtitle={`${classGroups.length} class group(s)`}>
              <div className="admin-ia-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Course</th>
                      <th>Students</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classGroups.map(group => {
                      const run = runs.find(item => item.id === group.courseRunId);
                      const course = state.courses.find(item => item.id === run?.courseId);
                      const status = run?.status ?? "active";
                      return (
                        <tr key={group.id}>
                          <td>
                            <strong>{group.name}</strong>
                            <small>{group.schedule}</small>
                          </td>
                          <td>{course?.title ?? "Course"}</td>
                          <td>{group.studentIds.length}</td>
                          <td>
                            <StatusBadge tone={status === "active" ? "green" : "amber"}>{status}</StatusBadge>
                          </td>
                        </tr>
                      );
                    })}
                    {!classGroups.length ? (
                      <tr>
                        <td colSpan={4}>
                          <div className="platform-empty-state">
                            <strong>No classes assigned</strong>
                            <span>Your assigned classes will appear here.</span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </DataTableCard>
          </div>
        }
        side={
          <section className="portal-simple-side-card">
            <span>Account</span>
            <strong>{user?.email ?? "No email"}</strong>
            <p>{branch?.name ?? "No branch"} · {department?.name ?? "No department"}</p>
            <StatusBadge tone={user?.status === "active" ? "green" : "amber"}>{user?.status ?? "inactive"}</StatusBadge>
            <div className="portal-simple-mini-list">
              <span><GraduationCap size={14} /> {teacher?.specialties.join(", ") || "Specialties not set"}</span>
              <span>{teacher?.teachingLevels.join(", ") || "Levels not set"}</span>
              <span>Updated {formatDate(staffProfile?.updatedAt)}</span>
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
