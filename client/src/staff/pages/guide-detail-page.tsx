import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Info,
  LifeBuoy,
  RotateCcw,
} from "lucide-react";
import type { NccRole } from "@/lib/backend/api";
import { copy } from "../copy";
import { guideScenarioById } from "../guide/content";
import { useGuideText } from "../guide/use-guide-text";
import { guideAreaVisual, guidePageLabel } from "../guide/visual";
import { useStaffLocale } from "../i18n";
import { ROLE_LABELS, ROLE_ORDER } from "../roles";
import { useStaffSession } from "../session";

const G = () => copy.guide;
const doneKey = (id: string) => `guide.done.${id}`;

function readDone(id: string): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(doneKey(id)) ?? "[]");
    return Array.isArray(value)
      ? Array.from(
          new Set<number>(
            value.filter(step => Number.isInteger(step) && step >= 0)
          )
        )
      : [];
  } catch {
    return [];
  }
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 72;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = total ? done / total : 0;
  const label = G()
    .progress.replace("{done}", String(done))
    .replace("{total}", String(total));
  return (
    <div
      className="staff-guide-ring"
      data-complete={done === total || undefined}
    >
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          className="staff-guide-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="staff-guide-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={`${share * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="staff-guide-ring-value" aria-hidden>
        {done}/{total}
      </span>
    </div>
  );
}

export default function GuideDetailPage() {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const { session } = useStaffSession();
  const locale = useStaffLocale();
  const role = session?.ncc?.activeRole ?? null;
  const { text, failed, retry } = useGuideText(locale);
  const [done, setDone] = useState<number[]>(() => readDone(scenarioId));

  useEffect(() => setDone(readDone(scenarioId)), [scenarioId]);

  const found = guideScenarioById(scenarioId);
  const allowed =
    found !== null &&
    role !== null &&
    (role === "super_admin" || found.scenario.roles.includes(role));

  if (!found || !allowed) {
    return (
      <section className="staff-page">
        <div className="staff-empty">
          <span className="staff-state-icon" aria-hidden>
            <LifeBuoy size={20} />
          </span>
          <h1 className="staff-state-title">{G().notFound}</h1>
          <Link to="/app/guide" className="staff-btn" data-variant="primary">
            {G().backToGuide}
          </Link>
        </div>
      </section>
    );
  }
  if (failed) {
    return (
      <section className="staff-page">
        <div className="staff-empty" role="alert">
          <p className="staff-state-title">{copy.state.errorGeneric}</p>
          <button type="button" className="staff-btn" onClick={retry}>
            {copy.state.retry}
          </button>
        </div>
      </section>
    );
  }
  if (!text) {
    return (
      <section className="staff-page" aria-busy>
        <div className="staff-card">
          <div className="staff-skeleton" style={{ blockSize: 240 }} />
        </div>
      </section>
    );
  }

  const { category, scenario } = found;
  const scenarioText = text.scenarios[scenario.id];
  const areaTitle = text.categories[category.id]?.title ?? category.id;
  const { icon: AreaIcon, tone } = guideAreaVisual(category.id);
  const visibleSiblings = category.scenarios.filter(
    item => role === "super_admin" || item.roles.includes(role as NccRole)
  );
  const index = visibleSiblings.findIndex(item => item.id === scenario.id);
  const previous = index > 0 ? visibleSiblings[index - 1] : null;
  const next =
    index >= 0 && index < visibleSiblings.length - 1
      ? visibleSiblings[index + 1]
      : null;
  const total = scenario.steps.length;
  const doneCount = done.filter(step => step < total).length;

  const toggleStep = (step: number) => {
    const value = done.includes(step)
      ? done.filter(item => item !== step)
      : [...done, step];
    setDone(value);
    try {
      localStorage.setItem(doneKey(scenario.id), JSON.stringify(value));
    } catch {
      // The checklist remains usable without persistent browser storage.
    }
  };
  const reset = () => {
    setDone([]);
    try {
      localStorage.removeItem(doneKey(scenario.id));
    } catch {
      // Reset the in-memory checklist even if storage is blocked.
    }
  };

  return (
    <section
      className="staff-page staff-guide"
      aria-labelledby="guide-scenario-title"
    >
      <nav className="staff-guide-crumbs" aria-label={G().title}>
        <Link to="/app/guide" className="staff-guide-link">
          {G().title}
        </Link>
        <ChevronRight size={14} className="staff-rtl-flip" aria-hidden />
        <Link
          to={`/app/guide#guide-area-${category.id}`}
          className="staff-guide-link"
        >
          {areaTitle}
        </Link>
      </nav>

      <header className="staff-guide-hero">
        <span
          className="staff-guide-icon"
          data-tone={tone}
          data-size="lg"
          aria-hidden
        >
          <AreaIcon size={22} strokeWidth={1.75} />
        </span>
        <div className="staff-page-heading">
          <h1 id="guide-scenario-title">{scenarioText?.title}</h1>
          <p className="staff-page-desc">{scenarioText?.summary}</p>
          <div className="staff-guide-hero-meta">
            <span className="staff-guide-chip">
              {G().stepCount.replace("{count}", String(total))}
            </span>
            <span className="staff-guide-hero-roles">
              <span className="staff-guide-meta-label">{G().whoCanDo}</span>
              {scenario.roles.length === ROLE_ORDER.length ? (
                <span className="staff-guide-chip">{G().allStaff}</span>
              ) : (
                scenario.roles.map(item => (
                  <span
                    key={item}
                    className="staff-guide-chip"
                    data-current={item === role || undefined}
                  >
                    {ROLE_LABELS[item]}
                  </span>
                ))
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="staff-guide-detail">
        <ol className="staff-guide-timeline">
          {scenario.steps.map((step, stepIndex) => {
            const stepText = scenarioText?.steps[stepIndex];
            const isDone = done.includes(stepIndex);
            const page = step.href ? guidePageLabel(step.href) : null;
            return (
              <li
                key={stepIndex}
                className="staff-guide-tstep"
                data-done={isDone || undefined}
              >
                <button
                  type="button"
                  className="staff-guide-marker"
                  aria-pressed={isDone}
                  aria-label={`${G().markDone}: ${stepText?.title ?? ""}`}
                  onClick={() => toggleStep(stepIndex)}
                >
                  {isDone ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : (
                    stepIndex + 1
                  )}
                </button>
                <div className="staff-guide-tbody">
                  <h2 className="staff-guide-ttitle">{stepText?.title}</h2>
                  <p className="staff-guide-tdesc">{stepText?.body}</p>
                  {step.href && (
                    <Link to={step.href} className="staff-btn" data-size="sm">
                      {page
                        ? G().openNamed.replace("{page}", page)
                        : G().openPage}
                      <ArrowRight
                        size={14}
                        className="staff-rtl-flip"
                        aria-hidden
                      />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <aside className="staff-guide-aside">
          <section
            className="staff-card staff-guide-progress"
            aria-label={G().steps}
          >
            <ProgressRing done={doneCount} total={total} />
            <div className="staff-guide-progress-text">
              <strong>
                {G()
                  .progress.replace("{done}", String(doneCount))
                  .replace("{total}", String(total))}
              </strong>
              {doneCount > 0 && (
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="ghost"
                  data-size="sm"
                  onClick={reset}
                >
                  <RotateCcw size={14} aria-hidden />
                  {G().startOver}
                </button>
              )}
            </div>
          </section>

          {scenarioText && scenarioText.notes.length > 0 && (
            <section
              className="staff-card staff-guide-callout"
              aria-labelledby="guide-notes"
            >
              <h2 id="guide-notes">
                <Info size={16} aria-hidden />
                {G().goodToKnow}
              </h2>
              <ul>
                {scenarioText.notes.map((note, noteIndex) => (
                  <li key={noteIndex}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          {visibleSiblings.length > 1 && (
            <section
              className="staff-card staff-guide-related"
              aria-labelledby="guide-related"
            >
              <h2 id="guide-related">
                {G().moreIn.replace("{area}", areaTitle)}
              </h2>
              <ul>
                {visibleSiblings.map(item => (
                  <li key={item.id}>
                    {item.id === scenario.id ? (
                      <span aria-current="page">
                        {text.scenarios[item.id]?.title}
                      </span>
                    ) : (
                      <Link
                        to={`/app/guide/${item.id}`}
                        className="staff-guide-link"
                      >
                        {text.scenarios[item.id]?.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {(previous || next) && (
        <nav className="staff-guide-pager" aria-label={areaTitle}>
          {previous ? (
            <Link
              to={`/app/guide/${previous.id}`}
              className="staff-guide-pager-link"
            >
              <span className="staff-guide-meta-label">
                <ArrowLeft size={14} className="staff-rtl-flip" aria-hidden />
                {G().previous}
              </span>
              <span>{text.scenarios[previous.id]?.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={`/app/guide/${next.id}`}
              className="staff-guide-pager-link"
              data-next
            >
              <span className="staff-guide-meta-label">
                {G().next}
                <ArrowRight size={14} className="staff-rtl-flip" aria-hidden />
              </span>
              <span>{text.scenarios[next.id]?.title}</span>
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
