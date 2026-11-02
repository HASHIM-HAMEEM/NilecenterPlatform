import { useEffect, useState } from "react";
import type { StaffLocale } from "../i18n";
import { loadGuideText } from "./load";
import type { GuideText } from "./text";

export function useGuideText(locale: StaffLocale) {
  const [loaded, setLoaded] = useState<{
    locale: StaffLocale;
    text: GuideText;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    void loadGuideText(locale).then(
      text => {
        if (alive) setLoaded({ locale, text });
      },
      () => {
        if (alive) setFailed(true);
      }
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  return {
    text: loaded?.locale === locale ? loaded.text : null,
    failed,
    // Browsers can cache a failed module fetch; reload to retry the chunk.
    retry: () => window.location.reload(),
  };
}
