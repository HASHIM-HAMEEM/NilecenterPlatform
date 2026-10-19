import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const KEY = "nilelearn.staff.sidebar";
const listeners = new Set<() => void>();

/* Laptop widths default to the icon rail so lists and forms get the room. */
const LAPTOP = "(min-width: 900px) and (max-width: 1279px)";

function read(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch {
    stored = null;
  }
  // An explicit choice always wins; with none, the screen width decides.
  if (stored === "collapsed" || stored === "expanded") return stored === "collapsed";
  return window.matchMedia(LAPTOP).matches;
}

/** Collapse or expand the desktop sidebar; remembered on this device. */
export function setSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  listeners.forEach(listener => listener());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => event.key === KEY && listener();
      const laptop = window.matchMedia(LAPTOP);
      window.addEventListener("storage", onStorage);
      laptop.addEventListener("change", listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
        laptop.removeEventListener("change", listener);
      };
    },
    read,
    () => false
  );
}

/* ---------- Peek: the icon rail opens over the page on hover ------------- */

/** Fired when the pointer leaves something that belongs to the rail. */
export const RAIL_LEAVE = "staff:rail-leave";

/** Dwell before opening, so passing the pointer across the rail does nothing. */
const PEEK_OPEN_MS = 140;
/** Grace before closing, so a short slip off the edge does not snap it shut. */
const PEEK_CLOSE_MS = 240;

/**
 * While the sidebar is collapsed, resting a mouse on the rail (or tabbing
 * into it) opens the full sidebar over the page without moving the page.
 * Touch never peeks; it uses the expand button.
 */
export function useRailPeek(collapsed: boolean) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // After a click on the toggle, wait for the pointer to leave before peeking
  // again, or the rail would reopen under the cursor that just closed it.
  const held = useRef(false);

  const clear = () => window.clearTimeout(timer.current);
  const later = (next: boolean, ms: number) => {
    clear();
    timer.current = window.setTimeout(() => setOpen(next), ms);
  };

  useEffect(() => {
    clear();
    setOpen(false);
  }, [collapsed]);
  useEffect(() => clear, []);
  // A group's flyout card sits outside the sidebar; leaving it counts as
  // leaving the rail.
  useEffect(() => {
    const onLeave = () => {
      if (collapsed) later(false, PEEK_CLOSE_MS);
    };
    window.addEventListener(RAIL_LEAVE, onLeave);
    return () => window.removeEventListener(RAIL_LEAVE, onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  return {
    open: collapsed && open,
    close({ untilLeave = false }: { untilLeave?: boolean } = {}) {
      clear();
      held.current = untilLeave;
      setOpen(false);
    },
    handlers: {
      onPointerEnter(event: PointerEvent<HTMLElement>) {
        if (!collapsed || event.pointerType !== "mouse" || held.current) return;
        later(true, PEEK_OPEN_MS);
      },
      onPointerLeave(event: PointerEvent<HTMLElement>) {
        held.current = false;
        if (!collapsed || event.pointerType !== "mouse") return;
        const next = event.relatedTarget as Element | null;
        if (next instanceof Element && next.closest(".staff-nav-flyout")) {
          clear();
          return;
        }
        later(false, PEEK_CLOSE_MS);
      },
      onFocus(event: FocusEvent<HTMLElement>) {
        if (!collapsed || !(event.target as HTMLElement).matches(":focus-visible"))
          return;
        clear();
        setOpen(true);
      },
      onBlur(event: FocusEvent<HTMLElement>) {
        if (!collapsed) return;
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        // Keep a mouse peek open; only keyboard focus leaving closes it.
        if (event.currentTarget.matches(":hover")) return;
        clear();
        setOpen(false);
      },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== "Escape" || !open) return;
        clear();
        setOpen(false);
      },
    },
  };
}

/* ---------- Folded navigation groups ------------------------------------ */

const FOLD_KEY = "nilelearn.staff.sidebar.folded";
const foldListeners = new Set<() => void>();
let foldCache: { raw: string | null; ids: ReadonlySet<string> } = {
  raw: null,
  ids: new Set(),
};

function readFolded(): ReadonlySet<string> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(FOLD_KEY);
  } catch {
    raw = null;
  }
  // useSyncExternalStore needs a stable snapshot for unchanged storage.
  if (raw === foldCache.raw) return foldCache.ids;
  let ids: string[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter(id => typeof id === "string");
  } catch {
    ids = [];
  }
  foldCache = { raw, ids: new Set(ids) };
  return foldCache.ids;
}

/** Fold or unfold one navigation group; remembered on this device. */
export function toggleGroupFolded(id: string) {
  const next = new Set(readFolded());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  try {
    window.localStorage.setItem(FOLD_KEY, JSON.stringify(Array.from(next)));
  } catch {
    foldCache = { raw: foldCache.raw, ids: next };
  }
  foldListeners.forEach(listener => listener());
}

const EMPTY_FOLDED: ReadonlySet<string> = new Set();

export function useFoldedGroups(): ReadonlySet<string> {
  return useSyncExternalStore(
    listener => {
      foldListeners.add(listener);
      const onStorage = (event: StorageEvent) =>
        event.key === FOLD_KEY && listener();
      window.addEventListener("storage", onStorage);
      return () => {
        foldListeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    readFolded,
    () => EMPTY_FOLDED
  );
}

/** Typing in a field never toggles the sidebar. */
export function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
  );
}
