import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarClock, CircleX } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "cancelled" || status === "paused") return "red";
  return "slate";
}

export default function BranchSessionDetailPage({
  sessionId,
}: {
  sessionId: string;
}) {
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState<"reschedule" | "cancel" | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const session = state.classSessions.find(
    item => item.id === sessionId || item.eventId === sessionId
  );
  const event = state.events.find(item => item.id === session?.eventId);
  const classGroup = state.classGroups.find(
    item => item.id === session?.classGroupId
  );
  const courseRun = state.courseRuns.find(
    item => item.id === classGroup?.courseRunId
  );
  const branch = state.branches.find(item => item.id === courseRun?.branchId);
  const rooms = state.rooms.filter(
    item => item.branchId === branch?.id && item.status === "active"
  );
  const attendanceExists = Boolean(
    session &&
      (session.attendanceSaved ||
        state.attendance.some(
          item =>
            item.sessionId === session.id || item.sessionId === session.eventId
        ))
  );
  const [draft, setDraft] = useState(() => ({
    date: session?.startsAt.slice(0, 10) ?? "",
    starts: session?.startsAt.slice(11, 16) ?? "",
    ends: session?.endsAt.slice(11, 16) ?? "",
    roomId: event?.roomId ?? "",
    reason: "",
  }));

  if (!session || !event || !classGroup || !courseRun || !branch) {
    return (
      <PlatformShell role="branchadmin" title="Session">
        <DetailLayout
          title="Session not found"
          description="This session is unavailable in your branch scope."
          actions={<Link href="/app/branch/schedule">Back to schedule</Link>}
          main={<p>No class-session record is available.</p>}
        />
      </PlatformShell>
    );
  }

  const refresh = () => setVersion(value => value + 1);

  const reschedule = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (
      !draft.date ||
      !draft.starts ||
      !draft.ends ||
      draft.starts >= draft.ends
    ) {
      toast.error("Choose a valid session time");
      return;
    }
    if (draft.reason.trim().length < 5) {
      toast.error("Add a short reason for the timetable change");
      return;
    }
    setSaving("reschedule");
    const result = await runPlatformWorkflowActionRequest({
      type: "class.session.reschedule",
      sessionId: session.id,
      startsAt: `${draft.date}T${draft.starts}:00+03:00`,
      endsAt: `${draft.date}T${draft.ends}:00+03:00`,
      roomId: draft.roomId || undefined,
      reason: draft.reason.trim(),
    });
    setSaving(null);
    if (!result.ok || !result.data) {
      toast.error("Session was not rescheduled", { description: result.error });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setDraft(value => ({ ...value, reason: "" }));
    toast.success("Session rescheduled", {
      description: "The teacher and enrolled learners can see the new time.",
    });
  };

  const cancel = async () => {
    if (draft.reason.trim().length < 5) {
      toast.error("Add a short cancellation reason");
      return;
    }
    setSaving("cancel");
    const result = await runPlatformWorkflowActionRequest({
      type: "class.session.cancel",
      sessionId: session.id,
      reason: draft.reason.trim(),
    });
    setSaving(null);
    if (!result.ok || !result.data) {
      toast.error("Session was not cancelled", { description: result.error });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Session cancelled", {
      description:
        "The schedule history was retained and learners were notified.",
    });
  };

  const mutable = new Set<EntityStatus>(["active", "pending"]).has(
    session.status
  );
  const disabled = Boolean(saving) || attendanceExists || !mutable;

  return (
    <PlatformShell role="branchadmin" title="Session">
      <DetailLayout
        className="branch-session-detail-page"
        title={session.title}
        description={`${classGroup.name} · ${branch.name}`}
        context="Class session"
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/branch/schedule"
          >
            <ArrowLeft size={15} />
            Schedule
          </Link>
        }
        main={
          <section
            className="branch-session-workflow"
            data-testid="branch-session-workflow"
          >
            <div className="branch-session-summary">
              <div>
                <span>Status</span>
                <StatusBadge tone={statusTone(session.status)}>
                  {session.status}
                </StatusBadge>
              </div>
              <div>
                <span>Current time</span>
                <strong>{new Date(session.startsAt).toLocaleString()}</strong>
              </div>
              <div>
                <span>Room</span>
                <strong>
                  {state.rooms.find(item => item.id === event.roomId)?.name ??
                    "Online"}
                </strong>
              </div>
            </div>

            {attendanceExists ? (
              <p className="branch-session-lock" role="status">
                Attendance exists for this session. Its time and status are
                locked to preserve academic history; create a replacement
                session instead.
              </p>
            ) : null}

            <form onSubmit={reschedule} className="branch-room-form">
              <label>
                Date
                <input
                  type="date"
                  value={draft.date}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({ ...value, date: change.target.value }))
                  }
                />
              </label>
              <label>
                Starts
                <input
                  type="time"
                  value={draft.starts}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({
                      ...value,
                      starts: change.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Ends
                <input
                  type="time"
                  value={draft.ends}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({ ...value, ends: change.target.value }))
                  }
                />
              </label>
              <label>
                Room
                <select
                  value={draft.roomId}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({
                      ...value,
                      roomId: change.target.value,
                    }))
                  }
                >
                  <option value="">Online / no room</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="branch-session-reason">
                Reason
                <textarea
                  value={draft.reason}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({
                      ...value,
                      reason: change.target.value,
                    }))
                  }
                  placeholder="Why is this session changing?"
                />
              </label>
              <div className="branch-session-actions">
                <button
                  type="submit"
                  data-testid="branch-session-reschedule"
                  disabled={disabled}
                >
                  <CalendarClock size={15} />
                  {saving === "reschedule" ? "Rescheduling" : "Reschedule"}
                </button>
                <button
                  type="button"
                  className="platform-danger-button"
                  data-testid="branch-session-cancel"
                  disabled={disabled}
                  onClick={cancel}
                >
                  <CircleX size={15} />
                  {saving === "cancel" ? "Cancelling" : "Cancel session"}
                </button>
              </div>
            </form>
          </section>
        }
      />
    </PlatformShell>
  );
}
