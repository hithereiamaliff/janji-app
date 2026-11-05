import { dayKey, formatDayHeading, formatTimeRange } from "@/bookings/format";

// Jest runs in UTC (jest.global-setup.js), so "local time" in these tests is UTC.
const now = new Date("2026-11-05T09:00:00Z");
const labels = { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" };

describe("dayKey", () => {
  it("is the calendar day in local time", () => {
    expect(dayKey("2026-11-06T23:59:00Z")).toBe("2026-11-06");
    expect(dayKey("2026-11-07T00:00:00Z")).toBe("2026-11-07");
  });
});

describe("formatDayHeading", () => {
  it.each([
    ["2026-11-05T22:00:00Z", "Today"],
    ["2026-11-06T00:30:00Z", "Tomorrow"],
    ["2026-11-04T23:30:00Z", "Yesterday"],
  ])("%s → %s", (iso, expected) => {
    expect(formatDayHeading(iso, { locale: "en-GB", now, labels })).toBe(expected);
  });

  // Punctuation between the parts differs between ICU versions, so only the parts are checked.
  it("shows other days as weekday, day and month", () => {
    const heading = formatDayHeading("2026-11-12T07:00:00Z", { locale: "en-GB", now, labels });

    expect(heading).toMatch(/^Thu\W+12 Nov$/);
  });

  it("adds the year only for another year", () => {
    expect(formatDayHeading("2027-01-04T07:00:00Z", { locale: "en-GB", now, labels })).toMatch(/2027/);
    expect(formatDayHeading("2026-12-31T07:00:00Z", { locale: "en-GB", now, labels })).not.toMatch(/2026/);
  });
});

describe("formatTimeRange", () => {
  it("formats both ends in the locale's style", () => {
    expect(formatTimeRange("2026-11-06T07:00:00Z", "2026-11-06T07:30:00Z", "en-US")).toBe(
      "7:00 AM – 7:30 AM"
    );
    expect(formatTimeRange("2026-11-06T07:00:00Z", "2026-11-06T13:15:00Z", "en-GB")).toBe("7:00 – 13:15");
  });
});
