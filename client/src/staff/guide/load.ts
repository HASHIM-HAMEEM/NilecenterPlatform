import type { StaffLocale } from "../i18n";
import type { GuideText } from "./text";

// Load guide prose only when a guide route is opened.
const LOADERS: Record<StaffLocale, () => Promise<{ guideText: GuideText }>> = {
  en: () => import("./text.en").then(m => ({ guideText: m.guideTextEn })),
  ar: () => import("./text.ar").then(m => ({ guideText: m.guideTextAr })),
  tr: () => import("./text.tr").then(m => ({ guideText: m.guideTextTr })),
  zh: () => import("./text.zh").then(m => ({ guideText: m.guideTextZh })),
  ru: () => import("./text.ru").then(m => ({ guideText: m.guideTextRu })),
  ur: () => import("./text.ur").then(m => ({ guideText: m.guideTextUr })),
};

export async function loadGuideText(
  locale: StaffLocale | string
): Promise<GuideText> {
  const loader = Object.hasOwn(LOADERS, locale)
    ? LOADERS[locale as StaffLocale]
    : LOADERS.en;
  return (await loader()).guideText;
}
