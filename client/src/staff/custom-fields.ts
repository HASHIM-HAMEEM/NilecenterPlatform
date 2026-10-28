import type { NccCustomFieldDefinitionDto } from "../lib/backend/api";
import { copy } from "./copy";
import { formatDate } from "./i18n";

export function customFieldDefinition(
  definitions: NccCustomFieldDefinitionDto[] | undefined,
  key: string
): NccCustomFieldDefinitionDto | undefined {
  return definitions?.find(item => item.fieldKey === key);
}

export function customFieldLabel(
  definitions: NccCustomFieldDefinitionDto[] | undefined,
  key: string
): string {
  return customFieldDefinition(definitions, key)?.label ?? key;
}

export function formatCustomFieldValue(
  definition: NccCustomFieldDefinitionDto | undefined,
  value: string | number | boolean | null
): string {
  if (value === null || value === "") return copy.state.notSet;
  if (definition?.fieldType === "boolean")
    return value === true || value === "true" ? copy.state.yes : copy.state.no;
  if (definition?.fieldType === "date") {
    const text = String(value);
    return Number.isNaN(Date.parse(text)) ? text : formatDate(text);
  }
  return String(value);
}
