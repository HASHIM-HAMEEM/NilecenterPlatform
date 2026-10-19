// Jotform intake: list, Connect sheet (real/fake/duplicate ids), the setup
// page (questions, defaults, answer links, on/off), submissions, registrar
// gating, and the public placement embed. The ONLY staging write target is
// the dedicated QA row 08516608-…, restored exactly at the end and asserted
// through the API. The live Jotform form is never submitted.
import {
  Api,
  BASE,
  chromium,
  createSuite,
  settle,
  signInAndEnter,
} from "./lib.mjs";

const suite = createSuite("jotform");
const { step, watch, shot, finish } = suite;

const QA_ROW = "08516608-14cb-403b-9ca1-b9f9567e432e";
const QA_FALLBACK = "73df6659-4252-4d76-ad64-dab15de795cf";
const LIVE_FORM = "223611105769555"; // real form — read only, never submit
// Distinct from the QA row's own formId (000000000000000) so the duplicate
// check — which correctly takes precedence — does not mask the 400 error.
// (000000000000001 resolves to a real Jotform form, "Over Quota".)
const FAKE_FORM = "999999999999999";
const LANGS = ["en", "ar", "tr", "zh", "ru", "ur"];
const RTL = new Set(["ar", "ur"]);

const browser = await chromium.launch();
async function newPage(viewport, { theme, lang, ignoreResponses } = {}) {
  const ctx = await browser.newContext({
    viewport: viewport ?? { width: 1440, height: 900 },
  });
  if (theme || lang)
    await ctx.addInitScript(
      ([t, l]) => {
        if (t) localStorage.setItem("nilelearn.theme", t);
        if (l) localStorage.setItem("nilelearn.locale", l);
      },
      [theme, lang]
    );
  const page = await ctx.newPage();
  watch(page, { ignoreResponses });
  return { ctx, page };
}

const guard = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    step(label, false, String(error).slice(0, 160));
  }
};

let qaFormId = null; // Jotform numeric id of the QA row
let qaDetail = null; // detail DTO incl. catalogue

/** Restore the QA row exactly: contact, disabled, QA fallback branch, no
    fields/defaults/answer maps — then prove it via API read-back. */
async function restore(api) {
  const notes = [];
  // Answer maps reference fields — EMS 400s a fields reset that orphans
  // them, so delete the maps first.
  const maps = await api.call(
    "GET",
    `/api/ncc/settings/jotform/answer-maps?formId=${qaFormId}`
  );
  for (const map of maps.data?.items ?? []) {
    const del = await api.call(
      "DELETE",
      `/api/ncc/settings/jotform/answer-maps/${map.id}`
    );
    notes.push(`map ${map.id.slice(0, 8)} ${del.status}`);
  }
  const put = await api.call(
    "PUT",
    `/api/ncc/settings/jotform/forms/${QA_ROW}/fields`,
    { fields: [], defaults: [] }
  );
  notes.push(`fields ${put.status}`);
  const patch = await api.call(
    "PATCH",
    `/api/ncc/settings/jotform/forms/${QA_ROW}`,
    { enabled: false, target: "contact", fallbackBranchId: QA_FALLBACK }
  );
  notes.push(`patch ${patch.status}`);
  const back = await api.call(
    "GET",
    `/api/ncc/settings/jotform/forms/${QA_ROW}`
  );
  const form = back.data?.form;
  const mapsBack = await api.call(
    "GET",
    `/api/ncc/settings/jotform/answer-maps?formId=${qaFormId}`
  );
  const mapCount = (mapsBack.data?.items ?? []).length;
  const ok =
    form?.enabled === false &&
    form?.target === "contact" &&
    form?.fallbackBranchId === QA_FALLBACK &&
    (form?.fields?.length ?? -1) === 0 &&
    (form?.defaults?.length ?? -1) === 0 &&
    mapCount === 0;
  return {
    ok,
    detail: `${notes.join(", ")} | readback enabled=${form?.enabled} target=${form?.target} fallback=${form?.fallbackBranchId} fields=${form?.fields?.length} defaults=${form?.defaults?.length} maps=${mapCount}`,
  };
}

try {
  /* ---------- API preflight: QA row exists and starts clean --------------- */
  const api = new Api();
  const login = await api.login("SUPER_ADMIN");
  step("BFF super-admin login", login.status === 200, `status ${login.status}`);
  await api.pickWorkspace();

  const list = await api.call(
    "GET",
    "/api/ncc/settings/jotform/forms?pageSize=100"
  );
  const qaListRow = (list.data?.items ?? []).find(row => row.id === QA_ROW);
  qaFormId = qaListRow?.formId ?? null;
  step(
    "QA form row is connected on staging",
    list.status === 200 && Boolean(qaListRow) && Boolean(qaFormId),
    qaListRow ? `${qaListRow.name} (${qaFormId})` : `status ${list.status}`
  );

  const detail = await api.call(
    "GET",
    `/api/ncc/settings/jotform/forms/${QA_ROW}`
  );
  qaDetail = detail.data?.form ?? null;
  const cleanStart =
    qaDetail &&
    qaDetail.enabled === false &&
    qaDetail.target === "contact" &&
    (qaDetail.fields?.length ?? -1) === 0 &&
    (qaDetail.defaults?.length ?? -1) === 0;
  step(
    "QA form starts clean (contact, disabled, no fields/defaults)",
    Boolean(cleanStart),
    `enabled=${qaDetail?.enabled} target=${qaDetail?.target} fields=${qaDetail?.fields?.length}`
  );

  /* ---------- SA: list page ------------------------------------------------ */
  await guard("list page section", async () => {
    // The fake-id title lookup is expected to 400.
    const { ctx, page } = await newPage(undefined, {
      ignoreResponses: /jotform\/forms\/title/,
    });
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/jotform`);
    await settle(page, ".staff-content", { quiet: 800 });
    step(
      "sidebar shows the Jotform nav item",
      await page
        .locator("a.staff-nav-link[href='/app/jotform']")
        .first()
        .isVisible()
        .catch(() => false)
    );
    const body = (await page.locator("body").textContent()) ?? "";
    step(
      "list shows the QA form with its Jotform id",
      body.includes(qaDetail?.name ?? "…") && body.includes(qaFormId ?? "…")
    );
    await shot(page)("list-en-light");

    /* Connect sheet: real id resolves its Jotform title — never saved. */
    await page.getByRole("button", { name: "Connect a form" }).first().click();
    const sheet = page.locator("[role='dialog']").last();
    await sheet.locator("input[inputmode='numeric']").fill(LIVE_FORM);
    const found = sheet.getByText("Found on Jotform:");
    await found.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const foundText = (await found.textContent().catch(() => "")) ?? "";
    step(
      "connect sheet resolves the live form title",
      /Book a Placement Test/i.test(foundText),
      foundText.trim().slice(0, 80)
    );
    const nameFilled = await sheet
      .locator("input.staff-input:not([inputmode='numeric'])")
      .first()
      .inputValue()
      .catch(() => "");
    step("title lookup filled the Name field", nameFilled.trim().length > 0, nameFilled.trim());
    await sheet.getByRole("button", { name: /^Cancel$/ }).click();
    const discard = page.getByRole("button", { name: "Discard" });
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await page.waitForTimeout(600);
    await shot(page)("connect-sheet-title");

    /* Fake id: error + blocked save. */
    await page.getByRole("button", { name: "Connect a form" }).first().click();
    const sheet2 = page.locator("[role='dialog']").last();
    await sheet2.locator("input[inputmode='numeric']").fill(FAKE_FORM);
    await sheet2
      .getByText("doesn't recognise")
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});
    const fakeError = await sheet2
      .getByText("doesn't recognise")
      .isVisible()
      .catch(() => false);
    const saveDisabled = await sheet2
      .locator(".staff-sheet-footer .staff-btn[data-variant='primary']")
      .isDisabled()
      .catch(() => false);
    step(
      "fake form id shows the not-recognised error and blocks save",
      fakeError && saveDisabled
    );
    await sheet2.getByRole("button", { name: /^Cancel$/ }).click();
    const discard2 = page.getByRole("button", { name: "Discard" });
    if (await discard2.isVisible().catch(() => false)) await discard2.click();
    await page.waitForTimeout(600);

    /* Duplicate: the QA row's own Jotform id is refused. */
    await page.getByRole("button", { name: "Connect a form" }).first().click();
    const sheet3 = page.locator("[role='dialog']").last();
    await sheet3.locator("input[inputmode='numeric']").fill(qaFormId);
    const dup = sheet3.getByText("already connected");
    await dup.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const dupVisible = await dup.isVisible().catch(() => false);
    const dupLink = await sheet3
      .locator(`a[href='/app/jotform/${QA_ROW}']`)
      .isVisible()
      .catch(() => false);
    step(
      "duplicate form id is refused with a link to the existing row",
      dupVisible && dupLink
    );
    await shot(page)("connect-sheet-duplicate");
    await sheet3.getByRole("button", { name: /^Cancel$/ }).click();
    const discard3 = page.getByRole("button", { name: "Discard" });
    if (await discard3.isVisible().catch(() => false)) await discard3.click();
    await page.waitForTimeout(400);

    const after = await api.call(
      "GET",
      "/api/ncc/settings/jotform/forms?pageSize=100"
    );
    step(
      "cancelled connect sheets created no registry rows",
      (after.data?.items ?? []).length === (list.data?.items ?? []).length,
      `${(list.data?.items ?? []).length} → ${(after.data?.items ?? []).length}`
    );

    /* Dark + rtl + mobile list shots. */
    await page.evaluate(() => localStorage.setItem("nilelearn.theme", "dark"));
    await page.reload();
    await settle(page, ".staff-content", { quiet: 700 });
    await shot(page)("list-en-dark");
    await page.evaluate(() => {
      localStorage.setItem("nilelearn.theme", "light");
      localStorage.setItem("nilelearn.locale", "ar");
    });
    await page.reload();
    await settle(page, ".staff-content", { quiet: 700 });
    await shot(page)("list-ar-light");
    await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
    await ctx.close();

    const mob = await newPage({ width: 390, height: 844 });
    await signInAndEnter(mob.page, "SUPER_ADMIN");
    await mob.page.goto(`${BASE}/app/jotform`);
    await settle(mob.page, ".staff-content", { quiet: 800 });
    await shot(mob.page)("list-en-mobile390");
    await mob.ctx.close();
  });

  /* ---------- SA: setup page — questions, default, answers, toggle -------- */
  await guard("setup page section", async () => {
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/jotform/${QA_ROW}`);
    await settle(page, ".staff-content", { quiet: 900 });

    const statusCard = page.locator("section.staff-card").first();
    const toggle = statusCard.locator("button[role=switch]");
    const reasonText = (await statusCard.textContent()) ?? "";
    step(
      "status switch is disabled until required inputs are matched",
      (await toggle.isDisabled().catch(() => false)) &&
        /turn this on/i.test(reasonText),
      reasonText.replace(/\s+/g, " ").slice(0, 120)
    );

    const required = (qaDetail?.catalogue ?? []).filter(input => input.required);
    const lookups = (qaDetail?.catalogue ?? []).filter(
      input => input.lookupRole || input.key === "entry_path"
    );
    // Add a question for every required input plus the first lookup input
    // (needed so an answer link can be added once saved).
    const fillInputs = [...required];
    const lookup = lookups.find(input => input.lookupRole === "source") ?? lookups[0];
    if (lookup && !fillInputs.some(input => input.key === lookup.key))
      fillInputs.push(lookup);

    for (const input of fillInputs) {
      const label = page
        .locator(".staff-field-label", { hasText: inputLabelEn(input.key) })
        .first();
      const block = label.locator("xpath=../..");
      await block
        .getByRole("button", { name: "Add another question" })
        .click();
      const question = block.locator("input.font-mono").first();
      await question.fill(`qa_${input.key}`);
      await question.press("Tab");
      await page.waitForTimeout(150);
    }
    // One default on the first input that offers a default combobox.
    let defaulted = false;
    for (const input of lookups) {
      const label = page
        .locator(".staff-field-label", { hasText: inputLabelEn(input.key) })
        .first();
      if (!(await label.count())) continue;
      const block = label.locator("xpath=../..");
      const trigger = block
        .getByRole("combobox", { name: "If not answered" })
        .first();
      if (await trigger.count()) {
        await trigger.click();
        const option = page.getByRole("option").nth(1);
        await option.waitFor({ state: "visible", timeout: 5000 });
        // Option 0 is "No default"; pick the first real value.
        await option.click();
        defaulted = true;
        break;
      }
    }
    step("question names + a default are entered", defaulted || lookups.length === 0);

    const dirtybar = page.locator(".staff-dirtybar");
    step(
      "sticky bar appears once the draft is dirty",
      await dirtybar.isVisible().catch(() => false)
    );
    await shot(page)("setup-en-light");
    await dirtybar.getByRole("button", { name: "Save" }).click();
    // A confirm dialog appears only if saved questions were removed — none were.
    await page.waitForTimeout(2500);
    step(
      "questions and defaults saved (dirty bar gone)",
      !(await dirtybar.isVisible().catch(() => false)),
      ((await page.locator(".staff-field-error").first().textContent().catch(() => "")) ?? "").slice(0, 100)
    );

    /* Answer link on the saved lookup question. */
    if (lookup) {
      const label = page
        .locator(".staff-field-label", { hasText: inputLabelEn(lookup.key) })
        .first();
      const block = label.locator("xpath=../..");
      const answerInput = block.locator(
        `input[placeholder='Answer exactly as visitors see it']`
      );
      // The add row mounts only after the detail refetch assigns the saved
      // question its id — give EMS a generous window.
      await answerInput
        .waitFor({ state: "visible", timeout: 20000 })
        .catch(() => {});
      const canAdd = await answerInput.isVisible().catch(() => false);
      if (canAdd) {
        await answerInput.fill("QA linked answer");
        const target = block.getByRole("combobox").first();
        await target.click();
        // Prefer the named source option; other lookup roles fall back to
        // the first option in the popover.
        let option = page.getByRole("option", { name: "Walk-in" });
        if (!(await option.isVisible().catch(() => false)))
          option = page.getByRole("option").first();
        await option.waitFor({ state: "visible", timeout: 5000 });
        const optionName = (await option.textContent())?.trim() ?? "";
        await option.click();
        // Wait until the trigger shows the pick before Add, or the click
        // can race React's state commit and add() sees an empty target.
        if (optionName)
          await target
            .filter({ hasText: optionName })
            .waitFor({ state: "visible", timeout: 5000 })
            .catch(() => {});
        else await page.waitForTimeout(400);
        await block.getByRole("button", { name: "Add", exact: true }).click();
      }
      const linkRow = block.getByText("QA linked answer");
      await linkRow
        .waitFor({ state: "visible", timeout: 10000 })
        .catch(() => {});
      const blockError =
        (
          (await block
            .locator(".staff-field-error")
            .first()
            .textContent()
            .catch(() => "")) ?? ""
        ).slice(0, 100);
      step(
        "source answer link added under the saved question",
        canAdd && (await linkRow.isVisible().catch(() => false)),
        `canAdd=${canAdd}${blockError ? ` error="${blockError}"` : ""}`
      );
      await shot(page)("setup-answer-link");
    } else {
      step("source answer link added under the saved question", false, "no lookup input in catalogue");
    }

    /* Toggle On then Off, asserting each against the API. Wait for
       aria-checked to flip first — the success toast can overlay the
       switch briefly and eat the second click. */
    await toggle.click();
    await page
      .waitForFunction(
        () =>
          document
            .querySelector("button[role=switch]")
            ?.getAttribute("aria-checked") === "true",
        { timeout: 15000 }
      )
      .catch(() => {});
    const onState = await api.call(
      "GET",
      `/api/ncc/settings/jotform/forms/${QA_ROW}`
    );
    const enabledNow = onState.data?.form?.enabled === true;
    step(
      "receiving submissions turns on (API confirms)",
      enabledNow,
      enabledNow
        ? "enabled"
        : `enabled=${onState.data?.form?.enabled} ${(await statusCard.locator(".staff-field-error").textContent().catch(() => ""))?.slice(0, 100) ?? ""}`
    );
    if (enabledNow) {
      // The "turned on" toast can still overlay the switch — force past it;
      // the API read-back is what this step actually asserts.
      await toggle.click({ force: true });
      await page
        .waitForFunction(
          () =>
            document
              .querySelector("button[role=switch]")
              ?.getAttribute("aria-checked") === "false",
          { timeout: 15000 }
        )
        .catch(() => {});
      const offState = await api.call(
        "GET",
        `/api/ncc/settings/jotform/forms/${QA_ROW}`
      );
      step(
        "receiving submissions turns back off (API confirms)",
        offState.data?.form?.enabled === false
      );
    }

    /* Setup shots: dark, ar, mobile. */
    await page.evaluate(() => localStorage.setItem("nilelearn.theme", "dark"));
    await page.reload();
    await settle(page, ".staff-content", { quiet: 700 });
    await shot(page)("setup-en-dark");
    await page.evaluate(() => {
      localStorage.setItem("nilelearn.theme", "light");
      localStorage.setItem("nilelearn.locale", "ar");
    });
    await page.reload();
    await settle(page, ".staff-content", { quiet: 700 });
    await shot(page)("setup-ar-light");
    await page.evaluate(() => localStorage.setItem("nilelearn.locale", "en"));
    await ctx.close();

    const mob = await newPage({ width: 390, height: 844 });
    await signInAndEnter(mob.page, "SUPER_ADMIN");
    await mob.page.goto(`${BASE}/app/jotform/${QA_ROW}`);
    await settle(mob.page, ".staff-content", { quiet: 900 });
    await shot(mob.page)("setup-en-mobile390");
    await mob.ctx.close();
  });

  /* ---------- Submissions page -------------------------------------------- */
  await guard("submissions section", async () => {
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    await page.goto(`${BASE}/app/jotform/${QA_ROW}/submissions`);
    await settle(page, ".staff-content", { quiet: 900 });
    const body = (await page.locator("body").textContent()) ?? "";
    const empty = /No submissions yet/i.test(body);
    const rows = await page
      .locator(".staff-content a[href*='/submissions/']")
      .count();
    step(
      "submissions page renders (empty state or rows)",
      empty || rows > 0,
      empty ? "empty state" : `${rows} rows`
    );
    await shot(page)("submissions-en-light");
    await page.evaluate(() => localStorage.setItem("nilelearn.theme", "dark"));
    await page.reload();
    await settle(page, ".staff-content", { quiet: 700 });
    await shot(page)("submissions-en-dark");
    await page.evaluate(() => {
      localStorage.setItem("nilelearn.theme", "light");
      localStorage.setItem("nilelearn.locale", "ar");
    });
    await page.reload();
    await settle(page, ".staff-content", { quiet: 700 });
    await shot(page)("submissions-ar-light");
    await ctx.close();

    const mob = await newPage({ width: 390, height: 844 });
    await signInAndEnter(mob.page, "SUPER_ADMIN");
    await mob.page.goto(`${BASE}/app/jotform/${QA_ROW}/submissions`);
    await settle(mob.page, ".staff-content", { quiet: 800 });
    await shot(mob.page)("submissions-en-mobile390");
    await mob.ctx.close();
  });

  /* ---------- 6-language smoke on the setup page --------------------------- */
  await guard("language smoke section", async () => {
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "SUPER_ADMIN");
    const problems = [];
    for (const lang of LANGS) {
      await page.evaluate(
        l => localStorage.setItem("nilelearn.locale", l),
        lang
      );
      await page.goto(`${BASE}/app/jotform/${QA_ROW}`);
      await settle(page, ".staff-content", { quiet: 600 });
      const m = await page.evaluate(() => ({
        dir: document.documentElement.dir,
        h1: document.querySelector("h1")?.textContent?.trim() ?? "",
        sideways: document.documentElement.scrollWidth - window.innerWidth,
      }));
      if (!m.h1) problems.push(`${lang}: no heading`);
      if (m.dir !== (RTL.has(lang) ? "rtl" : "ltr"))
        problems.push(`${lang}: dir=${m.dir}`);
      if (m.sideways > 1) problems.push(`${lang}: sideways ${m.sideways}px`);
    }
    step(
      "setup page renders in all 6 languages with the right direction",
      problems.length === 0,
      problems.slice(0, 3).join(" | ")
    );
    await ctx.close();
  });

  /* ---------- Registrar: nav hidden + direct URL blocked ------------------- */
  await guard("registrar gating section", async () => {
    const { ctx, page } = await newPage();
    await signInAndEnter(page, "REGISTRAR");
    await page.goto(`${BASE}/app/dashboard`);
    await settle(page, ".staff-content", { quiet: 800 });
    step(
      "registrar sidebar has no Jotform item",
      !(await page
        .locator("a.staff-nav-link[href='/app/jotform']")
        .first()
        .isVisible()
        .catch(() => false))
    );
    await page.goto(`${BASE}/app/jotform`);
    await settle(page, ".staff-content, .staff-state", { quiet: 800 });
    const body = (await page.locator("body").textContent()) ?? "";
    const blocked =
      /cannot open this page|No access/i.test(body) &&
      !(await page
        .getByRole("button", { name: "Connect a form" })
        .isVisible()
        .catch(() => false));
    step("registrar direct URL is blocked", blocked);
    await shot(page)("registrar-blocked");
    await ctx.close();
  });

  /* ---------- Public: placement embed + fallback + trial ------------------- */
  await guard("public embed section", async () => {
    const { ctx, page } = await newPage();
    // Serve a stand-in Jotform page that looks like a form and resizes
    // itself like the real embed (a blank body reads as a broken page).
    await page.route("**/form.jotform.com/**", route =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><body style="margin:0;padding:2rem;font-family:sans-serif">
          <h2 style="margin:0 0 1rem">Book a Placement Test</h2>
          <label style="display:block;margin:0 0 1rem">Full name<br>
            <input style="width:100%;padding:.6rem;border:1px solid #ccc;border-radius:.4rem"></label>
          <label style="display:block;margin:0 0 1rem">Email<br>
            <input style="width:100%;padding:.6rem;border:1px solid #ccc;border-radius:.4rem"></label>
          <button style="padding:.7rem 1.4rem;border-radius:.4rem">Submit</button>
          <script>
            window.parent.postMessage("setHeight:920:${LIVE_FORM}", "*");
          <\/script></body>`,
      })
    );
    await page.goto(`${BASE}/book-placement-test`);
    await settle(page, "iframe", { quiet: 800 });
    const frame = page.locator("iframe").first();
    const src = await frame.getAttribute("src").catch(() => "");
    step(
      "placement page embeds the Jotform iframe",
      src === `https://form.jotform.com/${LIVE_FORM}?isIframeEmbed=1`,
      src
    );
    await page.waitForTimeout(1200);
    const blockSize = await frame.evaluate(el => el.style.blockSize);
    step(
      "jotform setHeight message resizes the iframe",
      blockSize === "920px",
      `blockSize=${blockSize}`
    );
    await shot(page)("placement-embed-en-light");

    /* Non-English note + dark container + mobile. */
    await page.evaluate(() => {
      localStorage.setItem("nilelearn.locale", "ar");
      localStorage.setItem("nilelearn.theme", "dark");
    });
    await page.reload();
    await settle(page, "iframe", { quiet: 800 });
    const note = await page.locator(".pp-embed-note").isVisible().catch(() => false);
    step("non-English locales see the form-is-English note", note);
    await shot(page)("placement-embed-ar-dark");
    await ctx.close();

    const mob = await newPage({ width: 390, height: 844 });
    await mob.page.goto(`${BASE}/book-placement-test`);
    await settle(mob.page, ".pp-embed, iframe, .pp-embed-fallback", { quiet: 800 });
    await shot(mob.page)("placement-embed-mobile390");
    await mob.ctx.close();

    /* Real captures: no route mock — the live form loads read-only and
       posts its own setHeight before we screenshot. Never submit. */
    const waitRealHeight = async p =>
      p.waitForFunction(
        () => {
          const f = document.querySelector("iframe");
          const h = f?.style.blockSize;
          return h && h !== "640px";
        },
        { timeout: 30000 }
      );
    const real = await newPage();
    await real.page.goto(`${BASE}/book-placement-test`);
    await waitRealHeight(real.page).catch(() => {});
    await settle(real.page, "iframe", { quiet: 800 });
    await shot(real.page)("placement-embed-real-en-light");
    await real.page.evaluate(() => {
      localStorage.setItem("nilelearn.locale", "ar");
      localStorage.setItem("nilelearn.theme", "dark");
    });
    await real.page.reload();
    await waitRealHeight(real.page).catch(() => {});
    await settle(real.page, "iframe", { quiet: 800 });
    await shot(real.page)("placement-embed-real-ar-dark");
    await real.ctx.close();

    /* Fallback: jotform unreachable → WhatsApp + open-in-new-tab after 15s. */
    const fb = await newPage();
    await fb.page.route(
      url => url.hostname === "jotform.com" || url.hostname.endsWith(".jotform.com"),
      route => route.abort()
    );
    await fb.page.goto(`${BASE}/book-placement-test`);
    await fb.page
      .locator(".pp-embed-fallback")
      .waitFor({ state: "visible", timeout: 25000 })
      .catch(() => {});
    const fallback = await fb.page
      .locator(".pp-embed-fallback")
      .isVisible()
      .catch(() => false);
    const openLink = await fb.page
      .locator(`.pp-embed-fallback a[href='https://form.jotform.com/${LIVE_FORM}']`)
      .isVisible()
      .catch(() => false);
    const whatsapp = await fb.page
      .locator(".pp-embed-fallback a[href*='wa.me'], .pp-embed-fallback a[href*='whatsapp']")
      .isVisible()
      .catch(() => false);
    step(
      "unreachable Jotform shows WhatsApp + open-in-new-tab fallback",
      fallback && openLink && whatsapp
    );
    await shot(fb.page)("placement-embed-fallback");
    await fb.ctx.close();

    /* Trial page keeps the Nile Forms booking form. */
    const tr = await newPage();
    await tr.page.goto(`${BASE}/book-free-trial`);
    await settle(tr.page, ".pp-form, form, iframe", { quiet: 800 });
    const trialForm = (await tr.page.locator("form").count()) > 0;
    const noJotform = (await tr.page.locator("iframe[src*='jotform']").count()) === 0;
    step("trial page unchanged (Nile form, no Jotform iframe)", trialForm && noJotform);
    await shot(tr.page)("trial-page-en");
    await tr.ctx.close();
  });
} finally {
  const api = new Api();
  const login = await api.login("SUPER_ADMIN").catch(() => ({ status: 0 }));
  if (login.status === 200) {
    await api.pickWorkspace();
    const result = await restore(api).catch(error => ({
      ok: false,
      detail: `restore failed: ${String(error).slice(0, 140)}`,
    }));
    step("QA form restored exactly (API read-back)", result.ok, result.detail);
  } else {
    step("QA form restored exactly (API read-back)", false, "could not sign in for restore");
  }
  await browser.close();
  finish();
}

function inputLabelEn(key) {
  return (
    {
      email: "Email",
      first_name: "First name",
      last_name: "Last name",
      phone: "Phone",
      nationality: "Nationality",
      date_of_birth: "Date of birth",
      branch_label: "Branch",
      source: "Lead source",
      entry_path: "Entry path",
      area_of_study: "Area of study",
      preferred_courses: "Preferred courses",
      delivery: "Delivery preference",
      notes: "Notes",
      subject_label: "Subject",
      appointment_text: "Appointment time",
      contact_preference: "Contact preference",
      comments: "Comments",
    }[key] ?? key
  );
}
