import type { BookingSummary } from "./booking";
import { dayKey } from "./format";

export type BookingSection = {
  /** The day, as from dayKey(). */
  key: string;
  title: string;
  data: BookingSummary[];
};

/**
 * Groups bookings into one section per day, keeping their order. The API returns bookings sorted by start
 * time, so a day's bookings are always next to each other, even across page boundaries.
 */
export function groupByDay(
  bookings: BookingSummary[],
  titleFor: (startIso: string) => string
): BookingSection[] {
  const sections: BookingSection[] = [];
  for (const booking of bookings) {
    const key = dayKey(booking.start);
    const current = sections.at(-1);
    if (current?.key === key) {
      current.data.push(booking);
    } else {
      sections.push({ key, title: titleFor(booking.start), data: [booking] });
    }
  }
  return sections;
}
