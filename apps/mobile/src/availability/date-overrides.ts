import type { TFunction } from "i18next";

import { dateTimeFormat } from "@/lib/date-format";

import { clockTime } from "./hours-text";
import { type DateOverride, WEEK_DAYS, type WeekDay, type WeeklyHours } from "./schedule";
import { DEFAULT_RANGE, sortRanges, type TimeRange, toDayRanges } from "./weekly-hours-form";

/** The hours one date ("YYYY-MM-DD") has instead of its weekly ones. No ranges means unavailable all day. */
export type OverrideDay = { date: string; ranges: TimeRange[] };

/**
 * One entry per date, earliest first. Cal.diy marks a date unavailable all day with a 00:00–00:00 row, and any
 * row that ends when it starts adds no time, so those rows leave a date with no ranges.
 */
export function overrideDays(overrides: readonly DateOverride[]): OverrideDay[] {
  const days = new Map<string, TimeRange[]>();
  for (const { date, startTime, endTime } of overrides) {
    const ranges = days.get(date) ?? [];
    if (startTime !== endTime) ranges.push({ start: startTime, end: endTime });
    days.set(date, ranges);
  }
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ranges]) => ({ date, ranges: sortRanges(ranges) }));
}

const pad = (value: number) => String(value).padStart(2, "0");

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

/**
 * The dates from today on, where today is the schedule's: like the web app, earlier dates aren't shown, since
 * they no longer change when anyone can book.
 */
export function upcomingOverrideDays(
  overrides: readonly DateOverride[],
  timeZone: string,
  now: Date = new Date()
): OverrideDay[] {
  const today = todayIn(timeZone, now);
  return overrideDays(overrides).filter((day) => day.date >= today);
}

function rowsFor(date: string, ranges: readonly TimeRange[]): DateOverride[] {
  if (ranges.length === 0) return [{ date, startTime: "00:00", endTime: "00:00" }];
  return sortRanges(ranges).map(({ start, end }) => ({ date, startTime: start, endTime: end }));
}

function byDateAndStart(a: DateOverride, b: DateOverride): number {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
}

/**
 * The overrides with each of the dates given the ranges, or made unavailable all day when there are none.
 * Saving overrides replaces all of them, so every other date keeps its rows, past ones included.
 */
export function withOverride(
  overrides: readonly DateOverride[],
  dates: readonly string[],
  ranges: readonly TimeRange[]
): DateOverride[] {
  const changed = new Set(dates);
  return [
    ...overrides.filter((override) => !changed.has(override.date)),
    ...[...changed].flatMap((date) => rowsFor(date, ranges)),
  ].sort(byDateAndStart);
}

/** The overrides without the date's, so it goes back to its weekly hours. */
export function withoutOverride(overrides: readonly DateOverride[], date: string): DateOverride[] {
  return overrides.filter((override) => override.date !== date);
}

function utcDate(date: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function weekdayOf(date: string): WeekDay {
  // getUTCDay counts from Sunday, while WEEK_DAYS starts on Monday.
  return WEEK_DAYS[(utcDate(date).getUTCDay() + 6) % 7] ?? "Monday";
}

/** Where a new override for the date starts, as on the web: its weekday's hours, or 9:00–17:00 if it has none. */
export function defaultOverrideRanges(hours: readonly WeeklyHours[], date: string): TimeRange[] {
  const ranges = toDayRanges(hours)[weekdayOf(date)];
  return ranges.length > 0 ? ranges : [DEFAULT_RANGE];
}

/**
 * "Thu, 25 Dec 2026", or in full ("Thursday, 25 December 2026") for screen readers. It's a date on the
 * schedule's calendar rather than a moment, so it's formatted in UTC, where it can't move to another day.
 */
export function overrideDateText(date: string, locale: string, width: "short" | "long" = "short"): string {
  return dateTimeFormat(locale, {
    weekday: width,
    day: "numeric",
    month: width,
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate(date));
}

/** "Unavailable all day", or the times such as "9:00 AM – 12:00 PM, 2:00 PM – 5:00 PM". */
export function overrideHoursText(t: TFunction, day: OverrideDay, locale: string): string {
  if (day.ranges.length === 0) return t("availability.overrides.unavailable");
  return day.ranges
    .map(({ start, end }) =>
      t("availability.overrides.range", { start: clockTime(start, locale), end: clockTime(end, locale) })
    )
    .join(", ");
}
