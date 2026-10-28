import { useMemo } from "react";
import { COUNTRIES, nationalityName } from "../countries";
import { copy } from "../copy";
import { intlLocale } from "../i18n";
import { SearchableSelect } from "./searchable-select";

/** Searchable ISO alpha-3 nationality picker. Value stays the code (or ""). */
export function NationalitySelect({
  value,
  onChange,
  optional = true,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const locale = intlLocale();
  const options = useMemo(() => {
    const list = COUNTRIES.map(country => ({
      value: country.a3,
      label: `${nationalityName(country.a3, locale) ?? country.en} · ${country.a3}`,
    }));
    return optional
      ? [{ value: "", label: copy.state.notSet }, ...list]
      : list;
  }, [locale, optional]);
  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={copy.state.notSet}
      searchPlaceholder={copy.actions.search}
      ariaLabel={ariaLabel ?? copy.admissions.identity.nationality}
      disabled={disabled}
      className="w-full"
    />
  );
}
