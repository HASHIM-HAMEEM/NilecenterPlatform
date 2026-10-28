import { describe, expect, it } from "vitest";
import type { NccCustomFieldDefinitionDto } from "../lib/backend/api";
import {
  customFieldDefinition,
  customFieldLabel,
  formatCustomFieldValue,
} from "./custom-fields";

const defs: NccCustomFieldDefinitionDto[] = [
  {
    id: "d1",
    entityType: "user_profile",
    fieldKey: "badge_id",
    label: "Badge number",
    fieldType: "text",
    isRequired: false,
    isActive: true,
    helpText: null,
    options: null,
    sortOrder: 1,
  },
  {
    id: "d2",
    entityType: "user_profile",
    fieldKey: "driving",
    label: "Can drive",
    fieldType: "boolean",
    isRequired: false,
    isActive: true,
    helpText: null,
    options: null,
    sortOrder: 2,
  },
  {
    id: "d3",
    entityType: "user_profile",
    fieldKey: "joined",
    label: "Joined on",
    fieldType: "date",
    isRequired: false,
    isActive: true,
    helpText: null,
    options: null,
    sortOrder: 3,
  },
];

describe("custom field display helpers", () => {
  it("labels a key from its definition and falls back to the raw key", () => {
    expect(customFieldLabel(defs, "badge_id")).toBe("Badge number");
    expect(customFieldLabel(defs, "unknown_key")).toBe("unknown_key");
    expect(customFieldLabel(undefined, "badge_id")).toBe("badge_id");
  });

  it("finds the definition for a key", () => {
    expect(customFieldDefinition(defs, "joined")?.fieldType).toBe("date");
    expect(customFieldDefinition(undefined, "joined")).toBeUndefined();
  });

  it("formats values by field type", () => {
    expect(formatCustomFieldValue(defs[1], true)).toBe("Yes");
    expect(formatCustomFieldValue(defs[1], "false")).toBe("No");
    expect(formatCustomFieldValue(defs[2], "2026-03-01")).not.toBe("2026-03-01");
    expect(formatCustomFieldValue(defs[0], "BR-12")).toBe("BR-12");
    // No definition → raw string value.
    expect(formatCustomFieldValue(undefined, 42)).toBe("42");
    // Null and empty read as the not-set copy.
    expect(formatCustomFieldValue(defs[0], null)).toBe("Not set");
    expect(formatCustomFieldValue(defs[0], "")).toBe("Not set");
    // An unparseable date stays raw.
    expect(formatCustomFieldValue(defs[2], "someday")).toBe("someday");
  });
});
