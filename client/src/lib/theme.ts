import { useSyncExternalStore } from "react";

/**
 * Colour theme for the staff app, the public site and the sign-in pages.
 * "system" follows the device setting and keeps following it. The choice is
 * stored per device under the same key the boot script in index.html reads,
 * so the first paint already has the right colours. The Student portal keeps
 * its own light design and ignores this setting.
 */
export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];
export const THEME_STORAGE_KEY = "nilelearn.theme";

const listeners = new Set<() => void>();
const media = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(stored as ThemePreference) ? (stored as ThemePreference) : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark = media()?.matches ?? false): Theme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

function apply() {
  const theme = resolveTheme(readThemePreference());
  document.documentElement.dataset.theme = theme;
  listeners.forEach(listener => listener());
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* preference only */
  }
  apply();
}

let installed = false;

/** Keeps the document in step with the device setting and other tabs. */
export function installTheme() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  apply();
  media()?.addEventListener("change", () => {
    if (readThemePreference() === "system") apply();
  });
  window.addEventListener("storage", event => {
    if (event.key === THEME_STORAGE_KEY) apply();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => "system");
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light"
  );
}
