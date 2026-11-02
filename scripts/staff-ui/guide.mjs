// Read-only guide regression checks. Only sign-in/session requests reach EMS;
// checklist and category changes stay in the browser.
// Run: node --env-file=.env.local scripts/staff-ui/guide.mjs
import { chromium, createSuite, signInAndEnter, BASE } from "./lib.mjs";

const suite = createSuite("guide");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(() => {
  if (!localStorage.getItem("nilelearn.locale"))
    localStorage.setItem("nilelearn.locale", "en");
});
const page = await context.newPage();
suite.watch(page);

async function open(path, selector = ".staff-guide-area") {
  await page.goto(BASE + path);
  await page.locator(selector).first().waitFor({ timeout: 30000 });
}

try {
  await signInAndEnter(page, "SUPER_ADMIN");
  await open("/app/guide?role=all");
  suite.step(
    "All roles contains all 62 scenarios in 12 areas",
    (await page.locator(".staff-guide-card").count()) === 62 &&
      (await page.locator(".staff-guide-area").count()) === 12
  );
  suite.step(
    "Search precedes the overview graphics",
    await page
      .locator(".staff-guide-toolbar")
      .evaluate(
        el =>
          !!(
            el.compareDocumentPosition(
              document.querySelector(".staff-guide-overview")
            ) & Node.DOCUMENT_POSITION_FOLLOWING
          )
      )
  );
  suite.step(
    "Role coverage is a labelled table",
    (await page.locator(".staff-guide-matrix tbody tr").count()) === 7 &&
      (await page
        .locator(".staff-guide-matrix thead th[scope=col]")
        .count()) === 13
  );

  const search = page.locator(".staff-guide-search input");
  await search.fill("  storage  ");
  suite.step(
    "Search trims whitespace and finds notes",
    (await page.locator(".staff-guide-card").count()) === 1 &&
      (await page.locator(".staff-guide-card").textContent()).includes(
        "document"
      )
  );
  await search.fill("no-such-guide-scenario");
  suite.step(
    "Unmatched search has a clear action",
    await page.locator(".staff-empty button").isVisible()
  );
  await page.locator(".staff-empty button").click();
  await page.locator(".staff-guide-area").first().waitFor();
  await page.locator(".staff-guide-toolbar > button").click();
  suite.step(
    "Collapse all closes every category",
    (await page.locator(".staff-guide-grid").count()) === 0
  );
  await page.reload();
  await page.locator(".staff-guide-area").first().waitFor();
  suite.step(
    "Category preference survives reload",
    (await page.locator(".staff-guide-grid").count()) === 0
  );
  await page.locator(".staff-guide-search input").fill("password");
  suite.step(
    "Search expands matching collapsed categories",
    (await page.locator(".staff-guide-grid").count()) > 0
  );
  await page.evaluate(() => {
    sessionStorage.setItem("guide.collapsed", "null");
    localStorage.setItem(
      "guide.done.convert-a-lead",
      JSON.stringify([-1, 0, 0, 999, "1"])
    );
  });
  await open("/app/guide");
  suite.step(
    "Malformed category preferences cannot crash the page",
    (await page.locator(".staff-guide-grid").count()) > 0
  );

  await open("/app/guide/convert-a-lead", ".staff-guide-marker");
  suite.step(
    "Checklist ignores duplicate and invalid stored indexes",
    (await page.locator(".staff-guide-ring-value").textContent()) === "1/4"
  );
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("guide."))
        throw new DOMException("Storage blocked", "QuotaExceededError");
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (key.startsWith("guide."))
        throw new DOMException("Storage blocked", "SecurityError");
      return remove.call(this, key);
    };
  });
  await page.locator(".staff-guide-marker").nth(1).click();
  suite.step(
    "Checklist works when storage writes are blocked",
    (await page.locator(".staff-guide-ring-value").textContent()) === "2/4"
  );
  await page.locator(".staff-guide-progress button").click();
  suite.step(
    "Checklist reset works when storage is blocked",
    (await page.locator(".staff-guide-ring-value").textContent()) === "0/4"
  );

  for (const [lang, title] of [
    ["en", "Guide"],
    ["ar", "الدليل"],
    ["tr", "Kılavuz"],
    ["zh", "指南"],
    ["ru", "Руководство"],
    ["ur", "رہنما"],
  ]) {
    await page.evaluate(l => localStorage.setItem("nilelearn.locale", l), lang);
    await page.goto(`${BASE}/app/guide?role=all`);
    await page.reload();
    await page.locator(".staff-guide-card").first().waitFor({ timeout: 30000 });
    suite.step(
      `${lang}: translated catalog loads completely`,
      (await page.locator("#guide-title").textContent()) === title &&
        (await page.locator(".staff-guide-card").count()) === 62
    );
    await page.goto(`${BASE}/app/guide/convert-a-lead`);
    await page
      .locator(".staff-guide-marker")
      .first()
      .waitFor({ timeout: 30000 });
    suite.step(
      `${lang}: translated detail keeps all four steps`,
      (await page.locator(".staff-guide-marker").count()) === 4 &&
        (lang === "en" ||
          !(
            await page.locator(".staff-guide-tbody").first().textContent()
          ).includes("Record the registration fee"))
    );
  }
  await page.goto(`${BASE}/app/guide/not-a-scenario`);
  await page.locator(".staff-empty").waitFor();
  suite.step(
    "Unknown scenario gives a safe return link",
    (await page.locator(".staff-empty a[href='/app/guide']").count()) === 1
  );

  const faultContext = await browser.newContext({
    storageState: await context.storageState(),
  });
  await faultContext.addInitScript(() =>
    localStorage.setItem("nilelearn.locale", "ar")
  );
  const faultPage = await faultContext.newPage();
  suite.watch(faultPage);
  await faultPage.route("**/text.ar*", route => route.abort("failed"));
  await faultPage.goto(`${BASE}/app/guide`);
  await faultPage
    .locator(".staff-empty[role=alert]")
    .waitFor({ timeout: 30000 });
  suite.step(
    "Failed translation chunk offers an accessible retry",
    (await faultPage.locator(".staff-empty[role=alert] button").count()) === 1
  );
  await faultPage.unroute("**/text.ar*");
  await faultPage.locator(".staff-empty[role=alert] button").click();
  await faultPage
    .locator(".staff-guide-card")
    .first()
    .waitFor({ timeout: 30000 });
  suite.step(
    "Retry reloads a previously failed module",
    (await faultPage.locator("#guide-title").textContent()) === "الدليل"
  );
  await faultContext.close();

  for (const [role, allowed, forbidden] of [
    ["REGISTRAR", "add-a-lead", "assign-an-ssa"],
    ["SSA", "add-a-student", "add-a-lead"],
    ["TEACHER", "plan-my-week", "add-a-student"],
  ]) {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() =>
      localStorage.setItem("nilelearn.locale", "en")
    );
    const rolePage = await ctx.newPage();
    suite.watch(rolePage);
    try {
      await signInAndEnter(rolePage, role);
      await rolePage.goto(`${BASE}/app/guide?role=all`);
      await rolePage
        .locator(".staff-guide-card")
        .first()
        .waitFor({ timeout: 30000 });
      suite.step(
        `${role}: URL cannot enable the admin role preview`,
        (await rolePage
          .locator(`.staff-guide-card[href='/app/guide/${allowed}']`)
          .count()) === 1 &&
          (await rolePage
            .locator(`.staff-guide-card[href='/app/guide/${forbidden}']`)
            .count()) === 0 &&
          (await rolePage.locator(".staff-guide-rolepick").count()) === 0
      );
      await rolePage.goto(`${BASE}/app/guide/${forbidden}`);
      await rolePage.locator(".staff-empty").waitFor({ timeout: 30000 });
      suite.step(
        `${role}: inaccessible detail is denied`,
        (await rolePage.locator(".staff-guide-marker").count()) === 0
      );
    } catch (error) {
      suite.step(
        `${role}: live role access`,
        false,
        String(error.message).slice(0, 180)
      );
    } finally {
      await ctx.close();
    }
  }
} catch (error) {
  suite.step(
    "Guide interaction flow",
    false,
    String(error.message).slice(0, 200)
  );
} finally {
  await browser.close();
  suite.finish();
}
