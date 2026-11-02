import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  guideMatches,
  guideNorm,
  guideScenariosFor,
} from "../pages/guide-page";
import { GUIDE_CATEGORIES, guideScenarioById } from "./content";
import { guideTextEn } from "./text.en";
import { loadGuideText } from "./load";
import type { GuideText } from "./text";
import { canAccess } from "../nav";

/** Prose and links must stay in lockstep in every supported language. */
function checkGuideText(text: GuideText) {
  const ids = new Set<string>();
  for (const category of GUIDE_CATEGORIES) {
    const categoryText = text.categories[category.id];
    expect(categoryText, `category ${category.id} missing text`).toBeTruthy();
    expect(categoryText.title.trim()).not.toBe("");
    expect(categoryText.summary.trim()).not.toBe("");
    for (const scenario of category.scenarios) {
      expect(ids.has(scenario.id), `duplicate ${scenario.id}`).toBe(false);
      ids.add(scenario.id);
      const scenarioText = text.scenarios[scenario.id];
      expect(scenarioText, `scenario ${scenario.id} missing text`).toBeTruthy();
      expect(scenarioText.title.trim()).not.toBe("");
      expect(scenarioText.summary.trim()).not.toBe("");
      expect(scenarioText.steps.length).toBe(scenario.steps.length);
      expect(scenarioText.notes.length).toBe(scenario.noteCount);
      for (const step of scenarioText.steps) {
        expect(step.title.trim()).not.toBe("");
        expect(step.body.trim()).not.toBe("");
      }
      for (const note of scenarioText.notes) expect(note.trim()).not.toBe("");
    }
  }
  for (const id of Object.keys(text.categories))
    expect(
      GUIDE_CATEGORIES.some(category => category.id === id),
      `text has unknown category ${id}`
    ).toBe(true);
  for (const id of Object.keys(text.scenarios))
    expect(
      guideScenarioById(id),
      `text has unknown scenario ${id}`
    ).toBeTruthy();
}

const appRoutes = readFileSync(
  path.resolve(__dirname, "../../App.tsx"),
  "utf8"
);

describe("staff guide content", () => {
  it.each(["en", "ar", "tr", "zh", "ru", "ur"])(
    "every category and scenario has matching %s text",
    async locale => {
      const text = await loadGuideText(locale);
      checkGuideText(text);
      expect(Object.keys(text.categories).sort()).toEqual(
        Object.keys(guideTextEn.categories).sort()
      );
      expect(Object.keys(text.scenarios).sort()).toEqual(
        Object.keys(guideTextEn.scenarios).sort()
      );
      if (locale === "en") return;
      for (const [id, scenario] of Object.entries(text.scenarios)) {
        expect(scenario.title, `${locale}:${id} untranslated title`).not.toBe(
          guideTextEn.scenarios[id].title
        );
        expect(
          scenario.summary,
          `${locale}:${id} untranslated summary`
        ).not.toBe(guideTextEn.scenarios[id].summary);
        for (const [index, step] of scenario.steps.entries()) {
          expect(step.title, `${locale}:${id} step ${index}`).not.toBe(
            guideTextEn.scenarios[id].steps[index].title
          );
          expect(step.body, `${locale}:${id} step ${index}`).not.toBe(
            guideTextEn.scenarios[id].steps[index].body
          );
        }
        for (const [index, note] of scenario.notes.entries())
          expect(note, `${locale}:${id} note ${index}`).not.toBe(
            guideTextEn.scenarios[id].notes[index]
          );
      }
    }
  );

  it("unknown locales use English without resolving inherited object keys", async () => {
    expect(await loadGuideText("unknown")).toBe(guideTextEn);
    expect(await loadGuideText("toString")).toBe(guideTextEn);
    expect(await loadGuideText("__proto__")).toBe(guideTextEn);
  });

  it("every step href is a registered staff route the listed roles can open", () => {
    for (const category of GUIDE_CATEGORIES)
      for (const scenario of category.scenarios)
        for (const step of scenario.steps) {
          if (!step.href) continue;
          const [path] = step.href.split("?");
          expect(
            appRoutes.includes(`path="${path}"`),
            `${step.href} is not a StaffRoute in App.tsx`
          ).toBe(true);
          for (const role of scenario.roles)
            expect(
              canAccess(path, role),
              `${step.href} not reachable by ${role}`
            ).toBe(true);
        }
  });

  it("filters scenarios by role", () => {
    const registrarIds = guideScenariosFor("registrar").flatMap(entry =>
      entry.scenarios.map(scenario => scenario.id)
    );
    expect(registrarIds).not.toContain("add-a-student");
    expect(registrarIds).not.toContain("disable-a-student");
    expect(registrarIds).not.toContain("assign-an-ssa");
    expect(registrarIds).toContain("build-a-form");
    expect(
      guideScenariosFor("ssa").flatMap(entry =>
        entry.scenarios.map(item => item.id)
      )
    ).toContain("build-a-form");
    expect(
      guideScenariosFor("super_admin").flatMap(entry =>
        entry.scenarios.map(item => item.id)
      )
    ).not.toContain("switch-branch-workspace");
    const ssaCategories = guideScenariosFor("ssa").map(
      entry => entry.category.id
    );
    expect(ssaCategories).not.toContain("leads");
    expect(ssaCategories).not.toContain("bookings");
    const teacherCategories = guideScenariosFor("teacher").map(
      entry => entry.category.id
    );
    expect(teacherCategories).not.toContain("staff");
    const allIds = guideScenariosFor("all").flatMap(entry =>
      entry.scenarios.map(scenario => scenario.id)
    );
    const everyId = GUIDE_CATEGORIES.flatMap(category =>
      category.scenarios.map(scenario => scenario.id)
    );
    expect(allIds.sort()).toEqual(everyId.sort());
  });

  it("searches case- and diacritic-insensitively across steps and notes", () => {
    expect(guideNorm("Élodie  Sessión")).toBe("elodie  session");
    expect(guideNorm("الطُّلَّاب")).toBe("الطلاب");
    // "placement" lives inside step bodies, not only titles.
    expect(
      guideMatches(guideTextEn, "PLACEMENT", "access", "read-notifications")
    ).toBe(false);
    expect(
      guideMatches(
        guideTextEn,
        "placement",
        "bookings",
        "schedule-a-trial-lesson"
      )
    ).toBe(true);
    // Notes text participates too.
    expect(
      guideMatches(guideTextEn, "storage", "students", "add-a-document")
    ).toBe(true);
    expect(
      guideMatches(guideTextEn, "  storage  ", "students", "add-a-document")
    ).toBe(true);
    expect(
      guideMatches(guideTextEn, "xyz", "access", "read-notifications")
    ).toBe(false);
  });
});
