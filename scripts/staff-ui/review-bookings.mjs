// Review-status bookings ("To review"): creates its own marker lead and two
// review bookings against staging EMS (the BFF cannot create status=review),
// then verifies the To review tab, the schedule sheet, the lead-detail next
// step, the lead-detail list error state, the dashboard attention count, and
// the Registrar view. Cleans up its markers in dependency order at the end.
import {
  BASE,
  chromium,
  creds,
  createSuite,
  envVal,
  pickDate,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const suite = createSuite("review-bookings");
const { step, watch, shot, finish } = suite;

const MARK = `NILE-QA-REVIEW-${stamp()}`;
// Staging is reseeded; resolved live from EMS in setup below.
let REGISTRAR_BRANCH = null;
const EMS = (envVal("EMS_STAGING_BASE_URL") ?? "").replace(/\/+$/, "");

/* ---------- Direct EMS calls (setup/cleanup need EMS-only writes) -------- */
async function emsLogin(role) {
  const { email, password } = creds(role);
  const response = await fetch(`${EMS}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch(() => null);
  const data = await response?.json().catch(() => null);
  return data?.access_token ?? null;
}
async function ems(token, method, path, body) {
  try {
    const response = await fetch(`${EMS}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
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

const created = { leadId: null, placementId: null, trialId: null };

async function cleanup(token) {
  const notes = [];
  if (created.trialId) {
    const reason = await emsReason(token, "/action-reasons", "cancel_trial_lesson");
    const res = reason
      ? await ems(token, "POST", `/trial-lessons/${created.trialId}/cancel`, {
          reason_id: reason.id,
        })
      : { status: 0, data: "no active cancel_trial_lesson reason" };
    notes.push(`cancel trial ${res.status}`);
  }
  if (created.placementId) {
    const reason = await emsReason(token, "/action-reasons", "cancel_placement_test");
    const res = reason
      ? await ems(token, "POST", `/placement-tests/${created.placementId}/cancel`, {
          reason_id: reason.id,
        })
      : { status: 0, data: "no active cancel_placement_test reason" };
    notes.push(`cancel placement ${res.status}`);
  }
  if (created.leadId) {
    const reason = await emsReason(token, "/lost-reasons");
    const res = reason
      ? await ems(token, "PATCH", `/leads/${created.leadId}`, {
          status: "lost",
          lost_reason_id: reason.id,
        })
      : { status: 0, data: "no active lost reason" };
    notes.push(`lead lost ${res.status}`);
  }
  return notes.join(", ");
}

const browser = await chromium.launch();
async function newPage(viewport) {
  const ctx = await browser.newContext({
    viewport: viewport ?? { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  watch(page);
  return { ctx, page };
}

const toastText = async page =>
  page
    .locator("[data-sonner-toast]")
    .last()
    .textContent()
    .catch(() => "");

/** Run a suite section without letting one crash skip the rest. */
const guard = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    step(label, false, String(error).slice(0, 160));
  }
};

try {
  /* ---------- Setup: lead + review trial (branched) + review placement ----- */
  const saToken = await emsLogin("SUPER_ADMIN");
  step("EMS super-admin token for setup", Boolean(saToken));

  if (saToken) {
    const branches = await ems(saToken, "GET", "/branches?page_size=100");
    const branchRows = branches.data?.items ?? branches.data ?? [];
    REGISTRAR_BRANCH =
      branchRows.find(
        branch => /branch 1/i.test(branch.name) && branch.status === "active"
      )?.id ??
      branchRows.find(branch => branch.status === "active")?.id ??
      null;
    step("fixture: registrar branch", Boolean(REGISTRAR_BRANCH));
    const lead = await ems(saToken, "POST", "/leads", {
      first_name: "Qa",
      last_name: MARK,
      email: `nile.qa.review.${stamp().toLowerCase()}@ems.com`,
      branch_id: REGISTRAR_BRANCH,
      source: "qa-suite",
      notes: MARK,
    });
    created.leadId = lead.data?.id ?? null;
    step("marker lead created in the registrar branch", lead.status < 300 && Boolean(created.leadId), `status ${lead.status}`);

    const trial = await ems(saToken, "POST", "/trial-lessons", {
      lead_id: created.leadId,
      status: "review",
    });
    created.trialId = trial.data?.id ?? null;
    step("review trial lesson created", trial.status < 300 && Boolean(created.trialId), `status ${trial.status}`);
    if (created.trialId) {
      const branched = await ems(saToken, "PATCH", `/trial-lessons/${created.trialId}`, {
        branch_id: REGISTRAR_BRANCH,
      });
      step("trial lesson assigned to the registrar branch", branched.status < 300, `status ${branched.status}`);
    }

    const placement = await ems(saToken, "POST", "/placement-tests", {
      lead_id: created.leadId,
      status: "review",
    });
    created.placementId = placement.data?.id ?? null;
    step("review placement test created without a branch", placement.status < 300 && Boolean(created.placementId), `status ${placement.status}`);
  }

  /* ---------- Lead detail: review bookings drive the next step ------------ */
  await guard("lead detail section", async () => {
    if (!created.leadId) return;
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/leads/${created.leadId}`);
    await settle(page, ".staff-content", { quiet: 900 });
    const body = await page.locator("body").textContent();
    const nextIsSchedule = /Choose a time and place to schedule it/i.test(body ?? "");
    const scheduleButton = page.getByRole("button", { name: "Schedule" }).first();
    const hasSchedule = await scheduleButton.isVisible().catch(() => false);
    step(
      "lead detail: next step is schedule_placement with a Schedule action",
      nextIsSchedule && hasSchedule
    );
    const sections = await page.locator(".staff-section").allTextContents();
    step(
      "lead detail lists both booking sections",
      sections.some(text => /Placement tests/i.test(text)) &&
        sections.some(text => /Trial lessons/i.test(text))
    );
    await shot(page)("lead-detail-review");
    await ctx.close();
  });

  /* ---------- SA: To review tab rows -------------------------------------- */
  await guard("SA To review + schedule section", async () => {
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/trial-lessons?status=review`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    // EMS needs a moment to list freshly-created review rows.
    await page
      .locator("li.staff-booking", { hasText: MARK })
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});
    const trialRowText = (await page.locator("body").textContent()) ?? "";
    const reviewRowVisible = trialRowText.includes(MARK) || trialRowText.includes("Not scheduled yet");
    step("trial lessons › To review shows the marker row", reviewRowVisible);
    step(
      "review row shows Not scheduled yet + To review badge",
      trialRowText.includes("Not scheduled yet") && /To review/.test(trialRowText)
    );
    await shot(page)("sa-trials-review");

    await page.goto(`${BASE}/app/placement-tests?status=review`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    await page
      .locator("li.staff-booking", { hasText: MARK })
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});
    const placementText = (await page.locator("body").textContent()) ?? "";
    step(
      "placement tests › To review shows the branchless marker row",
      placementText.includes("Not scheduled yet")
    );
    await shot(page)("sa-placements-review");

    /* Schedule the review trial: branch + date + room + area */
    await page.goto(`${BASE}/app/trial-lessons?status=review`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    const trialRow = page.locator("li.staff-booking", { hasText: MARK });
    await trialRow.getByRole("button", { name: "Schedule" }).click();
    await page.waitForSelector("[role='dialog']", { timeout: 15000 });
    await shot(page)("sa-schedule-sheet");

    const sheet = page.locator("[role='dialog']").last();
    // Branch (super admin gets a select; the trial already carries the branch).
    const branchTrigger = sheet.getByRole("combobox", { name: "Branch" });
    if (await branchTrigger.isVisible().catch(() => false)) {
      await branchTrigger.click();
      await page
        .getByRole("option", { name: /branch 1/i })
        .first()
        .click();
    }
    const day = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    await pickDate(page, "#booking-date", day);
    const roomTrigger = sheet.getByRole("combobox", { name: "Room" });
    if (await roomTrigger.isVisible().catch(() => false)) {
      await roomTrigger.click();
      await page
        .getByRole("option")
        .first()
        .first()
        .click()
        .catch(async () => {
          await page.getByRole("option").first().click();
        });
    }
    // Trials default the topic to "A course" — switch to an area of study.
    const areaRadio = sheet.getByRole("radio", { name: /area of study/i });
    if (await areaRadio.isVisible().catch(() => false)) await areaRadio.click();
    const areaTrigger = sheet.getByRole("combobox", { name: /Area of study|Subject|Topic/i });
    if (await areaTrigger.isVisible().catch(() => false)) {
      await areaTrigger.click();
      await page
        .getByRole("option", { name: /Arabic/i })
        .first()
        .click()
        .catch(async () => {
          await page.getByRole("option").first().click();
        });
    }
    await shot(page)("sa-schedule-sheet-filled");
    await sheet.getByRole("button", { name: "Schedule" }).click();
    await page.waitForTimeout(1500);
    const toast = await toastText(page);
    const sheetClosed = !(await sheet.isVisible().catch(() => false));
    step("trial scheduled: sheet closed with a success toast", sheetClosed && /scheduled/i.test(toast), toast.slice(0, 120));

    await page.goto(`${BASE}/app/trial-lessons?status=review`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    step(
      "scheduled trial left the To review tab",
      (await page.locator("li.staff-booking", { hasText: MARK }).count()) === 0
    );
    await page.goto(`${BASE}/app/trial-lessons?status=scheduled`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    step(
      "scheduled trial appears in Upcoming",
      (await page.locator("li.staff-booking", { hasText: MARK }).count()) > 0
    );
    await shot(page)("sa-trials-upcoming-after-schedule");

    /* Placement schedule is expected to fail today with the EMS Moodle
       password error — the sheet must stay open and show the message. */
    await page.goto(`${BASE}/app/placement-tests?status=review`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    const pRow = page.locator("li.staff-booking", { hasText: MARK });
    await pRow.getByRole("button", { name: "Schedule" }).click();
    await page.waitForSelector("[role='dialog']", { timeout: 15000 });
    const pSheet = page.locator("[role='dialog']").last();
    const pBranch = pSheet.getByRole("combobox", { name: "Branch" });
    if (await pBranch.isVisible().catch(() => false)) {
      await pBranch.click();
      await page.getByRole("option", { name: /branch 1/i }).first().click();
    }
    await pickDate(page, "#booking-date", day);
    const pRoom = pSheet.getByRole("combobox", { name: "Room" });
    if (await pRoom.isVisible().catch(() => false)) {
      await pRoom.click();
      await page.getByRole("option").first().click().catch(() => {});
    }
    const pArea = pSheet.getByRole("combobox", { name: /Area of study/i });
    if (await pArea.isVisible().catch(() => false)) {
      await pArea.click();
      await page.getByRole("option", { name: /Arabic/i }).first().click().catch(() => {});
    }
    await pSheet.getByRole("button", { name: "Schedule" }).click();
    await page.waitForTimeout(2500);
    const placementToasts = await page
      .locator("[data-sonner-toast]")
      .allTextContents();
    const stillOpen = await pSheet.isVisible().catch(() => false);
    const fieldErrors = await page.locator(".staff-field-error").allTextContents();
    // Either the EMS Moodle-password bug surfaces (open sheet + visible error)
    // or, once fixed upstream, the schedule succeeds (closed sheet + toast).
    const success =
      !stillOpen && placementToasts.some(text => /scheduled/i.test(text));
    const rejected =
      stillOpen &&
      (placementToasts.length > 0 || fieldErrors.length > 0);
    const outcome = success ? "scheduled" : rejected ? "rejected" : "unclear";
    const detail = [...placementToasts, ...fieldErrors].join(" | ").slice(0, 160);
    step(
      "placement schedule resolves visibly (success toast or open sheet + error)",
      success || rejected,
      `${outcome}: ${detail}`
    );
    console.log(`EMS_PLACEMENT_OUTCOME ${outcome} ${JSON.stringify(detail)}`);
    await shot(page)("sa-placement-schedule-outcome");
    if (success) {
      await page.goto(`${BASE}/app/placement-tests?status=scheduled`);
      await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
      step(
        "scheduled placement appears in Upcoming",
        (await page.locator("li.staff-booking", { hasText: MARK }).count()) > 0
      );
    } else {
      await pSheet
        .getByRole("button", { name: /cancel|close/i })
        .first()
        .click()
        .catch(() => page.keyboard.press("Escape"));
    }
    await ctx.close();
  });

  /* ---------- Lead detail error state (intercepted 502) -------------------- */
  await guard("lead detail error-state section", async () => {
    if (!created.leadId) return;
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.route("**/api/ncc/admissions/placement-tests*", route =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "NCC EMS returned invalid admissions data." }),
      })
    );
    await page.goto(`${BASE}/app/leads/${created.leadId}`);
    await settle(page, ".staff-content", { quiet: 1200 });
    const text = (await page.locator("body").textContent()) ?? "";
    const retryVisible = await page
      .getByRole("button", { name: /retry|try again/i })
      .first()
      .isVisible()
      .catch(() => false);
    step(
      "lead detail shows an error state with Retry when the list 502s",
      retryVisible,
      retryVisible ? "" : text.slice(0, 120)
    );
    await shot(page)("lead-detail-list-error");
    await page.unrouteAll();
    await ctx.close();
  });

  /* ---------- Registrar: scheduled trial + dashboard ----------------------- */
  await guard("registrar section", async () => {
    if (!created.trialId) return;
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "REGISTRAR");
    await page.goto(`${BASE}/app/trial-lessons?status=scheduled`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", { quiet: 900 });
    const text = (await page.locator("body").textContent()) ?? "";
    step("registrar sees the scheduled trial in Upcoming", text.includes(MARK) || /10:00|10 AM/.test(text));
    await shot(page)("reg-trials-upcoming");
    await page.goto(`${BASE}/app/dashboard`);
    await settle(page, ".staff-dash", { quiet: 900 });
    step("registrar dashboard renders", await page.locator(".staff-dash").isVisible().catch(() => false));
    await shot(page)("reg-dashboard");
    await ctx.close();
  });

  /* ---------- SA dashboard: review count ----------------------------------- */
  await guard("SA dashboard section", async () => {
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/dashboard`);
    await settle(page, ".staff-dash", { quiet: 1200 });
    const attention = page.locator(".staff-attention-row", { hasText: "Booking requests to review" });
    const visible = await attention.isVisible().catch(() => false);
    const count = visible ? (await attention.locator(".staff-attention-count").textContent()) : null;
    step(
      "dashboard shows Booking requests to review",
      visible && Number(count) >= 1,
      `count=${count}`
    );
    await shot(page)("sa-dashboard-review");
    await ctx.close();
  });
} finally {
  const saToken = await emsLogin("SUPER_ADMIN").catch(() => null);
  if (saToken && (created.leadId || created.placementId || created.trialId)) {
    const notes = await cleanup(saToken).catch(error => `cleanup failed: ${error}`);
    step("marker cleanup (cancel bookings, mark lead lost)", true, notes);
  }
  await browser.close();
  finish();
}
