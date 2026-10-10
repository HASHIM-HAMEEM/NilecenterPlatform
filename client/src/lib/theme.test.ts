import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readThemePreference,
  resolveTheme,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme";

function stubBrowser(stored: string | null, prefersDark: boolean) {
  const root = { dataset: {} as Record<string, string> };
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) },
  });
  vi.stubGlobal("localStorage", { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) });
  vi.stubGlobal("matchMedia", () => ({ matches: prefersDark }));
  vi.stubGlobal("document", { documentElement: root });
  return root;
}

afterEach(() => vi.unstubAllGlobals());

describe("theme", () => {
  it("follows the device unless a theme is chosen", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("reads a stored choice and falls back to the device setting", () => {
    stubBrowser("dark", false);
    expect(readThemePreference()).toBe("dark");
    stubBrowser("purple", false);
    expect(readThemePreference()).toBe("system");
    stubBrowser(null, false);
    expect(readThemePreference()).toBe("system");
  });

  // The boot script in index.html paints before the app loads; it must reach
  // the same answer as resolveTheme for every stored value.
  it("index.html boot script matches the app for every case", () => {
    const html = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toBeTruthy();
    const stored: (ThemePreference | null | "junk")[] = [...THEME_PREFERENCES, null, "junk"];
    for (const value of stored) {
      for (const prefersDark of [true, false]) {
        const root = stubBrowser(value, prefersDark);
        new Function(script!)();
        const preference = THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
        expect(root.dataset.theme, `${value} / dark device ${prefersDark}`).toBe(resolveTheme(preference, prefersDark));
      }
    }
  });
});
