// Leads pipeline board against staging: a marker lead is moved by drag and
// drop and by its menu, blocked from Registered, sent to booking from the
// Placement test column, picks up a trial booking chip, moved in bulk, and
// marked lost with a reason. Each move is checked through the EMS API.
// Screens: light, dark, Arabic, phone. Cleanup cancels the trial and leaves
// the marker lead lost.
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

const suite = createSuite("pipeline-board");
const { step, watch, shot, finish } = suite;

const MARK = `NILE-QA-BOARD-${stamp()}`;
// Staging is reseeded; resolve a live branch and one of its rooms at runtime.
let BRANCH = null;
let ROOM = null;
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

const created = { leadId: null, trialId: null };
let token = null;
const stageOf = async () => (await ems(token, "GET", `/leads/${created.leadId}`)).data?.status;

const browser = await chromium.launch();
// Wide enough that every stage column is on screen for the drag steps.
const ctx = await browser.newContext({ viewport: { width: 2560, height: 1000 } });
const page = await ctx.newPage();
watch(page);

const guard = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    step(label, false, String(error).slice(0, 160));
  }
};
const column = stage => page.locator(`.staff-board-col[data-stage="${stage}"]`);
const card = () => page.locator(".staff-board-card", { hasText: MARK });
const waitStage = async (stage, ms = 15000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if ((await stageOf()) === stage) return true;
    await page.waitForTimeout(500);
  }
  return false;
};
const openBoard = async () => {
  await page.goto(`${BASE}/app/leads?view=board&q=${encodeURIComponent(MARK)}`);
  await settle(page, ".staff-board-col", { quiet: 800 });
};

try {
  token = await emsLogin("SUPER_ADMIN");
  const { data: branches } = await ems(token, "GET", "/branches?page_size=1&status=active");
  BRANCH = branches?.items?.[0]?.id ?? branches?.[0]?.id ?? null;
  const { data: rooms } = await ems(token, "GET", `/rooms?branch_id=${BRANCH}&page_size=1`);
  ROOM = rooms?.items?.[0]?.id ?? rooms?.[0]?.id ?? null;
  const lead = await ems(token, "POST", "/leads", {
    first_name: "Qa",
    last_name: MARK,
    email: `${MARK.toLowerCase()}@example.com`,
    branch_id: BRANCH,
    source: "qa-suite",
    notes: MARK,
  });
  created.leadId = lead.data?.id ?? null;
  step("setup: marker lead in In process", lead.status === 200 && lead.data?.status === "in_process", `${lead.status}`);

  await signInAndEnter(page, "SUPER_ADMIN");

  await guard("switch to board", async () => {
    await page.goto(`${BASE}/app/leads`);
    await settle(page, ".staff-content");
    await page.getByRole("button", { name: "Board" }).click();
    await page.waitForSelector(".staff-board-col", { timeout: 15000 });
    await page.locator(".staff-search-input").fill(MARK);
    await settle(page, ".staff-board-card", { quiet: 1200 });
    const titles = await page.locator(".staff-board-title").allInnerTexts();
    step(
      "Board shows the seven stages as columns, with the view in the URL",
      titles.length === 7 && /view=board/.test(page.url()),
      titles.join(" | ")
    );
    step("the new lead is a card in In process", (await column("in_process").locator(".staff-board-card", { hasText: MARK }).count()) === 1);
    await shot(page)("board-light");
  });

  await guard("drag to follow up", async () => {
    await card().dragTo(column("follow_up"));
    const ok = await waitStage("follow_up");
    await page.waitForTimeout(800);
    step(
      "dragging the card to Follow up moves it, in EMS and on the board",
      ok && (await column("follow_up").locator(".staff-board-card", { hasText: MARK }).count()) === 1,
      await stageOf()
    );
  });

  await guard("registered blocked", async () => {
    // Hold the card over Registered and read the column while it is dragged.
    const from = await card().boundingBox();
    const to = await column("registered").boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 12 });
    await page.waitForTimeout(300);
    const state = await column("registered").getAttribute("data-drop");
    const hint = (await column("registered").locator(".staff-board-ghost").textContent().catch(() => "")) ?? "";
    await shot(page)("board-drag-blocked");
    await page.mouse.up();
    await page.waitForTimeout(1200);
    step(
      "while dragging, Registered shows why it is not a drop target, and the drop does nothing",
      state === "blocked" && /become students/.test(hint) && (await stageOf()) === "follow_up",
      `${state} | ${hint}`
    );
  });

  await guard("menu move", async () => {
    await card().hover();
    await card().getByRole("button", { name: /Move to/ }).click();
    await page.getByRole("menuitem", { name: "Future registration" }).click();
    step("the card's menu moves it too (no drag needed)", await waitStage("future_registration"));
  });

  await guard("placement opens booking", async () => {
    await page.waitForTimeout(800);
    await card().dragTo(column("placement_test"));
    const sheet = page.getByRole("dialog");
    await sheet.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const title = (await sheet.textContent().catch(() => "")) ?? "";
    step("dropping on Placement test opens the booking sheet instead of faking the stage", /placement test/i.test(title) && (await stageOf()) === "future_registration", title.slice(0, 80));
    await shot(page)("board-drop-book");
    await page.keyboard.press("Escape");
    const discard = page.getByRole("button", { name: "Discard", exact: true });
    if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) await discard.click();
    await page.waitForTimeout(500);
  });

  await guard("booking chip", async () => {
    const when = new Date(Date.now() + 8 * 864e5);
    when.setUTCHours(11, 0, 0, 0);
    const { data: courses } = await ems(token, "GET", "/courses?status=active&page_size=5");
    const trial = await ems(token, "POST", "/trial-lessons", {
      lead_id: created.leadId,
      branch_id: BRANCH,
      scheduled_at: when.toISOString(),
      room_id: ROOM,
      course_id: courses?.items?.[0]?.id,
    });
    created.trialId = trial.data?.id ?? null;
    await openBoard();
    const inTrial = column("trial_lesson").locator(".staff-board-card", { hasText: MARK });
    const chip = (await inTrial.locator(".staff-board-chip").first().textContent().catch(() => "")) ?? "";
    step("a booked trial moves the lead to Trial lesson, with a 'Trial' date chip", (await inTrial.count()) === 1 && /Trial/.test(chip), `${trial.status} ${chip}`);
    await shot(page)("board-booking-chip");
  });

  await guard("bulk move", async () => {
    await card().hover();
    await card().locator(".staff-board-check").check();
    const bar = page.locator(".staff-bulk-bar");
    await bar.waitFor({ state: "visible", timeout: 5000 });
    step("selecting a card shows the bulk bar", /1 selected/.test((await bar.textContent()) ?? ""));
    await shot(page)("board-bulk");
    await page.getByRole("combobox", { name: "Move to…" }).click();
    await page.getByRole("option", { name: "In process" }).click();
    step("the bulk bar moves the selected leads", await waitStage("in_process"));
  });

  await guard("lost with reason", async () => {
    await page.waitForTimeout(800);
    await card().dragTo(column("lost"));
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await dialog.first().waitFor({ state: "visible", timeout: 10000 });
    await page.getByRole("combobox", { name: "Lost reason" }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Mark as lost", exact: true }).click();
    step("dropping on Lost asks for a reason, then marks the lead lost", await waitStage("lost"));
  });

  await guard("view remembered", async () => {
    await page.goto(`${BASE}/app/leads`);
    await settle(page, ".staff-content");
    step("the board is remembered on this device", (await page.locator(".staff-board").count()) === 1);
  });

  await guard("themes and languages", async () => {
    // Back to a stage with a card for the shots.
    await ems(token, "PATCH", `/leads/${created.leadId}`, { status: "follow_up", lost_reason_id: null });
    for (const [theme, locale, name] of [["dark", "en", "board-dark"], ["light", "ar", "board-ar"]]) {
      await page.evaluate(([t, l]) => {
        localStorage.setItem("nilelearn.theme", t);
        localStorage.setItem("nilelearn.locale", l);
      }, [theme, locale]);
      await openBoard();
      await card().hover().catch(() => {});
      await shot(page)(name);
    }
    await page.evaluate(() => {
      localStorage.setItem("nilelearn.theme", "light");
      localStorage.setItem("nilelearn.locale", "en");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await openBoard();
    const width = await column("in_process").evaluate(el => el.getBoundingClientRect().width);
    step("on a phone each column takes most of the screen and the board scrolls sideways", width > 280 && width < 390, `${Math.round(width)}px`);
    await shot(page)("board-mobile");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => localStorage.setItem("staff.leads.view", "list"));
  });

  step("no console errors", suite.consoleErrors.length === 0, suite.consoleErrors.slice(0, 2).join(" | "));
} catch (error) {
  step("script", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  if (token) {
    const notes = [];
    if (created.trialId) {
      const reason = await emsReason(token, "/action-reasons", "cancel_trial_lesson");
      notes.push(`cancel trial ${(await ems(token, "POST", `/trial-lessons/${created.trialId}/cancel`, { reason_id: reason?.id })).status}`);
    }
    if (created.leadId) {
      const reason = await emsReason(token, "/lost-reasons");
      notes.push(`lead lost ${(await ems(token, "PATCH", `/leads/${created.leadId}`, { status: "lost", lost_reason_id: reason?.id })).status}`);
    }
    step("cleanup: trial cancelled, marker lead lost", (await stageOf()) === "lost", notes.join(", "));
  }
  await browser.close();
  finish();
}
