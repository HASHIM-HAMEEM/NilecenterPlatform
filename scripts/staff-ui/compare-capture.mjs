// Side-by-side screenshot capture: our staff app (:3000) vs the EMS team's
// reference frontend (:4200). Capture only — submits nothing. Output goes to
// output/ui-compare-20261027/ with an index.md report. Run:
//   node --env-file=.env.local scripts/staff-ui/compare-capture.mjs
import fs from "node:fs";
import path from "node:path";
import { BASE, chromium, creds, envVal, pickWorkspace, signIn } from "./lib.mjs";

const REF = (envVal("REF_UI_BASE") ?? "http://localhost:4200").replace(/\/+$/, "");
const OUT = path.resolve(process.cwd(), "output/ui-compare-20261027");
const EMS = (envVal("EMS_STAGING_BASE_URL") ?? "").replace(/\/+$/, "");
const BRANCH = "154e09ad-6611-453c-9417-17ba3ac57cda"; // "branch 1"
const QA_USERS = JSON.parse(
  fs.readFileSync("tmp/api-audit/qa-users-20261027.json", "utf8")
);

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
];

/* ---------- EMS direct (record discovery only) ---------------------------- */

async function emsLogin(role) {
  const { email, password } = creds(role);
  const response = await fetch(`${EMS}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await response.json())?.access_token ?? null;
}

async function ems(token, path, query = "") {
  const response = await fetch(`${EMS}${path}${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  const data = await response?.json().catch(() => null);
  const items = data?.items ?? (Array.isArray(data) ? data : []);
  return { status: response?.status ?? 0, items, data };
}

/* ---------- Sign-in helpers ------------------------------------------------ */

async function signInOurs(page, role) {
  await signIn(page, role); // /auth/administration-login on BASE
  await pickWorkspace(page);
}

async function signInTheirs(page, role) {
  const account = creds(role);
  await page.goto(`${REF}/login`);
  await page.fill("#email", account.email);
  await page.fill("#password", account.password);
  await page.click('form button[type="submit"], form button:has-text("Sign in")');
  await page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 45000 });
  // Workspace gate: "Choose a workspace" card with one button per branch.
  const gate = page.getByRole("heading", { name: /choose a workspace/i });
  if (await gate.isVisible({ timeout: 8000 }).catch(() => false)) {
    const pick = page.getByRole("button", { name: /branch 1/i }).first();
    await (await pick.isVisible().catch(() => false)
      ? pick
      : page.locator("button").nth(1)
    ).click();
    await gate.waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  }
}

/* ---------- Capture plumbing ---------------------------------------------- */

const results = []; // {n, name, oursUrl, theirsUrl, shots, consoleErrors, note}

async function waitSettled(page) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page
    .waitForSelector(".staff-skel, .animate-pulse, [data-slot='skeleton']", {
      state: "detached",
      timeout: 15000,
    })
    .catch(() => {});
  await page.waitForTimeout(600);
}

async function shot(page, name, viewport, side, errors) {
  await waitSettled(page);
  const file = `${name}-${viewport}-${side}.png`;
  await page.screenshot({
    path: path.join(OUT, file),
    fullPage: false,
  });
  return { file, url: page.url(), consoleErrors: errors.length };
}

const SHEET = "[role='dialog'], .ui-sheet, [data-slot='sheet-content']";

async function clickRole(page, matcher) {
  const target = page
    .getByRole("button", { name: matcher })
    .or(page.getByRole("menuitem", { name: matcher }))
    .first();
  await target.click({ timeout: 20000 });
}

async function pickRoleOption(page, triggerRe, optionRe) {
  const trigger = page
    .getByRole("combobox", { name: triggerRe })
    .or(page.getByRole("button", { name: triggerRe }))
    .first();
  await trigger.click({ timeout: 20000 });
  await page.getByRole("option", { name: optionRe }).first().click({ timeout: 20000 });
  await page.waitForTimeout(400);
}

/* ---------- Screen plan -----------------------------------------------------
 * id: file prefix, role: sign-in role (null = signed out),
 * ours/theirs: path + optional pre-shot action.
 * --------------------------------------------------------------------------- */

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // --only=07,08 runs a subset (screen id prefixes).
  const only = (process.argv.find(a => a.startsWith("--only=")) ?? "")
    .replace("--only=", "")
    .split(",")
    .filter(Boolean);
  // --side=ours|theirs limits capture to one app; --suffix=v2 renames shots
  // and skips index/results regeneration.
  const side = (
    process.argv.find(a => a.startsWith("--side=")) ?? ""
  ).replace("--side=", "") || "both";
  const suffixArg = (
    process.argv.find(a => a.startsWith("--suffix=")) ?? ""
  ).replace("--suffix=", "");
  const suffix = suffixArg ? `-${suffixArg}` : "";

  // Discover staging records once (Super Admin token).
  const token = await emsLogin("SUPER_ADMIN");
  if (!token) throw new Error("EMS login failed");

  const leads = await ems(token, "/leads", `?branch_id=${BRANCH}&page_size=50`);
  const lead = leads.items[0] ?? null;
  const convertible =
    leads.items.find(l =>
      ["in_process", "follow_up", "trial_lesson", "placement_test"].includes(l.status)
    ) ?? lead;

  const ssaId = QA_USERS.SSA.id;
  let student = (await ems(token, "/students", `?assigned_ssa_id=${ssaId}&page_size=10`)).items[0];
  let studentNote = "";
  if (!student) {
    student = (await ems(token, "/students", `?branch_id=${BRANCH}&page_size=10`)).items[0];
    studentNote = student ? "student not assigned to the QA SSA" : "no student found on staging";
  }

  const cls = (await ems(token, "/classes", `?branch_id=${BRANCH}&status=active&page_size=10`)).items[0];
  const teacherId = QA_USERS.TEACHER.id;

  // A staff user that actually has custom-field values on its profile.
  let cfUser = null;
  let cfNote = "no staff user with custom-field values found on staging";
  const users = await ems(token, "/users", "?page_size=50");
  for (const u of users.items.slice(0, 12)) {
    const detail = await ems(token, `/users/${u.id}`);
    const cf = detail.data?.custom_fields ?? detail.data?.user?.custom_fields;
    if (cf && Object.keys(cf).length > 0) {
      cfUser = u;
      cfNote = `custom fields shown on ${u.email ?? u.id}`;
      break;
    }
  }

  const screens = [
    { id: "01-login", role: null, ours: "/auth/administration-login", theirs: "/login" },
    { id: "02-dashboard-sa", role: "SUPER_ADMIN", ours: "/app/dashboard", theirs: "/dashboard" },
    { id: "03-dashboard-registrar", role: "REGISTRAR", ours: "/app/dashboard", theirs: "/dashboard" },
    { id: "04-dashboard-ssa", role: "SSA", ours: "/app/dashboard", theirs: "/dashboard" },
    { id: "05-leads", role: "REGISTRAR", ours: "/app/leads", theirs: "/leads" },
    {
      id: "06-lead-detail", role: "REGISTRAR",
      ours: lead ? `/app/leads/${lead.id}` : null,
      theirs: lead ? `/leads/${lead.id}` : null,
      note: lead ? undefined : "no branch-1 lead on staging",
    },
    {
      id: "07-lead-create", role: "REGISTRAR",
      ours: "/app/leads", theirs: "/leads",
      oursAction: async p => {
        await clickRole(p, /^Add lead$/i);
        await p.waitForSelector(SHEET, { timeout: 15000 });
      },
      theirsAction: async p => {
        await clickRole(p, /add lead|new lead/i);
        await p.waitForSelector(SHEET, { timeout: 15000 });
      },
    },
    {
      id: "08-lead-convert", role: "SUPER_ADMIN",
      ours: convertible ? `/app/leads/${convertible.id}` : null,
      theirs: convertible ? `/leads/${convertible.id}` : null,
      oursAction: async p => {
        await clickRole(p, /^Create student$|^Convert/i);
        await p.waitForSelector(SHEET, { timeout: 15000 });
      },
      theirsAction: async p => {
        await clickRole(p, /^Convert/i);
        await p.waitForSelector(SHEET, { timeout: 15000 });
      },
      note: convertible ? undefined : "no convertible branch-1 lead on staging",
    },
    {
      id: "09-placement-tests", role: "REGISTRAR",
      ours: "/app/placement-tests", theirs: "/placement-tests",
    },
    {
      id: "09b-placement-review", role: "REGISTRAR",
      ours: "/app/placement-tests?status=review",
      theirs: "/placement-tests?status=review",
      note: "review tab opened via status=review URL param",
    },
    { id: "10-students", role: "REGISTRAR", ours: "/app/students", theirs: "/students" },
    {
      id: "11-student-detail", role: "SSA",
      ours: student ? `/app/students/${student.id}` : null,
      theirs: student ? `/students/${student.id}` : null,
      note: studentNote || undefined,
    },
    { id: "12-enrolments", role: "SSA", ours: "/app/enrolments", theirs: "/enrolments" },
    { id: "13-classes", role: "SSA", ours: "/app/classes", theirs: "/classes" },
    {
      id: "14-class-sessions", role: "SSA",
      ours: cls ? `/app/classes/${cls.id}?tab=sessions` : null,
      theirs: cls ? `/classes/${cls.id}` : null,
      theirsAction: async p => {
        await p.getByRole("tab", { name: /sessions/i }).click({ timeout: 10000 });
      },
      note: cls ? undefined : "no active branch-1 class on staging",
    },
    { id: "15-rooms", role: "TEACHER", ours: "/app/rooms", theirs: "/rooms" },
    { id: "16-staff", role: "BRANCH_ADMIN", ours: "/app/staff", theirs: "/staff" },
    {
      id: "17-staff-detail-teacher", role: "VICE_MANAGER",
      ours: `/app/staff/${teacherId}`, theirs: `/staff/${teacherId}`,
    },
    {
      id: "18-staff-create-teacher", role: "SUPER_ADMIN",
      ours: "/app/staff?new=1", theirs: "/staff",
      oursAction: async p => {
        await p.waitForSelector(SHEET, { timeout: 20000 });
        await pickRoleOption(p, /^role$/i, /^teacher$/i);
      },
      theirsAction: async p => {
        await clickRole(p, /add staff user/i);
        await p.waitForSelector(SHEET, { timeout: 20000 });
        await pickRoleOption(p, /role/i, /^teacher$/i);
      },
    },
    { id: "19-audit", role: "VICE_MANAGER", ours: "/app/audit", theirs: "/audit" },
    { id: "20-courses", role: "SUPER_ADMIN", ours: "/app/courses", theirs: "/courses" },
    {
      id: "21-course-link", role: "SUPER_ADMIN",
      ours: "/app/courses", theirs: "/courses",
      oursAction: async p => {
        await clickRole(p, /link moodle course/i);
        await p.waitForSelector(SHEET, { timeout: 15000 });
      },
      theirsAction: async p => {
        await clickRole(p, /^link course$|link.*moodle/i);
        await p.waitForSelector(SHEET, { timeout: 15000 });
      },
    },
    { id: "22-jotform", role: "SUPER_ADMIN", ours: "/app/jotform", theirs: "/jotform-answers" },
    {
      id: "23-custom-fields", role: "SUPER_ADMIN",
      ours: cfUser ? `/app/staff/${cfUser.id}` : null,
      theirs: cfUser ? `/staff/${cfUser.id}` : null,
      note: cfNote,
    },
  ];

  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    // One context per role per viewport keeps each session cookie separate.
    const pages = { ours: new Map(), theirs: new Map() };
    async function pageFor(side, role) {
      const map = pages[side];
      if (!map.has(role)) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          locale: "en",
          colorScheme: "light",
        });
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", m => {
          if (m.type() === "error") errors.push(m.text().slice(0, 200));
        });
        page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
        if (role) {
          if (side === "ours") await signInOurs(page, role);
          else await signInTheirs(page, role);
        }
        map.set(role, { page, errors });
      }
      return map.get(role);
    }

    for (const s of screens) {
      if (only.length && !only.some(prefix => s.id.startsWith(prefix))) continue;
      const entry = {
        n: s.id,
        oursUrl: s.ours ? BASE + s.ours : null,
        theirsUrl: s.theirs ? REF + s.theirs : null,
        shots: [],
        note: s.note,
      };
      results.push(entry);

      if (s.ours && side !== "theirs") {
        const { page, errors } = await pageFor("ours", s.role);
        try {
          await page.goto(BASE + s.ours, { waitUntil: "domcontentloaded" });
          await waitSettled(page);
          if (s.oursAction) await s.oursAction(page);
          entry.shots.push(await shot(page, s.id + suffix, vp.name, "ours", errors.splice(0)));
        } catch (e) {
          entry.oursError = String(e.message ?? e).split("\n")[0];
          await page
            .screenshot({
              path: path.join(OUT, `${s.id}-partial-${vp.name}-ours.png`),
            })
            .catch(() => {});
        }
      }
      if (s.theirs && side !== "ours") {
        const { page, errors } = await pageFor("theirs", s.role);
        try {
          await page.goto(REF + s.theirs, { waitUntil: "domcontentloaded" });
          await waitSettled(page);
          if (s.theirsAction) await s.theirsAction(page);
          entry.shots.push(await shot(page, s.id + suffix, vp.name, "theirs", errors.splice(0)));
        } catch (e) {
          entry.theirsError = String(e.message ?? e).split("\n")[0];
          await page
            .screenshot({
              path: path.join(OUT, `${s.id}-partial-${vp.name}-theirs.png`),
            })
            .catch(() => {});
        }
      }
    }
    // Close role contexts for this viewport before the next size.
    for (const map of Object.values(pages))
      for (const { page } of map.values()) await page.context().close();
  }

  await browser.close();

  if (suffixArg) {
    console.log(
      `Captured ${results.reduce((n, r) => n + r.shots.length, 0)} ${suffixArg} shots into ${OUT}`
    );
    return;
  }

  /* ---------- merge with prior results for --only runs --------------------- */
  const resultsPath = path.join(OUT, "results.json");
  let all = results;
  if (only.length && fs.existsSync(resultsPath)) {
    const prev = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    const retried = new Set(results.map(r => r.n));
    all = [];
    const emitted = new Set();
    for (const entry of prev) {
      if (retried.has(entry.n)) {
        if (!emitted.has(entry.n)) {
          all.push(...results.filter(r => r.n === entry.n));
          emitted.add(entry.n);
        }
        continue;
      }
      all.push(entry);
    }
    for (const r of results) if (!emitted.has(r.n) && !all.includes(r)) all.push(r);
  }
  fs.writeFileSync(resultsPath, JSON.stringify(all, null, 2));

  /* ---------- index.md ------------------------------------------------------ */
  const lines = [
    "# Staff UI compare — ours vs EMS reference frontend",
    "",
    `Ours: ${BASE}  ·  Theirs: ${REF} (Next.js, proxies /api to staging)`,
    `Captured: ${new Date().toISOString()} · English, light theme`,
    "",
    "| # | Screen | Ours | Theirs | Console errors |",
    "|---|--------|------|--------|----------------|",
  ];
  for (const r of all) {
    const oursShots = r.shots.filter(s => s.file.endsWith("-ours.png"));
    const theirsShots = r.shots.filter(s => s.file.endsWith("-theirs.png"));
    const status = [
      r.oursUrl
        ? oursShots.length === VIEWPORTS.length
          ? `${oursShots.length} shots`
          : `partial (${oursShots.length}/${VIEWPORTS.length})`
        : "not captured",
      r.theirsUrl
        ? theirsShots.length === VIEWPORTS.length
          ? `${theirsShots.length} shots`
          : `partial (${theirsShots.length}/${VIEWPORTS.length})`
        : "not captured",
    ].join(" | ");
    const errs = r.shots.filter(s => s.consoleErrors > 0);
    const errText = errs.length
      ? errs.map(s => `${s.file}: ${s.consoleErrors}`).join("; ")
      : "none";
    const issues = [
      r.note,
      r.oursError ? `ours error: ${r.oursError}` : null,
      r.theirsError ? `theirs error: ${r.theirsError}` : null,
    ]
      .filter(Boolean)
      .join(" — ");
    lines.push(
      `| ${r.n} | ${issues ? `${r.n} (${issues})` : ""} | ${status.split(" | ")[0]} | ${status.split(" | ")[1]} | ${errText} |`
    );
    for (const s of r.shots)
      lines.push(`| | ${s.file} | ${s.url} | | ${s.consoleErrors} console err |`);
  }
  fs.writeFileSync(path.join(OUT, "index.md"), lines.join("\n") + "\n");

  const pairs = all.filter(
    r =>
      r.shots.filter(s => s.file.endsWith("-ours.png")).length > 0 &&
      r.shots.filter(s => s.file.endsWith("-theirs.png")).length > 0
  ).length;
  console.log(`Captured ${pairs}/${all.length} screen pairs. See ${OUT}/index.md`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
