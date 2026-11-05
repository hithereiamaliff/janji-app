import { dateTimeFormat } from "@/lib/date-format";

/** A month of the calendar, where month runs from 1 for January to 12. */
export type CalendarMonth = { year: number; month: number };

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A calendar date ("YYYY-MM-DD") as midnight UTC. Formatting it in UTC keeps it on its own day, whatever the
 * device's time zone.
 */
export function toUtcDate(date: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Today's date ("YYYY-MM-DD") on the clock of the time zone, or of the device if Intl doesn't know the zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = dateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((each) => each.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

export function monthOf(date: string): CalendarMonth {
  const utc = toUtcDate(date);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1 };
}

export function addMonths({ year, month }: CalendarMonth, count: number): CalendarMonth {
  const index = year * 12 + month - 1 + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Below zero, zero or above zero as the first month comes before, is or comes after the second. */
export function compareMonths(a: CalendarMonth, b: CalendarMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/**
 * The month's dates in weeks of seven that start on weekStart (0 for Sunday to 6 for Saturday). The days
 * before the 1st and after the last are null, so every week lines up under the same weekdays.
 */
export function monthWeeks({ year, month }: CalendarMonth, weekStart: number): (string | null)[][] {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() - weekStart + 7) % 7;
  // Day 0 of the next month is this month's last day.
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`),
  ];
  while (days.length % 7 !== 0) days.push(null);
  const weeks: (string | null)[][] = [];
  for (let start = 0; start < days.length; start += 7) weeks.push(days.slice(start, start + 7));
  return weeks;
}

/** "Thu, Dec 24, 2026", or "Thursday, December 24, 2026" in full, in the person's language. */
export function calendarDateText(date: string, locale: string, width: "short" | "long" = "short"): string {
  return dateTimeFormat(locale, {
    weekday: width,
    day: "numeric",
    month: width,
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

/** The day of the month in the person's numerals, such as "24". */
export function dayOfMonthText(date: string, locale: string): string {
  return dateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(toUtcDate(date));
}

/** "December 2026". */
export function monthTitle({ year, month }: CalendarMonth, locale: string): string {
  return dateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/** Short weekday names for a calendar's columns, starting on weekStart: "Mon", "Tue" and on. */
export function weekdayNames(weekStart: number, locale: string): string[] {
  const format = dateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 4 January 1970 was a Sunday, so adding a weekday's number lands on that weekday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(Date.UTC(1970, 0, 4 + ((weekStart + index) % 7))))
  );
}
