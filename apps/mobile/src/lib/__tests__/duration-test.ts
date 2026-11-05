import "@/i18n";

import { t } from "i18next";

import { formatDuration } from "@/lib/duration";

describe("formatDuration", () => {
  it.each([
    [1, "1 min"],
    [45, "45 min"],
    [60, "1 hr"],
    [90, "1 hr 30 min"],
    [180, "3 hr"],
  ])("%i minutes → %s", (minutes, text) => {
    expect(formatDuration(t, minutes)).toBe(text);
  });
});
