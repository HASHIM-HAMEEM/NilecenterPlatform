// "Already in Nile Learn" duplicate checks and "Recommended next" enrolment,
// against staging. Setup (EMS direct): a marker student, a completed trial
// lesson whose result recommends the sandbox course, and later a marker lead
// with the student's email. Checks: the lead and student forms warn on the
// email (strong) and the name (soft), a taken lead email blocks the form,
// the lead page flags the duplicate, the student page offers the recommended
// course, and the sale sheet sells it with a class. Cleanup cancels the
// sale, marks the lead lost, disables the student and the sandbox course;
// the completed trial stays as history (EMS cannot cancel it).
import {
  BASE,
  chromium,
  creds,
  createSuite,
  envVal,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const suite = createSuite("matches-enrol");
const { step, watch, shot, finish } = suite;

const MARK = `NILE-QA-MATCH-${stamp()}`;
// Staging is reseeded; branch, room, course and the class row are resolved
// live below once the Super Admin token exists.
let BRANCH = null;
let ROOM = null;
let COURSE = null;
let CLASS_NAME = "";
let COURSE_NAME = "";
const EMS = (envVal("EMS_STAGING_BASE_URL") ?? "").replace(/\/+$/, "");

async function emsLogin(role) {
  const { email, password } = creds(role);
  const response = await fetch(`${EMS}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch(() => null);
  return (await response?.json().catch(() => null))?.access_token ?? null;
}
async function ems(token, method, path, body) {
  try {
    const response = await fetch(`${EMS}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  } catch (error) {
    return { status: 0, data: String(error) };
  }
}
async function emsReason(token, path, kind) {
  const suffix = kind ? `?kind=${kind}&page_size=100` : "?page_size=100";
  const { data } = await ems(token, "GET", `${path}${suffix}`);
  const items = data?.items ?? (Array.isArray(data) ? data : []);
  return items.find(item => item.status === "active") ?? items[0] ?? null;
}

const created = { leadId: null, studentId: null, trialId: null, enabledCourse: false };
const STUDENT_EMAIL = `nile.qa.match.${stamp().toLowerCase()}@example.com`;
let saToken = null;

async function liveSales() {
  if (!created.studentId) return [];
  const { data } = await ems(
    saToken,
    "GET",
    `/students/${created.studentId}/enrolments?page_size=100`
  );
  return (data?.items ?? data ?? []).filter(
    item => !["cancelled", "left", "completed"].includes(item.status)
  );
}

async function cleanup() {
  const notes = [];
  for (const sale of await liveSales()) {
    const reason = await emsReason(saToken, "/action-reasons", "cancel_enrolment");
    const res = await ems(saToken, "POST", `/enrolments/${sale.id}/cancel`, { reason_id: reason?.id });
    notes.push(`cancel sale ${res.status}`);
  }
  if (created.leadId) {
    const reason = await emsReason(saToken, "/lost-reasons");
    const res = await ems(saToken, "PATCH", `/leads/${created.leadId}`, { status: "lost", lost_reason_id: reason?.id });
    notes.push(`lead lost ${res.status}`);
  }
  if (created.studentId) {
    const reason = await emsReason(saToken, "/action-reasons", "disable_student");
    const res = await ems(saToken, "POST", `/students/${created.studentId}/disable`, { reason_id: reason?.id });
    notes.push(`student disabled ${res.status}`);
  }
  if (created.enabledCourse) {
    // Put the sandbox course back to disabled, as the other suites expect.
    const reason = await emsReason(saToken, "/action-reasons", "disable_course");
    const res = await ems(saToken, "POST", `/courses/${COURSE}/disable`, { reason_id: reason?.id });
    notes.push(`course disabled ${res.status}`);
    if (res.status < 300) created.enabledCourse = false;
  }
  return notes.join(", ");
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
watch(page);

const guard = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    step(label, false, String(error).slice(0, 160));
  }
};
const closeSheet = async () => {
  await page.keyboard.press("Escape");
  const discard = page.getByRole("button", { name: "Discard", exact: true });
  if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) await discard.click();
  await page.waitForTimeout(400);
};
const matches = page.locator(".staff-matches");
const openAddLead = async () => {
  await page.goto(`${BASE}/app/leads`);
  await settle(page, ".staff-content");
  await page.getByRole("button", { name: "Add lead" }).first().click();
  await page.locator("#lead-first").fill("Qa");
  await page.locator("#lead-last").fill(MARK);
  await page.locator("#lead-email").fill(STUDENT_EMAIL.toUpperCase());
  await matches.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
};

try {
  saToken = await emsLogin("SUPER_ADMIN");
  if (saToken) {
    const branches = await ems(saToken, "GET", "/branches?page_size=100");
    const branchRows = branches.data?.items ?? branches.data ?? [];
    BRANCH =
      branchRows.find(
        branch => /branch 1/i.test(branch.name) && branch.status === "active"
      )?.id ??
      branchRows.find(branch => branch.status === "active")?.id ??
      null;
    if (BRANCH) {
      const classes = await ems(
        saToken,
        "GET",
        `/classes?branch_id=${BRANCH}&status=active&page_size=100`
      );
      const classRows = classes.data?.items ?? classes.data ?? [];
      const cls = classRows[0] ?? null;
      if (cls) {
        CLASS_NAME = cls.name ?? "";
        COURSE = cls.course_id ?? null;
        COURSE_NAME = cls.course_name ?? "";
        ROOM = cls.room_id ?? null;
      }
      if (!ROOM) {
        const rooms = await ems(
          saToken,
          "GET",
          `/rooms?branch_id=${BRANCH}&status=active&page_size=100`
        );
        const roomRows = rooms.data?.items ?? rooms.data ?? [];
        ROOM = roomRows[0]?.id ?? null;
      }
      if (!COURSE) {
        const courses = await ems(
          saToken,
          "GET",
          "/courses?status=active&page_size=100"
        );
        const courseRows = courses.data?.items ?? courses.data ?? [];
        COURSE = courseRows[0]?.id ?? null;
      }
      if (COURSE && !COURSE_NAME) {
        const course = await ems(saToken, "GET", `/courses/${COURSE}`);
        COURSE_NAME = course.data?.display_name ?? course.data?.name ?? "";
      }
    }
    step(
      "fixture: branch, room, course and class row",
      Boolean(BRANCH && ROOM && COURSE && CLASS_NAME)
    );
  }
  step("EMS super-admin token for setup", Boolean(saToken));

  const student = await ems(saToken, "POST", "/students", {
    first_name: "Qa",
    last_name: MARK,
    email: STUDENT_EMAIL,
    home_branch_id: BRANCH,
    nationality: "EGY",
    national_id: `3${String(Date.now()).slice(-9)}${Math.floor(1000 + Math.random() * 8999)}`,
    address: "NILE QA synthetic address",
    gender: "female",
    date_of_birth: "2001-02-03",
    registration: { to_be_paid: 0, paid: 0 },
  });
  created.studentId = student.data?.id ?? null;
  step("setup: marker student", Boolean(created.studentId), `${student.status} ${JSON.stringify(student.data).slice(0, 120)}`);

  const course = await ems(saToken, "GET", `/courses/${COURSE}`);
  if (course.data?.status !== "active") {
    const enabled = await ems(saToken, "POST", `/courses/${COURSE}/enable`);
    created.enabledCourse = enabled.status < 300;
    step("setup: sandbox course enabled for this run", created.enabledCourse, `${enabled.status}`);
  }
  const when = new Date(Date.now() + 9 * 864e5);
  when.setUTCHours(9, 0, 0, 0);
  const trial = await ems(saToken, "POST", "/trial-lessons", {
    student_id: created.studentId,
    branch_id: BRANCH,
    scheduled_at: when.toISOString(),
    room_id: ROOM,
    course_id: COURSE,
  });
  created.trialId = trial.data?.id ?? null;
  const result = created.trialId
    ? await ems(saToken, "POST", `/trial-lessons/${created.trialId}/record-result`, {
        recommended_course_id: COURSE,
        result_score: "82",
        result_notes: MARK,
      })
    : { status: 0 };
  step("setup: completed trial that recommends the sandbox course", result.status === 200, `create ${trial.status}, result ${result.status}`);

  await signInAndEnter(page, "SUPER_ADMIN");

  /* ---------- Add lead: a student's email (allowed, returning) ----------- */
  await guard("add lead (student match)", async () => {
    await openAddLead();
    const text = (await matches.first().textContent().catch(() => "")) ?? "";
    step(
      "lead form: a student's email shows 'Already in Nile Learn' (case ignored)",
      (await page.locator('.staff-matches[data-strength="email"]').count()) === 1 && /Already in Nile Learn/.test(text) && text.includes(MARK),
      text.slice(0, 140)
    );
    step("lead form: save reads 'Create anyway' (EMS allows a lead for a student)", (await page.getByRole("button", { name: "Create anyway" }).count()) > 0);
    const link = matches.first().locator("a.staff-btn").first();
    step(
      "each match opens in a new tab, so the form is kept",
      (await link.getAttribute("target")) === "_blank" && /\/app\/students\//.test((await link.getAttribute("href")) ?? "")
    );
    await shot(page)("lead-form-student-match");
    const mark = page.getByRole("button", { name: "Mark as returning student" });
    const canMark = await mark.isVisible().catch(() => false);
    if (canMark) await mark.click();
    await page.waitForTimeout(300);
    const typeText = (await page.getByRole("combobox", { name: "Lead type" }).textContent().catch(() => "")) ?? "";
    step("'Mark as returning student' sets Current student for an active student", canMark && /Current student/.test(typeText), typeText);

    await page.locator("#lead-email").fill(`nobody.${stamp().toLowerCase()}@example.com`);
    await page.waitForTimeout(1500);
    step(
      "the same full name alone is a soft hint, and save is plain again",
      (await page.locator('.staff-matches[data-strength="name"]').count()) === 1 &&
        (await page.getByRole("button", { name: "Create lead" }).count()) > 0
    );
    await shot(page)("lead-form-name-match");
    await closeSheet();
  });

  /* ---------- A lead with the same email: EMS refuses, so we block ------- */
  const lead = await ems(saToken, "POST", "/leads", {
    first_name: "Qa",
    last_name: MARK,
    email: STUDENT_EMAIL,
    branch_id: BRANCH,
    source: "qa-suite",
    notes: MARK,
  });
  created.leadId = lead.data?.id ?? null;
  step("setup: marker lead with the student's email", Boolean(created.leadId), `${lead.status}`);

  await guard("add lead (lead taken)", async () => {
    await openAddLead();
    const fieldError = (await page.locator("#lead-email").locator("xpath=ancestor::*[contains(@class,'staff-field')][1]").textContent().catch(() => "")) ?? "";
    step(
      "a lead with this email blocks the form with a clear reason",
      /A lead with this email already exists/.test(fieldError) && /one lead per email/.test((await matches.first().textContent()) ?? "") && (await page.getByRole("button", { name: "Create anyway" }).count()) === 0,
      fieldError.slice(0, 120)
    );
    const before = await ems(saToken, "GET", `/leads?q=${encodeURIComponent(STUDENT_EMAIL)}`);
    await page.getByRole("button", { name: "Create lead" }).click();
    await page.waitForTimeout(1500);
    const after = await ems(saToken, "GET", `/leads?q=${encodeURIComponent(STUDENT_EMAIL)}`);
    step("saving is blocked before reaching EMS", before.data?.total === after.data?.total && (await page.locator("#lead-email").isVisible()));
    await shot(page)("lead-form-lead-taken");
    await page.evaluate(() => localStorage.setItem("nilelearn.theme", "dark"));
    await page.reload();
    await settle(page, ".staff-content");
    await openAddLead();
    await shot(page)("lead-form-lead-taken-dark");
    await page.evaluate(() => localStorage.setItem("nilelearn.theme", "light"));
    await closeSheet();
  });

  /* ---------- Add student: email ----------------------------------------- */
  await guard("add student", async () => {
    await page.goto(`${BASE}/app/students`);
    await settle(page, ".staff-content");
    await page.getByRole("button", { name: "Add student" }).first().click();
    await page.locator("#student-email").fill(STUDENT_EMAIL);
    await matches.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const text = (await matches.first().textContent().catch(() => "")) ?? "";
    step(
      "student form: an existing email lists the student and the lead, and suggests opening the lead",
      /make them a student from there/.test(text) && /Student/.test(text) && /Lead/.test(text),
      text.slice(0, 160)
    );
    await shot(page)("student-form-email-match");
    await closeSheet();
  });

  /* ---------- Lead page: duplicate notice -------------------------------- */
  await guard("lead page", async () => {
    await page.goto(`${BASE}/app/leads/${created.leadId}`);
    await settle(page, ".staff-detail");
    await matches.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const text = (await matches.first().textContent().catch(() => "")) ?? "";
    step("lead page flags the student with this email", /Other records use this email/.test(text) && text.includes(MARK), text.slice(0, 140));
    await page.waitForTimeout(300);
    await shot(page)("lead-page-duplicate");
  });

  /* ---------- Student page: recommended next + enrol --------------------- */
  await guard("recommended enrol", async () => {
    await page.goto(`${BASE}/app/students/${created.studentId}`);
    await settle(page, ".staff-detail");
    const card = page.locator(".staff-recommend");
    await card.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const cardText = (await card.textContent().catch(() => "")) ?? "";
    step(
      "student page offers the recommended course with its reason",
      /Recommended next/.test(cardText) && new RegExp(COURSE_NAME).test(cardText) && /trial lesson/.test(cardText) && /Score 82/.test(cardText),
      cardText.slice(0, 160)
    );
    await page.waitForTimeout(300);
    await shot(page)("student-recommended");
    // The same card in dark mode, in Arabic (RTL), and on a phone.
    for (const [theme, locale, name] of [["dark", "en", "student-recommended-dark"], ["light", "ar", "student-recommended-ar"]]) {
      await page.evaluate(([t, l]) => {
        localStorage.setItem("nilelearn.theme", t);
        localStorage.setItem("nilelearn.locale", l);
      }, [theme, locale]);
      await page.reload();
      await settle(page, ".staff-recommend", { quiet: 800 });
      await shot(page)(name);
    }
    await page.evaluate(() => {
      localStorage.setItem("nilelearn.theme", "light");
      localStorage.setItem("nilelearn.locale", "en");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await settle(page, ".staff-recommend", { quiet: 800 });
    await shot(page)("student-recommended-mobile");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await settle(page, ".staff-recommend", { quiet: 800 });

    await page.locator(".staff-recommend").getByRole("button").click();
    await page.waitForSelector("#sale-total", { timeout: 10000 });
    await page.waitForTimeout(800);
    const courseText = (await page.getByRole("combobox", { name: "Course" }).textContent().catch(() => "")) ?? "";
    step("the sale starts on the recommended course, marked Recommended", new RegExp(COURSE_NAME).test(courseText) && /Recommended/.test(courseText), courseText);
    const classRow = page.locator(".staff-choice", { hasText: CLASS_NAME });
    await classRow.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const later = page.getByRole("radio", { name: "Choose a class later" });
    step(
      "classes for the course in the student's branch are listed with seats; 'later' is the default",
      (await classRow.count()) === 1 && (await later.isChecked().catch(() => false)) && /left/.test((await classRow.textContent()) ?? "")
    );
    await classRow.locator("input[type=radio]").check();
    await page.locator("#sale-total").fill("100");
    await page.locator("#sale-paid").fill("40");
    await page.waitForTimeout(300);
    const moodleLinked = (await ems(saToken, "GET", `/students/${created.studentId}`)).data?.moodle_user_id != null;
    const note = moodleLinked ? "once the course is fully paid" : "no Moodle account yet";
    step(
      `the sheet explains why the class must wait (${moodleLinked ? "part payment" : "no Moodle account"})`,
      await page.getByText(note).isVisible().catch(() => false)
    );
    await shot(page)("sale-class-waits");
    await page.locator("#sale-paid").fill("100");
    await page.waitForTimeout(300);
    const label = moodleLinked ? "Sell and add to class" : "Sell a course";
    const save = page.getByRole("button", { name: label, exact: true });
    step(`full payment ${moodleLinked ? "turns save into 'Sell and add to class'" : "still reads 'Sell a course' without Moodle"}`, await save.isVisible().catch(() => false));
    await shot(page)("sale-full-paid");
    await save.click();
    const toast = page.locator("[data-sonner-toast]").last();
    await toast.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    const toastText = (await toast.textContent().catch(() => "")) ?? "";
    const sales = await liveSales();
    step(
      "the course is sold (and added to the class when possible)",
      sales.length === 1 &&
        (moodleLinked ? /added to|could not/.test(toastText) : /Course sale opened/i.test(toastText) && sales[0].status !== "enrolled"),
      `${toastText.slice(0, 160)} | sale ${sales[0]?.status ?? "none"}`
    );
    await page.waitForTimeout(1500);
    step("the recommendation disappears once the course is sold", (await page.locator(".staff-recommend").count()) === 0);
    await shot(page)("sale-done");
  });

  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (error) {
  step("script", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  if (saToken) {
    const notes = await cleanup();
    const left = await liveSales();
    const course = await ems(saToken, "GET", `/courses/${COURSE}`);
    step(
      "cleanup: sale cancelled, lead lost, student disabled, sandbox course disabled again",
      left.length === 0 && course.data?.status === "disabled",
      notes
    );
  }
  await browser.close();
  finish();
}
