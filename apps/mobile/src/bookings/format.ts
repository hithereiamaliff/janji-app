import { differenceInCalendarDays } from "date-fns";

import { dateTimeFormat } from "@/lib/date-format";

// Booking times are shown in the device's time zone (where the person is right now), so these helpers use
// local time unless they're given another time zone, as the detail screen does for attendees.

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** The calendar day a booking starts on, in the device's time zone, e.g. "2026-11-06". */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type RelativeDayLabels = {
  today: string;
  tomorrow: string;
  yesterday: string;
};

/** "Today", "Tomorrow", "Yesterday", or a short date ("Thu, 12 Nov"), with the year only when it differs. */
export function formatDayHeading(
  iso: string,
  { locale, now, labels }: { locale: string; now: Date; labels: RelativeDayLabels }
): string {
  const date = new Date(iso);
  const daysFromNow = differenceInCalendarDays(date, now);
  if (daysFromNow === 0) return labels.today;
  if (daysFromNow === 1) return labels.tomorrow;
  if (daysFromNow === -1) return labels.yesterday;
  return dateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** "3:00 pm – 3:30 pm", in the locale's own 12- or 24-hour style. */
export function formatTimeRange(startIso: string, endIso: string, locale: string): string {
  const time = dateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  return `${time.format(new Date(startIso))} – ${time.format(new Date(endIso))}`;
}

/** "Friday, 6 November 2026", in the locale's own order. */
export function formatFullDate(iso: string, locale: string): string {
  return dateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

// The weekday is part of the range because another time zone can put the booking on a different day.
function formatZonedTimeRange(startIso: string, endIso: string, locale: string, timeZone?: string): string {
  const start = dateTimeFormat(locale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const end = dateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone });
  return `${start.format(new Date(startIso))} – ${end.format(new Date(endIso))}`;
}

/**
 * The time range as clocks in another time zone show it ("Fri 4:00 pm – 5:00 pm"). Returns null when those
 * clocks read the same as the device's, or when the device doesn't know the time zone.
 */
export function timeRangeElsewhere(
  startIso: string,
  endIso: string,
  locale: string,
  timeZone: string
): string | null {
  try {
    const there = formatZonedTimeRange(startIso, endIso, locale, timeZone);
    return there === formatZonedTimeRange(startIso, endIso, locale) ? null : there;
  } catch {
    // Intl throws a RangeError for a time zone it doesn't know.
    return null;
  }
}

/** A time zone's city, which reads better than its id: "Asia/Kuala_Lumpur" → "Kuala Lumpur". */
export function timeZoneCity(timeZone: string): string {
  return timeZone.slice(timeZone.lastIndexOf("/") + 1).replace(/_/g, " ");
}

/** "3:00 pm", in the locale's own 12- or 24-hour style. */
export function formatTime(iso: string, locale: string): string {
  return dateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "6 Nov" or "Nov 6", in the locale's own order. */
export function formatShortDate(date: Date, locale: string): string {
  return dateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}
