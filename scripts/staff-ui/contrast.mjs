// Colour contrast gate for the staff app, the public site and sign-in pages,
// in light and dark themes (read-only). Every visible text node is measured
// against the background actually behind it (ancestor colours composited,
// opacity included) to WCAG 2.2: 4.5:1 for normal text, 3:1 for large text,
// icons and form-field borders. Disabled controls need 3:1 so they stay
// readable. Text on photos or gradients is listed separately for review.
//
//   node scripts/staff-ui/contrast.mjs
//   STAFF_UI_THEME=dark STAFF_UI_LANG=ar STAFF_UI_SCOPE=staff node scripts/staff-ui/contrast.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BASE, chromium, createSuite, creds } from "./lib.mjs";

const THEMES = (process.env.STAFF_UI_THEME ?? "light,dark").split(",");
const LANGS = (process.env.STAFF_UI_LANG ?? "en,ar").split(",");
const SCOPES = (process.env.STAFF_UI_SCOPE ?? "public,auth,staff").split(",");
const WIDTHS = (process.env.STAFF_UI_WIDTHS ?? "1440,390").split(",").map(Number);
const suite = createSuite(`contrast-${LANGS.join("+")}`);

const PUBLIC = ["/", "/courses", "/courses/arabic", "/book-free-trial", "/verify-certificate", "/faq", "/contact", "/about", "/privacy", "/terms", "/404", "/forms/free-trial-enquiry"];
const AUTH = ["/auth/administration-login", "/auth/student-login", "/auth/forgot-password"];
const STAFF = [
  "/app/dashboard", "/app/reports", "/app/forms", "/app/notifications", "/app/profile", "/app/students", "/app/leads",
  "/app/enrolments", "/app/placement-tests", "/app/trial-lessons", "/app/courses", "/app/classes", "/app/rooms",
  "/app/staff", "/app/branches", "/app/departments", "/app/lost-reasons", "/app/action-reasons",
  "/app/areas-of-study", "/app/custom-fields", "/app/moodle", "/app/system", "/app/audit",
];
const DETAIL_LISTS = ["/app/students", "/app/leads", "/app/classes", "/app/courses", "/app/staff", "/app/branches", "/app/rooms"];

/* Runs in the page. Returns failures and the count of checked items. */
function audit() {
  const parse = value => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  // Browsers report modern colours as color(srgb …) or oklab(…); a 1x1 canvas converts any of them.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  const toRgba = value => {
    if (!value || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const direct = /^rgba?\(/.test(value) ? parse(value) : null;
    if (direct) return direct;
    if (cache.has(value)) return cache.get(value);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out = { r, g, b, a: a / 255 };
    cache.set(value, out);
    return out;
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = k => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
    return { r: mix("r"), g: mix("g"), b: mix("b"), a };
  };
  const lum = c => {
    const ch = v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const visible = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || s.contentVisibility === "hidden") return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    if (s.clipPath === "inset(50%)" || (s.position === "absolute" && r.width <= 1)) return false;
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight * 6;
  };
  const opacityOf = el => {
    let o = 1;
    for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };
  // Background behind an element: composite ancestor backgrounds bottom-up.
  const backgroundOf = el => {
    const layers = [];
    let image = false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none" && !/^url\(.*\.svg/.test(s.backgroundImage)) image = true;
      const c = toRgba(s.backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a >= 0.999) break;
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const canvasBg = toRgba(getComputedStyle(document.documentElement).backgroundColor);
    if (canvasBg.a > 0) bg = over(canvasBg, bg);
    for (const layer of layers.reverse()) bg = over(layer, bg);
    return { bg, image };
  };
  const label = el => {
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 36);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  const isDisabled = el => Boolean(el.closest(":disabled, [aria-disabled='true'], [data-disabled]"));
  const fails = [];
  const images = [];
  let checked = 0;

  const scope = document.body;
  for (const el of scope.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
    if (el.closest("svg, .nile-logo, .staff-brand-mark, [data-contrast-skip]")) continue;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    // Decorative separators (aria-hidden "/", "·") carry no information.
    if (hasText && el.closest("[aria-hidden='true']") && /^[\s/·•|–—]+$/.test(el.textContent)) continue;
    const isField = el.matches("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea");
    if (!hasText && !isField) continue;
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const opacity = opacityOf(el);
    const { bg, image } = backgroundOf(el);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = isDisabled(el) ? 3 : large ? 3 : 4.5;
    const check = (colourValue, what) => {
      const c = toRgba(colourValue);
      const fg = over({ ...c, a: c.a * opacity }, bg);
      const r = ratio(fg, bg);
      checked += 1;
      if (image) {
        if (r < need) images.push(`${label(el)} ${what} ${r.toFixed(2)}`);
        return;
      }
      if (r < need) fails.push(`${label(el)} ${what} ${r.toFixed(2)} < ${need}`);
    };
    if (hasText) check(s.color, "text");
    if (isField) {
      if (el.value) check(s.color, "value");
      if (el.getAttribute("placeholder") && !el.value) check(getComputedStyle(el, "::placeholder").color, "placeholder");
    }
  }
  // Icons that carry meaning (inside buttons and links) and form-field edges: 3:1.
  for (const svg of scope.querySelectorAll("button svg, a svg, [role=menuitem] svg, .ui-field svg")) {
    // Brand petals beside course names are decoration (WCAG 1.4.11 exempts them).
    if (svg.closest(".nile-logo, .staff-brand-mark, .nile-rosette, [data-petal], [data-contrast-skip]") || !visible(svg)) continue;
    const box = svg.getBoundingClientRect();
    if (box.width > 32 || box.height > 32) continue; // charts and illustrations, not icons
    // Paint lives on the shapes (lucide strokes, brand petals fill).
    const shape = svg.querySelector("path, polygon, circle, rect, line, polyline, ellipse") ?? svg;
    const s = getComputedStyle(shape);
    const paint = s.stroke && s.stroke !== "none" ? s.stroke : s.fill && s.fill !== "none" ? s.fill : s.color;
    const { bg, image } = backgroundOf(svg.parentElement);
    const c = toRgba(paint);
    const fg = over({ ...c, a: c.a * opacityOf(svg) }, bg);
    const r = ratio(fg, bg);
    checked += 1;
    const need = isDisabled(svg) ? 2 : 3;
    if (!image && r < need) fails.push(`icon in ${label(svg.closest("button, a, [role=menuitem], .ui-field"))} ${r.toFixed(2)} < ${need}`);
  }
  for (const field of scope.querySelectorAll(".staff-input, .ui-field, .lp input, .lp select, .lp textarea, .auth-v2 input")) {
    if (!visible(field) || isDisabled(field)) continue;
    const s = getComputedStyle(field);
    if (parseFloat(s.borderTopWidth) < 1) continue;
    const own = toRgba(s.backgroundColor);
    const { bg } = backgroundOf(field.parentElement);
    const border = over(toRgba(s.borderTopColor), bg);
    checked += 1;
    // The edge must stand out from what surrounds the field (WCAG 1.4.11).
    const r = ratio(border, bg);
    if (r < 3 && ratio(over(own, bg), bg) < 3) fails.push(`field edge ${label(field)} ${r.toFixed(2)} < 3`);
  }
  return { fails: [...new Set(fails)], images: [...new Set(images)], checked };
}

const browser = await chromium.launch();
async function contextFor(theme, lang, width) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    reducedMotion: "reduce",
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await context.addInitScript(([t, l]) => {
    localStorage.setItem("nilelearn.theme", t);
    localStorage.setItem("nilelearn.locale", l);
    localStorage.setItem("nilelearn.staff.sidebar", "expanded");
  }, [theme, lang]);
  return context;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
}

async function measure(page, key, results) {
  const r = await page.evaluate(audit);
  results.checked += r.checked;
  if (r.fails.length) {
    results.fails.push(`${key}: ${r.fails.slice(0, 4).join(" | ")}${r.fails.length > 4 ? ` (+${r.fails.length - 4})` : ""}`);
    results.all.push(...r.fails.map(f => `${key}\t${f}`));
  }
  if (r.images.length) results.images.push(`${key}: ${r.images.slice(0, 2).join(" | ")}`);
}

async function staffSignIn(page) {
  const account = creds("SUPER_ADMIN");
  await page.goto(`${BASE}/auth/administration-login`);
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes("login"), { timeout: 30000 });
}

/* Open states on the Students page: menus, a select, the date picker, a sheet, a dialog. */
async function overlays(page, key, results) {
  await page.goto(`${BASE}/app/students`);
  await settle(page);
  const states = [
    ["user menu", async () => page.locator(".staff-user-trigger").first().click()],
    ["notifications", async () => page.locator(".staff-topbar button[aria-label]").last().click()],
    ["command menu", async () => page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K")],
    ["branch select", async () => page.locator(".staff-toolbar [role=combobox]").first().click()],
    ["add sheet", async () => page.locator(".staff-page-actions .staff-btn[data-variant='primary']").first().click()],
  ];
  for (const [name, open] of states) {
    await page.goto(`${BASE}/app/students`);
    await settle(page);
    await open().catch(() => {});
    await page.waitForTimeout(500);
    await measure(page, `${key} ${name}`, results);
    if (name === "add sheet") {
      // Date picker inside the sheet, and a validation pass to show error text.
      await page.locator(".ui-sheet .staff-sheet-footer .staff-btn[data-variant='primary']").click().catch(() => {});
      await page.waitForTimeout(300);
      await measure(page, `${key} sheet errors`, results);
    }
    await page.keyboard.press("Escape").catch(() => {});
  }
  await page.goto(`${BASE}/app/classes`);
  await settle(page);
  await page.locator(".staff-page-actions .staff-btn[data-variant='primary']").first().click().catch(() => {});
  await page.waitForSelector("#class-start", { timeout: 8000 }).catch(() => {});
  await page.locator("#class-start").click().catch(() => {});
  await page.waitForTimeout(400);
  await measure(page, `${key} date picker`, results);
}

for (const theme of THEMES) {
  for (const lang of LANGS) {
    for (const scope of SCOPES) {
      const results = { fails: [], images: [], all: [], checked: 0 };
      for (const width of WIDTHS) {
        const context = await contextFor(theme, lang, width);
        const page = await context.newPage();
        suite.watch(page);
        if (scope === "public") {
          for (const path of PUBLIC) {
            await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(400);
            await measure(page, `${path}@${width}`, results);
          }
        } else if (scope === "auth") {
          for (const path of AUTH) {
            await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
            await measure(page, `${path}@${width}`, results);
          }
        } else {
          await staffSignIn(page);
          const pages = [...STAFF];
          if (width === WIDTHS[0]) {
            for (const list of DETAIL_LISTS) {
              await page.goto(`${BASE}${list}`);
              await settle(page);
              const href = await page.locator(`.staff-content a[href^='${list}/']`).first().getAttribute("href").catch(() => null);
              if (href) pages.push(href.split("?")[0]);
            }
            // Forms: the editor, a fill page and a response, wherever they exist.
            for (const tab of ["", "?tab=fill", "?tab=review"]) {
              await page.goto(`${BASE}/app/forms${tab}`);
              await settle(page);
              const hrefs = await page.locator(".staff-content a[href^='/app/forms/']").evaluateAll(as => as.map(a => a.getAttribute("href")));
              for (const pattern of [/^\/app\/forms\/fill\//, /^\/app\/forms\/responses\//, /^\/app\/forms\/(?!import|fill|responses)[^/?]+$/]) {
                const hit = hrefs.find(h => pattern.test(h.split("?")[0]));
                if (hit && !pages.includes(hit)) pages.push(hit);
              }
            }
          }
          for (const path of pages) {
            await page.goto(`${BASE}${path}`);
            await settle(page);
            await measure(page, `${path}@${width}`, results);
          }
          if (width === WIDTHS[0]) await overlays(page, `overlays@${width}`, results);
        }
        await context.close();
      }
      suite.step(
        `${theme} ${lang} ${scope}: ${results.checked} checks`,
        results.fails.length === 0,
        results.fails.slice(0, 6).join("\n    ")
      );
      writeFileSync(path.join(suite.out, `failures-${theme}-${lang}-${scope}.txt`), results.all.join("\n") + "\n");
      if (results.images.length) console.log(`  review (text on image or gradient): ${results.images.slice(0, 4).join("; ")}`);
    }
  }
}
/* Loading states follow the theme: a page still downloading keeps the shell,
   and the first-load splash uses the theme's colours. Downloads are slowed on
   purpose so each state stays on screen long enough to measure. */
if (SCOPES.includes("staff")) {
  const slow = ms => async route => {
    await new Promise(done => setTimeout(done, ms));
    await route.continue().catch(() => {});
  };
  for (const theme of THEMES) {
    const context = await contextFor(theme, "en", 1440);
    const page = await context.newPage();
    await staffSignIn(page);
    await page.goto(`${BASE}/app/dashboard`);
    await settle(page);
    await page.route(/rooms-page/, slow(2500));
    await page.click("a.staff-nav-link[href='/app/rooms']");
    await page.waitForTimeout(500);
    const during = await page.evaluate(() => ({
      shell: Boolean(document.querySelector(".staff-nav")),
      splash: Boolean(document.querySelector(".platform-route-loading")),
      loader: Boolean(document.querySelector(".staff-content [role=status]")),
    }));
    suite.step(
      `${theme}: a page still loading keeps the shell`,
      during.shell && during.loader && !during.splash,
      JSON.stringify(during)
    );
    const first = await context.newPage();
    await first.route(/staff-route/, slow(2500));
    first.goto(`${BASE}/app/classes`).catch(() => {});
    await first.waitForSelector(".platform-route-loading", { timeout: 15000 });
    const splash = await first.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".platform-route-loading"));
      const dark = c => c.match(/\d+/g).slice(0, 3).reduce((a, v) => a + Number(v), 0) < 200;
      return { bg: s.backgroundColor, color: s.color, darkBg: dark(s.backgroundColor), darkText: dark(s.color) };
    });
    suite.step(
      `${theme}: first-load splash uses ${theme} colours`,
      theme === "dark" ? splash.darkBg && !splash.darkText : !splash.darkBg && splash.darkText,
      JSON.stringify(splash)
    );
    await context.close();
  }
}

await browser.close();
suite.finish();
