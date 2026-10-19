// Screenshot evidence for the Jotform intake surfaces that staging cannot
// produce organically: lead detail with DOB/nationality + the "From Jotform"
// link, and the review-schedule sheet's request summary + prefill. Staging
// EMS has no write path for lead.date_of_birth or booking jotform_* intake
// outside a real webhook submission, so those fields are injected into the
// BFF response JSON in the browser — the UI under test is ours, untouched.
// Creates one marker lead + one review trial on staging, then cancels/loses
// them. Run: node --env-file=.env.local scripts/staff-ui/jotform-evidence.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Api,
  BASE,
  chromium,
  creds,
  envVal,
  settle,
  signInAndEnter,
  stamp,
} from "./lib.mjs";

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const OUT = path.join(REPO, "output", "staff-ui", "jotform");
mkdirSync(OUT, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`) });

const MARK = `NILE-QA-JOTSHOT-${stamp()}`;
const REGISTRAR_BRANCH = "ccab89aa-58a9-4db9-a413-61017ad9709b";
const QA_ROW = "08516608-14cb-403b-9ca1-b9f9567e432e";
const EMS = (envVal("EMS_STAGING_BASE_URL") ?? "").replace(/\/+$/, "");

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
async function ems(token, method, p, body) {
  try {
    const response = await fetch(`${EMS}${p}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  } catch (error) {
    return { status: 0, data: String(error) };
  }
}
async function emsReason(token, p, kind) {
  const suffix = kind ? `?kind=${kind}&page_size=100` : "?page_size=100";
  const { data } = await ems(token, "GET", `${p}${suffix}`);
  const items = data?.items ?? (Array.isArray(data) ? data : []);
  return items.find(item => item.status === "active") ?? items[0] ?? null;
}

const created = { leadId: null, trialId: null };
const browser = await chromium.launch();
const problems = [];

try {
  const saToken = await emsLogin("SUPER_ADMIN");
  if (!saToken) throw new Error("no EMS super-admin token");

  const lead = await ems(saToken, "POST", "/leads", {
    first_name: "Qa",
    last_name: MARK,
    email: `nile.qa.jotshot.${stamp().toLowerCase()}@ems.com`,
    branch_id: REGISTRAR_BRANCH,
    source: "qa-suite",
    notes: MARK,
    date_of_birth: "2004-03-15",
    nationality: "EGY",
  });
  created.leadId = lead.data?.id ?? null;
  if (!created.leadId) {
    // Older EMS builds may not accept the new fields; retry minimal.
    const retry = await ems(saToken, "POST", "/leads", {
      first_name: "Qa",
      last_name: MARK,
      email: `nile.qa.jotshot.${stamp().toLowerCase()}@ems.com`,
      branch_id: REGISTRAR_BRANCH,
      source: "qa-suite",
      notes: MARK,
    });
    created.leadId = retry.data?.id ?? null;
    if (!created.leadId) problems.push(`lead create failed ${retry.status}`);
  } else {
    console.log(`lead created with DOB/nationality (${lead.status})`);
  }

  const trial = await ems(saToken, "POST", "/trial-lessons", {
    lead_id: created.leadId,
    status: "review",
  });
  created.trialId = trial.data?.id ?? null;
  if (created.trialId)
    await ems(saToken, "PATCH", `/trial-lessons/${created.trialId}`, {
      branch_id: REGISTRAR_BRANCH,
    });

  // Real names so the injected intake matches real select options.
  const api = new Api();
  await api.login("SUPER_ADMIN");
  await api.pickWorkspace();
  const areas = await api.call("GET", "/api/ncc/settings/areas-of-study");
  const areaName =
    (areas.data?.items ?? []).find(a => a.status === "active")?.name ??
    "General";
  const branches = await api.call("GET", "/api/ncc/settings/branches");
  const branchName =
    (branches.data?.items ?? []).find(b => b.id === REGISTRAR_BRANCH)?.name ??
    "Cairo";
  const qaForm = await api.call(
    "GET",
    `/api/ncc/settings/jotform/forms/${QA_ROW}`
  );
  const formName = qaForm.data?.form?.name ?? "QA Jotform";
  const formId = qaForm.data?.form?.formId ?? "000000000000000";
  const future = new Date(Date.now() + 10 * 864e5);
  const pad = n => String(n).padStart(2, "0");
  const appointment = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())} 14:30`;

  /* ---------- Lead detail: DOB + nationality + From Jotform --------------- */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    await page.route(
      `**/api/ncc/admissions/leads/${created.leadId}`,
      async route => {
        const response = await route.fetch();
        const json = await response.json().catch(() => null);
        if (json?.lead) {
          json.lead.dateOfBirth ??= "2004-03-15";
          json.lead.nationality ??= "EGY";
          json.lead.jotform = {
            formRowId: QA_ROW,
            formName,
            submissionId: "jotshot-1",
          };
        }
        await route.fulfill({ response, json });
      }
    );
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/leads/${created.leadId}`);
    await settle(page, ".staff-content", { quiet: 900 });
    const body = (await page.locator("body").textContent()) ?? "";
    if (!/From Jotform/i.test(body))
      problems.push("lead detail: no From Jotform text");
    await page.screenshot({
      path: path.join(OUT, "lead-detail-jotform-en-desktop.png"),
      fullPage: true,
    });
    await ctx.close();

    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mpage = await mctx.newPage();
    await mpage.route(
      `**/api/ncc/admissions/leads/${created.leadId}`,
      async route => {
        const response = await route.fetch();
        const json = await response.json().catch(() => null);
        if (json?.lead) {
          json.lead.dateOfBirth ??= "2004-03-15";
          json.lead.nationality ??= "EGY";
          json.lead.jotform = {
            formRowId: QA_ROW,
            formName,
            submissionId: "jotshot-1",
          };
        }
        await route.fulfill({ response, json });
      }
    );
    await signInAndEnter(mpage, "SUPER_ADMIN");
    await mpage.goto(`${BASE}/app/leads/${created.leadId}`);
    await settle(mpage, ".staff-content", { quiet: 900 });
    await mpage.screenshot({
      path: path.join(OUT, "lead-detail-jotform-en-mobile390.png"),
      fullPage: true,
    });
    await mctx.close();
  }

  /* ---------- Review trial: schedule sheet summary + prefill -------------- */
  if (created.trialId) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    await page.route("**/api/ncc/admissions/trial-lessons*", async route => {
      const response = await route.fetch();
      const json = await response.json().catch(() => null);
      for (const item of json?.items ?? []) {
        if (item.id === created.trialId) {
          item.intake = {
            formRowId: QA_ROW,
            formName,
            submissionId: "jotshot-1",
            appointmentText: `${appointment} · Nile Center (Maadi)`,
            branchLabel: branchName,
            subjectLabel: areaName,
            contactPreference: "WhatsApp",
            comments: "Requested via Jotform (QA capture).",
          };
          // Leave the row branchless so "Requested branch" renders too.
          item.branchId = null;
          item.branchName = null;
        }
      }
      await route.fulfill({ response, json });
    });
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/trial-lessons?status=review`);
    await settle(page, ".staff-bookings, .staff-empty, .staff-error", {
      quiet: 1200,
    });
    const row = page.locator("li.staff-booking", { hasText: MARK }).first();
    await row.getByRole("button", { name: "Schedule" }).click();
    await page.waitForSelector("[role='dialog']", { timeout: 15000 });
    await page.waitForTimeout(1200);
    const sheetText =
      (await page.locator("[role='dialog']").last().textContent()) ?? "";
    if (!sheetText.includes(appointment.slice(0, 10)))
      problems.push("schedule sheet: injected intake summary not visible");
    await shot(page, "review-schedule-sheet-jotform-en-desktop");
    await page.keyboard.press("Escape");
    const discard = page.getByRole("button", { name: "Discard" });
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await ctx.close();

    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mpage = await mctx.newPage();
    await mpage.route("**/api/ncc/admissions/trial-lessons*", async route => {
      const response = await route.fetch();
      const json = await response.json().catch(() => null);
      for (const item of json?.items ?? []) {
        if (item.id === created.trialId) {
          item.intake = {
            formRowId: QA_ROW,
            formName,
            submissionId: "jotshot-1",
            appointmentText: `${appointment} · Nile Center (Maadi)`,
            branchLabel: branchName,
            subjectLabel: areaName,
            contactPreference: "WhatsApp",
            comments: "Requested via Jotform (QA capture).",
          };
          item.branchId = null;
          item.branchName = null;
        }
      }
      await route.fulfill({ response, json });
    });
    await signInAndEnter(mpage, "SUPER_ADMIN");
    await mpage.goto(`${BASE}/app/trial-lessons?status=review`);
    await settle(mpage, ".staff-bookings, .staff-empty, .staff-error", {
      quiet: 1200,
    });
    const mrow = mpage
      .locator("li.staff-booking", { hasText: MARK })
      .first();
    await mrow.getByRole("button", { name: "Schedule" }).click();
    await mpage.waitForSelector("[role='dialog']", { timeout: 15000 });
    await mpage.waitForTimeout(1200);
    await shot(mpage, "review-schedule-sheet-jotform-en-mobile390");
    await mctx.close();
  }
} finally {
  const saToken = await emsLogin("SUPER_ADMIN").catch(() => null);
  if (saToken) {
    if (created.trialId) {
      const reason = await emsReason(
        saToken,
        "/action-reasons",
        "cancel_trial_lesson"
      );
      if (reason)
        await ems(saToken, "POST", `/trial-lessons/${created.trialId}/cancel`, {
          reason_id: reason.id,
        });
    }
    if (created.leadId) {
      const reason = await emsReason(saToken, "/lost-reasons");
      if (reason)
        await ems(saToken, "PATCH", `/leads/${created.leadId}`, {
          status: "lost",
          lost_reason_id: reason.id,
        });
    }
    console.log(
      `cleanup: trial ${created.trialId ?? "-"} cancelled, lead ${created.leadId ?? "-"} lost`
    );
  }
  await browser.close();
  if (problems.length) {
    console.log("PROBLEMS:", problems.join(" | "));
    process.exitCode = 1;
  } else {
    console.log("evidence capture complete");
  }
}
