import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import type { NccRole } from "@/lib/backend/api";
import { copy } from "../copy";
import { GUIDE_CATEGORIES, type GuideScenario } from "../guide/content";
import { useGuideText } from "../guide/use-guide-text";
import type { GuideText } from "../guide/text";
import {
  GUIDE_JOURNEY,
  guideAreaVisual,
  guidePageLabel,
} from "../guide/visual";
import { useStaffLocale } from "../i18n";
import { ROLE_ORDER, ROLE_LABELS } from "../roles";
import { useStaffSession } from "../session";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/kit";

const G = () => copy.guide;
const COLLAPSED_KEY = "guide.collapsed";
const COMBINING_MARKS = new RegExp("\\p{M}", "gu");

export const guideNorm = (value: string) =>
  value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

export function guideMatches(
  text: GuideText,
  query: string,
  categoryId: string,
  scenarioId: string
): boolean {
  const needle = guideNorm(query.trim());
  if (!needle) return true;
  const category = text.categories[categoryId];
  const scenario = text.scenarios[scenarioId];
  const haystacks = [
    category?.title ?? "",
    category?.summary ?? "",
    scenario?.title ?? "",
    scenario?.summary ?? "",
    ...(scenario?.steps ?? []).flatMap(step => [step.title, step.body]),
    ...(scenario?.notes ?? []),
  ];
  return haystacks.some(hay => guideNorm(hay).includes(needle));
}

/** Scenario ids visible for a role; "all" is the Super Admin preview. */
export function guideScenariosFor(role: NccRole | "all") {
  return GUIDE_CATEGORIES.map(category => ({
    category,
    scenarios: category.scenarios.filter(
      scenario => role === "all" || scenario.roles.includes(role)
    ),
  })).filter(entry => entry.scenarios.length > 0);
}

/** Wrap every diacritic-insensitive match of `query` in <mark>. */
function Highlight({ value, query }: { value: string; query: string }) {
  const needle = guideNorm(query.trim());
  if (!needle) return <>{value}</>;
  const chars = Array.from(value);
  const folded = chars.map(guideNorm);
  const parts: Array<{ text: string; hit: boolean }> = [];
  let index = 0;
  while (index < chars.length) {
    let joined = "";
    let end = index;
    while (end < chars.length && joined.length < needle.length)
      joined += folded[end++];
    if (joined === needle) {
      parts.push({ text: chars.slice(index, end).join(""), hit: true });
      index = end;
    } else {
      const last = parts[parts.length - 1];
      if (last && !last.hit) last.text += chars[index];
      else parts.push({ text: chars[index], hit: false });
      index += 1;
    }
  }
  return (
    <>
      {parts.map((part, key) =>
        part.hit ? (
          <mark key={key} className="staff-guide-mark">
            {part.text}
          </mark>
        ) : (
          <Fragment key={key}>{part.text}</Fragment>
        )
      )}
    </>
  );
}

function AreaIcon({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  const { icon: Icon, tone } = guideAreaVisual(id);
  return (
    <span
      className="staff-guide-icon"
      data-tone={tone}
      data-size={size}
      aria-hidden
    >
      <Icon size={size === "sm" ? 14 : 18} strokeWidth={1.75} />
    </span>
  );
}

function RoleList({ roles }: { roles: NccRole[] }) {
  if (roles.length === ROLE_ORDER.length)
    return <span className="staff-guide-chip">{G().allStaff}</span>;
  return (
    <span className="staff-guide-roles">
      {roles.map(role => (
        <span key={role} className="staff-guide-chip">
          {ROLE_LABELS[role]}
        </span>
      ))}
    </span>
  );
}

export default function GuidePage() {
  const { session } = useStaffSession();
  const activeRole = session?.ncc?.activeRole ?? null;
  const locale = useStaffLocale();
  const search = useSearch();
  const [, navigate] = useLocation();
  const isSuperAdmin = activeRole === "super_admin";
  const urlRole = new URLSearchParams(search).get("role");
  const viewRole: NccRole | "all" =
    isSuperAdmin && urlRole === "all"
      ? "all"
      : isSuperAdmin &&
          urlRole !== null &&
          (ROLE_ORDER as string[]).includes(urlRole)
        ? (urlRole as NccRole)
        : (activeRole ?? "super_admin");

  const { text, failed, retry } = useGuideText(locale);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (text && hash)
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [text]);

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const value: unknown = JSON.parse(
        sessionStorage.getItem(COLLAPSED_KEY) ?? "{}"
      );
      if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
      return Object.fromEntries(
        Object.entries(value).filter(([, item]) => typeof item === "boolean")
      );
    } catch {
      return {};
    }
  });
  const saveCollapsed = (value: Record<string, boolean>) => {
    setCollapsed(value);
    try {
      sessionStorage.setItem(COLLAPSED_KEY, JSON.stringify(value));
    } catch {
      // Category controls still work when browser storage is unavailable.
    }
  };

  const forRole = useMemo(() => guideScenariosFor(viewRole), [viewRole]);
  const groups = useMemo(() => {
    if (!text) return [];
    return forRole.map(entry => ({
      ...entry,
      scenarios: entry.scenarios.filter(scenario =>
        guideMatches(text, query, entry.category.id, scenario.id)
      ),
    }));
  }, [text, forRole, query]);
  const searching = guideNorm(query.trim()).length > 0;
  const visibleGroups = searching
    ? groups.filter(entry => entry.scenarios.length > 0)
    : groups;
  const resultCount = visibleGroups.reduce(
    (sum, entry) => sum + entry.scenarios.length,
    0
  );
  const anyCollapsed = forRole.some(entry => collapsed[entry.category.id]);

  const totals = useMemo(() => {
    const scenarios = forRole.flatMap(entry => entry.scenarios);
    return {
      scenarios: scenarios.length,
      areas: forRole.length,
      steps: scenarios.reduce((sum, item) => sum + item.steps.length, 0),
    };
  }, [forRole]);
  const maxPerArea = Math.max(1, ...forRole.map(e => e.scenarios.length));

  const setViewRole = (value: string) => {
    const params = new URLSearchParams(search);
    params.set("role", value);
    navigate(`/app/guide?${params.toString()}`);
  };

  const jumpTo = (id: string) => {
    if (collapsed[id]) saveCollapsed({ ...collapsed, [id]: false });
    requestAnimationFrame(() =>
      document
        .getElementById(`guide-area-${id}`)
        ?.scrollIntoView({ block: "start" })
    );
  };

  const roleName = viewRole === "all" ? G().allRoles : ROLE_LABELS[viewRole];

  return (
    <section className="staff-page staff-guide" aria-labelledby="guide-title">
      <header className="staff-page-header">
        <div className="staff-page-heading">
          <h1 id="guide-title">{G().title}</h1>
          <p className="staff-page-desc">{G().description}</p>
        </div>
        {isSuperAdmin && (
          <div className="staff-page-actions">
            <div className="staff-guide-rolepick">
              <span className="staff-field-label" id="guide-role-label">
                {G().showFor}
              </span>
              <Select value={viewRole} onValueChange={setViewRole}>
                <SelectTrigger aria-labelledby="guide-role-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{G().allRoles}</SelectItem>
                  {ROLE_ORDER.map(role => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </header>

      <div className="staff-toolbar staff-guide-toolbar">
        <div className="staff-search staff-guide-search">
          <Search size={16} className="staff-search-glyph" aria-hidden />
          <input
            ref={searchRef}
            className="staff-input staff-search-input"
            type="search"
            aria-label={G().searchPlaceholder}
            placeholder={G().searchPlaceholder}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape") setQuery("");
            }}
          />
          {!query && <kbd className="staff-search-kbd">/</kbd>}
        </div>
        <span className="staff-guide-count" aria-live="polite">
          {searching
            ? G().results.replace("{count}", String(resultCount))
            : G().scenarioCount.replace("{count}", String(totals.scenarios))}
        </span>
        {!searching && (
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const entry of forRole)
                next[entry.category.id] = !anyCollapsed;
              saveCollapsed(next);
            }}
          >
            {anyCollapsed ? G().expandAll : G().collapseAll}
          </button>
        )}
      </div>

      {text && !searching && (
        <>
          <div className="staff-guide-overview">
            <section
              className="staff-card staff-guide-glance"
              aria-labelledby="guide-glance"
            >
              <h2 id="guide-glance">{G().glance}</h2>
              <p className="staff-guide-glance-for">
                {viewRole === "all"
                  ? roleName
                  : viewRole === activeRole
                    ? G().forYou
                    : G().forRole.replace("{role}", roleName)}
              </p>
              <dl className="staff-guide-stats">
                <div>
                  <dt>{G().scenarios}</dt>
                  <dd>{totals.scenarios}</dd>
                </div>
                <div>
                  <dt>{G().areas}</dt>
                  <dd>{totals.areas}</dd>
                </div>
                <div>
                  <dt>{G().steps}</dt>
                  <dd>{totals.steps}</dd>
                </div>
              </dl>
            </section>

            <section
              className="staff-card staff-guide-areas"
              aria-labelledby="guide-by-area"
            >
              <div className="staff-guide-card-head">
                <h2 id="guide-by-area">{G().byArea}</h2>
                <p className="staff-guide-note">{G().byAreaNote}</p>
              </div>
              <ul className="staff-guide-bars">
                {forRole.map(({ category, scenarios }) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      className="staff-guide-bar"
                      onClick={() => jumpTo(category.id)}
                    >
                      <AreaIcon id={category.id} size="sm" />
                      <span className="staff-guide-bar-label">
                        {text.categories[category.id]?.title}
                      </span>
                      <span className="staff-guide-bar-track" aria-hidden>
                        <span
                          className="staff-guide-bar-fill"
                          data-tone={guideAreaVisual(category.id).tone}
                          style={{
                            inlineSize: `${(scenarios.length / maxPerArea) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="staff-guide-bar-value">
                        {scenarios.length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {viewRole === "all" && (
            <CoverageMatrix text={text} onPick={setViewRole} />
          )}

          <Journey text={text} role={viewRole} />
        </>
      )}

      {failed ? (
        <div className="staff-empty" role="alert">
          <p className="staff-state-title">{copy.state.errorGeneric}</p>
          <button type="button" className="staff-btn" onClick={retry}>
            {copy.state.retry}
          </button>
        </div>
      ) : !text ? (
        <div className="staff-guide-sections" aria-busy>
          {[0, 1].map(key => (
            <div key={key} className="staff-card">
              <div className="staff-skeleton" style={{ blockSize: 120 }} />
            </div>
          ))}
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="staff-empty">
          <span className="staff-state-icon" aria-hidden>
            <Search size={20} />
          </span>
          <p className="staff-state-title">{G().noMatch}</p>
          <button
            type="button"
            className="staff-btn"
            onClick={() => setQuery("")}
          >
            {G().clearSearch}
          </button>
        </div>
      ) : (
        <div className="staff-guide-sections">
          {visibleGroups.map(({ category, scenarios }) => {
            const isOpen = searching || !collapsed[category.id];
            const areaText = text.categories[category.id];
            const panelId = `guide-panel-${category.id}`;
            return (
              <section
                key={category.id}
                id={`guide-area-${category.id}`}
                className="staff-guide-area"
                aria-labelledby={`guide-area-title-${category.id}`}
              >
                <button
                  type="button"
                  className="staff-guide-area-head"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    saveCollapsed({ ...collapsed, [category.id]: isOpen })
                  }
                >
                  <AreaIcon id={category.id} />
                  <span className="staff-guide-area-text">
                    <span
                      className="staff-guide-area-title"
                      id={`guide-area-title-${category.id}`}
                    >
                      <Highlight
                        value={areaText?.title ?? category.id}
                        query={query}
                      />
                    </span>
                    <span className="staff-guide-area-summary">
                      {areaText?.summary}
                    </span>
                  </span>
                  <span className="staff-guide-area-count">
                    {G().scenarioCount.replace(
                      "{count}",
                      String(scenarios.length)
                    )}
                  </span>
                  <ChevronDown
                    size={18}
                    className="staff-guide-chevron"
                    data-open={isOpen}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <ul className="staff-guide-grid" id={panelId}>
                    {scenarios.map(scenario => (
                      <ScenarioCard
                        key={scenario.id}
                        scenario={scenario}
                        text={text}
                        query={query}
                        showRoles={viewRole === "all"}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScenarioCard({
  scenario,
  text,
  query,
  showRoles,
}: {
  scenario: GuideScenario;
  text: GuideText;
  query: string;
  showRoles: boolean;
}) {
  const scenarioText = text.scenarios[scenario.id];
  const firstHref = scenario.steps.find(step => step.href)?.href;
  const page = firstHref ? guidePageLabel(firstHref) : null;
  return (
    <li>
      <Link to={`/app/guide/${scenario.id}`} className="staff-guide-card">
        <span className="staff-guide-card-title">
          <Highlight value={scenarioText?.title ?? scenario.id} query={query} />
        </span>
        <span className="staff-guide-card-summary">
          <Highlight value={scenarioText?.summary ?? ""} query={query} />
        </span>
        <span className="staff-guide-card-meta">
          <span className="staff-guide-steps-pips" aria-hidden>
            {scenario.steps.map((_, index) => (
              <span key={index} />
            ))}
          </span>
          <span>
            {G().stepCount.replace("{count}", String(scenario.steps.length))}
          </span>
          {page && <span className="staff-guide-chip">{page}</span>}
          <ArrowRight
            size={16}
            className="staff-guide-card-go staff-rtl-flip"
            aria-hidden
          />
        </span>
        {showRoles && (
          <span className="staff-guide-card-roles">
            <RoleList roles={scenario.roles} />
          </span>
        )}
      </Link>
    </li>
  );
}

/** Roles × areas heatmap for the Super Admin "All roles" preview. */
function CoverageMatrix({
  text,
  onPick,
}: {
  text: GuideText;
  onPick: (role: string) => void;
}) {
  const max = Math.max(
    1,
    ...GUIDE_CATEGORIES.flatMap(category =>
      ROLE_ORDER.map(
        role => category.scenarios.filter(s => s.roles.includes(role)).length
      )
    )
  );
  return (
    <section
      className="staff-card staff-guide-matrix"
      aria-labelledby="guide-coverage"
    >
      <div className="staff-guide-card-head">
        <h2 id="guide-coverage">{G().coverage}</h2>
        <p className="staff-guide-note">{G().coverageNote}</p>
      </div>
      <div className="staff-guide-matrix-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{G().showFor}</span>
              </th>
              {GUIDE_CATEGORIES.map(category => (
                <th
                  key={category.id}
                  scope="col"
                  title={text.categories[category.id]?.title}
                >
                  <AreaIcon id={category.id} size="sm" />
                  <span className="staff-guide-matrix-area">
                    {text.categories[category.id]?.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_ORDER.map(role => (
              <tr key={role}>
                <th scope="row">
                  <button
                    type="button"
                    className="staff-guide-matrix-role"
                    onClick={() => onPick(role)}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                </th>
                {GUIDE_CATEGORIES.map(category => {
                  const count = category.scenarios.filter(s =>
                    s.roles.includes(role)
                  ).length;
                  return (
                    <td
                      key={category.id}
                      data-empty={count === 0 || undefined}
                      style={
                        { "--level": String(count / max) } as CSSProperties
                      }
                    >
                      {count || "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The admissions flow as a connected row of steps. */
function Journey({ text, role }: { text: GuideText; role: NccRole | "all" }) {
  const nodes = GUIDE_JOURNEY.flatMap(id => {
    const category = GUIDE_CATEGORIES.find(c =>
      c.scenarios.some(s => s.id === id)
    );
    const scenario = category?.scenarios.find(s => s.id === id);
    return category && scenario ? [{ category, scenario }] : [];
  });
  const mine = nodes.filter(
    node => role === "all" || node.scenario.roles.includes(role)
  ).length;
  if (mine === 0) return null;
  return (
    <section
      className="staff-card staff-guide-journey"
      aria-labelledby="guide-journey"
    >
      <div className="staff-guide-card-head">
        <h2 id="guide-journey">{G().journey}</h2>
        <p className="staff-guide-note">{G().journeyNote}</p>
      </div>
      <ol className="staff-guide-flow">
        {nodes.map(({ category, scenario }, index) => {
          const yours = role === "all" || scenario.roles.includes(role);
          const body = (
            <>
              <span className="staff-guide-flow-dot">
                <AreaIcon id={category.id} size="sm" />
              </span>
              <span className="staff-guide-flow-step">{index + 1}</span>
              <span className="staff-guide-flow-title">
                {text.scenarios[scenario.id]?.title}
              </span>
              <span className="staff-guide-flow-area">
                {yours ? text.categories[category.id]?.title : G().otherRole}
              </span>
            </>
          );
          return (
            <li
              key={scenario.id}
              className="staff-guide-flow-node"
              data-yours={yours || undefined}
            >
              {yours ? (
                <Link
                  to={`/app/guide/${scenario.id}`}
                  className="staff-guide-flow-link"
                >
                  {body}
                </Link>
              ) : (
                <span className="staff-guide-flow-link">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
