import { describe, expect, it } from "vitest";
import { COUNTRIES, countryByAlpha3, nationalityName } from "./countries";

describe("country table", () => {
  it("has unique 3-uppercase-letter alpha-3 codes and valid alpha-2 codes", () => {
    const a3s = new Set(COUNTRIES.map(country => country.a3));
    expect(a3s.size).toBe(COUNTRIES.length);
    for (const country of COUNTRIES) {
      expect(country.a3).toMatch(/^[A-Z]{3}$/);
      expect(country.a2).toMatch(/^[A-Z]{2}$/);
      expect(country.en.length).toBeGreaterThan(0);
    }
  });

  it("pins Egypt first and resolves codes both ways", () => {
    expect(COUNTRIES[0].a3).toBe("EGY");
    expect(countryByAlpha3("EGY")?.a2).toBe("EG");
    expect(countryByAlpha3("egy")?.en).toBe("Egypt");
    expect(countryByAlpha3("XXX")).toBeUndefined();
  });
});

describe("nationalityName", () => {
  it("localizes codes and falls back to the code for unknowns", () => {
    expect(nationalityName("EGY", "en")).toBe("Egypt");
    const ar = nationalityName("EGY", "ar");
    expect(ar).not.toBe("EGY");
    expect(ar && ar !== "Egypt").toBe(true);
    expect(nationalityName("XXX", "en")).toBe("XXX");
    expect(nationalityName(null, "en")).toBeNull();
  });
});
