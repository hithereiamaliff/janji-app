import { differenceInCalendarDays } from "date-fns";

// Booking times are shown in the device's time zone (where the person is right now), so these helpers use
// local time throughout. A booking's own time zone matters on the detail screen, not in the list.

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
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** "3:00 pm – 3:30 pm", in the locale's own 12- or 24-hour style. */
export function formatTimeRange(startIso: string, endIso: string, locale: string): string {
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  return `${time.format(new Date(startIso))} – ${time.format(new Date(endIso))}`;
}
