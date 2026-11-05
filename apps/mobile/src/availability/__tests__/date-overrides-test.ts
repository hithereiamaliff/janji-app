import "@/i18n";

import { format } from "date-fns";
import { t } from "i18next";

import {
  defaultOverrideRanges,
  overrideDateText,
  overrideDays,
  overrideHoursText,
  todayIn,
  upcomingOverrideDays,
  weekdayOf,
  withOverride,
  withoutOverride,
} from "@/availability/date-overrides";
import type { DateOverride, WeeklyHours } from "@/availability/schedule";
import en from "@/i18n/locales/en.json";

const christmas: DateOverride[] = [
  { date: "2026-12-24", startTime: "13:00", endTime: "17:00" },
  { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
  { date: "2026-12-24", startTime: "09:00", endTime: "12:00" },
  { date: "2025-12-24", startTime: "09:00", endTime: "12:00" },
];

/** 5:30 PM in London on 5 November 2026, which is already the 6th in Kuala Lumpur. */
const now = new Date("2026-11-05T17:30:00Z");

describe("overrideDays", () => {
  it("gives each date its ranges, earliest first, and none to a date that's unavailable", () => {
    expect(overrideDays(christmas)).toEqual([
      { date: "2025-12-24", ranges: [{ start: "09:00", end: "12:00" }] },
      {
        date: "2026-12-24",
        ranges: [
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ],
      },
      { date: "2026-12-25", ranges: [] },
    ]);
  });

  it("leaves out a row that adds no time, beside ones that do", () => {
    expect(
      overrideDays([
        { date: "2026-12-31", startTime: "00:00", endTime: "00:00" },
        { date: "2026-12-31", startTime: "10:00", endTime: "14:00" },
      ])
    ).toEqual([{ date: "2026-12-31", ranges: [{ start: "10:00", end: "14:00" }] }]);
  });
});

describe("todayIn", () => {
  it("gives today's date on the time zone's clock", () => {
    expect(todayIn("Europe/London", now)).toBe("2026-11-05");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-11-05");
    expect(todayIn("Asia/Kuala_Lumpur", now)).toBe("2026-11-06");
  });

  it("falls back to the device's date for a time zone Intl doesn't know", () => {
    expect(todayIn("Mars/Olympus", now)).toBe(format(now, "yyyy-MM-dd"));
  });
});

describe("upcomingOverrideDays", () => {
  const overrides: DateOverride[] = [
    { date: "2026-11-04", startTime: "09:00", endTime: "12:00" },
    { date: "2026-11-05", startTime: "09:00", endTime: "12:00" },
    { date: "2026-11-06", startTime: "00:00", endTime: "00:00" },
  ];

  it("keeps the dates from the schedule's today on", () => {
    expect(upcomingOverrideDays(overrides, "Europe/London", now).map((day) => day.date)).toEqual([
      "2026-11-05",
      "2026-11-06",
    ]);
    expect(upcomingOverrideDays(overrides, "Asia/Kuala_Lumpur", now).map((day) => day.date)).toEqual([
      "2026-11-06",
    ]);
  });
});

describe("withOverride", () => {
  it("replaces the date's rows and keeps every other date's, past ones included", () => {
    expect(withOverride(christmas, ["2026-12-24"], [{ start: "10:00", end: "15:00" }])).toEqual([
      { date: "2025-12-24", startTime: "09:00", endTime: "12:00" },
      { date: "2026-12-24", startTime: "10:00", endTime: "15:00" },
      { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
    ]);
  });

  it("gives each of several dates the same ranges, earliest first", () => {
    expect(
      withOverride(
        [],
        ["2026-12-31", "2026-12-30"],
        [
          { start: "14:00", end: "16:00" },
          { start: "09:00", end: "11:00" },
        ]
      )
    ).toEqual([
      { date: "2026-12-30", startTime: "09:00", endTime: "11:00" },
      { date: "2026-12-30", startTime: "14:00", endTime: "16:00" },
      { date: "2026-12-31", startTime: "09:00", endTime: "11:00" },
      { date: "2026-12-31", startTime: "14:00", endTime: "16:00" },
    ]);
  });

  it("marks a date unavailable all day the way Cal.diy does, with no ranges", () => {
    expect(withOverride(christmas, ["2026-12-24"], [])).toEqual([
      { date: "2025-12-24", startTime: "09:00", endTime: "12:00" },
      { date: "2026-12-24", startTime: "00:00", endTime: "00:00" },
      { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
    ]);
  });
});

describe("withoutOverride", () => {
  it("removes every row of the date, so it goes back to its weekly hours", () => {
    expect(withoutOverride(christmas, "2026-12-24")).toEqual([
      { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
      { date: "2025-12-24", startTime: "09:00", endTime: "12:00" },
    ]);
  });
});

describe("weekdayOf", () => {
  it.each([
    ["2026-11-05", "Thursday"],
    ["2026-11-08", "Sunday"],
    ["2026-11-09", "Monday"],
    ["2028-02-29", "Tuesday"],
  ])("knows %s is a %s", (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });
});

describe("defaultOverrideRanges", () => {
  const hours: WeeklyHours[] = [
    { days: ["Monday", "Thursday"], startTime: "14:00", endTime: "17:00" },
    { days: ["Thursday"], startTime: "09:00", endTime: "12:00" },
  ];

  it("starts from the hours of the date's weekday", () => {
    expect(defaultOverrideRanges(hours, "2026-11-05")).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "17:00" },
    ]);
  });

  it("starts from 9:00 to 17:00 on a weekday with no hours", () => {
    expect(defaultOverrideRanges(hours, "2026-11-08")).toEqual([{ start: "09:00", end: "17:00" }]);
  });
});

describe("overrideDateText", () => {
  it("writes the date short, or in full for screen readers", () => {
    expect(overrideDateText("2026-12-24", "en-US")).toBe("Thu, Dec 24, 2026");
    expect(overrideDateText("2026-12-24", "en-US", "long")).toBe("Thursday, December 24, 2026");
  });
});

describe("overrideHoursText", () => {
  it("lists the times, or says the date is unavailable all day", () => {
    expect(
      overrideHoursText(
        t,
        {
          date: "2026-12-24",
          ranges: [
            { start: "09:00", end: "12:00" },
            { start: "13:00", end: "17:00" },
          ],
        },
        "en-US"
      )
    ).toBe("9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM");
    expect(overrideHoursText(t, { date: "2026-12-25", ranges: [] }, "en-US")).toBe(
      en.availability.overrides.unavailable
    );
  });
});
