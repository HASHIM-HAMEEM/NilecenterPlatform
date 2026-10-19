import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Building2, ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import {
  fetchAuthWorkspacesRequest,
  type AuthSessionDto,
  type AuthWorkspaceDto,
  type NccRole,
} from "@/lib/backend/api";
import { copy } from "../copy";
import {
  DISPLAY_SIZES,
  setDisplaySize,
  useDisplaySize,
  type DisplaySize,
} from "../display";
import { STAFF_LOCALES, setStaffLocale, useStaffLocale } from "../i18n";
import {
  navTrailForPath,
  staffNavForRole,
  switchableRoles,
  titleForPath,
} from "../nav";
import { needsWorkspaceBranch, roleLabel } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { GlyphCheck } from "../ui/glyphs";
import { Avatar, LoadingCenter } from "../ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTitle,
} from "../ui/kit";
import { NileRosette } from "@/components/brand/NileLogo";
import { StaffNotificationsBell } from "./staff-notifications";
import { RoleViewChip } from "./role-view-bar";
import {
  isTypingTarget,
  RAIL_LEAVE,
  setSidebarCollapsed,
  toggleGroupFolded,
  useFoldedGroups,
  useRailPeek,
  useSidebarCollapsed,
} from "./sidebar-state";
import { THEME_PREFERENCES, setThemePreference, useThemePreference } from "@/lib/theme";
import { StaffCommandMenu } from "./command-menu";
import {
  installNavHistory,
  lastNavType,
  lastSearchFor,
  rememberScroll,
  savedScroll,
  stepsBackTo,
} from "./nav-history";
import { GlyphChevronLeft } from "../ui/glyphs";

installNavHistory();

const StaffCrumbContext = createContext<(label: string | null) => void>(
  () => {},
);

type StaffParent = { href: string; label: string };
const StaffParentContext = createContext<(parent: StaffParent | null) => void>(
  () => {}
);

/**
 * Sub-pages go up to the list they belong to (from the route). A page whose
 * parent is not in its URL, such as a form response, names it here.
 */
export function useStaffParent(parent: StaffParent | null) {
  const setParent = useContext(StaffParentContext);
  const href = parent?.href ?? null;
  const label = parent?.label ?? null;
  useEffect(() => {
    setParent(href && label ? { href, label } : null);
    return () => setParent(null);
  }, [href, label, setParent]);
}

/** Pages call this to append a final breadcrumb crumb (e.g. a person name). */
export function useStaffCrumb(label: string | null) {
  const setCrumb = useContext(StaffCrumbContext);
  useEffect(() => {
    setCrumb(label);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}

function displayLabel(size: DisplaySize): string {
  if (size === "large") return copy.shell.displayLarge;
  if (size === "xlarge") return copy.shell.displayXLarge;
  return copy.shell.displayStandard;
}

function MenuCheck({ on }: { on: boolean }) {
  return (
    <span className="ui-menu-check" aria-hidden>
      {on ? <GlyphCheck /> : null}
    </span>
  );
}

function Brand() {
  return (
    <Link href="/app/dashboard" className="staff-brand">
      <NileRosette className="staff-brand-mark" />
      <span className="staff-brand-text">
        <span className="staff-brand-name">{copy.brand.name}</span>
        <span className="staff-brand-sub">{copy.brand.product}</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { session } = useStaffSession();
  const [path] = useLocation();
  const foldedGroups = useFoldedGroups();
  const role = session?.ncc?.activeRole ?? "teacher";
  const sections = staffNavForRole(role);
  const bestMatch = sections
    .flatMap(section => section.items)
    .filter(
      item =>
        item.available &&
        (path === item.href ||
          (item.href !== "/app" && path.startsWith(item.href + "/"))),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  const navRef = useRef<HTMLElement>(null);

  const flyout = useGroupFlyout(path);

  // Keep the current page in view when the list is taller than the screen.
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('.staff-nav-link[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [bestMatch?.href]);
  const flyoutSection = sections.find(section => section.id === flyout.state?.id);

  const renderItem = (item: (typeof sections)[number]["items"][number]) => {
    const active = bestMatch?.href === item.href;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className="staff-nav-link"
          data-active={active}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          {active ? (
            <motion.span
              layoutId="staff-nav-active"
              className="staff-nav-active"
              transition={{ type: "spring", duration: 0.25, bounce: 0 }}
              aria-hidden
            />
          ) : null}
          <item.icon className="staff-nav-icon" strokeWidth={1.75} aria-hidden />
          <span className="staff-nav-label">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      className="staff-nav"
      aria-label={copy.shell.staffNav}
      onScroll={flyout.state ? flyout.close : undefined}
    >
      {sections.map(section => {
        // The icon rail always shows every icon; folding is for the full sidebar.
        const folded = !collapsed && foldedGroups.has(section.id);
        const current = section.items.find(item => item.href === bestMatch?.href);
        const listId = `staff-nav-${section.id}`;
        return (
          <div key={section.id} className="staff-nav-group" data-folded={folded || undefined}>
            <button
              type="button"
              className="staff-nav-group-label"
              aria-expanded={!folded}
              aria-controls={listId}
              aria-haspopup={folded ? "true" : undefined}
              data-flyout-open={flyout.state?.id === section.id || undefined}
              onClick={() => {
                flyout.close();
                toggleGroupFolded(section.id);
              }}
              onPointerEnter={event => {
                if (folded && event.pointerType === "mouse")
                  flyout.openSoon(section.id, event.currentTarget);
              }}
              onPointerLeave={event => {
                if (event.pointerType === "mouse") flyout.closeSoon();
              }}
              onKeyDown={event => {
                const inward = document.documentElement.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
                if (folded && event.key === inward) {
                  event.preventDefault();
                  flyout.openNow(section.id, event.currentTarget, true);
                }
              }}
            >
              <span className="staff-nav-group-text">{section.label}</span>
              {folded ? (
                <span className="staff-nav-group-count" aria-hidden>
                  {section.items.length}
                </span>
              ) : null}
              <ChevronDown className="staff-nav-group-caret" strokeWidth={2} aria-hidden />
            </button>
            {/* While folded, the page you are on stays visible under its group. */}
            {folded && current ? (
              <ul className="staff-nav-list">{renderItem(current)}</ul>
            ) : null}
            <div className="staff-nav-fold" id={listId} inert={folded || undefined}>
              <ul className="staff-nav-list">
                {section.items
                  .filter(item => !(folded && item === current))
                  .map(renderItem)}
              </ul>
            </div>
          </div>
        );
      })}
      {createPortal(
        <AnimatePresence>
          {flyout.state && flyoutSection ? (
            <GroupFlyout
              key={flyoutSection.id}
              label={flyoutSection.label}
              items={flyoutSection.items}
              activeHref={bestMatch?.href}
              anchor={flyout.state.anchor}
              focusFirst={flyout.state.focus}
              onPointerEnter={flyout.cancelClose}
              onPointerLeave={flyout.closeSoon}
              onClose={returnFocus => {
                const anchor = flyout.state?.anchor;
                flyout.close();
                if (returnFocus) anchor?.focus();
              }}
              onNavigate={() => {
                flyout.close();
                onNavigate?.();
              }}
            />
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </nav>
  );
}

/** Dwell before a folded group's pages fly out, and grace before they close. */
const FLYOUT_OPEN_MS = 120;
const FLYOUT_CLOSE_MS = 200;

function useGroupFlyout(path: string) {
  const [state, setState] = useState<{
    id: string;
    anchor: HTMLElement;
    focus: boolean;
  } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const clear = () => window.clearTimeout(timer.current);

  useEffect(() => {
    clear();
    setState(null);
  }, [path]);
  useEffect(() => clear, []);

  return {
    state,
    openNow(id: string, anchor: HTMLElement, focus = false) {
      clear();
      setState({ id, anchor, focus });
    },
    openSoon(id: string, anchor: HTMLElement) {
      clear();
      // Moving between headings while one is open swaps at once.
      if (state) setState({ id, anchor, focus: false });
      else
        timer.current = window.setTimeout(
          () => setState({ id, anchor, focus: false }),
          FLYOUT_OPEN_MS
        );
    },
    closeSoon() {
      clear();
      timer.current = window.setTimeout(() => setState(null), FLYOUT_CLOSE_MS);
    },
    cancelClose: clear,
    close() {
      clear();
      setState(null);
    },
  };
}

/**
 * A folded group's pages, shown beside its heading while the pointer rests
 * on it. Nothing in the sidebar moves; the current page is marked.
 */
function GroupFlyout({
  label,
  items,
  activeHref,
  anchor,
  focusFirst,
  onPointerEnter,
  onPointerLeave,
  onClose,
  onNavigate,
}: {
  label: string;
  items: ReturnType<typeof staffNavForRole>[number]["items"];
  activeHref: string | undefined;
  anchor: HTMLElement;
  focusFirst: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClose: (returnFocus: boolean) => void;
  onNavigate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rtl = document.documentElement.dir === "rtl";
  const head = anchor.getBoundingClientRect();
  const side = (anchor.closest(".staff-sidebar") ?? anchor).getBoundingClientRect();
  const [top, setTop] = useState(head.top - 8);

  // Keep the card on screen when the heading sits low.
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(head.top - 8, window.innerHeight - height - 8)));
    if (focusFirst) ref.current?.querySelector<HTMLElement>("a")?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={ref}
      className="staff-nav-flyout"
      role="group"
      aria-label={label}
      style={
        rtl
          ? { top, right: window.innerWidth - side.left + 8, transformOrigin: "right top" }
          : { top, left: side.right + 8, transformOrigin: "left top" }
      }
      initial={{ opacity: 0, scale: 0.96, x: rtl ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
      transition={{ type: "spring", duration: 0.22, bounce: 0 }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={event => {
        if (event.pointerType !== "mouse") return;
        onPointerLeave();
        const next = event.relatedTarget;
        if (!(next instanceof Element && next.closest(".staff-sidebar")))
          window.dispatchEvent(new Event(RAIL_LEAVE));
      }}
      onKeyDown={event => {
        if (event.key === "Escape" || event.key === (rtl ? "ArrowRight" : "ArrowLeft")) {
          event.preventDefault();
          onClose(true);
        }
      }}
    >
      <div className="staff-nav-flyout-title">{label}</div>
      <ul className="staff-nav-list">
        {items.map(item => {
          const active = activeHref === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="staff-nav-link"
                data-active={active}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <item.icon className="staff-nav-icon" strokeWidth={1.75} aria-hidden />
                <span className="staff-nav-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

/** Workspace branch switcher for roles that work inside one branch. */
function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { session, switchWorkspace } = useStaffSession();
  const role = session?.ncc?.activeRole;
  const needsBranch = role ? needsWorkspaceBranch(role) : false;
  const [items, setItems] = useState<AuthWorkspaceDto[]>([]);

  useEffect(() => {
    if (!needsBranch) return;
    let cancelled = false;
    fetchAuthWorkspacesRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) setItems(result.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [needsBranch]);

  if (!session || !needsBranch) return null;

  const active = session.ncc?.workspaceBranchId ?? "";

  if (compact) {
    const current = items.find(workspace => workspace.id === active);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="staff-rail-btn"
            aria-label={`${copy.shell.workspace}: ${current?.name ?? copy.shell.chooseWorkspaceOption}`}
            title={current?.name}
          >
            <Building2 strokeWidth={1.75} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={10}>
          <DropdownMenuLabel>{copy.shell.workspace}</DropdownMenuLabel>
          {items.map(workspace => (
            <DropdownMenuItem
              key={workspace.id}
              role="menuitemradio"
              aria-checked={workspace.id === active}
              onSelect={() => void switchWorkspace(workspace.id)}
            >
              <MenuCheck on={workspace.id === active} />
              {workspace.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Select
      value={active || undefined}
      onValueChange={value => void switchWorkspace(value)}
    >
      <SelectTrigger
        className="staff-workspace-select"
        aria-label={copy.shell.workspace}
      >
        <SelectValue placeholder={copy.shell.chooseWorkspaceOption} />
      </SelectTrigger>
      <SelectContent>
        {items.map(workspace => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserMenu({ session, compact = false }: { session: AuthSessionDto; compact?: boolean }) {
  const { signOut, signOutEverywhere, switchRole } = useStaffSession();
  const locale = useStaffLocale();
  const displaySize = useDisplaySize();
  const themePreference = useThemePreference();
  const [confirmOutAll, setConfirmOutAll] = useState(false);
  const ncc = session.ncc;
  if (!ncc) return null;
  const targets = switchableRoles(ncc.assignedRole);
  const actingDown = ncc.activeRole !== ncc.assignedRole;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="staff-user-trigger"
            aria-label={session.name}
          >
            <Avatar name={session.name} seed={session.userId} />
            <span className="staff-user-meta">
              <span className="staff-user-name">{session.name}</span>
              <span className="staff-user-role">
                {actingDown
                  ? `${copy.shell.viewingAs} ${roleLabel(ncc.activeRole)}`
                  : roleLabel(ncc.activeRole)}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={compact ? "right" : "top"} sideOffset={compact ? 10 : 8}>
          <DropdownMenuLabel className="!font-normal">
            <span className="block font-medium">{session.name}</span>
            <span className="staff-muted block text-xs">{session.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/app/profile">{copy.nav.profile}</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {targets.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {copy.shell.viewAsRole}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[ncc.assignedRole, ...targets].map(target => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() =>
                      void runAction(() => switchRole(target), {
                        success:
                          target === ncc.assignedRole
                            ? copy.shell.roleViewEnded
                            : `${copy.shell.roleViewChanged} ${roleLabel(target)}.`,
                      })
                    }
                    aria-checked={target === ncc.activeRole}
                    role="menuitemradio"
                  >
                    <MenuCheck on={target === ncc.activeRole} />
                    {roleLabel(target)}
                    {target === ncc.assignedRole
                      ? ` (${copy.shell.ownRole})`
                      : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{copy.shell.displaySize}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {DISPLAY_SIZES.map(size => (
                <DropdownMenuItem
                  key={size}
                  onSelect={() => setDisplaySize(size)}
                  aria-checked={size === displaySize}
                  role="menuitemradio"
                >
                  <MenuCheck on={size === displaySize} />
                  {displayLabel(size)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{copy.shell.theme}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {THEME_PREFERENCES.map(option => (
                <DropdownMenuItem
                  key={option}
                  onSelect={() => setThemePreference(option)}
                  aria-checked={option === themePreference}
                  role="menuitemradio"
                >
                  <MenuCheck on={option === themePreference} />
                  {option === "system"
                    ? copy.shell.themeSystem
                    : option === "light"
                      ? copy.shell.themeLight
                      : copy.shell.themeDark}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{copy.language.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {STAFF_LOCALES.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  lang={option.value}
                  onSelect={() => setStaffLocale(option.value)}
                  aria-checked={option.value === locale}
                  role="menuitemradio"
                >
                  <MenuCheck on={option.value === locale} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            {copy.shell.signOut}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmOutAll(true)}>
            {copy.shell.signOutEverywhere}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOutAll}
        onOpenChange={setConfirmOutAll}
        title={copy.profile.signOutEverywhereTitle}
        description={copy.profile.signOutEverywhereBody}
        confirmLabel={copy.profile.signOutEverywhere}
        destructive
        onConfirm={() => signOutEverywhere()}
      />
    </>
  );
}

/**
 * A page's sections arrive in order (header, tools, content) once its code
 * has loaded. The window only staggers the first paint; a section that
 * appears later, such as a list replacing its loading rows, enters at once.
 */
function PageEnter({ children }: { children: ReactNode }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntering(false), 600);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="staff-enter" data-entering={entering || undefined}>
      {children}
    </div>
  );
}

function SidebarFooter({ session, compact = false }: { session: AuthSessionDto; compact?: boolean }) {
  return (
    <div className="staff-sidebar-footer">
      <WorkspaceSwitcher compact={compact} />
      <UserMenu session={session} compact={compact} />
    </div>
  );
}

/**
 * Up to the parent list, as a link (so a modified click opens a new tab).
 * When the page before this one in history is that list, it goes back
 * through history, which keeps the list's filters, tab and scroll. Otherwise
 * it opens the list with the filters it had last time in this tab.
 */
function BackLink({ parent }: { parent: StaffParent }) {
  const [, navigate] = useLocation();
  const [parentPath] = parent.href.split("?");
  const href = parent.href.includes("?") ? parent.href : parentPath + lastSearchFor(parentPath);
  return (
    <Link
      href={href}
      className="staff-back"
      aria-label={copy.shell.backTo.replace("{page}", parent.label)}
      onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        const steps = stepsBackTo(parentPath);
        if (steps !== null) window.history.go(steps);
        else navigate(href);
      }}
    >
      <GlyphChevronLeft className="ui-glyph staff-back-glyph staff-rtl-flip" />
      <span className="staff-back-label">{parent.label}</span>
    </Link>
  );
}

/** The parent of a sub-page: a page override, or the nav item its URL sits under. */
function parentForPath(path: string, override: StaffParent | null): StaffParent | null {
  if (override) return override;
  const trail = navTrailForPath(path);
  if (!trail || path === trail.item.href) return null;
  return { href: trail.item.href, label: trail.item.label };
}

function Breadcrumb({
  path,
  crumb,
  parent,
}: {
  path: string;
  crumb: string | null;
  parent: StaffParent | null;
}) {
  if (parent) {
    return (
      <>
        <BackLink parent={parent} />
        {crumb ? (
          <>
            <span className="staff-crumb-sep" aria-hidden>
              /
            </span>
            <span className="staff-crumb staff-crumb-current" aria-current="page">
              {crumb}
            </span>
          </>
        ) : null}
      </>
    );
  }
  const trail = navTrailForPath(path);
  if (!trail) {
    return (
      <span className="staff-crumb staff-crumb-current">
        {crumb ?? titleForPath(path)}
      </span>
    );
  }
  return (
    <>
      <span className="staff-crumb staff-crumb-group">{trail.group}</span>
      <span className="staff-crumb-sep" aria-hidden>
        /
      </span>
      <Link
        href={trail.item.href}
        className="staff-crumb staff-crumb-page staff-crumb-link"
      >
        {trail.item.label}
      </Link>
      {crumb ? (
        <>
          <span className="staff-crumb-sep" aria-hidden>
            /
          </span>
          <span className="staff-crumb staff-crumb-current">{crumb}</span>
        </>
      ) : null}
    </>
  );
}

/**
 * Large-title behaviour: the page title lives in the content; once it
 * scrolls under the top bar, a compact copy fades into the bar and a hairline
 * appears, as in native large-title navigation. Returns the scroll container
 * ref and the bar state. A new page always starts at the top.
 */
function useCollapsingTitle(location: string) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{
    scrolled: boolean;
    compact: boolean;
    title: string | null;
  }>({ scrolled: false, compact: false, title: null });

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    // Back and Forward return to where the page was; anything else starts at the top.
    const target = lastNavType() === "pop" ? savedScroll() : 0;
    main.scrollTo({ top: 0 });
    let restore = 0;
    if (target > 0) {
      let tries = 0;
      const attempt = () => {
        tries += 1;
        if (main.scrollHeight - main.clientHeight >= target || tries > 40) {
          main.scrollTo({ top: target });
          return;
        }
        restore = requestAnimationFrame(attempt);
      };
      restore = requestAnimationFrame(attempt);
    }
    setBar({ scrolled: false, compact: false, title: null });
    let frame = 0;
    const measure = () => {
      frame = 0;
      const topbar = main.querySelector<HTMLElement>(".staff-topbar");
      const heading = main.querySelector<HTMLElement>(
        ".staff-content h1, .staff-content .staff-detail-name"
      );
      const barBottom =
        main.getBoundingClientRect().top + (topbar?.offsetHeight ?? 0);
      const hidden = heading
        ? heading.getBoundingClientRect().bottom <= barBottom
        : false;
      setBar(current => {
        // The title text stays while the compact title fades out.
        const next = {
          scrolled: main.scrollTop > 2,
          compact: hidden,
          title: hidden
            ? (heading?.textContent?.trim() ?? null)
            : current.title,
        };
        return current.scrolled === next.scrolled &&
          current.compact === next.compact &&
          current.title === next.title
          ? current
          : next;
      });
    };
    const onScroll = () => {
      rememberScroll(main.scrollTop);
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (restore) cancelAnimationFrame(restore);
    };
  }, [location]);

  return { mainRef, ...bar };
}

export function StaffShell({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { session } = useStaffSession();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);
  const [parentOverride, setParentOverride] = useState<StaffParent | null>(null);
  const parent = parentForPath(path, parentOverride);
  const bar = useCollapsingTitle(location);
  const collapsed = useSidebarCollapsed();
  const isMac =
    typeof navigator !== "undefined" &&
    /mac/i.test(navigator.platform || navigator.userAgent);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const toggleHint = `${collapsed ? copy.shell.expandSidebar : copy.shell.collapseSidebar} ([)`;
  const peek = useRailPeek(collapsed);
  // The rail opens over the page while peeking; the page keeps its width.
  const railVisual = collapsed && !peek.open;

  const toggleSidebar = () => {
    peek.close({ untilLeave: true });
    setSidebarCollapsed(!collapsed);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(open => !open);
        return;
      }
      // "[" (or Cmd/Ctrl + \) folds the sidebar into an icon rail.
      const bracket = event.key === "[" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const backslash = (event.metaKey || event.ctrlKey) && event.key === "\\";
      if ((bracket && !isTypingTarget(event.target)) || backslash) {
        event.preventDefault();
        setSidebarCollapsed(!collapsedRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  return (
    <MotionConfig reducedMotion="user">
      <StaffCrumbContext.Provider value={setCrumb}>
      <StaffParentContext.Provider value={setParentOverride}>
        <div
          className="staff-app staff-shell"
          data-sidebar={railVisual ? "collapsed" : "expanded"}
          data-rail={collapsed || undefined}
          data-peek={peek.open || undefined}
        >
          <aside className="staff-sidebar" {...peek.handlers}>
            <div className="staff-sidebar-head">
              <Brand />
              <button
                type="button"
                className="staff-sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={collapsed ? copy.shell.expandSidebar : copy.shell.collapseSidebar}
                aria-expanded={!collapsed}
                title={toggleHint}
              >
                {collapsed ? (
                  <PanelLeftOpen className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
                ) : (
                  <PanelLeftClose className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            </div>
            <NavList collapsed={railVisual} />
            {/* The footer stays compact while peeking, so its menus keep their anchor. */}
            {session ? <SidebarFooter session={session} compact={collapsed} /> : null}
          </aside>

          <div className="staff-main" ref={bar.mainRef}>
            <header
              className="staff-topbar"
              data-scrolled={bar.scrolled || undefined}
              data-compact={bar.compact || undefined}
            >
              <button
                type="button"
                className="staff-menu-toggle"
                onClick={() => setMobileNav(true)}
                aria-label={copy.shell.openMenu}
              >
                <Menu strokeWidth={1.75} aria-hidden />
              </button>
              <nav className="staff-crumbs" aria-label={copy.shell.breadcrumb}>
                <Breadcrumb path={path} crumb={crumb} parent={parent} />
              </nav>
              <span className="staff-topbar-title" aria-hidden>
                {bar.title}
              </span>
              <div className="staff-topbar-tools">
                <RoleViewChip />
                <button
                  type="button"
                  className="staff-search-btn"
                  onClick={() => setCommandOpen(true)}
                  aria-label={copy.shell.search}
                >
                  <Search strokeWidth={1.75} aria-hidden />
                  <span className="staff-search-btn-text">
                    {copy.shell.search}
                  </span>
                  <kbd className="staff-kbd" aria-hidden>
                    {isMac ? "⌘K" : "Ctrl K"}
                  </kbd>
                </button>
                <StaffNotificationsBell />
              </div>
            </header>

            <main className="staff-content" key={location}>
              {/* A page still downloading suspends here, so the shell and its theme stay put. */}
              <Suspense fallback={<LoadingCenter />}>
                <PageEnter>{children}</PageEnter>
              </Suspense>
            </main>
          </div>

          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetContent
              side="left"
              className="staff-nav-sheet"
              aria-label={copy.shell.staffNav}
            >
              <SheetTitle className="sr-only">{copy.shell.staffNav}</SheetTitle>
              <Brand />
              <NavList onNavigate={() => setMobileNav(false)} />
              {session ? <SidebarFooter session={session} /> : null}
            </SheetContent>
          </Sheet>

          <StaffCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
        </div>
      </StaffParentContext.Provider>
      </StaffCrumbContext.Provider>
    </MotionConfig>
  );
}
