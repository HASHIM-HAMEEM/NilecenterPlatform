/**
 * Publishes the versions of the two public booking forms that /book-free-trial
 * and /book-placement-test submit into (BookingForm in
 * client/src/pages/public/PublicSitePage.tsx). The choice ids below are the
 * ids those pages send. Runs as Super Admin against STAFF_UI_BASE
 * (default http://localhost:3000):
 *
 *   npx tsx scripts/staff-ui/publish-booking-forms.mts
 *
 * Branch routing is added later in the staff app once real branches exist:
 * add a "One choice" question, press "Use our branch list", keep the real
 * branches, and publish. Each request is then filed under its branch.
 */
import { BASE, chromium, signIn } from "./lib.mjs";
import { LANDING_COPY } from "../../client/src/pages/home/landing-copy";
import { PUBLIC_COPY } from "../../client/src/pages/home/public-copy";

type Lang = "en" | "ar" | "tr";
type Text = Record<Lang, string>;
const tri = (pick: (lang: Lang) => string): Text => ({ en: pick("en"), ar: pick("ar"), tr: pick("tr") });
const booking = (lang: Lang) => PUBLIC_COPY[lang].booking;

const question = (id: string, type: string, label: Text, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  label,
  dataClass: "standard",
  ...extra,
});
const choice = (id: string, label: Text, ids: string[], labels: (lang: Lang) => string[], extra: Record<string, unknown> = {}) =>
  question(id, "single_choice", label, {
    reportable: true,
    ...extra,
    options: ids.map((optionId, i) => ({ id: optionId, label: tri(lang => labels(lang)[i]) })),
  });

const SUBJECTS = ["quran", "arabic", "islamic-studies", "kids", "turkish", "english"];
const programme = (lang: Lang, slug: string) =>
  LANDING_COPY[lang].programmes.items.find(item => item.slug === slug)?.name ?? slug;

const contact = [
  question("full_name", "short_text", tri(lang => booking(lang).fullName), { required: true, searchable: true }),
  question("email", "email", tri(lang => booking(lang).email), { required: true, searchable: true }),
  question("phone", "phone", tri(lang => booking(lang).phone), { required: true, searchable: true }),
  choice(
    "course_interest",
    tri(lang => booking(lang).subject),
    SUBJECTS.map(slug => slug.replace(/-/g, "_")),
    lang => SUBJECTS.map(slug => programme(lang, slug)),
    { required: true }
  ),
];
const notes = question("notes", "long_text", tri(lang => booking(lang).notes));

const FIELDS = {
  form_enquiry: [
    ...contact,
    question("country", "short_text", tri(lang => booking(lang).country)),
    choice("preferred_language", tri(lang => booking(lang).language), ["english", "arabic", "turkish", "french"], lang => booking(lang).languages),
    choice("age_group", tri(lang => booking(lang).ageGroup), ["child", "teen", "adult", "organisation"], lang => booking(lang).ages),
    question("preferred_schedule", "short_text", tri(lang => booking(lang).schedule)),
    notes,
  ],
  form_placement: [
    ...contact,
    choice(
      "study_mode",
      { en: "Where to study", ar: "مكان الدراسة", tr: "Eğitim yeri" },
      ["campus", "online"],
      lang => booking(lang).branches.map(mode => mode.label),
      { required: true }
    ),
    question("preferred_date", "date", tri(lang => booking(lang).date), { required: true }),
    choice(
      "current_level",
      tri(lang => booking(lang).level),
      ["beginner", "some_reading", "intermediate", "advanced"],
      lang => booking(lang).levels,
      { required: true }
    ),
    notes,
  ],
};
const SLUGS = { form_enquiry: "free-trial-enquiry", form_placement: "placement-request" } as const;

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await signIn(page, "SUPER_ADMIN");
const call = (method: string, url: string, body?: unknown) =>
  page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Nile-Learn-Request": "browser" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json().catch(() => null) };
    },
    { method, url, body }
  );
const ok = (step: string, result: { status: number; data: any }) => {
  if (result.status >= 400) throw new Error(`${step}: ${result.status} ${JSON.stringify(result.data).slice(0, 400)}`);
  return result.data;
};

for (const formId of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
  const slug = SLUGS[formId];
  const bundle = ok("read form", await call("GET", `/api/forms/definitions/${formId}`));
  const live = bundle.publications.find((item: any) => item.slug === slug && ["open", "scheduled"].includes(item.status));
  const published = bundle.versions.find((item: any) => item.id === live?.versionId);
  if (!live || !published) throw new Error(`${formId}: no live publication at ${slug}`);

  const draft =
    bundle.versions.find((item: any) => item.status === "draft") ??
    ok("create draft", await call("POST", `/api/forms/definitions/${formId}/draft`));
  const content = {
    ...published.content,
    pages: [{ ...published.content.pages[0], fields: FIELDS[formId] }],
  };
  ok(
    "save draft",
    await call("POST", `/api/forms/definitions/${formId}/versions/${draft.id}`, { expectedRevision: draft.revision, content })
  );
  ok(
    "publish",
    await call("POST", `/api/forms/definitions/${formId}/versions/${draft.id}/publish`, {
      slug,
      audience: "public",
      allowMultiple: live.allowMultiple,
      allowDrafts: live.allowDrafts,
    })
  );
  const check = ok("read public form", await call("GET", `/api/forms/public/${slug}`));
  const ids = check.version.content.pages.flatMap((p: any) => p.fields.map((f: any) => f.id));
  console.log(`${BASE} ${slug}: version ${check.version.versionNumber} live, questions ${ids.join(", ")}`);
}
await browser.close();
