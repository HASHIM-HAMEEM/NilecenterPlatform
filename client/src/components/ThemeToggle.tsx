import { Moon, Sun } from "lucide-react";
import { setThemePreference, useTheme } from "@/lib/theme";

/**
 * One-press light/dark switch for the public site and sign-in pages. The label
 * names the action ("Switch to dark theme"); the icon shows the target theme.
 * The staff app offers the full Match device / Light / Dark choice instead.
 */
export function ThemeToggle({
  className,
  toDark,
  toLight,
}: {
  className: string;
  toDark: string;
  toLight: string;
}) {
  const dark = useTheme() === "dark";
  const label = dark ? toLight : toDark;
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => setThemePreference(dark ? "light" : "dark")}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
