import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NileRosette } from "@/components/brand/NileLogo";
import { verifyPublicCertificateRequest, type PublicCertificateVerificationDto } from "@/lib/backend/api";
import { fetchPublicForm, submitPublicFormRequest } from "@/lib/forms/api";
import { leadFormSchema, placementFormSchema } from "@/lib/validators/platform";
import { BRANCH_CHOICE_PREFIX, getLocalizedText, type FormField, type FormLocale } from "@shared/nileForms";
import { LANDING_COPY, type LandingLocale } from "../home/landing-copy";
import { OFFICIAL_PRIVACY, OFFICIAL_TERMS, PUBLIC_COPY } from "../home/public-copy";
import {
  CountUp,
  EMAIL,
  Lattice,
  PETAL_COLOURS,
  PHONE_ONLINE,
  PHONE_ONSITE,
  Petal,
  PublicChrome,
  usePublicLocale,
  whatsapp,
} from "../home/public-chrome";

type PublicMode =
  | "catalog"
  | "course"
  | "trial"
  | "placement"
  | "verify"
  | "faq"
  | "contact"
  | "about"
  | "privacy"
  | "terms";

type PageProps = { locale: LandingLocale };
const vars = (values: Record<string, string | number>) => values as CSSProperties;

export default function PublicSitePage({ mode, slug }: { mode: PublicMode; slug?: string }) {
  const [locale, setLocale] = usePublicLocale();
  const page =
    mode === "trial" ? (
      <BookingForm type={mode} locale={locale} />
    ) : mode === "placement" ? (
      <PlacementBooking locale={locale} />
    ) : mode === "verify" ? (
      <CertificateVerification locale={locale} />
    ) : mode === "course" || (mode === "catalog" && slug) ? (
      // Programme addresses such as /courses/quran open the programme page.
      <CourseDetail slug={slug ?? "arabic"} locale={locale} />
    ) : mode === "catalog" ? (
      <CourseCatalog locale={locale} />
    ) : mode === "faq" ? (
      <Faq locale={locale} />
    ) : mode === "contact" ? (
      <Contact locale={locale} />
    ) : mode === "about" ? (
      <About locale={locale} />
    ) : (
      <Legal kind={mode} locale={locale} />
    );
  return (
    <PublicChrome locale={locale} onLocaleChange={setLocale}>
      {page}
    </PublicChrome>
  );
}

/* ---------------- Shared blocks -------------------------------------- */

function PageHero({
  eyebrow,
  title,
  lead,
  tone = PETAL_COLOURS[0],
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <section className="pp-hero">
      <div className="lp-wrap pp-hero-row">
        <div className="pp-hero-copy">
          <p className="lp-eyebrow lp-stagger" style={vars({ "--d": 0 })}>
            <Petal colour={tone} className="pp-eyebrow-petal" />
            {eyebrow}
          </p>
          <h1 className="pp-title lp-stagger" style={vars({ "--d": 1 })}>
            {title}
          </h1>
          {lead ? (
            <p className="lp-lead lp-stagger" style={vars({ "--d": 2 })}>
              {lead}
            </p>
          ) : null}
          {children ? (
            <div className="lp-stagger" style={vars({ "--d": 3 })}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
      <div className="pp-hero-mark" aria-hidden="true" style={vars({ "--turn": `${PETAL_COLOURS.indexOf(tone) * -45}deg` })}>
        <NileRosette size="100%" />
      </div>
    </section>
  );
}

function CtaBand({ locale, title, text }: PageProps & { title: string; text: string }) {
  const t = LANDING_COPY[locale];
  return (
    <section className="lp-cta">
      <Lattice className="lp-cta-lattice" scale={2.4} />
      <div className="lp-wrap lp-cta-inner lp-reveal">
        <h2 className="lp-h2 lp-cta-title">{title}</h2>
        <p className="lp-cta-text">{text}</p>
        <div className="lp-actions">
          <Link href="/book-free-trial" className="lp-btn" data-variant="accent" data-size="lg">
            {t.cta.trial}
            <ArrowRight className="lp-flip" aria-hidden="true" />
          </Link>
          <Link href="/book-placement-test" className="lp-btn" data-variant="ghost" data-size="lg">
            {t.hero.placement}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Programmes ----------------------------------------- */

function CourseCatalog({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale];
  const programmes = LANDING_COPY[locale].programmes.items;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return programmes
      .map((item, index) => ({ ...item, index }))
      .filter(item => filter === "all" || item.slug === filter)
      .filter(item => !needle || `${item.name} ${item.desc} ${item.meta}`.toLocaleLowerCase(locale).includes(needle));
  }, [programmes, filter, query, locale]);

  return (
    <>
      <PageHero eyebrow={t.catalog.eyebrow} title={t.catalog.title} lead={t.catalog.lead}>
        <label className="pp-search">
          <Search aria-hidden="true" />
          <span className="pp-sr">{t.catalog.search}</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t.catalog.placeholder}
            aria-label={t.catalog.search}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label={t.catalog.clear}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </PageHero>

      <section className="lp-section pp-catalog">
        <div className="lp-wrap">
          <div className="pp-chips" role="group" aria-label={t.catalog.eyebrow}>
            <button type="button" aria-pressed={filter === "all"} data-on={filter === "all" || undefined} onClick={() => setFilter("all")}>
              {t.catalog.all}
            </button>
            {programmes.map((item, index) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={filter === item.slug}
                data-on={filter === item.slug || undefined}
                onClick={() => setFilter(filter === item.slug ? "all" : item.slug)}
              >
                <Petal colour={PETAL_COLOURS[index]} className="pp-chip-petal" />
                {item.name}
              </button>
            ))}
          </div>
          <p className="pp-count" aria-live="polite">
            {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale).format(visible.length)} {t.catalog.count}
          </p>
          {visible.length === 0 ? (
            <div className="pp-empty">
              <p>{t.catalog.empty}</p>
              <button
                type="button"
                className="lp-btn"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                {t.catalog.clear}
              </button>
            </div>
          ) : (
            <ul className="lp-programmes pp-programmes">
              {visible.map((item, order) => {
                const detail = t.courses[item.slug as keyof typeof t.courses];
                return (
                  <li key={item.slug} className="lp-reveal" style={vars({ "--r": order % 4 })}>
                    <Link href={`/courses/${item.slug}`} className="lp-card" style={vars({ "--tone": PETAL_COLOURS[item.index] })}>
                      <Petal colour={PETAL_COLOURS[item.index]} className="lp-card-petal" />
                      <h2 className="lp-card-title">{item.name}</h2>
                      <p className="lp-card-text">{item.desc}</p>
                      <ul className="pp-outcomes">
                        {detail.outcomes.map(outcome => (
                          <li key={outcome}>{outcome}</li>
                        ))}
                      </ul>
                      <span className="lp-card-foot">
                        <span>{detail.level}</span>
                        <span className="lp-card-open">
                          {LANDING_COPY[locale].programmes.open}
                          <ArrowRight className="lp-flip" aria-hidden="true" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function CourseDetail({ slug, locale }: PageProps & { slug: string }) {
  const t = PUBLIC_COPY[locale];
  const programmes = LANDING_COPY[locale].programmes.items;
  const index = programmes.findIndex(item => item.slug === slug);
  if (index < 0) {
    return (
      <PageHero eyebrow={t.catalog.eyebrow} title={t.course.missingTitle} lead={t.course.missingText}>
        <div className="lp-actions">
          <Link href="/courses" className="lp-btn" data-variant="primary" data-size="lg">
            {t.course.back}
          </Link>
        </div>
      </PageHero>
    );
  }
  const item = programmes[index];
  const detail = t.courses[item.slug as keyof typeof t.courses];
  const tone = PETAL_COLOURS[index];

  return (
    <>
      <PageHero eyebrow={t.catalog.eyebrow} title={item.name} lead={item.desc} tone={tone}>
        <div className="lp-actions">
          <Link href="/book-free-trial" className="lp-btn" data-variant="primary" data-size="lg">
            {LANDING_COPY[locale].hero.trial}
            <ArrowRight className="lp-flip" aria-hidden="true" />
          </Link>
          <Link href="/courses" className="lp-btn" data-size="lg">
            {t.course.back}
          </Link>
        </div>
      </PageHero>

      <section className="lp-section pp-course">
        <div className="lp-wrap pp-course-grid">
          <dl className="pp-facts lp-reveal" style={vars({ "--tone": tone })}>
            <div>
              <dt>{t.course.level}</dt>
              <dd>{detail.level}</dd>
            </div>
            <div>
              <dt>{t.course.schedule}</dt>
              <dd>{detail.schedule}</dd>
            </div>
            <div>
              <dt>{t.course.format}</dt>
              <dd>{t.course.formatValue}</dd>
            </div>
          </dl>
          <div className="pp-course-main">
            <div className="lp-reveal">
              <h2 className="lp-h2 pp-h2">{t.course.outcomesTitle}</h2>
              <ul className="pp-outcome-list">
                {detail.outcomes.map(outcome => (
                  <li key={outcome}>
                    <CheckCircle2 aria-hidden="true" style={{ color: tone }} />
                    {outcome}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-reveal">
              <h2 className="lp-h2 pp-h2">{t.course.runTitle}</h2>
              <ol className="pp-run">
                {t.course.run.map((step, order) => (
                  <li key={step.title}>
                    <span className="pp-run-num" style={vars({ "--tone": tone })}>
                      {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale).format(order + 1)}
                    </span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <aside className="pp-note lp-reveal">
              <Award aria-hidden="true" />
              <div>
                <h3>{t.course.certificateTitle}</h3>
                <p>{t.course.certificateText}</p>
              </div>
              <Link href="/verify-certificate" className="lp-link-arrow">
                {t.course.verify}
                <ArrowUpRight className="lp-flip" aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <CtaBand locale={locale} title={t.course.ctaTitle} text={t.course.ctaText} />
    </>
  );
}

/* ---------------- Certificates --------------------------------------- */

function CertificateVerification({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale].verify;
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PublicCertificateVerificationDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [required, setRequired] = useState(false);
  const unavailable =
    !result?.valid &&
    Boolean(result?.error && /unavailable|too many/i.test(result.error));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    setSubmitted(true);
    if (!trimmed) {
      setRequired(true);
      setResult(null);
      return;
    }
    setRequired(false);
    setLoading(true);
    setResult(null);
    const response = await verifyPublicCertificateRequest(trimmed);
    setLoading(false);
    if (!response.ok || !response.data) {
      setResult({ valid: false, error: response.error ?? "Verification is unavailable." });
      toast.error(t.unavailable);
      return;
    }
    setResult(response.data);
  };

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} tone={PETAL_COLOURS[4]} />
      <section className="lp-section pp-narrow-section">
        <div className="lp-wrap pp-narrow">
          <form className="pp-card pp-verify" onSubmit={submit} noValidate>
            <label className="pp-field">
              <span>{t.label}</span>
              <input
                value={code}
                onChange={event => setCode(event.target.value)}
                placeholder={t.placeholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={required || undefined}
                dir="ltr"
              />
            </label>
            <button type="submit" className="lp-btn" data-variant="primary" data-size="lg" disabled={loading}>
              <ShieldCheck aria-hidden="true" />
              {loading ? t.checking : t.submit}
            </button>

            {submitted ? (
              <div
                className="pp-result"
                data-state={loading ? "loading" : result?.valid ? "valid" : required ? "error" : unavailable ? "error" : "missing"}
                role="status"
              >
                {loading ? (
                  <>
                    <strong>{t.checking}</strong>
                    <p>{t.checkingText}</p>
                  </>
                ) : result?.valid ? (
                  <>
                    <strong>
                      <CheckCircle2 aria-hidden="true" /> {t.found}
                    </strong>
                    <div className="pp-cert">
                      <NileRosette size={36} />
                      <span className="pp-cert-badge">{t.verified}</span>
                      <code dir="ltr">{result.certificate.verificationCode}</code>
                      <p className="pp-cert-name">{result.certificate.studentName}</p>
                      <p className="pp-cert-meta">
                        {result.certificate.courseTitle}
                        {result.certificate.issuedAt
                          ? ` · ${t.issued} ${new Date(result.certificate.issuedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : locale)}`
                          : ""}
                      </p>
                    </div>
                    <button type="button" className="lp-btn" onClick={() => window.print()}>
                      <Download aria-hidden="true" />
                      {t.print}
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{required ? t.required : unavailable ? t.unavailable : t.notFound}</strong>
                    {!required && !unavailable ? <p>{t.notFoundText}</p> : null}
                  </>
                )}
              </div>
            ) : null}
          </form>
        </div>
      </section>
    </>
  );
}

/* ---------------- Booking: sent into the published Nile Form ---------- */

// Choice ids used by the published booking forms; labels follow the page language.
const LANGUAGE_IDS = ["english", "arabic", "turkish", "french"];
const AGE_IDS = ["child", "teen", "adult", "organisation"];
const LEVEL_IDS = ["beginner", "some_reading", "intermediate", "advanced"];
const CHOICE_TYPES = new Set(["single_choice", "multiple_choice"]);

type Choice = { value: string; label: string; english: string };
// Form question id, value, English label, English display value.
type Entry = [string, string | undefined, string, string?];

function newSubmissionId() {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `booking:${id}`;
}

/**
 * The booking pages keep their own design and six languages but submit into
 * the published Nile Form, so every request reaches Forms > Responses. A
 * branch-list question in that form files each request under its branch.
 * Answers the current form has no question for go into its notes.
 */
function BookingForm({ type, locale }: PageProps & { type: "trial" | "placement" }) {
  const t = PUBLIC_COPY[locale].booking;
  const EN = PUBLIC_COPY.en.booking;
  const slug = type === "trial" ? "free-trial-enquiry" : "placement-request";
  const formLocale: FormLocale = locale === "ar" || locale === "tr" ? locale : "en";
  const [fields, setFields] = useState<FormField[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // One id per set of answers, so a retry after a lost response is not a duplicate.
  const submissionId = useRef<string | null>(null);
  const set = (key: string) => (event: { target: { value: string } }) => {
    submissionId.current = null;
    setValues(previous => ({ ...previous, [key]: event.target.value }));
  };

  useEffect(() => {
    let cancelled = false;
    void fetchPublicForm(slug).then(response => {
      if (cancelled) return;
      if (response.ok && response.data) {
        setFields(response.data.version.content.pages.flatMap(page => page.fields));
        setStatus("ready");
      } else {
        setStatus("unavailable");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const byId = new Map(fields.map(item => [item.id, item]));
  const branchField = fields.find(
    item => item.type === "single_choice" && item.options?.some(option => option.id.startsWith(BRANCH_CHOICE_PREFIX))
  );
  const programmeName = (lang: LandingLocale, id: string) =>
    LANDING_COPY[lang].programmes.items.find(item => item.slug.replace(/-/g, "_") === id)?.name;
  const courseOptions = byId.get("course_interest")?.options ?? [];
  const subjects: Choice[] = courseOptions.length
    ? courseOptions.map(option => ({
        value: option.id,
        label: programmeName(locale, option.id) ?? getLocalizedText(option.label, formLocale),
        english: programmeName("en", option.id) ?? option.label.en,
      }))
    : LANDING_COPY.en.programmes.items.slice(0, 6).map((item, i) => ({
        value: item.slug.replace(/-/g, "_"),
        label: LANDING_COPY[locale].programmes.items[i].name,
        english: item.name,
      }));
  const paired = (labels: string[], ids: string[], english: string[]): Choice[] =>
    labels.map((label, i) => ({ label, value: ids[i], english: english[i] }));
  const languages = paired(t.languages, LANGUAGE_IDS, EN.languages);
  const ages = paired(t.ages, AGE_IDS, EN.ages);
  const levels = paired(t.levels, LEVEL_IDS, EN.levels);
  const modes = paired(
    t.branches.map(mode => mode.label),
    t.branches.map(mode => mode.value),
    EN.branches.map(mode => mode.label)
  );
  const branchOptions: Choice[] =
    branchField?.options?.map(option => ({
      value: option.id,
      label: getLocalizedText(option.label, formLocale),
      english: option.label.en,
    })) ?? [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = (type === "trial" ? leadFormSchema : placementFormSchema).safeParse(values);
    if (!result.success || (branchField?.required && !values.branchChoice)) {
      setError(t.invalid);
      return;
    }
    const shown = (options: Choice[], value?: string) => options.find(option => option.value === value)?.english;
    const entries: Entry[] = [
      ["full_name", values.fullName, EN.fullName],
      ["email", values.email, EN.email],
      ["phone", values.phone, EN.phone],
      ["course_interest", values.subject, EN.subject, shown(subjects, values.subject)],
    ];
    if (type === "trial") {
      entries.push(
        ["country", values.country, EN.country],
        ["preferred_language", values.preferredLanguage, EN.language, shown(languages, values.preferredLanguage)],
        ["age_group", values.ageGroup, EN.ageGroup, shown(ages, values.ageGroup)],
        ["preferred_schedule", values.preferredSchedule, EN.schedule]
      );
    } else {
      entries.push(
        ["study_mode", values.branch, EN.branch, shown(modes, values.branch)],
        ["preferred_date", values.preferredDate, EN.date],
        ["current_level", values.currentLevel, EN.level, shown(levels, values.currentLevel)]
      );
    }
    if (branchField) {
      entries.push([branchField.id, values.branchChoice, branchField.label.en, shown(branchOptions, values.branchChoice)]);
    }
    const answers: Record<string, unknown> = {};
    const extras: string[] = [];
    for (const [id, raw, label, display] of entries) {
      const value = raw?.trim();
      if (!value) continue;
      const question = byId.get(id);
      if (question && (!CHOICE_TYPES.has(question.type) || question.options?.some(option => option.id === value))) {
        answers[id] = value;
      } else {
        extras.push(`${label}: ${display ?? value}`);
      }
    }
    const notes = [values.notes?.trim(), ...extras].filter(Boolean).join("\n");
    if (notes && byId.has("notes")) answers.notes = notes;

    setSaving(true);
    submissionId.current ??= newSubmissionId();
    const response = await submitPublicFormRequest(slug, {
      answers,
      clientSubmissionId: submissionId.current,
      clientSubmittedAt: new Date().toISOString(),
      locale: formLocale,
    });
    setSaving(false);
    if (!response.ok) {
      setError(t.failed);
      return;
    }
    toast.success(t.success);
    setError(null);
    setSubmitted(true);
  };

  const field = (key: string, label: string, control: ReactNode, full = false) => (
    <label className="pp-field" data-full={full || undefined} key={key}>
      <span>{label}</span>
      {control}
    </label>
  );
  const select = (key: string, options: Array<{ value: string; label: string }>) => (
    <select value={values[key] ?? ""} onChange={set(key)}>
      <option value="">{t.choose}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <PageHero
        eyebrow={type === "trial" ? t.trialEyebrow : t.placementEyebrow}
        title={type === "trial" ? t.trialTitle : t.placementTitle}
        lead={type === "trial" ? t.trialLead : t.placementLead}
        tone={PETAL_COLOURS[type === "trial" ? 4 : 2]}
      />
      <section className="lp-section pp-narrow-section">
        <div className="lp-wrap pp-narrow">
          {submitted ? (
            <div className="pp-card pp-success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <h2>{t.success}</h2>
              <Link href="/" className="lp-btn">
                {PUBLIC_COPY[locale].notFound.home}
              </Link>
            </div>
          ) : status === "unavailable" ? (
            <div className="pp-card pp-success" role="status">
              <MessageCircle aria-hidden="true" />
              <h2>{t.unavailable}</h2>
              <a href={whatsapp(PHONE_ONSITE)} target="_blank" rel="noreferrer" className="lp-btn" data-variant="primary">
                {PUBLIC_COPY[locale].faq.whatsapp}
              </a>
            </div>
          ) : (
            <form className="pp-card pp-form" onSubmit={submit} noValidate aria-busy={status === "loading" || undefined}>
              {field("fullName", t.fullName, <input autoComplete="name" value={values.fullName ?? ""} onChange={set("fullName")} />)}
              {field("email", t.email, <input type="email" autoComplete="email" dir="ltr" value={values.email ?? ""} onChange={set("email")} />)}
              {field("phone", t.phone, <input type="tel" autoComplete="tel" dir="ltr" value={values.phone ?? ""} onChange={set("phone")} />)}
              {type === "trial" ? field("country", t.country, <input autoComplete="country-name" value={values.country ?? ""} onChange={set("country")} />) : null}
              {type === "trial" ? field("preferredLanguage", t.language, select("preferredLanguage", languages)) : null}
              {field("subject", t.subject, select("subject", subjects))}
              {type === "trial" ? field("ageGroup", t.ageGroup, select("ageGroup", ages)) : null}
              {type === "trial"
                ? field("preferredSchedule", t.schedule, <input placeholder={t.schedulePlaceholder} value={values.preferredSchedule ?? ""} onChange={set("preferredSchedule")} />)
                : null}
              {type === "placement" ? field("branch", t.branch, select("branch", modes)) : null}
              {branchField ? field("branchChoice", getLocalizedText(branchField.label, formLocale), select("branchChoice", branchOptions)) : null}
              {type === "placement" ? field("preferredDate", t.date, <input type="date" value={values.preferredDate ?? ""} onChange={set("preferredDate")} />) : null}
              {type === "placement" ? field("currentLevel", t.level, select("currentLevel", levels)) : null}
              {field("notes", t.notes, <textarea rows={4} value={values.notes ?? ""} onChange={set("notes")} />, true)}
              {error ? (
                <p className="pp-error" role="alert" data-full>
                  {error}
                </p>
              ) : null}
              <button type="submit" className="lp-btn" data-variant="primary" data-size="lg" disabled={saving || status !== "ready"} data-full>
                <Send aria-hidden="true" />
                {saving ? t.sending : t.submit}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

/* ---------------- Placement: embedded Jotform ------------------------ */

/**
 * The real Jotform form in Nile Center's account. Changing this id changes
 * what visitors fill in; never point it at a test form in production.
 */
const JOTFORM_PLACEMENT_ID = "223611105769555";
const JOTFORM_MIN_HEIGHT = 640;
const JOTFORM_LOAD_TIMEOUT_MS = 15000;

function JotformEmbed({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale].booking;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(JOTFORM_MIN_HEIGHT);
  const [loaded, setLoaded] = useState(false);
  const [alive, setAlive] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const formUrl = `https://form.jotform.com/${JOTFORM_PLACEMENT_ID}`;
  // onLoad also fires for browser error pages (blocked/offline), so "alive"
  // is what the timeout checks: a real Jotform embed always posts setHeight.
  const failed = timedOut && !alive;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      let host = "";
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (host !== "jotform.com" && !host.endsWith(".jotform.com")) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = typeof event.data === "string" ? event.data : "";
      const heightMatch = /^setHeight:(\d+)(?::(\d+))?$/.exec(data);
      if (heightMatch) {
        // A form id, when present, must be ours before we trust the number.
        if (heightMatch[2] && heightMatch[2] !== JOTFORM_PLACEMENT_ID) return;
        const next = Math.max(JOTFORM_MIN_HEIGHT, Number(heightMatch[1]));
        if (Number.isFinite(next) && next <= 20000) setHeight(next);
        setAlive(true);
        return;
      }
      if (data === "scrollIntoView" || data.startsWith("scrollIntoView:")) {
        setAlive(true);
        frameRef.current?.scrollIntoView({ block: "start" });
      }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(
      () => setTimedOut(true),
      JOTFORM_LOAD_TIMEOUT_MS
    );
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="pp-card pp-embed">
      {locale !== "en" ? (
        <p className="pp-embed-note">{t.jotformNote}</p>
      ) : null}
      {failed ? (
        <div className="pp-embed-fallback" role="status">
          <MessageCircle aria-hidden="true" />
          <p>{t.unavailable}</p>
          <div className="lp-actions">
            <a
              href={whatsapp(PHONE_ONSITE)}
              target="_blank"
              rel="noreferrer"
              className="lp-btn"
              data-variant="primary"
            >
              {PUBLIC_COPY[locale].faq.whatsapp}
            </a>
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="lp-btn"
            >
              {t.jotformOpen}
            </a>
          </div>
        </div>
      ) : (
        <div className="pp-embed-body">
          {!loaded ? <div className="pp-embed-skel" aria-hidden="true" /> : null}
          <iframe
            ref={frameRef}
            src={`${formUrl}?isIframeEmbed=1`}
            title={t.jotformTitle}
            referrerPolicy="strict-origin-when-cross-origin"
            className="pp-embed-frame"
            style={{ blockSize: height }}
            onLoad={() => setLoaded(true)}
          />
        </div>
      )}
    </div>
  );
}

function PlacementBooking({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale].booking;
  return (
    <>
      <PageHero
        eyebrow={t.placementEyebrow}
        title={t.placementTitle}
        lead={t.placementLead}
        tone={PETAL_COLOURS[2]}
      />
      <section className="lp-section pp-narrow-section">
        <div className="lp-wrap pp-narrow">
          <JotformEmbed locale={locale} />
        </div>
      </section>
    </>
  );
}

/* ---------------- Questions, contact, about, legal -------------------- */

function Faq({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale].faq;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} tone={PETAL_COLOURS[5]} />
      <section className="lp-section pp-narrow-section">
        <div className="lp-wrap pp-narrow">
          <div className="pp-faq">
            {t.items.map((item, index) => (
              <details key={item.q} className="pp-faq-item lp-reveal" style={vars({ "--r": index % 3 })} open={index === 0}>
                <summary>
                  <span>{item.q}</span>
                  <span className="pp-faq-icon" aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <div className="pp-card pp-more lp-reveal">
            <div>
              <h2>{t.moreTitle}</h2>
              <p>{t.moreText}</p>
            </div>
            <a href={whatsapp(PHONE_ONSITE)} target="_blank" rel="noreferrer" className="lp-btn" data-variant="primary">
              <MessageCircle aria-hidden="true" />
              {t.whatsapp}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Contact({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale].contact;
  const l = LANDING_COPY[locale];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} tone={PETAL_COLOURS[3]} />
      <section className="lp-section pp-contact">
        <div className="lp-wrap pp-contact-grid">
          <div className="pp-contact-col">
            <h2 className="pp-h3">{t.campusesTitle}</h2>
            {t.campuses.map((campus, index) => (
              <article key={campus.name} className="pp-card pp-campus lp-reveal" style={vars({ "--r": index })}>
                <MapPin aria-hidden="true" />
                <div>
                  <h3>{campus.name}</h3>
                  <p>{campus.address}</p>
                </div>
                <a
                  className="lp-link-arrow"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(campus.query)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.directions}
                  <ArrowUpRight className="lp-flip" aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
          <div className="pp-contact-col">
            <h2 className="pp-h3">{t.reachTitle}</h2>
            <ul className="pp-card pp-reach lp-reveal">
              <li>
                <MessageCircle aria-hidden="true" />
                <span>
                  <small>{l.modes.campus.phoneLabel}</small>
                  <a href={whatsapp(PHONE_ONSITE)} target="_blank" rel="noreferrer"><bdi>{PHONE_ONSITE}</bdi></a>
                </span>
              </li>
              <li>
                <MessageCircle aria-hidden="true" />
                <span>
                  <small>{l.modes.online.phoneLabel}</small>
                  <a href={whatsapp(PHONE_ONLINE)} target="_blank" rel="noreferrer"><bdi>{PHONE_ONLINE}</bdi></a>
                </span>
              </li>
              <li>
                <Mail aria-hidden="true" />
                <span>
                  <small>{t.emailLabel}</small>
                  <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
                </span>
              </li>
            </ul>
            <div className="pp-card pp-start lp-reveal">
              <h3>{t.startTitle}</h3>
              <p>{t.startText}</p>
              <div className="lp-actions">
                <Link href="/book-free-trial" className="lp-btn" data-variant="primary">
                  {l.hero.trial}
                </Link>
                <Link href="/book-placement-test" className="lp-btn">
                  {l.hero.placement}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function About({ locale }: PageProps) {
  const t = PUBLIC_COPY[locale].about;
  const l = LANDING_COPY[locale];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} tone={PETAL_COLOURS[1]} />
      <section className="lp-section">
        <div className="lp-wrap pp-story">
          <h2 className="lp-h2 lp-reveal">{t.storyTitle}</h2>
          <div className="pp-story-text lp-reveal">
            {t.story.map(paragraph => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
        <div className="lp-wrap">
          <dl className="lp-stats pp-about-stats" aria-label={t.figuresTitle}>
            {l.stats.map(stat => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>
                  <CountUp value={stat.value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="lp-section lp-teach">
        <div className="lp-wrap lp-teach-grid">
          <div className="lp-teach-head lp-reveal">
            <h2 className="lp-h2">{l.teach.title}</h2>
            <p className="lp-section-lead">{l.teach.lead}</p>
          </div>
          <ol className="lp-teach-list">
            {l.teach.items.map((item, index) => (
              <li key={item.title} className="lp-teach-item lp-reveal" style={vars({ "--r": index })}>
                <span className="lp-teach-num" style={vars({ "--tone": PETAL_COLOURS[[0, 4, 3][index]] })}>
                  {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale).format(index + 1)}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CtaBand locale={locale} title={t.ctaTitle} text={t.ctaText} />
    </>
  );
}

function Legal({ kind, locale }: PageProps & { kind: "privacy" | "terms" }) {
  const t = PUBLIC_COPY[locale][kind];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} tone={PETAL_COLOURS[6]} />
      <section className="lp-section pp-narrow-section">
        <div className="lp-wrap pp-narrow">
          <ol className="pp-legal">
            {t.sections.map((section, index) => (
              <li key={section.h} className="lp-reveal" style={vars({ "--r": index % 2 })}>
                <h2>{section.h}</h2>
                <p>{section.p}</p>
              </li>
            ))}
          </ol>
          <a className="lp-btn" href={kind === "privacy" ? OFFICIAL_PRIVACY : OFFICIAL_TERMS} target="_blank" rel="noreferrer">
            {t.full}
            <ArrowUpRight className="lp-flip" aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
