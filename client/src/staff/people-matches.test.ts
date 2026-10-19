import { describe, expect, it } from "vitest";
import type { NccLeadDto, NccStudentDto } from "@/lib/backend/api";
import {
  classifyMatches,
  matchSearches,
  suggestedLeadType,
} from "./people-matches";

const lead = (over: Partial<NccLeadDto>): NccLeadDto =>
  ({
    id: "l1",
    firstName: "Sara",
    lastName: "Ahmed",
    name: "Sara Ahmed",
    email: "sara@example.com",
    status: "follow_up",
    branchName: "Cairo B1",
    ...over,
  }) as NccLeadDto;

const student = (over: Partial<NccStudentDto>): NccStudentDto =>
  ({
    id: "s1",
    firstName: "Sara",
    lastName: "Ahmed",
    name: "Sara Ahmed",
    email: "sara@example.com",
    status: "active",
    branchName: "Cairo B1",
    ...over,
  }) as NccStudentDto;

const query = { email: "Sara@Example.com ", firstName: "sara", lastName: "AHMED" };

describe("matchSearches", () => {
  it("searches by email only once it looks valid, and by last name once both names have 2+ letters", () => {
    expect(matchSearches({ email: "sara@", firstName: "S", lastName: "Ahmed" })).toEqual({
      email: null,
      lastName: null,
    });
    expect(matchSearches(query)).toEqual({ email: "Sara@Example.com", lastName: "AHMED" });
  });

  it("searches the last word of the full name, whatever the first/last split", () => {
    expect(matchSearches({ email: "", firstName: "Nile", lastName: "QA Student" }).lastName).toBe("Student");
    expect(matchSearches({ email: "", firstName: "Nile QA", lastName: "Student" }).lastName).toBe("Student");
  });

  it("matches the same full name split differently", () => {
    const matches = classifyMatches(
      { email: "", firstName: "Nile", lastName: "QA Student" },
      { leads: [], students: [student({ firstName: "Nile QA", lastName: "Student", name: "Nile QA Student" })] }
    );
    expect(matches.map(m => m.strength)).toEqual(["name"]);
  });
});

describe("classifyMatches", () => {
  it("treats the same email as strong and the same full name as soft, ignoring case and spaces", () => {
    const matches = classifyMatches(query, {
      leads: [lead({}), lead({ id: "l2", email: "other@example.com" })],
      students: [],
    });
    expect(matches.map(m => [m.id, m.strength])).toEqual([
      ["l1", "email"],
      ["l2", "name"],
    ]);
  });

  it("puts students before leads and email before name", () => {
    const matches = classifyMatches(query, {
      leads: [lead({})],
      students: [student({ id: "s9", email: "x@example.com" }), student({})],
    });
    expect(matches.map(m => `${m.kind}:${m.id}:${m.strength}`)).toEqual([
      "student:s1:email",
      "lead:l1:email",
      "student:s9:name",
    ]);
  });

  it("skips the record being edited and unrelated people", () => {
    const matches = classifyMatches(
      query,
      { leads: [lead({}), lead({ id: "l3", firstName: "Omar", name: "Omar Ahmed", email: "o@example.com" })], students: [student({})] },
      { leadId: "l1", studentId: "s1" }
    );
    expect(matches).toEqual([]);
  });

  it("does not match by email while the email is incomplete", () => {
    const matches = classifyMatches(
      { email: "sara@example", firstName: "", lastName: "" },
      { leads: [lead({ email: "sara@example" })], students: [] }
    );
    expect(matches).toEqual([]);
  });
});

describe("suggestedLeadType", () => {
  it("suggests current student for an active match and old student for a disabled one", () => {
    const active = classifyMatches(query, { leads: [], students: [student({})] });
    const disabled = classifyMatches(query, { leads: [], students: [student({ status: "disabled" })] });
    expect(suggestedLeadType(active)).toBe("current_student");
    expect(suggestedLeadType(disabled)).toBe("old_student");
    expect(suggestedLeadType(classifyMatches(query, { leads: [lead({})], students: [] }))).toBeNull();
  });
});
