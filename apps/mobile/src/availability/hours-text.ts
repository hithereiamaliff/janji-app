import type { TFunction } from "i18next";

import { dateTimeFormat } from "@/lib/date-format";

import { WEEK_DAYS, type WeekDay, type WeeklyHours } from "./schedule";

function dayName(index: number, locale: string, width: "short" | "long" = "short"): string {
  // 1 January 2024 was a Monday, so adding the day's place in WEEK_DAYS lands on that weekday.
  return dateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + index))
  );
}

/** The day's full name in the person's language, such as "Monday" or "Isnin". */
export function weekdayName(day: WeekDay, locale: string): string {
  return dayName(WEEK_DAYS.indexOf(day), locale, "long");
}

/** "Mon, Tue, Fri–Sun": short day names in week order, with three or more days in a row given as a range. */
export function daysText(days: readonly WeekDay[], locale: string): string {
  const indexes = WEEK_DAYS.flatMap((day, index) => (days.includes(day) ? [index] : []));
  const runs: number[][] = [];
  for (const index of indexes) {
    const run = runs.at(-1);
    if (run && run.at(-1) === index - 1) run.push(index);
    else runs.push([index]);
  }
  return runs
    .flatMap((run) => {
      const first = run[0];
      const last = run.at(-1);
      if (run.length < 3 || first === undefined || last === undefined) {
        return run.map((index) => dayName(index, locale));
      }
      return [`${dayName(first, locale)}–${dayName(last, locale)}`];
    })
    .join(", ");
}

/**
 * "10:00 AM" for "10:00", in the locale's 12- or 24-hour style. Schedule times are already on the clock of the
 * schedule's time zone, so they're shown as they are rather than moved into the device's.
 */
export function clockTime(hoursMinutes: string, locale: string): string {
  const [hours = 0, minutes = 0] = hoursMinutes.split(":").map(Number);
  return dateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(1970, 0, 1, hours, minutes))
  );
}

/** One line for each set of weekly hours, such as "Mon–Fri, 9:00 AM – 5:00 PM". */
export function weeklyHoursText(t: TFunction, hours: readonly WeeklyHours[], locale: string): string[] {
  if (hours.length === 0) return [t("availability.noWeeklyHours")];
  return hours.map(({ days, startTime, endTime }) =>
    t("availability.hoursLine", {
      days: daysText(days, locale),
      start: clockTime(startTime, locale),
      end: clockTime(endTime, locale),
    })
  );
}
