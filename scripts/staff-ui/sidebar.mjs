// Sidebar: folding groups, remembered state, keyboard, icon rail.
import { BASE, chromium, settle, signIn, createSuite } from "./lib.mjs";

const suite = createSuite("sidebar");
const OUT = suite.out;
const step = suite.step;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e).slice(0, 160)));

await signIn(page, "SUPER_ADMIN");
await page.evaluate(() => {
  localStorage.removeItem("nilelearn.staff.sidebar.folded");
  localStorage.setItem("nilelearn.staff.sidebar", "expanded");
  localStorage.setItem("nilelearn.locale", "en");
});
await page.goto(`${BASE}/app/students`);
await settle(page, ".staff-nav-group");
await page.screenshot({ path: `${OUT}/1-expanded.png` });

const group = name => page.locator(".staff-nav-group", { has: page.locator(".staff-nav-group-text", { hasText: name }) });
const visibleLinks = name => group(name).locator(".staff-nav-link:visible").count();

// Fold a group that does not hold the current page.
const teachingBefore = await visibleLinks("Teaching");
await group("Teaching").locator(".staff-nav-group-label").click();
await page.waitForTimeout(400);
step("Teaching folds", (await group("Teaching").locator(".staff-nav-fold").evaluate(el => el.getBoundingClientRect().height)) < 2, `before=${teachingBefore}`);
step("folded label shows a page count", (await group("Teaching").locator(".staff-nav-group-count").innerText()).trim() === String(teachingBefore));
step("aria-expanded is false", (await group("Teaching").locator(".staff-nav-group-label").getAttribute("aria-expanded")) === "false");

// Fold the group that holds the current page: the current page stays visible.
await group("Admissions").locator(".staff-nav-group-label").click();
await page.waitForTimeout(400);
const shown = await group("Admissions").locator(":scope > .staff-nav-list .staff-nav-link").allInnerTexts();
const foldHeight = await group("Admissions").locator(".staff-nav-fold").evaluate(el => el.getBoundingClientRect().height);
step("current page stays visible in a folded group", shown.length === 1 && /Students/.test(shown[0]) && foldHeight < 2, `${shown.join(",")} fold=${foldHeight}`);
await page.screenshot({ path: `${OUT}/2-folded.png` });

// Remembered after reload.
await page.reload();
await settle(page, ".staff-nav-group");
step("fold is remembered after reload", (await group("Teaching").getAttribute("data-folded")) !== null);

// Hovering a folded heading flies its pages out beside the sidebar.
const flyout = page.locator(".staff-nav-flyout");
const sidebarRight = (await page.locator(".staff-sidebar").boundingBox()).x + (await page.locator(".staff-sidebar").boundingBox()).width;
const navBefore = await page.locator(".staff-nav").evaluate(el => el.scrollHeight);
await group("Admissions").locator(".staff-nav-group-label").hover();
await flyout.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
const flyLinks = await flyout.locator(".staff-nav-link").allInnerTexts();
const flyBox = await flyout.boundingBox().catch(() => null);
step(
  "hovering a folded heading shows all its pages beside the sidebar",
  flyLinks.length >= 4 && Boolean(flyBox) && flyBox.x >= sidebarRight,
  `${flyLinks.length} pages: ${flyLinks.join(", ")}`
);
step(
  "the current page is marked in the flyout",
  (await flyout.locator('.staff-nav-link[aria-current="page"]').innerText().catch(() => "")).includes("Students")
);
step("the sidebar does not move while it is open", (await page.locator(".staff-nav").evaluate(el => el.scrollHeight)) === navBefore);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/2b-flyout.png` });
// Move into the card and open a page from it.
await flyout.locator(".staff-nav-link", { hasText: "Leads" }).hover();
await page.waitForTimeout(300);
step("moving into the card keeps it open", await flyout.isVisible());
await flyout.locator(".staff-nav-link", { hasText: "Leads" }).click();
await page.waitForURL(/\/app\/leads/, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(300);
step("a page opens from the flyout and the card closes", /\/app\/leads/.test(page.url()) && (await flyout.count()) === 0, page.url());
// Leaving closes it.
await group("Teaching").locator(".staff-nav-group-label").hover();
await flyout.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
await page.mouse.move(900, 600);
await page.waitForTimeout(600);
step("leaving the heading closes the flyout", (await flyout.count()) === 0);
// Keyboard: ArrowRight opens it and focuses the first page; Escape returns.
await group("Teaching").locator(".staff-nav-group-label").focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
const focusedInFly = await page.evaluate(() => Boolean(document.activeElement?.closest(".staff-nav-flyout")));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const backOnHeading = await page.evaluate(() => document.activeElement?.classList.contains("staff-nav-group-label"));
step("keyboard opens the flyout and Escape returns to the heading", focusedInFly && backOnHeading && (await flyout.count()) === 0);
await page.goto(`${BASE}/app/students`);
await settle(page, ".staff-nav-group");

// Keyboard: Enter on the label unfolds.
await group("Teaching").locator(".staff-nav-group-label").focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
step("keyboard unfolds the group", (await group("Teaching").locator(".staff-nav-fold").evaluate(el => el.getBoundingClientRect().height)) > 60);

// Rail: every icon shows, labels and toggles are hidden.
await page.keyboard.press("Escape");
await page.locator("body").click({ position: { x: 900, y: 600 } });
await page.keyboard.press("[");
await page.waitForTimeout(500);
const railLinks = await page.locator(".staff-sidebar .staff-nav-link:visible").count();
const allLinks = await page.locator(".staff-sidebar .staff-nav-link").count();
step("rail shows every icon, even from folded groups", railLinks === allLinks, `${railLinks}/${allLinks}`);
step("rail hides group toggles", (await page.locator(".staff-sidebar .staff-nav-group-label:visible").count()) === 0);
await page.screenshot({ path: `${OUT}/3-rail.png` });
await page.keyboard.press("[");
await page.waitForTimeout(400);

// Arabic.
await page.evaluate(() => localStorage.setItem("nilelearn.locale", "ar"));
await page.reload();
await settle(page, ".staff-nav-group");
await page.screenshot({ path: `${OUT}/4-arabic.png` });

await page.evaluate(() => {
  localStorage.removeItem("nilelearn.staff.sidebar.folded");
  localStorage.setItem("nilelearn.locale", "en");
});
step("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
suite.finish();
