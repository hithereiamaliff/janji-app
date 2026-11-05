import i18n, { defaultLanguage, pickLanguage } from "@/i18n";

describe("pickLanguage", () => {
  it("uses the first supported device language", () => {
    expect(pickLanguage(["en"])).toBe("en");
  });

  it("falls back to English for unsupported or missing languages", () => {
    expect(pickLanguage(["ms", null])).toBe(defaultLanguage);
    expect(pickLanguage([])).toBe(defaultLanguage);
  });
});

describe("i18n", () => {
  it("is ready on import with the English strings", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t("tabs.bookings")).toBe("Bookings");
  });
});
