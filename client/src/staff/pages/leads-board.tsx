import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ChevronsLeftRight, ChevronsRightLeft, Hourglass, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  patchNccLeadRequest,
  type NccLeadDto,
  type NccLostReasonDto,
  type NccPageDto,
  type NccPlacementTestDto,
  type NccTrialLessonDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import {
  dropAction,
  moveTargets,
  nextBookingByLead,
  quietDays,
  type LeadStage,
} from "../pipeline";
import { intlLocale } from "../i18n";
import { canAccess } from "../nav";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/kit";
import type { ListFilter } from "../ui/list-page";
import { Avatar, ErrorState } from "../ui/primitives";
import { GlyphSearch } from "../ui/glyphs";
import { useBranches } from "./admissions-ui";
import { BookingSheet } from "./booking-sheets";
import { LEAD_STAGES } from "./leads-page";

const L = copy.admissions.leads;
const K = copy.admissions.board;
const PAGE = 20;

const stageLabel = (stage: LeadStage) =>
  copy.status[stage as keyof typeof copy.status] ?? stage;
const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (out, [key, value]) => out.replace(`{${key}}`, String(value)),
    text
  );

/** "20 Oct, 16:00" in the branch's time zone: short enough for a card chip. */
function shortWhen(value: string, timeZone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString(intlLocale(), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    });
  } catch {
    return date.toLocaleString(intlLocale());
  }
}

/** Closed stages start folded, so the open ones fit on one screen. */
const FOLD_KEY = "staff.leads.board.folded";
const FOLDED_BY_DEFAULT: LeadStage[] = ["registered", "lost"];
function readFolded(): LeadStage[] {
  try {
    const raw = window.localStorage.getItem(FOLD_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : FOLDED_BY_DEFAULT;
    return Array.isArray(parsed) ? (parsed as LeadStage[]) : FOLDED_BY_DEFAULT;
  } catch {
    return FOLDED_BY_DEFAULT;
  }
}

/** Stages a bulk move may set: direct stages and Lost (bookings are one at a time). */
const BULK_STAGES: LeadStage[] = ["in_process", "follow_up", "future_registration", "lost"];

type Pending =
  | { type: "lost"; leads: NccLeadDto[] }
  | { type: "book"; lead: NccLeadDto; kind: "placement" | "trial" };

/**
 * Leads as cards in stage columns. Drag a card (or use its menu) to move it;
 * moves follow EMS rules (see `dropAction`). Cards show the owner, the next
 * booking, and how long an open lead has been quiet.
 */
export function LeadsBoard({
  query,
  filters,
}: {
  /** Filters from the URL, without status or paging. */
  query: StaffQuery;
  filters: ListFilter[];
}) {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const superAdmin = role === "super_admin";
  const invalidate = useInvalidate();
  const branches = useBranches();
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [moved, setMoved] = useState<Record<string, LeadStage>>({});
  const [dragging, setDragging] = useState<NccLeadDto | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [selected, setSelected] = useState<Map<string, NccLeadDto>>(new Map());
  const [pending, setPending] = useState<Pending | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState<LeadStage[]>(readFolded);
  const toggleFold = (stage: LeadStage) =>
    setFolded(current => {
      const next = current.includes(stage)
        ? current.filter(item => item !== stage)
        : [...current, stage];
      try {
        window.localStorage.setItem(FOLD_KEY, JSON.stringify(next));
      } catch {
        // Preference only.
      }
      return next;
    });

  // Dragging near the board's edge scrolls it, so far columns are reachable.
  const EDGE = 72;
  const edgeScroll = (event: DragEvent) => {
    const board = boardRef.current;
    if (!board) return;
    const { left, right } = board.getBoundingClientRect();
    const speed = (distance: number) => Math.ceil(((EDGE - distance) / EDGE) * 24);
    if (event.clientX < left + EDGE) board.scrollLeft -= speed(event.clientX - left);
    else if (event.clientX > right - EDGE) board.scrollLeft += speed(right - event.clientX);
  };
  const lostReasons = useNcc<{ items: NccLostReasonDto[] }>(
    pending?.type === "lost" ? "/api/ncc/settings/lost-reasons" : null
  );

  const columns = LEAD_STAGES.map(stage => {
    const size = limits[stage] ?? PAGE;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useNcc<NccPageDto<NccLeadDto>>(
      "/api/ncc/admissions/leads",
      { ...query, status: stage, pageSize: size },
      { keepPreviousData: true }
    );
    return { stage, size, result };
  });
  const bookingQuery = {
    status: "scheduled",
    pageSize: 100,
    ...(query.branchId ? { branchId: query.branchId } : {}),
  };
  const placements = useNcc<NccPageDto<NccPlacementTestDto>>(
    "/api/ncc/admissions/placement-tests",
    bookingQuery
  );
  const trials = useNcc<NccPageDto<NccTrialLessonDto>>(
    "/api/ncc/admissions/trial-lessons",
    bookingQuery
  );
  const nextBookings = useMemo(
    () => nextBookingByLead(placements.data?.items ?? [], trials.data?.items ?? []),
    [placements.data, trials.data]
  );

  // Cards a move has already placed, shown in their new column until EMS
  // confirms. A failed move puts them back.
  const everyLead = useMemo(() => {
    const byId = new Map<string, NccLeadDto>();
    for (const column of columns)
      for (const lead of column.result.data?.items ?? []) byId.set(lead.id, lead);
    return byId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.map(column => column.result.data).join("|")]);
  const cardsFor = (stage: LeadStage, items: NccLeadDto[]) => {
    const stay = items.filter(lead => (moved[lead.id] ?? lead.status) === stage);
    const arrived = Object.entries(moved)
      .filter(([id, to]) => to === stage && !stay.some(lead => lead.id === id))
      .map(([id]) => everyLead.get(id))
      .filter((lead): lead is NccLeadDto => Boolean(lead))
      .map(lead => ({ ...lead, status: stage }));
    return [...arrived, ...stay];
  };

  async function refresh() {
    await Promise.all([
      invalidate("/api/ncc/admissions/leads"),
      invalidate("/api/ncc/admissions/placement-tests"),
      invalidate("/api/ncc/admissions/trial-lessons"),
    ]);
  }

  /** Runs one PATCH per lead, then reports what worked and what did not. */
  async function patchMany(
    leads: NccLeadDto[],
    patch: (lead: NccLeadDto) => Parameters<typeof patchNccLeadRequest>[1],
    success: string,
    stage?: LeadStage
  ) {
    if (stage)
      setMoved(current => ({
        ...current,
        ...Object.fromEntries(leads.map(lead => [lead.id, stage])),
      }));
    let done = 0;
    let lastError = "";
    for (const lead of leads) {
      try {
        await staffWrite(patchNccLeadRequest(lead.id, patch(lead)));
        done += 1;
      } catch (error) {
        lastError = error instanceof Error ? error.message : copy.state.errorGeneric;
        if (stage)
          setMoved(current => {
            const next = { ...current };
            delete next[lead.id];
            return next;
          });
      }
    }
    await refresh();
    setMoved({});
    const failed = leads.length - done;
    if (failed === 0) toast.success(success);
    else if (done === 0) toast.error(lastError);
    else toast.warning(fill(K.partial, { done, failed, reason: lastError }));
  }

  function move(lead: NccLeadDto, to: LeadStage) {
    const action = dropAction(lead, to);
    if (action.type === "patch") {
      void patchMany(
        [lead],
        () => ({ status: action.status, ...(action.reopen ? { lostReasonId: null } : {}) }),
        fill(K.moved, { name: lead.name, stage: stageLabel(to) }),
        to
      );
    } else if (action.type === "lost") {
      setPending({ type: "lost", leads: [lead] });
    } else if (action.type === "book") {
      setPending({ type: "book", lead, kind: action.kind });
    }
  }

  function bulkMove(to: LeadStage) {
    const leads = Array.from(selected.values()).filter(
      lead => dropAction(lead, to).type !== "blocked" && lead.status !== to
    );
    if (!leads.length) return;
    if (to === "lost") {
      setPending({ type: "lost", leads });
      return;
    }
    void patchMany(
      leads,
      lead => ({ status: to, ...(lead.status === "lost" ? { lostReasonId: null } : {}) }),
      fill(K.movedMany, { n: leads.length, stage: stageLabel(to) }),
      to
    ).then(() => setSelected(new Map()));
  }

  const toggle = (lead: NccLeadDto) =>
    setSelected(current => {
      const next = new Map(current);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.set(lead.id, lead);
      return next;
    });

  const onDragStart = (lead: NccLeadDto) => (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lead.id);
    setDragging(lead);
  };
  const dropState = (stage: LeadStage) => {
    if (!dragging) return undefined;
    const action = dropAction(dragging, stage).type;
    return action === "none" ? "home" : action === "blocked" ? "blocked" : "ok";
  };

  const pendingLost = pending?.type === "lost" ? pending.leads : [];

  return (
    <div className="staff-board-wrap">
      <BoardToolbar filters={filters} />

      <div
        ref={boardRef}
        className="staff-board"
        role="list"
        aria-label={L.title}
        data-dragging={dragging ? "" : undefined}
        onDragOver={dragging ? edgeScroll : undefined}
      >
        {columns.map(({ stage, size, result }) => {
          const page = result.data;
          const cards = page ? cardsFor(stage, page.items) : [];
          const state = dropState(stage);
          const isFolded = folded.includes(stage);
          const dropText =
            dragging && over === stage && state !== "home"
              ? state === "blocked"
                ? dragging.studentId || dragging.status === "registered"
                  ? K.dropStudent
                  : K.dropRegistered
                : stage === "placement_test" || stage === "trial_lesson"
                  ? K.dropBook
                  : K.dropHere
              : null;
          // The EMS total, adjusted for cards a pending move took in or out.
          const staying = page
            ? page.items.filter(lead => (moved[lead.id] ?? lead.status) === stage).length
            : 0;
          const total = page
            ? page.total + (cards.length - staying) - (page.items.length - staying)
            : null;
          return (
            <section
              key={stage}
              role="listitem"
              className="staff-board-col"
              data-stage={stage}
              data-drop={state}
              data-over={over === stage || undefined}
              data-folded={isFolded || undefined}
              aria-label={stageLabel(stage)}
              onDragOver={event => {
                if (!dragging) return;
                // Accept the event even where a drop is not allowed, so the
                // column can explain why; dropEffect "none" refuses the drop.
                event.preventDefault();
                event.dataTransfer.dropEffect = state === "ok" ? "move" : "none";
                if (over !== stage) setOver(stage);
              }}
              onDragEnter={event => {
                if (!dragging) return;
                event.preventDefault();
                if (over !== stage) setOver(stage);
              }}
              onDragLeave={event => {
                // Leaving fires after the next column's enter: clear only our own mark.
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setOver(current => (current === stage ? null : current));
              }}
              onDrop={event => {
                event.preventDefault();
                setOver(null);
                const lead = dragging;
                setDragging(null);
                if (lead && state === "ok") move(lead, stage);
              }}
            >
              <header className="staff-board-head">
                <span className="staff-board-dot" aria-hidden />
                <h2 className="staff-board-title" title={stageLabel(stage)}>
                  {stageLabel(stage)}
                </h2>
                <span className="staff-board-count">{total ?? "–"}</span>
                <button
                  type="button"
                  className="staff-icon-btn staff-board-fold"
                  aria-expanded={!isFolded}
                  aria-label={fill(isFolded ? K.expandColumn : K.collapseColumn, { stage: stageLabel(stage) })}
                  title={fill(isFolded ? K.expandColumn : K.collapseColumn, { stage: stageLabel(stage) })}
                  onClick={() => toggleFold(stage)}
                >
                  {isFolded ? (
                    <ChevronsLeftRight strokeWidth={1.75} aria-hidden />
                  ) : (
                    <ChevronsRightLeft strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              </header>
              {isFolded && dropText ? (
                // A folded rail is too narrow for the note, so it floats beside it.
                <div className="staff-board-ghost staff-board-ghost-float" data-state={state} role="status">
                  {dropText}
                </div>
              ) : null}
              {isFolded ? null : (
              <div className="staff-board-body">
                {dropText ? (
                  <div className="staff-board-ghost" data-state={state} role="status">
                    {dropText}
                  </div>
                ) : null}
                {result.error && !page ? (
                  <ErrorState error={result.error} onRetry={() => void result.mutate()} />
                ) : !page ? (
                  <div className="staff-board-skel" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                ) : cards.length === 0 ? (
                  <p className="staff-board-empty">
                    {stage === "placement_test" || stage === "trial_lesson" ? K.bookFirst : K.emptyColumn}
                  </p>
                ) : (
                  <ul className="staff-board-cards">
                    <AnimatePresence initial={false}>
                      {cards.map(lead => (
                        <BoardCard
                          key={lead.id}
                          lead={lead}
                          branchLabel={
                            superAdmin && !query.branchId && branches.active.length > 1
                              ? (branches.get(lead.branchId)?.code ?? lead.branchName)
                              : null
                          }
                          timeZone={branches.get(lead.branchId)?.timezone}
                          next={nextBookings.get(lead.id)}
                          selected={selected.has(lead.id)}
                          selecting={selected.size > 0}
                          dragging={dragging?.id === lead.id}
                          onToggle={() => toggle(lead)}
                          onDragStart={onDragStart(lead)}
                          onDragEnd={() => {
                            setDragging(null);
                            setOver(null);
                          }}
                          onMove={to => move(lead, to)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
                {page && page.total > page.items.length ? (
                  <button
                    type="button"
                    className="staff-btn staff-board-more"
                    data-variant="ghost"
                    data-size="sm"
                    onClick={() => setLimits(current => ({ ...current, [stage]: size + PAGE }))}
                  >
                    {fill(K.showMore, { n: Math.min(PAGE, page.total - page.items.length) })}
                  </button>
                ) : null}
              </div>
              )}
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {selected.size > 0 ? (
          <div className="staff-bulk-bar" role="toolbar" aria-label={fill(K.selected, { n: selected.size })}>
            <motion.div
              className="staff-bulk-bar-inner"
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 12, filter: "blur(4px)", transition: { duration: 0.15 } }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            >
              <span className="staff-bulk-count">{fill(K.selected, { n: selected.size })}</span>
              <Select value="" onValueChange={value => bulkMove(value as LeadStage)}>
                <SelectTrigger size="sm" aria-label={K.moveSelected}>
                  <SelectValue placeholder={K.moveSelected} />
                </SelectTrigger>
                <SelectContent>
                  {BULK_STAGES.map(stage => (
                    <SelectItem key={stage} value={stage}>
                      {stageLabel(stage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="staff-btn"
                data-variant="ghost"
                data-size="sm"
                onClick={() => setSelected(new Map())}
              >
                {K.clearSelection}
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={pending?.type === "lost"}
        onOpenChange={open => !open && setPending(null)}
        title={pendingLost.length > 1 ? fill(K.lostManyTitle, { n: pendingLost.length }) : L.lostTitle}
        description={L.lostBody}
        confirmLabel={L.markLost}
        destructive
        reasonLabel={L.lostReason}
        reasons={(lostReasons.data?.items ?? [])
          .filter(reason => reason.status === "active")
          .map(reason => ({ id: reason.id, label: reason.name }))}
        reasonRequired
        reasonsEmpty={
          <p className="staff-confirm-reason-missing">
            {L.noLostReasons}{" "}
            {role && canAccess("/app/lost-reasons", role) ? (
              <Link href="/app/lost-reasons" className="staff-link">
                {L.openLostReasons}
              </Link>
            ) : null}
          </p>
        }
        onConfirm={async reasonId => {
          const leads = pendingLost;
          await patchMany(
            leads,
            () => ({ status: "lost", lostReasonId: reasonId }),
            leads.length > 1
              ? fill(K.movedMany, { n: leads.length, stage: stageLabel("lost") })
              : L.lostToast,
            "lost"
          );
          setSelected(new Map());
        }}
      />
      {pending?.type === "book" ? (
        <BookingSheet
          open
          onOpenChange={open => {
            if (!open) {
              setPending(null);
              void refresh();
            }
          }}
          kind={pending.kind}
          subject={{ type: "lead", id: pending.lead.id, branch: branches.get(pending.lead.branchId) }}
          booking={null}
          defaultAreaId={pending.lead.areaOfStudyId}
          defaultCourseId={pending.lead.preferredCourses[0]?.id ?? null}
        />
      ) : null}
    </div>
  );
}

function BoardCard({
  lead,
  branchLabel,
  timeZone,
  next,
  selected,
  selecting,
  dragging,
  onToggle,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  lead: NccLeadDto;
  branchLabel: string | null;
  timeZone?: string;
  next?: { kind: "placement" | "trial"; scheduledAt: string };
  selected: boolean;
  selecting: boolean;
  dragging: boolean;
  onToggle: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onMove: (to: LeadStage) => void;
}) {
  const quiet = quietDays(lead);
  const targets = moveTargets(lead, LEAD_STAGES);
  const movable = targets.length > 0;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      // Opacity lives here, not in CSS: Motion's inline style would win.
      animate={{ opacity: dragging ? 0.35 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      className="staff-board-card"
      data-selected={selected || undefined}
      data-selecting={selecting || undefined}
      data-dragging={dragging || undefined}
      data-quiet={quiet !== null || undefined}
      draggable={movable}
      onDragStart={movable ? (onDragStart as never) : undefined}
      onDragEnd={onDragEnd}
    >
      <div className="staff-board-card-top">
        {/* The avatar turns into a tick box on hover, while selecting, or on touch. */}
        <span className="staff-board-pick">
          <Avatar name={lead.name} seed={lead.id} size="sm" />
          <input
            type="checkbox"
            className="staff-board-check"
            checked={selected}
            onChange={onToggle}
            aria-label={fill(K.select, { name: lead.name })}
          />
        </span>
        <Link href={`/app/leads/${lead.id}`} className="staff-board-name staff-stretch" title={lead.name} draggable={false}>
          {lead.name}
        </Link>
        {movable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="staff-icon-btn staff-board-menu" aria-label={`${K.moveTo}: ${lead.name}`}>
                <MoreHorizontal strokeWidth={1.75} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{K.moveTo}</DropdownMenuLabel>
              {targets.map(stage => (
                <DropdownMenuItem
                  key={stage}
                  className={stage === "lost" ? "text-[var(--staff-red)]" : undefined}
                  onSelect={() => onMove(stage)}
                >
                  {stageLabel(stage)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/app/leads/${lead.id}`}>{K.openLead}</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="staff-board-meta">
        {lead.assignedRegistrarName ? (
          <span className="staff-board-owner">
            {lead.assignedRegistrarName}
          </span>
        ) : null}
        {branchLabel ? (
          <span className="staff-board-branch" title={lead.branchName}>
            {branchLabel}
          </span>
        ) : null}
      </div>
      {next || quiet !== null ? (
        <div className="staff-board-chips">
          {next ? (
            <span className="staff-board-chip" data-tone="river">
              <CalendarClock strokeWidth={1.75} aria-hidden />
              {fill(next.kind === "placement" ? K.nextPlacement : K.nextTrial, {
                when: shortWhen(next.scheduledAt, timeZone),
              })}
            </span>
          ) : null}
          {quiet !== null ? (
            <span className="staff-board-chip" data-tone="caution">
              <Hourglass strokeWidth={1.75} aria-hidden />
              {fill(K.quiet, { n: quiet })}
            </span>
          ) : null}
        </div>
      ) : null}
    </motion.li>
  );
}

/** Search and the list filters, written to the same URL keys as the list. */
function BoardToolbar({ filters }: { filters: ListFilter[] }) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(`?${next.toString()}`, { replace: true });
  };
  const active = Boolean(params.get("q")) || filters.some(filter => params.get(filter.key));
  return (
    <div className="staff-toolbar">
      <label className="staff-search">
        <GlyphSearch className="ui-glyph staff-search-glyph" />
        <input
          type="search"
          className="staff-input staff-search-input"
          placeholder={copy.actions.search}
          value={params.get("q") ?? ""}
          onChange={event => set("q", event.target.value || null)}
          aria-label={copy.actions.search}
        />
      </label>
      <div className="staff-toolbar-filters">
        {filters
          .filter(filter => !filter.hidden)
          .map(filter => (
            <Select
              key={filter.key}
              value={params.get(filter.key) ?? "__all"}
              onValueChange={value => set(filter.key, value === "__all" || !value ? null : value)}
            >
              <SelectTrigger size="sm" aria-label={filter.label}>
                <SelectValue placeholder={filter.allLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{filter.allLabel}</SelectItem>
                {filter.options.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        {active ? (
          <button
            type="button"
            className="staff-btn"
            data-variant="ghost"
            data-size="sm"
            onClick={() => {
              const next = new URLSearchParams(search);
              next.delete("q");
              for (const filter of filters) next.delete(filter.key);
              navigate(`?${next.toString()}`, { replace: true });
            }}
          >
            {copy.staffUsers.clearFilters}
          </button>
        ) : null}
      </div>
    </div>
  );
}
