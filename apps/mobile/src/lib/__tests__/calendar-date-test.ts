import { format } from "date-fns";

import {
  addMonths,
  calendarDateText,
  compareMonths,
  dayOfMonthText,
  monthOf,
  monthTitle,
  monthWeeks,
  todayIn,
  toUtcDate,
  weekdayNames,
} from "@/lib/calendar-date";

describe("toUtcDate", () => {
  it("reads the date as midnight UTC", () => {
    expect(toUtcDate("2026-12-24").toISOString()).toBe("2026-12-24T00:00:00.000Z");
  });
});

describe("todayIn", () => {
  // 5:30 PM in London on 5 November 2026, which is already the 6th in Kuala Lumpur.
  const now = new Date("2026-11-05T17:30:00Z");

  it("gives today's date on the time zone's clock", () => {
    expect(todayIn("Europe/London", now)).toBe("2026-11-05");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-11-05");
    expect(todayIn("Asia/Kuala_Lumpur", now)).toBe("2026-11-06");
  });

  it("falls back to the device's date for a time zone Intl doesn't know", () => {
    expect(todayIn("Mars/Olympus", now)).toBe(format(now, "yyyy-MM-dd"));
  });
});

describe("months", () => {
  it("finds a date's month", () => {
    expect(monthOf("2026-12-24")).toEqual({ year: 2026, month: 12 });
  });

  it("moves across the turn of a year", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 11 }, 14)).toEqual({ year: 2028, month: 1 });
  });

  it("puts months in order", () => {
    expect(compareMonths({ year: 2026, month: 11 }, { year: 2026, month: 12 })).toBeLessThan(0);
    expect(compareMonths({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
    expect(compareMonths({ year: 2026, month: 12 }, { year: 2026, month: 12 })).toBe(0);
  });
});

describe("monthWeeks", () => {
  it("lines the days up under weeks that start on Monday", () => {
    // 1 November 2026 is a Sunday.
    const weeks = monthWeeks({ year: 2026, month: 11 }, 1);

    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[1]?.[0]).toBe("2026-11-02");
    expect(weeks[5]).toEqual(["2026-11-30", null, null, null, null, null, null]);
  });

  it("lines them up under weeks that start on Sunday", () => {
    const weeks = monthWeeks({ year: 2026, month: 11 }, 0);

    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toBe("2026-11-01");
    expect(weeks[4]).toEqual(["2026-11-29", "2026-11-30", null, null, null, null, null]);
  });

  it("knows how long each month is, leap years included", () => {
    expect(monthWeeks({ year: 2026, month: 2 }, 0).flat().filter(Boolean)).toHaveLength(28);
    expect(monthWeeks({ year: 2028, month: 2 }, 0).flat().filter(Boolean)).toHaveLength(29);
    expect(monthWeeks({ year: 2026, month: 12 }, 1).flat().filter(Boolean).at(-1)).toBe("2026-12-31");
  });
});

describe("text", () => {
  it("writes a date short, or in full for screen readers", () => {
    expect(calendarDateText("2026-12-24", "en-US")).toBe("Thu, Dec 24, 2026");
    expect(calendarDateText("2026-12-24", "en-US", "long")).toBe("Thursday, December 24, 2026");
    expect(dayOfMonthText("2026-12-04", "en-US")).toBe("4");
  });

  it("names the month and the weekday columns", () => {
    expect(monthTitle({ year: 2026, month: 12 }, "en-US")).toBe("December 2026");
    expect(weekdayNames(1, "en-US")).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekdayNames(0, "en-US")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});
