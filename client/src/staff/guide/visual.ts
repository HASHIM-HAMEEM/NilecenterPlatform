import {
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  DoorOpen,
  FileInput,
  FormInput,
  GraduationCap,
  KeyRound,
  Presentation,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ChartTone } from "../ui/charts";
import { staffNav } from "../nav";

/** Icon and chart tone for each guide area; icons match the sidebar. */
export const GUIDE_AREA_VISUALS: Record<
  string,
  { icon: LucideIcon; tone: ChartTone }
> = {
  access: { icon: KeyRound, tone: "neutral" },
  setup: { icon: Building2, tone: "ink" },
  jotform: { icon: FileInput, tone: "gold" },
  staff: { icon: Users, tone: "ink" },
  leads: { icon: UserPlus, tone: "gold" },
  bookings: { icon: CalendarClock, tone: "caution" },
  students: { icon: GraduationCap, tone: "positive" },
  enrolments: { icon: ClipboardCheck, tone: "positive" },
  classes: { icon: Presentation, tone: "ink" },
  rooms: { icon: DoorOpen, tone: "neutral" },
  forms: { icon: FormInput, tone: "gold" },
  reports: { icon: BarChart3, tone: "caution" },
};

export const guideAreaVisual = (id: string) =>
  GUIDE_AREA_VISUALS[id] ?? { icon: KeyRound, tone: "neutral" as ChartTone };

/** The main admissions flow, in order, from first contact to the classroom. */
export const GUIDE_JOURNEY: string[] = [
  "add-a-lead",
  "schedule-a-placement-test",
  "record-a-placement-result",
  "convert-a-lead",
  "sell-a-course",
  "place-in-a-class",
  "mark-attendance",
];

/** Sidebar label for an in-app route, e.g. "/app/leads" → "Leads". */
export function guidePageLabel(href: string): string | null {
  const path = href.split("?")[0];
  let best: { label: string; length: number } | null = null;
  for (const group of staffNav())
    for (const item of group.items)
      if (
        (path === item.href || path.startsWith(`${item.href}/`)) &&
        (!best || item.href.length > best.length)
      )
        best = { label: item.label, length: item.href.length };
  return best?.label ?? null;
}
