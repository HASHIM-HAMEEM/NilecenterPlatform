import { describe, expect, it } from "vitest";
import {
  parseAppointmentText,
  requestedStartOnBranchChange,
} from "./appointment-text";

const ZONE = "Etc/GMT-2"; // fixed UTC+2, no DST
const NOW = Date.parse("2026-10-18T08:00:00Z"); // 10:00 in ZONE

describe("parseAppointmentText", () => {
  it("parses ISO wall time and keeps the wall hour", () => {
    expect(
      parseAppointmentText("2026-10-20 14:00", ZONE, NOW)
    ).toEqual({ date: "2026-10-20", hour: 14 });
  });

  it("reads only the first segment before ·", () => {
    expect(
      parseAppointmentText("2026-10-20 09:00 · Cairo branch", ZONE, NOW)
    ).toEqual({ date: "2026-10-20", hour: 9 });
  });

  it("parses US AM/PM with minutes", () => {
    expect(
      parseAppointmentText("10/20/2026 2:30 PM", ZONE, NOW)
    ).toEqual({ date: "2026-10-20", hour: 14 });
    expect(
      parseAppointmentText("10/20/2026 9 AM", ZONE, NOW)
    ).toEqual({ date: "2026-10-20", hour: 9 });
  });

  it("handles the 12 AM / 12 PM edges", () => {
    expect(
      parseAppointmentText("10/20/2026 12:00 AM", ZONE, NOW)
    ).toEqual({ date: "2026-10-20", hour: 0 });
    expect(
      parseAppointmentText("10/20/2026 12:30 PM", ZONE, NOW)
    ).toEqual({ date: "2026-10-20", hour: 12 });
  });

  it("returns null for invalid or out-of-range input", () => {
    for (const text of [
      "tomorrow morning",
      "2026-13-01 10:00",
      "2026-10-32 10:00",
      "2026-02-30 10:00",
      "10/20/2026 13:00 PM",
      "10/20/2026 0:15 AM",
      "2026-10-20 25:00",
      "2026-10-20 10:99",
      "10/20/26 2 PM",
      "2026-10-20T10:00:00Z",
    ]) {
      expect(parseAppointmentText(text, ZONE, NOW), text).toBeNull();
    }
  });

  it("returns null for a date with no time", () => {
    expect(parseAppointmentText("2026-10-20", ZONE, NOW)).toBeNull();
    expect(parseAppointmentText("10/20/2026", ZONE, NOW)).toBeNull();
  });

  it("returns null when the moment is in the past", () => {
    // 2026-10-18 09:00 in ZONE = 07:00 UTC, before NOW (08:00 UTC).
    expect(
      parseAppointmentText("2026-10-18 09:00", ZONE, NOW)
    ).toBeNull();
    expect(
      parseAppointmentText("10/18/2026 8:59 AM", ZONE, NOW)
    ).toBeNull();
    // A later wall time the same day is still fine.
    expect(
      parseAppointmentText("2026-10-18 11:00", ZONE, NOW)
    ).toEqual({ date: "2026-10-18", hour: 11 });
  });

  it("returns null for empty input", () => {
    expect(parseAppointmentText(null, ZONE, NOW)).toBeNull();
    expect(parseAppointmentText("  ", ZONE, NOW)).toBeNull();
    expect(parseAppointmentText("· 14:00", ZONE, NOW)).toBeNull();
  });

  it("checks the instant in the branch time zone, not UTC", () => {
    // The same wall time is future in UTC but already past in a
    // UTC+13 zone.
    const earlier = Date.parse("2026-10-18T09:45:00Z");
    expect(
      parseAppointmentText("2026-10-18 10:00", "UTC", earlier)
    ).toEqual({ date: "2026-10-18", hour: 10 });
    expect(
      parseAppointmentText("2026-10-18 10:00", "Pacific/Auckland", earlier)
    ).toBeNull();
  });
});

describe("requestedStartOnBranchChange", () => {
  const TEXT = "2026-10-20 14:00 · Nile Center (Maadi)";

  it("re-derives the wall time in the new branch's zone", () => {
    // Future in Etc/GMT-2 (UTC+2, no DST): keeps the wall hour.
    expect(
      requestedStartOnBranchChange(TEXT, false, "Etc/GMT-2", NOW)
    ).toEqual({ date: "2026-10-20", hour: "14" });
  });

  it("returns null once the user has edited date or hour", () => {
    expect(
      requestedStartOnBranchChange(TEXT, true, "Etc/GMT-2", NOW)
    ).toBeNull();
  });

  it("returns null when the text is unparseable in the new zone", () => {
    expect(
      requestedStartOnBranchChange("soon, in the morning", false, "UTC", NOW)
    ).toBeNull();
    expect(
      requestedStartOnBranchChange(null, false, "UTC", NOW)
    ).toBeNull();
  });

  it("drops a prefill that would land in the past in the new zone", () => {
    // 10:00 is still ahead in UTC but already past in UTC+13.
    const earlier = Date.parse("2026-10-18T09:45:00Z");
    expect(
      requestedStartOnBranchChange(
        "2026-10-18 10:00",
        false,
        "Pacific/Auckland",
        earlier
      )
    ).toBeNull();
  });
});
