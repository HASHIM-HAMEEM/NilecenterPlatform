import { describe, expect, it } from "vitest";

import {
  evaluateFormLogic,
  getOfflineEligibility,
  normalizeAndValidateFormAnswers,
  validateFormVersionContent,
  type FormVersionContent,
} from "@shared/nileForms";
import {
  createNileFormsSeedState,
  nileFormsTemplateContent,
} from "@shared/nileFormsFixtures";

describe("Nile Forms schema and answer authority", () => {
  it("validates all seven bilingual initial templates", () => {
    const state = createNileFormsSeedState();

    expect(state.definitions).toHaveLength(7);
    expect(state.versions).toHaveLength(7);
    for (const version of state.versions) {
      const result = validateFormVersionContent(version.content);
      expect(result.issues).toEqual([]);
      expect(version.content.languages).toEqual(["en", "ar"]);
    }
  });

  it("rejects cyclic conditional field rules", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "rule_a",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "hide", targetFieldId: "subject" },
        },
        {
          id: "rule_b",
          order: 2,
          when: {
            mode: "all",
            conditions: [{ fieldId: "subject", operator: "not_empty" }],
          },
          action: { type: "hide", targetFieldId: "category" },
        },
      ],
    };

    const result = validateFormVersionContent(content);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "logic",
      message: "Conditional field rules cannot contain cycles",
    });
  });

  it("applies rules in deterministic order and clears hidden values", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "hide_details",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "hide", targetFieldId: "details" },
        },
      ],
    };
    expect(validateFormVersionContent(content).ok).toBe(true);

    const logic = evaluateFormLogic(content, { category: "other" });
    expect(logic.hiddenFieldIds.has("details")).toBe(true);

    const result = normalizeAndValidateFormAnswers(content, {
      category: "other",
      subject: "Need a different team",
      details: "This value must not survive the hidden-field server pass.",
      urgent: false,
      injected_admin_role: "superadmin",
    });

    expect(result.ok).toBe(true);
    expect(result.answers).not.toHaveProperty("details");
    expect(result.answers).not.toHaveProperty("injected_admin_role");
  });

  it("hides show targets by default and gives matched hide rules precedence", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "show_details",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "show", targetFieldId: "details" },
        },
        {
          id: "hide_details",
          order: 2,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "urgent", operator: "equals", value: true },
            ],
          },
          action: { type: "hide", targetFieldId: "details" },
        },
        {
          id: "show_details_again",
          order: 3,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "show", targetFieldId: "details" },
        },
      ],
    };

    expect(
      evaluateFormLogic(content, { category: "technical" }).hiddenFieldIds.has(
        "details"
      )
    ).toBe(true);
    expect(
      evaluateFormLogic(content, { category: "other" }).hiddenFieldIds.has(
        "details"
      )
    ).toBe(false);
    expect(
      evaluateFormLogic(content, {
        category: "other",
        urgent: true,
      }).hiddenFieldIds.has("details")
    ).toBe(true);
  });

  it("omits skipped-page answers and does not require skipped-page fields", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      pages: [
        {
          id: "start",
          title: { en: "Start", ar: "البداية" },
          fields: [
            {
              id: "route",
              type: "yes_no",
              label: { en: "Skip details", ar: "تخطي التفاصيل" },
              required: true,
            },
          ],
        },
        {
          id: "details_page",
          title: { en: "Details", ar: "التفاصيل" },
          fields: [
            {
              id: "skipped_secret",
              type: "short_text",
              label: { en: "Details", ar: "التفاصيل" },
              required: true,
            },
          ],
        },
        {
          id: "finish",
          title: { en: "Finish", ar: "النهاية" },
          fields: [
            {
              id: "confirmation",
              type: "short_text",
              label: { en: "Confirmation", ar: "التأكيد" },
              required: true,
            },
          ],
        },
      ],
      logic: [
        {
          id: "skip_details",
          order: 1,
          when: {
            mode: "all",
            conditions: [{ fieldId: "route", operator: "equals", value: true }],
          },
          action: { type: "skip_to_page", targetPageId: "finish" },
        },
      ],
    };

    expect(validateFormVersionContent(content).ok).toBe(true);
    expect(
      Array.from(evaluateFormLogic(content, { route: true }).reachablePageIds)
    ).toEqual(["start", "finish"]);

    const result = normalizeAndValidateFormAnswers(content, {
      route: true,
      skipped_secret: "must not survive",
      confirmation: "Confirmed",
    });

    expect(result.ok).toBe(true);
    expect(result.answers).toEqual({ route: true, confirmation: "Confirmed" });
    expect(result.errors).not.toHaveProperty("skipped_secret");

    const resultWithoutSkippedAnswer = normalizeAndValidateFormAnswers(
      content,
      {
        route: true,
        confirmation: "Confirmed",
      }
    );
    expect(resultWithoutSkippedAnswer.ok).toBe(true);
    expect(resultWithoutSkippedAnswer.errors).not.toHaveProperty(
      "skipped_secret"
    );
  });

  it("rejects impossible calendar dates and accepts leap days", () => {
    const invalid = normalizeAndValidateFormAnswers(
      nileFormsTemplateContent.placement,
      {
        full_name: "Nile Learner",
        email: "learner@example.test",
        phone: "+20 100 000 0000",
        course_interest: "arabic",
        preferred_date: "2025-02-29",
        preferred_time: "09:30",
        current_level: "beginner",
        online: true,
      }
    );
    const valid = normalizeAndValidateFormAnswers(
      nileFormsTemplateContent.placement,
      {
        full_name: "Nile Learner",
        email: "learner@example.test",
        phone: "+20 100 000 0000",
        course_interest: "arabic",
        preferred_date: "2024-02-29",
        preferred_time: "09:30",
        current_level: "beginner",
        online: true,
      }
    );

    expect(invalid.errors.preferred_date).toBeDefined();
    expect(valid.errors.preferred_date).toBeUndefined();
  });

  it("enforces required, bounded, typed and choice validation", () => {
    const result = normalizeAndValidateFormAnswers(
      nileFormsTemplateContent.enquiry,
      {
        full_name: "A",
        email: "not-an-email",
        phone: "x",
        course_interest: "made-up-course",
        preferred_contact: "email",
      }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.full_name).toBeDefined();
    expect(result.errors.email).toBeDefined();
    expect(result.errors.phone).toBeDefined();
    expect(result.errors.course_interest).toBeDefined();
  });

  it("blocks restricted data classes from offline eligibility", () => {
    const eligible = getOfflineEligibility(nileFormsTemplateContent.incident);
    expect(eligible).toEqual({ eligible: true, restrictedFields: [] });

    const restricted = structuredClone(nileFormsTemplateContent.incident);
    restricted.pages[0].fields[0].dataClass = "health";
    expect(getOfflineEligibility(restricted)).toEqual({
      eligible: false,
      restrictedFields: ["location"],
    });
  });
});
