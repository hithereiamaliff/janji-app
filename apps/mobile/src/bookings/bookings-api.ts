import { type CalClient, unwrap } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import { type BookingSummary, toBookingSummary } from "./booking";
import { type BookingDetail, pickBooking, toBookingDetail } from "./booking-detail";

export const BOOKING_FILTERS = ["upcoming", "unconfirmed", "past", "cancelled"] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export const BOOKINGS_PAGE_SIZE = 20;

export type BookingsPage = {
  bookings: BookingSummary[];
  /** The page to request next, or null when this was the last one. */
  nextPage: number | null;
};

// Upcoming and unconfirmed bookings read soonest first; past and cancelled ones most recent first.
const START_ORDER: Record<BookingFilter, "asc" | "desc"> = {
  upcoming: "asc",
  unconfirmed: "asc",
  past: "desc",
  cancelled: "desc",
};

export type BookingsPageRequest = {
  filter: BookingFilter;
  /** Zero-based page number. */
  page: number;
  /** Matches attendee names on the server. */
  search?: string;
};

export async function fetchBookingsPage(
  client: CalClient,
  { filter, page, search }: BookingsPageRequest
): Promise<BookingsPage> {
  const attendeeName = search?.trim() || undefined;
  const body = unwrap(
    await client.GET("/v2/bookings", {
      params: {
        query: {
          status: [filter],
          sortStart: START_ORDER[filter],
          take: BOOKINGS_PAGE_SIZE,
          skip: page * BOOKINGS_PAGE_SIZE,
          attendeeName,
        },
      },
    })
  );
  return {
    bookings: body.data.map(toBookingSummary),
    nextPage: body.pagination.hasNextPage ? page + 1 : null,
  };
}

export async function fetchBooking(client: CalClient, uid: string): Promise<BookingDetail> {
  const body = unwrap(
    await client.GET("/v2/bookings/{bookingUid}", { params: { path: { bookingUid: uid } } })
  );
  const booking = pickBooking(body.data, uid);
  // An empty recurring series has nothing to show; treat it like a booking that no longer exists.
  if (!booking) throw new CalApiError({ kind: "not_found", status: 200 });
  return toBookingDetail(booking);
}

/** A link that adds a booking to a web calendar. */
export type CalendarLink = {
  calendar: "google" | "outlook" | "office" | "other";
  /** Cal.diy's name for it, for calendars the app doesn't know. */
  label: string;
  url: string;
};

const CALENDARS: Record<string, CalendarLink["calendar"]> = {
  "calendar.google.com": "google",
  "outlook.live.com": "outlook",
  "outlook.office.com": "office",
};

/**
 * Links that add the booking to Google Calendar, Outlook.com and Microsoft 365. Cal.diy also offers an ICS
 * file as a data: URL, which a phone can't open from an app, so only web links are kept.
 */
export async function fetchCalendarLinks(client: CalClient, uid: string): Promise<CalendarLink[]> {
  const body = unwrap(
    await client.GET("/v2/bookings/{bookingUid}/calendar-links", { params: { path: { bookingUid: uid } } })
  );
  const links: CalendarLink[] = [];
  for (const { label, link } of body.data) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    if (url.protocol === "https:")
      links.push({ calendar: CALENDARS[url.hostname] ?? "other", label, url: link });
  }
  return links;
}
