import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  DoorOpen,
  Search,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type {
  CalendarEvent,
  CalendarEventType,
  EntityStatus,
} from "@/lib/domain/types";

type AdminSchedulePageProps = {
  view: "calendar" | "sessions" | "conflicts" | "rooms" | "activity";
};

type ScheduleTab = {
  href: string;
  label: string;
  active: boolean;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function typeLabel(type: CalendarEventType) {
  return type.replace(/_/g, " ");
}

function statusTone(status: EntityStatus): "green" | "amber" | "slate" {
  if (status === "active") return "green";
  if (status === "pending" || status === "paused") return "amber";
  return "slate";
}

function includesQuery(values: Array<string | undefined>, query: string) {
  if (!query.trim()) return true;
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

function hasScheduleConflict(
  event: CalendarEvent,
  events: CalendarEvent[]
) {
  if (!event.roomId || event.status !== "pending") return false;
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  return events.some(item => {
    if (item.id === event.id || item.roomId !== event.roomId) return false;
    const otherStart = new Date(item.startsAt).getTime();
    const otherEnd = new Date(item.endsAt).getTime();
    return start < otherEnd && end > otherStart;
  });
}

export default function AdminSchedulePage({ view }: AdminSchedulePageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | CalendarEventType>("all");
  const [status, setStatus] = useState<"all" | EntityStatus>("all");

  const tabs: ScheduleTab[] = [
    {
      href: "/app/admin/schedule",
      label: "Calendar",
      active: view === "calendar",
    },
    {
      href: "/app/admin/schedule/sessions",
      label: "Sessions",
      active: view === "sessions",
    },
    {
      href: "/app/admin/schedule/conflicts",
      label: "Conflicts",
      active: view === "conflicts",
    },
    {
      href: "/app/admin/schedule/rooms",
      label: "Rooms",
      active: view === "rooms",
    },
    {
      href: "/app/admin/schedule/activity",
      label: "Activity",
      active: view === "activity",
    },
  ];

  const events = useMemo(
    () =>
      [...state.events].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
    [state.events]
  );

  const typeOptions = Array.from(new Set(events.map(item => item.type)));
  const pendingEvents = events.filter(
    event => event.status === "pending" || hasScheduleConflict(event, events)
  );
  const sessions = useMemo(
    () =>
      [...state.classSessions].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
    [state.classSessions]
  );
  const scheduleAuditRows = state.auditLogs
    .filter(row =>
      /calendar|schedule|session|room/i.test(
        `${row.action} ${row.entityType} ${row.summary}`
      )
    )
    .slice(0, 24);
  const filteredEvents = events.filter(event => {
    const branch = state.branches.find(item => item.id === event.branchId);
    const room = state.rooms.find(item => item.id === event.roomId);
    const text = [event.title, branch?.name, room?.name, typeLabel(event.type)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      text.includes(search.toLowerCase()) &&
      (type === "all" || event.type === type) &&
      (status === "all" || event.status === status)
    );
  });
  const filteredSessions = sessions.filter(session => {
    const group = state.classGroups.find(item => item.id === session.classGroupId);
    const run = state.courseRuns.find(item => item.id === group?.courseRunId);
    const course = state.courses.find(item => item.id === run?.courseId);
    const branch = state.branches.find(item => item.id === run?.branchId);
    return (
      includesQuery(
        [session.title, group?.name, course?.title, branch?.name],
        search
      ) && (status === "all" || session.status === status)
    );
  });
  const filteredRooms = state.rooms.filter(room => {
    const branch = state.branches.find(item => item.id === room.branchId);
    return (
      includesQuery(
        [room.name, branch?.name, room.equipment.join(" "), room.status],
        search
      ) && (status === "all" || room.status === status)
    );
  });
  const filteredActivityRows = scheduleAuditRows.filter(row =>
    includesQuery([row.action, row.entityType, row.summary, row.actorId], search)
  );

  const calendarTable = (
    <DataTableCard
      title="Calendar events"
      subtitle={`${filteredEvents.length} scheduled item(s)`}
      className="admin-ia-table-card admin-schedule-calendar-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th>Date</th>
              <th>Branch</th>
              <th>Room</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(event => {
              const branch = state.branches.find(
                item => item.id === event.branchId
              );
              const room = state.rooms.find(item => item.id === event.roomId);
              return (
                <tr key={event.id}>
                  <td>
                    <strong>{event.title}</strong>
                    <small>{formatDateTime(event.endsAt)}</small>
                  </td>
                  <td>{typeLabel(event.type)}</td>
                  <td>{formatDateTime(event.startsAt)}</td>
                  <td>{branch?.name ?? "No branch"}</td>
                  <td>{room?.name ?? "No room"}</td>
                  <td>
                    <StatusBadge tone={statusTone(event.status)}>
                      {event.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!filteredEvents.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No events found</strong>
                    <span>Try a different search or filter.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const conflictTable = (
    <DataTableCard
      title="Schedule conflicts"
      subtitle={`${pendingEvents.length} item(s) need review`}
      className="admin-ia-table-card admin-schedule-conflicts-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Date</th>
              <th>Issue</th>
              <th>Branch</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pendingEvents.map(event => {
              const branch = state.branches.find(
                item => item.id === event.branchId
              );
              const room = state.rooms.find(item => item.id === event.roomId);
              const conflict = hasScheduleConflict(event, events);
              return (
                <tr key={event.id}>
                  <td>
                    <strong>{event.title}</strong>
                    <small>{room?.name ?? "Room not set"}</small>
                  </td>
                  <td>{formatDateTime(event.startsAt)}</td>
                  <td>
                    {conflict
                      ? "Room time needs review"
                      : "Waiting for schedule approval"}
                  </td>
                  <td>{branch?.name ?? "No branch"}</td>
                  <td>
                    <StatusBadge tone="amber">{event.status}</StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!pendingEvents.length ? (
              <tr>
                <td colSpan={5}>
                  <div className="platform-empty-state">
                    <strong>No schedule conflicts</strong>
                    <span>Pending schedule reviews will appear here.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const sessionsTable = (
    <DataTableCard
      title="Class sessions"
      subtitle={`${filteredSessions.length} session(s)`}
      className="admin-ia-table-card admin-schedule-sessions-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Class</th>
              <th>Course</th>
              <th>Time</th>
              <th>Attendance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map(session => {
              const group = state.classGroups.find(
                item => item.id === session.classGroupId
              );
              const run = state.courseRuns.find(
                item => item.id === group?.courseRunId
              );
              const course = state.courses.find(item => item.id === run?.courseId);
              return (
                <tr key={session.id}>
                  <td>
                    <strong>{session.title}</strong>
                    <small>{session.id}</small>
                  </td>
                  <td>{group?.name ?? "No class"}</td>
                  <td>{course?.title ?? "No course"}</td>
                  <td>
                    <strong>{formatDateTime(session.startsAt)}</strong>
                    <small>Ends {formatDateTime(session.endsAt)}</small>
                  </td>
                  <td>{session.attendanceSaved ? "Saved" : "Not saved"}</td>
                  <td>
                    <StatusBadge tone={statusTone(session.status)}>
                      {session.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!filteredSessions.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No sessions found</strong>
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

  const roomsTable = (
    <DataTableCard
      title="Room availability"
      subtitle={`${filteredRooms.length} room(s)`}
      className="admin-ia-table-card admin-schedule-rooms-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Branch</th>
              <th>Capacity</th>
              <th>Equipment</th>
              <th>Bookings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.map(room => {
              const branch = state.branches.find(item => item.id === room.branchId);
              const roomEvents = events.filter(event => event.roomId === room.id);
              const nextBooking = roomEvents.find(
                event => new Date(event.startsAt).getTime() >= Date.now()
              );
              return (
                <tr key={room.id}>
                  <td>
                    <strong>{room.name}</strong>
                    <small>{room.id}</small>
                  </td>
                  <td>{branch?.name ?? "No branch"}</td>
                  <td>{room.capacity}</td>
                  <td>{room.equipment.join(", ") || "Standard classroom"}</td>
                  <td>
                    <strong>{roomEvents.length} item(s)</strong>
                    <small>
                      {nextBooking
                        ? `Next ${formatDateTime(nextBooking.startsAt)}`
                        : "No upcoming booking"}
                    </small>
                  </td>
                  <td>
                    <StatusBadge tone={statusTone(room.status)}>
                      {room.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!filteredRooms.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No rooms found</strong>
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

  const activityTable = (
    <DataTableCard
      title="Schedule activity"
      subtitle={`${filteredActivityRows.length} activity row(s)`}
      className="admin-ia-table-card admin-schedule-activity-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Target</th>
              <th>Summary</th>
              <th>Actor</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivityRows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.action}</strong>
                  <small>{row.id}</small>
                </td>
                <td>
                  <strong>{row.entityType}</strong>
                  <small>{row.entityId}</small>
                </td>
                <td>{row.summary}</td>
                <td>{row.actorId}</td>
                <td>{formatDateTime(row.createdAt)}</td>
              </tr>
            ))}
            {!filteredActivityRows.length ? (
              <tr>
                <td colSpan={5}>
                  <div className="platform-empty-state">
                    <strong>No schedule activity</strong>
                    <span>Schedule changes and reviews will appear here.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const showStatusFilter = view !== "activity";
  const toolbar =
    view === "calendar" ||
    view === "sessions" ||
    view === "rooms" ||
    view === "activity" ? (
      <div className="admin-ia-toolbar">
        <label className="admin-ia-search">
          <Search size={16} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={
              view === "activity" ? "Search activity" : "Search schedule"
            }
            aria-label={
              view === "activity" ? "Search schedule activity" : "Search schedule"
            }
          />
        </label>
        {view === "calendar" ? (
          <label>
            Type
            <select
              value={type}
              onChange={event =>
                setType(event.target.value as "all" | CalendarEventType)
              }
            >
              <option value="all">All types</option>
              {typeOptions.map(option => (
                <option key={option} value={option}>
                  {typeLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showStatusFilter ? (
          <label>
            Status
            <select
              value={status}
              onChange={event =>
                setStatus(event.target.value as "all" | EntityStatus)
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        ) : null}
      </div>
    ) : null;
  const pageCopy: Record<
    AdminSchedulePageProps["view"],
    { title: string; description: string; actionHref: string; actionLabel: string }
  > = {
    calendar: {
      title: "Schedule calendar",
      description: "Review school events by date, room, branch, and status.",
      actionHref: "/app/admin/schedule/conflicts",
      actionLabel: "Review conflicts",
    },
    sessions: {
      title: "Sessions",
      description: "Review class sessions and attendance save status.",
      actionHref: "/app/admin/schedule",
      actionLabel: "Open calendar",
    },
    conflicts: {
      title: "Schedule conflicts",
      description: "Review pending room, time, and approval issues.",
      actionHref: "/app/admin/schedule",
      actionLabel: "Back to calendar",
    },
    rooms: {
      title: "Rooms",
      description: "Review room capacity, equipment, and bookings.",
      actionHref: "/app/admin/schedule",
      actionLabel: "Open calendar",
    },
    activity: {
      title: "Activity",
      description: "Review schedule changes and related activity.",
      actionHref: "/app/admin/schedule",
      actionLabel: "Open calendar",
    },
  };
  const mainContent =
    view === "conflicts"
      ? conflictTable
      : view === "sessions"
        ? sessionsTable
        : view === "rooms"
          ? roomsTable
          : view === "activity"
            ? activityTable
            : calendarTable;
  const ActionIcon =
    view === "conflicts"
      ? CalendarDays
      : view === "sessions"
        ? CalendarDays
        : view === "rooms"
          ? DoorOpen
          : view === "activity"
            ? Activity
            : AlertTriangle;

  return (
    <PlatformShell role="superadmin" title="Schedule">
      <WorkspaceLayout
        className="admin-ia-page admin-schedule-page"
        title={pageCopy[view].title}
        description={pageCopy[view].description}
        actions={
          <Link
            className={
              view === "calendar"
                ? "platform-primary-button"
                : "platform-secondary-button"
            }
            href={pageCopy[view].actionHref}
          >
            <ActionIcon size={15} />
            {pageCopy[view].actionLabel}
          </Link>
        }
        toolbar={
          <>
            <nav className="admin-ia-subnav" aria-label="Schedule sections">
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
            {toolbar}
          </>
        }
        main={mainContent}
      />
    </PlatformShell>
  );
}
