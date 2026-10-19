import type { NccLeadDto, NccStudentDto } from "@/lib/backend/api";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who someone may already be in Nile Learn. */
export type PersonMatch = {
  kind: "lead" | "student";
  id: string;
  name: string;
  email: string;
  status: string;
  branchName: string;
  /** "email": the same address, almost surely the same person. "name": the same full name, maybe not. */
  strength: "email" | "name";
};

export type MatchQuery = {
  email: string;
  firstName: string;
  lastName: string;
};

const fold = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/**
 * The EMS searches to run for what has been typed so far. EMS matches one
 * field at a time, so the name search uses the last word of the full name:
 * it finds "Nile QA / Student" whether it was typed that way or as
 * "Nile / QA Student". The full name is then compared here.
 */
export function matchSearches(query: MatchQuery): {
  email: string | null;
  lastName: string | null;
} {
  const email = query.email.trim();
  const first = query.firstName.trim();
  const last = query.lastName.trim();
  const lastWord = `${first} ${last}`.trim().split(/\s+/).pop() ?? "";
  return {
    email: EMAIL_PATTERN.test(email) ? email : null,
    lastName:
      first.length >= 2 && last.length >= 2 && lastWord.length >= 2
        ? lastWord
        : null,
  };
}

/**
 * Turns raw search results into matches: the same email (strong) or the same
 * full name (soft), strongest first, without the record being edited or the
 * record it is already linked to (a lead and the student it became).
 */
export function classifyMatches(
  query: MatchQuery,
  found: { leads: NccLeadDto[]; students: NccStudentDto[] },
  exclude: { leadId?: string | null; studentId?: string | null } = {}
): PersonMatch[] {
  const email = fold(query.email);
  const fullName = fold(`${query.firstName} ${query.lastName}`);
  const byKey = new Map<string, PersonMatch>();

  const consider = (
    kind: PersonMatch["kind"],
    person: {
      id: string;
      firstName: string;
      lastName: string;
      name: string;
      email: string;
      status: string;
      branchName: string;
    }
  ) => {
    if (kind === "lead" && person.id === exclude.leadId) return;
    if (kind === "student" && person.id === exclude.studentId) return;
    const strength: PersonMatch["strength"] | null =
      email && EMAIL_PATTERN.test(query.email.trim()) && fold(person.email) === email
        ? "email"
        : fullName.length > 3 &&
            fold(`${person.firstName} ${person.lastName}`) === fullName
          ? "name"
          : null;
    if (!strength) return;
    const key = `${kind}:${person.id}`;
    const seen = byKey.get(key);
    if (seen?.strength === "email") return;
    byKey.set(key, {
      kind,
      id: person.id,
      name: person.name,
      email: person.email,
      status: person.status,
      branchName: person.branchName,
      strength,
    });
  };

  for (const lead of found.leads) consider("lead", lead);
  for (const student of found.students) {
    consider("student", { ...student, branchName: student.branchName });
  }

  const rank = (match: PersonMatch) =>
    (match.strength === "email" ? 0 : 2) + (match.kind === "student" ? 0 : 1);
  return Array.from(byKey.values()).sort((a, b) => rank(a) - rank(b));
}

/**
 * The lead type that fits a returning person: an active student is a current
 * student, a disabled one an old student. Null when no student matched by email.
 */
export function suggestedLeadType(
  matches: PersonMatch[]
): "current_student" | "old_student" | null {
  const students = matches.filter(
    match => match.kind === "student" && match.strength === "email"
  );
  if (!students.length) return null;
  return students.some(match => match.status === "active")
    ? "current_student"
    : "old_student";
}
