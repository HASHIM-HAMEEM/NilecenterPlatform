import { zonedInstant } from "./hour-cells";

/**
 * The visitor's requested appointment, typed into a Jotform free-text
 * field. The text may carry more segments after " · " (for example a
 * branch name); only the first segment is read. Two shapes are accepted:
 * "YYYY-MM-DD HH:MM" and US "M/D/YYYY h[:mm] AM/PM".
 *
 * Returns the wall date and whole start hour the BookingSheet can prefill,
 * in the branch time zone, but only when the moment is still in the
 * future. Minutes are dropped because bookings start on the hour.
 */
export function parseAppointmentText(
  text: string | null | undefined,
  timeZone: string,
  now = Date.now()
): { date: string; hour: number } | null {
  const segment = text?.split("·")[0]?.trim() ?? "";
  if (!segment) return null;

  let year: number;
  let month: number;
  let day: number;
  let hour: number;
  let minute = 0;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(
    segment
  );
  const us =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/.exec(
      segment
    );
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
    hour = Number(iso[4]);
    minute = Number(iso[5]);
    if (hour > 23) return null;
  } else if (us) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
    const raw = Number(us[4]);
    minute = Number(us[5] ?? 0);
    if (raw < 1 || raw > 12) return null;
    hour = (raw % 12) + (us[6].toLowerCase() === "p" ? 12 : 0);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || minute > 59) {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const instant = zonedInstant(date, hour, timeZone, minute);
  if (!instant || Date.parse(instant) <= now) return null;
  return { date, hour };
}

/**
 * BookingSheet schedule mode: the appointment text is interpreted in the
 * chosen branch's time zone, so when the branch changes and the user has not
 * edited date or hour yet, re-derive both in the new zone. Returns the draft
 * patch ({date, hour} as strings) or null when nothing should change.
 */
export function requestedStartOnBranchChange(
  appointmentText: string | null | undefined,
  timeEdited: boolean,
  timeZone: string,
  now = Date.now()
): { date: string; hour: string } | null {
  if (timeEdited) return null;
  const parsed = parseAppointmentText(appointmentText, timeZone, now);
  return parsed ? { date: parsed.date, hour: String(parsed.hour) } : null;
}
