import { useMemo } from "react";
import { ExternalLink, UserRoundSearch } from "lucide-react";
import type { NccLeadDto, NccPageDto, NccStudentDto } from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import {
  classifyMatches,
  matchSearches,
  type MatchQuery,
  type PersonMatch,
} from "../people-matches";
import { Avatar, StatusBadge } from "./primitives";
import { useDebounced } from "./use-list-query";

const M = copy.admissions.matches;
const SHOWN = 3;

/**
 * Looks up leads and students who may be the person being typed in: the same
 * email (EMS search covers email and names, not phone) or the same full name.
 * Searches wait for typing to pause and are cached per query.
 */
export function usePeopleMatches(
  query: MatchQuery,
  {
    enabled,
    exclude,
    kinds = ["lead", "student"],
    byName = true,
  }: {
    enabled: boolean;
    exclude?: { leadId?: string | null; studentId?: string | null };
    kinds?: Array<PersonMatch["kind"]>;
    byName?: boolean;
  }
) {
  // Debounce a string: a fresh object each render would never settle.
  const settled = useDebounced(
    JSON.stringify([query.email, query.firstName, query.lastName]),
    400
  );
  const debounced = useMemo<MatchQuery>(() => {
    const [email, firstName, lastName] = JSON.parse(settled) as string[];
    return { email, firstName, lastName };
  }, [settled]);
  const searches = matchSearches(debounced);
  const email = enabled ? searches.email : null;
  const lastName = enabled && byName ? searches.lastName : null;
  const leads = kinds.includes("lead");
  const students = kinds.includes("student");
  const keep = { keepPreviousData: true } as const;

  const leadsByEmail = useNcc<NccPageDto<NccLeadDto>>(
    email && leads ? "/api/ncc/admissions/leads" : null,
    { q: email ?? "", pageSize: 5 },
    keep
  );
  const studentsByEmail = useNcc<NccPageDto<NccStudentDto>>(
    email && students ? "/api/ncc/admissions/students" : null,
    { q: email ?? "", pageSize: 5 },
    keep
  );
  const leadsByName = useNcc<NccPageDto<NccLeadDto>>(
    lastName && leads ? "/api/ncc/admissions/leads" : null,
    { q: lastName ?? "", pageSize: 25 },
    keep
  );
  const studentsByName = useNcc<NccPageDto<NccStudentDto>>(
    lastName && students ? "/api/ncc/admissions/students" : null,
    { q: lastName ?? "", pageSize: 25 },
    keep
  );

  const matches = useMemo(() => {
    if (!enabled) return [];
    return classifyMatches(
      {
        email: email ?? "",
        firstName: lastName ? debounced.firstName : "",
        lastName: lastName ? debounced.lastName : "",
      },
      {
        leads: [
          ...(email ? (leadsByEmail.data?.items ?? []) : []),
          ...(lastName ? (leadsByName.data?.items ?? []) : []),
        ],
        students: [
          ...(email ? (studentsByEmail.data?.items ?? []) : []),
          ...(lastName ? (studentsByName.data?.items ?? []) : []),
        ],
      },
      exclude
    );
  }, [
    enabled,
    debounced,
    email,
    lastName,
    leadsByEmail.data,
    leadsByName.data,
    studentsByEmail.data,
    studentsByName.data,
    exclude?.leadId,
    exclude?.studentId,
  ]);

  return { matches, strong: matches.some(m => m.strength === "email") };
}

/**
 * "Already in Nile Learn": people who may be the one being added, each with a
 * link that opens in a new tab so the half-filled form is kept.
 */
export function PossibleMatches({
  matches,
  context,
  action,
}: {
  matches: PersonMatch[];
  /** Tunes the advice: a new lead, a new student, or a lead becoming a student. */
  context: "lead" | "leadTaken" | "student" | "convert" | "record";
  action?: React.ReactNode;
}) {
  if (!matches.length) return null;
  const strong = matches.some(match => match.strength === "email");
  const hint = !strong
    ? M.nameHint
    : context === "student"
      ? M.emailHintStudent
      : context === "convert"
        ? M.emailHintConvert
        : context === "record"
          ? M.emailHintRecord
          : context === "leadTaken"
            ? M.emailHintLeadTaken
            : M.emailHint;
  const shown = matches.slice(0, SHOWN);
  return (
    <div
      className="staff-matches"
      data-strength={strong ? "email" : "name"}
      role="status"
    >
      <div className="staff-matches-head">
        <UserRoundSearch strokeWidth={1.75} aria-hidden />
        <span className="staff-matches-title">
          {strong ? M.emailTitle : M.nameTitle}
        </span>
      </div>
      <p className="staff-matches-hint">{hint}</p>
      <ul className="staff-matches-list">
        {shown.map(match => (
          <li key={`${match.kind}:${match.id}`} className="staff-match">
            <Avatar name={match.name} seed={match.id} size="sm" />
            <span className="staff-match-body">
              <span className="staff-match-name">{match.name}</span>
              <span className="staff-match-meta">
                <span className="staff-match-kind">
                  {match.kind === "lead" ? M.lead : M.student}
                </span>
                <StatusBadge status={match.status} />
                {match.branchName ? (
                  <span className="staff-muted">{match.branchName}</span>
                ) : null}
              </span>
              <span className="staff-match-email staff-ltr" dir="ltr">
                {match.email}
              </span>
            </span>
            <a
              className="staff-btn"
              data-size="sm"
              href={`/app/${match.kind === "lead" ? "leads" : "students"}/${encodeURIComponent(match.id)}`}
              target="_blank"
              rel="noopener"
              aria-label={`${M.open}: ${match.name}`}
            >
              {M.open}
              <ExternalLink className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      {matches.length > SHOWN ? (
        <p className="staff-matches-more">
          {M.more.replace("{n}", String(matches.length - SHOWN))}
        </p>
      ) : null}
      {action ? <div className="staff-matches-action">{action}</div> : null}
    </div>
  );
}
