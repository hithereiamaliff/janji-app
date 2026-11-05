import { dateTimeFormat } from "@/lib/date-format";

/** "1:00 PM" or "13:00": an afternoon time on the given clock, as an example of it. */
export function clockExample(timeFormat: 12 | 24, locale: string): string {
  return dateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === 12,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, 13)));
}
