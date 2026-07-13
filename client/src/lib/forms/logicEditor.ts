import {
  formLogicOperators,
  type FormField,
  type FormLogicCondition,
  type FormLogicOperator,
} from "@shared/nileForms";

const valuelessOperators = new Set<FormLogicOperator>(["empty", "not_empty"]);
const numericOperators = new Set<FormLogicOperator>([
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
]);

export function conditionOperatorsForField(
  field: FormField | undefined
): FormLogicOperator[] {
  if (field?.type === "multiple_choice") {
    return ["in", "not_in", "empty", "not_empty"];
  }
  if (field?.type === "number" || field?.type === "rating") {
    return formLogicOperators.filter(
      operator => operator !== "in" && operator !== "not_in"
    );
  }
  if (field?.type === "single_choice" || field?.type === "entity_reference") {
    return ["equals", "not_equals", "in", "not_in", "empty", "not_empty"];
  }
  return ["equals", "not_equals", "empty", "not_empty"];
}

export function defaultConditionValue(
  field: FormField | undefined,
  operator: FormLogicOperator
): FormLogicCondition["value"] {
  if (valuelessOperators.has(operator)) return undefined;
  if (operator === "in" || operator === "not_in") return [];
  if (field?.type === "yes_no" || field?.type === "consent") return true;
  if (field?.type === "number" || field?.type === "rating") {
    return field.validation?.min ?? 0;
  }
  return field?.options?.[0]?.id ?? "";
}

export function defaultLogicConditionForField(
  field: FormField
): FormLogicCondition {
  const hasConcreteDefault =
    field.type === "yes_no" ||
    field.type === "consent" ||
    field.type === "number" ||
    field.type === "rating" ||
    ((field.type === "single_choice" || field.type === "entity_reference") &&
      Boolean(field.options?.length));
  const operator: FormLogicOperator = hasConcreteDefault
    ? conditionOperatorsForField(field)[0]
    : "not_empty";
  return {
    fieldId: field.id,
    operator,
    value: defaultConditionValue(field, operator),
  };
}

export function conditionValueFromInput(
  field: FormField | undefined,
  operator: FormLogicOperator,
  input: string | string[]
): FormLogicCondition["value"] {
  if (valuelessOperators.has(operator)) return undefined;
  if (operator === "in" || operator === "not_in") {
    const values = Array.isArray(input)
      ? input
      : input.split(",").map(value => value.trim());
    return Array.from(new Set(values.filter(Boolean)));
  }
  const value = Array.isArray(input) ? (input[0] ?? "") : input;
  if (field?.type === "yes_no" || field?.type === "consent") {
    return value === "true";
  }
  if (
    numericOperators.has(operator) ||
    field?.type === "number" ||
    field?.type === "rating"
  ) {
    if (!value.trim()) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return value;
}

export function conditionValueAsText(value: FormLogicCondition["value"]) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined) return "";
  return String(value);
}

export function conditionUsesNumericInput(
  field: FormField | undefined,
  operator: FormLogicOperator
) {
  return (
    numericOperators.has(operator) ||
    field?.type === "number" ||
    field?.type === "rating"
  );
}
