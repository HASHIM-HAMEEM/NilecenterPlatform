import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "@/pages/home/landing-copy";
import { PUBLIC_COPY } from "@/pages/home/public-copy";
import { enMessages } from "@/staff/copy";
import { ar } from "@/staff/copy.ar";
import { ru } from "@/staff/copy.ru";
import { tr } from "@/staff/copy.tr";
import { ur } from "@/staff/copy.ur";
import { zh } from "@/staff/copy.zh";

/**
 * Script-level checks that catch the usual machine-translation slips: wrong
 * alphabet variants, Traditional Chinese in a Simplified UI, Latin look-alike
 * letters inside Russian words, and form values that must not be translated.
 */
function leaves(tree: unknown, prefix = ""): Array<[string, string]> {
  if (typeof tree === "string") return [[prefix, tree]];
  if (Array.isArray(tree)) return tree.flatMap((value, i) => leaves(value, `${prefix}${i}.`));
  if (tree && typeof tree === "object")
    return Object.entries(tree).flatMap(([key, value]) => leaves(value, `${prefix}${key}.`));
  return [];
}

const staff = { ar, tr, zh, ru, ur };
const strings = (locale: keyof typeof staff) => [
  ...leaves(staff[locale], "staff."),
  ...leaves(LANDING_COPY[locale], "landing."),
  ...leaves(PUBLIC_COPY[locale], "public."),
];
const offenders = (locale: keyof typeof staff, bad: (text: string) => boolean) =>
  strings(locale)
    .filter(([, text]) => bad(text))
    .map(([key, text]) => `${key} ${text}`);

describe("translation quality", () => {
  it("Arabic uses Arabic letters, not Urdu or Persian forms", () => {
    expect(offenders("ar", text => /[یکہےٹڈڑںگژ]/.test(text))).toEqual([]);
  });

  it("Urdu uses Urdu letters (ک ی ہ), not Arabic ك ي ه", () => {
    expect(offenders("ur", text => /[كيه]/.test(text))).toEqual([]);
  });

  it("Urdu sentences end with the Urdu full stop", () => {
    expect(offenders("ur", text => /[\u0600-\u06FF]\.(\s|$)/.test(text))).toEqual([]);
  });

  it("Chinese is Simplified and uses full-width punctuation", () => {
    const traditional = /[們體學說這會時對開關錄設帳號課師員處檔選擇請麼與從過還進動證務議應實現變為點語讀寫書館電話條區間標準際層級測試驗類費週報產單據紀並經營銷總結統計數導覽頁顯隱刪編輯儲確認尋篩記歷狀態閱權戶註冊個資訊聯絡網線連結載傳輸檢視預覽範樣兩當後來將給讓機構組織負責職業種細節屬欄項況]/;
    expect(offenders("zh", text => traditional.test(text))).toEqual([]);
    expect(offenders("zh", text => /[\u4e00-\u9fff][,.:;?!]|[,:;?!][\u4e00-\u9fff]/.test(text.replace(/\{[^}]*\}/g, "X")))).toEqual([]);
  });

  it("Russian words do not mix Latin and Cyrillic letters", () => {
    expect(
      offenders("ru", text => (text.match(/\p{L}+/gu) ?? []).some(word => /[A-Za-z]/.test(word) && /[\u0400-\u04FF]/.test(word)))
    ).toEqual([]);
  });

  it("keeps submitted form values and role codes untranslated", () => {
    for (const locale of Object.keys(staff) as (keyof typeof staff)[]) {
      expect(PUBLIC_COPY[locale].booking.branches.map(branch => branch.value)).toEqual(
        PUBLIC_COPY.en.booking.branches.map(branch => branch.value)
      );
      expect(staff[locale].roles.ssa).toBe(enMessages.roles.ssa);
    }
  });
});
