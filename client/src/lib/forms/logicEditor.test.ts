import { describe, expect, it } from "vitest";

import {
  conditionOperatorsForField,
  conditionValueFromInput,
  defaultConditionValue,
  defaultLogicConditionForField,
} from "@/lib/forms/logicEditor";
import type { FormField } from "@shared/nileForms";

const numberField: FormField = {
  id: "score",
  type: "number",
  label: { en: "Score", ar: "النتيجة" },
  validation: { min: 1 },
};
const yesNoField: FormField = {
  id: "approved",
  type: "yes_no",
  label: { en: "Approved", ar: "مقبول" },
};
const consentField: FormField = {
  id: "consent",
  type: "consent",
  label: { en: "Consent", ar: "الموافقة" },
};
const choicesField: FormField = {
  id: "topics",
  type: "multiple_choice",
  label: { en: "Topics", ar: "الموضوعات" },
  options: [
    { id: "grammar", label: { en: "Grammar", ar: "النحو" } },
    { id: "reading", label: { en: "Reading", ar: "القراءة" } },
  ],
};
const textField: FormField = {
  id: "notes",
  type: "short_text",
  label: { en: "Notes", ar: "ملاحظات" },
};

describe("Nile Forms typed logic editor", () => {
  it("keeps numeric and boolean comparisons typed", () => {
    expect(conditionValueFromInput(numberField, "greater_than", "12.5")).toBe(
      12.5
    );
    expect(conditionValueFromInput(yesNoField, "equals", "false")).toBe(false);
    expect(conditionValueFromInput(consentField, "equals", "true")).toBe(true);
    expect(defaultConditionValue(numberField, "equals")).toBe(1);
    expect(defaultConditionValue(consentField, "equals")).toBe(true);
  });

  it("authors in/not-in values as deduplicated arrays", () => {
    expect(conditionOperatorsForField(choicesField)).toEqual([
      "in",
      "not_in",
      "empty",
      "not_empty",
    ]);
    expect(
      conditionValueFromInput(choicesField, "in", "grammar, reading, grammar")
    ).toEqual(["grammar", "reading"]);
  });

  it("creates new rules with a value that matches the source field type", () => {
    expect(defaultLogicConditionForField(consentField)).toEqual({
      fieldId: "consent",
      operator: "equals",
      value: true,
    });
    expect(defaultLogicConditionForField(choicesField)).toEqual({
      fieldId: "topics",
      operator: "not_empty",
      value: undefined,
    });
    expect(defaultLogicConditionForField(textField)).toEqual({
      fieldId: "notes",
      operator: "not_empty",
      value: undefined,
    });
  });
});
